# Feature Analysis: "test the mcp" — the prompt suite of the HI MCP testing skill

> **Type**: Feature Analysis
> **Domain**: agent tooling — `.agents/skills/hi-mcp-testing.md`, `.agents/scripts/run-hi-mcp-prompt.js`; the prompts of `docs/test-prompts.md`
> **Trigger**: Request of 2026-09-30: "implement a skill that uses the script — executed when asked 'test the mcp'", running the example prompts of `docs/test-prompts.md` that need no image, storing every result in a new dated subdirectory of `.temp/result`, and ending with a markdown document that shows per prompt the plan snapshot id, the perspective and top image, an evaluation and whether the result is a bug; default model `gpt-5.4-mini` with `$AZURE_GPT_KEY`
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Implemented
> **Branch**: `feat/hi-mcp-testing-skill` (roomle-hi-example)
> **Builds on**: [the prompt run script](hi-mcp-prompt-run-script.md)

> **Close-out (2026-09-30)**: implemented as proposed, plus `plan-context.json` (the walls and the
> groups after the chat — the placement check needs them) and the evaluation aids that the first
> full run showed to be necessary; see the [close-out report](#close-out-report-2026-09-30). Verified
> with one full "test the mcp" run with `gpt-5.4-mini`: 13 prompts, 10 pass, 3 fail, 1 bug. The
> living reference is `.agents/skills/hi-mcp-testing.md`. The analysis below is kept as written.

---

## What was asked and why

"test the mcp" runs the prompt collection of `docs/test-prompts.md` against the real chat and
planner and ends with one report: per prompt the plan snapshot id, the perspective and the top
image, an evaluation and a bug verdict. Default model `gpt-5.4-mini` with `$AZURE_GPT_KEY`, another
one when the user names it. Prompts that need a reference image are left out.

## How it works today

- `run-hi-mcp-prompt.js <provider> <api-key> "<prompt>"` runs **one** prompt on a fresh plan and
  writes `.temp/result/<UTC timestamp>-<provider>/` (see the
  [script analysis](hi-mcp-prompt-run-script.md#close-out-report-2026-09-30)).
- `getExternalObjectSnapshot()` returns order data, plan XML, GLB and images — **no plan snapshot
  id**. Only `saveExternalObjectSnapshot()` returns one (`planSnapshotId`): it saves the plan as a
  plan snapshot in the Roomle backend, exactly what the page's "Save snapshot" button does
  (`roomle-planner.ts:1812-1851`, `index.html:972-996`). A plan snapshot id opens the plan again as
  the example's `plan_id` parameter (`index.html:587`).
- `docs/test-prompts.md` has 15 prompts: 2 group placements, 3 kitchen plans, 2 with a reference
  image, 1 detailed kitchen, 7 group edits. The group edits say "start from a plan with a kitchen
  group, e.g. the three tall units on the right wall above"; "join the two groups" runs "after
  removing the middle unit".
- The MCP server logs every planner call, but cuts the arguments at 400 characters
  (`page-bridge.ts:94`) — the group layout and its placement are not in the log.

## The gap

1. **The group edits need a plan with a group.** A single prompt on the fresh preset plan has
   nothing to edit.
2. **No plan snapshot id** in a run's result.
3. **One result directory per run**, named by the script — the suite needs all results under one
   dated directory.
4. **No evidence for a bug verdict** beyond the images and the answer: whether a misplaced group is
   the model's input or the server's placement needs the planner calls with their arguments.

## Proposed design

### Script (`run-hi-mcp-prompt.js`)

- **Several prompts = one conversation**: `"<prompt>" ["<prompt>" …]` are sent as consecutive turns
  of one chat conversation (the history goes along, as in the chat window); the snapshot is taken
  after the last turn. A turn with an error ends the conversation. `run.json` gets `turns` (prompt,
  answer, tools, errors, duration per turn).
- **`--out <dir>`**: the result goes into that directory instead of `.temp/result/<timestamp>-<provider>`.
- **The plan snapshot id**: after `getExternalObjectSnapshot()` the script calls
  `saveExternalObjectSnapshot()` and puts `planSnapshotId` into `run.json` — every run saves one
  plan snapshot in the Roomle backend, as the "Save snapshot" button does.
- **`planner-calls.json`**: every planner call the MCP server sends to the page after the page is
  ready — method, full arguments, and the error when the page answered with one — read from the
  page's WebSocket frames (Playwright), so neither the server nor the page changes.
- Arguments are parsed with `node:util` `parseArgs` (it already rejects unknown options).

### Skill (`hi-mcp-testing.md`, section "Test the MCP")

Loaded when the user asks to "test the mcp" (registered in `AGENTS.md`, `.agents/README.md`,
`.github/copilot-instructions.md`). The agent:

1. picks the model: `gpt-5.4-mini` with `$AZURE_GPT_KEY`, unless the user names another;
2. creates `.temp/result/mcp-test-<YYYY-MM-DD_HH-MM-SS>/` (local time);
3. reads the prompts from `docs/test-prompts.md` at run time — the fenced prompts of every
   section except "Image-Based Kitchen Creation"; a group edit gets the setup turns the document
   names (the three tall units on the right wall; "remove the middle unit" before "join the two
   groups");
4. runs each prompt with the script, `--out <session>/<NN>-<slug>`, one after another (fixed ports),
   evaluating the finished one while the next runs;
5. evaluates each result from the images, `run.json`, `order-data.json` and `planner-calls.json`:
   verdict pass / partial / fail, and bug yes / no with the component and the reason;
6. writes `<session>/report.md`: a summary table, then per prompt the plan snapshot id, the
   perspective and the top image, the tools, the evaluation and the bug verdict.

The judgement stays with the agent: the images and the kitchen have to be looked at; a script
cannot decide whether three tall units stand on the right wall.

### Bug rules (in the skill)

A result is a **bug** when the system — not the model — is at fault: a tool or planner call fails
or is rejected for a valid request; the chat backend fails on its own data (e.g. a tool result
larger than the model's context); the plan contradicts what the tools reported; the planner calls
place a group where the model's input did not ask for it, or valid input yields impossible geometry
(outside the room, through a wall, overlapping another group). A weak but valid model choice
(other articles, a misread wall, stopping early) is a **model finding**, not a bug; provider
failures (auth, quota, rate limit) are **environment**.

## Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Run the group edits on the fresh plan | Nothing to edit — every edit fails for a reason the test does not measure |
| A setup prompt as a separate script run | Each run starts from a fresh browser; the setup's plan would be gone |
| Plan snapshot links instead of local images in the report | The links need the backend; the local PNGs are already in the result |
| A script that writes the report | The evaluation is judgement on images and plans; the agent writes it following the skill's template |
| Keeping the prompt list in the skill | A second copy that drifts from `docs/test-prompts.md` |
| Saving the plan snapshot behind a flag | The id is useful for every run (it reopens the plan); one flag less |
| A Claude Code skill folder (`.claude/skills`) | Not a convention of this repository; `CLAUDE.md` loads `AGENTS.md`, whose skill table carries the trigger |

## Code and documents the work would touch

| File | Change |
|---|---|
| `.agents/scripts/run-hi-mcp-prompt.js` | several prompts, `--out`, plan snapshot id, `planner-calls.json`, `parseArgs` |
| `.agents/skills/hi-mcp-testing.md` | the "Test the MCP" procedure, the report template, the bug rules; the script reference updated |
| `AGENTS.md`, `.agents/README.md`, `.github/copilot-instructions.md` | the trigger "test the mcp" in the skill tables |
| `docs/test-prompts.md` | the pointer to the skill names the suite |
| `.agents/feature-analysis/README.md`, `.agents/README.md` | list this analysis |

## Verification

- One group edit with its setup turn through the script with `gpt-5.4-mini`: two turns in
  `run.json`, a `planSnapshotId`, `planner-calls.json` with the layout and the command.
- "test the mcp" once, end to end with `gpt-5.4-mini`: every prompt without an image run, all
  results under one session directory, `report.md` with ids, images, evaluations and bug verdicts.

## Close-out report (2026-09-30)

### What was built

- `run-hi-mcp-prompt.js`: several prompts as the turns of one conversation (`turns` in `run.json`),
  `--out <dir>`, `planSnapshotId` from `saveExternalObjectSnapshot()`, `planner-calls.json` from the
  bridge's WebSocket frames (only the calls during the conversation), `plan-context.json`
  (`get-plan-context` with rooms and groups after the chat), `node:util` `parseArgs`.
- `.agents/skills/hi-mcp-testing.md`: the "Test the MCP" procedure — model, session directory,
  prompt selection with the setup turns, runs, evaluation (files, JSON paths, `jq` commands for the
  evidence, checks, verdict and bug rules), report template; the script reference updated.
- The trigger "test the mcp" in the skill tables of `AGENTS.md`, `.agents/README.md` and
  `.github/copilot-instructions.md`; `docs/test-prompts.md` points to it.

### Decisions taken during the implementation

| Decision | Why |
|---|---|
| `plan-context.json` (rooms and groups after the chat) | Whether a group stands at the wall the model named needs the walls' `start`/`end`/`facingRotationY` and the groups' `position`; the snapshot has neither in a comparable form |
| `planner-calls.json` without the script's own calls | The readiness polls and the final `get-plan-context` go through the bridge as well and would read like the model's calls |
| The bug rules gained "the server accepts input its rules say it rejects" and the **hardening candidate** category | The first full run had both: a disconnected docking graph passing the validation the rules promise (a bug), and outside-the-room footprints, several roots on one vector and a wall cabinet as anchor that the server accepts without the rules promising a rejection |
| The `is not a function` rule without a dated claim | The check run at 14:00 UTC got `externalObjectGroupOperation … is not a function` from the bo-test planner; from 14:10 UTC on every command call reached it — the rule names the cause, not a state that changes |
| Each run its own background command | One background loop over the 13 prompts was stopped by the tool's time limit in the 11th run (the script ended cleanly on the SIGTERM; the run was repeated) |
| The evidence as `jq` commands in the skill, no helper script | The fields are few, the commands stay visible to the evaluating agent; `.agents/scripts` stays JavaScript-only |

### Verification

| Check | Result |
|---|---|
| Usage errors (no prompt, unknown option) | usage printed, exit 1 |
| Two turns (setup + "remove the middle unit") with `gpt-5.4-mini`, `--out` | two turns in `run.json`, `planSnapshotId`, `planner-calls.json` with the layout and the command — and the page's `is not a function` error (see above) |
| "test the mcp", `gpt-5.4-mini`, bo-test planner | `.temp/result/mcp-test-2026-09-30_16-04-31/`: 13 prompts run, 2 skipped (image), every run with a plan snapshot id; `report.md` with 26 images (all links resolve), 10 pass, 3 fail |

### Findings of the first run

- **Bug — MCP server docking validation**: `create-or-replace-groups` accepts a group whose docking
  graph falls into unconnected parts (`tool-executors.ts:602-628` counts a root as docked when it
  docks another root); the served rules say undocked roots are rejected (run 04).
- **Hardening candidates**: a footprint outside the room (runs 02, 06, and both Mistral Large runs
  before), several roots on one docking vector (06), a wall cabinet as the placement anchor (06).
- **Model findings**: a wall's `start` taken for its `end` (02); materials claimed but not set (06);
  answers that contradict the plan (02, 04, 06, 12).
- **Observations**: rejected `create-or-replace-groups` calls are invisible in the chat stream; a
  blank object-only perspective render (04); the merged group's footprint starts 120 mm behind the
  back wall (12).
