# Feature Analysis: The HI MCP test suite as a script

> **Type**: Feature Analysis
> **Domain**: agent tooling — `.agents/scripts/run-hi-mcp-prompt.js`, a new runner script, `.agents/skills/hi-mcp-testing.md`, `docs/test-prompts.md`
> **Trigger**: RML-18027, request of 2026-10-02: running the tests becomes a script that uses `.agents/scripts/fetch-hi-library-data.js`; the prompts move to `test-prompts.json` with the models (key variables) and the test cases (plan, prompt, image); a plan for Group Editing; results per model; no `object.glb`, and no `snapshot.json` if the analysis does not need it; the skill writes a temporary subset JSON, runs the script and evaluates as now; default model `gpt-5-mini`
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `feat/tests-and-plans` (roomle-hi-example)
> **Builds on**: [test the mcp](hi-mcp-test-the-mcp-skill.md), [image prompts](hi-mcp-test-image-prompts.md)

## What was asked and why

| # | Requirement |
|---|---|
| R1 | Running the tests is a script, and the script uses `.agents/scripts/fetch-hi-library-data.js` |
| R2 | The test prompts move to `test-prompts.json`, under source control |
| R3 | The JSON holds the models with their keys as environment variables: `gpt-5-mini`, `gpt-5.4-mini` and `gpt-6-astra`, each with `$AZURE_GPT_KEY` |
| R4 | The JSON holds the test cases: a plan to start from, a prompt and an image |
| R5 | Group Editing starts from a plan created for it, with an id; the plan is listed under "Plans" in `docs/test-prompts.md` |
| R6 | The script runs every test for every model into `.temp/result/<session>/<model>/` |
| R7 | No `object.glb`; no `snapshot.json` either, if "test the mcp" does not need it |
| R8 | "test the mcp" writes a temporary JSON with a subset of `test-prompts.json` (e.g. every test, one model), runs the script and evaluates the results as now |
| R9 | The skill's default model is `gpt-5-mini` with `$AZURE_GPT_KEY` |

Why: the suite now runs as 17 commands the agent starts one by one. It reads the prompts out of a
markdown file, cannot start from a plan other than the page's default, and needs setup turns to
build the plan for an edit. A script with a JSON test list runs the same suite for several models
without an agent. The same file is the hook for the later items of the ticket (generated and
random tests).

## How it works today

**One run** — [run-hi-mcp-prompt.js](../scripts/run-hi-mcp-prompt.js) `<provider> <api-key> "<prompt>" … [--image] [--out] [--dev]`:
- starts the launcher with the MCP server on 3110 and the chat on 3200;
- opens the example URL in a fresh headless Chromium and waits for the HI library;
- sends the prompts as chat turns, then reads `get-plan-context`;
- reads `getExternalObjectSnapshot()` with no arguments — every field, the object GLB included;
- saves the plan with `saveExternalObjectSnapshot()` for its plan snapshot id;
- writes `run.json`, `plan-context.json`, `planner-calls.json`, `snapshot.json`, `order-data.json`,
  `plan.xml`, four PNGs, `object.glb` and, with `--image`, `prompt-image.jpg`.

One run takes 45–70 s: about 10 s to the ready page, the model's turns, and about 20 s for the
snapshot and the save.

**The suite** — [hi-mcp-testing.md](../skills/hi-mcp-testing.md):
- the agent parses the fenced blocks of [test-prompts.md](../../docs/test-prompts.md) at run time;
- it starts each prompt as its own background command and evaluates the previous result meanwhile;
- a Group Editing prompt gets the setup turn "add a group of three tall units to the wall on the
  right" first. "Join groups" also gets "remove the middle unit". The edit therefore depends on
  what the model built in the setup turn: `HTB60` or `H2TB60`, and corrections or not;
- the default model is `gpt-5.4-mini`.

**Result size.** The session of 2026-10-02 12:45 is 831 MB for 17 runs, about 49 MB per run. Of
that, `snapshot.json` is 20 MB and `object.glb` 13 MB.

