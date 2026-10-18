# Backlog

What is still to be done in and around roomle-hi-example: defects, hardening and follow-ups, one row
per item. The backlog holds open work only. An item leaves it when its fix is in the code.

## Planning by the MCP server

Details, causes, tests and how to reproduce: [mcp-issues.md](mcp-issues.md), or
the document a row links.

| Item | To do | Priority |
|---|---|---|
| 74 — An island's back row of other widths lands off the front row | Say in the description of `behind` where a turned unit lines up and which way the relations run in a turned row; else an `align` the server derives the offset from | low |
| 75 — The backsplash of an image kitchen is reported as not buildable | Say in the `notCarried` sentence of `create-or-replace-groups`, library-neutrally, that a generated part may wait for an attribute of the units that switches it on, and drop its kitchen example | medium |
| 77 — An edit that gives a row a new end leaves a door hinged to the outside | Name the door rule of D84 in the descriptions of the tools that can give a row a new end (swap, delete, exchange, merge) | medium |
| 78 — A swap of a widened unit is refused for want of a docking vector | roomle-ui: keep the docking vectors of the root module the attribute change recalculates, so the following swap applies without a correction | medium |
| [A relation for a unit under a tabletop](under-relation-for-tabletops.md) | Live-check the inner vectors of a DeMaat tabletop, then compile `under` with the vector index | low |
| [Where Mistral Large falls short of the prompts](mistral-large-prompt-issues.md) | Improvement candidates from the `mistral-large-latest` test run: declare the payload fields in the input schema, merge groups that name each other's roots, act on obstacle hints, describe the walls, open the edit tools with the user's words | medium |
| [Analyse how Spec Kit can help with the prompting](speckit-for-the-prompting.md) | Compare the prompt sections of Spec Kit (user input, pre-execution checks, guidelines, success criteria, done when) with the served text and the chat prompt; propose what improves the plannings | medium |

## Libraries

What the library data lacks for the agent to plan right; the fix is in the library. Details:
[library-issues.md](library-issues.md).

