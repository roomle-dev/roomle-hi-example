# The perspective object image of every test run is empty

> **Type**: Bug Analysis
> **Domain**: hi-mcp-testing — the run script (`run-hi-mcp-prompt.js`) that drives the example page in Playwright Chromium and stores `getExternalObjectSnapshot()`; the planner's object-only perspective render it triggers
> **Trigger**: "test the mcp" — every `perspective-object-image.png` of every run of every session under `.temp/result/` is empty
> **Date**: 2026-10-03
> **Author**: AI Assistant
> **Status**: Fixed
> **Branch**: `fix/empty-perspective-object-image`

---

## Symptom

Every run of the MCP test suite stores four images of the plan, three of them fine and one empty:

| File | Content | Result |
|---|---|---|
| `top-image.png` | the whole plan, top view | fine (1024 × 936, 92.8 % opaque) |
| `top-object-image.png` | the HI objects only, top view | fine (143 × 380 crop of the kitchen, 63 % opaque) |
| `perspective-image.png` | the whole plan, perspective view | fine (1024 × 1024, 36.6 % opaque) |
| `perspective-object-image.png` | the HI objects only, perspective view | **empty** (1024 × 1024, every pixel alpha 0) |

The empty image is a valid PNG with correct dimensions, so the planner's
`getExternalObjectSnapshot({ perspectiveObjectImage: true … })` returns a string — of a frame
with nothing drawn on it. The evaluation of a run relies on the object image to see the group
alone (`hi-mcp-testing.md`, section *Evaluate*), so every run's evidence is degraded, for every
test and every model. All 48 perspective object images of the session
`mcp-test-2026-10-02_17-25-40` and all of `mcp-test-2026-10-03_18-13-02` are empty; a fresh
one-test run (`gpt-5-mini`, `three-tall-units-right-wall`) reproduced it.

The same snapshot works elsewhere: in roomle-ui (`npm run dev:all`, the
`hi-presets-example`) the planner renders a correct object perspective image.

## Investigation

**Not the model, the chat or the MCP server.** The image is written by the run script from the
snapshot it reads in the page (`run-hi-mcp-prompt.js`, `SNAPSHOT_FILES`); no tool and no model
output is involved. The snapshot's other fields (order data, plan XML, the other three images)
are complete.

**Not the planner build.** The same empty image appears against the deployed `bo-test` planner
(embedding-lib 7.1.0, which loads the live build from `www.roomle.com/t/bo-test/`) and against
the local roomle-ui dev planner (started with `npm run dev` in roomle-ui, the page opened with
`--dev`): the first snapshot after page readiness rendered a good object image on dev, the next
ones — including the run script's, minutes after page load — came back empty. So "works in
roomle-ui" is not a build difference.

**The difference of the failing context.** The working contexts (roomle-ui interactive, headed
browser) run on the machine's GPU. The run script opens the page in **headless** Playwright
Chromium. The WebGL backend each mode uses:

| Browser | WebGL renderer (`WEBGL_debug_renderer_info`) |
|---|---|
| headless, the script's `--use-angle=swiftshader` flags | ANGLE (Google, Vulkan … SwiftShader) |
| headless, **no** flags | ANGLE (Google, Vulkan … SwiftShader) |
| headless, `--enable-gpu` | **ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max)** |
| headed | ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max) |

Headless Chromium falls back to SwiftShader (software GL) with *and* without the script's
explicit flags. Under SwiftShader the object-only perspective render draws an empty frame; on
the real GPU the identical snapshot renders the kitchen.

**What the broken render does — instrumentation.** Hooks inside the planner iframe (the page
embeds the planner cross-origin; `window.instance.extended` is only a message-forwarding
facade, the planner is `window.RoomlePlanner` in the iframe) logged every render of a
snapshot call. In the broken case, everything the render receives is correct:

- the camera is a `PerspectiveCamera` placed at the group: position `[0.12, 3.05, -5.82]` for
  target `(5, 1, -3)` — exactly what `placeCameraForPerspectiveImage` computes (fov 30,
  `far` 1000, `near` 0.76, `aspect` 1);
- the projection matrix has no NaN;
- the group container is visible after `hideAllExceptRuntimeIds`, its ~106 meshes on layers
  4–6, and the camera's layer mask `-100101100101` covers them;
- `RoomleWebGLRenderer.render()` runs synchronously —
  `render(scene, camera)` → `renderer.domElement.toDataURL()` happen in the same tick, no
  race with the render loop;
