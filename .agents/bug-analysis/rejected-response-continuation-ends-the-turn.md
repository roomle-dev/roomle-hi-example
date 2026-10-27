# A rejected response continuation ends the turn

- **Type:** Bug analysis
- **Status:** Open
- **Date:** 2026-10-27
- **Base:** roomle-ui `feat/hi-mcp-performance` (`c0eea9302`); roomle-hi-example `feat/test-report-planning-time`
- **Backlog:** [mcp-issues.md, 114](../backlog/mcp-issues.md#114-the-provider-rejects-a-chained-model-request-of-a-turn)

## Affected repositories

- **roomle-ui** — the planning assistant of the embedding-lib (`hi-planning-assistant.ts`)
  continues a turn without the chain when the provider rejects a chained request; tests in
  `tests/unit/embedding-lib/homag-intelligence/`; the continuation contract in
  `.agents/homag-intelligence/prompt-caching.md`.
- **roomle-hi-example** — this analysis and its backlog item; the example page pins the
  embedding-lib build that carries the fix (a new dev build, built only after a go).
- **ligna-store** — runs the same planning assistant and gets the fix with the same build.
- **Planner (web-sdk)** — unchanged: the tools are not involved.

## Symptom and reproduction

Two turns of `mcp-test-2026-10-27_07-11-41` (gpt-6-astra, Azure Responses, embedding-lib
`0.0.0-dev-432119f`) end with "The planning assistant failed: …" and no answer:

| Run | Step | Error | Before it |
|---|---|---|---|
| 28 `sideboard-row-one-more-cabinet` | 3 | "No tool output found for function call call_rCmQVJvuNV29gLHzeaVAmHsn." | steps 0 to 2 completed (`get-plan-context`, `get-skill`, `merge-article-into-group`); the merge changed the plan |
| 74 `kitchen-conversation`, turn 1 | 1 | "Previous response with id 'resp_010c0eaf77f2bd55006ae050bd06d8819091a1c8db8f18e93e' not found." | step 0 completed (`get-skill`); the conversation of seven turns ends in its first |

Both are 400 rejections of the provider (`AI_APICallError`, `console.log` lines 22 and 14), which
the AI SDK does not retry. They do not reproduce on demand: 97 of the session's 99 turns chained
419 requests without one. A unit test reproduces the consequence: in the continuation spec, a
fetch stub that answers the second request with a 400 continuation error ends the turn with the
error output.

## Investigation

- `hi-planning-assistant.ts:280` — `prepareStep` chains every step after the first: it sends
  `previousResponseId` (the previous step's provider response id, `:317`) with `store: true`,
  `instructions: []` and only the tool messages of the previous step. Everything earlier — the
  library reference, the history, the user message, the earlier calls and results — the provider
  holds in the stored response.
- `hi-planning-assistant.ts:330` — any `error` part of the stream ends the turn (`throw
  part.error`), and `:346` outputs it. No path leads from a rejected chained request back to a
  request with the whole history, although the assistant holds it: the turn's input
  (`referenceMessages`, `messages`, `userMessage`) and the messages of every completed step
  (`step.response.messages`).
- roomle-ui `.agents/homag-intelligence/prompt-caching.md`, "Responses continuations": "No failed
  turn is automatically replayed"; chaining "requires stored response support".
- The request diagnostics of run 28 show the steps `0, 1, 2, 2, 3`: the step-2 request went out
  twice (a retry of the AI SDK, which retries up to two times), and step 3 was rejected. Run 74
  shows `0, 1`: step 1 was rejected.
- Retries do not come from the chaining: `mcp-test-2026-10-26_11-51-16`, before it, made 0.30
  extra attempts per model call, this session 0.29; 33 of 99 turns retried a request, 13 times the
  unchained step 0. About 50 chained steps followed a retried step, and only run 28's failed. A
  retry alone does not explain the rejection.
- The client's state was complete in both cases: run 28 sent the output of the merge call it
  executed (feedback at `console.log` line 21); run 74's previous response had completed
  (`finishReason` `tool-calls`, usage reported) before the next request named it.
- The diagnostics record each request's bytes, digest and step, but not the `previous_response_id`
  it sent, the response ids or the call ids: which call `call_rCm…` is, and whether the provider
  missed the merge output or an earlier one, cannot be told from the run.

## Root cause

`hi-planning-assistant.ts:280` together with `:330`: every step after the first depends on the
provider's stored state of the previous response, and a rejection of that state ends the turn. The
provider — the Azure deployment of gpt-6-astra — now and then does not hold, or not yet, the state
a chained request names: a response not found right after it completed, a chain that lacks a tool
output. Why it loses that state is outside this code and not established. The defect here is that a
transport optimisation the turn does not need is a single point of failure for it.

## Why the code produces wrong results

Chaining is an upload optimisation (roomle-hi-example
[refactoring analysis](../refactoring-analysis/planning-assistant-response-chaining.md)): it must
not decide whether a turn succeeds. A request with the whole history is valid at every step, the
assistant holds everything for it, and a rejected continuation can be recovered without running a
tool call again. Ending the turn instead loses the answer of a turn whose plan change already
stands (run 28) and every later turn of a conversation (run 74).

## Proposed fix

roomle-ui `hi-planning-assistant.ts`: when the provider rejects a chained request with a
continuation error — "Previous response with id … not found" or "No tool output found for function
call …" — the turn continues without the chain. A new `streamText` takes the remaining steps
(`MAX_CHAT_STEPS` minus the completed ones) with the turn's input and the messages of every
completed step; its first request is unchained (step 0 of `prepareStep`), its later steps chain
again. Completed tool calls are not run again. The history the next turn gets
(`messages.push(userMessage, …)`) and the usage record (`modelCalls`, `steps`, `requests`) cover
both streams. The fallback writes one console line, `[planning-assistant] continuation rejected
(<error>) - continuing with the whole history`, so that a recurrence shows in the run logs. Any
other error ends the turn as before; an unchained request cannot meet a continuation error, so the
fallback cannot loop.

`prompt-caching.md` states the contract: a rejected continuation continues the turn with the whole
history; a failed turn is still not replayed.

Rejected:

- Reverting the chaining — it halves the uploaded bytes and shortened the benchmark turn from 72.5
  to 53.6 s; the request with the whole history is the fallback anyway.
- Sending the same chained request again — a missing tool output does not appear by resending, and
  a response not yet stored needs an unknown wait; the request with the whole history needs none.
- Raising `maxRetries` — the AI SDK retries only retryable errors, and a 400 is none.
- Rebuilding the request in the fetch transport of `loadChatModel` — the transport sees only the
  chained body, not the function calls of the earlier responses.

## Tests

roomle-ui `tests/unit/embedding-lib/homag-intelligence/hi-planning-continuation.spec.ts`, for
OpenAI and Azure:

- The second request is answered with 400 "Previous response with id 'resp_1' not found.": the
  next request carries no `previous_response_id` and the turn's whole input — the library
  reference, the user message, the function call of step 0 and its output; the tool of step 0 runs
  once; the turn ends with its answer and without an error output; the step after the fallback
  chains on the fallback's response id.
- The same with 400 "No tool output found for function call call_1_0.".
- Another 400 on a chained request ends the turn with its error, as before.
- The next turn's history holds the steps of both streams.
