# The nobilia catalog example through the HI server

> **Type**: Feature Analysis  
> **Status**: Open  
> **Date**: 2026-10-30  
> **Base**: roomle-ui `feat/hi-planning-assistant` (`f93e6a40c`); df-salesPortal
> `feature/aiPlanningData` (`8c07b8a8`); bo-api-tc-emulator `324d9d8`

**Affected repositories**

- **roomle-ui**: `packages/embedding-lib/examples/demos/homag-intelligence-catalog-example.ts` takes
  the HI server's `proxy_request` with a `backendId` and the Basic authorization of the HI user,
  as `hi-presets-example.ts` does, instead of Roomle's demo proxy.
- **df-salesPortal** (HOMAG): only with option B, a backend entry in
  `Infrastructure/salesConfigurator/test01/appsettings.json` with the subscription the demo proxy
  uses for nobilia.
- **bo-api-tc-emulator**: unchanged; its Cloud Function keeps serving the example's AI kitchen
  generation, which the HI server cannot forward (section 3).

## 1. What was asked

Whether the catalog example can reach the HOMAG backend "the usual way" — through the HI server
(`https://dfscfgtest01-app.azurewebsites.net/proxy_request?backendId=…&url=…`) — instead of its
special proxy, and whether the nobilia library it plans with is the same as
`backendId=HI_PRD_Homag_Roomle_Bath_Test&library_id=nobilia_Minifabrik`. The HI server's
appsettings carry `nobilia_Minifabrik` in `CdmConfig`, without a backend ID.

## 2. How it works today

### 2.1 The catalog example and Roomle's demo proxy

- `generateInitData()` (`examples/utils/settings.ts`) builds the HI options from
  `nobilia-api-options.ts`: library `nobilia_Minifabrik`, **no `serverOptions.baseUrl`**, empty
  subscription and key. The embedding-lib then sends every library request to its default
  `HOMAG_INTELLIGENCE_ENDPOINT` (`src/homag-intelligence/hi-utils.ts`):
  `https://europe-west3-rml-showcases.cloudfunctions.net/proxy_request?url=…`, with
  `subscriptionId`, `apiKey` and `baseUrl` as query parameters when set
  (`hi-requests.ts`, `hi-order-manager.ts`). The example sets `baseUrl` to its endpoint setting,
  `https://connect.homag.com/` by default.
- The order-manager calls add `x-aux-header: nobilia` (`getOmRequestHeaders` in
  `examples/utils/settings.ts`).
- The settings bar of the example lets the user enter an API key, a library, a subscription and an
  endpoint; they go to the demo proxy as query parameters.
- **The AI kitchen generation** (`AI_KITCHEN_GENERATION_URL`) posts through the same demo proxy to
  `https://apim-aiplanner-ki-stage.azure-api.net/v1/generate` — "the AI endpoint answers no CORS
  preflight" — with placeholder credentials, so the proxy forwards no HOMAG credentials of its own.

### 2.2 The demo proxy

The demo proxy is the Cloud Function `proxy_request` of the GCP project `rml-showcases`
(`europe-west3`), the source `bo-api-tc-emulator/server/proxy/index.js`. It forwards `url` to
`baseUrl` with Basic `subscriptionId:apiKey`. When the URL contains `nobilia` or the request
carries `x-aux-header: nobilia`, it takes its nobilia credentials from the environment
(`SHOWCASE_SUBSCRIPTION_ID_NOBILIA`, `SHOWCASE_API_KEY_NOBILIA`, `SHOWCASE_BASE_URL_NOBILIA`),
unless the query overrides them. Those values live only in the function's deployment.

### 2.3 The HI server (df-salesPortal)

- `proxy_request` resolves the configuration with `GetConfig` (`BackendAccess.cs`): the
  `BackendIds` entry of the `backendId`, otherwise **`CdmConfig`**. `ValidateUser` lets a request
  without `backendId` through for the default user (`BasicAuth`) or picks the one backend of a user
  with its own login. So `CdmConfig` is the configuration of the default user without a backend ID.
