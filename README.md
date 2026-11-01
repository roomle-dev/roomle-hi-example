# roomle-hi-example

Standalone HI presets example (one `minimal-hi-example/index.html`) with the AI chat of the roomle-ui
embedding-lib: its planning assistant runs the HI tools in the page, and an AI agent plans HOMAG
Intelligence object groups in a live Roomle room-planner session.

New to the HI MCP? The [user guide](./docs/user-guide/README.md) explains what it does, the four
ways to use it, and how to talk to the assistant. How it is built — the processes, modules,
protocols and conventions — is in the [implementation documentation](./.agents/context/README.md).

## Usage

```bash
npm install
npm start
```

All possibilities for `npm start`:

e.g.

```bash
npm start azure:gpt-6-astra "$AZURE_GPT_KEY"
npm start mistral:mistral-large-4 "$MI_API_USAGE_KEY"
```

| Invocation | What you get |
| ---------- | ------------ |
| `npm start` | Example page on :3000 (the next free port when it is taken), browser opens, without the AI planning assistant (`chat=false`) |
| `npm start -- --no-open` | Same, without opening the browser |
| `npm start <provider>:<model-id> <api-key>` | Plus chat with that model: `<provider>` is `azure`, `openai`, `mistral`, `anthropic`, `google` or `openai-compatible`, `<model-id>` the exact model id at it — no aliases |
| `npm start azure:<deployment> <api-key>` | Plus chat with that deployment on the HI Azure AI Foundry resource (`dfhifoundrysweden`), e.g. `azure:gpt-6-astra`, `azure:gpt-5.4-mini` |
| `npm start azure:gpt-6.1-sol <api-key> -- --base-url https://controller-mes-resource.services.ai.azure.com/openai/v1` | Plus chat with a deployment on another Foundry resource, with that resource's key |
| `npm start openai:<model-id> <api-key>` | Plus chat using OpenAI's API with the exact model ID and an OpenAI API key |
| `npm start mistral:mistral-large-4 <api-key>` | Plus chat with a model of the Mistral API |
| `npm start anthropic:claude-sonnet-4-5 <api-key>` | Plus chat with a model of the Anthropic API |
| `npm start google:gemini-2.5-pro <api-key>` | Plus chat with a model of the Gemini API, key from Google AI Studio |
| `npm run dev <same arguments>` | Same as the matching `npm start` variant, but the planner loads from the local Rubens UI dev server (:5173) |
| `EXAMPLE_SERVER_URL=<url> npm start <same arguments>` | Same as the matching `npm start` variant, but the planner loads from `<url>` (passed to the page as `server_url`) |

The options of a model — `--base-url <url>`, `--reasoning-effort <effort>`,
`--chat-completions`, `--cache-breakpoint` — are in the [AI chat](./docs/ai-chat.md#running-it)
reference. The root `start` and `dev` scripts run the launcher directly. Put launcher flags after
`--`, for example `npm run dev -- --no-open` or
`npm start azure:gpt-5-mini "$AZURE_GPT_KEY" -- --reasoning-effort high --no-open`.

Start the example and the chat against any Rubens UI, e.g. the local
dev server:

```bash
EXAMPLE_SERVER_URL=http://localhost:5173/ npm start azure:gpt-5.4-mini "$AZURE_GPT_KEY" -- --reasoning-effort high
```

A roomle-ui PR preview (`https://test.roomle.com/t/cp/<pr>/`) reads from the test
database, where the example's plan does not exist. Add `customApiUrl` to point it at
the production API:

```bash
EXAMPLE_SERVER_URL='https://test.roomle.com/t/cp/3087/?customApiUrl=https://www.roomle.com/api/v2' npm start azure:gpt-5.4-mini "$AZURE_GPT_KEY" -- --reasoning-effort high
```

Details: [AI chat](./docs/ai-chat.md) ·
[example and tool reference](.agents/context/hi-mcp-server.md)

## Sign-in example (TypeScript)

[`hi-sc-example/`](./hi-sc-example/README.md) is the planner with its chat in TypeScript, behind a
sign-in page: the user and password of the HI server, the backend ID, the library, and the provider,
model and API key of the chat are entered on the page instead of the command line.

## Minifabric example (TypeScript)

[`minifabric-example/`](./minifabric-example/README.md) is the planner with the library
`nobilia_Minifabrik` through Roomle's demo proxy: a settings panel for your own testing
credentials, prices, orders, the AI kitchen generation and the AI chat. The demo proxy itself is in
[`minifabric-example/proxy-server/`](./minifabric-example/proxy-server/README.md).

## Start page

`npm run start:sc` opens the start page on :3300 with the links to the two TypeScript examples and
the ligna-store: the sign-in example at <http://localhost:3300/hi-sc/>, the minifabric example at
<http://localhost:3300/nobilia-minifabrik/>.

```bash
npm install
npm run start:sc
```

A push to the branch `release/pages` publishes the same to GitHub Pages:
<https://roomle-dev.github.io/roomle-hi-example/> (`.github/workflows/deploy.yml`,
[start page](.agents/context/start-page.md)).

## Ask the agent

Open the chat with the button at the bottom of the planner, type into it, and the model drives the
HI tools (`get-plan-context`, `create-or-replace-groups`, …):

```text
Get the plan context of the HI session and summarize it.
Add a group of three tall units to the wall on the right.
```

More: [example prompts](.agents/context/hi-mcp-server.md#example-prompts)

## Links

- KI-Integration in (Wohnungs-) Planung — `KI-Integration in (Wohnungs-) Planung.pptx`
- [Roomle milestone 2](https://tecconfig-preview.homag.cloud/#/e2fe8b3d-da31-4a20-92ab-ab6e3839300e)
- [Rotpunkt Küchen und Prompt](https://duerr.sharepoint.com/teams/HOMAGINTELLIGENCE/_layouts/15/Doc.aspx?sourcedoc={9a8c72a6-f29f-405f-b56e-1ec8eb297435}&action=edit&wd=target%28Target%20groups%2FHI%20-%20Cabinet%2FResearch.one%7Cf6b95f21-5261-4f5d-b4bf-c6deda56e8ba%2FRotpunkt%20K%C3%BCchen%20und%20Prompt%7C14e9a0cb-a5c0-4f9c-8194-6486c966b86c%2F%29&wdorigin=NavigationUrl)
