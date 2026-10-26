# Planning Assistant: stop uploading earlier context at every model step

> **Type**: Refactoring analysis
> **Status**: Done — implemented and validated on feature branches; retained until merge to master
> **Date**: 2026-10-26
> **Ticket**: [RML-18303 — HI Planning Assistant: token usage and performance optimization](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-hi-example `master`, `ec82b2f1de74072f9deeb4ae3909ed1036bdfb69`; roomle-ui `feat/hi-mcp-merge`, `f2e10cd132a9556fdbb8c5df18633a64c508272e`
> **Analysis branch**: roomle-hi-example `docs/planning-assistant-response-chaining-analysis`

## Affected repositories

- **roomle-ui** — change the embedding-lib assistant's Responses request construction, add adapter and lifecycle tests, extend request diagnostics where needed, and update its architecture reference.
- **roomle-hi-example** — hold this analysis, report individual request payloads in benchmark output, and conduct the eventual before/after benchmark. Only this document and its index entries change during this analysis task.

## 1. Agreed target

**The refactoring used Responses API response chaining within a user turn to upload earlier inputs once, then send only the new tool results.** Keep the existing AI SDK loop, tools and complete successful local history. Implement the change in the assistant's existing `prepareStep`; do not replace the agent loop or build a conversation service.

This addresses an avoidable transport inefficiency in the current implementation. Sending accumulated history is valid for requests without a server-side history reference, so the observed growth is not a malformed-request bug. The current Responses integration leaves an available optimization unused.

The implemented scope chained **within each user turn**, for verified OpenAI and Azure Responses routes. Each new user turn starts with fresh reference acquisition and the existing successful history. Consequently, this candidate removes repeated uploads between model steps, but still uploads successful history at the beginning of the next user turn. Cross-turn chaining is a separate extension because it changes reference replacement and failure recovery.

This is an upload optimization. It does **not** remove earlier information from the model's context or guarantee fewer input tokens, lower cost, fewer model calls or a shorter response. OpenAI documents that earlier input in a response chain remains billable. Cache counters and latency must be measured independently. [OpenAI conversation state](https://developers.openai.com/api/docs/guides/conversation-state).

The initial investigation made no production changes or paid model requests. The subsequently approved implementation, publication and comparison are recorded in section 10.

## 2. What the measured bytes mean

The [image-kitchen-left-wall benchmark](../benchmarks/iklw-oa-orig-2026-10-26.md) measures each serialized UTF-8 JSON HTTP request body separately. A row is **the bytes of that call**, not a running sum. HTTP headers, TLS framing and actual compressed network traffic are outside this measurement.

The requests grow because their content includes earlier input plus new messages. Some stored assistant/reasoning items can become short provider item references; the original user image, library message and ordinary tool results are still serialized again. It would be inaccurate to say every previous assistant byte is always reuploaded.

| Model call | Run 1: actual request bytes | Run 1: change from preceding request | Run 2: actual request bytes | Run 2: change from preceding request |
|---|---:|---:|---:|---:|
| 1 | 603,820 | — | 603,820 | — |
| 2 | 636,035 | +32,215 | 636,035 | +32,215 |
| 3 | 651,859 | +15,824 | 651,859 | +15,824 |
| 4 | 680,920 | +29,061 | 682,230 | +30,371 |
| 5 | 681,983 | +1,063 | 3,465,240 | +2,783,010 |
| 6 | 682,740 | +757 | 3,466,084 | +844 |
| 7 | 3,330,545 | +2,647,805 | — | — |

The change column is a subtraction between two complete bodies. It is **not** an independently measured new-message payload and must not be presented as the bytes a chained request would send. Tool definitions, envelopes, escaping, references and settings also affect serialized size.

Concrete causes from the captured tool timeline:

- The shared instructions/library reference measures 295,284 bytes before provider serialization. The library tool result alone is 270,617 bytes. These are different representations, not additive sections of the HTTP body.
- The prepared original JPEG is 198,683 bytes before base64 encoding, approximately 264,912 base64 characters. It remains in later request inputs.
- Run 1's plan-image tool result measures 2,647,598 JSON bytes; the next request grows by 2,647,805 bytes.
- Run 2's plan-image result measures 2,748,154 bytes. Together with a fresh context read and attribute lookup, it explains the large fifth request. The sixth request sends that image content again while adding only a small failed-edit result.

Full original request bodies were not retained, so an exact historical breakdown by section cannot be reconstructed. The near-matching image growth supports its attribution; it does not justify inventing a byte-exact candidate request.

The seven run-1 bodies total 7,267,902 bytes; the six run-2 bodies total 9,505,268 bytes. These totals describe all uploads during each turn. The individual calls above remain the primary comparison.

## 3. Current implementation and ownership

Code links below are pinned to the inspected roomle-ui revision. This is newer than the timing benchmark's roomle-ui revision `6d088dde93908575229b02a8bdc2dd080f96c71e`; the historical measurements are context for the problem, not a fresh baseline of the inspected head.

| Location | Verified behavior and consequence |
|---|---|
| [`hi-planning-assistant.ts:61`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L61) | `loadChatModel` selects direct OpenAI Responses or Azure Responses/Chat Completions. Its custom fetch measures each string request body before sending it. No response-chain identifier is supplied. |
| [`hi-planning-assistant.ts:168`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L168) | System prompt and common reference blocks form instructions. At each turn, the assistant reads `get-plan-context` with `include: ['articles', 'attributes']` and places the resulting data before successful history and the newest user message. |
| [`hi-planning-assistant.ts:238`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L238) | `streamText` receives instructions, full messages and tools. `prepareStep` only disables tools on the final allowed step. It neither selects a delta nor supplies `previousResponseId`. |
| [`hi-planning-assistant.ts:295`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L295) | Successful turns append the user message and all `result.responseMessages` to local history. Aborted/failed turns do not. |
| [`hi-planning-usage.ts:97`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/embedding-lib/src/homag-intelligence/hi-planning-usage.ts#L97) | `describePayload` records UTF-8 byte length and SHA-256; it does not retain request bodies. |
| [`hi-mcp-tools.ts:58`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/embedding-lib/src/homag-intelligence/hi-mcp-tools.ts#L58) | Tool results become text and real image/file content. Repeated base64 image uploads are transport size, not evidence that the model reads base64 as ordinary prose tokens. |
| [`tool-executors.ts:479`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts#L479) | `get-plan-context` combines separate plan/library API reads and derives the attribute vocabulary from master data. The initial model reference contains compact articles and attributes, not the complete raw master-data section. |
| [`external-object-api.ts:218`](https://github.com/roomle-dev/roomle-ui/blob/f2e10cd132a9556fdbb8c5df18633a64c508272e/packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts#L218) | `HiPlanContext` has only plan fields; library data belongs to `HiLibraryContext`. Removing library attributes from this public type does not change the assistant's provider message history. |

The source trace in the installed packages confirms why full requests accumulate:

| Pinned dependency | Relevant source |
|---|---|
| `ai@7.0.122` | `src/generate-text/stream-text.ts:1708` builds the next step from `currentStepMessages` plus that step's response messages. At `:2327`, `prepareStep` can override messages, instructions and provider options. Completed steps expose `response.id` and their own `response.messages`. |
| `ai@7.0.122` | `src/prompt/convert-to-language-model-prompt.ts:86` turns the application's `instructions` into a system-role prompt message. |
| `@ai-sdk/openai@4.0.81` | `src/responses/openai-responses-language-model.ts:628` maps `previousResponseId` to `previous_response_id`; `:631` separately maps provider-option `instructions`. `convert-to-openai-responses-input.ts` serializes the supplied inputs and ordinary function outputs; an ID alone does not select the delta. |
| `@ai-sdk/azure@4.0.85` | `src/azure-openai-provider.ts:355` uses the same Responses implementation with the `azure` options namespace. SDK serialization support does not prove that every Azure deployment supports stored response chaining. |

The implementation belongs in the embedding-lib assistant. **No change to `glue-logic.ts`, HI tool commands, library calculation, RoomleCore or ligna-store is required.** The existing shared-prefix work remains useful for provider prompt caching; this analysis addresses transport on top of it.

## 4. Proposed request shape

| Boundary | Send | Do not add again |
|---|---|---|
| First model call of a user turn | Existing instructions, current library reference, successful history, latest text/images, tools and existing provider settings | No chain ID from a previous user turn |
| Later model call of that turn | Previous completed provider response ID; all new tool outputs for that response with genuine call IDs; tools and current request settings | Initial reference, original images, older tool outputs, and assistant output already represented by the previous response |
| Final allowed model call | Same continuation plus the existing `toolChoice: 'none'` | No extra tool round or warm-up call |
| Next user turn | Acquire reference again and start an independent first call | No retained response ID from the preceding turn |

For the current client-executed HI tools, the previous step's tool-role messages are the continuation input. Multiple parallel outputs must all be included. The provider already holds the assistant's function calls, so the continuation must not upload those calls again. Keep the complete local response history independently of the reduced wire input.

This should use the existing `steps.at(-1).response.id` and per-step response messages passed to `prepareStep`. There is no need for a second agent loop, a response-ID cache, a new public mode flag, a timer, a lock or a backward-compatibility layer. Keep provider routing with the existing provider selection. OpenAI-only fields must never reach Chat Completions, Mistral, Anthropic or Google.

Microsoft documents a continuation consisting of `previous_response_id` and only the new `function_call_output` entries. Both local adapters serialize this shape. Actual model/endpoint support and storage policy still need live verification before enabling a route. [Azure Responses: chaining and function calling](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses).

### Instructions need deliberate handling

The application's `streamText({ instructions })` is **not** the same wire field as the Responses API's top-level `instructions` in this pinned SDK. The offline probe finds a developer-role item inside `input` and no top-level `instructions` field.

The candidate therefore keeps the initial developer/system input in the stored response context and uses `instructions: []` on later steps to avoid inserting it again. In this SDK, `undefined` falls back to the previous instructions; it does not clear them. Actual provider inheritance of this input item must be checked with an instruction-following continuation before shipping.

If implementation instead moves instructions to the provider's top-level field, that field must be supplied on **every** response. OpenAI explicitly says it does not carry forward with `previous_response_id`. Do not drop it based only on its JavaScript name, and do not ship both representations. [OpenAI text generation: instruction scope](https://developers.openai.com/api/docs/guides/text).

Tool definitions and request settings remain explicit on every call. Keep reasoning settings, applicable cache key/boundary behavior, abort signal and the final-step policy. This analysis does not assume those settings inherit from a response ID.

### Lifecycle and freshness

- Scope the response chain to the current `streamText` call. Its first step always uses the freshly acquired reference. A library, language or planner replacement uses the existing abort/reload lifecycle.
- A plan-changing tool updates the real planner. Provider state stores conversation history, not current room geometry. Keep fresh plan reads before later edits, including edits after manual UI changes.
- Preserve the existing success-only local history. A failed/aborted chain must not become the starting point of the next user turn. Existing gaps in recovery from a tool mutation followed by a provider failure remain outside this transport change.
- If a continuation fails or its response ID is missing/unusable, report the turn failure through the existing path. Do not silently replay a plan-changing turn or build an automatic full-history restart. Normal transport retries must not execute a successful tool again.
- HTTP chaining depends on available stored provider state. OpenAI documents a default 30-day response retention and `store: false` to disable storage; this candidate needs a storage-compatible API route. Do not infer key type, organization policy or Azure capability from an environment variable's name. [OpenAI response storage](https://developers.openai.com/api/docs/guides/conversation-state).

Cross-turn chaining could avoid uploading successful history again, but would also retain an earlier library reference alongside later ones. Replacing reference context and recovering a failed turn must be designed before that extension. The turn-scoped candidate avoids introducing that state management into this PoC.

## 5. Offline evidence from this analysis

An ignored scratch probe ran the actual installed `streamText` and pinned OpenAI/Azure adapters against an injected fetch returning synthetic SSE responses. **There were no provider/network calls.** Each scenario has three model requests: read images, read plan, final step with tools disabled. Both tools execute once.

| Adapter | Request mode | Call 1 bytes | Call 2 bytes | Call 3 bytes |
|---|---|---:|---:|---:|
| OpenAI 4.0.81 | Current accumulated input | 20,221 | 30,475 | 30,636 |
| OpenAI 4.0.81 | Previous response ID + tool-result delta | 20,221 | 10,601 | 509 |
| Azure 4.0.85 | Current accumulated input | 20,221 | 30,475 | 30,636 |
| Azure 4.0.85 | Previous response ID + tool-result delta | 20,221 | 10,601 | 509 |

Assertions pass for the provider response-ID chain, original call IDs, two tool executions, complete local assistant/tool history, stable tool definitions, the absent repeated reference/instructions, and an image result present only on its first upload. Call 2 remains larger than call 3 because it carries the new image. Request size need not grow with chaining.

The script and compact result stay local at `.temp/response-chaining-probe.mjs` and `.temp/response-chaining-probe.json`. The retained findings and table above are sufficient to read the analysis without these files. The fixture uses synthetic text and image bytes, not a real kitchen or provider behavior. It proves serializer/loop feasibility, **not** instruction inheritance, provider acceptance, token savings, planning quality or latency.

## 6. Planned change scope by file

Paths in the first table are in roomle-ui. References identify the inspected locations; production edits are proposed, not performed.

| File / location | Proposed change |
|---|---|
| `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts:61,238,271,295,338` | Integrate provider-aware continuation into existing model setup and `prepareStep`; preserve reference acquisition and local history; associate request attempts with model steps in diagnostics. Retain existing controls and remove any request assembly superseded within the Responses path. |
| `packages/embedding-lib/src/homag-intelligence/hi-planning-usage.ts:97` | Extend payload metadata only as required for section sizes; retain bytes/digest behavior without storing bodies or credentials. |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts:238,678,695` | Extend shared-reference, multiple-turn, abort and failure tests for turn-scoped chaining. |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-openai.spec.ts:9` | Add a real pinned-adapter multi-step HTTP serialization test. |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-azure.spec.ts:46` | Add Azure continuation serialization; retain reasoning and explicit cache-boundary coverage. |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-usage.spec.ts:8` | Test exact UTF-8 section accounting and retry/partial-usage distinctions if metadata changes. |
| `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts` | Retain tool/image conversion and usage aggregation assertions; extend only where continuation exposes a gap. Tool implementation stays unchanged. |
| `.agents/homag-intelligence/prompt-caching.md:1,27,61,111` | Describe first-request versus continuation input, instruction representation, fresh-reference boundary, route support, storage dependency and diagnostics. |
| `.agents/homag-intelligence/agent-architecture.md:166` | Update request flow and lifecycle; link to the detailed transport explanation. Update the HOMAG guideline/topic index and relevant architectural decision if the design is adopted. |

| roomle-hi-example file / location | Proposed change |
|---|---|
| [`.agents/scripts/benchmark-hi-mcp-runs.js:371`](../scripts/benchmark-hi-mcp-runs.js#L371) | Add a per-request table. The current diagnostics table reduces requests to a turn total. Show individual bytes, step/attempt association and available sections; label any separate total explicitly. |
| [`.agents/scripts/planning-assistant-usage.js:71`](../scripts/planning-assistant-usage.js#L71) | It already preserves version-1 diagnostics wholesale. Verify new metadata survives; no production edit is needed if it already does. |
| [Benchmark tests](../scripts/tests/benchmark-hi-mcp-runs.test.js), [usage tests](../scripts/tests/planning-assistant-usage.test.js), [report tests](../scripts/tests/report-scripts.test.js) | Verify individual requests, retries, absent metadata and unchanged token aggregation. |
| [Chat implementation context](../context/pages-chat-and-launcher.md#L99), [test implementation context](../context/deployment-and-testing.md#L68) | Explain diagnostics and link to roomle-ui for request architecture. |
| [Benchmarking skill](../skills/hi-mcp-benchmarking.md), [timing skill](../skills/hi-mcp-timing-benchmark.md) | Require clear per-call byte reporting and keep model/tool time deltas. Update only where the adopted measurement contract adds information. |
| `.agents/benchmarks/<comparison>.md` and indexes | Record actual before/after runs. Raw captures and any PDF stay in ignored `.temp/`; commit only the report and required index entries by default. |

No launcher configuration flag or public planner API change is required by the proposed shape. No new dependency is needed: the installed adapters already have the required options.

## 7. Test requirements agreed before implementation

| Test | Expected result |
|---|---|
| First step and two or more continuations through each real pinned adapter | First input is complete; each continuation references the preceding provider response and sends only its new tool outputs. No duplicated initial image, library message or prior output. |
| Parallel tools, ordinary text results and multimodal plan-image results | Every result pairs with its original call ID and is uploaded once per turn; the subsequent call omits it. |
| Successful local history after a trimmed wire request | All generated assistant/tool messages remain available to the next user turn; no tool-call IDs or outputs are lost. |
| Final budget step | `toolChoice: 'none'` composes with the continuation; no extra request is introduced. |
| Missing provider ID, rejected continuation, stream error and abort | Existing failure/abort output; no hidden restart, repeated tool mutation or leaked chain into a later turn. |
| Next turn, changed library/language and manual plan edit | Independent first request uses fresh reference; live state remains a tool read. No previous turn's chain ID is used. |
| Azure options and other provider routes | Applicable reasoning/cache options survive. Chat Completions, Mistral, Anthropic and Google do not receive Responses-only options or trimmed context. |
| Instruction serialization and live inheritance check | Wire test distinguishes developer/system input from top-level instructions. A live continuation follows a distinctive initial instruction after it is omitted from later input. |
| Diagnostics with retries and incomplete usage | One entry per fetch attempt, paired to the correct step where known. Report unavailable data as unknown; never equate a retry with an extra completed model step or double-count aggregate usage. |

Request reporting should distinguish **body bytes**, **new tool-result/image bytes**, **repeated reference/history bytes**, and **tools/settings/envelope bytes**. Compute section sizes from actual serialized representations and keep a residual so sections reconcile to total body bytes. Do not equate net growth between full requests with new content size. Use an existing step identifier where available; ambiguous attempt-to-step matches stay explicit. Do not retain full bodies just to count them.

The functional output should remain the same planning capabilities, complete local history, activity stream and final answer contract. Generated text, reasoning state and token usage need not be identical across provider runs; quality must be evaluated rather than assumed.

Use repository npm scripts with their configured test suites, plus the focused Node reporting tests. Production implementation needs the relevant embedding TypeScript/lint checks. This documentation-only task requires Markdown link and diff checks; it does not need a paid test or a full application build.

## 8. Benchmark design agreed before implementation

Start with a freshly instrumented baseline from the chosen current roomle-ui commit and a candidate containing only request transport changes. The historical timing report cannot substitute for this pair. Keep the shared reference, tools, fixture, prompt, provider-default reasoning and image preparation identical.

| Setting | Required comparison |
|---|---|
| Primary case | `image-kitchen-left-wall`; exact original prompt without optional suite suffix; `docs/images/kitchen-1.png`; plan `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv` |
| Model and key reference | `openai:gpt-6-astra`, `$OPENAI_ASSISTANT_API_KEY`; preserve the direct OpenAI Responses route |
| Runtime | Local planner `http://localhost:5173/`; local embedding sources, with both imports verified. `--dev` alone selects the planner, not local embedding code. |
| Repetitions | Two valid fresh conversations per variant: four paid case runs. Retain failed attempts and label exclusions. Alternate baseline/candidate order and record cache observations. |
| Source provenance | Exact SHAs, clean/modified state, actual loaded module URLs, browser/Node versions, test suffix, image settings, request pacing and reasoning configuration |
| Additional checks | Offline changed-reference, multiple-turn and failure cases first. A live Azure comparison is a separately sized extension using its actual endpoint/deployment; do not relabel OpenAI findings as Azure measurements. |

The four-run comparison was proposed during analysis and executed after approval. Historical assistant turns take 55–96 seconds and about 0.56–0.63 million input tokens each. That suggests roughly 4–7 minutes of model-turn time and 2.2–2.6 million input tokens for four similar runs, plus setup/snapshot overhead. These are planning estimates, not a candidate forecast. A two-run, one-per-variant pilot is smaller but cannot establish a repeated-run result. Obtain execution authorization before new paid runs unless the user explicitly requests the benchmark.

The report must show every model step and tool call with explicit durations, including the interval from the last required skill/reference response to the first completed kitchen. Preserve the existing conservative first-kitchen milestone; a first rendered frame needs separate instrumentation.

| Measurement | Acceptance / interpretation |
|---|---|
| Individual request bytes and section breakdown | After the first call, reference/original-image/older-result uploads disappear from the verified continuation inputs. New images and stable tool schemas still consume bytes. |
| Total request bytes and request/model counts | Report total separately. Fewer bytes are expected; fewer model calls are not. Include retry uploads. |
| Model-call delta, first output, first visible text, first kitchen, skills-to-kitchen and whole-turn time | Compare per-run values and median/range. A smaller body alone does not establish a latency gain. |
| Tool/planner durations | Show individual deltas and overlapping tool wall time. Tool execution should not be repeated by continuation handling. |
| Input/output/reasoning/cache-read/write tokens and coverage | Retain actual provider usage. Chaining does not remove earlier context, and it may affect reasoning retention/cache behavior. No assumed token or currency savings. |
| Planning result | Inspect saved plan, tool outcomes and views for the requested left-wall kitchen. Retain the existing backsplash calculation failure as a separate quality finding; do not treat transport as its fix. |

Historical model round trips occupy 96–97% of turn time, but include network, queueing, input processing, reasoning and generation. Upload throughput and pure provider compute were not isolated. The analysis therefore makes **no numerical latency-saving claim**. Prompt caching and chaining solve different costs; keep prefix content stable and measure cache behavior alongside transport. [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

## 9. Alternatives and pre-implementation evidence gaps

| Alternative | Assessment |
|---|---|
| Add only `previousResponseId` and keep full accumulated messages | Reject: the ID does not trim SDK inputs and can duplicate history in the server context. Both the reference and delta selection must change together. |
| Drop history without a provider reference | Reject: the model loses the context needed to interpret tool outputs and follow the request. |
| Keep sending full inputs and rely on prompt caching | Valid current behavior, but it leaves repeated uploads in place. Retain caching alongside the candidate. |
| Persistent Conversations API or cross-turn response chain | Defer: reference replacement, aborted turns and server-state lifecycle broaden the change. They are not prerequisites for eliminating repeated uploads inside the measured single turn. |
| Reduce article data, retrieve selected catalog sections, summarize tool results, or reduce images | Separate context-reduction experiments. They can change model input, token cost and planning fidelity; do not combine them with this transport comparison. |
| Tool memoization, attribute indexing or precalculated docking data | Other ticket ideas. They do not stop the assistant from serializing already-known context on later model requests. |
| WebSocket transport | Defer: the HTTP adapters already expose response chaining. Socket lifecycle and provider-specific continuation behavior are unnecessary for the first comparison. |

Established: the measured rows are per-call bytes; the SDK accumulates inputs; the actual pinned adapters can serialize deltas with response IDs; the offline loop retains tool execution and local history.

Before implementation, instruction inheritance, endpoint/storage support, live Azure behavior, cache interaction and planning quality still needed verification. Section 10 records the completed checks. Isolated provider compute and a cache-controlled causal latency comparison remain unmeasured.

## 10. Implementation and verification report

### Delivered changes

- **roomle-ui:** [80484dc71](https://github.com/roomle-dev/roomle-ui/commit/80484dc71e0889e24d3251e42090c1ff2eca10f7), on `feat/hi-mcp-performance`. OpenAI/Azure Responses continue within a user turn with new tool results only. Successful local history, fresh turn reference, other providers, abort/error behavior and the final text-only step retain their contracts.
- **roomle-hi-example:** [5a5708d](https://github.com/roomle-dev/roomle-hi-example/commit/5a5708d9577c766f7c87e4731f06aa8dc59bc4c0) adopts the exact dev package and exposes individual request attempts/sections in the benchmark. This branch also contains the completed timing report and index updates.
- **Dev package:** `0.0.0-dev-80484dc`, published by [workflow run 40364455231](https://github.com/roomle-dev/roomle-ui/actions/runs/40364455231). Local packaging/declarations passed, both CDN entry points returned successfully, and Chromium verified the exports and chaining implementation.

The implementation reads `providerMetadata.openai.responseId` / `providerMetadata.azure.responseId`, rather than trusting the SDK's generic response ID: the latter can be generated locally without stored provider state. The new tests cover missing provider metadata even when a generic ID exists. This durable detail is documented in roomle-ui's prompt-caching reference.

The source changes are confined to `hi-planning-assistant.ts`, `hi-planning-usage.ts`, their embedding tests and the matching architecture/decision documents. No glue logic, planner tool behavior, public context API or library calculation changes were required. Cross-turn stored state remains outside this change.

### Checks

- The new real-adapter regression failed on both original provider routes before implementation, then passed with the change.
- `npm run test:unit -- tests/unit/embedding-lib/homag-intelligence/`: **12 files, 100 tests passed**. The command also ran the configured lint suite. Pre-push UI/SDK/embedding type checks and code lint passed; untouched SDK/docs warnings remain visible in the local logs.
- Example launcher: **6 tests passed**. Focused benchmark/usage/report checks: **23 tests passed**. A structural regression additionally verified cache rows remain in their own table before the per-request table. Format and Markdown-link checks passed.
- Two small live requests per provider verified stored response IDs and inheritance of the initial developer/system input on direct OpenAI and configured Azure Astra. These four probes consumed **162 input and 40 output tokens**, separate from the kitchen benchmark.
- No-model browser preflight verified hook targets, local planner/imports and equal reference digests. The old `test:unit:debugNoWatch` script uses an unsupported Vitest `--poolOptions` flag; the standard configured test command was used successfully. That unrelated script was not changed.

### Controlled comparison

The [timing comparison](../benchmarks/iklw-oa-rc-cmp-2026-10-26.md) compares the independent [fresh baseline](../benchmarks/iklw-oa-base-2026-10-26.md) and [response-chaining run](../benchmarks/iklw-oa-rc-2026-10-26.md) reports. The [original measurement](../benchmarks/iklw-oa-orig-2026-10-26.md) remains unchanged. The four new repetitions use the approved direct OpenAI model/key, image, prompt and local planner. Baseline `f6f338fdc` received only the matching telemetry; source digests and temporary instrumentation are recorded locally. The example revision was `5a5708d`.

| Median / mean with two repetitions | Baseline | Candidate |
|---|---|---|
| Uploaded request body bytes | 8,304,201 | 3,654,756 |
| Repeated serialized input bytes | 4,685,281 | 0 |
| First completed kitchen, seconds from turn start | 34.621 | 30.815 |
| All required skill files → kitchen, seconds | 15.975 | 12.839 |
| Complete assistant turn, seconds | 72.549 | 53.601 |

Median uploaded bytes fell **55.99%**. All first serialized requests had the same digest. The first baseline call reported zero cache reads and the next three first calls reused the prefix. Baseline 1 made seven model calls; the other runs made six. These differences and provider variation prevent attributing the full elapsed-time difference to transport. The second repetitions used 541,035 versus 540,796 input tokens despite substantially smaller candidate uploads. No token-cost reduction is assumed.

All four saved plans contain one 3,010 mm kitchen at [-685, -240, 0], rotationZ 90°, on the left wall. Rendered views and final answers were inspected. Finishes and the interpretation of one concealed unit vary between runs. All four backsplash enable attempts fail with Error 14034 / tab_GrainDirectionSettings, and all answers disclose the omission. This existing calculation finding remains separate from the transport result. No provider errors, retries or excluded kitchen runs occurred.

Raw runs, manifest, calculations, endpoint probes, generated summaries and the separate readable PDFs remain under ignored `.temp/response-chaining-implementation/`. Only the report, analysis close-out and required documentation/index changes are tracked. The work is on feature branches, so this analysis remains until its normal merge close-out.
