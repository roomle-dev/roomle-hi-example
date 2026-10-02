# HI MCP Testing Skill

**Load this skill when:** the user asks to **"test the mcp"** — run [Test the MCP](#test-the-mcp) —
or the task involves testing the HI MCP server end to end with a real model and a real planner:
running a prompt through the chat, checking the plan a prompt produces, comparing prompts or models.

## Test the MCP

Runs the tests of [test-prompts.json](../../docs/test-prompts.json) with the runner
`run-hi-mcp-tests.js` — each from its plan, with its operations, prompt and image — stores every
result under one session directory and ends with `report.md`: per test the plan snapshot id, the
perspective and the top image, an evaluation and a bug verdict.

### 1. Model

`gpt-5-mini` with `$AZURE_GPT_KEY`, unless the user names other models — the `models` of
`docs/test-prompts.json`, or another provider name (see
[ai-chat.md](../../minimal-hi-example/docs/ai-chat.md)) with its key variable: `mistral*` →
`MISTRAL_API_KEY`, `gpt-5*` / `gpt-6*` → `AZURE_GPT_KEY`. When the key variable is empty, stop and
ask the user for the key. Never write a key into a file. "with the local planner" / "with --dev"
adds `--dev` to the runner (the roomle-ui dev server must run on :5173).

### 2. Session directory

```bash
SESSION=".temp/result/mcp-test-$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$SESSION"
```

### 3. Tests

Write the temporary test file `$SESSION/tests.json`: `docs/test-prompts.json` with only the chosen
models — by default every test and the `gpt-5-mini` model:

```bash
jq '.models = [{ "provider": "gpt-5-mini", "apiKeyEnv": "AZURE_GPT_KEY" }]' docs/test-prompts.json > "$SESSION/tests.json"
```

- A subset of the tests the user names: filter `.tests` by `id` the same way.
- Tests with an `image` stay only for models that read images — every `claude*` and `gemini*` model
  and the model ids in `IMAGE_INPUT_MODELS` of [chat-config.ts](../../hi-mcp/hi-mcp-chat/chat-config.ts)
  (`gpt-5-mini`, `gpt-5.4-mini` and `gpt-6-astra` do). For any other model, leave them out of the
  file and list them in the report as skipped.

### 4. Run

One command runs every test for every model of the file, one after another:

```bash
node .agents/scripts/run-hi-mcp-tests.js "$SESSION/tests.json" --out "$SESSION" > "$SESSION/runner.log" 2>&1
```

- Start it as **one background command** with a timeout of about 2 minutes per test and model (at
  most 2 hours).
- Evaluate each test while the runner goes on. `runner.log` gets one line per finished run, and
  `$SESSION/results.json` lists them: per run `model`, `test`, `dir`, `exitCode`, `planSnapshotId`,
  `errors`.
- If the time limit stops it, start the same command again: it skips every test whose directory
  holds `run.json`.
- Exit code 1 of a run is a result like any other (an operation, the model or the chat reported an
  error).
- The runner repeats a run without `run.json` (the launcher or the page did not come up) once. A run
  that still has none is in `results.json` with "no run.json"; the report lists it as not run, with
  the last lines of its `console.log`.

A run's directory is `$SESSION/<model>/<NN>-<test id>/`: `<model>` is the provider name, `<NN>` the
test's position in the file.

### 5. Evaluate

Per run (`R` = `$SESSION/<model>/<NN>-<test id>`), read the test in `tests.json` (`plan`,
`operations`, `prompt`, `image`, `expect`) and:

| File | Look at |
|---|---|
| `top-image.png`, `perspective-image.png` | where the group stands, what it consists of |
| `prompt-image.jpg` | image prompts: the image the model got — the layout, units, appliances, fronts and worktop to compare the plan with |
| `run.json` | `plan` and `operations` (the tool calls before the prompt, with their `result` or `error`); per turn the answer, the tools and `toolCalls` — per call of a plan-changing tool the `args` the model sent and the `corrections`, `notLoaded` or `error` it got back; `errors`; `planSnapshotId` |
| `order-data.json` | the articles and attributes (materials, colours, dimensions) |
| `plan-context.json` | the room's walls (`rooms.rooms[].…walls[]`: `side`, `start`/`end`, `facingRotationY`) and the groups after the chat (`groups[].position`: `pos`, `rotationY`, `footprint`; `groups[].roots[].desc`) |
| `planner-calls.json` | what the MCP server sent to the planner during the chat (the operations' calls are not in it): `loadExternalObjectGroupLayout` — `args[0].posGroups[]` with the roots, their docking (`contextData.dockedRoots`) and attributes, and `repositioningData` (the placement); `externalObjectGroupOperation` — `args` = the command and its payload; `ok: false` with the page's `error` |
| `console.log` | `[hi-mcp]` and `[hi-chat]` errors |

The evidence at a glance:

```bash
jq '{planSnapshotId, errors, turns: [.turns[] | {prompt, answer: (.answer | .[0:500]), tools, toolCalls}]}' "$R/run.json"
jq -c '.groups[]? | {group: .id[0:8], pos: .position.pos, rotationY: .position.rotationY, sizeMm: [.position.footprint.widthMm, .position.footprint.depthMm], roots: [.roots[]? | .desc]}' "$R/plan-context.json"
jq -c '.[] | select(.method != "getExternalObjectPlanContext") | {method, ok, error, placement: [.args[0] | objects | .posGroups[]?.repositioningData | select(.)], firstArg: ([.args[0] | strings][0]), command: (if .method == "externalObjectGroupOperation" then .args else null end)}' "$R/planner-calls.json"
jq -c '[.[] | select(.method == "loadExternalObjectGroupLayout")][-1].args[0].posGroups[].roots[] | {id, articleId, attributes: [.attributes[]? | "\(.id)=\(.value)"], docks: [.contextData.dockedRoots[]? | "\(.ownDockingVector)->" + ([.dockedRoots[].id] | join(","))]}' "$R/planner-calls.json"
```

Check:

- the request is fulfilled — the units, appliances, count and materials asked for (materials are
  root `attributes` in the layout; none there means none applied); for an edit, the edit is
  applied to the test's plan (see [test-prompts.md](../../docs/test-prompts.md#plans)) and nothing
  else changed; for an image prompt, the plan follows the image — its layout
  (one wall, around a corner), the kinds of units and appliances it shows and the colours of fronts
  and worktop, as far as the catalog has them; without a wall in the prompt, any wall that fits;
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
| a material, colour or attribute the prompt asks for is missing in the plan or reaches only part of it (one walnut front of a walnut kitchen, a worktop colour set on a base unit) although the model sent it, and no correction says so | **bug** — MCP server: the instructions or the tool API let the model's input fall short |
| a unit stands at a height it cannot have in a kitchen — a wall cabinet on the worktop or on the floor instead of hanging on the wall — and no correction says so | **bug** — MCP server: the instructions or the tool API leave the height to the model |
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

The server sends `posGroup` and `posRotationY` as the model gave them; for an anchor whose docking
corner is not its origin (a corner article, a range hood) it adds the offset as `rootRelPos` and
`rootRelRotationY`. `plan-context.json` reports a group's `position.pos` and `rotationY` in the same
frame — the back left bottom corner and the rotation of the placement — so compare them with the
placement directly. State the evidence (file and value) behind every bug verdict.

### 6. Report

Write `$SESSION/report.md`. With more than one model: one header row and one summary table per
model, and the run sections grouped by model (`## <model> — 01 <title>`); the image paths start with
the model's directory.

````markdown
# HI MCP test — <YYYY-MM-DD HH:MM>

| Model | Planner | Tests | Pass | Partial | Fail | Bugs |
|---|---|---|---|---|---|---|
| gpt-5-mini | bo-test | 17 run, 0 skipped | … | … | … | … |

## Summary

| # | Test | Verdict | Bug | Plan snapshot |
|---|---|---|---|---|
| 01 | [<title>](#01-<title-slug>) | pass | no | `ps_…` |

## Bugs

- **<component>** — <one sentence> ([01](#01-<title-slug>))

## Hardening candidates

- <what the server accepted or had to correct> — <the instruction or tool API part that led the model there> — <n> runs ([02](#02-<title-slug>), …)

## Corrections

- <what the server corrected, from `toolCalls`> — <n> runs ([02](#02-<title-slug>), …)

## Environment

- <what kept runs from testing the system, e.g. a planner method missing in the planner build> — <runs>

## 01 <title>

> <prompt>

Plan: <plan name>; operations: <none, or the tool calls before the prompt>

- **Plan snapshot**: `ps_…`
- **Tools**: <per turn, in order>
- **Corrections**: <per tool, the corrections, groups not loaded and errors of `toolCalls`, or none>
- **Answer**: <the model's final answer, shortened>

| Perspective | Top |
|---|---|
| <img src="gpt-5-mini/01-<test id>/perspective-image.png" width="420"> | <img src="gpt-5-mini/01-<test id>/top-image.png" width="420"> |

**Evaluation — <verdict>**: <what is in the plan against what was asked, with the evidence>

**Bug — <yes: component / no: model finding / no: environment>**: <why>

## 09 <title of an image test>

> <prompt, or "(empty)">

- **Image**: `docs/images/<file>`
- …

| Image | Perspective | Top |
|---|---|---|
| <img src="gpt-5-mini/09-<test id>/prompt-image.jpg" width="280"> | <img src="gpt-5-mini/09-<test id>/perspective-image.png" width="280"> | <img src="gpt-5-mini/09-<test id>/top-image.png" width="280"> |

…

## Skipped

- <title> — the model reads no images
````

### 7. Open issues

Update [mcp-test-open-issues.md](../backlog/mcp-test-open-issues.md) — what is to be done after
the test analyses, nothing that was done:

- add every bug and hardening candidate of the report that is not listed yet, with the problem, the
  run that shows it, the cause in the code, the to-do and its test;
- give a listed issue the latest run that shows it;
- remove an issue only when its fix is in the code — a run that happens not to show it is no fix;
- keep the backlog index ([README](../backlog/README.md)) in step.

Then tell the user the report's path, the verdicts and the bugs.

## Run the tests (the runner)

```bash
node .agents/scripts/run-hi-mcp-tests.js [<tests.json>] [--out <dir>] [--dev]
```

| Argument | Meaning |
|---|---|
| `<tests.json>` | the test file, default [docs/test-prompts.json](../../docs/test-prompts.json) — `models` (`{ provider, apiKeyEnv }`), `plans` (name → plan snapshot id), `tests` (`{ id, title, plan, prompt?, image?, operations?, expect? }`); the format is in [test-prompts.md](../../docs/test-prompts.md#test-cases) |
| `--out <dir>` | the session directory, default `.temp/result/mcp-test-<local time>/`; an existing one is continued |
| `--dev` | passed to every run |

The runner:

1. checks the file before the first run — the key variable of every model is set, every test has a
   unique kebab-case `id`, a `plan` of `plans`, a prompt or an image, an existing image file and
   well-formed `operations` — and names every problem;
2. runs, for every model and then every test, `run-hi-mcp-prompt.js <provider> "$<apiKeyEnv>"
   "<prompt>" --plan <id> [--operations <json>] [--image <file>] --out <out>/<provider>/<NN>-<id>`,
   with its output in that directory's `console.log`. It runs one at a time (the ports are fixed),
   each with a fresh launcher and browser;
3. skips a test whose directory holds `run.json`, and repeats a run that ends without one once;
4. rewrites `<out>/results.json` after each run and prints one line per run;
5. passes Ctrl+C (SIGINT/SIGTERM) on to the running run, which stops its servers, and ends.

Every model and test of `docs/test-prompts.json` take about an hour.

## Run a prompt (the script)

```bash
node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" ...] [--plan <plan snapshot id>] [--operations <json>] [--image <file>] [--out <dir>] [--dev] [--headed]
```

| Argument | Meaning |
|---|---|
| `<provider>` | a chat provider of the launcher, passed through unchanged (`gpt-5.4-mini`, `mistral`, `claude`, … — see [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md)) |
| `<api-key>` | the provider's API key, e.g. `"$AZURE_GPT_KEY"` |
| `"<prompt>" …` | the user messages: consecutive turns of one conversation (the history goes along, as in the chat window); a turn with an error ends it. `""` with `--image` sends the image alone — the chat backend gives it the text "Plan a kitchen like the one in the image." |
| `--plan <id>` | the plan snapshot the page starts from (`plan_id` of the example URL), its HI groups included; without it, the page's default plan |
| `--operations <json>` | MCP tool calls `[{ "tool": "…", "arguments": { … } }]` made one after another once the page is ready, before the first prompt. A call answered "… not found" is repeated for up to 30 s: the groups of a loaded plan reach the HI library a moment after the page is ready, and until the library has calculated them the planner finds none of their modules. The first call that fails ends them, and the run sends no prompt |
| `--image <file>` | an image (PNG, JPEG, WebP, GIF) that goes along with the last prompt, as an image dropped into the chat window: redrawn as JPEG with a long side of at most 1568 px. A model that reads no images answers `HTTP 400: The model … does not read images` |
| `--out <dir>` | the result directory (default `.temp/result/<UTC timestamp>-<provider>/`) |
| `--dev` | the planner from the local Rubens UI dev server (`npm run dev` in roomle-ui, :5173) |
| `--headed` | shows the browser window |

The script:

1. starts the launcher (`minimal-hi-example/start.mjs <provider> <api-key> --no-open`) with the MCP
   server on port **3110**, not 3100 — example tabs of an interactive session reconnect to 3100 and
   would take the bridge away from the run's page;
2. opens the example URL the launcher prints, with `plan_id` of `--plan`, in Playwright Chromium, a
   fresh browser each run, so every run starts from its plan (no IndexedDB state);
3. waits until the MCP tool `get-plan-context` lists articles (server up, page connected, HI library
   loaded), then calls the tools of `--operations`;
4. sends the prompts to the chat backend (`POST /chat`, the chat window's system prompt and tools),
   each until the end of its stream, and records every planner call the MCP server sends to the
   page (from the bridge's WebSocket frames — the server's log cuts the arguments short);
5. reads the rooms and groups (`get-plan-context`), then `getExternalObjectSnapshot()` with every
   field it stores and without the object GLB (the GLB is not generated), then saves
   the plan with `saveExternalObjectSnapshot()` for its plan snapshot id — **every run saves one
   plan snapshot in the Roomle backend**, as the example's "Save snapshot" button does;
6. stops the browser and every server process, also after an error or Ctrl+C.

### The result

| File | Content |
|---|---|
| `run.json` | provider; `plan`; `operations` (per tool call the `arguments` and the `result` or `error`); `turns` (per turn the prompt, the `image` file it carried, the model's answer, the tools in order, `toolCalls` — per call of a plan-changing tool the `args` the model sent and its `corrections`, `notLoaded` or `error` — errors, duration); all `errors`; `planSnapshotId`; example URL, start time, durations (ready, chat, snapshot) |
| `plan-context.json` | `get-plan-context` with rooms and groups after the chat — the walls and where the groups stand |
| `planner-calls.json` | every planner call during the chat — not those of the operations: method, full arguments, `ok`, and the page's `error` |
| `prompt-image.jpg` | with `--image` only: the image as the model got it |
| `order-data.json` | `orderData` of the snapshot — the groups with their articles and attributes |
| `top-image.png`, `perspective-image.png` | the whole plan rendered |
| `top-object-image.png`, `perspective-object-image.png` | the HI objects only (missing when the plan has no groups) |
| `plan.xml` | the plan XML |

Exit code 0 when no operation, the chat and the snapshot reported an error; 1 when one did, or when no
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
- ports 3000, 3110 and 3200 free — stop an interactive `npm start` first; one run (and one runner)
  at a time
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
| `operation <tool> failed: …` in `errors` | an operation of the test did not apply to its plan — e.g. a root id that is not in the plan (still "not found" after 30 s); check the test against [test-prompts.md](../../docs/test-prompts.md#plans) |
| the runner names problems of the test file and runs nothing | an empty key variable, an unknown plan name, a missing image, a duplicate id — fix the file or the environment |

## See also

- [hi-mcp-tools.md](./hi-mcp-tools.md) — the tools the model calls
- [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md) — the chat backend and its providers
- Feature analyses: [the script](../feature-analysis/hi-mcp-prompt-run-script.md),
  ["test the mcp"](../feature-analysis/hi-mcp-test-the-mcp-skill.md),
  [image prompts](../feature-analysis/hi-mcp-test-image-prompts.md),
  [the runner](../feature-analysis/hi-mcp-test-suite-script.md)
