# Feature Analysis: Start the HI Example with the Cloudflare-Hosted MCP Server

**Date:** 2026-10-01
**Status:** Implemented
**Branch:** `feat/start-example-with-cloudflare-mcp`

## What Was Asked and Why

Add a command in the root of roomle-hi-example that starts the minimal HI example
(`minimal-hi-example/index.html`) connected to the MCP server **hosted on Cloudflare**
(`https://hi-mcp-poc.hi-orchestrator.workers.dev`) instead of the local one on port 3100.

Today the deployed server is only reachable from the INT-stage ligna-store
(`&mcp_server=…`). With the command, the example page (and its built-in chat) can be used
to try out and check the deployed server without the store. The local MCP server does not have to
run.

## How the Area Works Today

### The launcher always starts a local MCP server

- `package.json` (root) forwards `start` and `dev` to the `minimal-hi-example` workspace;
  `minimal-hi-example/package.json` maps them to `node start.mjs` and `node start.mjs --dev`.
  `deploy:cf` (root) is the only Cloudflare script.
- [start.mjs:91-95](../../minimal-hi-example/start.mjs#L91-L95) builds `EXAMPLE_URL` with
  `mcp=true`, the backend and library, and `mcp_port` only when `HI_MCP_PORT` is set. It has no
  parameter for a remote server.
- [start.mjs:152-168](../../minimal-hi-example/start.mjs#L152-L168) always spawns
  `hi-mcp-server` on :3100; [start.mjs:219](../../minimal-hi-example/start.mjs#L219) calls it
  unconditionally.
- [start.mjs:170-176](../../minimal-hi-example/start.mjs#L170-L176) points the chat backend at
  `HI_MCP_URL=http://localhost:${MCP_PORT}/mcp`. The chat backend takes any URL
  ([chat-config.ts:100](../../hi-mcp/hi-mcp-chat/chat-config.ts#L100),
  [chat-server.ts:59-61](../../hi-mcp/hi-mcp-chat/chat-server.ts#L59-L61)), including a query
  string.

### The example page only knows a local bridge

- [index.html:1182-1184](../../minimal-hi-example/index.html#L1182-L1184):
  `bridgeUrl = ws://localhost:${mcp_port ?? 3100}/bridge`. The page reads neither
  `mcp_server` nor `mcp_session`.
- The ligna-store's page bridge already supports both (reference copy
  [browser-bridge.ts:37-70](../../hi-mcp/hi-mcp-client/browser-bridge.ts#L37-L70)):
  `mcp_server` is mapped from `https://` to `wss://` and gets `/bridge` appended, and
  `mcp_session` adds `?session=<name>`. The
  [setup matrix](../../hi-mcp/hi-mcp-server/README.md#the-setup-matrix-which-setup-needs-which-url-parameters)
  documents these parameters.

### The Cloudflare deployment

- [worker.ts:10-23](../../hi-mcp/cf/src/worker.ts#L10-L23) routes `/mcp` and `/bridge` to one
  container per `?session=` value, and to the shared container `default` when the parameter is
  missing. [wrangler.jsonc:13](../../hi-mcp/cf/wrangler.jsonc#L13) allows `max_instances: 5`, and
  a container sleeps after 15 minutes without requests.
- The container does not set `HI_MCP_PAGE_ORIGINS`, so the server uses its default list
  ([server.ts:19-28](../../hi-mcp/hi-mcp-server/server.ts#L19-L28)): `http://localhost:3000`,
  `http://127.0.0.1:3000` and `https://www.roomle.com`. The `/bridge` upgrade from any other
  origin is rejected ([server.ts:96-104](../../hi-mcp/hi-mcp-server/server.ts#L96-L104)).
- A new page `hello` closes the page that was connected before
  ([page-bridge.ts:29-36](../../hi-mcp/hi-mcp-server/page-bridge.ts#L29-L36)). Both pages
  reconnect 3 s after a close ([index.html:1234-1235](../../minimal-hi-example/index.html#L1234-L1235)),
  so **two pages on one session take the connection from each other every few seconds**.
- When no page is connected, the server tells the agent which URL to open: `HI_MCP_STORE_URL`. In
  the deployment this is the ligna-store URL
  ([wrangler.jsonc:20-24](../../hi-mcp/cf/wrangler.jsonc#L20-L24)), not the example URL.

### Checked against the live deployment (2026-10-01)

| Check | Result |
| ----- | ------ |
| `initialize` on `https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp` | `200`, 0.25 s (the container was awake) |
| `tools/list` deployed vs. `hi-mcp-server.ts` on master | the same 15 tools |
| bridge protocol | `BRIDGE_PROTOCOL = 2` on both sides (unchanged since 2026-09-29) |
| CORS preflight from `Origin: http://localhost:3000` | `204`, origin echoed back |
| CORS preflight from `Origin: http://localhost:3001` | `403` (the `/bridge` upgrade uses the same list) |

## The Gap

1. No command starts the example without the local MCP server.
2. The example page cannot connect to a remote bridge, because the bridge URL is hard-coded to
   `ws://localhost`.
3. Nothing chooses a session. Without a session the example would share the `default` container
   with everyone who uses the store with the handout URL. Because of the reconnect behavior above,
   the two pages would then take the connection from each other.

## Proposed Design

### 1. The command: `npm run start:cf`

The name follows `deploy:cf`. It is added in both places, like `dev`:

```jsonc
// package.json (root)
"start:cf": "npm run start:cf --workspace minimal-hi-example"
// minimal-hi-example/package.json
"start:cf": "node start.mjs --cf"
```

Chat arguments are passed on as with `npm start`: `npm run start:cf mistral <api-key>`. The flags
can be combined: `node minimal-hi-example/start.mjs --cf --dev` uses the Cloudflare server and the
local Rubens UI.

### 2. The launcher: `--cf` replaces the local server with the deployed one

In `minimal-hi-example/start.mjs`:

- a constant `CLOUDFLARE_MCP_SERVER_URL = 'https://hi-mcp-poc.hi-orchestrator.workers.dev'`
- the session is `os.userInfo().username` (see [Session](#session) below)
- with `--cf`:
  - `EXAMPLE_URL` gets `&mcp_server=<url>&mcp_session=<name>` (percent-encoded) instead of
    `mcp_port`
  - `startMcpServer()` is not called; `shutdown` kills only the processes it started
  - the chat backend gets `HI_MCP_URL=<url>/mcp?session=<name>`
  - the `➜  MCP:` line prints the same cloud URL, so an external MCP client (Claude Code,
    Le Chat) can be pointed at the same session
  - an `EXAMPLE_PORT` other than 3000 stops the launcher with a message, because the deployed
    server rejects the page origin and the bridge would only retry silently
- without `--cf`, nothing changes

The build gate (install and typecheck of `hi-mcp`) stays as it is. The chat backend needs the
install, and one code path is simpler than skipping it when there is no chat.

### 3. The page: `mcp_server` and `mcp_session`, as in the ligna-store

In `minimal-hi-example/index.html`, `startMcpBrowserBridge` builds the URL from the same
parameters as the store:

```js
const resolveBridgeUrl = () => {
  const mcpServer = getQueryParam('mcp_server');
  const mcpSession = getQueryParam('mcp_session');
  const bridgeUrl = mcpServer
    ? `${mcpServer.replace(/\/+$/, '').replace(/^http/, 'ws')}/bridge`
    : `ws://localhost:${getQueryParam('mcp_port') ?? '3100'}/bridge`;
  return mcpSession
    ? `${bridgeUrl}?session=${encodeURIComponent(mcpSession)}`
    : bridgeUrl;
};
```

`^http` → `ws` maps `https://` to `wss://` and `http://` to `ws://`. A page served over
`http://localhost` may open `wss://`. The page can then also be opened by hand with the handout
parameters, and every other server (Azure, a local docker run on :3101) works through the same
parameter, without a launcher change.

### Session

The launcher always uses a session, and its name is the OS user name:

- each OS user name gets its own container, so a store user on `default` is not affected, and
  neither is a second developer with a different user name. Two machines with the **same** user
  name share the container (see the limitations below)
- the name stays the same across restarts, so an external MCP connector only has to be set up once
  with `…/mcp?session=<name>`
- the same developer with two example tabs open still has the reconnect problem. This is the same
  as two tabs against the local server today

### Known limitations (accepted)

- The OS user name is unique per machine, not across machines. Two developers with the same user
  name, such as generic container users (`node`, `root`, `vscode`) or the same short name, share
  one session, and their pages take the connection from each other. A machine-unique name was
  rejected (see the alternatives). If this happens in practice, the follow-up is an
  `HI_MCP_SESSION` override.
- The cloud server runs the **last deployed** image, not the working tree. Server changes on a
  branch are not tested with `start:cf` until `npm run deploy:cf` has run. If the protocol differs,
  the existing "outdated page bridge" error appears.
- The "no page connected" hint names the ligna-store URL (the wrangler var), not the example URL.
  The launcher opens the example itself, so this only matters when the tab is closed.
- The first request after the container has slept takes about 10 s (container boot). This is
  already documented for the deployment.
- Each session uses one of the 5 container instances while it is active. What happens to a sixth
  concurrent session is not verified.

## Alternatives Considered and Rejected

| Alternative | Why rejected |
| ----------- | ------------ |
| No session (`default` container) | Shared with every handout user of the store. The reconnect behavior makes two pages take the connection from each other every few seconds |
| A random session per start | Every restart changes the MCP URL, so external connectors would have to be set up again each time |
| OS user name plus hostname | Not stable. The macOS hostname depends on the network (`….local`, `….fritz.box`, …), so the session and the MCP URL would change between networks |
| A random id stored in a local file | Unique and stable, but it adds state to the launcher (a file, a gitignore entry, and a name nobody recognizes in `wrangler tail`) for a collision that personal user names make unlikely |
| `HI_MCP_SESSION` / `HI_MCP_SERVER_URL` environment overrides | Nobody asked for them; the page parameters already cover other servers when the URL is opened by hand. Easy to add later |
| Allow more origins in the container (`HI_MCP_PAGE_ORIGINS` in `container.ts`) so other ports work | Needs a deploy and widens the origin list for everyone, only for a non-default port. Refusing the port is enough for now |
| The launcher passes a ready `wss://…/bridge?session=` URL in its own parameter | That would be a second parameter vocabulary next to the store's. Using the same parameters keeps the setup matrix to one table |
| A separate launcher (`start-cf.mjs`) | It would duplicate the whole launcher to change a few lines |
| Extra root scripts per model (`plan:cf:mistral`, …) | `npm run start:cf mistral $MI_API_USAGE_KEY` already works. They can be added if the command is used often |

## Code and Documents the Work Would Touch

| File | Change |
| ---- | ------ |
| `package.json` (root) | `start:cf` script |
| `minimal-hi-example/package.json` | `start:cf` script |
| `minimal-hi-example/start.mjs` | `--cf`: URL parameters, session, no local server, chat MCP URL, port check, printed URL, header comment |
| `minimal-hi-example/index.html` | bridge URL from `mcp_server` / `mcp_session` |
| `README.md` (root) | `npm run start:cf` row in the invocation table |
| `minimal-hi-example/README.md`, `minimal-hi-example/docs/hi-mcp-server.md` | starting section: the Cloudflare variant |
| `hi-mcp/hi-mcp-server/README.md` | setup matrix: the local example with the Cloudflare server |
| `hi-mcp/docs/cloudflare-mcp-server.md` | the example as a second client; `start:cf` as a quick check after a deploy |
| `.agents/skills/hi-mcp-cloudflare-deployment.md` | verification step with `start:cf` |
| `AGENTS.md` | Development Workflow → Starting the Server |
| `.agents/README.md`, `.agents/feature-analysis/README.md` | index entries for this analysis |

No change to the deployment (`hi-mcp/cf`), to the server, or to the ligna-store.

## Verification (Definition of Done)

`start.mjs` and `index.html` have no unit tests, so the checks run live:

1. `node minimal-hi-example/start.mjs --cf --no-open` prints the example URL with
   `mcp_server` and `mcp_session`, and the cloud MCP URL. Nothing listens on :3100.
2. Headless Chromium opens that URL (as in the local live check). An MCP SDK client calls
   `get-plan-context` on `…/mcp?session=<name>` and gets non-empty `articles`, which means the
   page reached the container through the Worker.
3. `npm run start:cf -- --no-open` and `npm run start:cf mistral <key>` from the root reach the
   launcher with their arguments. The chat backend logs the cloud MCP URL, and one chat turn calls
   a tool.
4. `EXAMPLE_PORT=3001 node minimal-hi-example/start.mjs --cf` stops with the port message.
5. Regression: `npm start` opens the URL without `mcp_server`, the local server runs on :3100, and
   the page connects to `ws://localhost:3100/bridge`. `npm test` in `hi-mcp` still passes.

Steps 1–3 need port 3000. If an interactive `npm start` is holding it, the run has to wait. It is
not stopped.

## Questions for the Review

1. Is `npm run start:cf` the right name, or should it be `start:cloud` or a flag on `npm start`?
2. Should the session be the OS user name (recommended), the shared `default`, or set by the
   developer?
3. Should a port other than 3000 be refused (recommended), or should the container allow more
   origins with a redeploy?

## Close-Out (2026-10-01)

The user asked to implement the analysis as written ("implement it"), so the recommended answers
to all three questions apply: the name `start:cf`, the OS user name as the session, and other
ports are refused.

Implemented as proposed:

- `package.json` (root) `start:cf` → `npm run start:cf --workspace minimal-hi-example`,
  `minimal-hi-example/package.json` `start:cf` → `node start.mjs --cf`
- `start.mjs`: `CLOUDFLARE_MCP_SERVER_URL`, `MCP_SESSION = userInfo().username`, `MCP_URL`
  (the cloud URL with `?session=` under `--cf`, used for the chat backend and the printed line),
  `mcp_server` + `mcp_session` in `EXAMPLE_URL`, no local MCP server, and an exit when
  `EXAMPLE_PORT` is not 3000
- `index.html`: `resolveBridgeUrl()` reads `mcp_server` / `mcp_session`, and without them falls
  back to `ws://localhost:${mcp_port ?? 3100}/bridge`
- living docs: root `README.md`, `minimal-hi-example/README.md`, `docs/hi-mcp-server.md`,
  `docs/ai-chat.md`, the PoC setup matrix, `hi-mcp/docs/cloudflare-mcp-server.md` (new section
  "Trying it with the HI example"), the Cloudflare and MCP server skills, and `AGENTS.md`

Verified live on 2026-10-01 against `https://hi-mcp-poc.hi-orchestrator.workers.dev`:

| # | Check | Result |
| - | ----- | ------ |
| 1 | `node minimal-hi-example/start.mjs --cf --no-open` | URL with `mcp_server=https%3A%2F%2Fhi-mcp-poc.hi-orchestrator.workers.dev&mcp_session=gernotsteinegger`, MCP line `…/mcp?session=gernotsteinegger`, nothing on :3100 |
| 2 | headless Chromium on that URL + MCP SDK client on the cloud URL | the page opened `wss://hi-mcp-poc.hi-orchestrator.workers.dev/bridge?session=gernotsteinegger`; `get-plan-context` returned 111 articles from the `bo-test` planner after 10 s |
| 3 | `npm run start:cf mistral $MI_API_USAGE_KEY` from the root (with a no-op `open` on the PATH, so no browser tab opened) | npm ran `node start.mjs --cf mistral <key>`; the chat backend printed the cloud MCP URL and connected with 15 tools; one chat turn called `get-plan-context` (1.9 s) and answered (Mistral miscounted the articles as 120, which is the model, not the bridge) |
| 4 | `EXAMPLE_PORT=3001 node minimal-hi-example/start.mjs --cf` | exits with code 1 and the port message, before the build gate |
| 5 | regression: `node minimal-hi-example/start.mjs --no-open` | URL without `mcp_server`, local server on :3100, the page opened `ws://localhost:3100/bridge`, `get-plan-context` returned 111 articles |
| 6 | `npm test` in `hi-mcp` | 10 test files and 209 tests pass. `cf/tests/worker.test.ts` fails to load `@cloudflare/containers` in exactly the same way with this change stashed, so it was already failing and is unrelated |

Review follow-up (Copilot on PR #45):

- `userInfo()` ran on every launch, and it throws when the uid has no passwd entry, as in
  development containers with an arbitrary uid. That stopped `npm start` and `npm run dev`
  although only `--cf` uses the session. The lookup now runs only under `--cf`. Reproduced with a
  preload that makes `os.userInfo` throw: before the fix the local launcher crashed, after it the
  launcher and server start.
- `mcp_server=wss://host/bridge` became `…/bridge/bridge`. The page now keeps an existing
  `/bridge` suffix, as the ligna-store resolver does. Checked with 8 query cases taken from the
  page's own `resolveBridgeUrl`, including the store's test inputs, and live again through the
  Worker (111 articles).
- The docs claimed that every developer gets their own container. That holds per OS user name, not
  across machines, so the claim is corrected and the collision is recorded as an accepted
  limitation.

Two observations outside this feature:

- Sending `SIGTERM` to the launcher's PID leaves its grandchild servers running: the vite-node
  MCP server on :3100 and the chat backend on :3200. This happens with plain `npm start` as well,
  because `npm` does not forward the signal. Ctrl+C in a terminal signals the whole process group
  and is not affected.
- `npm run start:cf -- --no-open` from the root does not pass `--no-open` on, because the inner
  `npm run` takes it as its own flag. The same holds for `npm start -- --no-open` today.
  `node minimal-hi-example/start.mjs --cf --no-open` works.
