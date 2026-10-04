# Open issues of the MCP test infrastructure

> **Type**: Backlog — bugs and gaps of running the tests themselves
> **Domain**: `.agents/scripts/run-hi-mcp-tests.js`, `run-hi-mcp-prompt.js`, `.agents/skills/hi-mcp-testing.md` — the process of running "test the mcp", not what the runs found about planning
> **Maintained by**: the analyses of the test infrastructure; the planning-generation bugs the runs surface stay in [mcp-test-open-issues.md](mcp-test-open-issues.md)

Each issue names the problem, the cause in the code, the to-do and its test. An issue leaves
this list when its fix is in the code; the list holds only what is still to be done.

## Overview

| # | Issue | Kind | Priority |
|---|---|---|---|
| 1 | [The object-only perspective render draws an empty frame under software GL](#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | defect in the planner the test drives, roomle-ui | low — the runs need a GPU meanwhile |

## 1. The object-only perspective render draws an empty frame under software GL

**Problem.** `getExternalObjectSnapshot` returns a `perspectiveObjectImage` that is a fully
transparent PNG when the planner runs on software WebGL (SwiftShader — headless Chromium
without GPU access). Every other snapshot image renders (top, object top, whole-plan
perspective). The run script passes `--enable-gpu`, so a machine with a GPU gets the image; a
machine without one gets an empty `perspective-object-image.png` in every run.

**Cause.** Not identified in the planner. The render's inputs are correct (camera placed at the
group, projection without NaN, layers covering the object's layers, meshes visible, synchronous
draw); the frame is dropped inside the roomle scene renderer's per-call pipeline under
SwiftShader, only on the isolation path (`_preparePerspectiveImage` with `runtimeIds` +
`rotationY`). The ruled-out hypotheses are in
[empty-perspective-object-image-in-test-runs.md](../bug-analysis/empty-perspective-object-image-in-test-runs.md).

**To do.** In roomle-ui (or the scene renderer package it wraps): instrument
`_sceneRenderer.render` under a software-GL context, find why the object-only perspective
frame is dropped, and make that render work under SwiftShader.

**Test.** A headless page on software GL: `getExternalObjectSnapshot({ perspectiveObjectImage:
true })` returns a non-empty image.
