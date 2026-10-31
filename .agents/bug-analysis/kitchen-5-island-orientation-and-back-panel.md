# Kitchen 5: island orientation, back-panel construction and correction feedback

> **Type:** Bug analysis
>
> **Status:** Open
>
> **Date:** 2026-10-31
>
> **Ticket:** [RML-18351](https://roomle.atlassian.net/browse/RML-18351)
>
> **Base:** roomle-hi-example `master`, `4c60e1cc524b298244d15dcbd39bd88f226b126b`; roomle-ui `feat/hi-planning-assistant`, `35aa1dc2e5cd9923c909ade6f04c325dd2401d6f`

## Affected repositories

- **roomle-ui:** clarify image layout guidance, repair replacement pose feedback, and provide a direct way to reposition a freestanding group.
- **roomle-hi-example:** retain this analysis and add a kitchen-5 prompt regression when implementing the fix.

The **Furniture_Smith library data** also needs an article-description clarification. Its calculation is not a proposed change. No productive code changes are part of this analysis.

## Finding

| Question | Finding |
|---|---|
| Is the library information insufficient? | **Yes, for the back-panel construction.** The description omits its horizontal cap and does not explain how its total height relates to a worktop. The numerical default height is visible, but its design consequence is unexplained. |
| Is the library missing the panel's purpose or length setting? | **No.** Both saved plans carry the explanatory description and correctly use `mod_IslandBackwallWidth: 1800`. This is not the previously identified panel-length problem. |
| Does a tool rotate a correctly specified new island by 90°? | **Not reproduced.** Explicit placements at 0°, 90°, 180° and 270° are reported as requested. Editing the panel height preserves the rotation. |
| Are there tool problems? | **Yes.** Existing-group movement only supports walls/corners; replacing an island loses its reported position and rotation even though its physical placement stays. |
| Why is the reported final island wrong? | Its actual overall orientation changes from 180° to 90° while its internal base-unit and back-panel arrangement stays the same. Image guidance does not explicitly preserve an island's axis and working side relative to the other kitchen runs. The original call that introduces the turn is not available. |

## Symptom and reproduction

Generate the kitchen shown in [kitchen-5.png](../../docs/images/kitchen-5.png) with the Planning Assistant in the HI example, using Furniture_Smith. Inspect the island before correction and after the assistant finishes. The island should retain the reference's relationship to the sink/tall-unit run and have a construction matching its single-height work surface.

The reported states are preserved as:

- First attempt: [`ps_temong0abqjrb4l55ykd1k0pg3rnut5`](https://www.roomle.com/t/ligna-store-test/kitchens/?id=ps_temong0abqjrb4l55ykd1k0pg3rnut5): incorrectly aligned island, raised back-panel construction on its kitchen-facing side.
- Final result: [`ps_tempa4tzbl9xk4v9r02rcq40e6o0shl`](https://www.roomle.com/t/ligna-store-test/kitchens/?id=ps_tempa4tzbl9xk4v9r02rcq40e6o0shl): island turned by a quarter turn relative to the intended layout.

The ticket contains the reference image and both plans' saved perspective/top images. Stage names follow the reporter; snapshot creation times do not establish the agent's operation sequence.

## Evidence from the saved plans

Read each Roomle plan snapshot, decode the XML's `externalConfiguration` JSON, and inspect the island group and its generated worktop. Coordinates below are **the agent's plan space**, millimetres, Z up; the anchor is the first base unit's back-left docking corner, including its root offset.

| Fact | First attempt | Final result |
|---|---|---|
| Island group | `824fd0d3-3429-4d6b-8049-8fa6c104e2ec` | `8bd7264d-2b7d-49e9-9aaf-9e3fdc90c650` |
| Placement-frame anchor | `[3000,650,0]` | `[1250,650,0]` |
| Island rotation | 180° | 90° |
| Sink/tall-unit row rotation | 180° | 180° |
| Island axis relative to that row | parallel | perpendicular |
| Base units | three `UTB60`, 600 mm each | three `UTB60`, 600 mm each |
| Panel | `RWV`, length 1800, depth 250 | `RWV`, length 1800, depth 250 |
| Panel height | 1000 mm | 858 mm |
| Actual worktop top | 845 mm | 845 mm |
| Panel top above worktop | 155 mm | 13 mm |

All three base roots have local rotation 0°. The panel has local rotation 180° and back-to-back docking in both states. Thus the panel is behind the cabinets in their own frame: the first attempt's kitchen-facing back panel is a consequence of the **whole island's facing direction**, not a panel docked to a cabinet front. Making the panel lower alone cannot fix that facing direction.

The first island already has the intended parallel long axis but faces the wrong way for the reported working aisle. A half turn preserves that axis while exchanging the working and back sides; a quarter turn changes the axis. For the main kitchen's particular mapping in these snapshots, a base-row rotation of 0° faces the sink aisle. This is a diagnosis of these plans, not a universal island rotation rule.

The new island group and root IDs establish a different group identity in the final state. They do not prove the original assistant's delete/create sequence, nor its submitted placement arguments.

## Investigation and root causes

### 1. Library descriptions hide the panel's actual construction

The article's [`desc`](../../docs/library-information/article.json#L4139) describes decorative rear cladding and explicitly identifies the length attribute. Its template defaults are depth 250 and height 1000 ([lines 4155–4169](../../docs/library-information/article.json#L4155)). Its module has separate panel-top colour, thickness and overhang attributes ([master-data.json:1655](../../docs/library-information/master-data.json#L1655)). A fresh backend fetch returns the same description and defaults as the checked-in data and the saved plans.

The calculated geometry shows what the description does not say: `part_PanelVert` plus a **horizontal `part_PanelHor` cap**, 250 mm deep and 19 mm thick. In the first attempt its cap runs from height 981 to 1000; the generated worktop runs from 820 to 845. In the final state the cap runs from 839 to 858, still 13 mm above that worktop. These are the parts the library calculates for the supplied/default attributes; there is no evidence of a calculation bug.

The agent can see the default dimensions, but neither “decorative back panel” nor the generic “Height of the element” explains the cap, its floor-based total height, or the absence of automatic alignment to the adjacent worktop. A description that names only cladding encourages the wrong interpretation of a valid library article.

This clarification must reach the **selection text** too. [roomle-ui `agent-facing.ts:185`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/agent-facing.ts#L185) retains only `FUNCTION` and `AI_SELECTION_HINT` in compact articles. The live agent-facing catalog confirms that the other description sections are absent there. Adding essential construction information only to `REQUIREMENTS` would leave the usual selection context unchanged.

### 2. Image guidance does not preserve the island's relational orientation

[roomle-ui `image-planning/SKILL.md:22`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills/image-planning/SKILL.md#L22) asks for the overall shape, levels and order within rows. Its room mapping at line 36 chooses a suitable corner, but does not explicitly carry an island's parallel/perpendicular relationship and working side along with that mapping. Its panel instruction at line 43 requires a rear panel in the same create and specifies length, without checking whether the selected finishing component's profile and height match the image.

That combination leaves a concrete gap: “an L and an island with a back panel” can be satisfied with either island axis and either facing direction. The visible wooden surface must not automatically be treated as cabinet fronts; it can be rear cladding. `behind` describes a local relation, not “away from the kitchen.” Library data cannot determine this room-specific relationship for the agent.

The wrong orientation in the saved result is certain. Which image interpretation or correction argument produces it in the reported turn remains unknown without the original tool trace.

### 3. A freestanding island cannot be corrected directly

[roomle-ui `hi-tool-commands.ts:670`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-tool-commands.ts#L670) drops placement on an existing group and says to use `place-group`. However, [the `place-group` schema at `hi-mcp-server.ts:538`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts#L538) requires a wall and exposes no point/rotation target. This is an API capability gap and misleading recovery advice for a freestanding island, rather than a bad numeric rotation conversion.

The live probe confirms that a replacement with a requested new rotation leaves the physical island at 180°. A new create at the requested angle works. The current interface therefore makes a direct island correction unavailable and can lead an agent to rebuild instead. Its involvement in the original run is not proven.

### 4. A normal replacement loses the pose in feedback

A second, independent tool defect is reproducible even when replacing the returned group **without** a placement. Before replacement the context reports `pos: [1600,1500,0]` and `rotationZ: 0`. Afterwards both the create result and subsequent context contain only `position.footprint`. The planner XML retains exactly the same object position and rotation. The same loss occurs at 180° when a placement is submitted and ignored.

The source explains this feedback loss:

1. The tool passes only article picks and its allowed group fields onward ([`hi-tool-commands.ts:758`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-tool-commands.ts#L758)); the agent's read-only `position` is not authored back.
2. [`hi-tools.ts:819`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-tools.ts#L819) copies that input, and line 851 replaces the existing cached group with it without retaining its placed transform. The kernel keeps the physical placement, but that does not restore the cached pose in this path.
3. [`shapeGroup`, `hi-plan-context.ts:755`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts#L755) reads `group.pos` and `group.rotationY`. [`positionInPlacementFrame`, `hi-group-placement.ts:327`](https://github.com/roomle-dev/roomle-ui/blob/35aa1dc2e5cd9923c909ade6f04c325dd2401d6f/packages/web-sdk/packages/homag-intelligence/src/hi-group-placement.ts#L327) cannot recover a placement frame without that position.

The served authoring rules ask the agent to verify precisely these missing fields. This defect makes correction verification less reliable; it does **not** demonstrate that replacement physically turns the island.

## Proposed clean fix

1. **Clarify image guidance in roomle-ui.** Preserve the island's long-axis relationship, working aisle and exposed back when mapping the whole kitchen into the plan. Keep these relationships during corrections. Match finishing parts to the image's profile and heights, not just its row length. Keep this guidance library-neutral.
2. **Clarify the library description.** Put the vertical-panel-plus-cap construction and total-height meaning in `RWV`'s `FUNCTION`/`AI_SELECTION_HINT`, with the dimension/material controls explained in its full description. State that its default can produce a raised ledge and that worktop alignment is not automatic. Do not change its calculation or add Furniture_Smith knowledge to the tools.
3. **Repair replacement feedback in the tools.** Retain or recover the final placed group transform across a rebuild and return its authoritative placement frame in both the tool result and subsequent context. Verify the physical transform too; supplying a made-up pose solely in result formatting is not a fix.
4. **Complete existing-group placement.** Extend the placement capability so an existing freestanding group can receive a point and rotation directly, using the existing anchor-frame math, while keeping its roots, attributes and docking. Adjust the recovery message and schema together. This avoids delete/recreate as the way to rotate an island.

All Planning Assistant implementation work stays in the HI tools and tool commands. **Do not change `glue-logic.ts`** or the library calculation for this fix. No new guard is proposed: an intentionally raised panel or a kitchen-facing back is a legitimate design when the user requests it. Clarified guidance, descriptions and a complete placement API address the causes without rejecting legitimate plans.

## Regression coverage for the fix

- Add `image-kitchen-5-island` to the prompt tests: assert the island's relation to the sink/tall-unit run, intended working side, matching work-surface profile and stable orientation after corrections. Evaluate the first create as well as the final state. Do not hardcode a room-independent angle.
- Exercise the corrected orientation guidance after mapping the kitchen into another room corner; test a deliberate raised-bar request too.
- Add a replacement regression below the mocked tool boundary: create a placed island, replace it unchanged, and assert that the result and subsequent context retain the pose **and** match the actual planner position. The existing tool-layer test named “replaces an existing group resubmitted without placement, which keeps its position” checks the forwarded payload, not this live feedback contract.
- For freestanding placement, verify rotation/translation, retained group identity, roots and docking, and undo. Retain the existing wall/corner placement tests.
- Check that the compact article projection carries the revised selection information. No library-specific rule belongs in shared served text.

## Verification and limits

- Decoded both reported snapshots and compared group/root transforms, docking, input attributes and actual part heights.
- Fetched the current articles/master data to `.temp/jira-kitchen5/`; checked the live compact catalog too.
- Ran a model-free browser probe on bo-test from a separate example server on port 3002, using a fresh default-room session. It does not save or change either reported plan. New placements at 0/90/180/270°, a panel-height edit, replacement with an ignored placement and ordinary replacement without placement establish the results above. The XML preserves the physical transform in both replacements while context loses it.
- **483 existing tests pass across six files:** `hi-group-layout-test.ts`, `hi-group-placement-test.ts`, `hi-mcp/agent-frame-test.ts`, `hi-tool-commands/create-or-replace-groups-input-test.ts`, `hi-tool-commands/create-or-replace-groups-placement-test.ts`, and `hi-tools-test.ts`. Run via the SDK's `npm test -- --run ... --maxWorkers=2 --no-file-parallelism`, using `/opt/homebrew/bin` first in `PATH` for the supported Node runtime.
- Live probe build identifiers: `roomle-sdk-BNM-0bOX.js` and `hi-mcp-server-DN2IifNX.js`; local source/tests use the roomle-ui base recorded above. The deployed and local builds are identified separately; their exact commit equivalence is not assumed.
- Probe inputs, results, before/after XML and the fetched library data are in the ignored `.temp/jira-kitchen5/` directory. The ticket's plans and attachments are the durable incident evidence.
- **Not established:** the original model/provider, reasoning settings, loaded skill versions, exact prompts or tool-call sequence. No new model-driven run or end-to-end fix validation is performed. The evidence supports the specific description/guidance and tool defects above; it does not justify attributing the original quarter turn to a numeric tool bug.


## Implementation verification — 2026-10-31

The tool changes are implemented on roomle-ui `fix/hi-island-placement`; the original image-planning issue remains open. Rebuilds retain the world docking frame through recalculation, point-form `place-group` moves existing groups, and calculated roots expose read-only measured heights. The image skill explicitly maps front directions to plan-space rotations and asks for a returned-pose check. No library calculation or `glue-logic.ts` change is made.

- **1,714 HI unit tests pass across 33 files**, including the tool/skill contract fixture; **66 example tests pass**. SDK type checking, code lint and changed-source formatting checks pass. SDK documentation checking encounters two errors in unchanged code: `bun-webgpu/src/structs_ffi.ts:703` and `common-core/__tests__/image-renderer.ts:157`.
- A local browser probe verifies physical planner XML and returned pose through ordinary replacement and replacement with an ignored placement, including re-anchoring. It verifies explicit point rotations, retained group identity and generated finishes, undo, redo and no-op behavior. The worktop measures 820–845 mm and the rear component measures 0–1000, 0–858 or 0–845 mm as requested.
- Backend descriptions are verified verbatim against the existing suggestions: `RWV` is 956 characters; `mr_IslandBackwall` is 305. The tracked catalog/master data and the statuses of those existing entries are refreshed. There is one suggestion per item.
- Three image-driven runs with both local embedding modules (`localhost:3001`) and planner (`localhost:5173`) retain the parallel axis but choose the wrong working-side direction; two omit rear finishing. The explicitly requested raised cap remains 1000 mm high. An overlap correction successfully uses point-form `place-group` without rebuilding the island. Their verdicts are partial.
- The conversation test is invalidated by a development reload during its setup; its follow-up produces no model turn. It supplies no half-turn verdict. The model-free probe covers half-turn movement and history independently.
- One further image-only run (`ps_tetekkbyi7hj8k852112cdn0zh09x61`, Azure `gpt-5-mini`, high reasoning), explicitly approved by the user after automatic review requested approval, uses the refined facing guidance. It still chooses rotation 0 facing away from the back-wall kitchen aisle and omits rear finishing. The tool follows that supplied angle correctly. The planning result is partial, so the issue is not declared resolved.
- The exploratory mixed-version session used a published assistant and is not evidence for the complete local implementation. Reports, PDFs and raw evidence are retained in the ignored session folders `kitchen-5-fix`, `kitchen-5-local-fix` and `kitchen-5-facing-refinement` under `.temp/result/`, with PDFs in `.temp/reports/`.
