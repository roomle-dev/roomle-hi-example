# Open issues of the MCP test infrastructure

> **Type**: Backlog — what is still to be done about running the tests themselves
> **Domain**: `.agents/scripts/run-hi-mcp-tests.js`, `run-hi-mcp-prompt.js`, `.agents/skills/hi-mcp-testing.md` — the process of running "test the mcp", not what the runs find about planning
> **Maintained by**: the analyses of the test infrastructure; what the runs find about planning is in [mcp-issues.md](mcp-issues.md)

Each issue names the problem, the cause, the to-do and its test. An issue leaves this document when
its fix is in the code.

## Overview

| # | Issue | Kind | Priority |
|---|---|---|---|
| 1 | [The object-only perspective render draws an empty frame under software GL](#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | defect in the planner the test drives, roomle-ui | low — the runs need a GPU meanwhile |
| 2 | [The per-run fixed overhead of the test runner](#2-the-per-run-fixed-overhead-of-the-test-runner) | improvement of the test runner | medium — the runs stay sequential |
| 3 | [`run.json` keeps only the top-level message of a failed provider step](#3-runjson-keeps-only-the-top-level-message-of-a-failed-provider-step) | improvement of the test runner | medium — a provider failure that its message does not name is not retried |

## 1. The object-only perspective render draws an empty frame under software GL

**Problem.** `getExternalObjectSnapshot` returns a `perspectiveObjectImage` that is a fully
transparent PNG when the planner runs on software WebGL (SwiftShader — headless Chromium without GPU
access). Every other snapshot image renders. The run script passes `--enable-gpu`, so a machine with
a GPU gets the image; a machine without one gets an empty `perspective-object-image.png` in every run.

**Cause.** Not identified in the planner. The render's inputs are correct (camera placed at the group,
projection without NaN, layers covering the object's layers, meshes visible, synchronous draw); the
frame is dropped inside the roomle scene renderer's per-call pipeline under SwiftShader, only on the
isolation path (`_preparePerspectiveImage` with `runtimeIds` + `rotationY`,
roomle-ui `planner-core/src/webgl/planner-scene-manager.ts:3275`). The front-view rotation, the
isolation (`hideAllExceptRuntimeIds`), the ground shadow, the clipping planes and the camera pose
alone leave the frame intact. Of the four renders of one snapshot call (top, object top, perspective, object
perspective) only the last is empty.

**To do.** In roomle-ui (or the scene renderer package it wraps): instrument `_sceneRenderer.render`
under a software-GL context, find why the object-only perspective frame is dropped, and make that
render work under SwiftShader.

**Test.** A headless page on software GL: `getExternalObjectSnapshot({ perspectiveObjectImage: true })`
returns a non-empty image.

**Reproduce.** `run-hi-mcp-prompt.js` with `CHROMIUM_ARGS` (`:62`) set to `[]` (headless on
SwiftShader), test `three-tall-units-right-wall`.

## 2. The per-run fixed overhead of the test runner

**Problem.** A "test the mcp" session pays a fixed cost per run that does not depend on the prompt:
the launcher typechecks the whole `hi-mcp` workspace, a fresh Chromium starts, and a fresh launcher
boots (page, MCP server, chat backend). Over 44 runs the `ready` phase was 473 s — 24 % of the
session — beside the chat phase (63 %, the model and the planner) and the snapshot phase (13 %).

**Cause.** `start.mjs` runs `npm run typecheck` (three sequential `tsc` processes) on every launcher
start, on source that does not change between the runs of a session; `run-hi-mcp-prompt.js` launches
a fresh Playwright Chromium per run; and each run starts and stops its own launcher.

**To do.** Cut the fixed cost without touching the chat phase and without endangering the sequential
runs (fixed ports 3110/3200, one child at a time). In payoff order: (A) a `--no-typecheck` flag on
`start.mjs`, passed by the child, so a test session skips the redundant typecheck; (B) reuse one
Chromium across runs — the orchestrator owns a browser (`launchServer`), the child connects over CDP
and opens a fresh context per run; (C) reuse one launcher across runs (largest change, most risk —
the child owns the launcher lifetime and `aborted()` depends on it exiting). The retry/resume logic
and the stored result shape must not change, so `report.md` and the benchmark stay comparable.

**Test.** `node --test .agents/scripts/tests/*.test.js`; then a session's `durationsMs.ready` in
`run.json` against the 473 s / 10.8 s baseline, read by `benchmark-hi-mcp-runs.js`.

**Analysis.** [faster-mcp-test-runs.md](../refactoring-analysis/faster-mcp-test-runs.md).

## 3. `run.json` keeps only the top-level message of a failed provider step

**Problem.** When a provider step fails, `run.json` records only the message the chat stream
carries (`errors`: `Failed to process successful response`). The same message wraps a connection
reset, a response the AI SDK could not validate and other provider failures; telling them apart
needs the cause chain, which only `console.log` has. The runner's retry reads the same `errors`
(`isTransportFailure`, `.agents/scripts/mcp-test-navigation.js`), so a provider failure whose message
does not name it — the Azure Responses API's 400 "Item with id 'rs_…' not found" — stays as the
run's result instead of being retried.

**Cause.** The chat stream's `[error]` line carries `error.message` (`errorText` in
`hi-mcp/hi-mcp-chat/chat-stream.ts`); the cause chain goes to the launcher's log only, in the
`[hi-chat] step n failed after … ms: …` line (`createStepLog`, `describeStepError` in
`hi-mcp/hi-mcp-chat/chat-steps.ts`), which `createStepLog` writes to stderr (`console.error`). The
launcher starts the chat with inherited stdio, and `run-hi-mcp-prompt.js` inherits the launcher's
stderr (`stdio: ['ignore', 'pipe', 'inherit']`, `startLauncher`): it reads only the launcher's stdout
line by line (`recordToolCall`) and keeps the `[hi-mcp] tool` lines. The orchestrator writes both
streams to `console.log`.

**To do.** Let `run-hi-mcp-prompt.js` pipe the launcher's stderr as well (and pass it on to its own
stderr, so `console.log` keeps it) and record the `[hi-chat] step n failed after … ms: …` lines of
each turn in `run.json` (the step number, the duration and the cause chain), beside `errors`, and
let `isTransportFailure` test them too. The chat's answer to the user stays as it is.

**Test.** A unit test in `.agents/scripts/tests/` feeds a launcher line
`[hi-chat] step 3 failed after 63315 ms: AI_APICallError: … <- caused by TypeError: terminated <- caused by Error: read ECONNRESET`
and expects the turn's recorded step failure with that cause chain; a run whose recorded step
failure is an `AI_APICallError` is retried although its `errors` do not name it.

**Reproduce.** `.temp/result/mcp-test-2026-10-16_11-57-20/gpt-6-astra/28-edit-remove-corner-unit.attempt-1/` — `run.json` `errors` ("Item with id 'rs_…' not found.") against the step-3 line of its `console.log` (`AI_APICallError`, status 400); the runner did not retry the run.
