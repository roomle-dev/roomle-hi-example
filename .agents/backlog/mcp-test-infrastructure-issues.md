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
