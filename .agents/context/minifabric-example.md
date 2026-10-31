# HI Minifabric Example (TypeScript)

The documentation of `minifabric-example/` — the HI planner with the library `nobilia_Minifabrik`
through Roomle's [demo proxy](./demo-proxy.md), a settings panel for the testing credentials, the
AI kitchen generation and the AI Planning Assistant. It is the standalone form of roomle-ui
`packages/embedding-lib/examples/demos/hi-minifabric-example.ts`. The user quickstart is the
[README](../../minifabric-example/README.md) of the folder. [Back to the overview](./README.md).

## The flow

1. **Settings** (`settings.ts`, `main.ts`): the settings stored in localStorage under
   `nobilia-demo-settings` over the defaults (`loadSettings`; an invalid entry or an unreadable
   storage keeps the defaults), then the query parameters `locale` (or `language`), `apiKey`,
   `libraryId` (or `library_id`), `subscriptionId`, `endpointUrl` and `user_right`
   (`applyQueryParams`; an unknown parameter level keeps the setting). localStorage belongs to the
   origin: on GitHub Pages the `nobilia-web-sdk-demo` of `roomle-dev.github.io`, which uses the same
   key, shares the settings. The page fills the form
   `#settings` of the panel with them and stores them. **Reload** stores the form and reloads the
   page. The ▸ button collapses the panel.
