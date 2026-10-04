# Tool results fill Mistral's context within one turn

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the text results of the MCP tools (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`); the agent-ready plan context they pass through (roomle-ui `homag-intelligence`, see [agent-ready plan context](../refactoring-analysis/agent-ready-plan-context-in-glue-logic.md))
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-09-30_18-52-26/report.md` (mistral-large-latest, planner `bo-test`): run 06 ended with `Prompt 262149 > 262144 maximum context length` after twelve tool calls without `get-plan-images`; gpt-5.4-mini's run 06 of 18:34 ended the same way
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Fixed
> **Branch**: `fix/chat-context-overflow-mistral`

---

## Symptom

Run 06, "create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers,
as well as wall cabinets in the back right corner … walnut … dark marble". One turn, twelve tool
calls (`run.json`):

```
get-plan-context, get-authoring-rules, find-attributes ×2, create-or-replace-groups,
change-group-attribute, create-or-replace-groups, merge-article-into-group,
change-group-attribute, create-or-replace-groups, merge-article-into-group ×2
```

The next request to Mistral was 262,149 tokens, 5 over the limit (`console.log:168`); the turn
ended without an answer.

## Investigation

`streamText` sends the whole turn with every step: the system prompt, the tool definitions, the
user message and every tool call and tool result so far. The conversation between turns is only
text (the page keeps `role`/`content` strings), so the context is spent within one turn.

The tool results were measured against a live page (preset plan `HI_PRE_Roomle_Milestone_2`,
`Furniture_Smith`, MCP SDK client against the server on :3110) and counted with Mistral's own
tokenizer (`usage.prompt_tokens` of a `mistral-large-latest` request with the text as the only
message):

| Text | Characters | Mistral tokens |
|---|---|---|
| tool definitions (`tools/list`) | 14,696 | 3,492 |
| `get-authoring-rules` | 14,705 | 3,921 |
| **`get-plan-context` (default sections), as the server returns it** | **327,826** | **138,084** |
| the same, compact JSON | 228,691 | 120,328 |
| the same, compact JSON without `imageUrl` | 94,933 | 29,656 |
| `find-attributes "walnut"` (6 matches), as returned | 58,692 | 32,480 |
| groups section of run 06 (one group, 11 units + generated roots), pretty-printed | 84,663 | 28,582 |
| the same, compact JSON without `imageUrl` | 43,107 | 16,346 |

One `get-plan-context` takes 53 % of Mistral Large's context. Run 06 spent about 210k tokens
before its first plan change (definitions, `get-plan-context`, the rules, two `find-attributes`);
the three `create-or-replace-groups` results (each returns every group of the plan) and the
command results filled the rest.

Two things make the results large:

1. **`imageUrl`** — the agent-ready plan context carries a signed HOMAG CDN URL for every
   article, root module, sub-module, attribute and attribute value: 427 URLs, 127,780
   characters, in the default `get-plan-context`; 132 of 58,692 characters in
   `find-attributes "walnut"`. A SAS signature is random text and tokenizes at about two
   characters per token: the URLs are 75 % of the `get-plan-context` tokens (120k → 30k
   without them).
2. **Pretty-printing** — `textResult` (`hi-mcp-server.ts:74-78`) serializes every result with
   `JSON.stringify(result, null, 2)`: 13 % more tokens for the same data.

**Who uses the URLs.** No model in this setup can open them: the chat models have no fetch
tool, and an MCP client sees them as text. None of the 52 stored runs in `.temp/result/` put
one into an answer. No client reads them from a tool result — the example page takes its
thumbnails from the master data directly (`minimal-hi-example/index.html:781`), the
ligna-store chat (`ligna-store/hi-mcp/`) does not touch them. Only the tool descriptions
announce them (`hi-mcp-server.ts:104`, `:108`, `:111`, `:133`).

## Root cause

The MCP tools return the agent-ready plan context with every `imageUrl` and pretty-printed
(`hi-mcp-server.ts:74-78`): a single `get-plan-context` costs 138k Mistral tokens, three
quarters of them signed URLs no agent can use. With the results of the steps that follow, one
turn exceeds a 262k context.

## Fix

*Implemented in `1ec4e16` as proposed; docs in `8783685`.*

In the MCP server, `textResult` serializes compact JSON and omits every `imageUrl` field (a
`JSON.stringify` replacer) — one place for every tool with a JSON result. The tool descriptions
stop announcing `imageUrl`.

Expected sizes: `get-plan-context` 138k → about 30k tokens, the groups section of an 11-unit
kitchen 29k → 16k; run 06's tool calls fit in about 110k tokens.

- `hi-mcp/hi-mcp-server/hi-mcp-server.ts`: `textResult`; descriptions of `get-plan-context`
  and `find-attributes`.
- Unit test in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`: a result with nested
  `imageUrl` fields comes back without them, as compact JSON.
- Docs: `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md` — the tool
  results carry no image URLs.

### Alternatives rejected

- **Strip the URLs in the chat backend only** — the chat is one MCP client; every other client
  pays the same 90k tokens per `get-plan-context` (Claude Code limits an MCP result to 25k
  tokens by default).
- **Strip them in roomle-ui's compaction** — the plan context API also serves the page and
  other callers; the agent-facing shape is the server's concern (it already adapts the
  articles in `tool-executors.ts`, `agentFacingArticle`).
- **Make the URLs opt-in** (e.g. an `include` flag) — no flow uses them; nothing to opt into.
- **Prune older tool results in the chat** (`pruneMessages`, `prepareStep`) — treats the
  symptom; the model would lose the catalog it plans with.

## Validation

- Unit test `returns tool results as compact JSON without image URLs`
  (`hi-mcp-server/tests/hi-mcp-server.test.ts`) passes; the workspace typecheck passes.
- Measured against the fixed server (same page, same tokenizer):

  | Text | Before | After |
  |---|---|---|
  | `get-plan-context` (default sections) | 138,084 | 29,656 |
  | `find-attributes "walnut"` | 32,480 | 2,897 |

- "test the mcp" with Mistral, `.temp/result/mcp-test-2026-10-01_09-10-40/report.md`: no run
  ended with the context error (5 before); run 06 made the same twelve tool calls in one turn and
  answered in 55 s (262,149 tokens and no answer before). Pass 7, partial 2, fail 4 (2 / 0 / 11
  before).
- The suite found a gap this fix does not touch: the worktop colour `mod_CountertopColor` is not
  in the attribute vocabulary (see that report).
