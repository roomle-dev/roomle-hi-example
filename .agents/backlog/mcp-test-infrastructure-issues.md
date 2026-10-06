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

## 1. The object-only perspective render draws an empty frame under software GL

**Problem.** `getExternalObjectSnapshot` returns a `perspectiveObjectImage` that is a fully
transparent PNG when the planner runs on software WebGL (SwiftShader — headless Chromium without GPU
access). Every other snapshot image renders. The run script passes `--enable-gpu`, so a machine with
a GPU gets the image; a machine without one gets an empty `perspective-object-image.png` in every run.

**Cause.** Not identified in the planner. The render's inputs are correct (camera placed at the group,
projection without NaN, layers covering the object's layers, meshes visible, synchronous draw); the
frame is dropped inside the roomle scene renderer's per-call pipeline under SwiftShader, only on the
isolation path (`_preparePerspectiveImage` with `runtimeIds` + `rotationY`). What is ruled out:
[empty-perspective-object-image-in-test-runs.md](../bug-analysis/empty-perspective-object-image-in-test-runs.md).

**To do.** In roomle-ui (or the scene renderer package it wraps): instrument `_sceneRenderer.render`
under a software-GL context, find why the object-only perspective frame is dropped, and make that
render work under SwiftShader.

**Test.** A headless page on software GL: `getExternalObjectSnapshot({ perspectiveObjectImage: true })`
returns a non-empty image.

## 2. The hint of a tool result is not recorded

**Problem.** `run.json` holds per call of a plan-changing tool the `args` the model sent and the
`corrections`, `notLoaded` or `error` it got back, but not the `hint` of the result — for example the
hint for a group without a position, or the row hints of D43 (a row past a wall, the units above that
moved). The evaluation cannot tell whether a hint reached the model.

**Cause.** The server's feedback log line carries `corrections` and `notLoaded` only (`runTool`,
`hi-mcp/hi-mcp-server/hi-mcp-server.ts`); the run script pairs those lines with the calls
(`TOOL_CALL_LINE`, `.agents/scripts/run-hi-mcp-prompt.js`) and stores what they hold.

**To do.** Log the `hint` in the feedback line and store it per tool call in `run.json`; the
evaluation step of the skill lists it beside the corrections.

**Test.** A run whose group loads without a placement shows the hint in `toolCalls`.

## 3. A run whose page navigates after the chat stores no snapshot

**Problem.** The headless page can leave the bridge right after the chat ("Execution context was
destroyed, most likely because of a navigation"): the run reads no plan context, stores no images and
no plan snapshot id, and ends with exit 1, although the model's tool calls loaded. The runner repeats
only a run without `run.json`, so this run stays as it is and has to be rerun by hand, with
`results.json` patched.

**Cause.** Not identified; the roomle-ui dev server keeps running when it happens. The changed plan
lives in the page's planner, so the navigation loses it — a reload cannot recover the run.

**To do.** The run script logs every navigation of the page and its frames (`framenavigated` with the
URL) into `console.log`, to find what navigates; the runner repeats a run whose `run.json` has no plan
snapshot id, once, and keeps the first attempt's directory beside it.

**Test.** A runner test: a run without a plan snapshot id is repeated once.
