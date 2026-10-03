# Open issues of the MCP test infrastructure

> **Type**: Backlog — bugs and gaps of running the tests themselves
> **Domain**: `.agents/scripts/run-hi-mcp-tests.js`, `run-hi-mcp-prompt.js`, `.agents/skills/hi-mcp-testing.md` — the process of running "test the mcp", not what the runs found about planning
> **Maintained by**: the analyses of the test infrastructure; the planning-generation bugs the runs surface stay in [mcp-test-open-issues.md](mcp-test-open-issues.md)

Each issue names the problem, the cause in the code, the to-do and its test. An issue leaves
this list when its fix is in the code.

## Overview

| # | Issue | Kind | Status |
|---|---|---|---|
| 1 | [The object-only perspective render draws an empty frame under software GL](#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | defect in the planner the test drives, roomle-ui | mitigated in the run script (`--enable-gpu`); the planner defect is open |

## 1. The object-only perspective render draws an empty frame under software GL

**Problem.** `getExternalObjectSnapshot` returns a `perspectiveObjectImage` that is a fully
transparent PNG when the planner runs on software WebGL (SwiftShader — headless Chromium
without GPU access). Every other snapshot image renders (top, object top, whole-plan
perspective). Until the run script was switched to `--enable-gpu`
(`fix/empty-perspective-object-image`), every `perspective-object-image.png` of every test
run of every session was empty, so the report's view of the group alone was lost.

**Cause.** Not identified in the planner — the bug is still open. The render's inputs are
correct (camera placed at the group, projection without NaN, layers covering the object's
layers, meshes visible, synchronous draw), and neutralizing the rotation, the isolation, the
ground-shadow toggles, the near/far planes and the camera pose each did not fix it: the frame
is dropped inside the roomle scene renderer's per-call pipeline under SwiftShader, only on
the isolation path (`_preparePerspectiveImage` with `runtimeIds` + `rotationY`). The findings
and the ruled-out hypotheses are in
[empty-perspective-object-image-in-test-runs.md](../bug-analysis/empty-perspective-object-image-in-test-runs.md).

**To do.** In roomle-ui (or the scene renderer package it wraps): instrument
`_sceneRenderer.render` under a software-GL context and find why the object-only perspective
frame is dropped, then make that render work under SwiftShader. Until then the test runs need
a GPU (`--enable-gpu` in `run-hi-mcp-prompt.js`).

**Test.** A headless page on software GL: `getExternalObjectSnapshot({ perspectiveObjectImage:
true })` returns a non-empty image.

**Latest run** (`mcp-test-2026-10-03_19-19-16-empty-object-image`): gpt-5-mini 01 — empty under
SwiftShader, correct with `--enable-gpu`.
