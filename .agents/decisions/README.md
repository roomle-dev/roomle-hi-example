# Decisions (ADRs)

Architecture Decision Records: numbered documents that record *why* the code is shaped the way it is, and which approaches were deliberately rejected. ADRs stop an agent from re-proposing something the team already ruled out.

ADRs are living reference. They are read before proposing a change to an area they cover. A superseded ADR is kept with its superseding reference — never deleted.

## ADR Format

Each ADR carries:

- A title in the form `NNNN — short description`
- Status: `Accepted`, `Superseded by NNNN`, `Rejected`
- Date
- Context — the situation and the forces at play
- Decision — what was decided
- Alternatives — the approaches considered and why they were rejected
- Consequences — the positive and negative outcomes of the decision

## Current ADRs

| ADR | Title | Status |
|---|---|---|
| [0001 — HI MCP tool logic runs in the MCP server, pages only execute planner methods](0001-hi-mcp-tool-logic-in-the-server.md) | Superseded by ADR 0011 |
| [0002 — One MCP server for every client, configured from outside](0002-one-mcp-server-configured-from-outside.md) | Superseded by ADR 0011 |
| [0003 — The AI chat is an MCP client beside the MCP server](0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) | Superseded by ADR 0011 |
| [0004 — The HI MCP server runs as a Cloudflare Container, one container per session](0004-hi-mcp-server-on-cloudflare-containers.md) | Superseded by ADR 0011 |
| [0005 — The HI MCP server is deployed by a push to `release/cloudflare`](0005-deploy-hi-mcp-from-release-cloudflare.md) | Superseded by ADR 0011 |
| [0006 — The prompt tests assess the agent, the unit tests the tools](0006-prompt-tests-assess-the-agent.md) | Accepted |
| [0007 — The tool logic of the plan-changing HI MCP tools runs in the planner](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/hi-mcp-tool-logic-in-the-planner.md) | Accepted — its six-methods clause superseded by 0013; lives in roomle-ui |
| [0008 — The HI MCP server runs in the Roomle Cloudflare account, as PRD and DEV](0008-hi-mcp-prd-and-dev-in-the-roomle-cloudflare-account.md) | Superseded by ADR 0011 |
| [0009 — The chat window is a panel of the planner, the agent loop stays in the host](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-chat-window-is-a-panel-of-the-planner.md) | Accepted; lives in roomle-ui |
| [0010 — The example's chat runs in the page, with the planning assistant of the embedding-lib](0010-the-example-chat-runs-in-the-page.md) | Accepted — its server clause superseded by 0011 |
| [0011 — The HI tools live only in the roomle-ui embedding-lib](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tools-live-in-the-embedding-lib.md) | Accepted — its embedding-lib clause superseded by 0012; lives in roomle-ui |
| [0012 — The HI tool set runs in the planner, the embedding-lib forwards to it](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md) | Accepted; lives in roomle-ui |
| [0013 — The library context is a planner method of its own](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-library-context-is-a-planner-method-of-its-own.md) | Accepted; lives in roomle-ui |
| [0014 — The Planning Assistant uses a shared reference prefix](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-planning-assistant-uses-a-shared-reference-prefix.md) | Accepted; lives in roomle-ui |

## Adding an ADR

1. Write the ADR in this folder with the next sequential number (e.g. `0010-short-description.md`).
2. Add a row to the table above.
3. Add a row to the Decisions table in `.agents/README.md`.
