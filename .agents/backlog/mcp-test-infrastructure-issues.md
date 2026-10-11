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
