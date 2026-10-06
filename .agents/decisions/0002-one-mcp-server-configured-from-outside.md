# ADR 0002 — One MCP server for every client, configured from outside

> **Status**: Accepted
> **Date**: 2026-09-27
> **Analysis**: the refactoring analysis of pull request [#13](https://github.com/roomle-dev/roomle-hi-example/pull/13) (git history); the server copied from the roomle-ui PoC [RML-17693](https://roomle.atlassian.net/browse/RML-17693) in pull request [#12](https://github.com/roomle-dev/roomle-hi-example/pull/12)

## Context

The repository had two MCP servers with the same tools: a hand-rolled zero-dependency server in
`minimal-hi-example` (JSON-RPC over HTTP, an SSE + fetch page bridge, static serving of the example
page) and the TypeScript server in `hi-mcp/hi-mcp-server` (`@modelcontextprotocol/sdk`, zod tool
schemas, a WebSocket bridge, unit tests), which the ligna-store and the cloud deployments use. Every
tool fix had to be made twice, and only one of the two was tested and deployed.

## Decision

- `hi-mcp/hi-mcp-server` is the only MCP server. It carries no client-specific code: it serves
  `/mcp` and `/bridge` only, and every client wires itself to it through environment variables —
  `HI_MCP_PORT`/`PORT`, `HI_MCP_PAGE_ORIGINS` (the WebSocket and CORS origin allow-list) and
  `HI_MCP_STORE_URL` (the URL the "no page connected" error names).
- The example page is served and opened by its own launcher, `minimal-hi-example/start.mjs`, as
  the store's dev server serves the store: static files on port 3000, the server spawned on port
  3100 with those variables set, the browser opened.
- "Built" means a build gate, not a build artifact: the launcher installs the `hi-mcp` workspace
  when it is missing and typechecks it before anything starts; `vite-node` runs the TypeScript.
- The server has its own locked dependencies in the `hi-mcp` workspace; the repository root stays
  free of runtime dependencies.

## Consequences

- A tool change is made once, in the tested server, and reaches the example, the store and the
  deployments alike.
- `npm start` runs two processes and needs a one-time `npm install` of the `hi-mcp` workspace
  (the build gate does it); the example URL is on port 3000, the MCP endpoint stays
  `http://localhost:3100/mcp`.
- Port 3000 is also the ligna-store dev server's port; `EXAMPLE_PORT` moves the example, and the
  launcher sets the origin allow-list for it.
- The example page talks to the server over the same WebSocket protocol as every other page.

## Rejected

- Keeping a separate zero-dependency server for the example.
- Static serving and browser opening inside `server.ts` (env-gated): example-specific code in the
  shared server, which exists to be configured from outside.
- An SSE bridge (`/bridge` + `/bridge/result`) beside the WebSocket, so the example page could stay
  unchanged: a second transport no other client uses.
- A compiled server artifact (esbuild or `tsc` to `dist/`, started with plain `node`): build
  configuration for a PoC that `vite-node` runs as it is.
