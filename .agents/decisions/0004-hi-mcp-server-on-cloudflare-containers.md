# ADR 0004 — The HI MCP server runs as a Cloudflare Container, one container per session

> **Status**: Accepted
> **Date**: 2026-09-26 (container per page and one planner per server: 2026-10-03)
> **Analysis**: the Cloudflare Containers deployment and the multiple-connections feature analyses (git history); guide [cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md)

## Context

Colleagues without repository access should try the HI MCP server with two URLs: a store page and
an MCP endpoint. The server must run in the cloud, independent of a developer machine. Its tools
call the planner in the user's browser page over the WebSocket `/bridge`, so the host must pass a
browser WebSocket through to the server. roomle-model-exporter already runs its MCP server
unchanged in a Cloudflare Container behind a Worker; its tools run in the container, it has no
WebSocket. One server process holds one planner page, so parallel users need a server each.

## Decision

- The unchanged Node server (`hi-mcp/hi-mcp-server`, `npm start`) runs in a Cloudflare Container:
  `hi-mcp/cf/` holds the Dockerfile, the container class `HiMcpContainer` (`sleepAfter` 15 min,
  `basic`, at most 5 instances) and the Worker. The Worker forwards `/mcp` and `/bridge` to the
  container of the `?session=` value (`getByName`), and to the shared `default` container without
  it. The relay state (the page, the pending calls) lives in the container process and dies with
  it; the page's bridge reconnects.
- One planner page per server process: the first accepted page owns the planner. A second page is
  closed with WebSocket 4409 and leaves the owner and its pending calls alone. A browser chat sends
  its page's `client` ID with every `/mcp` request; a request whose ID does not own the page gets
  HTTP 409, and every planner call checks the ID again.
- Isolation comes from the platform: the store generates one session per page for its bridge and
  its chat unless `mcp_session` is given, so each page gets a container of its own.

## Consequences

- No server code is specific to Cloudflare; the same server runs locally and in the image.
- The WebSocket upgrade passes through `containerFetch` into the container. If it ever stops
  passing, the fallback is to end the WebSocket in the Worker and relay its `hello`, `call` and
  `result` frames to the container over HTTP.
- At most five sessions run at once. The first request after 15 minutes of sleep boots the
  container (~10 s), discovery (`initialize`, `tools/list`) included; answering discovery in the
  Worker from a static manifest, as the exporter does, is the option if idle connectors cost too
  much.
- A session name routes, it does not authenticate; the access control is open
  ([backlog](../backlog/deployment-and-session-issues.md#3-the-public-mcp-endpoint-has-no-access-control)).
- An external MCP client reaches a store page only with the page's session name
  (`mcp_session=<name>` on the page, `?session=<name>` in the client URL).
- The Worker `hi-mcp-poc` lives on a personal Cloudflare account. Another account changes the
  workers.dev subdomain and with it the URL in `HI_MCP_STORE_URL` (`wrangler.jsonc`),
  `CLOUDFLARE_MCP_SERVER_URL` (`minimal-hi-example/start.mjs`), the verify step of
  `deploy-cloudflare.yml` and every handout.

## Rejected

- Rewriting the server for the Worker runtime (Worker plus Durable Object): it rewrites
  `server.ts` and `page-bridge.ts`, while the container runs them unchanged.
- A quick tunnel (`cloudflared`) to a laptop: not hosting — it dies with the laptop.
- A session-keyed page registry in one server process: the container per session isolates pages
  without it.
- The newest page takes the planner over: a second tab would silently take the first one's planner
  and fail its pending calls.
- Disabling only the second chat in the UI: during a reconnect its calls could still reach another
  page's planner; the server checks the `client` ID instead.
- Not chosen: Azure App Service (no access rights to a subscription; its runbook is
  [azure-mcp-server.md](../../hi-mcp/docs/azure-mcp-server.md)) and Cloud Run (viable, not asked
  for).
