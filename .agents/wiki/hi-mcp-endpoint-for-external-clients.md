# An MCP endpoint for the HI tools at `…/hi-mcp`

Could an external MCP client — Claude Code, Claude Desktop, Copilot — reach the HI tools at an
endpoint such as `http://localhost:5173/hi-mcp` or `https://www.roomle.com/t/bo-test/hi-mcp`? And
how would that endpoint talk to roomle-ui?

**Short answer:** only through a relay server that this path is routed to. The planner tab opens a
WebSocket to the relay, and the relay forwards the client's MCP messages over it. The MCP server
logic itself can run in the planner tab. Today there is no MCP endpoint
([ADR 0011](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tools-live-in-the-embedding-lib.md)).

## Why the planner cannot be the endpoint itself

- **The deployed planner is static files.** roomle-ui `cd-gcp-bo.yaml:160-167` uploads the build of
  `/t/bo-…` to the Google Cloud Storage bucket `roomle-configurator-live`. No code of roomle-ui runs
  on the server. A POST to `/t/bo-test/hi-mcp` reaches a bucket, not a program.
- **`localhost:5173` is the Vite dev server.** A Vite middleware could answer `/hi-mcp` there, but
  only during development, and it would face the same gap to the tab.
- **A browser tab accepts no incoming connection.** An MCP client sends HTTP requests to the
  server; a page can only open connections outward.
- **The plan exists only in the tab.** The kernel, the glue logic, the library calculation and the
  user's live plan are there. An endpoint without the tab has no planner to call.

## The architecture

```
MCP client ──HTTP POST /hi-mcp (session)──▶ relay ◀──WebSocket, opened by the tab── planner tab
                                              │                                         │
                                              └── forwards JSON-RPC unchanged ─────────▶ MCP server logic
                                                                                           + HI tool set
```

| Part | Runs in | Does |
|---|---|---|
| MCP client | the user's agent (Claude Code, Claude Desktop, …) | brings the model and its key; calls `tools/list` and `tools/call` |
| Relay | a hosted service | accepts Streamable HTTP and the planner's WebSocket, pairs them by session, forwards the messages; knows no tools |
| Page bridge | the planner (roomle-ui) | opens the WebSocket on request, hands the messages to the MCP server logic, sends the answers back |
| MCP server logic | the planner | answers `initialize`, `tools/list`, `tools/call` and `ping` from the HI tool set |
| HI tool set | the planner | the tools: `getExternalObjectAgentTools` and `callExternalObjectAgentTool` ([ADR 0012](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md)) |

Because the relay forwards the messages unchanged, a tool change never touches the relay. The
tools, the served text and the protocol answers all ship with the planner.

## What needs to be done

The tool set runs in the planner
([ADR 0012](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md)):
`getExternalObjectAgentTools` and `callExternalObjectAgentTool` answer as `tools/list` and
`tools/call` do, and a tool call is one round trip into the planner's iframe. The MCP server logic
builds on them.

1. **The MCP protocol in the planner.** The planner answers `initialize`, `tools/list`,
   `tools/call` and `ping` from those two methods.
   - `initialize` returns the system prompt of `getExternalObjectAgentPrompts` (roomle-ui
     `roomle-planner.ts:3213`, D80) as its `instructions`. Without it an external agent gets no
     system prompt.
   - Either a small JSON-RPC handler, or the MCP SDK's `Server` with a custom transport. The SDK
     stays a lazy chunk of the planner that loads only with the bridge. D94 rejects the MCP SDK in
     the host bundle.
2. **The page bridge in the planner.**
   - It opens only on request: an init option or feature flag with the relay URL.
   - It opens the WebSocket, announces its protocol version and planner version, and reconnects
     when the connection drops.
   - It shows its state in the planner UI: connected, the pairing code, a disconnect button.
3. **The relay.**
   - **Endpoints:** Streamable HTTP at `/hi-mcp`, and the planner's WebSocket at `/hi-mcp/bridge`.
   - **Per session:** it holds the planner's socket and the open requests. It keeps a request open
     for the whole tool call. Without a connected planner it answers with an error that says which
     page to open.
   - **Hosting:** a Cloudflare Worker with one Durable Object per session, which holds the WebSocket.
     The alternative is a container service with one instance per session or sticky routing.
   - **Routing:** serving it under `www.roomle.com/t/bo-test/hi-mcp` needs a routing rule in front
     of the bucket. A host of its own needs none and loses nothing: the planner opens the WebSocket
     cross-origin either way.
