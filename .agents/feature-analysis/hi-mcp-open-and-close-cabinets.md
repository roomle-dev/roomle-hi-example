# HI MCP: open and close cabinets

> **Type**: Feature Analysis\
> **Status**: Open\
> **Date**: 2026-10-20\
> **Base**: roomle-hi-example `master` at `d6ce41b`; roomle-ui `feat/interior-fittings` at `eb39f9b22` (the snapshot and open/close code is the same on `master`); RoomleCore `master` at `f744024ca`\
> **Source**: [RML-18232](https://roomle.atlassian.net/browse/RML-18232)

## Affected repositories

| Repository | Required work |
|---|---|
| **roomle-ui — `feat/interior-fittings`** | A new optional property of `ExternalObjectSnapshotRequest` that keeps open doors and drawers open in the snapshot (default unchanged). Two new group operations, `open-or-close-group` and `open-or-close-article`, implemented in `hi-tools.ts` and reached through `externalObjectGroupOperation`, with a tool command each. `openOrCloseGeometryOfExternalObject` opens a single root module, as its documentation already promises. Unit tests and the embedding documentation. |
| **HI MCP — `roomle-hi-example/hi-mcp/hi-mcp-server`** | Two new tools forwarded with `inPlanner`; `get-plan-images` always requests the snapshot with the new property; tool descriptions and the served rules say how to look inside a cabinet. Tests and living reference. |
| **ligna-store** | No code change. The page allow-list stays as it is: the tools use `externalObjectGroupOperation` and `getExternalObjectSnapshot`, which the store already relays. The store needs the roomle-ui change on the stage it loads. |
| **RoomleCore** | No change. The open/close state is view state in roomle-ui; the kernel only supplies the animations and the ids. |

## What was asked and why

The ticket asks for two MCP tools, one that opens and closes the doors and drawers of a group and one
that does it for a single article (root module), with the same effect as the open/close button of
the flying menu. It also asks for a new property of `ExternalObjectSnapshotRequest` so that
`getExternalObjectSnapshot` can render the objects as they are. The API's default must not change,
and the MCP server always uses the new property.

The reason is interior design: when an agent adds, moves or deletes sub-articles (interior
fittings), it inspects the result with `get-plan-images`. With the doors closed, the fittings
cannot be seen.

## How it works today

### The snapshot always closes open geometry

`RoomlePlanner.getExternalObjectSnapshot` (roomle-ui
`packages/web-sdk/packages/planner-core/src/roomle-planner.ts:1735`) defines
`prepareScene = () => this._sceneManager.viewModel.closeOpenGeometry()` at line 1738 and hands it to
every image and to the object GLB: `prepareTopImage` (lines 1771, 1774), `createExportGLB`
(line 1791) and `preparePerspectiveImage` (lines 1801, 1804). `saveExternalObjectSnapshot` does the
same at line 1847.

`closeOpenGeometry` (`common-core/src/view-model/configurator-view-model.ts:265`) calls
`closeOpenGeometryOfComponents` (`configurator-core/src/utils/animation/animation-helper.ts:175`):
it collects every component whose animation value map holds `openClose:open`, sets it to `close`
without animation, and returns a function that opens them again. The renderer calls the
preparation right before it renders one frame and the restore in its `finally`
(`common-core/src/webgl/image-renderer.ts:628`, `_renderSingleFrame`); the GLB export does the same
around its scene clone (`common-core/src/utils/export-helpers.ts:63`). The plan itself is therefore
not changed by a snapshot — only the rendered frame shows closed doors and drawers.

`ExternalObjectSnapshotRequest` (`homag-intelligence/src/external-object-api.ts:247`) has one
boolean per output (`planXML`, `objectGlb`, the four images) plus `orderData`; nothing controls the
preparation.

The MCP server asks for the perspective and the top image (`get-plan-images`,
`hi-mcp/hi-mcp-server/tool-executors.ts:562`) and for the order data (`get-order-data`, line 555).
The order data is not rendered and is not affected.

### The open/close button of the flying menu

`FlyingMenu.vue` (roomle-ui `src/common/components/flying-menu/FlyingMenu.vue:84`) shows the button
when the `openCloseAnimation` feature flag is set, a configuration is selected and the selection has
an open/close animation (line 364). The click runs `toggleOpenCloseAnimation`
(`src/common/composables/use-open-close-anim.ts:20`): in the planner it calls
`setAnimationValueOfPlanObject('animation:openClose', 'open' | 'close')`
(`src/configurator/business-logic/sdk-connector.ts:1121`,
`web-sdk/packages/configurator-core/src/roomle-configurator.ts:1501`) on the selected plan object.

`changePlanObjectParameter` intercepts every `animation:` key before it reaches the kernel
(`common-core/src/configurator-kernel-access.ts:815`): it calls `changeAnimationValue`, which sets
the value in the component's `AnimationValueMap` and animates the meshes. The level comes from
`_getAnimationLevelForObject` (`planner-core/src/services/planner-kernel-access.ts:1678`):

- a selected **group** has no child-object level → `ANIMATION_LEVEL.OBJECT`: every component of the
  group, recursively;
- a selected **root module** (the group is in child-object mode) → `ANIMATION_LEVEL.OBJECT_COMPONENT`:
  the recursion in `changeObjectAnimationValueAndAnimate` (`animation-helper.ts:133`) stops at every
  component that `isAnimationRootComponent` reports — another root module or another child object
  (RoomleCore `src/planner/view/plan-model-view-helper.cpp:1210`).

The open/close state is view state: it lives in the `AnimationValueMap` of the three.js components,
is not a kernel parameter, is not written to the plan XML and is not part of the planner's undo
history. The planner override of `changePlanObjectParameter` wraps the change in
`applyKernelParameterChange` (`planner-kernel-access.ts:1730`), an interaction of the plan
interaction manager.

### The existing planner API: `openOrCloseGeometryOfExternalObject`

The HI API already has a method for this
(`external-object-api.ts:479`): it opens or closes "the group or the single root module with the ID
groupIdOrRootModuleId", optionally one sub-module, with or without animation. The glue logic reaches
it through `designerRequests.openCloseGroup` (`homag-intelligence/src/api.ts:96`).

The implementation (`roomle-planner.ts:3130`) resolves the id with
`getExternalObjectComponent(id, '')` and animates the `configurationRuntimeId` of the result with
`ANIMATION_LEVEL.OBJECT`; `subModuleId` is ignored. It needs no selection, no feature flag and no
interaction.

For a **group id** this is the flying-menu toggle of a selected group: the group's plan object,
every component.

For a **root module id** it is not. RoomleCore resolves the id to the plan object of the root module
(`ModuleGroupConfiguratorPlugIn::fillObjectComponent`,
`src/planner/configurable/external/external-configurator-plug-in.cpp:511`, `findPlanObject` at
line 190). That plan object is the root module's own child object only when the group is in
child-object mode and the root module is not the group's first root module
(`ModuleGroupConfigurator::getEntityId`, `src/configurator/external/external-module-group-configurator.cpp:94`);
otherwise it is the group's plan object. Together with `ANIMATION_LEVEL.OBJECT`, which does not stop
at other root modules, a root module id opens the whole group — or, in child-object mode, the root
module and every root module below it in the component tree. The component of the root module
itself is in the same result as `componentRuntimeId` (`external-configurator-plug-in.cpp:548`).

### How a tool reaches roomle-ui

The plan-changing tools of the MCP server are one planner call each,
`externalObjectGroupOperation(<tool name>, <arguments>)` (D71 of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#3-decisions)), forwarded with
`inPlanner` (`tool-executors.ts:361`). In roomle-ui, `RoomlePlanner.externalObjectGroupOperation`
(`roomle-planner.ts:3223`) runs the call inside `runToolCall`
(`plan-interaction-manager.ts:362`), which makes one undo step only when the call loaded or changed
something. `HiToolsImplementation.executeGroupOperation` (`homag-intelligence/src/hi-tools.ts:303`)
runs a tool command (`HI_TOOL_COMMANDS`, `hi-tool-commands.ts:342`) or a group operation
(`runGroupOperation`, `hi-plan-context.ts:1683`, handlers at line 1571) with the HI tools as
`HiGroupOperations` (`hi-plan-context.ts:1291`). The interior-fitting tools are the pattern: a tool
command that forwards to the group operation of the same name, which `HiToolsImplementation` performs
(`editInterior`, `hi-tools.ts:360`).

`runToolCommand` counts a planner step for every group operation whose result does not say
`changed: false` (`hi-tool-commands.ts:1435`) and reports `historySteps`; the MCP server records a
tool call for its `undo` when the steps are more than 0 (`countingPlannerApi` and `recorded`,
`tool-executors.ts:138` and 165).

## The gap

1. The MCP server cannot ask for images with open doors: the snapshot request has no property for it.
2. No tool opens or closes a group or an article. The planner method exists but is not on the page
   allow-lists, and D71 keeps the tools at six planner methods.
3. The planner method opens a group correctly but not a single root module.

## Proposed change

### roomle-ui — the snapshot

A new optional boolean of `ExternalObjectSnapshotRequest`, `keepOpenGeometry` (decision 1). When it
is `true`, `getExternalObjectSnapshot` passes no `prepareScene`: the images and the object GLB show
the doors and drawers as they are in the planner. When it is missing or `false`, everything stays as
it is today. `saveExternalObjectSnapshot` and the call without `requestData` are unchanged.

The change is the definition of `prepareScene` at `roomle-planner.ts:1738`; the outputs keep their
code. Tests in `planner-core/__tests__/roomle-planner.ts`, `describe('getExternalObjectSnapshot')`
next to `defers geometry preparation to each requested asset` (line 2019): with `keepOpenGeometry`
no requested image receives a `prepareScene` and `closeOpenGeometry` is not called; without it the
existing tests hold.

### roomle-ui — the operations in `hi-tools.ts`

Two group operations in `HI_GROUP_OPERATION` with their payloads and handlers in
`hi-plan-context.ts`, and the same two names as tool commands in `HI_TOOL_COMMAND` /
`HI_TOOL_COMMANDS` that forward to them, as the interior-fitting commands do:

| Command | Payload | Performs |
|---|---|---|
| `open-or-close-group` | `groupId`, `open` | every door and drawer of the group |
| `open-or-close-article` | `rootModuleId`, `open` | every door and drawer of that root module, none of its neighbours |

`HiToolsImplementation` implements both as two new `HiGroupOperations` methods. They check the id
with `_requireGroupsInScene` / `_requireRootModule` (`hi-tools.ts:1091`, 1077) — an unknown id
rejects, as in every other operation — and call
`this._glueLogic.designerRequests.openCloseGroup(id, null, open, false)` (decision 2).

The outcome is `groupIds: []`, `removedGroupIds: []` and **`changed: false`**. `changed: false` is
required, not cosmetic: without it `runToolCommand` reports one history step, the MCP server records
the call for its `undo`, and the agent's next `undo` would call the planner's `undo()` once and
revert the plan change before it. With `changed: false`, `runToolCall` makes no undo step and the
server records nothing.

When the target has no open/close animation, the planner method does nothing and says nothing. The
operation tells the agent in `corrections` that the group or root module has no doors or drawers that
open — feedback, not a guard (step 4 of [Guards Are a Last
Resort](../../AGENTS.md#guards-are-a-last-resort)). For that, `openOrCloseGeometryOfExternalObject`
and `RoomDesignerRequests.openCloseGroup` answer whether they switched anything (decision 4).

### roomle-ui — a single root module

`openOrCloseGeometryOfExternalObject` keeps its parameters and its behaviour for a group id. For a
root module id it animates the root module's component (`componentRuntimeId` of
`getExternalObjectComponent(rootModuleId, '')`) with `ANIMATION_LEVEL.OBJECT_COMPONENT`, the level
the flying menu uses for a selected root module. This makes the method do what its documentation
says, independent of the selection and of child-object mode, and needs no new planner method.
`subModuleId` stays ignored; a sub-module target is not part of the ticket.

RoomleCore resolves a group id to the group's first root module
(`ModuleGroupConfigurator::getGroupAndModules`, `external-module-group-configurator.cpp`), so the
object component of a group id and of its first root module are the same. The method tells them
apart by comparing the id it was given with the component's `externalObjectGroupId`.

The code trace of the root-module case is static. The first test of the implementation pins it in
the planner with a group of at least three root modules, in and out of child-object mode: opening the
first, a middle and the last root module opens that one only, opening the group opens all.

### HI MCP server

- `tool-executors.ts`: `'open-or-close-group': inPlanner('open-or-close-group')`,
  `'open-or-close-article': inPlanner('open-or-close-article')`. `get-plan-images` requests
  `{ perspectiveImage: true, topImage: true, keepOpenGeometry: true }`.
- `hi-mcp-server.ts`: two tool registrations with zod schemas (`groupId` or `rootModuleId`, the id
  `get-plan-context` shows, and `open: boolean`). The descriptions say what the tool does and that
  the state is a view of the planner: it is not saved, not part of `undo` and does not change the
  price or the order.
- The served text says how to succeed, in one place each: the `get-plan-images` description says that
  the images show doors and drawers as they are, and the interior-fitting descriptions and rule 4
  (`hi-mcp-server.ts:89`) say: to look inside a cabinet, open it with `open-or-close-article` (a whole
  group with `open-or-close-group`) right before `get-plan-images`.
- No change to `planner-api.ts` or to the page allow-lists (`MCP_PLANNER_METHODS` in
  `minimal-hi-example/index.html`, `PLANNER_METHODS` in `hi-mcp-client/browser-bridge.ts`, the
  ligna-store copy): `getExternalObjectSnapshot` takes the options object as it is.
- Tests: the forwarders in `tests/tool-executors.test.ts` (`it.each(toolCalls)`), the snapshot
  options of `get-plan-images`, and that a call answered with `historySteps: 0` leaves no undo record.

## Decisions

Confirmed by the user on 2026-10-20.

1. **The name of the snapshot property** is `keepOpenGeometry`, in the words of `closeOpenGeometry`
   it switches off.
2. **The operations switch at once** (`animate: false`), unlike the flying-menu button, so a
   `get-plan-images` call right after the tool — also one the agent sends in the same step — never
   renders a door halfway open.
3. **The property covers the images and the object GLB**, everything `prepareScene` covers today, so
   the snapshot is either as it is or closed. The MCP server does not request the GLB.
4. **A target without doors or drawers is named in `corrections`.** `openOrCloseGeometryOfExternalObject`
   and `RoomDesignerRequests.openCloseGroup` return whether they switched anything; their return
   type changes from `void` to `boolean`, which existing callers ignore.

## Alternatives considered

- **`openOrCloseGeometryOfExternalObject` as a seventh planner method of the MCP tools.** Rejected by
  D71: a new method goes into every page allow-list, the ligna-store copy included, and the id
  checks and the feedback would move into the MCP server.
- **The flying-menu path, `setAnimationValueOfPlanObject`.** Rejected: it acts on the configurator
  context of the current selection, so the tool would have to select the group or switch it into
  child-object mode first — a visible change of the user's selection — and it runs inside an
  interaction of the plan interaction manager, the mechanism behind the undo steps and history
  events the MCP server watches. The planner method reaches the same `changeAnimationValue` without
  either.
- **One tool with an optional `rootModuleId`.** Rejected: the ticket asks for two tools, and one tool
  per target is one recipe per task for the agent.
- **A toggle like the button.** Rejected: the agent does not see the current state; an explicit
  `open` makes every call give the same result.
- **Restoring the open state after a group edit inside the interior-fitting commands.** Not proposed:
  the served rule opens the cabinet right before the images, which works whether or not a reload of
  the group closes it (see verification).

## Required verification

- The root-module test of `openOrCloseGeometryOfExternalObject` above, in the planner.
- A live run with the HI presets example: open an article, `get-plan-images` shows it open, the
  planner's own view is unchanged afterwards, `get-order-data` is unchanged, the planner's undo
  history has no new step, and the MCP `undo` still reverts the last plan change.
- Live: open an article, add an interior fitting to it, render. Whether the reload of the group
  keeps the doors open decides only whether the agent sees them open without calling the tool again;
  the served rule is written for either outcome. The view keeps a component and its
  `AnimationValueMap` as long as the kernel keeps its runtime id (`Editor3dComponentCreated`,
  `configurator-view-model.ts:889`).

## Code and documents the work would touch

**roomle-ui:** `homag-intelligence/src/external-object-api.ts` (request property and its JSDoc),
`planner-core/src/roomle-planner.ts` (`getExternalObjectSnapshot`,
`openOrCloseGeometryOfExternalObject`), `homag-intelligence/src/hi-plan-context.ts` (operations,
payloads, handlers, tool command names), `homag-intelligence/src/hi-tool-commands.ts` (forwarders),
`homag-intelligence/src/hi-tools.ts` (the two operations); tests in
`planner-core/__tests__/roomle-planner.ts`, `homag-intelligence/__tests__/hi-tools-test.ts` and
`homag-intelligence/__tests__/hi-tool-commands/`; documentation in
`packages/embedding-lib/docs/homag-intelligence-embedding.md` (`getExternalObjectSnapshot`, the group
operations) and `.agents/homag-intelligence.md`.

**roomle-hi-example:** `hi-mcp/hi-mcp-server/tool-executors.ts`, `hi-mcp/hi-mcp-server/hi-mcp-server.ts`,
their tests; `docs/hi-mcp-behaviour.md` (a decision row in §3, the tools in §6, the feedback in §8),
`docs/hi-mcp-server.md` (tool reference), `.agents/skills/hi-mcp-tools.md`, `.agents/context/`.
