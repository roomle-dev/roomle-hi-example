# Sales Portal Example

`df-salesPortal_sc-example/index.html` — our copy of the sales configurator page of the HOMAG
df-salesPortal (`Infrastructure/salesConfigurator/test01/wwwroot/index.html`). It is the page an
agency builds: plain JavaScript without a build step, the HI planner with prices and the order to
the Order Manager, and the AI Planning Assistant on the model proxy of the HI server.
[Back to the overview](./README.md).

## The page

- **Embedding-lib:** `@roomle/embedding-lib` and its `hi.js` from unpkg, pinned to the dev build
  `0.0.0-dev-4c2797a` — a version with `startPlanningAssistant` and the provider
  `openai-compatible`. No release up to 8.2.1 exports `startPlanningAssistant`.
- **SC settings** (the block between `BEGIN` and `END`): the HI proxy
  (`getHiServerBaseUrl`, `proxy_request?url=` without a backend ID, so the proxy uses the backend of
  the user), the Basic authorization (`getHiAuthData`), the model proxy (`getAiProxyBaseUrl`), the
  library, the initial plan (overridden by the query parameter `planId`), the configuration, the
  additional catalogs and the user rights.
- **HI setup:** `setupHi` with `onPriceCalc`, `onFetchPrice` (the price label) and `onPlaceOrder`
  (the import into the Order Manager and its link); the button **Send To OM** calls
  `placeOrder(true)` and creates an order.
- **Planner:** `createPlanner` with the server `https://www.roomle.com/t/bo-test/`, then
  `loadObject` of the plan.

## The AI Planning Assistant

The model, its endpoint and its key stay in the backend; the page names only the proxy and
authorizes with the Basic authorization of the HI server.

1. Before the planner, the page reads `GET https://dfscfgtest01-app.azurewebsites.net/backends/list`
   with the Basic authorization. The chat is on when the answer has exactly one entry and its
   `enableAIPlanning` is `true` — the model proxy serves only a user who belongs to exactly one
   backend.
2. `featureFlags.planningAssistant` takes the flag, so the planner shows the AI Planning Assistant
   window only then.
3. After `loadObject`, with the flag, `startPlanningAssistant` runs with the provider
   `openai-compatible`, the base URL of the proxy, the model name `planning` (the alias of the
   backend's `AIFeatures.Planning`), the header `Authorization` and `readsImages: true` — no key.

The proxy (`POST /api/ai/v1/chat/completions`, df-salesPortal pull request 130219) speaks OpenAI
Chat Completions: the planning assistant sends the whole history with every step, without the
Responses continuation, and moves the images of `get-plan-images` into a user message. Its
preflight allows every origin and the headers `Authorization` and `Content-Type`, so the page runs
from any origin; in the df-salesPortal deployment the page and the backend share one origin. How
the provider works:
[`homag-intelligence-embedding.md`](https://github.com/roomle-dev/roomle-ui/blob/master/packages/embedding-lib/docs/homag-intelligence-embedding.md)
and the
[agent architecture](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/agent-architecture.md)
of roomle-ui.

## Before you change this page

- **Keep it plain.** The df-salesPortal takes the page over as it is: no build step, no globals for
  test scripts, no launcher. The end-to-end test scripts run against the minimal example only.
- **The credentials are in the page.** The Basic authorization of the HI server also authorizes
  the model calls of the proxy, which has no rate limits or budgets. A real shop keeps it in its
  backend and forwards the requests.
- **A new embedding-lib version** means raising the version in both imports.
