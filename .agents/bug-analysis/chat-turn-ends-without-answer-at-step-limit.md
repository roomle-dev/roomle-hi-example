# A chat turn that reaches the step limit ends without an answer

> **Type**: Bug Analysis
> **Domain**: hi-mcp-chat — the step loop of the chat backend (`hi-mcp/hi-mcp-chat/chat-server.ts`, `streamText` of the Vercel AI SDK `ai` 7.0.122)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-10-01_10-23-00/report.md` (gpt-5-mini, planner `bo-test`), run 06; the same in run 06 of the gpt-6-astra suite `mcp-test-2026-10-01_09-44-51`
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Fixed
> **Branch**: `fix/mcp-test-gpt-5-mini`

---

## Symptom

Run 06, "create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers,
as well as wall cabinets in the back right corner … walnut … dark marble". One turn, eight tool
calls (`run.json`):

```text
get-plan-context, get-authoring-rules, create-or-replace-groups ×2, change-group-attribute ×2,
change-module-attribute, find-attributes
```

`answer` is `""`. The console shows `[hi-chat] tool done: find-attributes` and directly after it
`[hi-chat] chat done (72514ms)` — no further model call. The model was in the middle of its work:
it looked up the worktop attribute after two failed attempts, the fridge was still missing. The
user gets no reply and does not learn what was done and what not.

The gpt-6-astra suite of 09:44 had the same ending in its run 06: eight steps (twelve tool calls),
no answer, the cooker hood missing. The limit was flagged as close to a complete flow on
2026-09-29 (F-A3 in [agent-placement-in-a-room-corner-findings.md](agent-placement-in-a-room-corner-findings.md)).

## Investigation

**The loop.** `streamText` (`chat-server.ts:108-117`) runs with `stopWhen: stepCountIs(8)`. A step
is one model call plus the execution of the tool calls it returns; after each step the SDK checks
the stop condition — `isStepCount(8)` is `({ steps }) => steps.length === 8`
(`node_modules/ai/dist/index.js:5495-5497`). When the eighth step is a tool call, the tool runs,
the condition is true, the loop ends. The model never sees the eighth result and never writes its
reply.

**One tool call per step.** gpt-5-mini returned exactly one tool call per step in every run of the
suite (`console.log`: one `tool call` line between two model calls) — the step limit is a limit of
eight tool calls. The simple prompts need three (`get-plan-context`, `get-authoring-rules`,
`create-or-replace-groups`); a full kitchen with materials needs more than eight. Mistral Large
calls several tools per step (twelve calls in eight steps in the 09:10 suite) and reaches the limit
later, but on the same prompt.

**What the SDK offers.** `prepareStep` runs before every step and can override the step's
`toolChoice` (`index.js:10932-10973`, `stepNumber` = the number of steps recorded so far, 0-based).
With `toolChoice: 'none'` the provider is told not to call a tool; all four providers of the chat
(Mistral, Anthropic, Google, Azure OpenAI) support it.

## Root cause

`hi-mcp/hi-mcp-chat/chat-server.ts:116` — `stopWhen: stepCountIs(8)` stops the loop after the
eighth step whatever that step was. A last step that is a tool call leaves the turn without the
model's answer: the limit is enforced on tool calls, but nothing makes the model answer before it.

## Fix

`b93debe` "fix: end every chat turn with the model's answer":

1. **The last step answers.** `prepareStep` returns `{ toolChoice: 'none' }` for the last step
   the limit allows (`stepNumber === MAX_CHAT_STEPS - 1`): the model gets every tool result and
   has to write its reply — what it did and what is left. The stop condition stays; the turn
   still ends after the last step.
2. **Sixteen steps instead of eight.** With one tool call per step, eight steps covered the
   creation of the full kitchen and its fronts in 06, but not the worktop, the missing fridge and
   the reply. Sixteen give the same prompt room to finish; the simple prompts end after three or
   four steps either way.

The step settings live in `hi-mcp/hi-mcp-chat/chat-steps.ts` (`chatSteps`, spread into
`streamText` in `chat-server.ts`) — `chat-server.ts` starts the server on import and cannot be
loaded in a test. The unit test `hi-mcp-chat/tests/chat-steps.test.ts` drives `streamText` with
the SDK's `MockLanguageModelV3`, a model that calls a tool whenever it may: the turn makes
`MAX_CHAT_STEPS` model calls, only the last with `toolChoice: { type: 'none' }`, and ends with the
model's text.

## Validation

- `npm test` in `hi-mcp`: 205 tests pass (the suite `cf/tests/worker.test.ts` does not load
  locally — `@cloudflare/containers` is not installed in this checkout, unrelated to the change);
  `npm run typecheck` clean.
- "test the mcp" with gpt-5-mini on `b93debe`
  (`.temp/result/mcp-test-2026-10-01_10-57-08/report.md`): run 06 made the same
  eight tool calls as before and then answered in a ninth step (135 s) — the turn that ended
  without an answer at 10:23 now ends with the model's summary. No run reached sixteen steps, so
  the forced last step is covered by the unit test only.
