# An immediate acknowledgement for every Planning Assistant request

> **Type**: Feature Analysis
>
> **Status**: Open
>
> **Date**: 2026-10-31
>
> **Related ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
>
> **Base**: roomle-hi-example `master` (`1a15bca`); roomle-ui
> `feat/hi-planning-assistant` (`ed4244eec`)

**Affected repositories**

- **roomle-ui**: the planner chat displays a translated acknowledgement while the accepted turn
  has no assistant text; component tests and the chat documentation describe its lifecycle.
- **roomle-hi-example**: this analysis and its indexes; on implementation, the example's chat
  documentation explains the acknowledgement and its distinction from measured model output.

## Request and conclusion

Every accepted prompt should receive a very short, visible response before the assistant spends
time analysing the request, for example **“Got it. I'll work on your request.”** It should reassure
the user that work has started, including on later turns and image-only requests.

**This is possible without another model call.** The recommended design displays that sentence
locally in the pending assistant bubble, then replaces it with the streamed assistant text. The
assumption is that a generic acknowledgement satisfies the request's explicit preference for a
simple message. It confirms receipt and processing; it does not claim that a model has already
understood the details or inspected an image.

A model can instead be instructed to say “I'll move the cabinets to the left wall” before calling
tools. That provides a prompt-specific response, but it still waits for context acquisition and
the model's first text. Prompting alone cannot guarantee a response before reasoning. This is a
separate choice if a substantive restatement of the request is required.

## How the response works today

The example delegates the conversation to the embedding-lib's `startPlanningAssistant`; it does
not implement a separate agent or chat renderer. The chat window and its store run in the planner
iframe ([architecture](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/.agents/homag-intelligence/agent-architecture.md),
[ADR 0009](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/.agents/decisions/the-chat-window-is-a-panel-of-the-planner.md)).

