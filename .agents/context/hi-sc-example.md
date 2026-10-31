# HI Sign-in Example (TypeScript)

The documentation of `hi-sc-example/` — the HI planner with its AI chat in TypeScript, behind a
sign-in page. The user quickstart is the [README](../../hi-sc-example/README.md) of the folder.
[Back to the overview](./README.md).

## The flow

1. **Sign-in view** (`index.html`): a form over the background image
   `src/assets/say-hi-to-homag-intelligence.jpg` with the user and password of the HI server, the
   optional backend ID and library, and the optional provider, model and API key of the chat in the
   section "AI chat (optional)", a `<details>` collapsed at start. The
   backend ID is a text field with a ▾ button: the button opens the list `#backend-id-list` of the
   backend IDs of the HI server (`BACKEND_IDS`, `hi-server.ts`, from df-salesPortal
   `Infrastructure/salesConfigurator/test01/appsettings.json`), under the headings DEV, INT, PRE,
   PRD (`setupBackendIdList`, `main.ts`). The list always shows every ID, whatever the field holds;
   a click takes the ID into the field; any other ID can be typed. Every
   field starts blank; the provider is a selection of the providers of the embedding-lib. `main.ts` fills
   the fields from the sign-in cookie, then from the query parameter of each field's `name`
   (`user`, `password`, `backendId`, `libraryId`, `provider`, `model`, `apiKey`), so a query
   parameter overwrites the cookie; other parameters are ignored, and a provider that is not in the
   selection leaves it blank.