- the frame read back is still 100 % transparent (0 of 1,048,576 pixels opaque).

One snapshot call runs four renders in order — top, object-top, perspective, object-perspective —
and only the last one is empty, every time, while the three before it draw.

**What makes the object perspective render different from the working ones.** Of the four, it
is the only one that combines a camera **cloned from the live 3D camera** (the top renders
construct a fresh `OrthographicCamera` with `layers.enableAll()`, the full-scene perspective
does not isolate the scene), scene **isolation** (`hideAllExceptRuntimeIds`) and the
front-view **rotation** (`plan.getRotationForFrontView`). Each of the three was neutralized in
the hooked headless page:

| Mutation (applied in the hook, before the draw) | Result |
|---|---|
| none (baseline) | empty |
| `rotationY` removed | empty |
| `hideAllExceptRuntimeIds` skipped (whole scene visible) | empty |
| both of the above | empty |
| `setGroundShadow` calls skipped | empty |
| `near` 0.01 / `far` 100000 | empty |
| camera pose forced to the *working* full-scene vantage (same scene, same renderer) | **empty** |

So it is not the far plane, not the projection, not the isolation, not the rotation, not the
camera pose — the same call with all of those neutralized still draws nothing under SwiftShader,
while the full-scene perspective render moments earlier, at the same pose, drew a million
pixels. The frame is dropped inside the roomle scene renderer's per-call pipeline under
SwiftShader; that internal mechanism was not observable from the page hooks and remains
unidentified. It does not occur on GPU, so it does not affect any interactive user.

**The GPU as the fix.** A headed Playwright run of the same page rendered a correct
`perspectiveObjectImage` — and repeated snapshots stayed correct (every one of three
consecutive full snapshot calls, ~2 MB each, where the headless runs produce the 32 KB empty
signature). Headless Chromium can use the real GPU when asked: `--enable-gpu` is enough (the
`--use-angle=metal`/`--ignore-gpu-blocklist` combinations and the installed `chrome` channel
also work).

## Root cause

`run-hi-mcp-prompt.js` opened the page in headless Chromium whose WebGL runs on SwiftShader
(`CHROMIUM_ARGS` even forced it explicitly — a leftover default from the script's first
commit, `8f2c442`). Under SwiftShader the planner's object-only perspective render returns an
empty frame, so `getExternalObjectSnapshot().perspectiveObjectImage` — the only snapshot image
produced by that render path — is a fully transparent PNG. Every other render of the snapshot
works under SwiftShader, which is why only this one image is empty. The planner itself is
healthy: on the real GPU the identical snapshot renders the group correctly.

The SwiftShader-internal reason why exactly this render path drops its frame is the one open
question of this analysis; it belongs to the roomle scene renderer, not to this repository.

## Fix

*Implemented on `fix/empty-perspective-object-image`, verified.*

`CHROMIUM_ARGS` in `.agents/scripts/run-hi-mcp-prompt.js` is `['--enable-gpu']` instead of
forcing `--use-angle=swiftshader` / `--enable-unsafe-swiftshader`: headless Chromium then uses
the real GPU (ANGLE Metal on macOS), where the object perspective render works. A machine
without a GPU falls back to software rendering as before — no worse than the old state. The
run script is the only place that renders the page headless; the runner passes its launches
through to it.

## Validation

The one-test run of the skill (`gpt-5-mini`, `three-tall-units-right-wall`, session
`mcp-test-2026-10-03_19-19-16-empty-object-image`):

| | swiftshader flags (before) | `--ignore-gpu-blocklist` only | `--enable-gpu` (after) |
|---|---|---|---|
| `perspective-object-image.png` | empty (0 opaque px) | empty (0 opaque px) | **444,925 opaque px (42.4 %), the kitchen, bbox x 174-820 y 113-938** |
| the other three images | fine | fine | fine |
| run exit code / plan snapshot | 0 / `ps_qtqqw1r…` | 0 / `ps_qtykuf…` | 0 / `ps_qtzgvxj…` |

The report images of the GPU-backed runs render the group; the evaluation can rely on
`perspective-object-image.png` there. On a machine without a GPU, headless Chromium falls back
to SwiftShader and the image stays empty until the planner defect is fixed
([mcp-test-infrastructure-issues.md](../backlog/mcp-test-infrastructure-issues.md), issue 1) —
the skill names a GPU as a prerequisite for this reason.
