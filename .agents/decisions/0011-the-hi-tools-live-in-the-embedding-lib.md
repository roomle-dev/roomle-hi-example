# ADR 0011 — The HI tools live only in the roomle-ui embedding-lib

> **Status**: Accepted — the clause that puts the HI tools into the embedding-lib is superseded by [ADR 0012](0012-the-hi-tool-set-runs-in-the-planner.md)
> **Date**: 2026-10-20
> **Supersedes**: [ADR 0001](0001-hi-mcp-tool-logic-in-the-server.md), [ADR 0002](0002-one-mcp-server-configured-from-outside.md), [ADR 0003](0003-the-ai-chat-is-an-mcp-client-beside-the-server.md), [ADR 0004](0004-hi-mcp-server-on-cloudflare-containers.md), [ADR 0005](0005-deploy-hi-mcp-from-release-cloudflare.md), [ADR 0008](0008-hi-mcp-prd-and-dev-in-the-roomle-cloudflare-account.md) and the server clause of [ADR 0010](0010-the-example-chat-runs-in-the-page.md)

## Context

The example page and the ligna-store run the planning assistant of the roomle-ui embedding-lib
(`startPlanningAssistant`) with the HI tools of the embedding-lib (`createHiMcpTools`, D94 of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions)). No page connects to the page
bridge of the MCP server any more, so no MCP client reaches a planner through it, and the Cloudflare
deployment has no page to serve. The server was left as the reference the tool copy of the
embedding-lib was compared against.

## Decision

- The MCP server (`hi-mcp/hi-mcp-server`), its page client (`hi-mcp/hi-mcp-client`), the Cloudflare
  container (`hi-mcp/cf`), their scripts and their setup and deployment guides are deleted.
- The tools of the roomle-ui embedding-lib (`packages/embedding-lib/src/homag-intelligence/hi-mcp/`)
  are the only implementation of the HI tools; their unit tests in roomle-ui
  (`tests/unit/embedding-lib/homag-intelligence/hi-mcp/`) guard them.
- roomle-hi-example keeps the behaviour reference (`docs/hi-mcp-behaviour.md`), the example page,
  the launcher, the test tooling and the prompt tests.

## Consequences

- There is no MCP endpoint for external MCP clients (Claude Code, Claude Desktop, Copilot). A host
  that wants one builds it on `createHiMcpTools`.
- A tool change is made in roomle-ui and reaches the example page and the ligna-store with a new
  embedding-lib version, which is built only on request.

## Rejected

- **Keep the server for external MCP clients**: no page runs the page bridge, so a client reaches
  no planner.
- **Keep the server as the reference of the tool copy**: two implementations of one tool set, kept
  in step by hand, for a server nothing runs.