| Item | To do | Priority |
|---|---|---|
| [60 — The sink top of a sink unit reaches past the row or over the hob](library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) | HOMAG library (reported): the sink unit's description names the width of the sink with its drainer, and states that no hob may stand immediately to its right | medium |
| [61 — Handleless fronts done with a handle attribute](library-issues.md#61-handleless-fronts-done-with-a-handle-attribute) | HOMAG library: distinguish choosing a handleless article from setting the handle design to "No handle" on a handled article | medium |
| [64 — Flip-lift wall cabinets with sizes the library cannot calculate](library-issues.md#64-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) | HOMAG library: the flip-lift wall cabinets' descs name the heights and depths their flap fitting supports | low |
| [69 — End panels with a plain upright colour the library cannot calculate](library-issues.md#69-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate) | HOMAG library: switch the upright program with a plain upright colour as the front program is switched, or say in the desc that a plain colour needs `mod_UprightProgram` Classic | low |
| [70 — Carcase side panels with a plain outside colour the library cannot calculate](library-issues.md#70-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate) | HOMAG library: switch the program of the visible sides with their colour, or say in the descs that the visible sides take the outside colour and a plain one needs the program Classic | low |
| [71 — Folding-flap wall cabinets with glass fronts the library cannot calculate](library-issues.md#71-folding-flap-wall-cabinets-with-glass-fronts-the-library-cannot-calculate) | HOMAG library: the flap wall cabinets' descs name the front programs their flap takes | low |
| [76 — Articles with two doors that do not say how their doors stand](library-issues.md#76-articles-with-two-doors-that-do-not-say-how-their-doors-stand) | HOMAG library: the articles with two doors say one above the other or side by side; `LeftLeft`, `RightRight` and the desc of `14` | low |

## Library neutrality of the MCP server

The server serves every HI library; its served text, results and logic must carry no information
about a specific library. Details: [mcp-policy-issues.md](mcp-policy-issues.md).

| Item | To do | Priority |
|---|---|---|
| Served text encodes a kitchen taxonomy | `hi-mcp-server.ts`: `AUTHORING_RULES`, `INSTRUCTIONS` and the tool descriptions reason in base/wall/tall units, worktop, hood and island as if every library were a kitchen, and carry one library's concrete content and fixed measures. Rewrite so the rules speak of articles, root modules, relations and docking vectors | high |
| Spelling correction and result messages map library vocabulary | `tool-executors.ts`: `SPELLINGS` hard-codes search normalization for `colour`/`grey`/`worktop`; drop it or derive it from the master data. The result messages of the roomle-ui HI tool commands name furniture kinds; rewrite them neutrally | medium |

## Planner (roomle-ui, RoomleCore)

Defects of the planner outside the HI tool commands. Details: [roomle-ui-issues.md](roomle-ui-issues.md).

| Item | To do | Details |
|---|---|---|
| 63 — A dark worktop renders white under the top light | roomle-ui renderer: the top light overexposes the tabletop depending on the line of sight, so black appears white; render it in its material colour from every line of sight | [roomle-ui-issues.md, 63](roomle-ui-issues.md#63-a-dark-worktop-renders-white-under-the-top-light) |

## Chat

| Item | To do | Details |
|---|---|---|
| Reasoning effort for the GPT chat models | The ligna-store chat sends no reasoning effort, so gpt-5.4-mini plans without reasoning there: send `high` for the lightweight GPT deployments as the example chat does; further measurement only on request | [reasoning-effort-for-the-gpt-chat-models.md](reasoning-effort-for-the-gpt-chat-models.md) |
| Strict tool schemas for the GPT models | Measure how often a GPT model's tool call fails the schema ("Input validation error") in a "test the mcp" session; only if it costs runs, try strict function calling — the chat backend sets `strict` per tool (the Azure provider sends `strict: false` otherwise). The Azure strict subset needs every field required, `additionalProperties: false` on every object, at most five nesting levels and 100 properties, and no parallel tool calls: the MCP tool schemas with optional fields do not meet it, and a change there reaches every client | [Structured outputs on Azure](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) |
| Paste and pick an image in the chat window | An image reaches the chat only by drop, which the keyboard cannot reach. Add paste from the clipboard and a file picker button to the AI Planning Assistant window, both through `prepareImage` (roomle-ui `PlanningAssistantChat.vue`, `src/common/utils/planning-assistant-image.ts`) | [Images in the chat](../../docs/ai-chat.md#images-in-the-chat) |
| The example chat forgets its tool calls between turns | The page keeps only the text of a turn (`conversation`, `minimal-hi-example/index.html`), so a later turn does not see the tool calls and results before it — the ids of the groups it created. The ligna-store chat keeps them (`responseMessages`, ligna-store `hi-mcp/chat.ts`). Keep them in the example too, in the page or in the backend | [The chat window](../../docs/ai-chat.md#the-chat-window) |
| Per-tool status in the chat window | The backend streams plain text with `[tool] <name>` lines, and the window shows the tool name as an `activity` part. The AI SDK's UI message stream would carry each tool call's input and result to the page, which then needs a parser (the page has no build step), and the window a part that shows them | [The chat window](../../docs/ai-chat.md#the-chat-window) |

## Test infrastructure

Details: [mcp-test-infrastructure-issues.md](mcp-test-infrastructure-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — The object-only perspective render draws an empty frame under software GL](mcp-test-infrastructure-issues.md#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | roomle-ui: find why the frame is dropped under SwiftShader | low |

## Deployment, launcher and page sessions

Details: [deployment-and-session-issues.md](deployment-and-session-issues.md).

| Item | To do | Priority |
|---|---|---|
| [3 — The public MCP endpoint has no access control](deployment-and-session-issues.md#3-the-public-mcp-endpoint-has-no-access-control) | Decide session links, roomle.com OAuth or a shared secret before the URL goes beyond a trial | medium |
| [4 — The personal deployment still runs and the DEV environment admits every branch](deployment-and-session-issues.md#4-the-personal-deployment-still-runs-and-the-dev-environment-admits-every-branch) | Give `cloudflare-dev` its branch policy, delete the unused `CLOUDFLARE_ACCOUNT_ID` secrets, tear down `hi-mcp-poc` in the personal account | medium |

## Architecture

| Item | To do | Details |
|---|---|---|
| The HI tools in the embedding-lib instead of the Cloudflare MCP server | The page provides the tools: the MCP server's tools, served text, skills and undo record in the embedding-lib (`src/homag-intelligence`); the AI SDK loops and their provider mappings stay in the hosts, which drop only the server, the bridge and the MCP client; the example's chat moves into its page; teardown of the Workers last | [hi-tools-in-the-embedding-lib.md](hi-tools-in-the-embedding-lib.md) |
| A backend-controlled agent loop with browser-executed scene tools | The scene tools stay in the browser; the agent loop, the tool authorization and the provider credentials move to the backend | [backend-agent-loop-with-browser-scene-tools.md](backend-agent-loop-with-browser-scene-tools.md) |