**Plans** — the example page takes `plan_id`
([index.html](../../minimal-hi-example/index.html), `options.id = getQueryParam('plan_id') ?? … ?? DEFAULT_PLAN_ID`).
Checked live on 2026-10-02 with the headless setup of the run script:

| `plan_id` | Result |
|---|---|
| `ps_qphxs1kpzpfhsmr7basqeieugcetydz` (the plan snapshot run 01 saved) | the page loads with the HI group: same id `8f52efbd`, three `HTB60` at `[4815, 0, -3765]` / 270 |
| `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv` ("Default Room" in `docs/test-prompts.md`) | the room of the page's default plan (6 walls, same floor), no groups — a different id than `DEFAULT_PLAN_ID` (`ps_8jjg0zezlblb48vzn8qas9vwwn7fqbg`) |
| `ps_n9zrz89zsyy46l34mkf5pd52cx2ea2y` ("Closets") | a bedroom with a bed, nightstands and a rug (Roomle items, no HI groups) |

A plan snapshot saved by `saveExternalObjectSnapshot()` is therefore a usable start plan, its HI
groups included. Nothing in the launcher or the run script passes a plan today.

**The snapshot request** — `getExternalObjectSnapshot(requestData?)` (roomle-ui
`planner-core/src/roomle-planner.ts`) generates only the fields `requestData` names; the object GLB
is exported only when `objectGlb` is requested. Checked live: the deployed planner the example page
loads answers `{ topImage: true, orderData: true }` with those two fields only.

**`fetch-hi-library-data.js`** fetches the Furniture_Smith article catalog and master data from the
HOMAG backend — no planner, no browser — and writes `docs/library-information/article.json` and
`master-data.json`. `generate-article-catalog.js` and `generate-attributes-table.js` build on those
files. It fetches library data, not plans.

## The answers the request asks for

- **`object.glb`** is not needed: the skill never reads it. The run script asks
  `getExternalObjectSnapshot` for the fields it writes, without `objectGlb`. The GLB is then not
  even generated, which also saves the export time.
- **`snapshot.json`** is not needed: it is the raw return value, and every field of it already has
  a file of its own (`order-data.json`, `plan.xml`, the four PNGs, `object.glb`). The skill reads
  none of it. Drop it.
- Without the two files a run is about 16 MB instead of 49 MB.
- Unchanged and not used by the evaluation either: `plan.xml` (236 KB) and the two object-only
  PNGs (about 30 KB each). They stay — they cost little, and `plan.xml` reloads the result.

## The gap

1. The test list is markdown that the agent parses at run time. There is no list of models, no
   start plan per test, and no image per test other than a `*Reference:*` line.
2. The run script cannot start from a plan.
3. The edits depend on a setup turn by the model under test.
4. Running the suite needs an agent that starts 17 commands; several models mean doing that again
   per model.
5. Two thirds of the result size is unused.

## Proposed design

### 1. `docs/test-prompts.json`

```json
{
  "models": [
    { "provider": "gpt-5-mini", "apiKeyEnv": "AZURE_GPT_KEY" },
    { "provider": "gpt-5.4-mini", "apiKeyEnv": "AZURE_GPT_KEY" },
    { "provider": "gpt-6-astra", "apiKeyEnv": "AZURE_GPT_KEY" }
  ],
  "plans": {
    "default-room": "ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv",
    "three-tall-units": "ps_<to be created>",
    "two-tall-units-apart": "ps_<to be created>"
  },
  "tests": [
    {
      "id": "three-tall-units-right-wall",
      "title": "Add a group of three tall units to the wall on the right",
      "prompt": "add a group of three tall units to the wall on the right"
    },
    {
      "id": "image-only-no-text",
      "title": "Only an image, no text",
      "prompt": "",
      "image": "docs/images/kitchen-4.png"
    },
    {
      "id": "edit-replace-unit",
      "title": "Replace a unit",
      "plan": "three-tall-units",
      "prompt": "replace the middle unit with a cabinet with drawers",
      "expect": "exchange-root-module; the middle unit becomes a drawer cabinet, the row stays"
    }
  ]
}
```