- The order-manager paths (`/api/price/calculate`, `/api/orderManager/orders/import`) take the
  `OmConfig` of the configuration (`CreateUriAndCredentials`, `Program.cs`). The server forwards
  only to the configuration's own `EndpointUrl`; there is no `x-aux-header` handling.
- `CdmConfig` (compared field by field, values not reproduced): `nobilia_Minifabrik` on
  `https://connect-dev.homag.cloud` — the endpoint and subscription of
  `HI_DEV_Homag_Roomle_Bath_Test`, with another key. The four `*_Homag_Roomle_Bath_Test`
  backends are `nobilia_Minifabrik` on `connect-dev`, `connect-int`, `connect-preview` and
  `connect.homag.cloud`.

### 2.4 Observed (2026-10-30, `GET api/pos/libraries/nobilia_Minifabrik/articles`)

| Route | Status | Articles | Body hash |
|---|---|---|---|
| Demo proxy, as the catalog example (`baseUrl` `connect.homag.com`) | 200 | 60 | `e54192c3` |
| Demo proxy, its own base URL | 200 | 60 | `e54192c3` |
| Demo proxy with `baseUrl` `https://connect.homag.cloud/` | 200 | 60 | `e54192c3` |
| HI server, no `backendId` (`CdmConfig`) | 200 | 395 | `727b0a54` |
| HI server, `HI_DEV_Homag_Roomle_Bath_Test` | 200 | 395 | `727b0a54` |
| HI server, `HI_INT_Homag_Roomle_Bath_Test` | 200 | 394 | `2a0e8d72` |
| HI server, `HI_PRE_Homag_Roomle_Bath_Test` | 200 | 410 | `47a310af` |
| HI server, `HI_PRD_Homag_Roomle_Bath_Test` | 200 | 414 | `9a2d010c` |

The demo proxy sends the same 60 articles on `connect.homag.com` and on `connect.homag.cloud`, the
gateway of `HI_PRD_Homag_Roomle_Bath_Test`, which sends 414 there: the difference is the
**subscription**, not the endpoint. `CdmConfig` is the DEV library, identical to
`HI_DEV_Homag_Roomle_Bath_Test`.

## 3. The gap

1. **No backend ID serves the example's library.** The demo proxy's nobilia subscription is none
   of the HI server's configurations; `HI_PRD_Homag_Roomle_Bath_Test` is a different library state
   (414 articles against 60), and `CdmConfig` is the DEV one.
2. **The AI kitchen generation cannot go through the HI server.** It forwards only to the
   configuration's `EndpointUrl`, never to `apim-aiplanner-ki-stage.azure-api.net`.
3. **The usual way needs the HI login** — `use_server` and `VITE_HI_TEST_AUTH`, as
   `getHiAuthData` and `getHiServerBaseUrl` in `examples/utils/homag-intelligence/hi-presets.ts`
   provide them.

## 4. Options

| Option | What changes | Result |
|---|---|---|
| **A** — an existing backend | roomle-ui: the example takes `baseUrl` `getHiServerBaseUrl('HI_PRD_Homag_Roomle_Bath_Test')` (or another stage), `authData` `getHiAuthData()`, and drops `x-aux-header`, the credential fields of the settings bar and `nobilia-api-options.ts`'s placeholders | The usual way today, but another library state: 414 articles instead of 60. Kitchens the AI generation returns for the demo's catalogue may name articles the HOMAG library does not resolve the same way — to be checked with one generation |
| **B** — a backend for the showcase subscription | df-salesPortal: a `BackendIds` entry (e.g. `HI_PRD_Roomle_Nobilia_Showcase`) with the demo proxy's nobilia subscription, key and endpoint, which Roomle hands to HOMAG out of the function's deployment; roomle-ui as in A with that backend ID | The usual way with exactly today's library |
| **C** — keep the demo proxy | nothing | The example stays on Roomle's proxy with its own credentials |

In A and B the AI kitchen generation keeps the demo proxy — or HOMAG adds a route for the AI
planner to the HI server, which is not there today.

## 5. Decisions

1. A, B or C.
2. For A: which stage — PRD, as asked, or PRE (410 articles).
3. Whether the AI kitchen generation stays on the demo proxy.
