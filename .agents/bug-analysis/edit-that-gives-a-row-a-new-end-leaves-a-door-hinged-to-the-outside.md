# Bug analysis — an edit that gives a row a new end leaves a door hinged to the outside

> **Type**: Bug analysis
> **Status**: Open — verified; fix and unit tests planned, not implemented
> **Date**: 2026-10-17
> **Verified**: 2026-10-18
> **Base**: roomle-hi-example `master` (`e9d996f`)
> **Required roomle-ui base**: `fix/generated-part-switch-discovery` (`cf377cfd4`),
> verified as the current local branch; any roomle-ui implementation must branch from it
> **Backlog**: [MCP issue 77](../backlog/mcp-issues.md#77-an-edit-that-gives-a-row-a-new-end-leaves-a-door-hinged-to-the-outside)

## Affected repositories

- **roomle-hi-example** — put the D84 end-door reminder once in the `get-plan-context`
  description; add a tool-list regression, prompt acceptance cases and the corresponding
  behaviour, tool and implementation documentation.

## Verification verdict

The symptom and the instruction-delivery gap are confirmed. The proposed fix belongs in the
served text; preserving supplied attributes is legitimate planner behaviour. The original
analysis needs these corrections:

- The library's attribute description already explains the right-end setting. The model is not
  wholly without door guidance: the missing general instruction is the trigger to reconsider a
  door after an edit changes its position in a row. Stored runs support this diagnosis but do not
  prove that missing authoring rules are its sole cause.
- Plan-context attributes contain input values only. In the failing cases the door setting is
  absent there; `Automatic` is visible in order data, not explicitly in the next context.
- Deleting a middle unit can create new ends on both remaining rows. A replacement through
  `create-or-replace-groups` can change ends too; the five command tools are not an exhaustive list.
- Swap and delete preserve surviving roots' attributes. Merge and exchange inherit only
  `implicitRelevant` attributes; the stored door-direction attribute has that flag set to false.
- A generic library-neutral result reminder is possible without interpreting a door attribute.
  D84 rejects automatic library-specific hinge correction, not generic feedback.

No roomle-ui implementation is needed for the proposed fix. If acceptance establishes a need
for result feedback, investigate that separately on a branch created from
`fix/generated-part-switch-discovery`. The older `fix/room-corners-at-openings` base in this
analysis is superseded by the user's required base. RoomleCore, the library and ligna-store
require no implementation changes for this plan.

## Symptom and reproduction

Load the saved `three-tall-units` plan referenced by `docs/test-prompts.json`:

1. Ask “delete the middle unit”.
2. Say “that was the wrong unit - remove the last unit, not the middle one”.
3. The agent undoes the deletion and deletes the last unit. The remaining middle unit becomes
   the right end, with its door still hinged left and its handle at the outside.

**Current stored reproduction:**
`.temp/result/mcp-test-2026-10-18_14-48-28/gpt-6-astra/36-undo-a-wrong-command/`.
`run.json` records `get-plan-context`, `delete-article-in-place`, then `undo` and
`delete-article-in-place`; neither turn fetches `get-authoring-rules`. The final delete names
`8774cac2-8b83-405d-b88c-f0e5cd2452fb`. In `order-data.json`, the new right end
`a7271f1b-50d5-4b50-97ca-7a5bf75f77fa` stands at local x 600 and carries
`mod_DoorDirectionSelection=Automatic`. Its final context entry has `rowIndex: 2` and no
door-direction input override.

**Successful swap with unsuitable end doors:**
`.temp/result/mcp-test-2026-10-17_13-28-41/gpt-6-astra/32-edit-swap-units/`.
After widening the last unit, turn 2 swaps the ends without corrections. Final local x positions
are 0, 900 and 1500 for `8774cac2…`, `a7271f1b…` and `0010443c…`. Order data shows `Automatic`
on all three. Neither turn fetches the rules; the former left end becomes the right end without
a door-direction override.

The starting saved plan already has the right-end problem. These traces show that edits leave
an unsuitable setting at a new end; they do not alone prove that an initially correct row becomes
wrong. Acceptance must also start with a correctly hinged row and swap its ends.

The newer `2026-10-18_14-48-28/32-edit-swap-units` is not evidence of a completed swap:
the tool reports missing docking vectors and the agent undoes it (MCP issue 78). Use a swap
without the preceding width change to isolate the door behaviour.

The older batch's `12-wardrobe-door-hinges` and `33-wardrobe-extend-door-hinge` show that
explicit settings work: the agent reads the rules, sets the ends to `Left` and `Right`, and sets
the new right end to `Right` while the former end keeps `Right`. Those different requests and
articles provide supporting observations, not a controlled comparison. The newer batch's
wardrobe cases do not establish the same successful outcomes.

## Investigation trace and root cause

| Location at the verified base | Finding |
|---|---|
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts:27` | `AUTHORING_RULES` states the end-door rule, the single/paired-door distinction, the edit trigger and preservation of other directions. |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts:281` | `get-authoring-rules` returns that text; its description asks for it before authoring pos groups, without explicitly requiring it for every command edit. |
| `hi-mcp/hi-mcp-chat/chat-stream.ts:81,128`; ligna-store `hi-mcp/chat.ts:132,138` | Both chats obtain the MCP tools and supply the planner's system prompt to `streamText`; neither appends the MCP initialize instructions. The whole tool list reaches the model even when a tool is not called. |
| roomle-ui `homag-intelligence/src/hi-agent-prompts.ts:11` | The planner prompt names skills and the tool workflow, but contains no end-door rule. |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts:195,594,610,640,726,751` | Neither the context description nor the five edit descriptions supplies the end-door trigger. |
| roomle-ui `homag-intelligence/src/hi-tools.ts:908` | Swap exchanges side docking and placement while attributes stay with their roots; `__tests__/hi-tools-test.ts:2382` explicitly checks preservation. |
| roomle-ui `homag-intelligence/src/hi-tools.ts:566,617`; `glue-logic.ts:1428,1489,2502` | Merge and exchange inherit library-designated attributes; explicit overrides win. They do not derive door settings from row position. |
| roomle-ui `homag-intelligence/src/hi-plan-context.ts:689` | `shapeRoot` returns only attributes with `isInput === true`, explaining the absent default. |
| roomle-ui `homag-intelligence/src/hi-tool-docking.ts:1078` | `withRowIndices` numbers side-connected rows from the left; singleton roots have no index. Floor and upper rows are separate. |
| `docs/library-information/master-data.json`, `mod_DoorDirectionSelection` | The attribute is main, Simple and not implicit-relevant. Its descriptions explain hinge sides; a single door's `Automatic` resolves to left regardless of row position. |

roomle-ui paths above are relative to `packages/web-sdk/packages/`. The library behaviour is
also documented in [HI concepts](../skills/roomle-hi-concepts.md#attribute-groups) and the probe
table of [library issue 76](../backlog/library-issues.md#76-articles-with-two-doors-that-do-not-say-how-their-doors-stand).

The actionable root cause is a missing edit trigger in the general guidance the chats always send
to the model. D84's full rule is on demand; command descriptions explain geometry and attribute
preservation. An edit changes which root is an end without changing its door input, and the agent
supplies no position-appropriate override. The planner accepting the edit is not itself the cause.

## Proposed fix

Add this reminder once to the `get-plan-context` description beside `rowIndex` and input attributes:

> When an edit gives a row a new end, hinge its end doors at the outer sides: left at the left end,
> right at the right end, as seen from the front. Choose the attribute and value from the library's
> descriptions for single or paired doors, and keep other door directions unchanged.

Both chats send the whole tool list, so five copies in the edit descriptions provide no additional
delivery coverage. The context description already carries shared instructions for mounting and
openings. This reminder reaches rebuilds and deletions that split a row too. `AUTHORING_RULES`
keeps the full D84 rule. This is the first implementation to try; acceptance must establish its effect.

The agent uses `rowIndex` within each resulting side-connected row, not root-array order or one
maximum index across every root of a group. Drawer-only roots receive no door setting; paired
doors take their library-described arrangement. D84 does not define a left/right preference for a
standalone single-door cabinet, so the change must not prescribe opposite settings for one root.

Merge and exchange can take the end setting in `attributes`. Swap and deletion need a follow-up
`change-module-attribute` on the affected surviving roots, using the edit result's ids. Unrelated
inputs stay intact, including the former end after extension. Different ends can need different
values; a group-wide setting is unsuitable.

No new guard, automatic hinge correction, planner method, result field or library calculation is
needed. A generic result reminder remains a feasible fallback if targeted acceptance demonstrates
that need. Forwarding all MCP instructions would change both chats and repeat the full rules in
every step, beyond the missing trigger.

## Unit-test plan

In `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, beside the D84 test at line 947:

1. Add a regression that connects the in-memory client and calls **only `listTools()`**. Inspect
   `get-plan-context.description`, without fetching rules or using `client.getInstructions()`
   to satisfy assertions. Check the edit/new-end trigger, left/right hinge sides as seen from the
   front, selection through library descriptions for single/paired doors, and preservation of
   other directions. It must fail at `e9d996f`, then pass with the description change.
2. Keep the existing D84 assertions: full rules and initialize instructions retain the rule;
   the served text, including every tool description, contains neither `mod_DoorDirection` nor
   `mod_HandlePosType`. Add a targeted assertion excluding the library token `LeftRight` from
   the new description; ordinary spatial words left/right remain valid.
3. Run `npm test -- hi-mcp-server/tests/hi-mcp-server.test.ts`, then `npm test` and
   `npm run typecheck` in `hi-mcp/`; run root lint and format scripts for the implementation.
   No new roomle-ui unit tests are needed for this served-text change. Existing attribute
   preservation tests verify the planner contract, not the agent's hinge choice.

The text regression proves delivery, not model compliance or rendered door orientation.

## Prompt acceptance plan

User prompts carry no tool setup operations or implementation hints (ADR 0006). Evaluate the
requested edit and the hinge outcome using each turn's trace, final input attributes, order data
and rendering together.

| Case | Required observation |
|---|---|
| New isolated swap on `three-tall-units`: “swap the first and the last unit” | Swap completes without resizing or issue 78; new ends follow D84. Inspect whether it succeeds without fetching rules. |
| New two-turn wardrobe case: create three single-door cabinets, then swap the ends | Verify correct initial hinges, then that both new ends are corrected and the middle input settings stay. |
| Existing `undo-a-wrong-command` | Final two-unit row has its new right end hinged right; deletion and undo still produce the requested row. |
| Delete the middle of five single-door units | Both surviving two-unit rows have their exposed ends set; unchanged outer ends retain their settings. Two singleton remnants are not a test of a two-ended row rule. |
| Existing `wardrobe-extend-door-hinge` | New right end hinges right; former end keeps right. Evaluate merge or replacement according to the trace. |
| Exchange an end for another single-door article | Replacement receives the end setting through overrides or a follow-up; unrelated roots retain theirs. |
| Paired-door and drawer ends | A pair uses its valid library arrangement; an article without a door receives no invented hinge input. |

Extend the expectations of `edit-swap-units` and `undo-a-wrong-command` in
`docs/test-prompts.json`. Keep the isolated swap alongside the width-changing one until issue 78
is resolved: a refused or undone swap is not passing door acceptance. A requested hinge input
that is not carried or built is a failed acceptance even if the answer claims success.

## Implementation sequence and documentation

1. Write the tool-list regression and demonstrate failure → verify the delivery gap.
2. Add the reminder at `hi-mcp-server.ts:214` → verify targeted and full MCP tests, typecheck,
   lint and format checks.
3. In the same implementation change, update D84 and §6 `get-plan-context` in
   [the behaviour reference](../../docs/hi-mcp-behaviour.md), the context sections of
   [the server reference](../../docs/hi-mcp-server.md) and
   [the tool skill](../skills/hi-mcp-tools.md), and the served-text delivery explanation in
   [implementation context](../context/mcp-server.md). Update §4's on-demand-rules wording to
   distinguish the full authoring rules from reminders in tool descriptions. Living references
   describe effective behaviour, without this bug's history.
4. Add/update and run the prompt cases. A local planner must retain
   `fix/generated-part-switch-discovery` (`cf377cfd4`) as its base. Any roomle-ui fallback branches
   from that branch, not `master` or an older fix branch.
5. Record actual acceptance results here; remove issue 77 only after implementation and outcomes
   are verified.

## Validation performed for this investigation

- Compared current server/chat code and the required local roomle-ui base with the stored
  traces and order/context data above. No live model or planner replay is claimed.
- Ran `npm test -- hi-mcp-server/tests/hi-mcp-server.test.ts`: **77 tests passed**, including
  existing D84 assertions. Those check the full rules, so they can pass with this delivery gap.
- The new regression, description change and prompt cases remain planned only.
