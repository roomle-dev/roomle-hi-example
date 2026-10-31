# A short, prompt-specific opening response from the Planning Assistant

> **Type**: Feature Analysis
>
> **Status**: Implemented on a local branch; pending merge and planner deployment
>
> **Date**: 2026-10-31
>
> **Related ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
>
> **Base**: roomle-hi-example `master` (`1a15bca`); roomle-ui
> `feat/hi-planning-assistant` (`ed4244eec`)

**Affected repositories**

- **roomle-ui**: the planner-owned system prompt asks the model for one brief sentence about the
  user's requested action before detailed planning; prompt and stream tests and the behaviour
  reference cover it.
- **roomle-hi-example**: this analysis and its indexes; on implementation, the chat documentation
  and an evaluated timing comparison describe the opening response and its effect on planning.

## Request and conclusion

Every accepted prompt should receive a short response that shows what the assistant is about to
do, before detailed planning. **The sentence must relate to the prompt.** A fixed receipt message
does not satisfy this requirement. The recommendation is a model-generated opening sentence in
the existing planning turn, with no separate acknowledgement model as the first approach.

| User prompt | Suitable opening response |
|---|---|
| “Move the cabinets to the left wall.” | “I'll move the cabinets to the left wall.” |
| “Make the fronts white.” | “I'll make the cabinet fronts white.” |
| “What does this kitchen cost?” | “I'll check the kitchen's price.” |
| An image with no text | “I'll use your image to plan the furniture.” |

These are examples of intent, not templates selected by code. The model uses the user's language
and the conversation when needed. For an ambiguous request it can announce a check or ask the
necessary clarification; it must not invent an interpretation or imply that a change is complete.
The image-only sentence must not claim to have identified details before inspecting the image.

