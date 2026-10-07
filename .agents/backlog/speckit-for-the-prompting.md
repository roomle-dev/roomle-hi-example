# Backlog: analyse how Spec Kit can help with the prompting

> **Type**: Backlog item (analysis; the served text of the MCP server and the chat prompt)
> **Domain**: the instructions, the authoring rules and the tool descriptions of the MCP server
> (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`), the chat prompt (`CHAT_SYSTEM_PROMPT`,
> `hi-mcp/hi-mcp-chat/chat-config.ts`)

## Problem

Once the MCP server offers the main planning functions, the quality of a planning is mainly a
prompting problem: what the model is told about the planning, in which order, and when it is done.
The served text has grown rule by rule ([hi-mcp-behaviour.md §2.4](../../docs/hi-mcp-behaviour.md#24-instructions),
[§5](../../docs/hi-mcp-behaviour.md#5-information-the-server-provides)); it has no fixed structure for
the input, the checks before acting, the guidelines and the criteria of a finished planning.

[Spec Kit](https://github.com/github/spec-kit) structures its agent prompts in sections such as:

- `## User Input`
- `## Pre-Execution Checks`
- `## Quick Guidelines`
- `### Success Criteria Guidelines`
- `## Done When`

These prompts can serve as inspiration for what the planning should take up as agent instructions
or skills.

## To do

Analyse the prompt templates of Spec Kit against the served text and the chat prompt:

1. Which sections of Spec Kit's prompts have a counterpart in the instructions, the authoring rules,
   the tool descriptions and `CHAT_SYSTEM_PROMPT`, and which are missing — e.g. checks before the
   first plan change, success criteria of a planning, and when the agent is done.
2. Which of them would improve the plannings, as a proposal for the served text — in the words of the
   guidelines of [hi-mcp-behaviour.md §2](../../docs/hi-mcp-behaviour.md#2-guidelines): shorter, not
   longer.

The result is a feature analysis in `.agents/feature-analysis/`.

## Test

A proposed change to the served text is measured with "test the mcp"
([hi-mcp-testing.md](../skills/hi-mcp-testing.md)) against the results of the current text.