| Stage | Current behaviour and source |
|---|---|
| Accept the prompt | `send` appends the user entry and an **empty** assistant entry, sets `busy`, then fires the host callback: [planning-assistant-store.ts:61–79](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/src/common/store/planning-assistant-store.ts#L61-L79). Empty, unavailable and concurrent submissions are ignored. |
| Show feedback | The bubble renders `entry.text`. A separate `role="status"` line immediately displays the translated “assistant is working...”, later followed by the tool name: [PlanningAssistantChat.vue:16–60](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/src/common/components/PlanningAssistantChat.vue#L16-L60), [200–209](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/src/common/components/PlanningAssistantChat.vue#L200-L209). |
| Prepare inference | The host acquires the library reference and live plan state before starting `streamText`: [hi-planning-assistant.ts:348–451](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L348-L451). |
| Stream output | Every `text-delta` is forwarded immediately; `tool-input-start` and `tool-call` set activity. Reasoning events are not rendered: [535–561](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L535-L561). The window is not buffering an already available answer. |
| Finish | Text appends to the running entry; an error replaces it; `done` clears `busy`. Only successful model conversation messages enter host history: [store:82–116](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/src/common/store/planning-assistant-store.ts#L82-L116), [assistant:568–583](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L568-L583). |

Consequently, the gap is an explicit acknowledgement in the conversation, beyond the existing
working status. It is not a missing streaming transport.

The retained Azure baselines illustrate the distinction: the text kitchen has first visible text
at **13.328 / 13.309 seconds**, versus first generated model output at 2.883 / 1.698 seconds; the
image kitchen has first visible text at **13.648 / 8.817 seconds**, versus first generated output at
4.609 / 2.876 seconds. These are the two runs in each
[text baseline](../benchmarks/baseline-fkwm-az-2026-10-28.md#results-milestones-and-total-time) and
[image baseline](../benchmarks/baseline-iklw-az-2026-10-28.md#results-milestones-and-total-time),
not a new measurement or a forecast for every provider. Pre-turn page setup is separate; warm
context acquisition in those runs is about 20 ms, so the source trace does not establish context
loading as the dominant delay.

## Recommended design

Render one translated sentence in the **last, running assistant entry** when `busy` is true,
the entry is not failed and its text is empty. Derive it from existing state in
`PlanningAssistantChat.vue`; keep the underlying `entry.text` empty. No new turn state or output
part is needed.

- The acknowledgement is eligible for the next Vue render after `store.send` accepts the prompt,
  independently of the host callback, context reads and provider response. Sending waits for any
  pending image preparation today (`PlanningAssistantChat.vue:247–259`); the guarantee starts at
  accepted submission, not at the beginning of that preparation.
- The first nonempty text replaces the presentation fallback; subsequent deltas append normally.
  Tool activity can update the existing status while the acknowledgement remains visible.
- `done`, errors and lost availability remove the pending fallback. A tool-only completion must
  not leave “I'll work on your request” as if work were still running. Each later accepted prompt
  gets its own pending sentence; old empty entries never acquire it.
- Account for the existing `v-memo`: pending visibility depends on `busy` and the running entry,
  not just `entry.text`. Preserve the test that completed answers are not rerendered per delta.
- Announce the acknowledgement accessibly once, without making every streamed token a live
  announcement. Keep tool activity separate from this sentence.

This adds **zero model requests and zero model tokens**. It creates no conversation-history
message, consumes no agent step and changes no tool execution. It improves visible responsiveness;
it does not shorten kitchen generation. No keyword classifier or prompt-specific templates are
needed for the stated requirement.

RML-18303's existing [proposal B](../refactoring-analysis/planning-assistant-performance-next-steps.md#52-b--the-tool-call-before-the-narration)
seeks to remove the model's 255–339-character planning preambles, whose streaming takes about
1.4–2.1 seconds before the create payload. A local acknowledgement is compatible with that
proposal: the user sees feedback even when the first model output is a tool call. The proposal is
open work, not assumed implemented.

## Alternatives

| Approach | Assessment |
|---|---|
| Keep only the current working status | Already immediate, but does not provide the requested conversational acknowledgement. |
| Ask the planning model for one short opening sentence | Feasible as a best-effort prompt-specific alternative. Revise the existing “Call tools instead of describing what you would do” instruction in `hi-agent-prompts.ts` coherently, and ask for one acknowledgement per user turn followed by execution. Existing streaming carries it. It still depends on inference latency and adds narration before the tool call. |
| Force a text-only first model step | A text-only response normally ends this tool loop; tools do not automatically run afterwards. A separate continuation would be required. Do not insert `toolChoice: 'none'` at step zero and expect planning to continue. |
| A separate small or low-reasoning model for the acknowledgement | Can generate a short paraphrase from the prompt alone, but still has network/provider latency, additional cost and failure handling. Sequential execution delays planning; parallel execution introduces ordering and cancellation work. Excessive for a generic acknowledgement. |
| Emit static `text` at the start of the host callback | Technically possible before the context reads, but `text` appends permanently to the answer and round-trips through the host. The planner owns translations and already knows when it accepts a turn. A local pending fallback is smaller and works for every host using this window. |
| Show reasoning or synthesize progress from elapsed time | Neither provides reliable confirmation of actual progress. The existing tool activity remains useful, but arrives only when the model starts a tool call. |

The AI SDK documentation confirms that text, reasoning and tool events are distinct
([streaming](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)), and that automatic multi-step
generation continues through tool results until a response has no further tool calls or a stop
condition is met ([tool loop](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#multi-step-calls-using-stopwhen)).
The repository pins `ai@7.0.122`; verify any model-loop alternative against that version rather
than copying current documentation's helper names.

## Scope and verification for implementation

| Repository / files | Required scope |
|---|---|
| roomle-ui `src/common/components/PlanningAssistantChat.vue` | Pending acknowledgement, lifecycle, memo dependencies and accessible rendering. |
| roomle-ui `src/common/translations/base.json` | One English source key. Per the [translation workflow](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/.agents/workflows/add-translation-keys.md), the owner syncs Loco; the app loads generated translations, so the sentence is not release-ready until that sync. |
| roomle-ui `tests/integration/common/components/PlanningAssistantChat.spec.ts` | Render before a deliberately unresolved host callback; cover text and image-only prompts, later turns, tool activity, replacement and append, error, lost availability, and `done` without text. Verify no pending message returns on older entries; retain markdown/memo and scrolling coverage. |
| roomle-ui `tests/unit/common/store/planning-assistant-store.spec.ts` | Existing guards and streaming lifecycle stay applicable. Assert that the acknowledgement remains absent from stored entries and the callback payload; no new acknowledgement state is required. |
| roomle-ui `.agents/homag-intelligence/agent-architecture.md`, `packages/embedding-lib/docs/planning-assistant-overview.md` | Document local receipt feedback separately from agent output and final results. |
| roomle-hi-example `docs/ai-chat.md`, `.agents/context/pages-chat-and-launcher.md` | Explain what the user sees and link to roomle-ui for implementation. |

Success means the pending sentence appears on the next component update after an accepted send
while the host/provider is still unresolved, then yields to real text or terminal state. Verify
visually with a delayed host and with both direct-provider and model-proxy configurations; no paid
model run is needed to prove the acknowledgement's timing or lifecycle. A healthy foreground
browser should paint it promptly, but this analysis claims no measured millisecond bound.

Keep `firstTextMs` as **first model text**, not acknowledgement latency. It is measured in the
host's text-delta handler and excludes this local fallback. If acknowledgement latency is recorded,
measure accepted send to rendered acknowledgement separately; retain first kitchen and final-answer
timings so a faster placeholder cannot be reported as faster planning. The example's
`window.hiPlanningAssistantOutput` records host output, not this local presentation.

The recommended feature needs a **planner deployment**, including completed translations; it needs
no embedding-lib rebuild, consumer version bump, proxy route or new dependency. It changes neither
the HI tools nor `glue-logic.ts`, library data or RoomleCore. The example's pinned embedding-lib
and the inspected roomle-ui checkout are different versions; no deployed behaviour is inferred
from the local checkout alone.

This analysis uses source inspection, the ticket's discussion and attachment, retained benchmarks
and official SDK documentation. Productive code, prompts and tests are unchanged; no new model
experiment is performed.
