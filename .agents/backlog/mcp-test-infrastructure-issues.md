# Open issues of the MCP test infrastructure

> **Type**: Backlog — what is still to be done about running the tests themselves
> **Domain**: `.agents/scripts/run-hi-mcp-tests.js`, `run-hi-mcp-prompt.js`, `.agents/skills/hi-mcp-testing.md` — the process of running "test the mcp", not what the runs find about planning
> **Maintained by**: the analyses of the test infrastructure; what the runs find about planning is in [mcp-test-open-issues.md](mcp-test-open-issues.md)

Each issue names the problem, the cause, the to-do and its test. An issue leaves this document when
its fix is in the code.

## Overview

| # | Issue | Kind | Priority |
|---|---|---|---|
| 1 | [The object-only perspective render draws an empty frame under software GL](#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | defect in the planner the test drives, roomle-ui | low — the runs need a GPU meanwhile |
| 2 | [The hint of a tool result is not recorded](#2-the-hint-of-a-tool-result-is-not-recorded) | gap in the run data, MCP server log + run script | medium — the evaluation cannot tell whether the model saw a hint |
| 3 | [A run whose page navigates after the chat stores no snapshot](#3-a-run-whose-page-navigates-after-the-chat-stores-no-snapshot) | gap in the run script | low — rare, rerun by hand |
| 4 | [The suite runs only the tests written by hand](#4-the-suite-runs-only-the-tests-written-by-hand) | gap in the test suite | low — RML-18027 |
| 5 | [Saving the plan snapshot fails](#5-saving-the-plan-snapshot-fails) | roomle-ui (Roomle API v3), run script | low — the evaluation reads `plan-context.json` and the images |

## 1. The object-only perspective render draws an empty frame under software GL

**Problem.** `getExternalObjectSnapshot` returns a `perspectiveObjectImage` that is a fully
transparent PNG when the planner runs on software WebGL (SwiftShader — headless Chromium without GPU
access). Every other snapshot image renders. The run script passes `--enable-gpu`, so a machine with
a GPU gets the image; a machine without one gets an empty `perspective-object-image.png` in every run.

**Cause.** Not identified in the planner. The render's inputs are correct (camera placed at the group,
projection without NaN, layers covering the object's layers, meshes visible, synchronous draw); the
frame is dropped inside the roomle scene renderer's per-call pipeline under SwiftShader, only on the
isolation path (`_preparePerspectiveImage` with `runtimeIds` + `rotationY`,
roomle-ui `planner-scene-manager.ts:3263`). The front-view rotation, the isolation
(`hideAllExceptRuntimeIds`), the ground shadow, the clipping planes and the camera pose do not cause
it on their own. Of the four renders of one snapshot call (top, object top, perspective, object
perspective) only the last is empty.

**To do.** In roomle-ui (or the scene renderer package it wraps): instrument `_sceneRenderer.render`
under a software-GL context, find why the object-only perspective frame is dropped, and make that
render work under SwiftShader.

**Test.** A headless page on software GL: `getExternalObjectSnapshot({ perspectiveObjectImage: true })`
returns a non-empty image.

**Reproduce.** `run-hi-mcp-prompt.js` with `CHROMIUM_ARGS` (`:66`) set to `[]` (headless on
SwiftShader), test `three-tall-units-right-wall`.

## 2. The hint of a tool result is not recorded

**Problem.** `run.json` holds per call of a plan-changing tool the `args` the model sent and the
`corrections`, `notLoaded` or `error` it got back, but not the `hint` of the result — for example the
hint for a group without a position, or the row hints of D43 (a row past a wall, the units above that
moved). The evaluation cannot tell whether a hint reached the model.

**Cause.** The server's feedback log line carries `corrections` and `notLoaded` only (`runTool`,
`hi-mcp/hi-mcp-server/hi-mcp-server.ts:127`); the run script pairs those lines with the calls
(`TOOL_CALL_LINE`, `.agents/scripts/run-hi-mcp-prompt.js:60`) and stores what they hold.

**To do.** Log the `hint` in the feedback line and store it per tool call in `run.json`; the
evaluation step of the skill lists it beside the corrections.

**Test.** A run whose group loads without a placement shows the hint in `toolCalls`.

## 3. A run whose page navigates after the chat stores no snapshot

**Problem.** The headless page can leave the bridge right after the chat ("Execution context was
destroyed, most likely because of a navigation"): the run reads no plan context, stores no images and
no plan snapshot id, and ends with exit 1, although the model's tool calls loaded. The runner repeats
only a run without `run.json` (`run-hi-mcp-tests.js:204`), so this run stays as it is and has to be rerun by hand, with
`results.json` patched.

**Cause.** Not identified; the roomle-ui dev server keeps running when it happens. The changed plan
lives in the page's planner, so the navigation loses it — a reload cannot recover the run.

**To do.** The run script logs every navigation of the page and its frames (`framenavigated` with the
URL) into `console.log`, to find what navigates; the runner repeats a run whose `run.json` has no plan
snapshot id, once, and keeps the first attempt's directory beside it.

**Test.** A runner test: a run without a plan snapshot id is repeated once.

## 4. The suite runs only the tests written by hand

**Problem.** `docs/test-prompts.json` holds the tests written by hand, and "test the mcp" runs them or
a subset. [RML-18027](https://roomle.atlassian.net/browse/RML-18027) also asks for standard tests an
agent generates and for a fixed number of random tests in every run.

**Cause.** Not built. The hook exists: the skill writes the temporary test file `$SESSION/tests.json`
before the run (`.agents/skills/hi-mcp-testing.md`, step 3), and the runner checks any test file
before its first run (`problemsOf`, `.agents/scripts/run-hi-mcp-tests.js:74`).

**To do.** Decide how an agent generates standard tests and how the random tests are drawn; both go
into `$SESSION/tests.json`, each with a plan of `plans`, so the runner checks and runs them like the
others.

**Test.** A session with generated or random tests: the runner accepts the file, and the report
lists them beside the fixed tests.

## 5. Saving the plan snapshot fails

**Problem.** Saving the plan snapshot fails in every run with `Http error "400"` from
`/v3/planSnapshots` — with the `bo-test` planner (`https://www.roomle.com/api/v3/planSnapshots`) and
with the planner of a local dev server (`https://api.roomle.com/v3/planSnapshots`) alike: no run has
a plan snapshot id, and a result cannot be opened again.

**Cause.** Likely the move of the Roomle API from v2 to v3 in roomle-ui (PR #3048, `28fd7595f`;
`VITE_RAPI_URL=https://api.roomle.com/v3` in `.env`). The same change keeps the GLB links of a
snapshot on v2 because "v3 answers this endpoint only to signed requests" (`roomle-planner.ts:1872`);
the `POST` of `planSnapshots` is not kept on v2.

**To do.** Log the response body of the failing request (`run-hi-mcp-prompt.js:684`); check whether
the v3 `planSnapshots` `POST` needs a signed request or another payload, and fix it in roomle-ui.

**Test.** A run stores a plan snapshot id in `run.json`.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra, every run (the `bo-test` planner).