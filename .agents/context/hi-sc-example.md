# HI Sign-in Example (TypeScript)

The documentation of `hi-sc-example/` — the HI planner with its AI chat in TypeScript, behind a
sign-in page. The user quickstart is the [README](../../hi-sc-example/README.md) of the folder.
[Back to the overview](./README.md).

## The flow

1. **Sign-in view** (`index.html`): a form over the background image
   `src/assets/say-hi-to-homag-intelligence.jpg` with the user and password of the HI server, the
   backend ID and library (prefilled `HI_PRE_Roomle_Milestone_2`, `Furniture_Smith`), and the
   optional model and API key of the chat. The model field suggests the common model names
   (`<datalist>`).
2. **Start planning** (`main.ts`, `readSettings`):
   - a model or an API key → `planningAssistantConfig` (`model-config.ts`); the one without the
     other, or an unknown model, is an error on the form;
   - the user and password → the Basic authorization; `fetchBackend` (`hi-server.ts`) reads
     `GET <HI server>/backends/list` with it. 401 is "Wrong user or password", a backend ID that is
     not in the list is an error, and the backend's `planId`, `additionalCatalogs` and
     `configureInRoom` go to the planner;
   - the page swaps the sign-in view for the planner view, without a reload. The password and the
     API key stay in memory; nothing goes into the URL or the browser storage, so a reload returns
     to the sign-in;
   - an error while the planner starts returns to the sign-in view with the message.
3. **Planner** (`planner.ts`, `startPlanner`): `setupHi` with the HI proxy of the backend
   (`proxy_request?backendId=…`) and the Basic authorization — `setupHi` loads the article catalog,
   master data and calc script itself, the page adds `onFetchPrice` for the prices —, then
   `createPlanner` and, with a model, `startPlanningAssistant` of the embedding-lib.

| File | Responsibility |
| ---- | -------------- |
| `hi-sc-example/index.html` | the two views: the sign-in form, the planner container |
| `hi-sc-example/src/main.ts` | the form: reads the settings, signs in, swaps the views |
| `hi-sc-example/src/hi-server.ts` | the HI server URL, `fetchBackend` |
| `hi-sc-example/src/model-config.ts` | `planningAssistantConfig`: a model name and its key → the `PlanningAssistantConfig` of the embedding-lib |
| `hi-sc-example/src/planner.ts` | `startPlanner`: HI setup, planner, planning assistant |
| `hi-sc-example/src/style.css` | the sign-in page; the planner fills the window |
| `hi-sc-example/tests/model-config.test.ts` | the unit tests of `planningAssistantConfig` |

## The planner options

The planner gets the options of the minimal example's planner that shape its behaviour: the plan,
the server URL `https://www.roomle.com/t/bo-test/`, the catalog root tags, the
`externalObjectSettings` and the HI options.

- **`featureFlags.globalCallbacks: false` is required** for the planner's own catalog with an HI
  library. Without it the catalog requests the external root tag `__ext__obj__#external:root-tag`
  from the Roomle API, gets 403 and stays on "Loading catalog…" — see "Internal Catalog UI" in
  roomle-ui `packages/embedding-lib/docs/homag-intelligence-embedding.md`.
- **Left out** against `minimal-hi-example/index.html`: the preset dropdown, the debug panel, the
  order buttons and the price display, the query parameters (`server_url`, `id`, `language`, …),
  the `dragIn` plugin, `saveToIdb`, and the page globals of the test scripts (`window.instance`,
  `window.hiPlannerCalls`, …). The end-to-end test scripts run against the minimal example only.

## The model names

`model-config.ts` takes the model names of `npm start <model>` and builds the same configs as
`planningAssistantConfig` of `minimal-hi-example/start.mjs`, without environment variables:

- `openai:<model-id>` — OpenAI, the model ID passed through unchanged;
- every `gpt-*` and `mistral-large-3` — a deployment on the HI Azure AI Foundry resource,
  `gpt-6.1-sol` on its own resource, with the deployment settings of `FOUNDRY_DEPLOYMENTS`;
- the aliases `mistral`, `mistral-medium`, `mistral-large-4`, `claude`, `claude-opus`, `gemini`,
  `gemini-flash`, and every `mistral-*`, `claude-*`, `gemini-*` model ID passed through.

The `azure` alias, `HI_CHAT_MODEL`, `AZURE_RESOURCE_NAME` and `HI_CHAT_REASONING_EFFORT` have no
counterpart. A change of the Foundry deployments in `start.mjs` needs the same change in
`model-config.ts`.

## Dependencies, build and tests

- **`@roomle/embedding-lib`** comes from npm, pinned to the dev version the minimal example imports
  from the CDN (`0.0.0-dev-1b4351d`) — see [unreleased-embedding-lib.md](../../docs/setup/unreleased-embedding-lib.md).
  Its declarations type `PlanningAssistantConfig` and `startPlanningAssistant`; the planner's init
  data and the HI callbacks refer to roomle-ui sources the package does not ship and are untyped
  (`skipLibCheck`).
- **Vite** serves the page on :3300 (`npm run dev`, the root `start:sc`) and builds it into `dist/`;
  **TypeScript** only checks types (`tsc`, `noEmit`). Vite needs Node 22.12 or later.
- **Unit tests** run with Node's test runner and type stripping
  (`node --experimental-strip-types --test tests/*.test.ts`), without a test framework. `tests/` is
  not in `tsconfig.json`, which holds no Node types. The imports use `.ts` extensions, which Node's
  type stripping needs (`allowImportingTsExtensions`).

| Test | Covers |
| ---- | ------ |
| `tests/model-config.test.ts` | Foundry deployments and their settings, `openai:` pass-through with its case, aliases and pass-through IDs, which Mistral models read images, an unknown model and a model without its key |
