# HI MCP tool logic in every client page

> **Type**: Refactoring Analysis
> **Domain**: hi-mcp: MCP server and reference client (roomle-hi-example), minimal example page,
> ligna-store client copy. Verified against the embedding-lib connector and the planner API (roomle-ui).
> **Trigger**: "The `hi-mcp/tool-executors.ts` in the ligna-store and the similar code in
> `minimal-hi-example/index.html`: is this code unavoidable? Is it needed on every client that
> communicates with the MCP server? Isn't there a way the server provides this code? Aren't these
> the endpoints the AI agent uses? Is this really the correct pattern for the hi-mcp approach?"
> The request asked for a detailed answer and alternative solutions.
> **Date**: 2026-09-29
> **Author**: AI Assistant
> **Status**: Done

> **Close-out (2026-09-29)**: Alternative A is implemented as planned. The roomle-hi-example
> changes are on branch `docs/hi-mcp-tool-logic-placement-analysis`; the ligna-store changes are
> on branch `refactor/hi-mcp-tool-logic-in-server`. The decision is recorded in
> [ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md).
>
> - The tool logic runs in the server. The pages execute only the five allow-listed planner
>   methods, over bridge protocol 2.
> - Verification: typecheck clean; 71 tests pass (56 in the five affected files, up from 46; the
>   pre-existing `cf` load failure is unchanged). All eight tools ran live through the real server
>   against the example page in headless Chrome.
> - Not verified here: the INT-stage ligna-store live, and the Cloudflare redeploy. See the
>   [report](#report).

---

## Executive Summary

The HI MCP server holds only the **contract** of its tools: names, descriptions, zod schemas and
the authoring rules. The **implementation** lives in whatever browser page is connected:
validation, composed planner calls, response shaping and agent hints. That page is currently a
copy of the same ~380 lines in three places: the ligna-store, the minimal example page, and the
reference client in this repository.

| Question | Short answer |
|---|---|
| Is the page code unavoidable? | **The bridge is. The tool logic is not.** The planner runs in the user's browser tab, and only the tab can open a connection to the server, so a small relay in the page is required. The tool logic is plain JavaScript over the JSON that five planner methods return. None of it needs the browser. |
| Is it needed on every client? | **Today, yes:** about 380 lines of tool logic and about 170 lines of bridge and types per client. It should shrink to a single call per client. |
| Can the server provide it? | **Not by shipping code into the page**, which would let a remote server run arbitrary code in the shop page. **Yes, by owning the logic** and asking the page only for primitive, allow-listed planner calls. |
| Aren't these the agent's endpoints? | **Yes, and that is what makes the design odd.** Each executor *is* the implementation of an MCP tool. The server is a façade whose behaviour depends on which copy of the code the connected page happens to run. |
| Is this the correct pattern? | **The reverse connection is correct. Putting the tool implementations into every host page is not.** It was a reasonable PoC shortcut, and it is already producing drift. It should not become the shape of the npm package that sales configurators are meant to embed. |

**Recommendation:**

1. **Now (A):** move the tool logic into the MCP server. The page bridge becomes a generic,
   allow-listed relay for planner methods.
2. **Alongside (B):** move payload validation into the planner API, where it protects every caller.
3. **Product shape (C):** build the bridge into embedding-lib or the Rubens UI, so that a host
   enables it with one option and ships no HI MCP code of its own.

---

## Table of Contents

1. [How It Works Today](#1-how-it-works-today)
2. [Why It Is a Problem](#2-why-it-is-a-problem)
3. [The Five Questions, Answered in Detail](#3-the-five-questions-answered-in-detail)
4. [Target Layering](#4-target-layering)
5. [Alternatives](#5-alternatives)
6. [Comparison](#6-comparison)
7. [Recommendation and Sequence](#7-recommendation-and-sequence)
8. [Scope of Alternative A](#8-scope-of-alternative-a)
9. [Tests Covering the Affected Behaviour](#9-tests-covering-the-affected-behaviour)
10. [Output Changes to Expect](#10-output-changes-to-expect)
11. [Risks and Open Questions](#11-risks-and-open-questions)
12. [Report](#report)

---

## 1. How It Works Today

### 1.1 The call chain

```text
AI agent (Claude Code, Claude Desktop, hi-mcp-chat, ...)
  │  POST /mcp    tools/call create-or-replace-groups { posGroups }
  ▼
MCP server  hi-mcp/hi-mcp-poc-json          ← CONTRACT: name, description, zod schema, rules
  │  bridge.call('create-or-replace-groups', { posGroups })
  │  WebSocket /bridge   { kind: 'call', id, tool, args }
  ▼
host page  (ligna-store, index.html)         ← IMPLEMENTATION: validation, composition, hints
  │  toolExecutors['create-or-replace-groups'](roomDesignerApi, args)
  │    roomDesignerApi.extended.getExternalObjectPlanContext(['articles'])
  │    roomDesignerApi.extended.getExternalObjectPlanContext(['groups'])
  │    roomDesignerApi.extended.loadExternalObjectGroupLayout({ posGroups }, 'posGroups', { reason: 'adjusted' })
  │    roomDesignerApi.extended.getExternalObjectPlanContext(['groups'])
  │  postMessage   { message: 'extended.<method>', args }     (embedding-lib Connector)
  ▼
Rubens UI iframe   RoomlePlanner → HI glue logic → kernel
```

### 1.2 The server forwards; the page implements

Every tool handler on the server is a single forward,
`textResult(await bridge.call('<tool>', args))`. See
[`hi-mcp-server.ts`](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts): lines 118–119, 142–143, 191–198,
221–229, 239 and 249–252. Two tools are exceptions:

- `get-authoring-rules` returns static text (lines 156–158).
- `get-plan-images` strips the data-URL prefix and builds MCP image content (lines 264–284).

The `posGroups` input schema is `z.array(z.record(z.string(), z.unknown()))` (lines 183–188), so the
server accepts any object. All of the actual payload validation happens in the page.

### 1.3 The three copies

| Copy | Location | Size | Tested | Runs in |
|---|---|---|---|---|
| Reference client | [`hi-mcp/hi-mcp-poc-json-client/`](../../hi-mcp/hi-mcp-poc-json-client/): `tool-executors.ts`, `browser-bridge.ts`, `types.ts` | 381 + 144 + 28 lines, TS | 23 unit tests in `tests/tool-executors.test.ts` | Nowhere. It is the copy source only. |
| Example page | [`minimal-hi-example/index.html`](../../minimal-hi-example/index.html), lines 1045–1482 | about 440 lines of inline JS | No | The local example (`npm start`) |
| ligna-store | `ligna-store/hi-mcp/`: `tool-executors.ts`, `browser-bridge.ts`, `types.ts` | 381 + 144 + 28 lines, TS | No. Also excluded from lint (`ligna-store/.eslintignore:9`). | The INT-stage store and the Cloudflare try-out |

The store starts its copy in `ligna-store/components/blocks/Planner.vue:244-255`. The copy is kept
in sync by hand (`ligna-store/hi-mcp/README.md`, "Provenance and sync"). Since 2026-09-26 the
ligna-store history has two commits named "sync the hi-mcp client …" (`26c094a`, `a83b071`).

### 1.4 What the executors actually need from the browser

| Tool | Planner methods it calls | Page-side logic beyond the call |
|---|---|---|
| `get-plan-context` | `getExternalObjectPlanContext` | Default sections |
| `find-attributes` | `getExternalObjectPlanContext(['masterData'])` | Text search, 20-match limit, join to root modules |
| `create-or-replace-groups` | `getExternalObjectPlanContext` (3×), `loadExternalObjectGroupLayout` | About 120 lines of payload validation, payload sanitising (`toArticlePick`, field stripping), article-id check against the catalog, before/after group diff, "not positioned" hint |
| `update-attribute` | `updateExternalObjectGroupAttribute` | Argument order, `moduleId ?? null` |
| `get-price` | `fetchPrice` | None |
| `get-order-data` | `getExternalObjectSnapshot({ orderData })` | Picks `orderData` |
| `get-plan-images` | `getExternalObjectSnapshot({ perspectiveImage, topImage })` | Picks two fields |

**Five planner methods are all the tools need.** Everything else in the executors is pure
JavaScript over JSON. None of it touches the DOM, the scene or any browser API. The browser is
needed only to *reach* the planner.

### 1.5 `roomDesignerApi.extended` is already a generic RPC proxy

In roomle-ui, `Connector.handleSetup` (`packages/embedding-lib/src/connector.ts:70-109`) creates one
function per planner method name received in the embedding handshake. Each call is forwarded as
`messageHandler.sendMessage('extended.<method>', [...arguments])` (line 92). The method names come
from `RoomlePlanner.prototype` via `getMethodNames` (`roomle-embedding-lib.ts:67-82`).

So the host page sits between **two** RPC channels: a WebSocket from the MCP server and
postMessage to the Rubens iframe. The executors are glue logic placed in the middle of that relay,
in the one component that exists once per client.

### 1.6 How it got here

The PoC was copied from roomle-ui's `packages/embedding-lib/examples/hi-mcp-server`. In that demo,
the page, the planner and the executors formed one unit (see
[hi-mcp-poc-json.md](../feature-analysis/hi-mcp-poc-json.md)). At that time the executors also
carried geometry (`plan-space.ts`) and data shaping (`compactMasterData`). Two refactorings have
since pulled those out:

- [agent-ready-plan-context-in-glue-logic.md](agent-ready-plan-context-in-glue-logic.md) moved the
  data shaping into the planner API.
- [group-placement-via-repositioning-data.md](group-placement-via-repositioning-data.md) removed
  the page-side placement geometry.

Each refactoring had to be carried out three times, in two repositories. What remains in the page
is validation, composition and agent-facing wording. That is exactly the part the MCP server
should own.

---

## 2. Why It Is a Problem

### 2.1 The only deployed client already disagrees with the contract

Commit `c52aeca` (2026-09-29, "require posRotationY") made `posRotationY` mandatory:

- The server's authoring rules now say *"posRotationY is required, state 0 explicitly for no
  rotation"* (`AUTHORING_RULES` in `hi-mcp-server.ts`).
- The reference client and the example page reject a missing value
  ([`tool-executors.ts:257-261`](../../hi-mcp/hi-mcp-poc-json-client/tool-executors.ts#L257-L261),
  [`index.html:1297-1301`](../../minimal-hi-example/index.html#L1297-L1301)).
- `ligna-store/hi-mcp/tool-executors.ts:257` still accepts a missing value.

The store copy was held back on purpose until the repositioning change is tested locally (see the
progress note in [group-placement-via-repositioning-data.md](group-placement-via-repositioning-data.md)).
That was a reasonable decision. Even so, the result is that the only deployed client disagrees
with the contract the server publishes. This is the structural cost of the pattern, not a mistake
by anyone.

### 2.2 One tool fix means N files, two repositories, two languages, two release cycles

`c52aeca` touched four files in this repository, in TypeScript and in inline JavaScript. A fifth
change is still pending in the ligna-store. Every future client adds one more location.

### 2.3 Contract and implementation ship separately

The server is deployed on its own (locally, Azure, Cloudflare), and the store is deployed on its
own. This causes two kinds of failure:

- **A new tool reaches an older page** and fails with `Unknown tool: …`
  ([`browser-bridge.ts:110-118`](../../hi-mcp/hi-mcp-poc-json-client/browser-bridge.ts#L110-L118)).
- **A changed rule reaches an older page** and the page silently enforces the old rule, as in 2.1.

### 2.4 The tests cover the copy that runs nowhere

The 23 executor tests run against `hi-mcp-poc-json-client`. The two copies that actually run, the
example page and the ligna-store, have no tests.

### 2.5 The most-changed code has the slowest release path

The recent tool-logic history is mostly **agent tuning**: *"teach the agent to author a kitchen as
one docked group"* (`7394961`), *"anchor corner kitchens by the article corner point"* (`9955e56`),
*"require posRotationY …"* (`c52aeca`). Agent tuning is the most frequent kind of change in the
recent history, and much of it lands in the executors as validation and hint wording. That code
sits in the component with the most distributed, slowest release path: every host page.

### 2.6 It does not fit the stated deliverable

The goal stated in [`.agents/README.md`](../README.md) is *"an npm package that can be integrated
into sales configurators with HI context"*. With the current pattern, that package would hand every
integrator about 550 lines of code in the domain they know least: HI authoring rules and agent
wording. Every change to that code would then need an upgrade of the package in each configurator.

---

## 3. The Five Questions, Answered in Detail

### 3.1 Is this code unavoidable?

Separate the page code into its two parts.

**The bridge (transport): yes, some form of it is unavoidable in this architecture.**

- The planning session lives in the user's browser tab. The live scene is the point of the
  project, which is explicitly not headless (see the *Purpose* in [`.agents/README.md`](../README.md)).
- A server cannot open a connection into a browser tab. The tab has to dial out and keep the line
  open, which is what the WebSocket to `/bridge` does.
- Every system in which a server drives a user's live browser session has such a component. For
  example, browser-automation MCP servers that operate the user's real browser typically need a
  browser extension or a debugging connection on the user's side, for exactly this reason.

**The tool logic (executors): no.** About 380 of the roughly 550 page-side lines, all of
`tool-executors.ts`, are neither transport nor browser-dependent (section 1.4). They live in the
page only because the PoC was copied from a demo where the page was everything (section 1.6).

### 3.2 Is it needed on every client that talks to the MCP server?

**Today, yes.** Every client carries the full bridge *and* the full executors. A new sales
configurator would need a fourth copy.

A client really needs to contribute only three things:

1. the planner instance (`roomDesignerApi`),
2. the server URL and the session id,
3. the decision to enable the bridge (today: the `store.stage=INT` check or `?mcp=true`).

All three fit into one function call. Everything beyond that is duplicated server logic.

### 3.3 Isn't there a way the server provides this code?

There are two readings of "the server provides it":

- **The server ships the code to the page at runtime**, for example with
  `import('<server>/client.js')`. This is technically possible, but it is **not recommended**
  (alternative F). The MCP server, a cloud container, could then run arbitrary code inside the shop
  page with the user's session. The shop's CSP `script-src` would have to trust the MCP server. And
  the code running in the shop could no longer be reviewed or pinned with subresource integrity.
- **The server owns the logic and the page only executes primitive planner calls.** This is the
  **recommended** direction (alternative A). The server already knows which planner methods its
  tools need. It only needs a way to call them, and `roomDesignerApi.extended` is already a generic
  proxy for them (section 1.5).

### 3.4 Aren't these the endpoints the AI agent uses?

Yes, and that is the heart of the oddity. An MCP tool consists of a contract (name, description,
schema) and an implementation. Here they are split across machines, repositories and release
cycles:

- The agent reads its instructions from the server: `INSTRUCTIONS`, `get-authoring-rules`, the
  tool descriptions.
- The code that *enforces* those instructions, and writes the error messages the agent sees, runs
  in the page: *"Invalid pos groups - nothing was loaded …"*, *"Groups … are not positioned yet …"*.

The server therefore publishes promises it cannot keep on its own. In a typical MCP server, the
tools are implemented in the server and call a backend API. Here the "backend API" happens to be a
planner that is reachable only through the page. So the page should behave like an API endpoint:
generic, stable, few methods. It should not behave like a tool implementation.

This shows in the bridge protocol. Today it is **tool-level** RPC,
`{ kind: 'call', tool, args }` (`types.ts`). The target is **method-level** RPC,
`{ kind: 'call', method, args }`.

### 3.5 Is this really the correct pattern?

- **The reverse connection is correct.** The page dials out, and the server relays over that
  connection. This is necessary for live in-browser sessions and should stay.
- **Putting tool logic into every host page is not correct.** It was a reasonable way to get a PoC
  running from a single-page demo. It does not scale beyond one client, it has already caused drift
  (section 2.1), and it should not become the architecture of the npm package.

One nuance matters for the future. *Page-side tools are not wrong in themselves.* Emerging
standards such as WebMCP (alternative E) are built on pages that provide tools. What is wrong is
tool implementations **copied into every host page**, instead of living once in a product
component: the MCP server, or the Rubens planner itself.

---

## 4. Target Layering

| Layer | Owns | Changes when |
|---|---|---|
| **Planner API** (roomle-ui HI glue logic) | The HI data contract. Agent-ready plan context (already done). Validation of the `loadExternalObjectGroupLayout` payload, with structured errors. | The HI domain changes |
| **MCP server** (`hi-mcp-poc-json`) | Everything agent-facing: tool names, descriptions, schemas, authoring rules, the composition of planner calls, agent hints, error wording | The agent's behaviour is tuned. This is the most frequent change. |
| **Page bridge** (one per host, ideally none: see C) | Transport, and the allow-list of planner methods a remote server may call | Almost never |

The test for any piece of logic: *would a non-AI caller of the planner want it?* If yes, it
belongs in the planner API. *Is it worded for, or specific to, an agent?* Then it belongs in the
MCP server. *Neither?* Then it probably is transport.

---

## 5. Alternatives

### A. Thin page bridge, tool logic on the server (recommended next step)

The bridge protocol moves from tool-level to method-level. The page executes only allow-listed
planner methods. The server composes them into tools.

**Page side.** This replaces `toolExecutors` in every client:

```js
const PLANNER_METHODS = new Set([
  'getExternalObjectPlanContext',
  'loadExternalObjectGroupLayout',
  'updateExternalObjectGroupAttribute',
  'fetchPrice',
  'getExternalObjectSnapshot',
]);

socket.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  if (message.kind !== 'call') {
    return;
  }
  if (!PLANNER_METHODS.has(message.method)) {
    reply({ kind: 'result', id: message.id, ok: false, error: `Planner method not exposed: ${message.method}` });
    return;
  }
  try {
    const result = await roomDesignerApi.extended[message.method](...message.args);
    reply({ kind: 'result', id: message.id, ok: true, result });
  } catch (error) {
    reply({ kind: 'result', id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
```

**Server side.** The existing executors move over almost verbatim. Their signature
`(roomDesignerApi, args)` stays the same; the server passes in a planner API that is backed by the
bridge:

```ts
const createPlannerApi = (bridge: PageBridge) => ({
  extended: {
    getExternalObjectPlanContext: (include?: string[]) =>
      bridge.call('getExternalObjectPlanContext', [include]),
    loadExternalObjectGroupLayout: (layout: unknown, layoutType: string, options: unknown) =>
      bridge.call('loadExternalObjectGroupLayout', [layout, layoutType, options], SNAPSHOT_CALL_TIMEOUT_MS),
    // updateExternalObjectGroupAttribute, fetchPrice, getExternalObjectSnapshot likewise
  },
});

// in createHiMcpServer:
async ({ posGroups }) =>
  textResult(await toolExecutors['create-or-replace-groups'](plannerApi, { posGroups })),
```

**Key properties:**

- **The allow-list is the page's security boundary.** The page, which owns the session, decides
  what a remote server may do. Methods such as `placeOrder`, `loadPlanXml` or
  `saveExternalObjectSnapshot` stay out of reach. The typed `extended` object on the server is its
  counterpart, and both change only when a tool needs a new planner method.
- **Adding or changing a tool no longer touches any client**, unless the tool needs a planner method
  that is not yet allowed. Step 2 of *Adding New Tools* in [`AGENTS.md`](../../AGENTS.md) disappears.
- **The existing tests move with the code.** The executor tests already mock
  `roomDesignerApi.extended`, so they need no rewrite (section 9).
- **The page's `hello` message should carry a protocol version**, so the server can tell an old
  page to update instead of failing with an obscure error.

**Cost:**

- **Round trips.** `create-or-replace-groups` becomes four WebSocket round trips instead of one.
  Locally each takes about a millisecond. Through Cloudflare it is roughly one edge round trip each,
  small next to the planner's own load time. Snapshot calls may take up to 120 s.
- **Transfer.** The article catalog (`['articles']`, used for the article-id check) now crosses the
  WebSocket once per create call. It already crosses to the agent in `get-plan-context`. If it turns
  out to be large, alternative B removes the need for it.
- **Timeouts** become per planner method instead of per tool:
  `loadExternalObjectGroupLayout` and `getExternalObjectSnapshot` get the snapshot timeout.

**Pros:** one implementation, tested where it runs, deployed in one place. Clients shrink to the
bridge, which almost never changes: about 60 lines inline in the example page, and about 150 in the
store with its URL resolution and reconnect. No changes to roomle-ui are needed.

**Cons:** the bridge code still exists once per host. That is addressed by C.

### B. Move domain validation into the planner API (complementary)

The structural checks in `create-or-replace-groups` belong to the contract of
`loadExternalObjectGroupLayout(…, 'posGroups')`, whoever the caller is: the store UI, another
integration, or the agent. Examples: non-empty roots, unique root ids, no `articlePos` or
`rotationY`, every root docked, a valid `repositioningData`, and an `articleId` that exists in the
catalog.

- The planner would return **structured errors** such as `{ path, code, message }`. The MCP server
  maps them to agent wording, for example the pointer to `get-authoring-rules`.
- This continues the direction of
  [agent-ready-plan-context-in-glue-logic.md](agent-ready-plan-context-in-glue-logic.md): the
  planner delivers agent-ready data *and* rejects invalid layouts itself.
- It also removes the extra `['articles']` transfer from A.
- **Agent-specific wording must not move into the planner.** Text such as *"Fetch the payload
  format with the get-authoring-rules tool"* stays in the server.
- `find-attributes` can stay on the server. It could become a planner method such as
  `findExternalObjectAttributes` only if non-AI callers need it.

**Pros:** validation protects every caller, and the rules and the data sit side by side.
**Cons:** requires roomle-ui work and a release. This is a design change to the public planner API.

### C. Bridge built into embedding-lib or the Rubens UI (target product shape)

The host enables the bridge with one option. The bridge runs inside the Rubens UI iframe, where
`RoomlePlanner` lives:

```js
const roomDesignerApi = await RoomleConfiguratorApi.createPlanner(configuratorId, container, {
  ...initData,
  mcp: { serverUrl, sessionId },
});
```

- **No HI MCP code in any client.** The ligna-store, `index.html` and every future sales
  configurator shrink to the option above.
- The allow-list sits next to the planner methods it exposes, in one repository, versioned with
  them.
- The postMessage hop disappears, because the bridge calls the planner directly.
- The WebSocket origin becomes the Rubens UI origin for every host. That simplifies
  `HI_MCP_PAGE_ORIGINS`, but the origin no longer identifies the store. Routing then relies
  entirely on the session id, as the Cloudflare worker already does (`hi-mcp/cf/src/worker.ts`).
- **Needs:** a roomle-ui change and release; the Rubens UI CSP `connect-src` must allow the MCP
  server origins; and an explicit opt-in by the host. A host already fully controls its planner
  through the embedding API, so an opt-in bridge grants no new power over another user's session.
- **It can be reached step by step.** First publish the thin bridge from A as a small package,
  for example `@roomle/hi-mcp-bridge`, that the host imports. Move it into embedding-lib once the
  protocol has settled.

**Pros:** zero client code, and it matches the npm-package deliverable.
**Cons:** the largest effort, and it couples the PoC to the roomle-ui release cycle. Worth it once
the approach is decided, not before.

### D. Publish the current bridge and executors as an npm package (not recommended on its own)

- **Removes** the copy-paste. The example page could import it from unpkg, as it already imports
  the embedding-lib ([`index.html:325`](../../minimal-hi-example/index.html#L325)).
- **Keeps** the core problems: a tool change still needs a package release *and* an upgrade in
  every client, and version skew between the server and the page remains (section 2.3).
- **Worth it only for the thin bridge from A**, which is then the first step of C.

### E. Tool execution in the browser without the relay (variant for the in-page chat)

- For the chat *inside* the page (`hi-mcp-chat`), the LLM backend could hand tool calls to the
  browser. The Vercel AI SDK supports client-side tools: tools without an `execute` function that
  the chat UI runs and answers. That removes the WebSocket relay for the chat case.
  - The current chat uses a custom plain-text stream
    ([add-ai-chat-to-hi-example.md](../feature-analysis/add-ai-chat-to-hi-example.md)). It would
    need the AI SDK UI message stream protocol.
  - The tool logic would then run in the page again, which is only acceptable if it ships as one
    product component (C), not as a per-host copy.
- **External agents** such as Claude Code, Claude Desktop and Copilot still need the remote MCP
  endpoint, so the relay stays for them. E is a variant for one client, not a replacement.
- **WebMCP** is a proposal in the W3C Web Machine Learning Community Group. It lets pages register
  tools for agents built into the browser. It standardises exactly the "page provides the tools"
  model. It is early stage and not a basis for a product today, but it is worth watching. If it
  matures, the natural place to register the HI tools is again the Rubens planner (C), not each
  host.

### F. The server delivers the executor code to the page at runtime (rejected)

The page would `import()` the executors from the MCP server URL, so the code always matches the
server version. **Rejected:**

- the MCP server could run arbitrary code in the shop page;
- the shop's CSP `script-src` would have to trust the MCP server;
- the code running in the shop could not be reviewed or pinned with subresource integrity.

A solves the same version-skew problem without executing remote code.

### G. Headless planner on the server (rejected for this use case)

The server would run the planner itself, as the roomle-model-exporter's Planner MCP server does
inside its Cloudflare container (see
[mcp-cloudflare-containers-deployment.md](../feature-analysis/mcp-cloudflare-containers-deployment.md)).
Then no page code would be needed. **Rejected here:** it contradicts the purpose, which is editing
the live scene in the user's session. It would also need a way to sync the plan back into that
session.

---

## 6. Comparison

| | Code per client | Tool change needs a client release | Remote code in the shop | roomle-ui work | Effort |
|---|---|---|---|---|---|
| Today | about 550 lines | Yes, per client | No | No | – |
| **A** thin bridge, logic on server | bridge only: about 60 lines inline, about 150 in the store | No (only for a new planner method) | No | No | Small |
| **B** validation in planner API | unchanged by B | No | No | Yes | Medium |
| **C** bridge in embedding-lib / Rubens UI | 1 option | No | No | Yes | Large |
| D npm package of today's code | 1 import | Yes, via package upgrade | No | No | Small |
| E client-side tools (chat only) | the executors, again | Depends on where they live | No | No | Medium |
| F server-delivered code | 1 import | No | **Yes** | No | Small |
| G headless planner | 0 | No | No | No | Large; misses the purpose |

---

## 7. Recommendation and Sequence

1. **A: move the tool logic into the server; the pages become method relays.** This removes the
   drift class shown in section 2.1 for good. Doing A also resolves the pending ligna-store
   `posRotationY` sync, because that code leaves the store.
2. **B: move payload validation into `loadExternalObjectGroupLayout`**, with structured errors,
   when roomle-ui work is planned anyway. The next HI glue-logic change is a natural moment.
3. **C: ship the bridge in embedding-lib or the Rubens UI** as the npm-package deliverable. Start
   as a small bridge package; move it into embedding-lib once the protocol is stable.

Once an approach is decided, record it as an ADR in `.agents/decisions/`. This analysis is only a
historical record.

---

## 8. Scope of Alternative A

| Location | Change |
|---|---|
| [`hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts`](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts) | Handlers call the executors with the bridge-backed planner API instead of `bridge.call('<tool>')`; `create-or-replace-groups` keeps its schema |
| `hi-mcp/hi-mcp-poc-json/tool-executors.ts` (new, moved) | Moved from `hi-mcp-poc-json-client/tool-executors.ts`, code unchanged |
| `hi-mcp/hi-mcp-poc-json/planner-api.ts` (new) | Typed `extended` with the five methods, per-method timeouts |
| [`hi-mcp/hi-mcp-poc-json/page-bridge.ts`](../../hi-mcp/hi-mcp-poc-json/page-bridge.ts) | `call(method, args[], timeoutMs)`; log lines name the method |
| [`hi-mcp/hi-mcp-poc-json/types.ts`](../../hi-mcp/hi-mcp-poc-json/types.ts) and `hi-mcp-poc-json-client/types.ts` | `McpBridgeCall` carries `method` and `args: unknown[]`; `hello` carries `protocol` |
| [`hi-mcp/hi-mcp-poc-json-client/`](../../hi-mcp/hi-mcp-poc-json-client/) | `tool-executors.ts` removed; `browser-bridge.ts` becomes the generic relay with the allow-list; README updated |
| [`minimal-hi-example/index.html:1045-1482`](../../minimal-hi-example/index.html#L1045-L1482) | Executors removed; the inline bridge becomes the generic relay |
| `ligna-store/hi-mcp/` | `tool-executors.ts` removed; `browser-bridge.ts` and `types.ts` synced one last time; README updated |
| Docs | [`minimal-hi-example/docs/hi-mcp-server.md`](../../minimal-hi-example/docs/hi-mcp-server.md), [`.agents/skills/hi-mcp-server.md`](../skills/hi-mcp-server.md) (bridge protocol, *Adding New Tools*), [`.agents/skills/hi-mcp-tools.md`](../skills/hi-mcp-tools.md), *Adding New Tools* in [`AGENTS.md`](../../AGENTS.md) |

**Not touched:** roomle-ui, the tool names, descriptions, schemas and authoring rules, the
Cloudflare worker, and `hi-mcp-chat`, which remains a plain MCP client.

---

## 9. Tests Covering the Affected Behaviour

| Test | Today | After A |
|---|---|---|
| `hi-mcp-poc-json-client/tests/tool-executors.test.ts` (23 tests) | Executors against a mocked `roomDesignerApi.extended` | Moves to `hi-mcp-poc-json/tests/` unchanged; the mock shape stays |
| `hi-mcp-poc-json-client/tests/browser-bridge.test.ts` | URL resolution | Extended: allowed method is executed, disallowed method is rejected, errors are relayed |
| `hi-mcp-poc-json/tests/page-bridge.test.ts` | Call correlation, timeouts, page replacement | Adapted to `call(method, args[])` |
| `hi-mcp-poc-json/tests/hi-mcp-server.test.ts` | Tool forwards via a mocked bridge | Tools run the executors against a mocked bridge, end to end through the planner API |

Verify with `npm test` and `npm run typecheck` at the `hi-mcp` root. Then do one live round trip
with the example page (`npm start`) and one with the INT-stage store.

---

## 10. Output Changes to Expect

- **What the agent sees:** nothing changes. The tool names, schemas, results, error texts and
  hints stay identical, because the same code produces them, just on the other side of the socket.
- **Logs:** the page logs planner methods instead of tools, and the server logs both the tool and
  its planner calls. Debugging gets easier, because the whole tool flow is visible in one terminal.
- **Latency:** `create-or-replace-groups` gets three extra WebSocket round trips (section 5, A).
- **Old pages:** a page on the old protocol sends no protocol version in `hello`. The server can
  then answer tool calls with a clear "update the page bridge" error instead of an `Unknown tool`
  error.

---

## 11. Risks and Open Questions

- **Which planner methods may a remote agent call?** This is a product and security decision, not
  a technical one. The initial allow-list is the five methods from section 1.4. Methods that place
  orders or overwrite the plan (`placeOrder`, `loadPlanXml`, `saveExternalObjectSnapshot`) should
  need an explicit decision.
- **Arguments are passed through by position.** This is safe, because the arguments already have
  to survive postMessage structured cloning today. The server's typed `extended` object prevents
  mistakes in argument order.
- **Size of the catalog transfer** in the article-id check. Measure it with a real library; B
  removes the transfer.
- **Is the ligna-store integration the long-term product path or a PoC host?** The answer decides
  whether C is worth the roomle-ui investment, or whether A plus a small bridge package is enough.
- **Mutation of the payload:** the executors modify `args.posGroups` in place. On the server this
  is harmless, because the object is a parsed request. It is noted here because it is visible once
  the code moves.

---

## Report

### Summary of changes

Alternative A was implemented as planned (section 8), with decisions D1–D5 of the implementation
plan applied:

- **D1:** `createHiMcpServer` takes a `PlannerApi`; `server.ts` wires
  `createHiMcpServer(createPlannerApi(bridge))`.
- **D2:** the page's `hello` carries `protocol: 2` (`BRIDGE_PROTOCOL`). A page without it stays
  connected, but every call fails with an "update the page bridge" error.
- **D3:** the allow-list is exactly the five planner methods, and a contract test keeps the
  server's `PlannerApi` and the reference client's `PLANNER_METHODS` identical.
- **D4:** timeouts are set per planner method: 120 s for `loadExternalObjectGroupLayout` and
  `getExternalObjectSnapshot`, 30 s otherwise.
- **D5:** the rollout order is still to be carried out: roomle-hi-example first, then the
  Cloudflare redeploy, then the ligna-store.

The executors were moved with `git mv`. Their only code change is the parameter type
(`PlannerApi` instead of `RoomDesignerApiType = any`). The tool handlers call them through a
`runTool` helper that also logs the tool name. Tool names, descriptions, schemas, results, error
texts and hints are unchanged. The one visible change in error text: a timeout now reads
`Planner call '<method>' timed out after …ms` instead of `Tool call '<tool>' …`.

### Changed files

| Repository | Files |
|---|---|
| roomle-hi-example: server | `hi-mcp-poc-json/tool-executors.ts` (moved), `planner-api.ts` (new), `hi-mcp-server.ts`, `server.ts`, `page-bridge.ts`, `types.ts` |
| roomle-hi-example: page side | `hi-mcp-poc-json-client/browser-bridge.ts`, `types.ts`; `minimal-hi-example/index.html` (executor block removed: +21 / −388 lines) |
| roomle-hi-example: tests | `hi-mcp-poc-json/tests/tool-executors.test.ts` (moved, unchanged), `planner-api.test.ts` (new), `fake-page-socket.ts` (new helper, extracted from `page-bridge.test.ts`), `hi-mcp-server.test.ts`, `page-bridge.test.ts`; `hi-mcp-poc-json-client/tests/browser-bridge.test.ts` |
| roomle-hi-example: docs | `AGENTS.md`, `.github/copilot-instructions.md`, `.agents/skills/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`, `.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md` (new), `.agents/README.md`, `minimal-hi-example/docs/hi-mcp-server.md`, `ai-chat.md`, `hi-mcp-poc-presentation.md`, `hi-mcp/README.md`, `hi-mcp/docs/*` (five setup guides: "the server is only a relay" wording), `hi-mcp-poc-json/README.md`, `QUICKSTART.md`, `hi-mcp-poc-json-client/README.md` |
| ligna-store | `hi-mcp/tool-executors.ts` (deleted, −381 lines), `hi-mcp/browser-bridge.ts` and `hi-mcp/types.ts` (identical to the reference client), `hi-mcp/README.md`; `components/blocks/Planner.vue` unchanged |

### Before and after

| | Before | After |
|---|---|---|
| Tool logic | 3 copies: reference client, `index.html`, ligna-store | 1: `hi-mcp-poc-json/tool-executors.ts` |
| Page-side code per client | about 550 lines (ligna-store), about 440 lines inline (`index.html`) | bridge only: 187 lines with `types.ts` (ligna-store, with URL resolution and reconnect), 80 lines inline (`index.html`, including comments and the `mcp=true` gate) |
| Bridge protocol | tool-level `{ tool, args: {} }` | method-level `{ method, args: [] }`, versioned hello |
| What the server can make the page do | any tool the page implements | the five allow-listed planner methods |
| A tool change touches | 4 files in 2 repositories, 2 languages | the server only |
| The pending `posRotationY` drift (section 2.1) | ligna-store accepted a missing value | gone: the store no longer carries validation |

### Test adaptations

| File | Before → after |
|---|---|
| `hi-mcp-poc-json/tests/tool-executors.test.ts` | 23 → 23 (moved; the `createApi` mock already matched `PlannerApi`, no cast needed) |
| `hi-mcp-poc-json/tests/planner-api.test.ts` | 0 → 3 (forwarding with positional args, per-method timeouts, contract with `PLANNER_METHODS`) |
| `hi-mcp-poc-json/tests/hi-mcp-server.test.ts` | 9 → 10 (mock planner API instead of the bridge; new: invalid payload rejected in the server without a load; new: end-to-end wiring through a real `PageBridge`; the snapshot-timeout test moved to `planner-api`) |
| `hi-mcp-poc-json/tests/page-bridge.test.ts` | 9 → 10 (method-level calls; new: outdated page bridge rejected) |
| `hi-mcp-poc-json-client/tests/browser-bridge.test.ts` | 5 → 10 (new: hello protocol, allowed method executed, `placeOrder` rejected, planner error relayed, non-call messages ignored) |

The whole workspace went from 61 to 71 passing tests. `cf/tests/worker.test.ts` still fails to
load `@cloudflare/containers`, as it did before.

A mutation check confirmed that the new tests catch the failures they are meant for:

- Removing the page allow-list check fails the `placeOrder` test.
- Adding a sixth method to `PlannerApi` fails the contract test.

### Live verification

`node minimal-hi-example/start.mjs --no-open` ran the real launcher (build gate, :3000, :3100).
The example page was opened in headless Chrome and connected with protocol 2. An MCP SDK client
then called the tools over HTTP:

| Tool | Result |
|---|---|
| `get-plan-context` | OK: 6 walls, 111 articles, 0 groups |
| `find-attributes` (`front`) | OK: 12 matches |
| `create-or-replace-groups`, invalid payload | Rejected in the server, no planner call logged |
| `create-or-replace-groups`: `U2TB90` + `UHS60` docked `RightBottom → LeftBottom`, `repositioningData` at the back wall's end | OK: the group sits at `pos` [-685, 0, -3765], `rotationY` 0; both units docked; worktop and toe kick generated; no error log messages. The server log shows the four planner calls. |
| `update-attribute` (`mod_FrontColor` = `326`) | OK |
| `get-price`, `get-order-data` | OK |
| `get-plan-images` | OK: the perspective and top images show the row in the back-left corner |

### Risks and open items

- **INT-stage ligna-store live check:** open the store with `?store.stage=INT` against the local
  server and repeat the smoke test. Its bridge is byte-identical to the verified reference client
  and typechecks, but it has not run live.
- **Rollout order (D5):** redeploy the Cloudflare server with the new protocol before the
  ligna-store change is deployed. See `.agents/skills/hi-mcp-cloudflare-deployment.md`. Store pages
  still on the old bridge get the clear update error in the meantime.
- **Catalog transfer:** the article-id check now moves the article catalog across the WebSocket
  once per create call. This was not measurable in the live check (the local round trips were
  fast), and alternative B removes it.
- **Still open:** alternatives B and C, and the two product questions of section 11.
