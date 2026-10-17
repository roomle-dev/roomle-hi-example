# HI MCP Testing Skill

**Load this skill when:** the user asks to **"test the mcp"** — run [Test the MCP](#test-the-mcp) —
or the task involves testing the HI MCP server end to end with a real model and a real planner:
running a prompt through the chat, checking the plan a prompt produces, comparing prompts or models.

## Test the MCP

Runs the tests of [test-prompts.json](../../docs/test-prompts.json) with the runner
`run-hi-mcp-tests.js` — each from its plan, with its prompt (or its turns) and image — stores every
result under one session directory and ends with `report.md` and its PDF in `.temp/reports/`, named after the
date and the models of the session ([the PDF](#the-pdf)): per test the plan snapshot id, the
perspective, the perspective object and the top image, an evaluation and a bug verdict.

The tests assess how well the agent understands the prompts and picks the right tools — not the tools
themselves, which the unit tests in `hi-mcp/hi-mcp-server/tests` cover
([ADR 0006](../decisions/0006-prompt-tests-assess-the-agent.md)). A test holds only prompts and
images; a test that needs a changed plan asks for the change in an earlier turn.

### 1. Model

`gpt-5-mini` with `$AZURE_GPT_KEY`, unless the user names other models — the `models` of
`docs/test-prompts.json`, or another provider name (see
[ai-chat.md](../../docs/ai-chat.md)) with its key variable: `mistral*` →
`MI_API_USAGE_KEY`, `gpt-5*` / `gpt-6*` → `AZURE_GPT_KEY`. When the key variable is empty, stop and
ask the user for the key. Never write a key into a file. "with the local planner" / "with --dev"
adds `--dev` to the runner (the roomle-ui dev server must run on :5173).

### 2. Session directory

```bash
SESSION=".temp/result/mcp-test-$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$SESSION"
```

### 3. Tests

When continuing an existing session, reuse its prepared `tests.json` and go straight to
[Run](#4-run). Do not copy the source file again or generate another set of cases.

Write the temporary test file `$SESSION/tests.json`: `docs/test-prompts.json` with only the chosen
models — by default every test and the `gpt-5-mini` model:

```bash
jq '.models = [{ "provider": "gpt-5-mini", "apiKey": "$AZURE_GPT_KEY" }]' docs/test-prompts.json > "$SESSION/tests.json"
```

- A subset of the tests the user names: filter `.tests` by `id` the same way.
- A run limited to named tests keeps that scope: generate no extra cases unless the user asks
  for them. Set the session's `randomTests` to 0 in that case.
- Tests with an `image` stay only for models that read images. The chat backend decides that for
  the model the provider name resolves to: `readsImages(resolveChatModel(<provider>))` in
  [chat-config.ts](../../hi-mcp/hi-mcp-chat/chat-config.ts).
  - Every alias of the launcher reads images: `claude`, `anthropic`, `gemini`, `gemini-pro`,
    `gemini-flash`, `google`, `mistral`, `mistral-large`, `mistral-medium`, `mistral-large-3`,
    `mistral-large-4`, `azure`, `openai`, and
    the deployments `gpt-5-mini`, `gpt-5.4-mini`, `gpt-6-astra`; so does every full `claude-*` and
    `gemini-*` id.
  - A full `mistral-*` id, or an Azure deployment named by `HI_CHAT_MODEL`, reads images only if it
    is in `IMAGE_INPUT_MODELS`.
  - The launcher prints `Images: yes` or `no` at its start.
  - For a model without images, leave the image tests out of the file and list them in the report
    as skipped.

#### Random tests

A full session adds `randomTests` new tests (in `$SESSION/tests.json`, copied from
`docs/test-prompts.json`; 5 when it is missing, 0 for none), written by the agent that runs this
skill. The count must be a whole number from 0 to the number of available plans because each plan
is drawn once. For a custom suite with fewer than five plans, set a count within that range.
A number the user names goes into the session file:
`jq '.randomTests = <n>' "$SESSION/tests.json" > "$SESSION/tests.tmp" && mv "$SESSION/tests.tmp" "$SESSION/tests.json"`.
The random tests go only into `$SESSION/tests.json`, always at its end — never into
`docs/test-prompts.json`.

The random tests are the session's own coverage: they stand in for the standard cases a fixed
suite cannot hold, so together they exercise the whole range the fixed tests leave open — from a
single simple request to a complex, multi-turn one. Draw the plans at random **without
repetition**, then write one test per drawn plan, each covering a different area, so that across
the session every area below is covered at least once:

| Coverage key | What the case checks |
|---|---|
| `create` | Create a group with a specific unit count and composition. |
| `place` | Put or move a group at a named wall, corner or free spot that fits the plan. |
| `attributes` | Apply a supported material, colour or dimension to the intended units. |
| `edit` | Insert, exchange, delete or reorder units in an existing group. |
| `history` | Change a group, undo that change and redo it over consecutive turns. |
| `conversation` | Create a group and refine it over two or three turns, retaining earlier requirements. |

At least one random test is a complex case: a conversation of two or three turns, or a request
that combines several areas (a group created and then edited, a placement with attributes, an
edit that needs the plan understood). The rest may be simple single-request cases. Vary the
furniture (kitchen, wardrobe, sideboard, media unit, utility room, tall units), the place (a wall,
a corner, a free spot), materials and dimensions of the
[catalog](../../docs/library-information/articles.md), edits of a group the plan has, undo and
redo, and conversations. An edit needs an HI group in the plan (see the plan in
[test-prompts.md](../../docs/test-prompts.md#plans)). Plain English user words: no tool name, no
id, no image ([ADR 0006](../decisions/0006-prompt-tests-assess-the-agent.md)). Write `expect`
before the run, from the plan and the catalog, with checks for every conversation turn.

1. Draw a plan for each at random from the session file, without repetition, so that sessions do
   not repeat themselves and no two random tests share a plan:

   ```bash
   node -e 'const { plans, randomTests = 5 } = require(require("path").resolve(process.argv[1])); const names = Object.keys(plans); if (!Number.isInteger(randomTests) || randomTests < 0 || randomTests > names.length) throw new Error("randomTests must be a whole number from 0 to the number of plans"); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; } for (const name of names.slice(0, randomTests)) console.log(name)' "$SESSION/tests.json"
   ```

2. Write them to `$SESSION/random-tests.json` as a list, in the form of the fixed tests with the mark
   `"random": true`, the id `random-<n>-<slug>` and the title `Random: <title>`:

   ```json
   [{ "id": "random-1-walnut-sideboard-left-wall", "title": "Random: walnut sideboard, left wall",
      "plan": "living-room", "random": true,
      "prompt": "add a sideboard of three walnut cabinets to the left wall",
      "expect": "one group of three base cabinets against the left wall, walnut fronts" }]
   ```

   When `randomTests` is 0, write `[]` to `$SESSION/random-tests.json`.

#### Compose and check the session

Append the random cases once, keeping fixed cases first and random cases last. This command checks
counts, expectations, plan references, markings and unique ids. If it fails, correct the generated
list and rerun it; the original `tests.json` stays intact.

```bash
jq --slurpfile random "$SESSION/random-tests.json" '
  . as $suite
  | $random[0] as $generated
  | if any(.tests[]; .random == true)
    then error("Session already prepared") else . end
  | if (.randomTests // 5) > (.plans | length)
    then error("randomTests cannot exceed the number of plans") else . end
  | if ($random[0] | length) != (.randomTests // 5)
    then error("Unexpected generated test counts") else . end
  | if any($generated[]; (.expect | type) != "string" or (.expect | length) == 0
       or $suite.plans[.plan] == null)
    then error("Generated tests need expectations and valid plans") else . end
  | if any($random[0][]; (.id | startswith("random-") | not)
       or (.title | startswith("Random: ") | not) or .random != true)
    then error("Generated test markings are invalid") else . end
  | .tests += $generated
  | if ([.tests[].id] | unique | length) != (.tests | length)
    then error("Duplicate test ids") else . end
' "$SESSION/tests.json" > "$SESSION/tests.tmp" && mv "$SESSION/tests.tmp" "$SESSION/tests.json"
```

The runner validates prompt and image fields before starting. It executes the prepared file;
it does not generate cases when called directly on `docs/test-prompts.json`.

### 4. Run

One command runs every test for every model of the file, one after another:

```bash
node .agents/scripts/run-hi-mcp-tests.js "$SESSION/tests.json" --out "$SESSION" > "$SESSION/runner.log" 2>&1
```

- Start it as **one background command** with a timeout of about 2 minutes per test and model (at
  most 2 hours).
- Evaluate each test while the runner goes on. `runner.log` gets one line per finished run, and
  `$SESSION/results.json` lists them: per run `model`, `test`, `dir`, `attempts`, `exitCode`,
  `planSnapshotId`, `errors`.
- If the time limit stops it, start the same command again. Stored results are skipped unless a
  first attempt has an interrupted capture, a transport failure or no `run.json` and still has
  retries available.
- Exit code 1 of a run is a result like any other (the model or the chat reported an error).
- Every run starts its own launcher and Chromium. The launcher typechecks the `hi-mcp` workspace
  until a run of the session has stored its `run.json`; the later runs skip it (`--no-typecheck`,
  ~2 s each). Of the ~11 s before the chat (`durationsMs.ready`), the launcher boot takes ~0.35 s
  and the Chromium launch ~0.1 s; the rest is the page, the HI library and the plan load, so the
  runs reuse neither the launcher nor the browser.
- The runner repeats a run without `run.json`, a capture interrupted by navigation, or a provider
  or transport failure, up to three attempts. A navigation interruption is no saved snapshot id
  with a destroyed-context/navigation error, or `snapshotCaptured: false` with frame navigation
  during `chat` or `snapshot`; initial loading, fragment-only URL changes and a missing saved
  snapshot id alone do not trigger that retry. A transport failure is an error, or the cause chain
  of a failed provider step of a turn (`stepFailures`), matching
  `Failed to process successful response`, `ECONNRESET`, `socket hang up`, `fetch failed`,
  `terminated` or `AI_APICallError` — the model call or the connection dropped mid-stream, so the
  run says nothing about the planning. A run that completed without errors is never retried, and a
  real planning defect is not retried either.
- Every superseded attempt is preserved in `<NN>-<test id>.attempt-<n>/`; the retry uses the
  original plan and prompts in a fresh browser and writes to the normal directory. `results.json`
  lists all attempt directories in `attempts` and selects the current result in `dir`. Evaluate
  that selected result; read the earlier attempts for diagnostics. Every directory retains its own
  logs and artifacts.
- The archive keeps the retry limit across resume, including a stop between archiving and retry.
  After three attempts the runner retains the third result, including a failure. A result with no
  `run.json` is listed as "no run.json"; the report lists it as not run with its console log.

A run's directory is `$SESSION/<model>/<NN>-<test id>/`: `<model>` is the provider name, `<NN>` the
test's position in the file.

### 5. Evaluate

Per run (`R` = `$SESSION/<model>/<NN>-<test id>`), read the test in `tests.json` (`plan`,
`prompt`, `image`, `expect`) and:

| File | Look at |
|---|---|
| `top-image.png`, `perspective-image.png` | where the group stands, what it consists of |
| `perspective-object-image.png` | the group alone — its fronts, appliances and materials, without the room |
| `prompt-image.jpg` | image prompts: the image the model got — the layout, units, appliances, fronts and worktop to compare the plan with |
| `run.json` | `plan`; per turn the answer, the tools and `toolCalls` — per call of a plan-changing tool the `args` the model sent and the `corrections`, `notLoaded` or `error` it got back — and `stepFailures` — per failed provider step the `step`, `durationMs` and the cause chain `causes`; `errors`; `planSnapshotId`; `snapshotCaptured`; `navigations` (timestamp, phase, main frame, URL, `fragmentOnly`) |
| `order-data.json` | the articles and attributes (materials, colours, dimensions) |
| `plan-context.json` | the room's walls (`rooms.rooms[].…walls[]`: `side`, `start`/`end`, `facingRotationY`) the groups after the chat (`groups[].position`: `pos`, `rotationY`, `footprint`; `groups[].roots[].desc`) and what stands in the room (`obstacles.objects[]`: `kind`, `outline`, `bottomMm`/`topMm`, a door or window with `wall` and `fromEndMm`; `obstacles.groups[].roots[]`: the room-space outline and height range of every root module) |
| `planner-calls.json` | what the MCP server sent to the planner during the chat: `externalObjectGroupOperation` — `args` = the tool and the arguments the model sent (for `create-or-replace-groups` `args[1].posGroups[]` with the roots, their relations and attributes, and the `placement`), the result's `corrections`, `notLoaded`, `historySteps`; `ok: false` with the page's `error`. The docking the relations became is in `plan-context.json` (`groups[].roots[].contextData`) |
| `console.log` | `[hi-mcp]` and `[hi-chat]` errors; `[run-hi-mcp-prompt] navigation` events |

The evidence at a glance:

```bash
jq '{planSnapshotId, errors, turns: [.turns[] | {prompt, answer: (.answer | .[0:500]), tools, toolCalls}]}' "$R/run.json"
jq -c '.groups[]? | {group: .id[0:8], pos: .position.pos, rotationY: .position.rotationY, sizeMm: [.position.footprint.widthMm, .position.footprint.depthMm], roots: [.roots[]? | .desc]}' "$R/plan-context.json"
jq -c '.[] | select(.method == "externalObjectGroupOperation") | {tool: .args[0], ok, error, placement: [.args[1] | objects | .posGroups[]?.placement | select(.)], args: (if .args[0] == "create-or-replace-groups" then null else .args[1] end)}' "$R/planner-calls.json"
jq -c '[.[] | select(.method == "externalObjectGroupOperation" and .args[0] == "create-or-replace-groups")][-1].args[1].posGroups[].roots[] | {id, articleId, attributes: [.attributes[]? | "\(.id)=\(.value)"], relation: ([to_entries[] | select(.key | IN("rightOf", "leftOf", "onTop", "above", "behind")) | "\(.key) \(.value)"] | join(","))}' "$R/planner-calls.json"
jq -c '.groups[]? | {group: .id[0:8], doors: [.roots[]? | select(.isGenerated != true) | {row: .rowIndex, articleId, desc: (.desc // "" | .[0:60]), door: ([.attributes[]? | select(.id == "mod_DoorDirectionSelection") | .value][0] // "Automatic")}] | sort_by(.row)}' "$R/plan-context.json"
```

Check:

- every turn does what it asks — a test with a `prompt` list is a conversation, and `expect` says
  per turn what to check; a later turn builds on what the earlier ones made;
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
- the doors open to the outside of every row ([D84](../../docs/hi-mcp-behaviour.md#doors-2026-10-17))
  — the door at the left end of a row (`rowIndex` 1) hinged on the left, the door at the right end
  on the right, a pair of doors side by side at its two outer sides; floor units and wall units form
  rows of their own. Read the hinge side from the roots' input attributes in `plan-context.json`
  (the last `jq` command; Furniture_Smith: `mod_DoorDirectionSelection`, and a root without it has
  the library's `Automatic` — a single door hinged on the left, a pair `LeftRight`), and check the
  handles in `perspective-object-image.png`. A handle on the outside of a row is a model finding,
  unless the model sent the right side and the plan lacks it (then a bug, as below); it recurring
  across runs is a hardening candidate for the rule sentence of D84;
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
| partial | the plan is usable but misses part of the request (an appliance, a material, a unit count), or a handle is on the outside of a row |
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
| provider errors: authorization, quota, rate limit, a connection reset while the answer streams | **environment**, no bug |

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
the model's directory, and every link to a run section names the model: `#<model>--01-<title-slug>`,
the anchor GitHub and `render-report-pdf.js` make of that heading (a dot of the model is dropped:
`gpt-5.4-mini` → `#gpt-54-mini--01-…`).

A session has **exactly one report**, `report.md`, and one PDF of it ([below](#the-pdf)). Never write a report per model or a partial
report file beside it — not even when the evaluation is split, e.g. one subagent per model: their
sections go straight into `report.md`.

The session folder is shared as it is, e.g. zipped: `report.md` links only files inside it.

The header row counts fixed and random tests separately. Preserve the `Random:` titles in the
summary and run headings. Each random run names its origin; the "Random tests" section lists the
random cases with their JSON. A random case worth keeping can be copied from there into
`docs/test-prompts.json` with a fixed id/title and without the random flag.

- Copy the source image of every image test into `$SESSION/images/`:

  ```bash
  mkdir -p "$SESSION/images"
  jq -r '[.tests[].image | select(.)] | unique[]' "$SESSION/tests.json" | xargs -I{} cp {} "$SESSION/images/"
  ```

- Link a source image as `[images/<file>](images/<file>)`, never as `docs/images/<file>`.
- The run images stay in the run directories (`<model>/<NN>-<test id>/…`), the image the model got
  included (`prompt-image.jpg`).

````markdown
# HI MCP test — <YYYY-MM-DD HH:MM>

| Model | Planner | Tests | Pass | Partial | Fail | Bugs |
|---|---|---|---|---|---|---|
| gpt-5-mini | bo-test | 40 run (35 fixed, 5 random), 0 skipped | … | … | … | … |

## Summary

| # | Test | Verdict | Bug | Plan snapshot |
|---|---|---|---|---|
| 01 | [<title>](#01-<title-slug>) | pass | no | `ps_…` |
| 36 | [Random: <title>](#36-random-<title-slug>) | fail | no | `ps_…` |

## Random tests

Generated for this session by the agent that ran it; not in `docs/test-prompts.json`.

| # | Test | Plan | Verdict | Keep as a fixed test |
|---|---|---|---|---|
| 36 | [Random: <title>](#36-random-<title-slug>) | <plan name> | fail | yes — <what it covers that no fixed test does> |

```json
<the random tests as they are in tests.json>
```

## Bugs

- **<component>** — <one sentence> ([01](#01-<title-slug>))

## Hardening candidates

- <what the server accepted or had to correct> — <the instruction or tool API part that led the model there> — <n> runs ([02](#02-<title-slug>), …)

## Corrections

- <what the server corrected, from `toolCalls`> — <n> runs ([02](#02-<title-slug>), …)

## Environment

- <what kept runs from testing the system, e.g. a planner method missing in the planner build> — <runs>

## 01 <title>

> <prompt — one quote line per turn of a conversation>

Plan: <plan name>

- **Plan snapshot**: `ps_…`
- **Tools**: <per turn, in order>
- **Corrections**: <per tool, the corrections, groups not loaded and errors of `toolCalls`, or none>
- **Doors**: <per row with doors, the hinge side of the door at its left and at its right end, and whether a handle is on the outside of the row; or no doors>
- **Answer**: <the model's final answer, shortened>

| Perspective | Perspective object | Top |
|---|---|---|
| <img src="gpt-5-mini/01-<test id>/perspective-image.png" width="280"> | <img src="gpt-5-mini/01-<test id>/perspective-object-image.png" width="280"> | <img src="gpt-5-mini/01-<test id>/top-image.png" width="280"> |

**Evaluation — <verdict>**: <what is in the plan against what was asked, with the evidence>

**Bug — <yes: component / no: model finding / no: environment>**: <why>

## 28 <title of an image test>

> <prompt, or "(empty)">

- **Image**: [images/<file>](images/<file>)
- …

| Image | Perspective | Perspective object | Top |
|---|---|---|---|
| <img src="gpt-5-mini/28-<test id>/prompt-image.jpg" width="210"> | <img src="gpt-5-mini/28-<test id>/perspective-image.png" width="210"> | <img src="gpt-5-mini/28-<test id>/perspective-object-image.png" width="210"> | <img src="gpt-5-mini/28-<test id>/top-image.png" width="210"> |

…

## 36 Random: <title>

> <prompt — one quote line per turn of a conversation>

Plan: <plan name>

- **Random test**: generated for this session, not in `docs/test-prompts.json`
- …

## Skipped

- <title> — the model reads no images
````

#### The PDF

The result of the session is the report and its PDF. Render the PDF once `report.md` is complete, and
again whenever it changes, straight into `.temp/reports/` under the name of the session's date and
models:

```bash
mkdir -p .temp/reports
node .agents/scripts/render-report-pdf.js "$SESSION/report.md" --out ".temp/reports/mcp-test-<date>_<models>.pdf"
```

- `<date>` is the date of the session directory: `2026-10-16` of `mcp-test-2026-10-16_11-57-20`.
- `<models>` are the model directories of the session in the order of the summary table, joined by
  `_`: `mcp-test-2026-10-08_gpt-5-mini_gpt-5.4-mini_gpt-6-astra.pdf`.
- A second session of the same date and models adds the time of its directory after the date:
  `mcp-test-2026-10-16_11-57-20_gpt-6-astra.pdf`.

The session directory keeps no PDF. The PDF is A4, every run section on a new page, the links of the summary
jumping to the run sections, the images embedded at most 640 px wide (about 3 MB for 32 runs, against
100 MB of renders) — the PDF can be shared on its own.

### 7. Open issues

Update [mcp-issues.md](../backlog/mcp-issues.md). The backlog is a to-do list,
not an archive: it holds only what is still to be done — no history of runs, findings or fixes.

- add every bug and hardening candidate of the report that is not listed yet: the problem in the
  present tense, the cause in the code, the to-do, its test, and a **Reproduce** line naming the run
  whose payload reproduces it; a to-do never puts library information into the server — what the
  agent lacks about a library goes into the descs of the library data
  ([library-neutral](../../docs/hi-mcp-behaviour.md#24-instructions));
- describe a library issue only in [library-issues.md](../backlog/library-issues.md), including its
  overview, with the library and whether it is reported to the library development team; the exact
  `desc` text proposed to the library goes into
  [suggested-library-changes.md](../../docs/library-information/suggested-library-changes.md), which
  keeps every suggested change with its status — applied in the library or not — and the issue's
  to-do names its change there;
- name in every overview row the module, team or repository responsible for the fix (**Responsible**);
- for a listed issue that showed again, replace its **Reproduce** line with the latest run — one line,
  never a list of runs;
- remove an issue, and its index row, when its fix is in the code — a run that happens not to show it
  is no fix;
- keep the backlog index ([README](../backlog/README.md)) in step.

Then tell the user the paths of `report.md` and of the PDF in `.temp/reports/`, the verdicts and the bugs.

## Run the tests (the runner)

```bash
node .agents/scripts/run-hi-mcp-tests.js [<tests.json>] [--out <dir>] [--dev]
```

| Argument | Meaning |
|---|---|
| `<tests.json>` | the test file, default [docs/test-prompts.json](../../docs/test-prompts.json) — `models` (`{ provider, apiKey }`, `"$NAME"` for the key in the environment variable `NAME`), `plans` (name → plan snapshot id), `tests` (`{ id, title, plan, prompt?, image?, expect?, random? }`, `prompt` a text or a list of turns), `randomTests` (how many random tests [step 3](#random-tests) adds); the format is in [test-prompts.md](../../docs/test-prompts.md#test-cases) |
| `--out <dir>` | the session directory, default `.temp/result/mcp-test-<local time>/`; an existing one is continued |
| `--dev` | passed to every run |

The runner:

1. checks the file before the first run — every model has a key (a `"$NAME"` variable is set), every test has a
   unique kebab-case `id`, a `plan` of `plans`, a prompt (a text or a list of texts) or an image and an existing
   image file; an explicit `randomTests` is a whole number from 0 to the number of plans — and
   names every problem;
2. runs, for every model and then every test, `run-hi-mcp-prompt.js <provider> "<apiKey>"
   "<prompt>" ["<prompt>" …] --plan <id> [--image <file>] --out <out>/<provider>/<NN>-<id>`
   (one `"<prompt>"` per turn of a `prompt` list),
   with its output in that directory's `console.log`. It runs one at a time (the ports are fixed),
   each with a fresh launcher and browser;
3. repeats a run without `run.json`, with a navigation-interrupted capture or with a provider or
   transport failure, up to three attempts, preserving every superseded attempt beside the
   selected result; resumes with the same `--out` and never exceeds three attempts; other stored
   results are skipped;
4. rewrites `<out>/results.json` after each run and prints one line per run;
5. passes Ctrl+C (SIGINT/SIGTERM) on to the running run, which stops its servers, and ends.

A run takes about 40 s for the launcher, the page and the snapshot, plus the model's chat time
(gpt-5.4-mini 5–15 s, gpt-5-mini 30–60 s, gpt-6-astra up to 150 s per turn). The session duration
depends on the selected models, fixed and generated case counts, and conversation turns.
A fix committed while the runner goes on takes effect from the next run, because every run
starts a fresh server and chat; the report then says which runs ran with which build.

## Run a prompt (the script)

```bash
node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" ...] [--plan <plan snapshot id>] [--image <file>] [--out <dir>] [--dev] [--headed]
```

| Argument | Meaning |
|---|---|
| `<provider>` | a chat provider of the launcher, passed through unchanged (`gpt-5.4-mini`, `mistral`, `claude`, … — see [ai-chat.md](../../docs/ai-chat.md)) |
| `<api-key>` | the provider's API key, e.g. `"$AZURE_GPT_KEY"` |
| `"<prompt>" …` | the user messages: consecutive turns of one conversation (the history goes along, as in the chat window); a turn with an error ends it. `""` with `--image` sends the image alone — the chat backend gives it the image prompt of the planner, which names the skill `image-planning` |
| `--plan <id>` | the plan snapshot the page starts from (`plan_id` of the example URL), its HI groups included; without it, the page's default plan |
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
   loaded) and until the HI library has loaded the plan's groups (`window.hiPosGroupsCompletelyLoaded`,
   set by the example page in `onPosGroupsCompletelyLoaded`) — the planner clears its undo history
   then, so a change of the chat made before it could not be undone in a later turn;
4. sends the prompts to the chat backend (`POST /chat`, with the system prompt and the image prompt it
   requests from the planner of its page — `getExternalObjectAgentPrompts()`, as the chat window does),
   each until the end of its stream, and records every planner call the MCP server sends to the
   page (from the bridge's WebSocket frames — the server's log cuts the arguments short);
5. reads the rooms, groups and obstacles (`get-plan-context`), then `getExternalObjectSnapshot()` with every
   field it stores and without the object GLB (the GLB is not generated), then saves
   the plan with `saveExternalObjectSnapshot()` for its plan snapshot id — **every run saves one
   plan snapshot in the Roomle backend**, as the example's "Save snapshot" button does;
6. stops the browser and every server process, also after an error or Ctrl+C.

### The result

| File | Content |
|---|---|
| `run.json` | provider; `plan`; `turns` (per turn the prompt, the `image` file it carried, the model's answer, the tools in order, `toolCalls` — per call of a plan-changing tool the `args` the model sent and its `corrections`, `notLoaded` or `error` —, `stepFailures` — per failed provider step the `step`, `durationMs` and the cause chain `causes` — errors, duration); all `errors`; `planSnapshotId`; example URL, start time, durations (ready, chat, snapshot) |
| `plan-context.json` | `get-plan-context` with rooms and groups after the chat — the walls and where the groups stand |
| `planner-calls.json` | every planner call during the chat: method, full arguments, `ok`, the page's `error`, and `ms` — how long the page took from the call to its result |
| `prompt-image.jpg` | with `--image` only: the image as the model got it |
| `order-data.json` | `orderData` of the snapshot — the groups with their articles and attributes |
| `top-image.png`, `perspective-image.png` | the whole plan rendered |
| `top-object-image.png`, `perspective-object-image.png` | the HI objects only (missing when the plan has no groups) |
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
- `jq` for preparing and checking the session test file
- `npm install` in `.agents/scripts` (Playwright 1.55.0 — the version roomle-ui uses, so its cached
  Chromium is reused; on a machine without it: `npx playwright install chromium` in `.agents/scripts`;
  marked and sharp for the PDF of the report)
- a GPU — the run script starts headless Chromium with `--enable-gpu`: under SwiftShader, the
  software GL headless Chromium falls back to without it, the planner's object-only perspective
  render draws an empty frame and every run's `perspective-object-image.png` is empty. Why:
  [mcp-test-infrastructure-issues.md](../backlog/mcp-test-infrastructure-issues.md), issue 1
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
| every `perspective-object-image.png` is fully transparent, the other images render | no GPU: headless Chromium fell back to SwiftShader, under which the planner's object-only perspective render draws an empty frame — the run script passes `--enable-gpu` for this; on a machine without a GPU the image stays empty until the planner defect is fixed ([backlog](../backlog/mcp-test-infrastructure-issues.md), issue 1) |
| `errors` in `run.json` with the provider's message | invalid key or a provider failure; the snapshot is still stored |
| `Failed to process successful response` in `errors` | the provider answered with HTTP 200 and the AI SDK failed while it handled the response — a transport error, a response it could not validate, or another failure. The cause chain is in the turn's `stepFailures` in `run.json`, and in `console.log` in the line `[hi-chat] step n failed after … ms: …` that stands where the step's `step n:` line would be. Only a cause chain that ends in a transport error — `TypeError: terminated <- caused by Error: read ECONNRESET`, a connection reset by the provider or the network — is an **environment** failure, which the runner retries as a transport failure; any other cause is analysed like a provider error |
| `Prompt … > 262144 maximum context length` in `errors` | the turn's tool results exceed the model's context — a **bug**. The chat sends the images of a tool result to Mistral as a user message ([images in tool results](../../docs/ai-chat.md#images-in-tool-results)), and the server returns compact JSON without `imageUrl` ([result format](../../docs/hi-mcp-behaviour.md#53-result-format)); look for the result that is still large |
| `api.extended[message.method] is not a function` in `planner-calls.json` | the planner build lacks the method (see the bug rules above) |
| `the turn took longer than 5 minutes and was ended …` in `errors` | the chat backend's turn timeout (`HI_CHAT_TURN_TIMEOUT_MS`): the model did not answer in time — the chat streams nothing while a model reasons; the plan keeps what the tools changed |
| `chat request failed: aborted after 600s` | the run script's own chat timeout (10 minutes); reached only when `HI_CHAT_TURN_TIMEOUT_MS` is set above it — the turn keeps the tools and the text the chat streamed before |
| the runner names problems of the test file and runs nothing | an empty key variable, an unknown plan name, a missing image, a duplicate id — fix the file or the environment |

## See also

- [hi-mcp-tools.md](./hi-mcp-tools.md) — the tools the model calls
- [ai-chat.md](../../docs/ai-chat.md) — the chat backend and its providers
- [test-prompts.md](../../docs/test-prompts.md) — the plans and the format of the test file
- [mcp-test-infrastructure-issues.md](../backlog/mcp-test-infrastructure-issues.md) — what is open
  about running the tests
