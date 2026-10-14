# Backlog

What is still to be done in and around roomle-hi-example: defects, hardening and follow-ups, one row
per item. The backlog holds open work only. An item leaves it when its fix is in the code.

## Planning by the MCP server

Details, causes, tests and how to reproduce: [mcp-issues.md](mcp-issues.md), or
the document a row links.

| Item | To do | Priority |
|---|---|---|
| 65 — A wall of floor-to-ceiling glass the user names is left out | Clarify the obstacle rule: the wall the user names is where the group goes, the free stretches are for a place the user leaves open; the answer names the openings | medium |
| 66 — A corner group stands in front of the adjoining wall's window | The hint names the `offsetMm` along the group's wall that clears the adjoining wall's opening | low |
| [A relation for a unit under a tabletop](under-relation-for-tabletops.md) | Live-check the inner vectors of a DeMaat tabletop, then compile `under` with the vector index | low |
| [Analyse how Spec Kit can help with the prompting](speckit-for-the-prompting.md) | Compare the prompt sections of Spec Kit (user input, pre-execution checks, guidelines, success criteria, done when) with the served text and the chat prompt; propose what improves the plannings | medium |

## Libraries

What the library data lacks for the agent to plan right; the fix is in the library. Details:
[library-issues.md](library-issues.md).

