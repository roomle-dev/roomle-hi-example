# Quickstart — HI Sign-in Example (TypeScript)

The HI planner with its AI chat, in TypeScript, behind a sign-in page: you enter the user and
password of the HI server, the backend ID and library, and optionally the model and API key of the
chat. **Start planning** checks the sign-in and opens the planner with the HI library and the AI
Planning Assistant, as the [minimal example](../minimal-hi-example/README.md) does. How it is built:
[.agents/context/hi-sc-example.md](../.agents/context/hi-sc-example.md).

**1. Once:** install Node 22.12+ and run `npm install` in the repository root.

**2. Start it** — the Vite dev server serves the page on :3300 (the next free port if it is taken)
and opens the browser:

```bash
npm run start:sc        # in the repository root; or `npm run dev` in hi-sc-example/
```

**3. Sign in** with the user and password of the HI server. The backend ID and the library are
prefilled with `HI_PRE_Roomle_Milestone_2` and `Furniture_Smith`. For the chat, enter a model and its
API key; the model names are those of `npm start <model>` — `gpt-6-astra`, `gpt-5.4-mini`,
`mistral-medium`, `claude`, `gemini`, `openai:<model-id>` and more
([AI chat](../docs/ai-chat.md#running-it)). Without a model the planner opens without the chat.

**4. Ask the agent** — the button at the bottom of the planner opens the chat.

| Script (in `hi-sc-example/`) | Runs |
| ---------------------------- | ---- |
| `npm run dev` | the Vite dev server on :3300 |
| `npm run build` | the type check and the production build into `dist/` |
| `npm run preview` | serves the production build on :3300 |
| `npm run typecheck` | `tsc` |
| `npm test` | the unit tests (Node's test runner) |
