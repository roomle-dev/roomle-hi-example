# Backlog

What is still to be done in and around roomle-hi-example: defects, hardening and follow-ups, one row
per item. The backlog holds open work only. An item leaves it when its fix is in the code; the
analysis it links keeps the history.

## Planning by the MCP server (found by "test the mcp")

Details, causes, tests and how to reproduce: [mcp-test-open-issues.md](mcp-test-open-issues.md).

| Item | To do | Priority |
|---|---|---|
| [23 — A worktop colour change drops hanging wall units onto the worktop](mcp-test-open-issues.md#23-a-worktop-colour-change-drops-hanging-wall-units-onto-the-worktop) | roomle-ui: open a ticket, find where the hang offset is lost after the kitchen-wide colour commands, fix it | high |
| [40 — A unit colour after a kitchen-wide colour misses the doors](mcp-test-open-issues.md#40-a-unit-colour-after-a-kitchen-wide-colour-misses-the-doors) | roomle-ui: `change-module-attribute` without `moduleId` sets the attribute on the root and its sub modules | high |
| [35 — The handleless right corner unit as the first root with two legs stands 239 mm in the wall](mcp-test-open-issues.md#35-the-handleless-right-corner-unit-as-the-first-root-with-two-legs-stands-239-mm-in-the-wall) | Reproduce, compare the anchor frames of `EUERTB90` and `UERTB90`, fix the frame or report the planner defect | high |
| [49 — A new group stands on an obstacle](mcp-test-open-issues.md#49-a-new-group-stands-on-an-obstacle) | A hint in the results of `create-or-replace-groups` and `place-group`: the root modules on an obstacle and the free stretches of the wall | high |
| [27 — A new group needs a point the model computes](mcp-test-open-issues.md#27-a-new-group-needs-a-point-the-model-computes) | Decide D23 (`placement { wall, alignment, offsetMm }`); meanwhile say which corner a wall's `end` is | high |
| [43 — "Delete" and "remove" are taken for each other](mcp-test-open-issues.md#43-delete-and-remove-are-taken-for-each-other) | Analyse the tool choice, make the user's verb open both descriptions in the same words | high |
| [45 — "The middle unit" read from the docking](mcp-test-open-issues.md#45-the-middle-unit-read-from-the-docking) | A row position per root in the plan context | medium |
| [46 — A new group beside an existing one](mcp-test-open-issues.md#46-a-new-group-beside-an-existing-one-for-add-a-cabinet-to-the-right-of-the-kitchen) | One clause in the `create-or-replace-groups` description: an article beside a group goes into it | medium |
| [48 — A worktop colour sent as `mod_PaneltopColor`](mcp-test-open-issues.md#48-a-worktop-colour-sent-as-mod_paneltopcolor) | `find-attributes` returns `mod_CountertopColor` first for "worktop" | medium |
| [39 — A unit merged into a coloured kitchen keeps the default material](mcp-test-open-issues.md#39-a-unit-merged-into-a-coloured-kitchen-keeps-the-default-material) | `merge-article-into-group` gives the new unit the material its group shares, reported | medium |
| [36 — A wall-unit row runs into a unit hung above a base unit](mcp-test-open-issues.md#36-a-wall-unit-row-runs-into-a-unit-hung-above-a-base-unit) | Check the place by the catalog widths when compiling, also for G44's own move | medium |
| [42 — A wall unit that keeps its place overlaps the unit that moved in below it](mcp-test-open-issues.md#42-a-wall-unit-that-keeps-its-place-overlaps-the-unit-that-moved-in-below-it) | The remove's correction names the overlapped unit and what to do | medium |
| [41 — A row edit puts a unit in front of a door without a hint](mcp-test-open-issues.md#41-a-row-edit-puts-a-unit-in-front-of-a-door-without-a-hint) | The D43 hint names an opening the row now stands in front of | low |
| [37 — A first call with a guessed payload](mcp-test-open-issues.md#37-a-first-call-with-a-guessed-payload) | One clause in the `create-or-replace-groups` description: all units in `roots` from the first call | low |
| [47 — A root id sent as the group id is refused](mcp-test-open-issues.md#47-a-root-id-sent-as-the-group-id-is-refused) | `findGroup` reads a root id as its group, reported | low |
| [38 — A provider answer the AI SDK cannot process ends the turn without an answer](mcp-test-open-issues.md#38-a-provider-answer-the-ai-sdk-cannot-process-ends-the-turn-without-an-answer) | Log the failing step with the provider's response; decide on a retry | low |
| [13 — Undocked wall units reject the whole group](mcp-test-open-issues.md#13-undocked-wall-units-reject-the-whole-group) | Hang the first undocked wall unit above a floor unit, reported; the refusal shows the relations | low |
| [3 — A docking ring anchors the wrong root](mcp-test-open-issues.md#3-a-docking-ring-anchors-the-wrong-root) | Break the ring in `completeDocking`, reported (`contextData` only) | low |
| [7 — Docking to a vector the article does not have](mcp-test-open-issues.md#7-docking-to-a-vector-the-article-does-not-have) | Check the vectors where they are known, correct or drop, reported (`contextData` only) | low |
| [14 — A floor unit is docked onto a top vector](mcp-test-open-issues.md#14-a-floor-unit-is-docked-onto-a-top-vector) | Decide the exceptions, then dock it beside the unit, reported (`contextData` only) | low |
| [15 — A G7 correction docks a part by a wall unit at floor level](mcp-test-open-issues.md#15-a-g7-correction-docks-a-part-by-a-wall-unit-at-floor-level) | Filter G7's lead by the target's kind (`contextData` only) | low |

## Planner (roomle-ui, RoomleCore)

| Item | To do | Details |
|---|---|---|
| `delete-root-module` makes wall units groups of their own | The kernel's deletion splits a group by docking, and after a load the wall units are no longer docked to the floor units: deleting a floor unit, or a corner article with `remove-article-from-group`, leaves every cluster of wall units as a group of its own. Keep the wall units with the floor units they hang above | [RML-18045 plan, open issues](../feature-analysis/insert-remove-replace-swap-units-implementation-plan.md#open-issues) |
| A group the planner leaves out is not reported | `create-or-replace-groups` treats a non-empty load as success, so a group of the call the planner does not build is not named in `notLoaded`. Needs per-input outcomes from the planner (roomle-ui contract); counting runtime ids is ambiguous with split and generated groups | [RML-18033 validation, finding 4](../bug-analysis/rml-18033-hi-mcp-validation.md#4-p2-still-open-planner-partial-results-have-no-reliable-per-input-feedback) |
| Article template geometry in the plan context | Measure the cost of calculating the article templates, then let the plan context carry docking vectors and corner points for every article, and remove the server's probe | [roomle-ui-article-template-geometry.md](roomle-ui-article-template-geometry.md) |

## Chat

| Item | To do | Details |
|---|---|---|
| Reasoning effort for the GPT chat models | Make the reasoning tokens measurable, run gpt-5.4-mini at the same effort as gpt-5-mini, decide the chat's model and effort | [reasoning-effort-for-the-gpt-chat-models.md](reasoning-effort-for-the-gpt-chat-models.md) |

## Test infrastructure

Details: [mcp-test-infrastructure-issues.md](mcp-test-infrastructure-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — The object-only perspective render draws an empty frame under software GL](mcp-test-infrastructure-issues.md#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | roomle-ui: find why the frame is dropped under SwiftShader | low |
| [2 — The hint of a tool result is not recorded](mcp-test-infrastructure-issues.md#2-the-hint-of-a-tool-result-is-not-recorded) | Log the `hint` and store it per tool call in `run.json` | medium |
| [3 — A run whose page navigates after the chat stores no snapshot](mcp-test-infrastructure-issues.md#3-a-run-whose-page-navigates-after-the-chat-stores-no-snapshot) | Log the page's navigations; repeat a run without a plan snapshot id once | low |

## ligna-store

| Item | To do | Details |
|---|---|---|
| The chat prompt names only kitchens | `hi-mcp/chat.ts` opens with "a planning assistant for a HOMAG Intelligence (HI) kitchen". Take the two sentences of the example chat: every kind of HI furniture, and the closest article of the catalog instead of asking (D44) | [insert-between-not-chosen-for-a-wardrobe-group.md](../bug-analysis/insert-between-not-chosen-for-a-wardrobe-group.md) |
| The chat lacks the Mistral image adapter | Wrap `createMistral` with `toolResultFilesAsUserMessages` (`hi-mcp-chat/tool-result-images.ts`), so the images of `get-plan-images` do not reach Mistral as base64 text | [RML-18033 validation, ligna-store](../bug-analysis/rml-18033-hi-mcp-validation.md#mcpclient-contract-ligna-store) |
| The chat can end a turn without an answer | `stopWhen: stepCountIs(8)` has no final tool-free step; take the example's step policy (`hi-mcp-chat/chat-steps.ts`) | [RML-18033 validation, ligna-store](../bug-analysis/rml-18033-hi-mcp-validation.md#mcpclient-contract-ligna-store) |
| One session per user on `/mcp` and `/bridge` | Verify that the store sends one session per user to both; without it, pages share the Cloudflare `default` container and the newest page takes the bridge over | [RML-18033 validation, ligna-store](../bug-analysis/rml-18033-hi-mcp-validation.md#mcpclient-contract-ligna-store) |