| Item | To do | Priority |
|---|---|---|
| [60 — The sink top of a sink unit reaches past the row or over the hob](library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) | HOMAG library (reported): the sink unit's description names the drainer width and side, and states that no hob may stand immediately to its right | medium |
| [61 — Handleless fronts done with a handle attribute](library-issues.md#61-handleless-fronts-done-with-a-handle-attribute) | HOMAG library: distinguish choosing a handleless article from setting the handle design to "No handle" on a handled article | medium |
| [64 — Flip-lift wall cabinets with sizes the library cannot calculate](library-issues.md#64-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) | HOMAG library: the flip-lift wall cabinets' descs name the heights and depths their flap fitting supports | low |

## Library neutrality of the MCP server

The server serves every HI library; its served text, results and logic must carry no information
about a specific library. Details: [mcp-policy-issues.md](mcp-policy-issues.md).

| Item | To do | Priority |
|---|---|---|
| Served text encodes a kitchen taxonomy | `hi-mcp-server.ts`: `AUTHORING_RULES`, `INSTRUCTIONS` and the tool descriptions reason in base/wall/tall units, worktop, hood and island as if every library were a kitchen, and carry one library's concrete content and fixed measures. Rewrite so the rules speak of articles, root modules, relations and docking vectors | high |
| Spelling correction maps library vocabulary | `tool-executors.ts`: `SPELLINGS` hard-codes search normalization for `colour`/`grey`/`worktop`; drop it or derive it from the master data | medium |

## Planner (roomle-ui, RoomleCore)

| Item | To do | Details |
|---|---|---|
| 62 — `merge-article-into-group` moves a group placed in the conversation | roomle-ui `mergeArticleIntoGroup`: a merge keeps the earlier root modules of a group placed by wall or by point in place instead of moving the group by its former width | [mcp-issues.md, 62](mcp-issues.md#62-merge-article-into-group-moves-a-group-placed-in-the-conversation) |
| 63 — The worktop of a handleless kitchen renders white | Analyse why a countertop with a colour (324) renders white in the handleless line but not in a handled kitchen — planner render or library | [mcp-issues.md, 63](mcp-issues.md#63-the-worktop-of-a-handleless-kitchen-renders-white) |

## Chat

| Item | To do | Details |
|---|---|---|
| Reasoning effort for the GPT chat models | gpt-5.4-mini plans without reasoning: set an effort per Foundry deployment from the measured data and verify it; further measurement only on request | [reasoning-effort-for-the-gpt-chat-models.md](reasoning-effort-for-the-gpt-chat-models.md) |
| Strict tool schemas for the GPT models | Measure how often a GPT model's tool call fails the schema ("Input validation error") in a "test the mcp" session; only if it costs runs, try strict function calling — the chat backend sets `strict` per tool (the Azure provider sends `strict: false` otherwise). The Azure strict subset needs every field required, `additionalProperties: false` on every object, at most five nesting levels and 100 properties, and no parallel tool calls: the MCP tool schemas with optional fields do not meet it, and a change there reaches every client | [Structured outputs on Azure](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) |
| Paste and pick an image in the chat window | An image reaches the chat only by drop, which the keyboard cannot reach. Add paste from the clipboard and a file picker button, both through `prepareImage` (`minimal-hi-example/index.html`) | [Images in the chat](../../docs/ai-chat.md#images-in-the-chat) |
| The example chat forgets its tool calls between turns | The page keeps only the text of a turn (`conversation`, `minimal-hi-example/index.html`), so a later turn does not see the tool calls and results before it — the ids of the groups it created. The ligna-store chat keeps them (`responseMessages`, ligna-store `hi-mcp/chat.ts`). Keep them in the example too, in the page or in the backend | [The chat window](../../docs/ai-chat.md#the-chat-window) |
| Per-tool status in the chat window | The backend streams plain text with `[tool] <name>` lines; the AI SDK's UI message stream would carry each tool call's input and result to the page, which then needs a parser (the page has no build step) | [The chat window](../../docs/ai-chat.md#the-chat-window) |

## Test infrastructure

Details: [mcp-test-infrastructure-issues.md](mcp-test-infrastructure-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — The object-only perspective render draws an empty frame under software GL](mcp-test-infrastructure-issues.md#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | roomle-ui: find why the frame is dropped under SwiftShader | low |
| [2 — The per-run fixed overhead of the test runner](mcp-test-infrastructure-issues.md#2-the-per-run-fixed-overhead-of-the-test-runner) | Cut the fixed cost per run (launcher typecheck, Chromium launch, launcher reuse) without endangering the sequential runs | medium |

## Deployment, launcher and page sessions

Details: [deployment-and-session-issues.md](deployment-and-session-issues.md).

| Item | To do | Priority |
|---|---|---|
| [3 — The public MCP endpoint has no access control](deployment-and-session-issues.md#3-the-public-mcp-endpoint-has-no-access-control) | Decide session links, roomle.com OAuth or a shared secret before the URL goes beyond a trial | medium |

## Architecture

| Item | To do | Details |
|---|---|---|
| One page bridge for every host | The page bridge exists three times (reference client, example page, ligna-store), synced by hand. Publish it as a package, then move it into embedding-lib or the Rubens UI as one planner option | [one-page-bridge-for-every-host.md](one-page-bridge-for-every-host.md) |
| A backend-controlled agent loop with browser-executed scene tools | The scene tools stay in the browser; the agent loop, the tool authorization and the provider credentials move to the backend | [backend-agent-loop-with-browser-scene-tools.md](backend-agent-loop-with-browser-scene-tools.md) |

## ligna-store

| Item | To do | Details |
|---|---|---|
| The chat prompt names only kitchens | `hi-mcp/chat.ts` opens with "a planning assistant for a HOMAG Intelligence (HI) kitchen". Take the two sentences of the example chat: every kind of HI furniture, and the closest article of the catalog instead of asking (D44) | D44 in [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#words-2026-10-06); the example's prompt: `CHAT_SYSTEM_PROMPT`, `hi-mcp/hi-mcp-chat/chat-config.ts` |
| The chat lacks the Mistral image adapter | Wrap `createMistral` with `toolResultFilesAsUserMessages` (`hi-mcp-chat/tool-result-images.ts`), so the images of `get-plan-images` do not reach Mistral as base64 text | [ligna-store-chat-client.md, 1](ligna-store-chat-client.md#1-the-images-of-get-plan-images-reach-mistral-as-base64-text) |