4. **Pairing and authentication.**
   - The planner shows a pairing token, and the user adds the endpoint with it to the MCP client,
     e.g. `claude mcp add --transport http hi-mcp <relay>/hi-mcp` with the token as a header.
   - Or the relay uses the MCP authorization flow (OAuth) with the Roomle account and maps the
     account to its paired tab.
   - Either way the token is unguessable, expires and can be revoked from the planner. A session
     name routes requests and authenticates nothing
     ([ADR 0004](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md)).
5. **Tests.**
   - roomle-ui: the protocol answers, and the bridge's hello, reconnect and refusals.
   - The relay: pairing, no planner connected, a second planner for the same session, timeouts, a
     dropped socket during a call.
   - End to end: an external client against a local planner and a local relay. The prompt runner
     (`run-hi-mcp-prompt.js`) drives the in-page chat and does not cover this path.
6. **Documentation.**
   - An ADR that brings back an MCP endpoint and supersedes the consequence "no MCP endpoint for
     external MCP clients" of ADR 0011. The ADR's own reason for rejecting the endpoint — no page
     runs the page bridge — does not hold when the planner runs the bridge.
   - A setup guide for MCP clients, and the deployment of the relay in
     [deployment-and-testing.md](../context/deployment-and-testing.md).

## Concerns

- **Access to the plan.** The tool set has 28 tools. It changes the plan and reads the price and the
  order data (`get-price`, `get-order-data`, roomle-ui `hi-mcp-server.ts:899`, `:909`). Whoever
  holds the pairing token can do all of that in the user's session. The pairing is explicit and
  visible in the planner, and the user can end it.
- **The plan leaves Roomle.** The plan context, the images and the prices go to the model provider
  the client uses, which neither Roomle nor the library chooses. That is a product decision before
  any customer-facing use.
- **One agent per planner.** The in-page planning assistant and an external client on the same
  planner would compete for it ([ADR 0010](../decisions/0010-the-example-chat-runs-in-the-page.md)).
  - The bridge refuses while the assistant runs.
  - The assistant reports itself unavailable while the bridge is paired, with
    `planningAssistantOutput({ type: 'availability' })`, roomle-ui `hi-planning-assistant.ts:128`,
    `:183`.
  - The tool set already runs one tool call at a time (`oneAtATime`, `tool-executors.ts:211`).
- **One planner per session.** A second tab of the same session is refused and does not take the
  planner over. ADR 0004 records these rules.
- **The tab must stay open.** A hidden tab gets throttled timers and may not render. Check
  `get-plan-images` and the library calculation in a background tab before relying on them.
- **Long calls.** A tool call takes seconds to minutes; the planner allows a snapshot 120 s
  (roomle-ui `planner-api.ts:2`). The relay and the MCP client must wait that long; in Claude Code,
  `MCP_TOOL_TIMEOUT` sets the limit.
- **Message size.** `get-plan-images` returns two PNG images as base64. Check the WebSocket message
  limit of the relay's platform against them, and split large messages if needed.
- **Discovery without a planner.** `tools/list` needs a connected planner, because the tools live
  there. The relay either answers with an error that says to open the planner, or caches the last
  tool list. A cached list can belong to another planner version.
- **The served text reaches a client it was not tested with.** An external client brings its own
  model and its own system prompt. Whether it uses `instructions` depends on the client. The prompt
  tests cover the in-page chat only.
- **Operations.** The relay is a stateful service to deploy, monitor and pay for, unlike the static
  planner. In the Roomle Cloudflare account, every Worker shares the account's workers.dev
  subdomain. roomle-planner-mcp uses it, so it must not change.

## Alternatives

| Alternative | What it gives | Why it is not the endpoint |
|---|---|---|
| **WebMCP**: the planner registers the tools with `document.modelContext.registerTool()` | No server: the page is the tool registry | Only agents inside the same browser can call it, not Claude Code or Claude Desktop. It is an early preview behind a Chromium flag, and its behaviour in a cross-origin iframe is unchecked |
| **A local bridge for development**: the MCP client starts a local process, and the planner connects to it on `localhost` | No hosting | One developer machine only. Newer Chrome versions ask for permission before a public site reaches `localhost` |
| **A headless planner on the server** | No open tab needed | The agent would not edit the user's live session ([ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md)) |

## References

- [ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md) — the page bridge and its
  allow-list
- [ADR 0004](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md) — sessions, one planner
  per server, the refusal of a second page
- [ADR 0010](../decisions/0010-the-example-chat-runs-in-the-page.md) — one client per planner
- [ADR 0011](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tools-live-in-the-embedding-lib.md) — no MCP endpoint
- [ADR 0012](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md) — the tool set in the planner
- D80 and D94 of [`hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)
