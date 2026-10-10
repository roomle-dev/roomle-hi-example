# Reserve a final answer step in the store chat

> **Status:** Fixed locally — final answer policy and store build verified
> **Date:** 2026-10-09
> **Former backlog item:** Ligna-store chat client, item 2
> **Ticket:** [RML-18033](https://roomle.atlassian.net/browse/RML-18033)

## Affected repositories

- **ligna-store:** reserve the final permitted model step for an answer in `hi-mcp/chat.ts`.
- **roomle-hi-example:** document the store policy, retain this analysis, and remove the solved backlog item and its index entries. Its existing runtime policy requires no change.

## Root cause and repository boundary

At the analysis baseline (`ligna-store c6da285`), the browser chat set
`stopWhen: stepCountIs(8)` at `hi-mcp/chat.ts:135` without a `prepareStep` policy. All eight model
steps could request tools. The SDK ended the loop normally at the limit, leaving no subsequent
model call to consume the last tool result and write an answer.

Normal completion returned `result.responseMessages`, bypassing interruption recovery. The
chat window created an empty assistant entry and filled it only through `onText`. Without text
deltas, it hid the working status and left that entry empty. The window rendered the symptom;
the model loop owned the defect.

The example already used a separate backend policy in
`hi-mcp/hi-mcp-chat/chat-steps.ts`: 16 model steps, with tools disabled at zero-based step 15.
`chat-stream.ts` applied that policy, and
`tests/chat-steps.test.ts` covered a model that otherwise kept requesting a tool.
The [chat architecture decision](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md)
places model-loop policy in each chat client, outside the shared MCP server.

roomle-ui and RoomleCore need no changes: planner methods execute the tools but do not control
the model step budget or generate the final answer. The Cloudflare Worker/container and MCP
tool definitions also need no changes. A store frontend release publishes this fix; an MCP
server deployment does not update it.

## Implementation

`ligna-store/hi-mcp/chat.ts` defines `MAX_CHAT_STEPS = 8`, uses it in `stepCountIs`, and sets
`toolChoice: 'none'` through `prepareStep` when `stepNumber === MAX_CHAT_STEPS - 1`.
The first seven model steps may call tools; the eighth receives their results and is reserved
for an answer. Early normal answers finish without using the remaining steps.

The store's eight-step budget is preserved. Matching the example's 16 steps would be a separate
product choice and would not by itself prevent budget exhaustion without an answer. No backend
module, unrelated logging helper or new dependency was copied into the store. MCP cleanup,
streamed text, tool status, conversation messages and interruption recovery stay in place.

This reserves an opportunity for a final model answer after normal tool execution. Provider
errors, aborts and a model returning empty text are separate outcomes; the policy does not promise
text under every failure condition. The SDK's
[official tool-calling reference](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
describes `stopWhen`, `prepareStep` and disabling tools with `toolChoice: 'none'`.

## Verification

The temporary external probe `.temp/store-final-answer.test.ts` imports the actual store
`streamChat`, uses the real AI SDK `7.0.122`, and mocks only provider/MCP boundaries. It adds no
test file, script, command or dependency to ligna-store and makes no network or model request.

Before the change, both budget-exhaustion cases (Azure and Mistral) finished eight tool steps
without calling `onText`; the other three checks passed. With the change, all five pass:

- Azure and Mistral each execute seven tool steps followed by a final answer on model step eight.
  The final prompt contains the last tool result; streamed text, seven tool messages, tool status
  and one MCP-client close are verified.
- An early normal answer completes in one model step without executing a tool.
- Provider error parts and thrown streams preserve the completed write result and the readable
  interruption summary, retain valid conversation messages, and close the MCP client once.
  No write is repeated.

The store production build, targeted strict TypeScript check, formatting and targeted ESLint
check pass. The normal lint command ignores `hi-mcp`, so this file is checked with `--no-ignore`.
Touched-document links and whitespace checks pass.

The [chat reference](../../docs/ai-chat.md#a-chat-turn) and chat skill describe the eight-step
store policy. Backlog item 2 and its overview/index entries are removed after local verification.
This analysis remains until the fix lands on master. No live provider/planner run or deployment
was required for the deterministic model-loop fix.
