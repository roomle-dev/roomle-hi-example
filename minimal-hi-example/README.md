# Quickstart — HI Presets Example

Shortest path to a working session: the standalone HI presets example in one
[`index.html`](./index.html) with the AI chat of the roomle-ui embedding-lib, started by the
[`start.mjs`](./start.mjs) launcher. Every detail and alternative:
[.agents/context/hi-mcp-server.md](../.agents/context/hi-mcp-server.md) and [docs/ai-chat.md](../docs/ai-chat.md).

**1. Once:** install Node 20+. The example needs no build and no install.

**2. Start the example with a model** (the launcher serves the example page on :3000 — the next
free port when it is taken — and the model of its chat to this machine):

```bash
npm start azure:gpt-6-astra <api-key>      # or directly: node start.mjs azure:gpt-6-astra <api-key>
```

The model is `<provider>:<model-id>` with the exact model id — no aliases. `azure:gpt-6-astra` is a
deployment on the HI Azure AI Foundry resource; the key is that resource's. The options of a model
(`--base-url`, `--reasoning-effort`, `--chat-completions`, `--cache-breakpoint`) are in
[ai-chat.md](../docs/ai-chat.md#running-it).

For OpenAI's API, replace `<model-id>` with the model to use:

```bash
npm start "openai:<model-id>" "$OPENAI_ASSISTANT_API_KEY"
npm run dev "openai:<model-id>" "$OPENAI_ASSISTANT_API_KEY"
```

The exact model ID is passed to OpenAI. `dev` selects the local planner on :5173.

Without a model, `npm start` and `npm run dev` start only the example, without the AI planning
assistant — the launcher opens the page with `chat=false`, even when the backend of the page's
user enables the model proxy of the HI server.

To develop against a local Rubens UI dev server (start it first on
<http://localhost:5173/>), run `npm run dev` instead — it opens the example
with `server_url=http://localhost:5173/` so the planner loads from the local
UI instead of `https://www.roomle.com/t/bo-test/`.

**3. The example opens** at
<http://localhost:3000/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&chat=true>
with a model, and with `chat=false` without one (pass `--no-open` to skip that).

**4. Ask the agent** — open the chat with the button at the bottom of the planner. The repository
root [README](../README.md) lists every `npm start` variant (Mistral, Anthropic, Google and the
Azure AI Foundry deployments) and the agent prompts.

Port 3000 taken (e.g. by the ligna-store dev server)? The launcher uses the next free port by
itself and prints it; `EXAMPLE_PORT=3101 npm start` pins the requested port. More: [example prompts](../.agents/context/hi-mcp-server.md#example-prompts) ·
[configuring the example](../.agents/context/hi-mcp-server.md#the-example) ·
[tool reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-reference.md#tool-reference) ·
[troubleshooting](../docs/ai-chat.md#troubleshooting)
