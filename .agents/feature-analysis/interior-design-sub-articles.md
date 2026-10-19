# Interior Design: editing HI sub-articles through MCP

> **Type:** Feature analysis  
> **Status:** Open — implementation on feature branches; SDK/MCP implementation and direct planner validation pass; live AI acceptance awaits authorization
> **Date:** 2026-10-19  
> **Ticket:** [RML-18205](https://roomle.atlassian.net/browse/RML-18205)  
> **Base:** roomle-hi-example `master` at `1e7f6d3`; roomle-ui `feat/assistant-chat` at `361e9233b`; RoomleCore `master` at `f744024ca`

## Affected repositories

- **roomle-ui:** implement typed discovery and fitting operations in the HI tools API, expose instance information, await calculation/loading, and integrate command results and history.
- **roomle-hi-example:** register MCP schemas and forwarders, explain Interior Design terminology, integrate chat feedback and history verification, and document and test the workflow.

**RoomleCore is a validation dependency.** Existing external-object loading, placement, persistence and history must support the new entry point. The code trace does not establish a need for a new C++ API. Change the kernel only if integration evidence identifies a missing contract.

## Request and conclusion

The ticket asks users to inspect and edit the interior of HI furniture through MCP and the AI planning assistant: discover available fittings, add one, reposition it, transfer it to another compatible container/root in the same group, delete explicitly identified fittings, and replace a fitting with a compatible alternative. Users may say **Interior Design**, **interior fittings**, or **sub-articles**. The available furniture and fitting types come from the active library.

This analysis adopts the current ticket description, including replacement and same-group movement. Cross-group transfers, new fitting types, changes to the library's calculation, arbitrary generated-part editing, and replacement of the enclosing cabinet/root article are outside this delivery.

The existing interactive implementation supplies the library primitives. Exposing those methods unchanged is insufficient: compatibility depends on shared discovery state, installed instances are not represented adequately in the agent context, completion is not awaitable end to end, and unchanged results can look successful. Replacement needs one staged edit rather than separate destructive delete/add tool calls.

The ticket already contains an earlier requirements analysis (comment `156268`). This document verifies it against the bases above and makes the read route, interior-only history comparison and placement evidence explicit. The description is the source of scope; the earlier comment's question about including replacement is superseded by that description.

## Investigation trace

Paths and line numbers below refer to the named repository at the recorded base. In the roomle-ui subsections, `HI/` means `packages/web-sdk/packages/homag-intelligence/src/`.

### Catalog and compatibility

- `HI/glue-logic.ts:574` separates catalog entries marked `isConfigDummy` into `_posSubArticleMap`; ordinary furniture articles go into `posArticleMap`. `HI/hi-tools.ts:328` supplies only `posArticleMap` to the current plan context. Searching the existing MCP furniture catalog therefore does not discover addable sub-articles.
- `HI/glue-logic.ts:2718` implements `findValidSubArticles`: it resolves each group's library, asks `LibraryData.getValidSubArticles`, and replaces the shared `_validSubArticles` list. Missing groups/data and caught library errors can yield an empty result.
- `HI/glue-logic.ts:2755` resolves a sub-article from that shared list before asking the library for valid containers. `addSubArticle` at line 2793 also depends on the list. A query for another group/library can change what a subsequent edit sees; the MCP call must not require an earlier UI selection or discovery call.
- `HI/external-object-api-callbacks.ts:64` defines each valid destination as `rootId`, `containerModuleId` and `parentModuleId`. These identifiers have distinct meanings. Return their association from library discovery rather than asking the agent to reconstruct it.
- `HI/hi-tools.ts:1058` checks scene membership because the glue's group map also contains catalog groups that were never placed. Discovery and editing must use the current scene group, not any cached group with a matching ID.

### Installed fitting identity and placement

- `HI/model/oc-scripts-domain.model.ts:121` distinguishes a unique module instance `id` from the non-unique module `name`, and contains nested `modules`, `containers`, attributes, `canBeDeleted` and sub-article `articleInfo`.
- `HI/hi-plan-context.ts:689` shapes only immediate sub-modules and exposes `module.name` as their `id`. Two shelves of the same module type are indistinguishable, and deeper nested fittings disappear. This representation is useful to the existing attribute-targeting contract (`HI/hi-tools.ts:396`); changing its meaning silently would break that contract.
- `HI/glue-logic.ts:2986` can find a nested module and its owning root, but does not return the complete ancestor/container association. Discovery needs a traversal that retains that association and distinguishes installed sub-article fittings from ordinary library-generated components.
- A fitting's editability cannot be inferred from its name. Use its article provenance, library capabilities and deletion permission; do not offer arbitrary doors, fronts or generated parts as removable fittings merely because they are nested modules.

The existing insertion frame is established in RoomleCore:

- `src/configurator/external/external-module-group-configurator.cpp:418` recognizes movement of an installed sub-article from its article provenance and requests valid destinations.
- `src/configurator/external/external-module-group-configurator.cpp:556` transforms a drop point into the target parent module's frame.
- `src/planner/interaction/plan-interaction-handler.cpp:451` and `:473` forward add/move requests with conversion into HI module coordinates.
- `documentation/homag-intelligence/hi-object/externalObjects.md:204` documents `insertPosition`: **millimetres, x right, y up, z towards the front, relative to the origin of `parentModuleId`**, the module owning the container. It is neither a room coordinate nor a coordinate relative to the container's own origin.

That reference also describes an important limit: the library consumes `contextData.insertPosition` during calculation and clears it afterwards, and a library may ignore it. The proposed result must obtain actual placement/order from calculated data rather than echoing the requested point. The generic module model does not expose a dedicated placement field. Which calculated geometry or library-described attributes establish the fitting's position and reference point is an integration question, especially for “upper shelf” and “keep the old placement” during replacement. Do not invent a height range, snap grid or placement guarantee from a container ID.

### Editing and completion

| Existing roomle-ui entry point | Behaviour and gap |
|---|---|
| `HI/glue-logic.ts:2793`, `addSubArticle` | Uses the cached compatible article and the target root/parent. Returns `void`; calls `designerRequests.loadPosGroups` without awaiting it. |
| `HI/glue-logic.ts:2842`, `moveSubArticle` | Resolves the destination root's group, then deletes and recreates the source fitting inside that group. Returns `void`; does not await the final load. Cross-group transfer is not implemented. |
| `HI/glue-logic.ts:2891`, `deleteSubArticles` | Finds one or several module instances recursively and calculates their removal. Returns a promise, but does not await its final `loadPosGroups` call. |
| `HI/glue-logic.ts:3148`, `_moveSubArticle` | Deletes from the actual source root, adds the same article to the destination, and calculates once. Works on a copy through `_updatePosData`; a failed move does not publish the modified group. It does not explicitly transfer the old fitting's custom attribute overrides. |
| `HI/glue-logic.ts:3193` and `:3231`, `_addSubArticle` / `_deleteSubArticle` | Catch library exceptions and can return the unchanged working group. “A group was returned” is not evidence that a fitting was added or removed. |
| `HI/glue-logic.ts:3259`, `_updatePosData` | Copies the original group and preserves its surrounding properties. This is the useful staging boundary; add/delete helpers currently publish their calculated result to the group map before loading. |

`HI/api.ts:27` already returns the planner load promise from `RoomDesignerApi.loadPosGroups`. The gap is primarily that the sub-article methods discard that completion signal. Await the final load and any calculation/load owned by its callbacks, following the established operation-lifetime pattern (`HI/glue-logic.ts:1078`, `requestKernelOperation`). Do not substitute a timeout or repeated context reads for completion.

No dedicated replacement operation appears in `HI/hi-plan-context.ts:1084` or `HI/hi-tool-commands.ts:342`. The public command vocabulary covers roots, group attributes and group arrangement, not the requested interior edits.

### MCP, chat and history

In roomle-hi-example:

- `hi-mcp/hi-mcp-server/planner-api.ts:8` exposes six existing planner methods through the page bridge. `tool-executors.ts:358` forwards a plan-changing tool through `inPlanner`; this supplies the serial execution and undo record that the new edits need.
- `hi-mcp/hi-mcp-server/tool-executors.ts:103` serializes plan-changing tools and `get-plan-context`. New interior discovery must share this existing ordering so it cannot inspect a half-edited group, while remaining read-only and unrecorded.
- `hi-mcp/hi-mcp-server/tool-executors.ts:119` compares compact groups before/after tool calls and undo/redo. With today's sub-module shaping, an interior-only move or setting change can leave that comparison unchanged. Adding another shelf may change a count, but does not solve placement or identity verification.
- `hi-mcp/hi-mcp-server/hi-mcp-server.ts:24` says sub-modules come with the article and that agents author articles, attributes and relations only. It needs a precise distinction between normal article assembly and supported interior-fitting edits.
- `hi-mcp/hi-mcp-chat/chat-stream.ts:81` obtains the MCP tool list dynamically. A separate model-side editing implementation is unnecessary. `hi-mcp/hi-mcp-chat/chat-recovery.ts:3`, `:13` and `:68` classify read-only tools, label writes and extract outcome details; add discovery classification and actual fitting results there.

In roomle-ui, `packages/web-sdk/packages/planner-core/src/roomle-planner.ts:3223` wraps edits in `runToolCall` and cancels docking previews before dispatch. Read-only discovery should use the context route rather than that edit entry point. `services/plan-interaction-manager.ts:362` within planner-core groups the call's loads into one undo step; a call without a load/change makes none. `HI/hi-tool-commands.ts:1392` reports history steps and preserves undo information after partial failure. Its counter currently increments for every completed group operation: new no-op outcomes must not be counted automatically as successful edits.

## Proposed feature contract

### Read-only discovery

Provide one compact, scoped query for a loaded scene group, optionally narrowed to a root, container or candidate article. Return:

- Installed fittings with actual instance ID, article/library ID, owning group/root, ancestor and parent/container association, library descriptions, supported operations, and measured placement/order when available.
- Compatible additions from that group's library, with their valid target tuples and the placement/default behaviour the library actually supports.
- A distinction between no compatible options, unsupported capability, and discovery failure; an exception or missing library data must not masquerade as an empty catalog.

Resolve every edit against fresh scene data and freshly calculated compatibility. Extract a call-local compatibility result rather than treating `_validSubArticles` as durable session state. Querying one group must not make another group's edit succeed or fail. Reject ambiguous instance choices with the available choices; never guess between repeated fittings by module name or approximate UUID matching.

Prefer an additional scoped section/options on `getExternalObjectPlanContext` for this read path, preserving the six-method bridge. roomle-ui already has `HiPlanContextSection` / `HiPlanContextOptions` (`HI/external-object-api.ts:192`) and planner forwarding at `roomle-planner.ts:3185`; the server wrapper currently forwards only `include`. It would need to forward scoped options too. This is a proposed API extension, not an existing section. Its compatibility and transport tests must cover old callers.

Keep expensive compatibility discovery on demand. Put a compact, read-only installed-fitting state into the groups used by history comparison: unique IDs, parentage, relevant settings and actual placement/order. Keep the existing `subModules` attribute-targeting contract. Read-only fitting facts must not become agent-authored nested module trees when a group is resubmitted.

### Editing

The following names illustrate the proposed interface; the behaviours are the acceptance contract, not these spellings.

| Proposed tool | Required intent |
|---|---|
| `get-interior-design-options` | Inspect a scene group's fittings and current compatible additions/destinations, without selection or an earlier discovery call. |
| `add-interior-fitting` | Add a chosen compatible article to an identified valid container, at a supported parent-local point or a validated library default. |
| `move-interior-fitting` | Resolve an installed instance, derive its article/source, and reposition it or move it to a compatible destination in the same group. |
| `delete-interior-fittings` | Remove explicitly identified installed instances, singly or in one group-scoped batch, preserving the cabinet and unrelated contents. |
| `replace-interior-fitting` | Exchange one installed fitting for a compatible article in one command; retain its container and placement where valid, and keep the original if the replacement cannot be built. |

Implement the typed operations in `hi-tools.ts`, supported by the glue/library primitives. Register mutations in the existing operation/tool dispatch and forward them through MCP `inPlanner`. The server owns schema and agent language; roomle-ui owns compatibility, IDs, calculation, placement and results.

Before mutation, validate all explicitly targeted instances and destinations against the same current group. A move or replacement derives the source article and parent from that instance. Retain compatible input settings where supported and report settings the new article cannot retain. Recreation may change identity: return the new instance ID, not a promise that the old ID survives.

Stage replacement on a copy: resolve the source, remove it in the working group, discover compatibility/destinations for that candidate state, add the replacement, calculate and validate the result before publishing/loading it. This matters when the source currently occupies the capacity the replacement needs. Reuse the library's existing delete/add calculation primitives; do not load the deletion as an intermediate visible state. Batch deletion likewise validates its target set and stages the result before publication; any partial-result policy needs an explicit result contract.

### Results, failure and history

Each mutation resolves only after its final owned calculation and planner load. Read the actual loaded group to return affected, added and removed fitting IDs, resulting interior state and placement, plus library adjustments and lost settings. Distinguish a changed result, an unchanged request, and a failed edit. Never infer success from the requested IDs, a returned group, or a load being started.

Detect unchanged/failed-before-change work before a counted load or propagate its actual change outcome through the command counter. It creates no history entry. Successful edits remain one `runToolCall` and one user-visible undo step, including multiple deletions. A failure after a real plan change must carry the existing error/history information so the change remains identifiable and undoable; do not falsely report that nothing changed.

For replacement, calculation failure must leave both the original scene group and cached group intact. Validate final-load failure and restoration separately: the inspected code does not prove atomic replacement through every loader failure. If loading partially changes the scene, the implementation must preserve/restore the original as the ticket requires and report the actual outcome. A caught exception alone is insufficient evidence of restoration.

Do not rearrange the enclosing furniture for an interior edit. Preserve group/root world transforms, docking, unrelated fittings and other groups. Verify that save/reload, price and order data use the edited interior through the existing pipeline.

### Agent wording

Explain the mapping between **Interior Design**, **interior fittings**, and **sub-articles** in the tool descriptions and served instructions. The chat learns tools from the tool list, so initialize-only instructions are insufficient. Update roomle-ui `HI/hi-agent-prompts.ts:11` to distinguish an interior request from its ordinary furniture-article selection rule.

“Add a shelf inside this cabinet” should discover a compatible fitting in that cabinet's group. “Change the interior design” requires clarification when it does not identify the intended edit. “Move the upper shelf” requires measured ordering and a unique installed instance. Keep library-specific fitting names, attribute IDs and compatibility rules in library data, rather than hardcoding them in served text.

## Alternatives considered

| Alternative | Why it does not meet the request |
|---|---|
| Forward the five glue methods unchanged | Retains hidden discovery state, discarded completion, silent no-ops and inadequate instance results. |
| Use existing root delete/exchange tools | Targets the cabinet/root article rather than the installed fitting. |
| Ask the agent to rebuild nested group JSON | Duplicates library assembly logic and risks unrelated contents, settings and docking. |
| Expose delete then add as replacement | Can lose the original and creates a destructive intermediate state and potentially separate undo entries. |
| Run discovery through the mutation route | Enters `runToolCall` and cancels docking for a read; the context route already exists. |
| Add a planner bridge method for each new tool | Conflicts with the established command boundary; mutations already fit its existing method. |
| Hardcode shelves, containers or placement attributes | Works for one library at the expense of the library-neutral API. |
| Add kernel business logic immediately | No missing kernel contract is demonstrated by this trace. |

## Acceptance and validation evidence required

| Area | Coverage required before implementation is complete |
|---|---|
| Discovery | Loaded group only; no selection or preceding query; repeated and nested instance IDs; destinations from the correct library; unsupported/failed discovery distinct from empty results. |
| Compatibility | Another group's query and edits after discovery cannot supply stale compatibility; stale instances and invalid/ambiguous destinations produce useful feedback without an unintended edit. |
| Add | Validated default and supported explicit parent-local point; actual created IDs and placement; library-adjusted or ignored placement reported. |
| Move | Reposition within a container and transfer across containers/roots in one group; new identity and retained/reset settings reported; unknown source and library failures preserve contents. |
| Delete | One instance and an explicit list; no cabinet/root deletion; nested/repeated siblings and unrelated contents retained. |
| Replace | Compatible alternative succeeds; occupied-container validation uses the candidate without the source; incompatible or unbuildable replacement keeps the original; load-failure restoration verified. |
| Completion | Deferred library/load/callback completion keeps the tool pending; results use final state; no-op and failed-before-change calls make no load/history entry. |
| History | Each edit is one undo step; redo restores it; comparison detects interior-only position/settings changes even with identical root geometry; discovery adds no step. |
| Persistence and downstream data | Save/reload retains the interior; price/order data reflect changes where supported; furniture transforms, docking and other groups are unchanged. |
| MCP and AI | Schema, read-route options, forwarding, ordering, recovery labels/details and result formatting; a real planner/MCP/AI session demonstrates the ticket's six example requests plus undo/redo and save/reload, using both supported wordings. |

Existing building blocks, inspected rather than executed in this analysis:

- roomle-ui `homag-intelligence/__tests__/glue-logic-test.ts:250` tests one-calculation movement, transfer between roots in a group, unknown IDs and calculation failures. Discovery/container tests start at lines 3728/3749; addition at 4163 and deletion at 4388. These are not acceptance coverage of the new API.
- roomle-ui `homag-intelligence/__tests__/hi-tools-test.ts:245` covers an attribute command waiting for its position callback and follow-up load. `__tests__/hi-tool-commands/run-tool-command-test.ts` covers command history reporting. Extend these seams for fitting operations and no-ops.
- RoomleCore `test/configurator/external/external-object-docking-test.cpp:584` covers interactive sub-article movement and converted drop positions. New kernel tests are conditional on a demonstrated integration gap.
- roomle-hi-example `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` already covers command forwarding, ordering and undo/redo comparisons; `tests/hi-mcp-server.test.ts` covers tool schemas/served language; `hi-mcp/hi-mcp-chat/tests/chat-stream.test.ts` covers interrupted feedback.

No plan, configuration or item ID, attachment, or library selection is supplied by this ticket. No RAPI fixture can be inferred from it. The implementation must record a suitable library/version and live evidence; shelf/drawer support and setting retention have not been established for every library by this code inspection.

## Code and documentation the work would touch

**roomle-ui:** `packages/web-sdk/packages/homag-intelligence/src/{hi-tools.ts,glue-logic.ts,hi-plan-context.ts,hi-tool-commands.ts,external-object-api.ts,hi-agent-prompts.ts}`, exported context/result types and the matching HI tests. Planner and embedding declarations/forwarding change only as required for scoped read options and completion; reuse the command route for writes. Update `.agents/homag-intelligence.md`, relevant SDK/API documentation and the interior-coordinate contract. Preserve existing interactive callers when making completion awaitable.

**roomle-hi-example:** `hi-mcp/hi-mcp-server/{hi-mcp-server.ts,tool-executors.ts,planner-api.ts}` and their tests; the group facts consumed by history; `hi-mcp/hi-mcp-chat/chat-recovery.ts` and chat tests. Document behaviour and results in `docs/hi-mcp-behaviour.md`, tools in `docs/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`, implementation flow in `.agents/context/`, and user wording in `docs/user-guide/`. Update copied client declarations only if the read signature requires it; no seventh bridge method is proposed.

**Conditional kernel work:** RoomleCore external-object loading/history/persistence tests and `documentation/homag-intelligence/hi-object/externalObjects.md` only if the integration check demonstrates a missing contract. The existing insertion-coordinate conversion is the contract to reuse.

The implementation is described in [the living reference](../context/interior-fittings.md). This analysis stays open until required acceptance validation is complete and the feature has landed.

This is a feature analysis, not an implementation plan. The tool spellings, precise placement/result schema and compatible-setting transfer rules remain design work within the ticket's acceptance criteria. Productive code and the ticket description are unchanged.

## Implementation evidence — 2026-10-19

- Both implementations are on `feat/interior-fittings`. The roomle-ui branch starts at `feat/water-connection`, commit `d6c08f2ed`. No RoomleCore API change was needed: the library already supplies `positionRelativeToRoot`, which is now typed by the UI.
- SDK: 2,762 tests passed; 24 tests skipped. MCP: 309 tests passed. Embedding bridge: 3 tests passed. UI, SDK, embedding and MCP type checks pass; code lint, MCP formatting and changed-document link checks pass.
- The UI aggregate lint remains blocked by 22 existing TypeDoc warnings. Its separate SDK documentation check fails in `bun-webgpu/src/structs_ffi.ts:703` with TS2345. Both failures were reproduced in an isolated checkout of the exact water-connection base with the same dependencies.
- Direct Chromium/planner/MCP acceptance passed 21 tool calls against two Furniture_Smith H60M cabinets in one group rotated by 90 degrees. The calls exercised scoped discovery, explicit and default insertion, an unchanged higher-position request, transfer to the second root, FRVAR-to-FSVAR replacement, batch deletion with a repeated ID, undo/redo, price and order data, and XML serialization/reload with two installed fittings. Assertions preserved the cabinet group position/rotation, root identities, input attributes and docking; reloaded fitting IDs, parentage, settings and positions matched. The footprint can grow when a front or drawer protrudes; it is not a furniture-placement invariant.
- Backend/library: `HI_PRE_Roomle_Milestone_2` / `Furniture_Smith`, calculation script downloaded on 2026-10-19, SHA-256 `1366abd409201b04fc8002bf1719be4e8590049b68d2b5f9b35e32113a7ead20`; master data exposes no version field. The live library regenerates container IDs. Its modular front inserts can ignore requested height; an unchanged move preserves the original instance and reports no change. The library rejected FKVAR with hinge calculation errors 15003/22032 before publication; FSVAR and FTVAR calculated successfully.
- Required live AI interpretation remains unverified. Automatic approval review rejected sending the example plan/tool data to the external GPT provider without specific authorization for that payload and destination. Prompt/served-text and interrupted-feedback unit tests pass, but they do not establish actual model interpretation. Keep this analysis open until that acceptance check is resolved and the feature lands.
