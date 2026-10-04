# Refactoring Analysis: The object perspective image in `get-plan-images`

> **Type**: Refactoring Analysis
> **Domain**: hi-mcp (`get-plan-images` executor and registration); the planner's `getExternalObjectSnapshot` renders (roomle-ui `planner-core`, read only)
> **Trigger**: "`get-plan-images` returns the `perspectiveImage`. I don't think this is the right approach, because in that image the group might just be visible from the back or might even be covered by other objects. For the agent it would be more helpful to get the `perspectiveObjectImage` instead. The `topImage` is fine, as it shows an overview about the complete plan." Analyse the request and consider whether it makes sense.
> **Date**: 2026-10-04
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `refactor/object-image-in-get-plan-images` (from `master`)

## Verdict

The request makes sense, and the replacement is the right scope: `get-plan-images` should return
the **object perspective image** (the HI groups alone, seen from their front, nothing else drawn)
and the **top view of the whole plan**, instead of the plan perspective and the top view.

- The agent calls the tool to check what it built. The plan perspective is a shot of the whole
  room from a **fixed world angle** — the camera always stands above the room's front left corner —
  so a group's visibility depends on which wall it stands against, and anything between the camera
  and the group hides it. The object perspective is framed on the HI groups, turned to face their
  fronts, with the room and every other object hidden.
- The top view already carries the room context — where the group stands, its footprint, the gap to
  a wall, a group outside the room. The pair *group view + plan top view* covers "what" and "where";
  the plan perspective adds nothing the agent acts on.
- Same cost: two images per call, and the snapshot renders one perspective frame either way.
- Four limits, none a blocker (§3): all HI groups share one frame and one front direction, the
  group view has a transparent background, it is empty under software GL (a known planner defect),
  and the planner API has no per-group render.

## 1. What the tool does today

The executor requests the two images and the registration turns them into MCP image content, the
perspective first:

