# The image planning on the right wall run ends in a provider connection reset

> **Status:** Open — analysis; transport failure, no product defect identified
> **Date:** 2026-10-11
> **Evidence:** `.temp/result/mcp-test-2026-10-11_09-24-39/gpt-6-astra/31-image-planning-right-wall/`

## Affected repositories

- **roomle-hi-example** — no productive change indicated. The finding concerns the test run's
  provider transport and the test runner's diagnostics; the MCP server, the chat backend, the
  example page and the launcher behave as designed.
- **roomle-ui**, **RoomleCore**, **ligna-store** — unchanged.

## Symptom

Test 31 of the last run, `31-image-planning-right-wall`, produced no planning. The prompt is
`create a planning as to the one shown in the picture on the right-hand wall of the room.` with
`docs/images/kitchen-3.jpeg` attached, against the `default-room` plan
(`ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`).

The report block reads:

- “The assistant's reply was interrupted. Any text above is incomplete.”
- “The plan context was read.”
- “No plan-changing tool ran, so nothing was created or changed.”
- Tools: `get-plan-context`, `get-authoring-rules`, `find-attributes` ×5
- Errors: `Failed to process successful response`
- Plan snapshot: `ps_rj2124399ndn7q9g3bxyxoz09i5g21yr`

The run is a **read-only** failure: the agent inspected the plan and the attribute vocabulary and
was interrupted before it authored a group. Nothing was created, changed or lost.

## Investigation trace

### The tool sequence is correct

`console.log` records the calls in order:

1. `get-plan-context` with `["rooms","articles","groups","obstacles"]` — the plan and the article
   catalog.
2. `get-authoring-rules` — 9 ms.
3. Five `find-attributes` calls, each backed by
   `getExternalObjectPlanContext [["masterData","groups"]]`, 13–19 ms each.

Every call succeeded. The agent was doing what the served rules ask: read the plan, read the
authoring rules, then look up the attribute vocabulary for the fronts it intended to set. The five
`find-attributes` calls are redundant — one lookup per requested property would have been enough —
but they are not wrong, and they are not the failure.

### The failure is in the provider step, not in a tool

`console.log` records the step boundaries the chat backend emits:

```text
step 1: 7318 in, 75 out, 0 reasoning tokens; tools: get-plan-context, get-authoring-rules, find-attributes; tool-calls; 7084 ms
step 2: 64979 in, 177 out, 40 reasoning tokens; tools: find-attributes ×4; tool-calls; 7846 ms
step 3 failed after 63315 ms: AI_APICallError: Failed to process successful response, status 200,
  url https://dfhifoundrysweden.services.ai.azure.com/openai/v1/responses,
  request f841e583-458d-4ae3-9b93-d376a85cf19a
  <- caused by TypeError: terminated
  <- caused by Error: read ECONNRESET
```

The chain is unambiguous. The HTTP request **succeeded** — status 200 — and the failure happened
while the response body was being read: `TypeError: terminated` caused by `read ECONNRESET`. The
socket was reset mid-stream by the provider or by something between the client and the provider.
This is a transport failure, not a response-validation failure, not a tool failure and not a
planner failure.

The message text `Failed to process successful response` is the AI SDK's wrapper for “handling a
successful HTTP response threw” (`@ai-sdk/provider-utils/src/post-to-api.ts`); the cause chain
below it is what identifies the real failure. The same wrapper appears on other provider failures,
where the cause chain is often **not** captured and the underlying cause stays unknown. Here the
cause chain **is** captured, and it names a connection reset.

### The step-3 line is absent, and that is itself the diagnostic

The chat backend emits the `step N:` line only when the step completes. Run 31 has **no step-3
line at all** — the failure line replaces it. Across the 44 runs of the session, 51 step-3 lines
exist; run 31 is the only run whose step 3 has no completion line. A missing step line therefore
marks the interrupted step, and the failure line that follows it carries the cause.

### The request was large, but not exceptionally so