- `apiKeyEnv` names the environment variable; the file never holds a key.
- `plans` maps the names of the "Plans" section of `docs/test-prompts.md` to their ids. A test
  names its plan. Without one it starts from the page's default plan (no `plan_id`), as today.
- A test is one prompt, optionally with one image. The setup turns are gone: an edit starts from
  its plan.
- `expect` (optional) carries what the markdown said beside a prompt: the tool of an edit, the
  specifications of the full kitchen.
- `docs/test-prompts.md` keeps the plans with their images and ids, the testing guidelines and a
  pointer to the JSON. The prompt lists leave the markdown, so there is one list.

### 2. The Group Editing plans

They are created once, with a fixed payload, not by a model:
- the three tall units: `create-or-replace-groups` through the MCP endpoint — three `HTB60` on the
  right wall from the back right corner, docked `RightBottom → LeftBottom`, placement
  `[4815, 0, -3765]` / 270;
- the two tall units apart: the same plan after `delete-root-module` of the middle unit, which
  splits the row into two groups;
- each saved with `saveExternalObjectSnapshot()`, its id and perspective image added to "Plans"
  with the payload that rebuilds it.

"Join groups" then starts from the two-groups plan instead of two setup turns. Each edit test
exercises exactly one command tool.

### 3. `run-hi-mcp-prompt.js`

- `--plan <plan snapshot id>` appends `&plan_id=<id>` to the example URL;
- `getExternalObjectSnapshot({ orderData: true, planXML: true, topImage: true, perspectiveImage: true, topObjectImage: true, perspectiveObjectImage: true })`
  — without `objectGlb`;
- `snapshot.json` and `object.glb` are no longer written;
- `run.json` records `plan`.

### 4. The runner: `.agents/scripts/run-hi-mcp-tests.js`

```bash
node .agents/scripts/run-hi-mcp-tests.js [<tests.json>] [--out <dir>] [--dev]
```

1. Reads the test file (default `docs/test-prompts.json`), resolves every `plan` name, and checks
   that every `image` file exists and every `apiKeyEnv` is set. It stops before the first run
   otherwise, naming what is missing.