2. **Start planning** (`main.ts`, `readSettings`):
   - a provider, model or API key → `planningAssistantConfig` (`model-config.ts`); one of them
     without the others is an error on the form;
   - the user and password → the Basic authorization; `fetchBackend` (`hi-server.ts`) reads
     `GET <HI server>/backends/list` with it. 401 is "Wrong user or password". The backend ID is
     optional: with one, a backend ID that is not in the list is an error, and the backend's
     `planId`, `additionalCatalogs` (beside the fixed root tags, each catalog once),
     `configureInRoom` and `overrideServerUrl` (the planner's server, over
     `https://www.roomle.com/t/bo-test/`) go to the planner; without one, the planner gets no
     backend entry (default plan, no additional catalogs, the default server);
   - the library is optional as well: an entered one wins, otherwise the backend's `libraryId`
     (`resolveLibraryId`, `hi-server.ts`); without both, "Enter a library, or a backend ID that has
     one" on the form. A `?id=` plan goes to the planner over the backend's plan, a
     `?overrideServerUrl=` over the backend's server URL;
   - without a provider, model and API key, the chat runs on the model proxy of the HI server
     (`modelProxyConfig`, [The chat model](#the-chat-model)) when `fetchBackend` reports
     `modelProxy`: the list has exactly one backend and its `enableAIPlanning` is `true` — the proxy
     serves only a user of exactly one backend. Otherwise the planner opens without the chat;
   - after the sign-in is accepted and while no sign-in cookie exists, the dialog `#cookie-consent`
     asks to store the sign-in data ("Only the essential login data is stored"). **Allow** writes
     all seven fields to the cookie `hi-sc-sign-in` (`fields-cookie.ts`: JSON, one year,
     `SameSite=Strict`, no `path`, so the cookie belongs to the page's own path — `/hi-sc` on the
     start page's dev server, `/roomle-hi-example/hi-sc` on GitHub Pages, and the other sites of
     `roomle-dev.github.io` and the other examples do not get it);
     **Decline** or Escape stores nothing, and the next sign-in asks
     again. With the cookie, every sign-in rewrites it without asking;
   - the page swaps the sign-in view for the planner view, without a reload. The page writes
     nothing to the URL, so a reload returns to the sign-in;
   - an error while the planner starts returns to the sign-in view with the message.
3. **Planner** (`planner.ts`, `startPlanner`): `setupHi` with the HI proxy (`hiProxyBaseUrl`:
   `proxy_request?backendId=…`, or `proxy_request?url=…` without a backend ID, where the proxy uses
   the backend of the user; an empty `backendId=` is answered with 401) and the Basic authorization — `setupHi` loads the article catalog,
   master data and calc script itself, the page adds `onFetchPrice` for the prices —, then
   `createPlanner` and, with a model, `startPlanningAssistant` of the embedding-lib. Every query
   parameter that is not a field of the form goes to `createPlanner` and overwrites the option of
   its name (`query-options.ts`, `plannerQueryOptions`): `true`, `false` and numbers are converted
   as the Roomle SDK converts its URL parameters (`getAllParameters` of roomle-ui
   `common-core/src/utils/query-params-helper.ts`), and a `language` also sets `locale`. The HI
   library's language (`serverOptions.language`, `tecConfigInfo.language`) stays `en-US,en`.

| File | Responsibility |
| ---- | -------------- |
| `hi-sc-example/index.html` | the two views: the sign-in form with the cookie dialog, the planner container |
| `hi-sc-example/src/main.ts` | the form: prefills it, reads the settings, signs in, asks for the cookie, swaps the views |
| `hi-sc-example/src/fields-cookie.ts` | `storedFields`, `fieldsCookie`: the sign-in fields in the cookie |
| `hi-sc-example/src/hi-server.ts` | `BACKEND_IDS`, `hiProxyBaseUrl`, `fetchBackend`, `resolveLibraryId`, `modelProxyConfig` |
| `hi-sc-example/src/model-config.ts` | `planningAssistantConfig`: provider, model ID and key → the `PlanningAssistantConfig` of the embedding-lib |
| `hi-sc-example/src/planner.ts` | `startPlanner`: HI setup, planner, planning assistant |
| `shared/src/hi-planner.ts` | the planner basics and the price request, shared with the minifabric example ([Shared code](./minifabric-example.md#shared-code)) |
| `hi-sc-example/src/query-options.ts` | `plannerQueryOptions`: the query parameters other than the form fields → planner options |
| `hi-sc-example/src/style.css` | the sign-in page; the planner fills the window |
| `hi-sc-example/tests/model-config.test.ts` | the unit tests of `planningAssistantConfig` |
| `hi-sc-example/tests/fields-cookie.test.ts` | the unit tests of the sign-in cookie |
| `hi-sc-example/tests/query-options.test.ts` | the unit tests of `plannerQueryOptions` |
| `hi-sc-example/tests/hi-server.test.ts` | the unit tests of `hiProxyBaseUrl`, `fetchBackend`, `resolveLibraryId` and `modelProxyConfig` |

## The planner options

The planner gets the options of the minimal example's planner that shape its behaviour: the plan,
the server URL `https://www.roomle.com/t/bo-test/`, the catalog root tags, the
`externalObjectSettings` and the HI options.

- **`featureFlags.globalCallbacks: false` is required** for the planner's own catalog with an HI
  library. Without it the catalog requests the external root tag `__ext__obj__#external:root-tag`
  from the Roomle API, gets 403 and stays on "Loading catalog…" — see "Internal Catalog UI" in
  roomle-ui `packages/embedding-lib/docs/homag-intelligence-embedding.md`.
- **Left out** against `minimal-hi-example/index.html`: the preset dropdown, the debug panel, the
  order buttons and the price display, the query parameter `server_url` (here `overrideServerUrl`),
  the `dragIn` plugin, `saveToIdb`, and the page globals of the test scripts (`window.instance`,
  `window.hiPlannerCalls`, …). The end-to-end test scripts run against the minimal example only.

## The chat model

`model-config.ts` passes the provider (`anthropic`, `azure`, `google`, `mistral`, `openai`), the
model ID and the API key to the embedding-lib unchanged — no aliases, no mapping:

- `azure` is a deployment on the HI Azure AI Foundry resource: the config carries its OpenAI v1
  endpoint `https://dfhifoundrysweden.services.ai.azure.com/openai/v1` as `baseUrl`, which the
  embedding-lib's `createAzure` needs, and the model ID is the deployment name. The deployment runs
  on the Responses API with its own default reasoning effort.
- `readsImages` is `true` for every model, so the chat window offers the image drop.

Without an entered model, `modelProxyConfig` (`hi-server.ts`) puts the chat on the model proxy of
the HI server: the provider `openai-compatible`, the base URL `<HI server>/api/ai/v1`, the model
name `planning` (the alias of the backend's `AIFeatures.Planning`), the sign-in's Basic
authorization as the header `Authorization`, no key, `readsImages: true`. The model, its endpoint
and its key stay in the backend. The proxy speaks Chat Completions; how the embedding-lib runs the
provider:
[`homag-intelligence-embedding.md`](https://github.com/roomle-dev/roomle-ui/blob/master/packages/embedding-lib/docs/homag-intelligence-embedding.md)
of roomle-ui.

## Dependencies, build and tests

- **`@roomle/embedding-lib`** comes from npm, pinned to the dev version `0.0.0-dev-4c2797a`, which
  has the provider `openai-compatible` of the model proxy — see [unreleased-embedding-lib.md](../../docs/setup/unreleased-embedding-lib.md).
  Its declarations type `PlanningAssistantConfig` and `startPlanningAssistant`; the planner's init
  data and the HI callbacks refer to roomle-ui sources the package does not ship and are untyped
  (`skipLibCheck`).
- **Vite** serves the page under `/hi-sc/` of the [start page](./start-page.md) (the root `start:sc`)
  or alone on :3300 (`npm run dev`), and builds it into `dist/`;
  **TypeScript** only checks types (`tsc`, `noEmit`). Vite needs Node 22.12 or later.
- **Unit tests** run with Node's test runner and type stripping
  (`node --experimental-strip-types --test tests/*.test.ts`), without a test framework. `tests/` is
  not in `tsconfig.json`, which holds no Node types. The imports use `.ts` extensions, which Node's
  type stripping needs (`allowImportingTsExtensions`).

| Test | Covers |
| ---- | ------ |
| `tests/model-config.test.ts` | provider, model ID and key passed through unchanged, the Foundry endpoint of an `azure` model, a chat without its provider, model or key |
| `tests/fields-cookie.test.ts` | the fields stored and read back with any characters, among other cookies; the cookie attributes; no fields without the cookie |
| `tests/query-options.test.ts` | every query parameter but the login fields forwarded; `true`, `false` and numbers converted; `language` sets `locale`; nothing without query parameters |
| `tests/hi-server.test.ts` | the proxy URL with and without a backend ID; the backend of the ID, the sign-in check without an ID, an unknown backend ID; the model proxy for the only backend that enables it, none for a backend without the flag or a user of several backends (`fetch` mocked); the entered library over the backend's, the backend's without one, the message without both; the config of the model proxy |

## GitHub Pages

The example is published under `/hi-sc/` of the start page at
<https://roomle-dev.github.io/roomle-hi-example/hi-sc/> — see [Start page and GitHub Pages](./start-page.md#github-pages).
