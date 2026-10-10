# Preserve the outcome when a provider failure interrupts a chat turn

> **Status:** Fixed locally — interrupted turns retain a truthful outcome; original provider failure cause unconfirmed
> **Date:** 2026-10-09
> **Ticket:** [RML-18103, comment 155978](https://roomle.atlassian.net/browse/RML-18103?focusedCommentId=155978), issue **38**

## Affected repositories

- **roomle-hi-example:** capture completed tool outcomes in `hi-mcp-chat`, finish an interrupted turn with a truthful outcome message, retain failure diagnostics, and test/document that contract.
- **ligna-store:** apply the same recovery semantics in `hi-mcp/chat.ts` and ensure `hi-mcp/chat-window.ts` displays and retains the recovered turn and its completed tool messages.

## Recorded failure

The available reproduction is `.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5-mini/37-random-2-oak-sideboard-grey-wall/`. The prompt requests three sideboard cabinets with oak fronts behind the armchairs; the input plan is `ps_nwzhfk8bjc2gu02gsyocsdragi0rxey`.

`run.json` records an empty answer and “Failed to process successful response” after 68.8 seconds. `planner-calls.json` contains exactly one successful, read-only `getExternalObjectPlanContext` call, including `masterData`. `console.log:55` confirms that tool completed and step 1 ended; no write follows. **This occurrence made no recorded plan change.** It does not reproduce the more general risk of an error after a modifying tool. Snapshot: `ps_rafmbm2zj599gliuvi8fey928uoy4de`.

The log contains no failure cause chain, HTTP status, request ID or response body. No later matching diagnostic was found in the available `.temp` logs. The real response therefore cannot be reconstructed from these artifacts.

## What is established, and what is not

There are two distinct questions:

1. **Why the provider step failed remains unknown.** In the installed SDK, `@ai-sdk/provider-utils/src/post-to-api.ts:144` uses this message when handling a successful HTTP response throws. `src/response-handler.ts:45` also uses the same message when reading the response stream fails. It does not prove malformed JSON, a schema mismatch, excessive context, or a provider defect. The SDK's `APICallError` does not mark status 200 retryable by default (`@ai-sdk/provider/src/errors/api-call-error.ts:28`). Increasing the normal retry count is not a demonstrated solution.
2. **Why no useful final answer survives is identifiable in both clients.** The failure paths terminate without retaining and summarising the completed tool outcomes.

In roomle-hi-example, `hi-mcp-chat/chat-server.ts:153` writes a technical `[error]` line for an error part; line 167 does the same for a thrown stream error, then closes the stream and MCP client. The tool wrapper at line 95 logs execution but does not keep result data for a fallback. `chat-steps.ts:5` reserves the last normal step for an answer, but a provider failure can terminate before that step. The page (`minimal-hi-example/index.html:1611`) stores the resulting answer text; it has no structured tool history to recover independently.

In ligna-store, `hi-mcp/chat.ts:143` throws an error part, and its catch logs and rethrows. It returns `responseMessages` only after successful stream consumption (line 147). `hi-mcp/chat-window.ts:442` adds messages to the conversation only after that return, and its catch replaces partial text with “Chat failed”. Consequently, completed operations from a failed turn can remain in the planner while their tool messages are absent from the next turn's conversation.

## Recovery contract

Start with a deterministic outcome message, independent of another provider response. Record completed tool results during execution, including results from a step that later fails; do not rely only on `onStepEnd` or the final `responseMessages` promise. Separate read-only calls, confirmed changes, tool errors and unknown outcomes. A returned MCP `isError` result or a timed-out write is not proof of a completed change.

On provider failure, end with one clear failure notice plus the confirmed outcome: for this reproduction, explain that the context was read but no cabinets were created. After confirmed changes, name those changes from the actual results, including corrections, omissions and partial success. If a modifying call has an unknown outcome, say that it could not be confirmed; never claim that nothing changed. Preserve useful partial text without leaving it as an apparent success answer.

In ligna-store, return/persist the completed assistant/tool message pairs and the final failure summary as a handled interrupted turn. Retain only complete, valid message pairs; do not fabricate results for pending calls. The caller must not replace that summary or drop the evidence. The example backend can keep its plain-text response contract and existing diagnostic error marker; the outcome must also be normal readable answer text.

**Do not replay the whole user turn.** It can duplicate creates, inserts or deletes already performed. A retry of a model step is a separate option only after the captured failure and its execution boundary establish that it is safe. A tools-disabled summary call cannot change the plan, but adds cost and can itself fail; it is not required for the first recovery implementation. No planner guard, automatic undo or SDK upgrade is justified by the current evidence.

## Diagnostics and verification

Keep the existing cause-chain logging. Capture the next real failure's step number, provider/model, status, request ID and available cause/body to distinguish transport failure from response validation. The existing test's synthetic `choices[].delta.content = null` value is a **logging fixture**, not the observed response. Also keep logging best-effort: the server's `shortened` uses unguarded `JSON.stringify` (`chat-steps.ts:29`), whereas ligna-store already protects formatting failures. Diagnostics must not prevent the fallback from reaching the user.

Implementation regressions should cover: failure after a read-only call; failure after one successful write (executed exactly once); error part and thrown stream error; multiple tools with a partial or unknown outcome; retained ligna-store history; failure after partial text; a logger that throws; and normal successful turns. Use fake tools and a mock model. Test the backend stream and store caller integration, not just the summary formatter. Add the actual provider-response fixture only when captured; do not describe a mock as reproducing the original failure.

Validation performed: the existing five tests in `hi-mcp-chat/tests/chat-steps.test.ts` pass with `npm test --workspaces=false -- hi-mcp-chat/tests/chat-steps.test.ts` from `hi-mcp/`. They verify logging and normal step/timeout behaviour, not recovery. An initial root-level workspace invocation also selected child workspaces and failed; the scoped command above exited successfully. No live provider request was made.

Implementation documentation: `docs/ai-chat.md`, the chat-turn section of `docs/hi-mcp-behaviour.md`, `.agents/skills/vercel-ai-sdk-chat.md`, and ligna-store `hi-mcp/README.md`. Keep #38 open until recovery is tested, and record the unknown underlying provider cause separately. No roomle-ui, RoomleCore or MCP bridge change is indicated.

Analysis baselines: roomle-hi-example `0be12cc`, ligna-store `66979ca`. The analysis was written before implementation.

## Implementation and verification

The example records MCP tool execution in `chat-recovery.ts` and handles error parts, thrown streams
and turn aborts in `chat-stream.ts`. Provider/model creation and the per-request MCP client moved
there from the HTTP entry point to allow the response path to be tested without starting a server.
Recovery produces one readable interruption summary alongside the existing diagnostic marker.
Completed results name returned groups and articles, corrections, hints and omitted groups.
A modifying tool that returns `isError`, throws or remains pending is unconfirmed. Read-only turns
say that nothing was created or changed. Recovery never replays a turn, calls a second model or
undoes a planner operation.

The store uses the same recovery implementation, retaining complete assistant/tool message pairs
and its partial text plus the summary. Pending calls are omitted from the pairs. If conversion to
a model output fails, the actual result survives as text. The window keeps this handled turn in
its conversation; its next request includes the completed tool evidence. Diagnostics are best
effort, including circular/BigInt details and throwing loggers.

Ten new example regressions cover read-only failure, error parts, thrown streams, confirmed writes
executed exactly once, partial success and corrections, mixed errors, partial text, throwing
diagnostics, aborted writes, pending results, failed model-output conversion and normal success.
Before recovery, the read-only, confirmed-write, mixed-outcome and partial-answer cases failed
because they had no recovery summary; the normal turn passed. All 584 workspace tests pass after
implementation. The first full-suite sandbox run could not bind the loopback
sockets of 12 existing HTTP tests; the socket-enabled rerun passes.

A temporary five-case store harness mocked all network requests and exercised the real AI SDK,
MCP transport, rendered window and next-turn history. All five checks passed. At the user's
request, the harness, test command and development-dependency changes were removed from
ligna-store. No store tests or test infrastructure are retained in the change.

Workspace typechecks, example lint/format checks and store scoped type/lint/format checks pass.
The durable contract is in `docs/ai-chat.md`, `docs/hi-mcp-behaviour.md`, the implementation
reference, the chat skill and the store's `hi-mcp/README.md`. Backlog #38 is removed because the
missing-answer recovery is implemented. The original provider failure cause remains unknown: no
real failing response was captured, and the synthetic test responses are fault injections, not
evidence of that cause. No live provider request was made for this fix.