2. Uses `fetch-hi-library-data.js` — see [open question 1](#open-questions).
3. For each model, then each test, it runs `run-hi-mcp-prompt.js <provider> "$KEY" "<prompt>"
   [--image] [--plan <id>] [--dev] --out <session>/<model>/<NN>-<id>` as a child process, one after
   another (fixed ports). `<NN>` is the test's position in the file, and `<model>` is the provider
   name as written in the JSON.
4. Skips a test whose directory already holds `run.json`. A stopped session continues with the same
   `--out`.
5. Writes `<session>/results.json` after every run: per model and test the directory, exit code,
   plan snapshot id, errors and duration. The session default is
   `.temp/result/mcp-test-<local timestamp>/`.

It takes 15–20 min per model for 17 tests, about an hour for the three models.

Every run keeps one fresh launcher and browser (the run script unchanged in that). A run cannot
inherit the plan or the IndexedDB state of the run before it.

### 5. The skill "test the mcp"

1. Model: `gpt-5-mini` with `$AZURE_GPT_KEY` unless the user names another.
2. Writes `$SESSION/tests.json`: `docs/test-prompts.json` with only the chosen model(s) — by default
   every test, one model. Later items of the ticket (generated, random tests) add their tests here.
3. Starts the runner once as a background command:
   `node .agents/scripts/run-hi-mcp-tests.js "$SESSION/tests.json" --out "$SESSION"`, with a timeout
   that fits the session (2 h maximum).
4. Evaluates each test as soon as its `run.json` appears (a monitor on `results.json`), with the
   table, the checks and the verdicts of today; the paths gain the model level.
5. Writes `report.md` as now, with one section per model and a comparison table when the session
   has more than one. The open-issues step stays.

The prompt parsing, the setup-turn rules and the 17 single background commands leave the skill.

### 6. Documentation

- `docs/test-prompts.md`: the plans (plus the two new ones), the guidelines, a pointer to the JSON.
- The skill, its rows in `AGENTS.md`, `.agents/README.md`, `.github/copilot-instructions.md` and
  the feature-analysis index.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the prompts in the markdown and parse them in the script | Markdown has no place for models, plans or images per test; the parsing rules live in the skill today and would move into code |
| Keys in the JSON | The file is under source control |
| One launcher and browser per model, a page reload per test | About 10 s faster per run, but the page's IndexedDB state (`saveToIdb`) and the MCP server's state carry over between tests; it is a second way to run a test beside the run script |
| Runs in parallel | The ports are fixed, and several Chromium instances with SwiftShader compete for the CPU |
| Build the Group Editing plan with a setup turn, as now | The edit then depends on the model under test; a plan is the same for every model and every run |
| Use a plan snapshot of an earlier test run as the edit plan (e.g. `ps_qphxs1kpzpfhsmr7basqeieugcetydz`) | It works (checked above), but nobody can rebuild it; a fixed payload documents what the plan is |
| Keep `snapshot.json` for completeness | Every field is already a file; 20 MB per run |

## Open questions

1. **What does the runner use `fetch-hi-library-data.js` for?** It fetches the library's article
   catalog and master data, not plans. Proposal: at the start of a session, write the fetched data
   to `<session>/library/` (refactor the script to export its fetch and keep the CLI). The report
   then records the library state the models ran against, and generated tests can draw on the
   catalog later.
   - Alternative: refresh `docs/library-information/` itself — but every run would then change
     tracked files.
   - Or was something else meant, e.g. the ticket's "load the plans from ligna-store via the command
     line"?
2. **"Join groups"**: a second plan with the two groups (proposed), or keep a setup turn
   "remove the middle unit"? A second plan keeps every test at one prompt.
3. **The prompt list in the markdown**: leave the JSON as the only list (proposed: "move"), or keep a
   readable copy in `docs/test-prompts.md`?
4. **The runner's output**: `<session>/<model>/<NN>-<id>/` as proposed; is the provider name
   (`gpt-5.4-mini`) the model name you want, or the resolved model id?

## Ticket coverage (RML-18027)

| Ticket item | Here |
|---|---|
| Models, key variables and tests in JSON; running the tests is a script | §1, §4 |
| "Test the MCP" generates a temporary JSON | §5 step 2 |
| Plan id per test (default plan as fallback); ligna-store plans, the plan with two rooms and an attic | §1 `plans`; the "Plans" section already lists them, and the runner passes them with `--plan` |
| Tests with images | done ([image prompts](hi-mcp-test-image-prompts.md)) |
| Let the agent generate more standard tests | not in this request; the JSON is where they go |
| A fixed number of random tests per run, temporary test JSON | not in this request; §5 step 2 is the hook |
| Delete `object.glb` and `snapshot.json`, or don't generate them | §3 |

## Code and documents the work touches

- `.agents/scripts/run-hi-mcp-prompt.js` — `--plan`, the snapshot request, no `snapshot.json`/`object.glb`
- `.agents/scripts/run-hi-mcp-tests.js` — new
- `.agents/scripts/fetch-hi-library-data.js` — exports its fetch (open question 1)
- `docs/test-prompts.json` — new; `docs/test-prompts.md` — plans, guidelines, pointer
- `docs/images/` — the perspective images of the two new plans
- `.agents/skills/hi-mcp-testing.md`; the skill rows in `AGENTS.md`, `.agents/README.md`,
  `.github/copilot-instructions.md`; `.agents/feature-analysis/README.md`
- No change to the MCP server, the chat or the example page.

## Verification plan

1. The runner with a two-test JSON (one plan test, one image test) and one model:
   - the layout `<session>/gpt-5-mini/01-…`, `02-…`;
   - no `object.glb` and no `snapshot.json`;
   - `run.json` records the plan;
   - the edit starts from the plan's group (`planner-calls.json` has no create call before the
     edit).
2. A missing key variable or image stops the runner before the first run.
3. A stopped session continues with the same `--out` and skips the finished tests.
4. "test the mcp" end to end with `gpt-5-mini`: the temporary JSON, one runner command, the report.