2. **Planner options** (`planner.ts`, `plannerOptions`): the library is the entered one, else
   `nobilia_Minifabrik`; the HI requests go through the demo proxy
   (`https://europe-west3-rml-showcases.cloudfunctions.net/proxy_request?url=`) with the entered
   endpoint URL, subscription ID and API key, for the library and the order manager alike. An empty
   value is not sent, so the proxy uses its own nobilia subscription. The query parameters
   `plan_id`, `server_url` and `debug=true` set the plan, the planner's server and the debug
   geometry. The planner gets the shared planner basics ([Shared code](#shared-code)), the
   locale of the settings, the parameter level as `uiConfiguration.userRight`, the undo, redo and
   swap buttons, the two-level catalog, sloping roofs, the open/close animation, the local 3D export
   and `featureFlags.planningAssistant`.
3. **Start** (`main.ts`, `startExample`): `setupHi` with the library callbacks of the embedding-lib
   (`createHiLibraryCallbacks`) and the page's callbacks — the price, the HI log messages to the
   browser console, the order data as the download `orderData.json` — then `createPlanner`,
   `loadObject` of the plan, `startPlanningAssistant` and the action buttons.

| File | Responsibility |
| ---- | -------------- |
| `minifabric-example/index.html` | the settings panel with its form and actions, the planner container |
| `minifabric-example/src/main.ts` | the settings panel, the HI setup, the planner, the prices, the actions, the chat |
| `minifabric-example/src/settings.ts` | `loadSettings`, `saveSettings`, `applyQueryParams`: the settings of the panel |
| `minifabric-example/src/planner.ts` | `plannerOptions`, `orderManagerHeaders`, `PLANNING_ASSISTANT_CONFIG` |
| `minifabric-example/src/price.ts` | `calculateTotalSum`, `createCoalescingTaskRunner` |
| `minifabric-example/src/layout.ts` | the AI kitchen generation, the layout file, removing and loading layouts |
| `minifabric-example/src/style.css` | the panel in the look of the roomle-ui drawer; the planner fills the rest of the window |

## Prices and orders

- **The price** shows in the planner (`ui.setPrice('€', …)`): `fetchPrice` of the planner, which
  asks the order manager through `onFetchPrice` (`requestPrice` of the shared code with
  `orderManagerHeaders`: `x-aux-header: nobilia` for a nobilia library, `none` otherwise), and
  `calculateTotalSum` sums the answer — the item `type: 'Price'`, `priceType: 'Total'` of a level,
  else the sum of its items, in cents. Every trigger runs it through one coalescing task runner:
  one calculation at a time, the triggers meanwhile coalesced into one follow-up run, so the last
  change wins. The triggers: the HI callbacks `onPosGroupsCompletelyLoaded` and `onPriceCalc`, the
  planner's `onCompletelyLoaded`, `onPlanElementAdded`, `onPlanElementChanged`,
  `onPlanElementRemoved`, the planner start and **Calc Price**.
- **The order** — **Send to OM** and the planner's request-plan button — runs `placeOrder(true)`;
  the HI module hands the order data to `onPlaceOrder`, which downloads it as `orderData.json`.

## Layouts

- **Generate with AI** posts `{ metaData: { catalogue: { id: 'elements' } } }` to the AI kitchen
  generation `apim-aiplanner-ki-stage.azure-api.net` `v1/generate` through the demo proxy — the
  endpoint answers no CORS preflight; the placeholder credentials `a` and `b` keep the proxy from
  forwarding its own HOMAG credentials. The default `idm` catalogue plans with articles the nobilia
  library does not contain. Meanwhile it removes every external object group of the plan, then
  loads the layout.
- **Load layout** loads an article layout JSON file the user selects; anything but a JSON object is
  refused with the reason in the console.
- Both load with `loadExternalObjectGroupLayout(layout, 'nobila', { findFreeSpaceInPlan: true })`;
  `nobila` is the layout type of these article layouts.

## The chat

`PLANNING_ASSISTANT_CONFIG` runs the chat on `gpt-6-astra` through the Azure AI route of the demo
proxy (`…/proxy_request/azure-ai`): the provider `azure` on the Responses API, `readsImages: true`,
and a placeholder key the proxy drops — the proxy holds the endpoint and the key, the page names
only the model.

## Shared code

`shared/src/hi-planner.ts` holds what this example and the [sign-in example](./hi-sc-example.md)
share: the embedding ID, the planner's server `https://www.roomle.com/t/bo-test/`, the default plan,
the HI catalog root tags, `externalObjectSettings(userRight, tecConfigInfo)` (arrangement
correction, sub-modules, thumbnails, no open/close animation of the library, the default material,
no debug geometry) and `requestPrice` (`omPostRequest` to `/api/price/calculate`); beside them
`importOrder`, the order import of the sign-in example's Add to Cart
([Save Draft and Add to Cart](./hi-sc-example.md#save-draft-and-add-to-cart)). The examples
import it by relative path; `shared/` is a workspace for its tests and its dependency on the
embedding-lib. `tecConfigInfo` carries the language and the library; neither the planner nor the
kernel reads it.

## Against the roomle-ui example

The example runs on its own page, so it differs from roomle-ui `hi-minifabric-example.ts` where the
examples app provides the environment:

- **The planner's server** is `https://www.roomle.com/t/bo-test/` unless `server_url` names
  another; the examples app falls back to its local dev server.
- **The HI log messages and the layout file errors** go to the browser console; the examples app
  writes them into a `#console-log` element.
- **No example list:** nothing closes the example, so the chat and the AI request run until the
  page closes.

## Dependencies, build and tests

The same as the sign-in example ([Dependencies, build and tests](./hi-sc-example.md#dependencies-build-and-tests)):
`@roomle/embedding-lib` `0.0.0-dev-4c2797a`, Vite under `/nobilia-minifabrik/` of the
[start page](./start-page.md) (the root `start:sc`, on GitHub Pages
<https://roomle-dev.github.io/roomle-hi-example/nobilia-minifabrik/>) or alone on :3400
(`npm run dev`), `tsc` for the types, Node's test runner with type stripping. The planner API
of the embedding-lib's declarations is untyped; `layout.ts` declares the part it calls.

| Test | Covers |
| ---- | ------ |
| `tests/settings.test.ts` | the defaults, the stored settings over them, an invalid entry and an unreadable storage; every query parameter, the aliases `language` and `library_id`, an unknown parameter level |
| `tests/planner.test.ts` | the nobilia library through the demo proxy without settings; the settings in the library and the order manager options; `plan_id`, `server_url`, `debug`; the order-manager headers; the chat on the Azure AI route |
| `tests/price.test.ts` | the total price item, the sum in cents with recursion, no items; the coalesced follow-up run, a failed run |
| `tests/layout.test.ts` | the AI kitchen request through the proxy and its failure; the layout JSON accepted and refused; groups removed, then the layout loaded |
| `shared/tests/hi-planner.test.ts` | the external object settings; the price request with its path, body and headers; the order import with its status read by the correlation ID, none without one |
