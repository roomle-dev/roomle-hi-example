# Connect a store planner to an external MCP agent without built-in chat

> **Status:** Fixed locally — public release and acceptance check pending
> **Date:** 2026-10-09
> **Former backlog item:** Deployment and session issues, item 1

## Affected repositories

- **ligna-store:** resolve MCP connection options independently of chat, start the bridge when a valid server is configured, and share its identity with optional chat.
- **roomle-hi-example:** make the Cloudflare no-page link select the requesting agent's session, and update agent/deployment guides and connection documentation.

## Confirmed gaps

In ligna-store, `components/blocks/Planner.vue:94` resolves only `chatOptions`.
At line 263, `if (chatOptions)` encloses both bridge startup and the lazy chat-window import.
`hi-mcp/chat-options.ts:60` requires a supported model and API key before returning options.
With only `mcp_server` and `mcp_session`, it returns `undefined`: no bridge WebSocket starts.
An unsupported chat model also prevents the bridge from starting.

The bridge itself already works independently of a provider. It accepts the planner API, server,
session and client identity, sends hello, waits for ready, relays history, reconnects and disposes
on unmount. The startup gate is the root cause, rather than the bridge protocol.

The static `HI_MCP_STORE_URL` in `hi-mcp/cf/wrangler.jsonc` also lacks `mcp_session`.
`hi-mcp/cf/src/container.ts` forwards the same URL to every container, and
`hi-mcp-server/page-bridge.ts:123` repeats it in the no-page error. The Worker routes by
`?session=`, using `default` when absent; the store generates a random session when its session
parameter is absent. Separating startup alone would therefore connect the suggested page to
an unrelated container, leaving the external agent disconnected.

The local no-page fallback also omits `mcp_server`, so a store opened from that hint cannot start
its bridge. Include the local server's configured port and HTTP/TLS scheme in that fallback;
a configured `HI_MCP_STORE_URL` remains authoritative.

## Minimal implementation plan

1. Add an MCP option resolver to the store's existing lightweight option module. Gate it only
   on a valid `mcp_server`. Resolve the normalized server URL, one generated `clientId`, explicit
   `mcp_session` or that generated ID, and browser MCP URL once per planner initialization.
2. Pass these options into chat resolution. Valid chat settings add model, key and image support;
   missing/invalid chat settings leave the bridge enabled. Independent bridge/chat client IDs
   would cause HTTP 409, so both must use exactly the same resolved identity.
3. In `Planner.vue`, start the bridge under `if (mcpOptions)` after the planner is available.
   Keep the chat-window import under `if (chatOptions)`, sharing status and retry. Preserve
   unmount/locale-reload cleanup and exclusion of the API key from planner options and page hello.
   An INT page without `mcp_server` still starts no bridge.
4. At the Cloudflare boundary, make the fallback store URL carry the session selected by the
   request before the Node container starts. `HiMcpContainer.fetch` receives the original request
   URL. Confirm the container SDK's environment lifecycle before implementing this detail.
   `/mcp?session=check` must suggest `mcp_session=check`; `/mcp` must suggest `mcp_session=default`.
   Encode parameters and preserve stage/server settings. A fixed default session fixes only
   unnamed clients. Preserve random per-page isolation; do not put all bridge-only tabs in default.
5. Include `mcp_server` in the local default no-page link, matching the server's port and TLS
   configuration. Cover the default, custom port and TLS links in the existing bridge tests.
6. Remove chat credentials from the external-agent and Jan store links. Update store README,
   MCP reference/skill, Cloudflare/Azure setup and deployment verification instructions to explain
   independent bridge startup. Deploy the store fix and any Cloudflare fallback change through
   their existing release workflows before expecting public links to work.

No planner method, tool payload, allow-list or ownership check needs changing. External agents
use the shared session URL without the private browser `client` parameter. roomle-ui and RoomleCore
require no changes. The backend-controlled agent-loop backlog is a separate architecture proposal.

## Verification

Respect the user's instruction: add no tests, test command or test dependencies to ligna-store.
Use temporary option/browser probes outside that repository and manual checks. Use the existing
roomle-hi-example suite for Cloudflare/error-link changes.

- Valid server/session without model/key: bridge receives ready, no chat/provider call starts,
  and external `get-plan-context` reaches that planner.
- Missing or invalid server: no bridge; valid server with invalid/missing chat settings: bridge only.
- Complete chat options: bridge and chat share client/session IDs and chat tools still work.
- Generated sessions remain distinct; named and default error links recover their matching agent.
- Origin, protocol, occupancy, reconnect and unmount behavior stays intact.

Checking `initialize` alone is insufficient: it works without a page. Open the store, start its
planner and keep the tab open; the acceptance check is `get-plan-context` without store chat keys.

Matching URLs after the fix:

- Store: `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev&mcp_session=check`
- Agent: `https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp?session=check`

## Evidence collected

Baselines: roomle-hi-example `6dc538c`, ligna-store `8d1bd2c`. An in-memory transpilation of the
current option resolver returned no options for server/session alone or an unsupported chat model;
complete valid chat settings returned session `check`. The configured fallback URL has no session.
Worker source and existing routing regressions confirm default/named routing and forwarded URLs.
At analysis time, no live cloud request, provider call, production-code change or deployment was performed.

## Local implementation and verification

- ligna-store resolves MCP options independently of chat in `hi-mcp/chat-options.ts`.
  `Planner.vue` starts the bridge from those options and adds chat only when its settings are valid.
  Both share the same client/session identity. No tests, test command or dependencies were added
  to ligna-store.
- Cloudflare sets the configured store link's `mcp_session` before container startup. The installed
  container SDK reads `this.envVars` when starting the container, so the Node process receives the
  selected session. Five regressions cover named, default and encoded sessions, reconnect, and
  an absent configured store link. Four failed before the fix; all pass with it.
- The local no-page fallback includes `mcp_server` using the configured port and HTTP/TLS scheme.
  Four added regressions failed before the fix and pass with it; configured store URLs retain
  their existing precedence.
- Temporary in-memory option probes cover missing/invalid server, missing/invalid chat settings,
  URL normalization, shared chat identity, encoded sessions and distinct generated sessions.
- Headless Chromium opened the running store on INT with only `mcp_server`, `mcp_session=check`
  and plan `ps_nwzhfk8bjc2gu02gsyocsdragi0rxey`. The bridge sent protocol 2 hello and received ready;
  an external `get-plan-context` returned one room and 111 articles. No chat window or provider
  request started.
- A second browser check used a supported chat model and a fake key without submitting a prompt.
  The optional chat window opened, the matching bridge owner received HTTP 200, and a foreign
  browser client received HTTP 409. No model was called. One probe was interrupted by a dev reload;
  the stable run passed without a page error.
- A third browser check opened the exact store URL suggested by the running local no-page error
  (with only the existing plan id added). It connected without chat and returned plan context;
  the owner received HTTP 200 and a foreign client HTTP 409.
- The ligna-store production build passes.
- The complete HI MCP suite passes: **593 tests in 15 files**. Server/client/chat and Cloudflare
  typechecks, root lint and formatting pass. Scoped store TypeScript and ESLint checks pass.

The local servers and hosted bo-test planner were used; no cloud deployment or provider test was
performed. The public no-page link still needs both the store release and Cloudflare release,
followed by a named/default acceptance check: call `get-plan-context` before opening a page,
open its suggested store URL without chat credentials, and confirm the next call reaches that
planner. Repeat with `?session=check` and with no session; the suggested links must select
`mcp_session=check` and `mcp_session=default`, respectively. The solved issue leaves the backlog
entirely; release verification stays in this analysis until the fix lands.
