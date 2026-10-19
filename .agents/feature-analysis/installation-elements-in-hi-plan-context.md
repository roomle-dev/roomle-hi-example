# Installation elements in the HI plan context

> **Type**: Feature Analysis\
> **Status**: Implemented\
> **Date**: 2026-10-19\
> **Base**: roomle-hi-example `master` at `1e7f6d31`; roomle-ui `feat/water-connection` at `07feaafa2`; RoomleCore `master` at `7bcda8c89`\
> **Source**: [RML-18023, comment 156276](https://roomle.atlassian.net/browse/RML-18023?focusedCommentId=156276)

## Affected repositories

| Repository | Required work |
|---|---|
| **roomle-ui — `feat/water-connection`** | Classify supply connections by their kernel level, exclude them from HI obstacles, and assemble a separate installation-elements section. Extend types, context tests and embedding documentation. |
| **HI MCP — `roomle-hi-example/hi-mcp/hi-mcp-server`** | Request and return the new section by default and explicitly; describe its meaning in the tool list and session instructions. Extend tests and living reference. This is the HI MCP implementation present in this workspace; there is no separate `roomle-hi-mcp` checkout here. |
| **RoomleCore** | **No new production API or obstacle-map change is required for this comment.** Object enumeration, level and position already cross the WASM boundary. The existing water level and supply-pair collision policy are prerequisites for the complete planner experience. |

## Request and evidence

The latest comment asks for electric plugs and water connections to leave `HiPlanContext.obstacles`
and appear in a separate list. Each entry has type `ElectricPlug` or `WaterConnection` and a
position, with no size. Exposing these facts prepares future planning; choosing cabinet positions
from connections, moving services and validating installations are separate features.

The comment's screenshot and snapshot `ps_sa6laqmrrczr6wmo8jfk7pdyz36omon` were downloaded and
inspected. The XML contains one power outlet, one water connection, one light switch, one door,
one window and three HI groups. The light switch is a useful negative control: it stays an
obstacle. Downloaded assets remain temporary under RoomleCore `test/resources/plans/__…`;
the screenshot and Jira/RAPI responses are in this repository's ignored `.temp/`.

Current production RAPI metadata, fetched on 2026-10-19:

| Item | Catalog level | Consequence |
|---|---|---|
| `room_designer:power_outlet_2-fold_black` | 27 | Classified as `ElectricPlug`. |
| `room_designer:water_connections` | 43 | Does not satisfy a level-28 classification without the branch's PoC override or corrected catalog data. |

The roomle-ui branch already contains commit `07feaafa2`: `planner-kernel-access.ts:637` assigns
level 28 when an item's `externalIdentifier` is `water_connections`. This existing PoC override
is relevant to testing, but does not establish the production catalog contract. Assign the wall
water items to level 28 in Rubens Admin and remove the override once that data is available.
Floor-configured water connections require the appropriate floor level, as the ticket describes.

## How the information flows today

**Core has the required facts.** `src/planner/properties/object-level.h:10` defines
`levelElectricPlug = 27` and `levelWaterConnection = 28`.
`PlanObject::getLevel()` (`src/planner/model/plan-object.cpp:942`) reads the catalog item's layer,
falling back to the stored item layer for a detached configuration. This is different from XML
`layerId`, which is 0 on both supply objects of the example. The stored catalog level lives in
`idMap.itemLayer` when present (`serializer/plan-xml-reader.cpp:751`). Classify the live object,
not XML `layerId`, component names or article ids.

Existing bindings in `interfaces/emscripten/definition/planner.json` expose:

- `Plan.getPlanObjects()` at line 3289: the plan's objects, implemented by
  `EMSProxy::getPlanObjects` in `interfaces/emscripten/planner/plannerEmscriptenInterface.h:148`.
- `PlanObject.level` at line 2196: `PlanObject::getLevel()`.
- `PlanElement.getCenter()` at line 1938: the object's measurement-box bottom centre
  (`src/planner/model/plan-object.h:166`), in kernel coordinates, Z up.
- `PlanModelViewHelper.getRootPlanObjectId()` at line 3610: ownership for child objects.

The installed roomle-ui `node_modules/roomle-core-hsc/src/embind/plannerCoreInterface.d.ts`
also declares these APIs. Core master contains `5f3b9a44c`, the supply-connection collision
feature. That pair-dependent behaviour does not remove supplies from the general exported
obstacle map: `PlanModelViewHelper::getObstacleMap()` still calls `buildExportedObstacleMap`
(`src/planner/view/plan-model-view-helper.cpp:1538`). Other consumers can still need that geometry.

**roomle-ui loses the distinction.** `RoomlePlanner._getExternalPlanObstacles()`
(`packages/web-sdk/packages/planner-core/src/roomle-planner.ts:3256`) reads the kernel obstacle map
and attaches a kind to each non-global runtime id. `_planObstacleKind()` at line 3292 distinguishes
HI groups, doors and windows; every other object becomes `object`. It never reads the level.
The main handwritten `PlanObject` interface in `packages/web-sdk/packages/typings/planner.ts:154`
also omits `level`, although the generated kernel declaration and `planner-kernel-container.ts`
include it.

`RoomDesignerApi.getPlanObstacles()` (`homag-intelligence/src/api.ts:108`) forwards this result
through `RoomDesignerRequests`. `shapeObstacles()` (`homag-intelligence/src/hi-plan-context.ts:924`)
turns every known non-group kind into an outline with a height range. `createPlanContext()` at
line 962 includes only master data, rooms, articles, groups and obstacles. Thus a supply is
presented as furniture to both the agent and the local tool commands' overlap hints
(`hi-tool-hints.ts:308,511`). Removing it only in the MCP server would leave those hints wrong.

**The MCP server does not request installation data.**
`hi-mcp/hi-mcp-server/tool-executors.ts:18-46` has fixed supported/default section lists;
`get-plan-context` at line 382 filters unknown sections before calling the planner. An explicit
`include: ["installationElements"]` currently falls back to the defaults. Results are otherwise
spread through, so a new result shaper or bridge method is unnecessary. The tool description
and include description are in `hi-mcp-server.ts:200-244`.

## Proposed contract

Add `installationElements` as an independently selectable, default section of `HiPlanContext`:

```typescript
type HiPlanInstallationElement = {
  type: 'ElectricPlug' | 'WaterConnection';
  position: [number, number, number];
};

// HiPlanContext
installationElements?: HiPlanInstallationElement[];
```

The section is `[]` when requested and no matching elements exist; it is absent when omitted
from an explicit include list. An older planner that lacks the feature leaves it absent, which
means unavailable information rather than a confirmed empty survey.

**Position recommendation:** use the live owner's `getCenter()`, converted from kernel
`{x, y, z}` to HI `[x, z, -y]`, in millimetres, with the context's existing rounding convention.
This explicitly means the measurement-box **bottom centre**, consistent with Core's object
position contract. The ticket does not define a physical pipe/socket contact point; an object's
origin, box centre and connection contact point are different quantities. Do not infer a contact
point from half its size or the nominal insertion height. If a future feature needs individual
hot/cold/drain or socket terminals, it needs a separate semantic contract.

One placed supply assembly produces one entry, including a multi-socket outlet or a water
assembly with several component children. Ownership is resolved with the existing root-object
lookup. Child obstacle ids belonging to that supply are excluded too. Hidden owners are omitted,
matching the obstacle survey. A supply hidden behind furniture remains included: occlusion is
different from the plan object's `hidden` property. Distinct supply assemblies at the same point
remain distinct entries.

Only exact levels 27 and 28 classify. Levels 43, 47, 52 and 55 do not. Classification does not
depend on finding an attached wall: points remain useful off-wall and the attachment changes
during interaction. No dimensions, outline, height range, rotation, catalog metadata or mutation
API is added to an installation entry. Runtime ids are useful internally for ownership/filtering
but are not needed in the agent's read-only list.

## Proposed changes by repository

### RoomleCore

Use the existing bindings. Keep the exported obstacle map intact: removing supplies globally
would also change other consumers and discard geometry still relevant to doors and wall-mounted
objects. No new C++ DTO, enum, generated binding or native algorithm is necessary to expose the
requested information. Use a Core build containing the existing supply behaviour when testing
dragging behind cabinets; that release dependency is separate from reading the new section.

### roomle-ui — on `feat/water-connection`

Extend the existing internal `ExternalPlanObstacles` result with the installation list.
`_getExternalPlanObstacles()` enumerates the live plan objects for level/position facts, resolves
their owners and separates supply ids from ordinary obstacles. Enumeration is independent of
obstacle segments, so an element is not lost merely because no usable outline was exported.
Keep one level-to-type mapping at this planner boundary, shared by collection and exclusion.

`createPlanContext()` fetches this existing request once when either `obstacles` or
`installationElements` is requested, then publishes only the requested sections. Installation-only
reads need no calculated HI groups, room contours or article templates. The internal request
still obtains the obstacle map; a second request API or a new mode flag is unnecessary for this
small extension. `shapeObstacles()` must never publish the supply owners or their children as
generic objects. Its group-root geometry remains as it is.

| Files under `packages/web-sdk/packages/` | Change |
|---|---|
| `planner-core/src/roomle-planner.ts` | Gather owner level/position facts and split installations from the HI obstacle input. |
| `typings/planner.ts` | Represent the already exposed read-only `PlanObject.level` where the handwritten type is used. |
| `homag-intelligence/src/external-object-api.ts` | Add the section name and optional context property; extend the internal obstacle-result type. |
| `homag-intelligence/src/hi-plan-context.ts` | Define the installation entry; share one environment read between both requested sections and publish the list. |
| `homag-intelligence/__tests__/__mocks__.ts` | Return an empty installation list with the internal obstacle fixture. |
| `homag-intelligence/src/debug-logging.ts`, `src/api.ts`, `src/glue-logic.ts` | Existing forwarding methods retain their signatures through the extended result type; no new request method is needed. |

There is no new placement algorithm in `glue-logic.ts` or the tool commands. Their existing
obstacle hints receive the corrected context automatically. Existing embedding/postMessage
transport carries the additional property without a new public method.

### HI MCP server

Add `installationElements` to `PlanContextSection`, `PLAN_CONTEXT_SECTIONS` and `DEFAULT_SECTIONS`
in `tool-executors.ts`. Pass it through unchanged. An installation-only request stays
installation-only; it needs none of the obstacle section's extra room fetch.

Update `hi-mcp-server.ts`: the tool description, include description, initialize workflow and a
short authoring sentence identify the list as existing service positions, separate from obstacle
volumes. Change `SKILL_IN_SESSION` at lines 94-99: its current blanket example that services are
unknown must distinguish supplied connection positions from service details the context does
not carry. This reaches agents that read only the tool list as well as agents that fetch skills.
The text remains library-neutral. No sink/outlet matching heuristic or installation clearance
rule is introduced. `planner-api.ts`, bridge protocol, page allow-lists, chat providers and
ligna-store need no feature-specific code change.

## Alternatives considered

| Alternative | Reason to reject |
|---|---|
| Remove supplies from Core's obstacle map | A general geometry API cannot express the pair-dependent planner policy or the HI-specific survey presentation. |
| Add a Core installation DTO and query now | Existing enumeration, level and position already suffice; this adds release and binding work without missing data to supply. |
| Filter only in MCP, or tell the agent to ignore matching objects | The planner has already erased the level, and roomle-ui's local hints would still treat supplies as blockers. |
| Recognize item ids, descriptions, component names or level 43 | Library/content-specific, and level 43 also describes unrelated objects. |
| Derive installation positions from obstacle polygons | Loses elements without segments and confuses an outline-derived point with the actual object position. |
| Put new kinds inside `obstacles.objects` | Still feeds the placement/hint code with obstacle volumes and contradicts the separate-list request. |

## Required verification

| Area | Tests and acceptance evidence |
|---|---|
| Planner adapter — `planner-core/__tests__/roomle-planner.ts:4578` | Levels 27/28 yield the two exact types; 43/47/52/55 remain obstacles. Renaming an item does not affect classification. Cover nonzero height, a missing outline, hidden owners, an occluded owner, and supply children: one installation per owner and no child obstacle leakage. |
| Context assembly — `homag-intelligence/__tests__/hi-plan-context-test.ts:726,1340` | Default, installation-only, obstacle-only, combined, excluded and empty sections. One shared internal fetch; installation-only reads do not calculate groups/templates or rooms. Assert the exact two-field entry and coordinate conversion, including negative coordinates and zero normalization. |
| Placement feedback — `homag-intelligence/__tests__/hi-tool-commands/place-group-test.ts` and the create-group placement tests | A group covering a supply produces no object-overlap hint for that supply. The light switch, real furniture, doors/windows and other groups still produce their existing feedback. |
| MCP — `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` | New default section forwarded; installation-only include preserved; points/types unchanged; no room fetch added; requested empty list and unavailable older-planner field remain distinct. |
| Served text — `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` | Tool list advertises the field and its position semantics; session preamble does not call supplied connection positions unknown; JSON results preserve the list. |
| Real planner | Load the ticket snapshot through local roomle-ui on `feat/water-connection`. Inspect default context and each explicit include form through the direct embedding API and MCP. Expect one outlet and one water entry, no supply outlines, the light switch retained, and positions matching the live owner `getCenter()` after conversion. Move/reload an element and confirm the next read reflects it. |

For implementation, run the affected SDK tests with `npm run test -- --run …` from
roomle-ui `packages/web-sdk`, followed by the repository's relevant type/lint scripts. Run
`npm test` and `npm run typecheck` in this repository's `hi-mcp` workspace. The analysis itself
does not change production code or claim those implementation tests have passed.

## Documentation affected by implementation

- roomle-ui: `packages/embedding-lib/docs/homag-intelligence-embedding.md`, the context section
  list, entry shape, position anchor and supply exclusion; `.agents/homag-intelligence.md` for
  the implementation contract. Export the new entry type from the SDK index if consumers need
  it alongside `HiPlanContext`.
- HI MCP: `docs/hi-mcp-behaviour.md` (information and `get-plan-context`, including the service
  preamble), `docs/hi-mcp-server.md`, `hi-mcp/hi-mcp-server/README.md`,
  `.agents/context/tool-executors.md`, `.agents/skills/hi-mcp-tools.md` and
  `.agents/skills/roomle-hi-concepts.md`. Add a focused snapshot-backed context case to
  `docs/test-prompts.json` with its test description in `docs/test-prompts.md` when implementing.
- RoomleCore: no documentation change is required by this UI/MCP presentation extension;
  the existing level, position and collision references remain authoritative.

This is an analysis of comment 156276. Earlier comments 156261 and 156265 address the Core
snapping/collision feature; their historical test results are not validation of this new context
section. The proposed names and position anchor above are design recommendations, not an
implemented contract.