The first analysis incorrectly treats “simple” as permission to use a generic placeholder. This
revision replaces that recommendation, including the one posted in
[ticket comment 156768](https://roomle.atlassian.net/browse/RML-18303?focusedCommentId=156768).

## How the response worked at the analysed base

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

The missing behaviour is an early sentence about the requested action. Streaming already carries
it if the model produces it early; the working status cannot substitute for its content.

The retained Azure baselines illustrate the distinction: the text kitchen has first visible text
at **13.328 / 13.309 seconds**, versus first generated model output at 2.883 / 1.698 seconds; the
image kitchen has first visible text at **13.648 / 8.817 seconds**, versus first generated output at
4.609 / 2.876 seconds. These are the two runs in each
[text baseline](../benchmarks/baseline-fkwm-az-2026-10-28.md#results-milestones-and-total-time) and
[image baseline](../benchmarks/baseline-iklw-az-2026-10-28.md#results-milestones-and-total-time),
not a new measurement or a forecast for every provider. Pre-turn page setup is separate; warm
context acquisition in those runs is about 20 ms, so the source trace does not establish context
loading as the dominant delay.

## Selected design

Start with the system prompt of the existing agent, in roomle-ui
[`hi-agent-prompts.ts:13–21`](https://github.com/roomle-dev/roomle-ui/blob/ed4244eec/packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts#L13-L21).
Its current sentence, “Call tools instead of describing what you would do, then summarize what
you changed”, discourages the requested opening. Replace that sentence coherently; do not append
a conflicting instruction beside it. A candidate instruction is:

> At the start of each user turn, before detailed planning, write one short sentence in the
> user's language saying what you will do for their request. Base it on the request and known
> conversation only; leave layout decisions, measurements and product selection for later.
> Then continue with the tools and summarize the confirmed result. Do not stop after the opening
> sentence or repeat it before each tool call.

This is a proposed instruction, not a measured result. The important ordering is **brief intent
response → detailed planning and tools → confirmed result**, rather than a detailed plan followed
by an introductory paragraph. An opening can be as short as six to twelve words; no fixed word
count is needed in the API.

Official [OpenAI reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning)
explicitly recommends asking for a short preamble before deeper reasoning to improve time to first
visible text. This supports trying the existing model first. It does not establish a latency
bound for the Azure deployment or every provider this application supports. The model must still
receive the request and infer its intent; full context acquisition also precedes the call today.

Keep the first sentence in the same model response as the subsequent work. Existing `text-delta`
forwarding displays it immediately, while the turn remains busy. Do not emit `done` at the end of
the sentence, force a text-only first step, or insert a synthetic assistant message. Genuine
model output belongs to successful history through the existing `responseMessages` path.

For Responses providers, verify intermediate message metadata survives the SDK and history path.
The official guidance discusses preserving assistant `phase` for commentary versus final answers.
The installed OpenAI adapter already reads message phase into text metadata and replays it
(`openai-responses-language-model.ts`, `convert-to-openai-responses-input.ts`); this is evidence
of adapter support, not a test of the complete Azure/proxy path. No new UI output type is required
just to display the sentence.

This proposal adds no separate model request or agent step when the opening and tool calls occur
in the same response. It adds the sentence's output tokens and streaming time. Faster first text
and unchanged planning quality must be demonstrated; neither follows from a prompt assertion test.

RML-18303's existing [proposal B](../refactoring-analysis/planning-assistant-performance-next-steps.md#52-b--the-tool-call-before-the-narration)
seeks to remove the model's 255–339-character planning preambles, whose streaming takes about
1.4–2.1 seconds before the create payload. **Its zero-text-before-tools criterion conflicts with
this feature.** Agree on the tradeoff: retain one early sentence about the requested action and
avoid the longer concept narration. Do not apply both instructions simultaneously or count the
opening sentence as faster kitchen creation. Proposal B is open work, not assumed implemented.

## Alternatives

| Approach | Assessment |
|---|---|
| Fixed local acknowledgement or cosmetic rewording | Rejected: does not demonstrate understanding of the prompt. |
| Keep only the current working status | Already immediate, but does not provide the requested response. |
| Prompt-specific templates selected by keywords | Rejected: another intent classifier, brittle for follow-ups, languages and ambiguous requests. The agent already interprets the prompt. |
| Force a text-only first model step | A text-only response normally ends this tool loop; tools do not automatically run afterwards. A separate continuation would be required. Do not insert `toolChoice: 'none'` at step zero and expect planning to continue. |
| Separate lightweight acknowledgement generation | A valid fallback if the same-model opening is still late. Give it the prompt and relevant recent conversation, no tools, catalog or planning rules; ask only for the intended action. Stream its sentence, then run the planner. This separates intent recognition from detailed planning, but adds a request, cost and potentially delay to the first kitchen. A fast model and its availability must be verified; using the same slow deployment does not establish a benefit. |
| Run that extra generation concurrently with planning | Can avoid a sequential planning delay, but requires coordinated output order, failure and cancellation behaviour. Defer until timing shows the extra generation is needed. |
| Reduce reasoning effort for the whole planner | Changes planning quality and the existing performance comparison. Not necessary to try an early opening; a separately generated opening could use lower reasoning where supported without weakening planning. |
| Show reasoning or progress based on elapsed time | Does not supply the requested short action sentence. |

The AI SDK documentation confirms that text, reasoning and tool events are distinct
([streaming](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)), and that automatic multi-step
generation continues through tool results until a response has no further tool calls or a stop
condition is met ([tool loop](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#multi-step-calls-using-stopwhen)).
The repository pins `ai@7.0.122`; verify any model-loop alternative against that version rather
than copying current documentation's helper names.

## Scope and verification for implementation

| Repository / files | Required scope |
|---|---|
| roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts`, its `__tests__/hi-agent-prompts-test.ts` | Replace the conflicting sentence. Guard one prompt-specific opening per user turn, followed by execution and the result; retain existing planning and confirmed-result rules. |
| roomle-ui `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts`, `hi-planning-azure.spec.ts` | Simulate opening text followed by a delayed tool call and final text. Verify early forwarding, a single completed turn, history and phase metadata; no extra model step introduced solely for an opening. |
| roomle-ui `tests/integration/common/components/PlanningAssistantChat.spec.ts` | Verify streamed opening, tool activity, readable final text, busy state, errors and later turns. Existing renderer/store need no placeholder state. |
| roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`, `agent-architecture.md`, `packages/embedding-lib/docs/planning-assistant-overview.md` | Document the prompt contract and distinguish opening intent from confirmed action. Reconcile proposal B before implementation. |
| roomle-hi-example `docs/ai-chat.md`, `.agents/context/pages-chat-and-launcher.md` | Explain what the user sees and link to roomle-ui for implementation. |
| roomle-hi-example `.agents/benchmarks/` and existing prompt-run tooling | Retain a controlled before/after comparison of the opening's content, first-text timing, first plan change and final result. No tracked suite change is needed just to select cases. |

Success requires an opening tied to the actual prompt in the first model call, before tool use,
with no detailed layout or product analysis in that sentence. Planning must then continue and
complete. Evaluate creation, a specific edit, price enquiry, an ambiguous follow-up and an
image-only turn, including multiple turns and the user's language. For an already short direct
answer or necessary clarification, respond directly rather than adding a redundant promise.

Existing `firstTextMs` measures the first model text and can measure this opening. Retain the
content and time of the first text event, opening completion, first tool call, first successful
plan change, total turn time and call count. Compare with the same prompts, provider, reasoning
setting and source versions, at least two repetitions per case. Check content and completion as
well as timing: an early sentence followed by no action fails. Mock stream tests establish
forwarding and lifecycle, not model compliance or a latency improvement. No new paid runs are
performed in this analysis; their scope and budget require the existing benchmarking workflow.

A prompt-only implementation reaches the hosts through a **planner deployment** and a restarted
assistant session, since prompts are fetched during setup. It needs no embedding-lib rebuild,
consumer version bump, translation key or proxy route. If wire tests reveal a metadata defect,
fixing that path is an additional scoped change. The separate-generation fallback would require
embedding-lib orchestration and configuration, tests, consumer adoption and a suitable deployment
or proxy model alias; the current single `planning` alias does not prove a second model exists.

Neither proposal changes `glue-logic.ts`, the library's calculation or RoomleCore. The example's
pinned embedding-lib and the inspected roomle-ui checkout are different versions; no deployed
behaviour is inferred from the local checkout alone.

The pre-implementation investigation used source inspection, the ticket's discussion and
attachment, retained benchmarks and official SDK documentation. It changed no productive code,
prompts or tests and performed no new model experiment.

## Implementation and validation

roomle-ui commit `d13592675f0bd2e750fc6a429ad4927f4ca64cac`, on
`feat/planning-assistant-opening-response`, implements the prompt replacement directly on
`feat/hi-planning-assistant` at `ed4244eec`. The existing stream and agent loop carry the opening;
no separate model, output part, embedding build or consumer version change was needed. The
guarding prompt, stream/history, real pinned-adapter and component tests passed: eight SDK tests
and 76 targeted unit/integration tests. Desktop and mobile form checks with intercepted model
fixtures passed without live model calls.

The [comparison](../benchmarks/planning-assistant-opening-comparison.md) records all sixteen
successful live turns and 5,908,683 input tokens. In two repetitions per paired case, mean first
text changed from 17.855 to 3.818 seconds for the text kitchen and from 12.934 to 4.788 seconds
for the image kitchen, with the same three/seven model calls. Image-only and German edit, price
and clarification checks also passed the opening/continuation criteria. Photo fidelity remained
partial where the library could not build requested finishes or a backsplash; the answers
disclosed the omissions. One edit waited 11.048 seconds before first text, so an immediate
response for every request was not established. A second generator remains an unimplemented
alternative requiring its own justification.

Full documentation lint did not pass. The same 22 UI TypeDoc warnings and two SDK TypeDoc type
errors were reproduced on the unchanged required base under the installed dependencies. Type,
code and flag checks passed; no unrelated warning suppression or fixes were applied.

The durable contract is documented in roomle-ui's behaviour reference (D131), architecture and
embedding overview, and in this repository's [chat guide](../../docs/ai-chat.md) and
[host reference](../context/pages-chat-and-launcher.md). This analysis is retained until the
implementation lands; the planner deployment and restarted chat session are still outstanding.
