# Quickstart — HI Sign-in Example (TypeScript)

The HI planner with its AI chat, in TypeScript, behind a sign-in page: you enter the user and
password of the HI server, the backend ID and library, and optionally the provider, model and API
key of the chat. **Start planning** checks the sign-in and opens the planner with the HI library and the AI
Planning Assistant, as the [minimal example](../minimal-hi-example/README.md) does. How it is built:
[.agents/context/hi-sc-example.md](../.agents/context/hi-sc-example.md).

**Published on GitHub Pages:** <https://roomle-dev.github.io/roomle-hi-example/>

**1. Once:** install Node 22.12+ and run `npm install` in the repository root.

**2. Start it** — the Vite dev server serves the page on :3300 (the next free port if it is taken)
and opens the browser:

```bash
npm run start:sc        # in the repository root; or `npm run dev` in hi-sc-example/
```

**3. Sign in** with the user and password of the HI server, the backend ID and the library. For the
chat, select the provider — Anthropic, Azure, Google, Mistral or OpenAI — and enter the exact model ID
at that provider and its API key. An Azure model is a deployment on the HI Azure AI Foundry
resource, named by its deployment name. Without them the planner opens without the chat.

Example login:

| Field | Value |
| ----- | ----- |
| User | `test` |
| Password | `6mABjMDnEq4tvaN` |
| Backend ID | `HI_PRE_Roomle_Milestone_2` |
| Library | `Furniture_Smith` |
| Provider | Azure |
| Model | `gpt-6-astra` |

On the first sign-in a dialog asks to store the sign-in data in a cookie; with **Allow**, the
fields are filled in from it on the next visit. Every field can also be prefilled by a query
parameter of its name, which overwrites the cookie — `user`, `password`, `backendId`, `libraryId`,
`provider`, `model`, `apiKey`:

```text
http://localhost:3300/?backendId=<backend-id>&libraryId=<library>&provider=azure&model=<deployment>
```

**4. Ask the agent** — the button at the bottom of the planner opens the chat.

| Script (in `hi-sc-example/`) | Runs |
| ---------------------------- | ---- |
| `npm run dev` | the Vite dev server on :3300 |
| `npm run build` | the type check and the production build into `dist/` |
| `npm run preview` | serves the production build on :3300 |
| `npm run typecheck` | `tsc` |
| `npm test` | the unit tests (Node's test runner) |
| `npm run build:pages` | the production build for GitHub Pages (base `/roomle-hi-example/`); a push to the branch `release/pages` builds and publishes it |
