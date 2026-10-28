# Finishing edits and the render that verifies them in one model response

| Field | Value |
|---|---|
| Type / domain | Refactoring analysis / HI Planning Assistant performance |
| Status | Open |
| Date / author | 2026-10-28 / Claude Code |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Parent analysis | [§6 of the remaining-work analysis](planning-assistant-performance-next-steps.md#6-new-proposal-one-decision-for-independent-finishing-edits-and-verification) |
| Base | roomle-hi-example `3fb7302` (master); roomle-ui `e6804d598` (`feat/hi-mcp-performance`) |
| Evidence | The two retained captures of [the image baseline](../benchmarks/baseline-iklw-az-2026-10-28.md) (`timeline.json`, `run.json`, `planner-calls.json` under `.temp/result/baseline-iklw-az-2026-10-28/`); the pinned AI SDK `ai@7.0.122` with `@ai-sdk/openai@4.0.81` and `@ai-sdk/azure@4.0.85`; the served text, the executors and their tests at the base |
| Scope | Analysis only: no productive change, no model run, no embedding-lib build |

Affected repositories:

- **roomle-ui**, branch `feat/hi-mcp-performance`: the served text — two sentences in the system prompt of the planner and one in the description of `get-plan-images` —, the tests that guard them, the executor and wire tests that guard the ordering the text promises, the tool fixture, and the behaviour, tool and architecture references. No executor, tool command or planner code changes.
- **roomle-hi-example**: this analysis and its index, the images paragraph of the tool skill, and the comparative benchmark after the change.
- The embedding-lib is not changed: the planner serves the system prompt and the tool descriptions (D80), and the example page loads them with the planner. No embedding-lib build and no new pin.

## 1. Conclusion

Both image kitchens finish with the same three model rounds after the lookup of the finishing
values: one edit, a second edit, a render — each a model call of its own, each tool call alone in
its response. The arguments of all three were known before the first of them was sent: the group
id from the create, the values from `find-attributes`. The planner would have run the three calls
in the order sent, one after another, with the images rendered after the edits — the executors
queue every plan change and `get-plan-images` on one chain (D4). The model does not know this:
every batching the served text invites is **inside one call** ("several at once", "in one call"),
no sentence says that several calls may go in **one response**, and the instruction to build the
next change on the result of the last (D119) reads as "wait for the result".

The proposal is a served-text clarification and nothing else: tell the model to send the calls
whose arguments it already holds in one response — each edit its own call, `get-plan-images` after
them when a render is due — and that the tools run in the order sent; a call that needs a result it
does not hold yet goes in the next response. The executors need no change. What changes for the
agent is specified in the text before the call (D51); no guard, no batch tool, no automatic render.

By the captures, the two removed model calls cost **9.461 s** of model time in the mean of the two
runs and about **175.8k input tokens** per image turn, nearly all cached. That is the budget being
combined, not a predicted saving: the combined call still generates the three calls' arguments,
the edits and the render still run, and the final review stays. The first kitchen is untouched.

The ordering the text promises holds today by the structure of the pinned SDK, the connector and
the executors (§3), not by a documented contract of the SDK: the implementation guards it with a
wire test on the pinned SDK before the sentence is served.

## 2. What happens today

### The seven calls of an image kitchen

Both runs of [the image baseline](../benchmarks/baseline-iklw-az-2026-10-28.md) take the same path:
skills → create → `find-attributes` → edit → edit → `get-plan-images` → answer. Seconds from the
assistant's turn start; "first output" is the model's time to its first streamed output.

| Call | Run 1: what the model sent | Model s (first output) | Tool s | Run 2: what the model sent | Model s (first output) | Tool s |
|---|---|---:|---:|---|---:|---:|
| 3 | `find-attributes` ids `mod_HandleColor`, `mod_CreateBacksplash` | 2.214 (1.714) | 0.011 | `find-attributes` ids `mod_HandleColor`, `mod_HandlePosType`, `mod_CreateBacksplash` | 14.060 (13.480) | 0.016 |
| 4 | `change-group-attribute` backsplash true — library error | 8.466 (7.799) | 0.145 | `change-group-attribute` handle colour Black and handle position 01, one call | 2.523 (1.673) | 0.664 |
| 5 | `change-group-attribute` handle colour Black | 2.699 (1.966) | 0.717 | `change-group-attribute` backsplash true — library error | 2.677 (2.076) | 0.116 |
| 6 | a text of 395 characters, then `get-plan-images` | 8.114 (3.074) | 0.448 | a text of 330 characters, then `get-plan-images` | 5.432 (3.078) | 0.447 |
| 7 | the answer | 4.863 (1.968) | — | the answer | 4.878 (1.928) | — |

The library's attributes and values above are the content of the captures, named here to read the
runs; the served text names none of them.

The edits of calls 4 and 5 are independent of each other: both take the group id the create of
call 2 returned and a value the lookup of call 3 returned, and neither reads the other's result. The
render of call 6 has no arguments. In both runs the backsplash fails in the library
([library issue 10](../backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate)),
in a call of its own, so the handles are kept — in run 1 the failure comes first, in run 2 second.

Call 6 is the most expensive of the three: before the render the model writes a paragraph that
summarises the kitchen and announces the images ("Here are the furniture view and the room's top
view for comparison"), 132 and 112 output tokens with 28 and 19 reasoning tokens; the render is the
hand-over to the answer for the model, and that is why it gets a response of its own. The parent's
[§5](planning-assistant-performance-next-steps.md#5-new-proposal-generate-the-action-before-narrating-it)
covers the narration; this analysis covers the rounds.

### The model already sends several calls in one response

Call 1 of both runs sends two `get-skill` calls in one response — the image skill and the kitchen
skill —, and the request of call 2 carries their two results as two `function_call_output` items.
The handle edit of run 2 sets two attributes in one `change-group-attribute` call, as the tool
description invites. The model does what the text invites: several things in one *call*. Nothing
invites several *calls* in one response.

### Why the model sends them one by one

The served text at the base (roomle-ui `packages/web-sdk/packages/homag-intelligence/src/`):

- **The batching the text invites is inside one call.** `change-group-attribute`: "several at once
  with attributes - all the materials of a group in one call" (`hi-mcp/hi-mcp-server.ts`, the
  registration of the tool); `find-attributes`: "several ids in one call"; the authoring rules:
  "A group is created with all its articles in one call", "several at once by adding the picks".
  No sentence of the system prompt, the authoring rules or a tool description says that several
  calls may go in one response, or in which order the tools then run.
- **The system prompt reads as one call per response.** `SYSTEM_PROMPT` (`hi-agent-prompts.ts`):
  "Within a turn, the result of your change is the current state of its groups: build the next
  change on it, and read the plan context again only for what a result does not carry" (D119). The
  sentence is about the state, but a model reads "build the next change on the result" as "wait
  for the result before the next change" — also where the next change needs nothing of it.
- **`get-plan-images` says when, not how.** Its description opens with the occasions of a render
  (D118) and says that a check needs none; its only sequencing sentence, "open it with
  open-or-close-article … right before this tool", names a sequence, not a response. Nothing says
  that the render may follow edits sent in the same response and shows the plan as they left it.
- **The narration before the render** (above) is the model's hand-over to the answer; it is the
  subject of the parent's §5, and the proposed sentence does not depend on it.

No tool result, correction or guard is involved: the executors accept calls at any rate, and the
model never received a message that asked for one call at a time.

## 3. What the code already guarantees

The property the proposed text promises — the calls of one response run in the order sent, the
images after the edits before them — holds along the whole path at the base. Paths are relative to
roomle-ui.

1. **The AI SDK runs the tool calls of a response in their order.** `ai@7.0.122`,
   `executeToolsFromStream` (`node_modules/ai/dist/index.js:8917`): every `tool-call` part of the
   stream is pushed to `toolCallsToExecute` in stream order, and at `model-call-end` the SDK runs
   them with `Promise.all(toolCallsToExecute.map(async …))` — all at once, started in that order.
   `executeToolCall` (`:3657`) awaits the same steps for every call before it invokes
   `tool.execute` (the tool context, the start callback, the tracing span), so the executes start
   in call order. This is an ordering by equal async depth, not a documented contract of the SDK:
   the wire test of §6 guards it against an SDK upgrade. The SDK starts the tools only after the
   whole response has streamed, so the first edit waits for the arguments of the later calls — a
   few dozen tokens.
2. **The host forwards at once.** `createHiMcpTools`
   (`packages/embedding-lib/src/homag-intelligence/hi-mcp-tools.ts:99`): `execute` calls
   `extended.callExternalObjectAgentTool(name, input)` without awaiting anything before it; the
   connector posts the call to the planner frame synchronously (`sendMessage`,
   `packages/embedding-lib/src/connector.ts:92`); messages to one window arrive in the order
   posted.
3. **The planner chains the call when it arrives.** `RoomlePlanner.callExternalObjectAgentTool`
   (`packages/web-sdk/packages/planner-core/src/roomle-planner.ts:3275`) awaits the tool import —
   resolved after the first call —, `mcpTool.execute` awaits the input parse
   (`hi-mcp/mcp-tool.ts`), `runTool` (`hi-mcp/hi-mcp-server.ts:176`) is synchronous up to the
   executor, and `oneAtATime` (`hi-mcp/tool-executors.ts:268`) chains the executor onto
   `planChanges` at that moment. Every plan-changing tool, `get-plan-context`, `find-attributes`,
   `get-price`, `get-order-data` and `get-plan-images` are on that chain (D4): the images render
   after the edits sent before them — guarded today by `it('renders the plan images after an
   opening sent at the same time')` in `__tests__/hi-mcp/tool-executors-test.ts:1908`. A call
   that fails does not block the next (`planChanges = run.catch(() => undefined)`; `it('runs the
   next plan change after one that fails')`).
4. **Every call keeps its undo boundary.** `recorded` wraps each plan-changing call on its own
   (`tool-executors.ts:279`): a call that changed the plan is one record, a call the library could
   not calculate changes nothing and leaves no record (D106, D38). Three calls in one response are
   three records, as three responses are today; `undo` reverts the last one.
5. **A failure stays in its call.** `mcpTool` answers a thrown error as an `isError` text result,
   `createHiMcpTools` catches a forwarding error the same way: the SDK gets a tool result, not a
   stream error, runs the other calls of the response and hands every result to the model in the
   next request — `it('passes the error of a failing tool to the model as its message in a tool
   result')` in `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts`.
   The chained request of the assistant (`prepareStep` in
   `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts:385`) sends the tool
   messages of the previous step as `function_call_output` items — several per request already, as
   the two skill results of call 2 show. The images of `get-plan-images` go in as the text naming
   them and two file parts (`it('passes the plan images to the model as the text naming them, then
   two file parts')`).
6. **Separate calls, not one attribute transaction.** One `change-group-attribute` call with both
   attributes would be one `change-attributes` operation
   (`hi-tool-commands.ts:1172`), and a value the library cannot calculate makes the tools discard
   the whole operation — "nothing was changed", the group as it was (D106). In the captures the
   handles would have been lost with the backsplash. The parent's warning stands: each edit stays
   its own call, in one response.
7. **The provider lets the model send several calls.** The Responses API runs with parallel tool
   calls unless `parallel_tool_calls` is sent false; the assistant sets no `parallelToolCalls`
   option and the provider sends the field only when set (`@ai-sdk/openai@4.0.81`,
   `node_modules/@ai-sdk/openai/dist/index.js:7403`). The chat window's status line names each
   tool as its call streams (`tool-input-start`), three names in a row.

## 4. The proposed target

### The served text

Two places, both in roomle-ui on `feat/hi-mcp-performance`, both reaching every chat through the
planner (D80), both cached in the prefix. Library-neutral, short, describing how to succeed
(§2.4 of the behaviour reference).

**The system prompt** (`SYSTEM_PROMPT` in `hi-agent-prompts.ts`), after the D119 sentence
"… or after undo and redo.":

> Send the calls whose arguments you already hold in one response - several edits, each its own
> call, and get-plan-images after them when a render is due - the tools run in the order sent. A
> call that needs a result you do not hold yet - a new id, a value from find-attributes, a
> correction - goes in the next response.

**The description of `get-plan-images`** (`hi-mcp-server.ts:962`), after its last sentence
"… right before this tool.", with the D118 opening sentence unchanged:

> Sent in the same response after edits, it renders after them - the tools run in the order sent -
> so the images show the plan as the edits left it.

The first sentence of the system prompt addition is the rule, the second its boundary: a merge or
an exchange that returns a new id, a value the model has not looked up, a correction it has to
act on — those results come with the next response. A call that may fail is no reason to wait:
its failure is a result like any other, the other calls of the response run, and the model reads
them all together.

### The candidate path

skills → create → lookup → **edits + render** → answer: five model calls where the seven-call image
runs send the edits and the render one by one. The lookup stays a round of its own: its results
are the edits' arguments.

### What the captures say it is worth

| Mean of two runs | Value |
|---|---:|
| Model time of calls 5 and 6, the two calls removed | 9.461 s (10.813 / 8.109) |
| Input tokens of calls 5 and 6 | 175.8k (174,914 / 176,643), 99% cached |
| Tool time of the edits and the render, unchanged | 1.27 s (1.310 / 1.227) |
| Time after the first kitchen today | 29.257 s |
| Completed turn today | 50.638 s |

The 9.461 s is the round budget of the removed calls: the combined call still generates the
arguments of three calls instead of one — about 120 output tokens where today's call 4 writes 55 —, and
its first output comes after the same provider wait as any call. The narration of call 6 (5.040 s
and 2.354 s of its stream) is not counted here; it is the parent's §5. An honest expectation is a
completed image turn of about 41–43 s against 50.6 s today, inside the 25–50 s target range; the
screen of §7 decides. The first kitchen (21.381 s) is before the create and cannot change; a longer
prefix by two sentences is cached from the second request on.

## 5. Scope, with file references

Paths relative to roomle-ui unless marked; `HI = packages/web-sdk/packages/homag-intelligence`.

| Area | File | Change |
|---|---|---|
| System prompt | `HI/src/hi-agent-prompts.ts` | the two sentences of §4 after the D119 sentence of `SYSTEM_PROMPT` |
| Tool description | `HI/src/hi-mcp/hi-mcp-server.ts:962` (`get-plan-images`) | the sentence of §4 at the end of the description |
| Fixture | `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` | the changed description, with its fixture test |
| Behaviour reference | `.agents/homag-intelligence/hi-tools-behaviour.md` | a decision row in §3 "Speed" (D123: the calls whose arguments are known go in one response, the render after the edits; rejected: a batch tool, an automatic render, one attribute transaction); the system prompt paragraph of §4 "The HI chat"; the `get-plan-images` bullet of §6 |
| Tool reference | `.agents/homag-intelligence/hi-tools-reference.md` (`get-plan-images`) | the sentence on the same response |
| Architecture | `.agents/homag-intelligence/agent-architecture.md`, "One tool call at a time" | the model is asked to send independent calls in one response; the SDK runs them at the end of the response, in order |
| Tool skill (roomle-hi-example) | `.agents/skills/hi-mcp-tools.md`, `get-plan-images` | the sentence on the same response |
| Executors | `HI/src/hi-mcp/tool-executors.ts` | **no change** — the queue is the property |

## 6. Tests and the output changes to expect

The served-text tests change their expectations; the ordering tests add cases to existing
describe blocks; no test's expected plan output changes.

| Test file (roomle-ui) | Case |
|---|---|
| `HI/__tests__/hi-agent-prompts-test.ts` | the system prompt asks for the calls whose arguments are held in one response, the render after the edits, and a dependent call in the next response; the D119 sentence stays |
| `HI/__tests__/hi-mcp/hi-mcp-server-test.ts` | `get-plan-images` says that, sent after edits in the same response, it renders after them; `it('tells the agent when a render is due and that a check needs none')` keeps passing — the opening sentence is unchanged; the served text stays free of rejections and internals |
| `HI/__tests__/hi-mcp/tool-executors-test.ts`, `describe('plan changes')` | two attribute edits and the images sent at the same time, the first edit refused by the planner: the second runs, the images render after both, the history holds one record — the successful edit — and `undo` reverts it alone |
| `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts` | the pinned SDK with one model response of three tool calls — edit, edit, `get-plan-images` — through `forwardingTo(planner)`: the planner receives the two operations then the snapshot, the snapshot after both operations have resolved (the first resolving late, through a deferred mock); the tool message of the next request carries the three results in call order — an `isError` text for the failed edit, the edit result, the text naming the images with the two file parts |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-azure.spec.ts` | the chained Responses request of the next step carries the three `function_call_output` items in call order, the image content among them |

The wire test on the pinned SDK is the gate of the text: if the SDK of the base started the
executes out of order, the sentence "the tools run in the order sent" would be false and is not
served; an explicitly ordered tool contract would then be a design of its own, as the parent says.

Before the model screen, a model-free check in the example page confirms the real path: call
`instance.extended.callExternalObjectAgentTool` three times in one `page.evaluate` without
awaiting — the two edits of a capture, then `get-plan-images` — and read the planner's `[hi-mcp]`
log order and the handles in the returned images — the launcher without a model, the page in
headless Chromium, as the end-to-end runs open it ([scripts and testing](../context/deployment-and-testing.md)).

## 7. Benchmark before and after

The contract of the parent's
[§10](planning-assistant-performance-next-steps.md#10-benchmark-and-acceptance-contract) applies:
the October 28 reports are the historical baselines, and the candidate gets a contemporaneous
control — two fixtures × two repetitions × control/candidate, eight turns, interleaved, fresh
sessions, `gpt-6-astra` on Azure with provider-default reasoning, plan
`ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`, the exact prompts without the suite suffix, image
`kitchen-1.png`. The candidate runs against the local planner on `feat/hi-mcp-performance` with
the served text, the control against the planner at the base — the served text comes with the
planner, so no embedding-lib build and no new pin is involved; both record the loaded planner and
embedding-lib URLs. The text fixture runs as the regression guard of the first kitchen: it has no
finishing edits and must not change.

Read per candidate repetition of the image fixture:

1. `usage.diagnostics.modelCalls.length` of `run.json`: at most five.
2. The tool order of `timeline.json`: both edits and `get-plan-images` between the end of one fetch
   and the start of the next; `planner-calls.json`: the two `externalObjectGroupOperation` calls,
   then `getExternalObjectSnapshot`, in that order.
3. The final state: the handles as requested in `order-data.json`, the backsplash absent and named
   as missing in the answer, the plan's undo history with one step per successful edit.
4. The images: the group view rendered after the edits — the handles of the request visible in
   `turn-1-plan-images-1-perspective-object.jpg`; no stale image.
5. The milestones: first kitchen within the spread of the control; completed turn lower than the
   control in both repetitions.

Accept when all five hold in both repetitions. A candidate that keeps seven calls has not failed
the code — the model stays free (D51) — but the sentence has not reached it: reword before measuring
again. The run needs its own go.

## 8. Alternatives considered

| Alternative | Why not |
|---|---|
| A batch tool, or an explicitly ordered tool contract | Adds API for a property the queue already has; kept only as the fallback should the wire test of §6 fail on the pinned SDK |
| An automatic render after an edit when a render is due | The agent decides what it needs (D118, D51); a render the model did not ask for is a round of images it may not read |
| Both attributes in one `change-group-attribute` call | One operation; a value the library cannot calculate discards it whole (D106) — the handles would be lost with the backsplash |
| The finishing attributes in the create | The parent's §8: a failing generated part puts the group in `notLoaded`; D122 defers these values on purpose |
| The lookup in the same response as the create | Its ids are known before the create (the `valueCount` attributes of D122), so a four-call path is conceivable; it loads the create call, the largest of the turn, with a second decision — a proposal of its own, measured apart |
| Suppressing the narration before the render | The parent's §5; independent of the rounds, and the saving must not be counted twice |

## 9. Risks and limits

- **The model may keep one call per response.** The text invites, it does not force; the screen of
  §7 measures the model, not the code. Two sentences are a small change to a cached prefix: a
  reword costs a run, not a build.
- **A bundled dependent call.** A model that sends an edit on an id it does not hold yet gets the
  tool's correction or error in the next call and sends the call again — one round, as a wrong
  guess costs today; the second sentence names the cases.
- **A correction seen together with the images.** When the first edit answers a correction (a
  switched program), the model reads it with the images instead of before the render; a repair then
  needs another edit and render — the same round it needs today.
- **Other models.** The sentences reach every model; a model that renders after most changes
  (the Mistral backlog) renders in the same response instead of one later — not more often, D118
  stays. The text is read by MCP hosts as well, where `get-plan-images` is served alone; the queue
  holds there too.
- **The SDK's ordering is structural.** An SDK upgrade that starts the executes differently breaks
  the sentence, not the plan: the wire test of §6 fails the upgrade.
- **The saving is an upper bound.** 9.461 s of model time is what the removed calls cost; the
  combined call's extra generation and the provider's variance (call 3 of run 2 waited 13.5 s for
  its first output) decide the measured result.
