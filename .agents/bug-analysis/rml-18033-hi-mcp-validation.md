# RML-18033: HI MCP Validation

- **Date:** 2026-10-02
- **Author:** AI-generated validation report.
- **Status:** Partly fixed on `refactor/one-anchor-frame` — see [Resolution](#resolution); the open findings are in the [backlog](../backlog/README.md). The review itself made no production fixes.
- **Ticket:** [RML-18033](https://roomle.atlassian.net/browse/RML-18033)
- **Branch:** `review/rml-18033-hi-mcp-validation`, originally based on `d13794bb188f4b9b82d214cba421e0aef87fa995`, now rebased onto `docs/guards-as-last-resort` at `3e68df4c9842e5c1df8b2d8b249228dd3d16ae13` (review HEAD `58e7a54`).
- **Scope:** example MCP server, correction/guard behaviour, and a static MCP/client contract review of ligna-store at `51d82988f03506e2ad365f946d9c3a156c18e09f`. No ligna-store runtime testing or changes. Live example runs used the deployed `bo-test` planner, not a local roomle-ui/Core build.

## Main Findings

### 1. P1, Partially Resolved: Malformed Docking Still Cancels Valid Sibling Groups

The public `posGroups` schema still accepts arbitrary nested data. The new [liftNestedRoots](../../hi-mcp/hi-mcp-server/tool-executors.ts#L876) iterates the outer docking collection without checking it; [completeDockingEntries](../../hi-mcp/hi-mcp-server/tool-executors.ts#L918) iterates each inner collection without checking it. [keepBuildable](../../hi-mcp/hi-mcp-server/tool-executors.ts#L804) still handles returned error lists, not exceptions. The failure now occurs earlier than the original `dockedRootIds`/article-pick conversion.

**Current reproduction:** send a malformed first group and a valid second group. Both `contextData.dockedRoots = {}` and a nested `dockedRoots = {}` still throw before the valid group loads. Two expected-failure tests reproduce the remaining D30 violation.

**Resolved subcase:** `attributes = "invalid"` is now ignored with a correction by [normalizedAttributes](../../hi-mcp/hi-mcp-server/tool-executors.ts#L959), and both groups load. The former expected-failure test wrongly demanded `notLoaded` even for this successful repair. It has been replaced with a normal test asserting both the load and the correction; that test passes.

**Proposed correction:** validate/normalize nested shapes within each group's preparation and return actionable `notLoaded` entries for unbuildable groups. Do not make the outer schema reject the whole batch, and do not weaken planner checks.

### 2. P1: A JSON null bridge frame escapes the socket listener

[PageBridge.attachPage](../../hi-mcp/hi-mcp-server/page-bridge.ts#L21) catches JSON syntax errors but immediately reads `message.kind` without checking the parsed value. A connected socket sending `null` causes an uncaught TypeError in the WebSocket message listener. In the normal server process this can terminate the service and discard pending work.

**Evidence:** an expected-failure test sends `null` through the existing fake socket and asserts that the listener does not throw. It fails. Validate the wire-message shape before dispatch. This is an infrastructure boundary, not a content-authoring guard.

### 3. P1: Replies are not bound to the active planner socket

The [result handler](../../hi-mcp/hi-mcp-server/page-bridge.ts#L39) resolves pending calls by numeric ID regardless of the sending socket. A second accepted connection that never sends `hello` can answer the active page's request. The IDs are sequential.

**Evidence:** an expected-failure test connects two sockets, sends `fetchPrice` to the active one, and sends `{ price: 999 }` from the other socket before the legitimate `{ price: 42 }` reply. The forged result wins. Require the replying socket to be the active, negotiated page. This finding requires access to the same server/container's bridge; it is not a claim of unauthenticated cross-origin browser access.

### 4. P2, Still Open: Planner Partial Results Have No Reliable Per-Input Feedback

After the [batch load](../../hi-mcp/hi-mcp-server/tool-executors.ts#L1523), the server still only checks whether `loaded` is nonempty. `notLoaded` describes pre-load exclusions, not groups the planner omits. A mock returning one loaded object and one resulting group for two valid new input groups produces success without identifying the missing input group. Preserving nested units and reporting references to unsent roots do not resolve this post-load outcome gap.

**Evidence/limit:** reproduced with an expected-failure contract test, not a live planner omission. The API needs reliable input-to-result correlation before the server can fulfil D30 after loading. Counting runtime IDs is insufficient: generated/split groups and remapped IDs make that ambiguous. Agree on per-input outcomes at the planner boundary and surface them in the MCP result.

### 5. Resolved: Usage References Describe Corrections And Partial Loading

Commit `3c9538f` updated the [usage reference](../../minimal-hi-example/docs/hi-mcp-server.md#L370), [tool skill](../skills/hi-mcp-tools.md#L81) and [behaviour reference](../../hi-mcp/docs/hi-mcp-behaviour.md#L149). They now describe `corrections`, `notLoaded`, ignored existing-group placements and overlap correction. The old whole-call-rejection/Planned inconsistency is no longer an open finding. This resolves the specific documentation issue, not the runtime exceptions above.

## Changes That Affect The Earlier Conclusions

- **Nested units are preserved (`3f688c3`):** units written inside docking entries are recursively lifted into `roots`, missing partner vectors are completed, and unsent references in new groups are reported. Group attributes reach the planner; object-form overrides and unused fields receive explicit handling. The rules now distinguish a root from a reference to its id.
- **Docking recovery improved:** `3c4ae69` distinguishes unknown catalog vectors from undockable articles; `d293b02` drops redundant second-side docking when the unit already follows in the row. These address causes of earlier setup rejections, rather than simply changing their error text.
- **Original inputs are recorded:** `5ff3d12` added failed-call arguments; `3f688c3` copies arguments before mutation and logs every plan-changing call. The runner stores them as `toolCalls`. The previous limitation about unrecorded original payloads applies to our old runs only.
- **Attribution correction:** the earlier detailed-kitchen result was labelled a model-only failure based on the post-normalization planner payload. That attribution was too strong. The [new upstream analysis](units-inside-docking-entries-dropped.md) demonstrates a server defect that silently discarded nested units, and the new code fixes it. Our old GPT 08 run lacks original tool arguments, so its exact omissions cannot be retrospectively assigned to model or server; its failed outcome remains, but its model-only explanation is withdrawn.

### New Upstream Live Findings To Track

Commit `3e68df4` records a subsequent GPT suite on `3f688c3`: **6 pass, 4 partial, 3 fail**. Its detailed kitchen built all six nested units; missing oven/hood and per-unit finishes left that run partial. The committed [validation section](units-inside-docking-entries-dropped.md#validation) records three unresolved correction issues:

1. A docking ring gives the server and planner different anchors, placing the row through the wall.
2. An on-top connection is counted as a side neighbour, allowing a wall cabinet to be redirected onto a floor row. The current [sidePartnersOf](../../hi-mcp/hi-mcp-server/tool-executors.ts#L490) checks each endpoint independently, so a `Top -> Bottom` connection contributes a side entry at its Bottom endpoint.
3. Occupied-side retargeting can send an added unit to the far end even when the requested root was already the free end, placing it behind the corner.

These are **upstream-reported live findings**, not independently reproduced in this update. The referenced `.temp/result/mcp-test-2026-10-02_07-45-57/report.md` and its raw artifacts are not available in this worktree, so its verdict counts and exact geometry are attributed to the committed report. Do not treat them as model-only errors or as fixed by the guard-refactoring close-out.

### Additional Gap: Numeric Attribute Overrides

[toArticlePick](../../hi-mcp/hi-mcp-server/tool-executors.ts#L63) still forwards numeric override values unchanged, while the attribute command tools use `attributeValue` to stringify them. The new `normalizedAttributes` handles shapes and ids but preserves values. `merge-article-into-group` also forwards its attributes unchanged. The expected-failure test still confirms the creation-path discrepancy. This remains a normalization/contract gap; a live planner rejection was not established.

## MCP/Client Contract: ligna-store

- **Rebase impact:** the planner API, protocol-2 bridge and example chat adapter/step policy did not change between `d13794b` and `3e68df4`; the store remains at the commit stated above. The following static findings therefore remain applicable. No store runtime tests were added. New argument/feedback log formats are test-runner diagnostics, not changes to the MCP or browser wire contract.
- **Wire compatibility is intact:** protocol 2, all seven planner methods, positional argument forwarding, result IDs and error propagation match. The store normalizes the server base URL and passes the same `mcp_session` to chat and bridge ([Planner.vue](../../../ligna-store_2/components/blocks/Planner.vue#L257)). The correction changes themselves do not require a new browser method or protocol version; tools are discovered dynamically. Preserve `corrections` and `notLoaded` in model-visible tool results.
- **Mistral image results need the existing adapter:** the store directly uses `createMistral` ([chat.ts](../../../ligna-store_2/hi-mcp/chat.ts#L44)), whereas the example wraps it with [toolResultFilesAsUserMessages](../../hi-mcp/hi-mcp-chat/tool-result-images.ts#L65). Without equivalent handling, `get-plan-images` content is vulnerable to the documented base64-as-text/context-overflow problem. Static integration finding, not a new store runtime reproduction.
- **Step-limit behaviour differs:** the store stops at eight steps without a final tool-free step ([chat.ts](../../../ligna-store_2/hi-mcp/chat.ts#L76)). The example uses sixteen and reserves the last for an answer ([chat-steps.ts](../../hi-mcp/hi-mcp-chat/chat-steps.ts#L10)). Correction/retry-heavy turns can therefore end without a summary in the store. Reuse the terminal-answer policy; the number of steps is a separate product choice.
- **Session routing is not authentication:** a unique session must reach both `/mcp` and `/bridge`. Missing sessions share the worker's `default` container ([worker.ts](../../hi-mcp/cf/src/worker.ts#L10)); its newest page takes over the bridge. Current forwarding is correct when configured. Use an appropriately isolated session and a trusted server URL; the origin allow-list is not user authorization. Do not retry timed-out mutations blindly: a bridge timeout does not establish that the planner made no change.

## Validation And Limits

- **Current full suite:** 267 test cases completed with zero unexpected failures: **261 ordinary passes and six expected failures**. `npm --prefix hi-mcp run typecheck`, report-link checks and `git diff --check` passed. These are the results for the rebased code plus the corrected validation probe.
- **Current focused revalidation:** seven RML-18033 cases completed with zero unexpected failures: **one ordinary test verifies repaired attribute handling; six `it.fails` cases retain the unresolved docking, bridge, numeric-value and planner-outcome gaps**. Expected failures alone do not establish an unchanged root cause. Probes reuse [tool-executors.test.ts](../../hi-mcp/hi-mcp-server/tests/tool-executors.test.ts#L383) and [page-bridge.test.ts](../../hi-mcp/hi-mcp-server/tests/page-bridge.test.ts#L106).
- **Original baseline only (`d13794b`):** 261 test cases (254 ordinary passes, seven expected failures) and typecheck passed. These original totals are not the rebased suite count. No production files were changed by this review.
- **Original live coverage only (`d13794b`):** 13 GPT-5.4-mini prompts and two Mistral Large prompts, with snapshots, planner calls, numeric checks and selected image inspection. Outcomes remain **8 pass, 1 partial, 6 fail**, but the detailed-kitchen cause is reclassified above. The remaining eleven Mistral prompts were not run after the request to finish; image-dependent prompts were excluded. No live suite was rerun for this update.
- A downstream planner issue was reproduced: after delete-middle then merge, the group starts at z `-3885` while the back wall is at `-3765`, a 120 mm overhang; width is 1920 mm. Snapshot `ps_qoro9fdy7uw9vnasc3aza96ci8r2iia` matches the [existing open analysis](merged-group-toe-kick-reaches-into-the-wall.md). The MCP forwarded the merge command; this is not attributed to the new server corrections.
- One preliminary GPT run had two chat requests on shared ports and produced duplicate groups. It was excluded, repeated on isolated ports, and not classified as a product defect. Port 3000's existing service was left untouched. All isolated validation services are stopped.
- Detailed run inventory and local evidence: [report.md](../../.temp/result/rml-18033-validation/report.md). The live suite is incomplete for Mistral and is not a production/deployment certification.

## Resolution

On `refactor/one-anchor-frame`, after the merge of this branch (2026-10-02):

| Finding | Status | Where |
|---|---|---|
| 1. Malformed docking cancels valid sibling groups | **Fixed.** Docking that cannot be read is dropped and reported, its root is docked like any undocked root, and the group loads (G29). Input that still fails a group's preparation sends that group to `notLoaded`, and the other groups load (G30) | `dropMalformedDocking`, `keepBuildable` in `tool-executors.ts`; tests "drops malformed docking data …" and "reports a group it cannot read …" |
| 2. A JSON null frame escapes the socket listener | **Fixed.** A frame that is not a JSON object is ignored | `page-bridge.ts`; the probe is a regular test now |
| 3. Replies are not bound to the active planner socket | **Fixed.** A result counts only from the active page. Every call goes there, and a newer page rejects the calls of the old one | `page-bridge.ts`; the probe is a regular test now |
| 4. Planner partial results have no per-input feedback | Open — needs per-input outcomes from the planner | [backlog](../backlog/README.md); the probe stays an expected failure |
| Numeric attribute overrides | **No defect.** The layout's `PosModuleAttribute.value` and the article pick's `HiPlanRootAttribute.value` are `number \| string \| boolean` (roomle-ui `model/oc-scripts-domain.model.ts`, `hi-plan-context.ts`). Only the attribute commands take strings, and the server converts those (C11) | the probe asserts that numbers pass on unchanged |
| Docking ring, on-top neighbour, occupied-side retargeting | Open | [open issues 1–3](../backlog/mcp-test-open-issues.md) |
| ligna-store: Mistral image adapter, final tool-free step, session routing | Open — ligna-store | [backlog](../backlog/README.md) |
| Merged group reaches into the back wall | Open — roomle-ui | [open issue 11](../backlog/mcp-test-open-issues.md#11-a-merged-group-reaches-into-the-back-wall) |

The line references of the findings above point at `3e68df4`.
