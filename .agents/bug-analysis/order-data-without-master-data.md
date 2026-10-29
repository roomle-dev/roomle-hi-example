# The Order Data Is Built Without the Master Data

> **Type**: Bug Analysis  
> **Status**: Open  
> **Date**: 2026-10-29  
> **Ticket**: [RML-18325](https://roomle.atlassian.net/browse/RML-18325)  
> **Base**: roomle-ui `master` (`ec60426b1`)

## Affected Repositories

- **roomle-ui** (web-sdk, `packages/web-sdk/packages/homag-intelligence`) — the library wrapper
  `getOrderData` in `src/homag-intelligence.ts` passes the master data of its library as the fourth
  argument, plus a new unit test for the wrapper. The wrapper is part of the planner, so the example
  page and the ligna-store get the fix with the planner deployment at their server URL. No
  embedding-lib build is needed.
- **HOMAG library** (`pos-calc-script.ts`) — unchanged. Its `getOrderData` already takes the master
  data as an optional fourth parameter.
- roomle-hi-example — this analysis only.

## 1. Symptom

The library API defines

`getOrderData(posGroups: OcGroup[], roomlePlannerId: string, rooms?: OcContour[], masterData?: OcMasterData): OrderItemGroup`

and roomle-ui calls it with three arguments. Without the master data, the library returns every
attribute of the order data as `name`, `value`, `isInput` and `isHidden` only. The display name, the
category, the main flag, the display value and the value image are missing from every order the
planner builds: the price request, the placed order, the `orderData` of a plan snapshot, and the
result of the `get-order-data` tool.

**Reproduction.** Plan any group on the example page and read
`instance.extended.getExternalObjectSnapshot({ orderData: true })`, or open the `order-data.json`
of any "test the mcp" run. No attribute carries `displayName`. For example, a root of a Furniture_Smith
plan holds `{ "name": "mod_PaneltopEdgeBackColor", "value": "316" }` where the master data knows
"Edge color back", category "Panel", value "Concrete" and an image of the value.

## 2. The Ticket's Question: Is There Already a Branch?

No. None of the 328 remote branches or the 17 local branches of roomle-ui passes the master data.
The local branches all pass three arguments. Of the remote branches, 182 hold the wrapper and the
others do not hold the file:

| Call in `homag-intelligence.ts` | Remote branches |
|---|---|
| `libraryExports.getOrderData(groupData, roomlePlannerId, rooms)` | 152 |
| `libraryExports.getOrderData(groupData, roomlePlannerId)` | 17 (older) |
| `window.exports.getOrderData(groupData, roomlePlannerId)` | 13 (older) |
| with a fourth argument | 0 |

## 3. Investigation Trace

### 3.1 What the Library Does With the Master Data

The `calc.js` of Furniture_Smith (backend `HI_PRE_Roomle_Milestone_2`) and of
DeMaatFabriek_CabinetLibrary (backend `HI_PRE_DE_MAAT_FABRIEK`), read through the test proxy, carry
identical `getOrderData`, `mapAttributes`, `mapAttribute` and `mapModules` functions:

- `getOrderData(posGroups, roomlePlannerId, rooms, masterData)` maps the group attributes and the
  root attributes with `mapAttributes(attributes, masterData)`.
- `mapModules`, the mapping of the sub-modules, calls `mapAttributes(moduleData.attributes)` without
  the master data. Sub-module attributes stay plain even when the master data is passed. This is
  the library's behaviour.
- `mapAttribute(attribute, masterData)` returns `{ name, value, isInput, isHidden }` when
  `masterData === undefined`. Otherwise it finds the attribute in `masterData.attributes` by id
  and adds:
  - `displayName` from the attribute's `name`;
  - `category` from its `group`;
  - `isMain`;
  - for a value whose selection has an `imageUrl`: `displayValue` from the selection's `name`, and
    `additionalData: [{ type: "Image", category: "AttributeValueImage", downloadUri }]`.

  A value without an image gets no `displayValue` (library behaviour).

The parameter is optional. A library that does not take it ignores a fourth argument, so passing it
is compatible with every library.

### 3.2 The Order Data Path in roomle-ui

Every order the planner builds goes through one wrapper:

| Step | Code |
|---|---|
| The library loader fetches the master data and the calc script together and keeps the master data on the `LibraryData` | `homag-intelligence.ts:145-159` (`_loadLibraryData`), `:319-335` (`_requestHiLibrary`) |
| The wrapper calls the library with three arguments | **`homag-intelligence.ts:188-194`** |
| The `LibraryData` interface declares three parameters | `glue-logic.ts:101-105` |
| The only caller builds the scene groups and rooms and calls the wrapper | `glue-logic.ts:1417-1451` (`getGroupDataForOrder`) |
| The price request (`fetchPrice`, the `get-price` tool) | `orders.ts:165-174` |
| A plan snapshot with order data (the snapshot API, the `get-order-data` tool) | `roomle-planner.ts:1746`, order data at `:1801`; `tool-executors.ts:686-697` |
| Placing an order (`placeOrder` → `saveExternalObjectSnapshot`) | `orders.ts:176-208`, `roomle-planner.ts:1857`, order data at `:1882` |

The master data roomle-ui holds is the JSON of the library's `masterData` endpoint, exactly as
loaded (`onLoadMasterData: (libraryId) => Promise<MasterData>`, `packages/common/src/hi/hi-types.ts:64`).
Its `attributes` are an array (`MasterData`, `oc-scripts-domain.model.ts:479-484`), the shape that
the library's `masterData.attributes.find` expects. The glue logic reads it the same way
(`glue-logic.ts:1178`).

## 4. Root Cause

`packages/web-sdk/packages/homag-intelligence/src/homag-intelligence.ts:193`:

```ts
return libraryExports.getOrderData(groupData, roomlePlannerId, rooms);
```

The wrapper does not pass the fourth parameter of the library API. Its closure already holds the
master data of the same library (`masterData`, `homag-intelligence.ts:145`). The wrapper was
extended for the rooms (`0770775835 fix: pass room information to getOrderData`), but never for the
master data.

## 5. Why the Current Code Produces Wrong Results

The library treats the master data as optional. Without it, the library returns the attributes with
their technical ids and raw values only. The HOMAG price service and order system therefore get no
display names, categories, main flags, display values or value images for the group and root
attributes, although the library provides them.

## 6. Proposed Fix

In the wrapper of `_loadLibraryData`, pass the master data the loader already holds:

```ts
getOrderData: (
  groupData: PosGroup[],
  roomlePlannerId?: string,
  rooms?: PosContour[],
): any => {
  return libraryExports.getOrderData(
    groupData,
    roomlePlannerId,
    rooms,
    masterData,
  );
},
```

- The `LibraryData` interface (`glue-logic.ts:101-105`) and its only caller (`glue-logic.ts:1440`)
  stay as they are. The master data belongs to the `LibraryData` already, and the wrapper passes
  its own. `glue-logic.ts` is not changed.
- `onLoadMasterData` is typed `Promise<MasterData>`, so the wrapper needs no null handling.
- No embedding-lib build is needed: `homag-intelligence` is part of the planner (web-sdk).

**Unit test.** No roomle-ui test covers the wrapper of `homag-intelligence.ts`. A new
`__tests__/homag-intelligence-test.ts` constructs `HomagIntelligence` with a planner stub
(`setHomagIntelligence`, `callbacks`, `loadExternalObjectMasterData`) and stubs the public
`_requestHiLibrary` to return master data and library exports whose `getOrderData` is a spy. The
test calls `loadLibrary`, then calls
`getGlueLogic().getLibraryData(libraryId).getOrderData(groups, planId, rooms)` and expects the spy
to receive the master data as its fourth argument. The `getGroupDataForOrder` tests in
`glue-logic-test.ts` (around lines 6900-7035) spy on `LibraryData.getOrderData` and stay unchanged.

**Documentation.** The order data section of roomle-ui `.agents/homag-intelligence.md` (around
line 165) gets one sentence: the wrapper passes the library's master data, so the group and root
attributes carry the library's display information.

### 6.1 Rejected Alternative

Extend `LibraryData.getOrderData` with a `masterData` parameter and pass
`this.getLibraryData(libraryId)?.masterData` in `getGroupDataForOrder`, the way `solveInitial` gets
it from its caller. This changes the interface, `LibraryDataMock` (`__tests__/__mocks__.ts`), the
glue-logic call site and four test expectations, and the result is the same. The wrapper already
holds the master data of exactly that library.

## 7. Open Question: The Value Images in the Agent's `get-order-data` Result

The `get-order-data` tool returns the order data of the snapshot to the agent
(`tool-executors.ts:686-697`). It is serialised with `withoutImageUrls` (`hi-mcp-server.ts:90-102`,
decision D7 of roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`), which strips the
`imageUrl` keys only, because no agent can open signed CDN URLs. The library puts the value images
under `additionalData[].downloadUri`, so with the master data, every attribute value with an image
adds a signed URL to the agent's result.

To measure the effect, the library's `mapAttribute` was applied offline, with the Furniture_Smith
master data (`docs/library-information/master-data.json`), to the order data of two gpt-6-astra
runs of 2026-10-28. Each plan has about 700 root attributes, 264 of them with a value image. The
table gives the size of the compact JSON the agent receives:

| Order data the agent receives | 55 four cabinets | 14 add one unit |
|---|---|---|
| Today | 101 KB | 81 KB |
| With the master data, filter as today | 252 KB (+150 %) | 233 KB (+188 %) |
| With the master data, filter also strips `downloadUri` | 169 KB (+67 %) | 150 KB (+85 %) |

The request body to the HOMAG price service grows the same way. HOMAG asks for that content, so
this is intended.

Two options:

- **(a) Pass the order data through as today.** The agent's result grows by about 150 % or more. One
  test prompt asks for order data, and the agent calls the tool only when the user asks for it.
- **(b) Extend D7: `withoutImageUrls` also strips `downloadUri`.** The reason of D7 applies to
  these URLs as well. This also removes the article images (`ArticleImage`) of today's order data
  from the agent's result, and every `downloadUri` of other results, such as the price result if it
  carries one. It changes `hi-mcp-server.ts`, its test `it('returns tool results as compact JSON
  without image URLs')` and the D7 row.

**Recommendation: (b).** The ticket asks only for the master data, so (b) needs the review's go.

## 8. What the Work Touches

| Repository | File | Change |
|---|---|---|
| roomle-ui | `packages/web-sdk/packages/homag-intelligence/src/homag-intelligence.ts` | pass `masterData` to `libraryExports.getOrderData` |
| roomle-ui | `packages/web-sdk/packages/homag-intelligence/__tests__/homag-intelligence-test.ts` | new: the wrapper passes the master data |
| roomle-ui | `.agents/homag-intelligence.md` | the order data carries the library's display information |
| roomle-ui (option b) | `src/hi-mcp/hi-mcp-server.ts`, `__tests__/hi-mcp/hi-mcp-server-test.ts`, `.agents/homag-intelligence/hi-tools-behaviour.md` (D7, §8), `.agents/homag-intelligence/tool-executors.md` | `withoutImageUrls` also strips `downloadUri` |
