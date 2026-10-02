# HI MCP Testing Skill

**Load this skill when:** the user asks to **"test the mcp"** — run [Test the MCP](#test-the-mcp) —
or the task involves testing the HI MCP server end to end with a real model and a real planner:
running a prompt through the chat, checking the plan a prompt produces, comparing prompts or models.

## Test the MCP

Runs every prompt of [testing-prompts.md](../../docs/testing-prompts.md) that needs no image through
the chat, stores every result under one session directory and ends with `report.md`: per prompt the
plan snapshot id, the perspective and the top image, an evaluation and a bug verdict.

### 1. Model

`gpt-5.4-mini` with `$AZURE_GPT_KEY`, unless the user names another model — then that provider
name (see [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md)) with its key: `mistral*` →
`$MISTRAL_API_KEY`, `gpt-5*` / `gpt-6*` → `$AZURE_GPT_KEY`. When the key variable is empty, stop and ask the
user for the key. Never write a key into a file. "with the local planner" / "with --dev" adds
`--dev` to every run (the roomle-ui dev server must run on :5173).

### 2. Session directory

```bash
SESSION=".temp/result/mcp-test-$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$SESSION"
```

### 3. Prompts

Read `docs/testing-prompts.md` at run time — it is the only prompt list:

- every fenced block without a language tag is one prompt, in document order (the `bash` block
  under "Testing Guidelines" is not);
- skip the prompts that need an image (a `*Reference: …png*` line, or the prompt refers to "the
  image") — the report lists them as skipped;
- a prompt under "Group Editing" starts from the plan the section names: its setup turn
  `add a group of three tall units to the wall on the right` comes first, and a step its title
  names comes second ("after removing the middle unit" → `remove the middle unit`);
- name each run `<NN>-<slug>`: two digits in document order, a short kebab-case slug of the
  prompt's title, e.g. `01-three-tall-units-right-wall`.

### 4. Run

One prompt after another — the ports are fixed. Start **each run as its own background command**
and evaluate the previous result while it runs. Not one loop over all prompts: a background
command has a time limit (a loop over the 13 prompts was stopped in the 11th run — the script ends
cleanly on the SIGTERM, but that run has to be repeated):

```bash
mkdir -p "$SESSION/<NN>-<slug>"
node .agents/scripts/run-hi-mcp-prompt.js gpt-5.4-mini "$AZURE_GPT_KEY" ["<setup turn>" ...] "<prompt>" \
  --out "$SESSION/<NN>-<slug>" > "$SESSION/<NN>-<slug>/console.log" 2>&1
```

Create the run directory first — without it the shell cannot open `console.log` and the script
never starts. Exit code 1 is a result like any other (the model or the chat reported an error) — go
on with the next prompt. A run without `run.json` (the launcher or the page did not come up) is retried once;
if it fails again, the report lists it as not run with the last lines of its `console.log`.

### 5. Evaluate

Per run, read:

| File | Look at |
|---|---|
| `top-image.png`, `perspective-image.png` | where the group stands, what it consists of |
| `run.json` | per turn the answer, the tools and `toolCalls` — per call of a plan-changing tool the `args` the model sent and the `corrections`, `notLoaded` or `error` it got back; `errors`; `planSnapshotId` |
| `order-data.json` | the articles and attributes (materials, colours, dimensions) |
| `plan-context.json` | the room's walls (`rooms.rooms[].…walls[]`: `side`, `start`/`end`, `facingRotationY`) and the groups after the chat (`groups[].position`: `pos`, `rotationY`, `footprint`; `groups[].roots[].desc`) |
| `planner-calls.json` | what the MCP server sent to the planner: `loadExternalObjectGroupLayout` — `args[0].posGroups[]` with the roots, their docking (`contextData.dockedRoots`) and attributes, and `repositioningData` (the placement); `externalObjectGroupOperation` — `args` = the command and its payload; `ok: false` with the page's `error` |
| `console.log` | `[hi-mcp]` and `[hi-chat]` errors |

The evidence at a glance (`R` = the run directory):

```bash
jq '{planSnapshotId, errors, turns: [.turns[] | {prompt, answer: (.answer | .[0:500]), tools, toolCalls}]}' "$R/run.json"
jq -c '.groups[]? | {group: .id[0:8], pos: .position.pos, rotationY: .position.rotationY, sizeMm: [.position.footprint.widthMm, .position.footprint.depthMm], roots: [.roots[]? | .desc]}' "$R/plan-context.json"
jq -c '.[] | select(.method != "getExternalObjectPlanContext") | {method, ok, error, placement: [.args[0] | objects | .posGroups[]?.repositioningData | select(.)], firstArg: ([.args[0] | strings][0]), command: (if .method == "externalObjectGroupOperation" then .args else null end)}' "$R/planner-calls.json"
jq -c '[.[] | select(.method == "loadExternalObjectGroupLayout")][-1].args[0].posGroups[].roots[] | {id, articleId, attributes: [.attributes[]? | "\(.id)=\(.value)"], docks: [.contextData.dockedRoots[]? | "\(.ownDockingVector)->" + ([.dockedRoots[].id] | join(","))]}' "$R/planner-calls.json"
```

Check:

- the request is fulfilled — the units, appliances, count and materials asked for (materials are
  root `attributes` in the layout; none there means none applied); for an edit, the edit is
  applied and nothing else changed;
- the group stands where asked — on that wall or in that corner, back against the wall, inside the
  room, not through a wall, window or door, not overlapping another group;
- the docking graph is sound — every root reachable from the placed root, at most one root per
  docking vector, wall units docked to `*Top` vectors;
- the answer matches the plan (models claim materials, connections and corners they did not
  author).

Tool results are not in the chat stream; `toolCalls` of `run.json`, read from the MCP server's log,
holds per call of a plan-changing tool what the model sent (`args`, copied before the server
corrected it) and what it got back: the corrections, the groups not built, the error. A schema
error ("Input validation error") is not in it — it shows only as a tool call without planner calls.

Before calling a result a model finding, compare the model's `args` with what reached the planner
(`planner-calls.json`). Content the model sent that is missing in the planner call without a
correction reporting it is a **bug** of the MCP server, not a model finding.

#### Verdict

| Verdict | When |
|---|---|
| pass | everything asked for is in the plan and placed correctly, no errors |
| partial | the plan is usable but misses part of the request (an appliance, a material, a unit count) |
| fail | the main request is not in the plan — nothing created, the edit not applied, the wrong wall, outside the room — or the run ended with an error |

#### Bug

A result is a bug when the system, not the model, is at fault:

| Finding | Classification |
|---|---|
| a planner call fails with `api.extended[message.method] is not a function` | **environment**, no bug: the planner build the page loaded lacks that method (the command tools need `externalObjectGroupOperation`); test against a planner that has it, e.g. with `--dev` |
| a tool or planner call fails or is rejected although the request is valid | **bug** — in the MCP server (tool error) or the planner (the page's error), by where the error comes from |
| the chat fails on the system's own data, e.g. a tool result larger than the model's context | **bug** — chat backend / MCP server |
| the placement the server sent is right (`repositioningData.posGroup` at the wall's `end` or the corner point, `posRotationY` the wall's `facingRotationY`), but the group stands elsewhere; or valid input yields impossible geometry (outside the room, through a wall, overlapping another group) | **bug** — MCP server placement or planner |
| the plan contradicts what the tools reported (success, but the group is missing or unchanged) | **bug** |
| a correction of the server is wrong for the request, or the server changed the input without reporting it in `corrections` | **bug** — MCP server correction |
| the server dropped content the model sent (its `args` in `toolCalls`) without reporting it | **bug** — MCP server |
| the model's own input is wrong: another wall or point (a wall's `start` instead of its `end`), other articles, missing items, input the server had to correct (`toolCalls`), stopped early, no tool call | **model finding**, no bug |
| provider errors: authorization, quota, rate limit | **environment**, no bug |

A model finding the server could have caught — a wall unit as the placement anchor — and a
correction that recurs across runs are also **hardening candidates**: the report lists these separately, with how often they occurred, and
names the rule sentence, tool description or part of the tool API that led the model there.
Hardening follows [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): clarify
the instruction or simplify the tool API first, correct the input in the server second, and reject
it only as a last resort. A group placed outside the room is a model finding only, never a
hardening candidate: the user may ask for a placement outside the room, so the server must not
refuse it.

For a corner article the server adds the corner point offset to `posGroup` itself — compare the
corner, not the raw point. State the evidence (file and value) behind every bug verdict.

### 6. Report

Write `$SESSION/report.md`:

````markdown
# HI MCP test — <YYYY-MM-DD HH:MM>

| Model | Planner | Prompts | Pass | Partial | Fail | Bugs |
|---|---|---|---|---|---|---|
| gpt-5.4-mini | bo-test | 13 run, 2 skipped (image) | … | … | … | … |

## Summary

| # | Prompt | Verdict | Bug | Plan snapshot |
|---|---|---|---|---|
| 01 | [<title>](#01-<slug>) | pass | no | `ps_…` |

## Bugs

- **<component>** — <one sentence> ([01](#01-<slug>))

## Hardening candidates

- <what the server accepted or had to correct> — <the instruction or tool API part that led the model there> — <n> runs ([02](#02-<slug>), …)

## Corrections

- <what the server corrected, from `toolCalls`> — <n> runs ([02](#02-<slug>), …)

## Environment

- <what kept runs from testing the system, e.g. a planner method missing in the planner build> — <runs>

## 01 <title>

> <prompt>

Setup turns: <none, or the turns before the prompt>

- **Plan snapshot**: `ps_…`
- **Tools**: <per turn, in order>
- **Corrections**: <per tool, the corrections, groups not loaded and errors of `toolCalls`, or none>
- **Answer**: <the model's final answer, shortened>

| Perspective | Top |
|---|---|
| <img src="01-<slug>/perspective-image.png" width="420"> | <img src="01-<slug>/top-image.png" width="420"> |

**Evaluation — <verdict>**: <what is in the plan against what was asked, with the evidence>

**Bug — <yes: component / no: model finding / no: environment>**: <why>

## Skipped

- <title> — needs a reference image
````

Then tell the user the report's path, the verdicts and the bugs.

## Run a prompt (the script)

```bash
node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" ...] [--out <dir>] [--dev] [--headed]
```

| Argument | Meaning |
|---|---|
| `<provider>` | a chat provider of the launcher, passed through unchanged (`gpt-5.4-mini`, `mistral`, `claude`, … — see [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md)) |
| `<api-key>` | the provider's API key, e.g. `"$AZURE_GPT_KEY"` |
| `"<prompt>" …` | the user messages: consecutive turns of one conversation (the history goes along, as in the chat window); a turn with an error ends it |
| `--out <dir>` | the result directory (default `.temp/result/<UTC timestamp>-<provider>/`) |
| `--dev` | the planner from the local Rubens UI dev server (`npm run dev` in roomle-ui, :5173) |
| `--headed` | shows the browser window |

The script:

1. starts the launcher (`minimal-hi-example/start.mjs <provider> <api-key> --no-open`) with the MCP
   server on port **3110**, not 3100 — example tabs of an interactive session reconnect to 3100 and
   would take the bridge away from the run's page;
2. opens the example URL the launcher prints in Playwright Chromium, a fresh browser each run, so
   every run starts from the preset plan (no IndexedDB state);
3. waits until the MCP tool `get-plan-context` lists articles (server up, page connected, HI library
   loaded);
4. sends the prompts to the chat backend (`POST /chat`, the chat window's system prompt and tools),
   each until the end of its stream, and records every planner call the MCP server sends to the
   page (from the bridge's WebSocket frames — the server's log cuts the arguments short);
5. reads the rooms and groups (`get-plan-context`), then `getExternalObjectSnapshot()`, then saves
   the plan with `saveExternalObjectSnapshot()` for its plan snapshot id — **every run saves one
   plan snapshot in the Roomle backend**, as the example's "Save snapshot" button does;
6. stops the browser and every server process, also after an error or Ctrl+C.

### The result

| File | Content |
|---|---|
| `run.json` | provider; `turns` (per turn the prompt, the model's answer, the tools in order, `toolCalls` — per call of a plan-changing tool the `args` the model sent and its `corrections`, `notLoaded` or `error` — errors, duration); all `errors`; `planSnapshotId`; example URL, start time, durations (ready, chat, snapshot) |
| `plan-context.json` | `get-plan-context` with rooms and groups after the chat — the walls and where the groups stand |
| `planner-calls.json` | every planner call during the chat: method, full arguments, `ok`, and the page's `error` |
| `snapshot.json` | the return value of `getExternalObjectSnapshot()`, unchanged |
| `order-data.json` | `orderData` of the snapshot — the groups with their articles and attributes |
| `top-image.png`, `perspective-image.png` | the whole plan rendered |
| `top-object-image.png`, `perspective-object-image.png` | the HI objects only (missing when the plan has no groups) |
| `object.glb` | the HI objects as GLB (missing when the plan has no groups) |
| `plan.xml` | the plan XML |

Exit code 0 when neither the chat nor the snapshot reported an error; 1 when one did, or when no
snapshot or no plan snapshot id came back (the reason is in `errors`) — the result
directory is written in both cases, after an error the snapshot shows the plan as the model left
it. A failed planner call the model reports in its answer is not an error of the run: it is in
`planner-calls.json`. A run that fails before the prompt (launcher, readiness timeout) writes no
result directory, and neither does a stopped run (Ctrl+C: exit 130, SIGTERM: 143) — it only stops
the browser and the servers.

A run takes about 10 s until the page is ready, the model's time for the chat (gpt-5.4-mini: 5–15 s
per turn; Mistral Large: 40 s to 2 min for one group) and about 20 s for the snapshot and the save.

## Prerequisites

- Node 20+
- `npm install` in `.agents/scripts` (Playwright 1.55.0 — the version roomle-ui uses, so its cached
  Chromium is reused; on a machine without it: `npx playwright install chromium` in `.agents/scripts`)
- ports 3000, 3110 and 3200 free — stop an interactive `npm start` first; one run at a time
- to stop a run, press Ctrl+C in its terminal. With Volta, `node` is a shim that does not pass
  signals on: a `kill -INT <pid>` from another shell reaches the shim, not the script — send it to
  the real Node process (started via `$(node -p process.execPath)`) instead
- `--dev` only: the roomle-ui dev server running on :5173

## When a run fails

| Symptom | Cause |
|---|---|
| `the launcher exited with code 1` right after the start | unknown provider, a missing key, a busy port or a failed typecheck — the launcher's message is printed above |
| `timed out … waiting for the page and the HI library` | the page did not connect or the HI library did not load — run with `--headed` and look at the page |
| `errors` in `run.json` with the provider's message | invalid key or a provider failure; the snapshot is still stored |
| `Prompt … > 262144 maximum context length` in `errors` | the turn's tool results exceed the model's context — a **bug**. Fixed causes: the images of `get-plan-images` reached Mistral as base64 text ([analysis](../bug-analysis/plan-images-sent-as-text-to-mistral.md)); the image URLs and the pretty-printing of the tool results ([analysis](../bug-analysis/tool-results-exceed-mistral-context.md)) |
| `api.extended[message.method] is not a function` in `planner-calls.json` | the planner build lacks the method (see the bug rules above) |
| `chat request failed: … aborted` | a turn took longer than 10 minutes |

## See also

- [hi-mcp-tools.md](./hi-mcp-tools.md) — the tools the model calls
- [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md) — the chat backend and its providers
- Feature analyses: [the script](../feature-analysis/hi-mcp-prompt-run-script.md),
  ["test the mcp"](../feature-analysis/hi-mcp-test-the-mcp-skill.md)
