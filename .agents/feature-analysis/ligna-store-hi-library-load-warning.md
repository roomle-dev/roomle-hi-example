# The ligna-store Warns When the HI Library Does Not Load

> **Type**: Feature Analysis  
> **Status**: Open  
> **Date**: 2026-10-29  
> **Ticket**: [RML-18327](https://roomle.atlassian.net/browse/RML-18327)  
> **Base**: ligna-store `master` (`b339a6a`, embedding-lib `0.0.0-dev-1b4351d`), roomle-ui `master`  
> **Branch**: ligna-store `feat/hi-library-load-warning-RML-18327`

## Affected Repositories

- **ligna-store** — `components/blocks/Planner.vue` passes all three library loaders to `setupHi`,
  each with a timeout; a failed or timed-out load opens a new pop-up that names the HOMAG backend
  as the cause.
- **roomle-ui** (planner-core) — `Planner.bootFinished` finishes the boot when the HI library fails
  to load, so the scene loads without it. The store loads the planner from its server URL
  (`overrideServerUrl`, bo-test / bo-alpha), so the change reaches it with the planner deployment.
- **embedding-lib** (roomle-ui `packages/embedding-lib`) — unchanged. `setupHi`,
  `libLoadArticleCatalog`, `libLoadMasterData` and `libLoadCalcScript` stay as they are; no new
  embedding-lib build.
- roomle-hi-example — this analysis only.

## 1. What Was Asked and Why

A few days ago, the HOMAG backend did not deliver the HI library. The LIGNA store showed only a
spinning wheel with no message, and Roomle was blamed for a broken store.

The ticket asks for two things:

1. **A clear message.** When `libLoadArticleCatalog`, `libLoadMasterData` or `libLoadCalcScript`
   times out, the store shows a warning dialog in an overlay. The dialog names the issue so that
   the right people are contacted from the start.
2. **The scene loads anyway.** The Roomle 3D scene loads in the background, without the connection
   to the HOMAG backend.

The ticket expects the callbacks to be implemented in `components/blocks/Planner.vue`.

## 2. How It Works Today

### 2.1 The Store Hands the Loaders to the Planner

`Planner.vue:142-170` calls `setupHi(options.hi, callbacks)` and overrides only
`onLoadArticleCatalog` (`ext-objects/api.ts:24-39`, which wraps `libLoadArticleCatalog` for the
Cloudinary images). `setupHi` fills the two missing loaders with its defaults (roomle-ui
`packages/embedding-lib/src/homag-intelligence/hi-setup.ts:42-53`):

| Planner callback | Store | Default in `setupHi` |
|---|---|---|
| `onLoadArticleCatalog` | `loadArticleCatalog` → `libLoadArticleCatalog` | — |
| `onLoadMasterData` | not passed | `libLoadMasterData` |
| `onLoadJavascript` | not passed | `libLoadCalcScript` |

`setupHi` exposes the callbacks over a Comlink port to the planner iframe (`hi-setup.ts:57-67`).
The store never sees the master data and calc script requests.

### 2.2 The Requests Have No Timeout

All three loaders use `fetchDataWithAuthorization` (roomle-ui
`packages/embedding-lib/src/homag-intelligence/hi-requests.ts:4-57`). It calls `fetch` without an
`AbortSignal`:

- an HTTP error status (for example a 502 or 504 from the HI proxy) throws `Failed to fetch data
  from …` — the promise rejects;
- a network error rejects the promise;
- a server that never answers leaves the promise pending. The browser's `fetch` has no timeout of
  its own.

### 2.3 The Planner Boot Waits for the Library

The planner iframe boots HI before it hands the planner to the UI:

1. `Planner.bootFinished` awaits `setupHomagIntelligence()` (roomle-ui
   `packages/web-sdk/packages/planner-core/src/planner.ts:68-70`).
2. `setupHomagIntelligence` starts `onLoadArticleCatalog` (`roomle-planner.ts:3782`) and creates
   the `HomagIntelligence` instance, which registers itself with the planner
   (`homag-intelligence.ts:84`). It then awaits `loadExternalObjectLibrary` (`roomle-planner.ts:3813`).
3. `loadExternalObjectLibrary` (`roomle-planner.ts:2399-2419`) awaits the catalog first
   (`homag-intelligence.ts:131`). Then `loadLibrary` loads the master data and the calc script in
   parallel (`homag-intelligence.ts:326-329`).
4. The UI awaits the boot: `RoomleSdkWrapper.getPlanner` (`src/configurator/business-logic/roomle-sdk-wrapper.ts:136`)
   ← `SdkConnectorPlanner.init` (`src/planner/business-logic/sdk-connector-planner.ts:145`)
   ← `SdkConnector.initCanvasElement` (`src/configurator/business-logic/sdk-connector.ts:830`).
   None of these catches an error.

| HOMAG backend | Loader promise | Planner boot | What the store shows |
|---|---|---|---|
| delivers | resolves | finishes | scene with the HI library |
| error status or network error | rejects | rejects; the planner connector never reaches its waiters | spinner, no message |
| never answers | stays pending | waits forever | spinner, no message — the incident |

The rejection row comes from reading the code; it has not been reproduced live yet (§8).

### 2.4 The Store's Pop-Ups

The store already has an overlay dialog system:

- `composables/use-ui-state.ts:8-12` lists the pop-ups (`notOrderable`, `notAvailable`, `ar`);
- `openPopUp(name, payload)` opens one;
- `components/blocks/PopUps.vue` renders them and is mounted in `layouts/default.vue:113`;
- `components/blocks/PopUps/NotAvailable.vue` is a one-button dialog (title, text, Continue);
- the texts are in `i18n/locales/en.json` and `de.json` (`planner.warning.*`).

## 3. The Gap

1. **The store does not see the failure.** Two of the three loaders run as `setupHi` defaults, so
   the store has no hook on them.
2. **Nothing times out.** A backend that never answers keeps the load pending forever.
3. **A failed library stops the scene.** The planner boot awaits the library and does not catch a
   failure (§2.3).

## 4. Detecting the Failure From the Loaders' Return Values

`libLoadArticleCatalog`, `libLoadMasterData` and `libLoadCalcScript` return promises. The store can
use them to detect the failure **without changing the embedding-lib**:

- **Error status or network error:** the promise rejects. The store catches the rejection in its
  callback.
- **Timeout:** the promise stays pending and never returns a value, so the return value alone
  cannot report it. The store races the promise against its own timer. The `libLoad*` functions
  take no `AbortSignal`, so the request stays open until the browser gives up. Only the store's
  promise settles, and a late answer is ignored.

Both work from the store because `setupHi` uses any loader the store passes instead of its default
(`hi-setup.ts:42-53`). `libLoadMasterData` and `libLoadCalcScript` are exported from
`@roomle/embedding-lib/hi`, like the `libLoadArticleCatalog` the store already wraps.

Detection is not enough to load the scene. A rejecting loader ends the planner boot (§2.3). Loading
the scene without the library is the planner's job (roomle-ui planner-core), not the
embedding-lib's. It reaches the store with the planner deployment, without an embedding-lib build.

## 5. Proposed Design

### 5.1 ligna-store

1. **Guard the three loaders.** Add one helper next to `loadArticleCatalog` in
   `ext-objects/api.ts`. It runs a loader against a timer of `HI_LIBRARY_LOAD_TIMEOUT_MS`. If the
   loader rejects or the timer fires first, it reports which data failed and rethrows. In
   `Planner.vue`, `setupHi` gets all three loaders through the helper. They all use
   `hiOptions.serverOptions`, the object `setupHi` gives its fallback language, so the requests
   keep their Accept-Language:
   - `onLoadArticleCatalog`: `loadArticleCatalog(libraryId, hiOptions.serverOptions)`, as today;
   - `onLoadMasterData`: `libLoadMasterData` with `libraryId` and `hiOptions.serverOptions`;
   - `onLoadJavascript`: `libLoadCalcScript` with the same options.
2. **Open the dialog once per planner load.** On the first failure, call `openPopUp` with the new
   pop-up `hiLibraryUnavailable` and a payload of `data` (articles, master data or calc script) and
   `reason` (timeout or the error message). If the catalog fails, the planner
   never requests the master data and the calc script (§2.3). If both of those fail in one load,
   the dialog opens only once. Each planner reload, for example on a locale switch, loads again and
   may open the dialog again.
3. **Add the dialog.** Add `components/blocks/PopUps/HiLibraryUnavailable.vue`, a one-button dialog
   like `NotAvailable.vue`. Register it in `use-ui-state.ts` and `PopUps.vue`, and add the texts to
   `en.json` and `de.json` under `planner.warning.hi-library-unavailable`. Proposed text:
   - title: "The HOMAG furniture library is not available"
   - text: "The HOMAG Intelligence backend did not deliver the furniture library. You can plan
     the room, but you cannot add or price kitchen furniture. Please contact HOMAG support."
   - a small detail line naming the failed data and the reason (for example "articles: no answer
     within 30 s"), so support sees the cause without opening the console.

### 5.2 roomle-ui planner-core

`Planner.bootFinished` (`planner.ts:68-70`) catches a failed `setupHomagIntelligence()`, logs it,
and finishes the boot. The scene then loads without the HI library.

The catch goes in `bootFinished`, not in `setupHomagIntelligence`. The boot is the only path the
failure must not break. A caller of the public `loadExternalObjectLibrary`, which also runs
`setupHomagIntelligence`, still gets the rejection.

After a failed load, the `HomagIntelligence` instance stays registered without a library
(`homag-intelligence.ts:84`; `isLibraryLoaded` is false). A later
`extended.loadExternalObjectLibrary(libraryId)` can still load the library. A retry button is not
part of this ticket.

The live check covers these consequences:

- the planner catalog keeps the early `HiTagCatalogCallbacks` interceptor with the rejected catalog
  promise (`roomle-planner.ts:3788`); opening the HI entries of the catalog must not hang the
  catalog view;
- a plan opened by `?id=` (`Planner.vue:423-425`) loads its room and its other objects; its HI
  groups cannot be calculated without the library;
- the price calculation fails without the library and is already caught (`Planner.vue:311-316`).

### 5.3 The Timeout Value

The proposal is 30 s per request. The catalog loads first and the master data and calc script after
it, so in the worst case the scene appears after two timeouts (60 s). The browser console shows the
normal load times ("The data for articles was fetched in … milliseconds") to confirm the value.

## 6. Alternatives Considered

| Alternative | Why rejected |
|---|---|
| A timeout in the embedding-lib's `fetchDataWithAuthorization` (`AbortSignal.timeout`) | It would abort the request and serve every integrator, but it needs an embedding-lib build and a default value for every integrator, and the store still has to see the failure to show its dialog. This ticket does not need it. |
| The store resolves fallback data on a timeout (an empty catalog, master data and script) so the boot goes on without a roomle-ui change | It registers a library without calc functions. Every later HI operation would fail with an unrelated error. A workaround that hides the cause. |
| The planner loads HI in the background (`bootFinished` does not await it) | It changes the load order for every HI integrator. Saved HI groups and the `onCheckExternalCache` interceptor (`roomle-planner.ts:3772-3777`) rely on HI being set up before the plan loads. |
| A store watchdog around `createPlanner` (no planner after N s → dialog) | It cannot name the failed data, fires on every slow load, and the scene still does not load. |
| A new HI callback, `onLibraryLoadFailed`, from the planner to the store | The store already sees the failure in its own loaders. A second channel adds API without need. |

## 7. Code and Documents the Work Touches

ligna-store:

- `components/blocks/Planner.vue` — the three guarded loaders in `setupHi`
- `ext-objects/api.ts` — the timeout helper and `HI_LIBRARY_LOAD_TIMEOUT_MS`
- `composables/use-ui-state.ts`, `components/blocks/PopUps.vue` — the new pop-up
- `components/blocks/PopUps/HiLibraryUnavailable.vue` — new
- `i18n/locales/en.json`, `i18n/locales/de.json` — the dialog texts

roomle-ui:

- `packages/web-sdk/packages/planner-core/src/planner.ts` — the catch in `bootFinished`
- `packages/web-sdk/packages/planner-core/__tests__/planner.ts` — `bootFinished` resolves when
  `setupHomagIntelligence` rejects
- `packages/embedding-lib/docs/homag-intelligence-embedding.md` — the loader callbacks
  (`onLoadJavascript`, `onLoadMasterData`, lines 852-900): a rejecting loader lets the planner boot
  without the library

roomle-hi-example: this analysis, closed out when the work lands.

## 8. Verification

The roomle-ui change gets a unit test in `planner-core/__tests__/planner.ts`. The ligna-store has
no unit-test runner (`package.json` has lint and format only), so the store is checked live:
headless Chromium against the local store, with the HI proxy requests for the articles, master
data and calc script routed in three ways:

- **No answer:** the dialog appears after the timeout and the scene loads.
- **A 504:** the dialog appears at once and the scene loads.
- **Pass through:** no dialog, the HI library loads.
- **Without the roomle-ui change:** the same check confirms the rejection row of §2.3.

## 9. Open Questions

1. **The timeout:** is 30 s per request right?
2. **The dialog text:** who should it name — "HOMAG support", or a contact or link of the LIGNA
   store?
3. **The Planning Assistant:** when the library has failed, should the store still start the chat
   (`Planner.vue:265-273`)? Its tools need the library. The ticket does not ask for this.
4. **Store unit tests:** a test runner (vitest) for the timeout helper would be a new dependency of
   the store. Is the live check enough?
