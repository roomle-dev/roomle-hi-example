# Feature Analysis: The AI Chat Window in the ligna-store

**Status**: Implemented

Implemented differently from the design below, as decided in review: the Vercel AI SDK runs in the store page (`ligna-store/hi-mcp/chat.ts`, `chat-window.ts`, `chat-options.ts`), calling Mistral and the Foundry endpoint directly (both allow browser CORS) and the tools at `<mcp_server>/mcp`. The only server change is CORS for `/mcp` (`hi-mcp-poc-json/server.ts`). Found in the live check: the bridge hello announced the page URL with `api_key` (now stripped), the layout focus guard took focus from the chat input (now exempted), and `@ai-sdk/mcp` needs a bound `fetch` in the browser. Verified live with `mistral-large-latest` and `gpt-5-mini` against a local MCP server. Deployed to Cloudflare from the branch on 2026-09-30 (`npx wrangler deploy`, version `cbd49da3`): the live `/mcp` answers the preflight with `204` and the page origin, and the store chat with `gpt-5.4-mini` against `https://hi-mcp-poc.hi-orchestrator.workers.dev` answered from `get-plan-context`. A browser that had the page from before the deploy kept failing with "Failed to fetch" until its cache was cleared.

**Date**: 2026-09-30

**Branches**: `feat/hi-mcp-chat-in-ligna-store` (roomle-hi-example), `feat/hi-mcp-chat-window` (ligna-store)

## What was asked and why

The ligna-store should get the same chat window as the HI presets example
(`minimal-hi-example/index.html`). The chat uses the Vercel AI SDK the way the example does. The
store shows the window only when all four of these URL parameters are set:

| Parameter | Value |
| --------- | ----- |
| `store.stage` | `INT` |
| `model` | one of `gpt-5-mini`, `gpt-5.4-mini`, `mistral-large-latest`, `mistral-medium-latest` |
| `api_key` | the provider API key for that model |
| `mcp_server` | the MCP server, e.g. `https://hi-mcp-poc.hi-orchestrator.workers.dev` |

Example:

```text
https://www.roomle.com/t/ligna-store-test/?store.stage=INT&model=mistral-large-latest&api_key=<key>&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev
```

Most of the implementation should live in `hi-mcp`. The store should hold as little as possible.

Why: the chat already makes the example a self-contained demo, with no Claude Code or Copilot
needed. The store is the deployed client of the Cloudflare MCP server. With the chat window, the
store becomes the same kind of demo: a sales configurator where the kitchen is planned by
prompting. That is the target product ([`../README.md`](../README.md), Purpose).

Assumption: the request says "the minimal example in the roomle-ui". roomle-ui has no chat window,
so the window meant is the one in `minimal-hi-example/index.html` of this repository.

## How it works today

### The chat in the example