The step-2 input of 64979 tokens is the **second largest** step-2 input of the session (the largest
is 65153, run 30). The largest step-3 inputs of the session are 143213 (run 35), 67187 (run 30),
66314 (run 34), 65201 (run 32) and 63369 (run 35) — all of which completed. Run 31's step-3 input
is not recorded, but its step 2 sat in the same band as the successful large runs. Context size
alone does not explain the reset.

### The latency is far outside the session's distribution

| Step | Lines | p50 | p90 | max | Run 31 |
| --- | --- | --- | --- | --- | --- |
| 1 | 58 | 2929 ms | 4134 ms | 7084 ms | **7084 ms — the slowest step 1 of the session** |
| 2 | 58 | 6152 ms | 8792 ms | 12869 ms | 7846 ms — normal |
| 3 | 51 | 4461 ms | 14417 ms | 21865 ms | **63315 ms before failing — 2.9× the slowest successful step 3** |
| 4 | 22 | 4295 ms | 8909 ms | 11189 ms | — |
| 5 | 10 | 9186 ms | 25909 ms | 25909 ms | — |
| 6 | 6 | 6459 ms | 9511 ms | 9511 ms | — |
| 7 | 3 | 4095 ms | 6336 ms | 6336 ms | — |
| 8 | 3 | 6279 ms | 19146 ms | 19146 ms | — |
| 9 | 2 | 13038 ms | 13038 ms | 13038 ms | — |
| 10 | 1 | 5541 ms | 5541 ms | 5541 ms | — |

Step 10 is the highest step number reached in the whole session; steps 11 and above have no lines.
Run 31's step 1 was the slowest of all runs and its step 3 ran for 63 s — nearly three times the
slowest successful step 3 — before the connection was reset. The provider was slow on this request
and then dropped it.

### The runner behaved correctly

After the chat failed, the runner read the plan context (`get-plan-context` with
`["rooms","groups","obstacles"]`) and wrote the report block above. It recorded the error, the tool
list and the resulting snapshot id. The recovery summary is the contract of the chat's provider
failure recovery: an interrupted turn ends with one truthful outcome message naming what completed
and what did not. It did exactly that.

## Root cause

The Azure `responses` endpoint returned HTTP 200 and then reset the connection while the response
body was streaming, after the request had been in flight for 63 s. The AI SDK surfaced this as
`AI_APICallError: Failed to process successful response` with the cause chain
`TypeError: terminated` ← `Error: read ECONNRESET`.

No code in roomle-hi-example, roomle-ui, RoomleCore or ligna-store produced the failure. The agent
had inflated the request with five redundant `find-attributes` calls, which lengthened the step and
made the connection more likely to be dropped, but the drop itself is the provider's.

## Why this is not a product bug

- Every tool call succeeded; the planner was never asked to do anything wrong.
- The failure is below the application: a socket reset on a 200 response.
- The same failure mode is a known provider-side risk; this run supplies the cause chain for that
  class of failure.
- The run is read-only, so nothing was lost and nothing needs to be undone.

## Proposed change

**No productive change.** The failure is a flaky provider transport failure and the runner already
reports it truthfully. Two optional, non-blocking follow-ups:

1. **Reduce the redundant attribute lookups.** The agent issued five `find-attributes` calls where
   one or two would do. The served rules and the `find-attributes` tool description can say that
   one call returns every matching attribute with its allowed values, so a second call is only
   needed for a different search text. This shortens the request and reduces the window in which a
   connection can be dropped. It is an instruction clarification, not a guard.
2. **Record the failure cause chain in the run result.** The `console.log` carries the full cause
   chain, but `run.json` records only the top-level message. Persisting the cause chain would let a
   later analysis distinguish a transport reset from a response-validation failure without reading
   the console log. This is test-infrastructure work and belongs with the other test-runner items.

Neither follow-up is required to close this analysis; the run is a flaky infrastructure failure, not
a reproducible defect.
