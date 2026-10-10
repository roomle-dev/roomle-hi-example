# PR review: completed tool outcomes and calculation recovery advice

> **Date:** 2026-10-10
> **Status:** Fixed locally — review changes not landed
> **Review:** [roomle-hi-example PR #94](https://github.com/roomle-dev/roomle-hi-example/pull/94)

## Affected repositories

- **roomle-hi-example** — guarded the chat tool-completion diagnostic, clarified calculation recovery advice, added regressions and aligned the living reference and backlog wording.

## Verified findings at review head `e603e2a`

The chat wrapper in `hi-mcp/hi-mcp-chat/chat-stream.ts` awaited an MCP write, then logged success inside the same `try` block. A thrown success log reached the tool-failure handler, so the AI SDK received an error after the write had completed. Recovery recorded the actual result, but the next model step saw the wrong outcome and could repeat the write.

The final calculation-diagnostic pass in `hi-mcp/hi-mcp-server/tool-executors.ts` ran after `applyGroupWideAttributes`. An Error/Fatal diagnostic could therefore originate from the group's `attributes`, including values applied by `change-attributes`, as well as a root override. The advice named only root overrides and omitted a field the agent might need to correct.

Library backlog item 61 and its index row used “which one handleless fronts are”, obscuring the distinction between selecting a handleless article and setting the “No handle” attribute value on a handled article.

## Implementation

1. Guarded the completion diagnostic with its own `try/catch`, so a successful MCP result reaches the SDK even when that log throws. Tool execution and genuine error propagation are unchanged.
2. Named both `posGroups[index].attributes` and root overrides in the calculation recovery advice. Loaded groups, runtime identifiers, first diagnostic lines and partial-success behavior are preserved.
3. Reworded the library backlog and its index to identify the two alternatives explicitly. The library issue remains open and the server remains library-neutral.
4. Updated the chat, behavior and tool references with these contracts.

## Verification

The new logging regression failed against the review head: the next model prompt carried `error-text` with “Completion logger failed” instead of the successful write result. It passes with the guarded diagnostic and verifies one write, a normal answer, no tool-error log and one MCP-client close.

Both Error/Fatal recovery regressions failed against the review head because the advice omitted the group attributes. They introduce the diagnostic only after the group-wide attribute command and pass with advice that names `posGroups[0].attributes` and root overrides while retaining the loaded group.

All 314 tests in the affected chat-stream and tool-executor suites pass. The scoped workspace typecheck for server/client/chat, root lint, formatting, all Markdown links (`bad 0`) and whitespace checks pass. No external model or planner request was made.