- **UI**: the overlay markup `#chat-overlay`
  ([`index.html:379-405`](../../minimal-hi-example/index.html#L379-L405)), its CSS
  ([`index.html:141-297`](../../minimal-hi-example/index.html#L141-L297)) and `startChat`
  ([`index.html:1252-1373`](../../minimal-hi-example/index.html#L1252-L1373)). The page keeps
  the conversation, sends all of it with every turn to `http://localhost:<chat_port>/chat`, and
  reads the plain text stream. `[tool] <name>` lines go to the status line. The answer is rendered
  as markdown with `marked` and `DOMPurify`, which are imported from unpkg at runtime. The window
  opens with `?chat=true`. Its header button collapses it. The **Show panel** checkbox switches
  between the chat and the debug panel.
- **Backend**: the `hi-mcp/hi-mcp-chat` package runs as a process of its own on
  `127.0.0.1:3200`. `minimal-hi-example/start.mjs` starts it with `npm start <provider> <key>`.
  - [`chat-config.ts`](../../hi-mcp/hi-mcp-chat/chat-config.ts) reads the provider and the key
    from the environment (`HI_CHAT_PROVIDER`, `HI_CHAT_TOKEN`). `resolveChatModel` already
    resolves all four requested models:
    - `mistral-large-latest` and `mistral-medium-latest` → Mistral, passed through by the
      `mistral*` rule;
    - `gpt-5-mini` and `gpt-5.4-mini` → Azure, the `FOUNDRY_DEPLOYMENTS` on
      `FOUNDRY_BASE_URL`.
  - [`chat-handler.ts`](../../hi-mcp/hi-mcp-chat/chat-handler.ts) handles CORS, `/health` and
    `POST /chat`. It returns 503 when no key is configured.
  - [`chat-server.ts`](../../hi-mcp/hi-mcp-chat/chat-server.ts) builds the model
    (`getLanguageModel`) and `streamChat`: an `@ai-sdk/mcp` client to `HI_MCP_URL`, then
    `streamText` with `stopWhen: stepCountIs(8)`, streamed as text with the `[tool]` lines. It
    also starts the HTTP server.

  **The key is process-wide.** One backend serves one key and one model, and it listens on
  loopback only.

### The ligna-store

- It is a static Nuxt SPA: `ssr: false` and nitro `preset: 'static'`
  (`ligna-store/nuxt.config.ts`). It is deployed as static files, to gh-pages or behind the
  basic-auth `server.js`. **The store has no backend** that could hold a key or run the AI SDK.
- `components/blocks/Planner.vue:250-256` starts the MCP browser bridge when
  `params.store?.stage === 'INT'`. `mcp_server` points the bridge at a remote server, and
  `mcp_session` routes to a Cloudflare container of its own. `params` comes from
  `getQueryParams()` (`utils/init-data.ts`), which turns dotted keys into objects:
  `store.stage` becomes `params.store.stage`.
- `ligna-store/hi-mcp/` holds a verbatim copy of `hi-mcp-poc-json-client/browser-bridge.ts` and
  `types.ts`, synced by hand ([`hi-mcp-poc-json-client/README.md`](../../hi-mcp/hi-mcp-poc-json-client/README.md)).
- The planner is `#rml-planner` (`Planner.vue:418-433`): absolute, `z-[1000]`, white background.
  A white price bar, 370 × 73 px, sits at its bottom left.

### The MCP server and its Cloudflare deployment

- [`hi-mcp-poc-json/server.ts`](../../hi-mcp/hi-mcp-poc-json/server.ts) answers only `/mcp`
  (HTTP) and `/bridge` (WebSocket upgrade, origin-checked against `pageOrigins`, which already
  include `https://www.roomle.com`). Every other path gets a 404.
- [`cf/src/worker.ts`](../../hi-mcp/cf/src/worker.ts) forwards only `/mcp` and `/bridge` to the
  container of `?session=` (default: `default`). The container
  ([`cf/Dockerfile`](../../hi-mcp/cf/Dockerfile)) installs and runs only the
  `hi-mcp-poc-json` workspace.

## The gap

1. **No reachable chat backend.** The store is static, and the deployed MCP server has no
   `/chat`. The only chat backend is the local loopback process, and it is fixed to one key from
   its environment.
2. **Credentials per request.** The key and the model come from the page URL, so the backend must
   take them from each request, not from its environment.
3. **The chat and the bridge must share one session.** The chat's tool calls must reach the
   planner of the page that sent the prompt. On Cloudflare, that page's bridge lives in the
   container of its `mcp_session`.
4. **No reusable chat window.** The window exists only as inline code in `index.html`, tied to the
   example's debug panel and its CDN imports.

## Proposed design

### Overview

```text
[ligna-store page: store.stage=INT & model & api_key & mcp_server]
  ├── MCP browser bridge (unchanged)            ── wss://<mcp_server>/bridge?session=…
  └── Chat window (copy of hi-mcp-chat-client)  ── POST https://<mcp_server>/chat?session=…
                                                     Authorization: Bearer <api_key>
                                                     { model, messages }
                │
[Cloudflare Worker] ── /mcp, /bridge, /chat → container of ?session=
                │
[container: hi-mcp-poc-json server.ts]
  ├── /bridge  → PageBridge
  ├── /mcp     → HI MCP tools
  └── /chat    → hi-mcp-chat handler: streamText(model from the request, key from the header)
                   └── @ai-sdk/mcp client → http://127.0.0.1:<own port>/mcp  (same process, same page)
```

### 1. `/chat` on the MCP server itself (hi-mcp)

The MCP server serves `POST /chat` (and its `OPTIONS` preflight) next to `/mcp` and `/bridge`.
The chat's MCP client connects to the server's own `/mcp` on loopback. This solves gap 1 and
gap 3 together:

- The chat endpoint is always `<mcp_server>/chat`, so no fifth URL parameter is needed. The same
  URL works for the Cloudflare deployment and for a local `mcp_server=http://localhost:3100`.
- The chat and the bridge run in one process. The tools always reach the page connected to
  that process, which is the one of the `mcp_session` container.

Changes in `hi-mcp-chat`:

- **`chat-stream.ts`** (new) gets `getLanguageModel` and `streamChat` from `chat-server.ts`. It
  exports `createStreamChat(mcpUrl)`, whose `StreamChat` takes
  `(messages, { chatModel, apiKey })` for each call. `chat-server.ts` keeps only the standalone
  listener and passes its environment key and model into every call. The example's local
  launcher behaves exactly as before.
- **`chat-handler.ts`** gets a request-credentials mode. The standalone listener keeps its
  current behaviour. The MCP server mounts the handler in request-credentials mode:
  - The key comes from `Authorization: Bearer <api_key>`. Without one, the handler answers 401.
  - The model comes from the body field `model`. The handler accepts only the four store models
    (`STORE_CHAT_MODELS` in `chat-config.ts`, resolved through `resolveChatModel`). Any other
    model gets a 400. The allow-list keeps the endpoint from being an open proxy to any provider
    or Azure resource.
  - CORS uses the MCP server's `pageOrigins`. The preflight must now also allow the
    `Authorization` header.
  - The key is never logged. Today's logs contain only counts, tool names and durations. Keep it
    that way, and cover it with a test.
- **`server.ts`** (hi-mcp-poc-json) routes `pathname === '/chat'` to that handler. Today it
  checks `request.url?.startsWith('/mcp')`; `/chat?session=…` is added the same way. The loopback
  MCP URL comes from `serverPort`, over `https` when TLS is configured. `hi-mcp-poc-json` gains
  the workspace dependency on `hi-mcp-chat` and, with it, the AI SDK packages. Those packages
  are already locked in the workspace.

### 2. Cloudflare

- **`cf/src/worker.ts`** forwards `/chat` to the container of `?session=`, the same as `/mcp`.
  Extend `cf/tests/worker.test.ts` to cover it.
- **`cf/Dockerfile`** also copies `hi-mcp-chat/package.json` and the `hi-mcp-chat` sources, and
  installs `--workspace hi-mcp-poc-json --workspace hi-mcp-chat`.
- **Streaming**: the chat stream must pass through the Worker and the Durable Object without
  being buffered. Check this in the live test: the tool status lines must appear while the tools
  run, not at the end. The existing `/mcp` responses are JSON (`enableJsonResponse`), so nothing
  proves streaming yet.

### 3. The chat window as a page module (hi-mcp)

This is a new folder, `hi-mcp/hi-mcp-chat-client/`, the page side of the chat. It mirrors
`hi-mcp-poc-json-client/`:

| File | Responsibility |
| ---- | -------------- |
| `chat-window.ts` | The chat window of the example, with no framework and no dependencies. See the list below. |
| `README.md` | What the store copies, and the sync rule |
| `tests/chat-window.test.ts` | Tests of the pure functions (parameter gating, URL resolution, stream splitting, request shape with a stubbed `fetch`) |

`chat-window.ts` contains:

- `resolveChatWindowOptions(params)`: returns `{ model, apiKey, chatUrl }` only when all four
  parameters are valid, and `undefined` otherwise. A missing or invalid parameter is named in a
  `console.warn`, for example an unknown model with the list of accepted ones. The same
  `CHAT_MODELS` list is kept in the server.
- `resolveChatUrl(mcpServer, sessionId)`: returns `<mcp_server>/chat?session=…`. It strips a
  trailing slash and a trailing `/mcp`, and turns `ws(s)` into `http(s)`, like the bridge
  normalizes its URL.
- `splitStreamText(raw)`: the `[tool]` line split from `index.html`.
- `startChatWindow(host, options)`: builds the overlay from the example's markup and CSS. It
  injects one `<style>` element and keeps the example's ids and class names. The header button
  collapses the window. It holds the conversation, streams `POST /chat`, and shows the tool status
  line.
- `renderMarkdown` is a parameter of `startChatWindow`, so the module stays free of dependencies.
  The host passes `(text) => DOMPurify.sanitize(marked.parse(text, { breaks: true }))`.

The example's **Show panel** mutual exclusion with its debug panel is not part of the module. The
store has no debug panel.

`hi-mcp/package.json` typecheck and `vitest.config.ts` include the new folder. Its
`tsconfig.json` needs the `DOM` lib; check what `tsconfig.base.json` provides.

### 4. The ligna-store (kept small)

- `hi-mcp/chat-window.ts`: a verbatim copy of `hi-mcp-chat-client/chat-window.ts`.
- `components/blocks/Planner.vue`: inside the existing `store.stage === 'INT'` block, after the
  bridge starts:

  ```ts
  const { resolveChatWindowOptions, startChatWindow } = await import('~/hi-mcp/chat-window');
  const chatOptions = resolveChatWindowOptions({ ...params, sessionId: params.mcp_session });
  if (chatOptions) {
    const [{ marked }, { default: DOMPurify }] = await Promise.all([import('marked'), import('dompurify')]);
    startChatWindow(chatHost.value!, { ...chatOptions, renderMarkdown: … });
  }
  ```

  Add a `chatHost` element inside `#rml-planner`, so the window moves with the planner when it
  slides out.
- `package.json`: add `marked` and `dompurify`. They load in a lazy chunk only when the chat is
  enabled. Do not import from unpkg at runtime: the store is a production bundle, and remote code
  from a CDN should not run in the shop page.
- `hi-mcp/README.md`: add the chat parameters and the sync rule for `chat-window.ts`.

### 5. Documentation

- [`minimal-hi-example/docs/ai-chat.md`](../../minimal-hi-example/docs/ai-chat.md): add a new
  section on the chat in the ligna-store. It covers the URL parameters, `/chat` on the MCP server,
  and credentials per request.
- [`hi-mcp/docs/cloudflare-mcp-server.md`](../../hi-mcp/docs/cloudflare-mcp-server.md) and
  [`../skills/hi-mcp-cloudflare-deployment.md`](../skills/hi-mcp-cloudflare-deployment.md): the
  `/chat` route, and a store URL with the chat.
- [`../skills/vercel-ai-sdk-chat.md`](../skills/vercel-ai-sdk-chat.md): its "Local wiring" section
  says the key never comes from a URL parameter. The store is the exception to that rule, and the
  section must say why.
- [`../README.md`](../README.md): add this document to the index.

## Security: the API key in the URL

The request puts the provider key in the store URL. This deliberately drops the example's rule
"never in the URL, never in the page". The key is visible:

- in the browser history and in every shared or bookmarked link;
- in the access logs of the store host (`www.roomle.com/t/ligna-store-test`), because the query
  string is part of the request;
- in the page's JavaScript. That cannot be avoided once the page sends the key.

The key does **not** leak through the `Referer` of cross-origin requests. The browser default
`strict-origin-when-cross-origin` sends only the origin.

The design limits the exposure from there on:

- The key goes to `/chat` in the `Authorization` header, never in its URL. The Worker and the
  container logs therefore never see it.
- The server keeps nothing: the key lives for one request.
- The model allow-list keeps the endpoint from reaching arbitrary providers.

This is acceptable for the INT stage demo it is meant for. It is not acceptable for a production
store. Before production, the key must move to a server-side secret, for example a Worker secret
per model.

## Alternatives considered and rejected

| Alternative | Why rejected |
| ----------- | ------------ |
| Run the Vercel AI SDK (`streamText`, `@ai-sdk/mcp`) in the store page | The chat logic would live in the store, not in hi-mcp. The store would need the whole AI SDK. The provider APIs and `/mcp` would have to accept browser CORS, which is unverified for the Foundry endpoint. It differs from the example's backend. |
| Run `hi-mcp-chat` as a second process in the container, with the Worker routing `/chat` to a second port | Locally, the chat would not be at `<mcp_server>/chat`, so the store would need a fifth parameter. The container would need a two-process start. |
| Run the chat in the Cloudflare Worker (the AI SDK runs on Workers) | It would be a second chat implementation next to `hi-mcp-chat`. Local development and the deployment would differ. |
| A Vue chat component in the ligna-store | It puts the implementation in the store, which contradicts "mainly in hi-mcp". Other hosts could not reuse it. |
| The key as a query parameter of `/chat` | It would land in the Worker and container request logs. |
| Replace the example's inline chat with the new module | The example has no build step. That change is not requested, so it is a follow-up. |

## Open questions for the review

1. **Remove `api_key` from the address bar** after it is read (`history.replaceState`)? This
   keeps it out of links copied later, but a reload then loses the chat. **Proposal**: no, not
   for this PoC. The link is the way to open the demo.
2. **Look**: the example's window is translucent grey with white text. Over the store's white
   planner, white text may be hard to read. **Proposal**: take the example's CSS unchanged and
   check it in the store. Darken only the background if it is unreadable.
3. **Position**: the example sits at `bottom: 20px; left: 75px`, which would cover the store's
   price bar. **Proposal**: bottom left, above the price bar (`bottom: 93px`). The host sets the
   position through the host element, and the module keeps no position of its own.
4. **Should `/chat` be served always**, or only behind an environment flag? **Proposal**: always.
   It costs nothing without a key, and every call needs a key from the caller.

## Implementation plan and verification

1. **hi-mcp-chat**: extract `chat-stream.ts`, add request credentials to the handler, add
   `STORE_CHAT_MODELS`.
   - Verify: the unit tests pass. New tests cover:
     - bearer key and model taken from the request;
     - 401 without a key;
     - 400 for a model outside the allow-list;
     - `Authorization` allowed in the preflight;
     - the key never logged.

     The existing standalone tests stay green.
2. **server.ts**: mount `/chat` with a loopback MCP URL.
   - Verify: a server test posts to `/chat` with a stubbed `StreamChat` and gets the stream.
     `/mcp` and `/bridge` behave as before.
3. **cf**: add the `/chat` route in the Worker and install `hi-mcp-chat` in the Dockerfile.
   - Verify: the worker test for `/chat` with `?session=` passes, and `docker build` of the image
     succeeds.
4. **hi-mcp-chat-client**: add `chat-window.ts` and its tests.
   - Verify: the unit tests for gating (every missing or invalid parameter), URL resolution,
     stream splitting and request shape pass. `npm run typecheck` passes.
5. **ligna-store**: copy `chat-window.ts`, wire `Planner.vue`, add `marked` and `dompurify`,
   update the README.
   - Verify: `npm run lint` and `npm run build` pass. Locally, the store with all four
     parameters and `mcp_server=http://localhost:3100` shows the window. With any one parameter
     missing, it shows none. A prompt runs `get-plan-context` and a group change through the local
     MCP server.
6. **Deploy and live check**: `npx wrangler deploy`, then the store URL with a real key for one
   Mistral model and one Foundry model.
   - Verify: the tool status lines stream while the tools run, the plan changes in the page, and
     the key appears in no `wrangler tail` line.
7. **Documentation** as listed above, then close out this analysis.

## Code and documents the work would touch

- roomle-hi-example:
  - `hi-mcp/hi-mcp-chat/`: `chat-config.ts`, `chat-handler.ts`, `chat-server.ts`, new
    `chat-stream.ts`, `package.json`, `tests/`
  - `hi-mcp/hi-mcp-poc-json/`: `server.ts`, `package.json`
  - `hi-mcp/hi-mcp-chat-client/` (new)
  - `hi-mcp/cf/`: `src/worker.ts`, `tests/worker.test.ts`, `Dockerfile`
  - `hi-mcp/package.json`, `hi-mcp/package-lock.json`, `hi-mcp/vitest.config.ts`
  - Documentation: `minimal-hi-example/docs/ai-chat.md`, `hi-mcp/docs/cloudflare-mcp-server.md`,
    `.agents/skills/vercel-ai-sdk-chat.md`, `.agents/skills/hi-mcp-cloudflare-deployment.md`,
    `.agents/README.md`
- ligna-store:
  - `hi-mcp/chat-window.ts` (new), `hi-mcp/README.md`
  - `components/blocks/Planner.vue`
  - `package.json`, `package-lock.json`
