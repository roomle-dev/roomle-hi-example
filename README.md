# roomle-hi-example

Standalone HI presets example (one `minimal-hi-example/index.html`) with the
HI MCP server (`hi-mcp/hi-mcp-poc-json`): an AI agent plans HOMAG Intelligence
object groups in a live Roomle room-planner session.

## Usage

```bash
npm install
npm start
```

All possibilities for `npm start`:

e.g.

```bash
npm start openai <api-key>
```

| Invocation | What you get |
| ---------- | ------------ |
| `npm start` | Example page on :3000, MCP server on :3100, browser opens |
| `npm start --no-open` | Same, without opening the browser |
| `npm start gpt-5-mini <api-key>` | Plus chat with the `gpt-5-mini` deployment on the HI Azure AI Foundry resource (`dfhifoundrysweden`) |
| `npm start gpt-5.4-mini <api-key>` | Plus chat with the `gpt-5.4-mini` deployment on the HI Azure AI Foundry resource (`dfhifoundrysweden`) |
| `npm start mistral <api-key>` | Plus built-in AI chat with `mistral-large-latest` |
| `npm start mistral-medium <api-key>` | Plus chat with `mistral-medium-latest` (also `mistral-large`, or any `mistral-*` model id) |
| `npm start claude <api-key>` | Plus chat with `claude-sonnet-4-5` (also `anthropic`, `claude-sonnet`, `claude-opus`, or any `claude-*` model id) |
| `npm start gemini <api-key>` | Plus chat with `gemini-2.5-pro` via the Gemini API, key from Google AI Studio (also `google`, `gemini-pro`, `gemini-flash` for `gemini-2.5-flash`, or any `gemini-*` model id) |
| `npm start azure <api-key>` | Plus chat with Azure OpenAI (also `openai`; needs `AZURE_RESOURCE_NAME` and `HI_CHAT_MODEL=<deployment-name>`) |
| `npm run dev <same arguments>` | Same as the matching `npm start` variant, but the planner loads from the local Rubens UI dev server (:5173) |

Details: [AI chat](./minimal-hi-example/docs/ai-chat.md) ·
[example and MCP server reference](./minimal-hi-example/docs/hi-mcp-server.md) ·
[hi-mcp PoCs](./hi-mcp/README.md)

## Ask the agent

**Built-in AI chat** — no external client needed; type into the chat window and
the model drives the HI tools (`get-plan-context`, `create-or-replace-groups`, …):

```text
Get the plan context of the HI session and summarize it.
Add a group of three tall units to the wall on the right.
```

**External MCP clients** — Claude Code, Claude desktop app, GitHub Copilot,
Cursor, … connect to `http://localhost:3100/mcp`:
[connecting an MCP client](./minimal-hi-example/docs/hi-mcp-server.md#connecting-an-mcp-client) ·
[example prompts](./minimal-hi-example/docs/hi-mcp-server.md#example-prompts)