- [`tool-executors.ts:1869-1878`](../../hi-mcp/hi-mcp-poc-json/tool-executors.ts#L1869-L1878) —
  `getExternalObjectSnapshot({ perspectiveImage: true, topImage: true })`, returns
  `{ perspectiveImage, topImage }`.
- [`hi-mcp-server.ts:487-516`](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L487-L516) — the
  description ("Renders the current plan and returns a perspective image and a top-view image, so the
  plan can be inspected visually …"), the data-URL stripping, `{ error: 'No images available' }`
  when both are missing.

### How the planner renders the two perspectives

Both come from the same method of the planner (roomle-ui, `planner-core`):
`getExternalObjectSnapshot` ([`roomle-planner.ts:1708-1818`](../../../roomle-ui/packages/web-sdk/packages/planner-core/src/roomle-planner.ts#L1708-L1818))
renders the top view, the object top view, then the plan perspective, then the object perspective,
each through `_preparePerspectiveImage` / `prepareTopImage` of the scene manager
([`planner-scene-manager.ts:3256-3330`](../../../roomle-ui/packages/web-sdk/packages/planner-core/src/webgl/planner-scene-manager.ts#L3256-L3330)).

| | `perspectiveImage` (today) | `perspectiveObjectImage` (proposed) |
|---|---|---|
| Camera target | bounding box of the **whole plan** (`getBounds()`) | bounding box of the **HI objects** (`getBoundingBoxFromRuntimeIds`) |
| Yaw | fixed: −30° in world space (`angleY = -30 + rotationY`, `rotationY` 0; [`image-renderer.ts:234`](../../../roomle-ui/packages/web-sdk/packages/common-core/src/webgl/image-renderer.ts#L234)) | −30° **relative to the fronts**: `rotationY = plan.getRotationForFrontView(all HI runtime ids)` |
| Pitch, distance, fov | 20° from above, 2 × the target's diagonal, fov 30 (`placeCameraForPerspectiveImage`, [`image-renderer.ts:319-337`](../../../roomle-ui/packages/web-sdk/packages/common-core/src/webgl/image-renderer.ts#L319-L337)) | the same |
| Scene | the whole plan; the walls facing the camera and the ceiling are hidden (`hideWallsBasedOnCamera`) | `hideAllExceptRuntimeIds` ([`plan-view-model.ts:1165`](../../../roomle-ui/packages/web-sdk/packages/planner-core/src/view-model/plan-view-model.ts#L1165)): floor, ceiling, walls, construction, measurement lines and every non-HI object hidden |
| Background | the scene background | transparent (`LAYER.BACKGROUND` disabled, nothing else drawn) |
| Objects | everything in the plan | **all** HI groups of the plan (`_getExternalObjectGroupsInPlan` → `externalObjectRuntimeIds`, [`roomle-planner.ts:1871-1900`](../../../roomle-ui/packages/web-sdk/packages/planner-core/src/roomle-planner.ts#L1871-L1900)) |
| Without HI groups | rendered | not rendered (`validObjectExport` false → `undefined`) |

The front direction comes from the kernel: `calculateRotationForFrontalViewFromDockingVectors`
([RoomleCore `plan-geometry.cpp:2934-2960`](../../../RoomleCore/src/planner/geometry/plan-geometry.cpp#L2934-L2960))
sums the normals of the **back** docking vectors of all given objects and returns the angle of that
sum — the direction the fronts face. The camera then looks at the fronts, still 30° off-axis and 20°
from above, framed on the groups.

## 2. Why the plan perspective is the wrong image for the agent

**The vantage is fixed.** Yaw −30° about the plan's centre puts the camera above the **front left
corner** of the room (in the wall terms of D12: the corner of the `left` and the `bottom` wall),
looking at the `top` and the `right` wall. So:

| Group against the … wall | How the plan perspective shows it |
|---|---|
| `top` (back), `right` | from the front — fine |
| `left` | from the side at a grazing angle — the fronts are a thin strip, the worktop is what is visible |
| `bottom` (front) | from **behind** — the front wall is hidden for the camera, the back panels face it |

Evidence from the stored test runs (`.temp/result/mcp-test-2026-10-03_18-13-02/mistral-large-latest`):
in run 06 (*kitchen on the left-hand wall*) the kitchen sits at the left edge of
`perspective-image.png`, foreshortened, the wall units cut by the frame, the fronts barely readable;
`top-object-image.png` of the same run shows every unit, the sink and the hob. In run 01 the group
takes about a sixth of the frame's width — the frame is sized for the room, not for the group.

**Other objects hide it.** Everything in the plan is drawn; a wall not facing the camera, a door, or
non-HI furniture in front of the group covers it. The HI tools cannot move those objects.

**What each image is for.** The top view answers *where*: the position against the walls, the
footprint, an L shape, a gap, a group outside the room. The object perspective answers *what*: the
order of the units as seen from the front, tall vs. base vs. wall units and the hang of the wall
units, appliances (hob, sink, oven, hood), fronts, materials and colours — exactly what the
authoring produces and what the test evaluation reads from the same render
([`hi-mcp-testing.md`](../skills/hi-mcp-testing.md): "the group alone — its fronts, appliances and
materials, without the room"). The plan perspective answers neither well.

## 3. Does it make sense? — the limits of the object image

| Limit | Effect | Handling |
|---|---|---|
| **All HI groups in one frame, one front direction.** The kernel sums the back normals of every HI object. Two groups on walls at a right angle give a diagonal view with both seen from the front-side; groups on opposite walls cancel to rotation 0 and one of them is seen from behind. The planner's request type has no per-group option ([`external-object-api.ts:181-189`](../../../roomle-ui/packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts#L181-L189)) | fine for one kitchen — the normal case, the rules forbid splitting a kitchen into groups | accept; a per-group render is a roomle-ui feature (the scene manager has `preparePerspectiveImageOf(runtimeId)`, the external object API does not expose it) — open item, not part of this change |
| **No room in the perspective.** A collision with a wall or a group outside the room is not visible in 3D | the top view shows it as footprint vs. walls | accept — this is why the top view stays |
| **Transparent background.** A model's image pipeline composites the alpha onto black or white; dark fronts on black lose contrast | unknown until seen by a model; the test evaluation reads the same PNG without trouble | verify in the live check with Claude and Mistral (§6); `preserveSceneBackground` exists in the renderer options but is not exposed in the snapshot request — a roomle-ui change if ever needed |
| **Empty under software GL.** Headless Chromium without a GPU renders a fully transparent frame for exactly this image ([bug analysis](../bug-analysis/empty-perspective-object-image-in-test-runs.md), [backlog issue 1](../backlog/mcp-test-infrastructure-issues.md)). A valid PNG — the server cannot tell it from a real one | interactive users render on a GPU; the test runs pass `--enable-gpu` | accept; a headless client without GPU gets a blank group view until the planner defect is fixed — say so in the docs |
| **No groups in the plan.** The planner skips the object render | the tool returns the top view alone (the content loop already skips a missing image) | the description says so |
| **Cost.** Two images as today (~1.4k tokens each for Claude at 1024 × 1024, ~1.3k for Mistral); one perspective render per snapshot either way, plus the group lookup and the rotation call | unchanged | — |

### Alternatives considered

| | Alternative | Assessment |
|---|---|---|
| A | **Replace** the plan perspective with the object perspective; two images as today | **recommended** — the smallest change that gives the agent the image it needs |
| B | Return all three images | + one image (~1.4k tokens) and one render per call for a 3D impression of the room the agent does not act on |
| C | A parameter to choose the views | flexibility nobody asked for; the agent would have to learn what to request — the default is what matters |
| D | Fall back to the plan perspective when the plan has no groups | needs a second snapshot call or three renders every time; the top view of an empty room is enough to plan into it |
| E | A text content before each image naming it, and "no groups in the plan" when the group view is missing | ~20 tokens; the two views are visually unmistakable, so the description alone carries the order. Not recommended, but cheap — **decision for the review** |

## 4. Scope — every affected location

**Code** (the pages and roomle-ui stay untouched: `getExternalObjectSnapshot` is allow-listed with
its options passed through — `MCP_PLANNER_METHODS` in [`index.html:1233`](../../minimal-hi-example/index.html#L1233),
`PLANNER_METHODS` in [`browser-bridge.ts:17`](../../hi-mcp/hi-mcp-poc-json-client/browser-bridge.ts#L17),
[`planner-api.ts:49-54`](../../hi-mcp/hi-mcp-poc-json/planner-api.ts#L49-L54) takes any boolean
options; the ligna-store does not reference the tool's result):

| File | Change |
|---|---|
| [`tool-executors.ts:1869-1878`](../../hi-mcp/hi-mcp-poc-json/tool-executors.ts#L1869-L1878) | request `perspectiveObjectImage` instead of `perspectiveImage`, return `{ perspectiveObjectImage, topImage }` |
| [`hi-mcp-server.ts:487-516`](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L487-L516) | the description (§5), the result type, the content order (group view first, top view second) |

**Tests:**

| File | Change |
|---|---|
| [`tool-executors.test.ts:2475-2494`](../../hi-mcp/hi-mcp-poc-json/tests/tool-executors.test.ts#L2475-L2494) | the mock snapshot and the expected call `{ perspectiveObjectImage: true, topImage: true }` |
| [`hi-mcp-server.test.ts:456-470`](../../hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts#L456-L470) | the mock snapshot keys; **new case**: a snapshot without `perspectiveObjectImage` (no groups) returns one image content |
| [`hi-mcp-chat/tests/tool-result-images.test.ts`](../../hi-mcp/hi-mcp-chat/tests/tool-result-images.test.ts) | fixture names only — no change |

**Documentation, in the same change:**

| File | Change |
|---|---|
| [`hi-mcp-behaviour.md`](../../hi-mcp/docs/hi-mcp-behaviour.md) | §3 *Information for the agent*: new **D36** (§5); §5.3 result format (line 243); the §6 results table ("two images", line 285); §6 *get-price, get-order-data, get-plan-images* (line 398) |
| [`minimal-hi-example/docs/hi-mcp-server.md:512-520`](../../minimal-hi-example/docs/hi-mcp-server.md#L512-L520) | the tool reference entry |
| [`hi-mcp-poc-json/README.md:501-506`](../../hi-mcp/hi-mcp-poc-json/README.md#L501-L506) | the tool reference entry |
| [`.agents/skills/hi-mcp-tools.md:39, 220-226`](../skills/hi-mcp-tools.md) | the tool table and the reference block |
| [`.github/copilot-instructions.md:452`](../../.github/copilot-instructions.md#L452) | "(a perspective and a top view)" |
| [`minimal-hi-example/docs/ai-chat.md:219`](../../minimal-hi-example/docs/ai-chat.md#L219), [`hi-mcp-testing.md`](../skills/hi-mcp-testing.md) | unchanged — "its two renders" stays true; the test runs store all four snapshot images themselves |

## 5. Target shape

```ts
'get-plan-images': async (roomDesignerApi) => {
  const snapshot = await roomDesignerApi.extended.getExternalObjectSnapshot({
    perspectiveObjectImage: true,
    topImage: true,
  });
  return {
    perspectiveObjectImage: snapshot?.perspectiveObjectImage,
    topImage: snapshot?.topImage,
  };
},
```

The description, replacing the current one:

> Renders two images of the current plan: first the HI groups alone, seen from their front without
> the room, so every unit, appliance and front is visible and nothing covers it; second a top view of
> the whole plan that shows where the groups stand. The top view's orientation matches the wall side
> labels of get-plan-context: a wall with side 'right' is at the right edge of the top image, 'top'
> at the upper edge. Without groups in the plan only the top view is returned.

The decision for `hi-mcp-behaviour.md` §3:

> **D36** — `get-plan-images` shows the agent the HI groups alone, from their front, plus the top
> view of the plan. The plan perspective is not returned: its camera stands at a fixed world angle,
> so a group may be seen from the side or from behind, or be hidden by other objects; the top view
> carries the room context. Source: user, 2026-10-04 (this analysis). State: planned.

## 6. Tests and expected output changes

- **Unit tests** (`npm test` at the `hi-mcp` root): the two adapted tests of §4 and the new
  no-groups case pass; everything else unchanged.
- **Output change**: `content[0]` of `get-plan-images` is the group view (transparent PNG, the
  groups framed from the front) instead of the plan perspective; `content[1]` the top view as
  today. On a plan without HI groups the result has one image content.
- **Live check** (the headless MCP check of the memory notes, with `--enable-gpu` — without a GPU
  the group view is blank, §3): a kitchen on the `left` wall → the first image shows the kitchen
  from the front with every unit, where the plan perspective showed it from the side. An empty plan
  → one image.
- **Model check**: "call get-plan-images and describe in two sentences what you see in each image"
  through the chat with Claude and with Mistral Large (as in the
  [Mistral image analysis](../bug-analysis/plan-images-sent-as-text-to-mistral.md)) — confirms the
  models read the transparent PNG and the description's order.

## 7. Risks and open items

- The readability of the transparent group view for the models is the one unverified point — the
  model check of §6 answers it before the change is closed out.
- Several HI groups on different walls share one frame and one front direction; a per-group render
  needs the planner's external object API to expose it (roomle-ui). Note it as a follow-up if the
  live check shows it matters.
- The empty frame under software GL remains a planner defect (backlog issue 1); the docs name the
  GPU prerequisite for headless clients.
- The tool keeps its name: one of its two images is now of the groups, but every client, doc and
  test prompt refers to `get-plan-images`, and renaming buys nothing for the agent.
