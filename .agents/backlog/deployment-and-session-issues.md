# Open issues of the deployment, the launcher and the page sessions

> **Type**: Backlog — what is still to be done about deploying the MCP server, starting the example and connecting pages to it
> **Domain**: `hi-mcp/cf/` (image, Worker, wrangler config), `.github/workflows/deploy-cloudflare.yml`, `minimal-hi-example/start.mjs` and the root `package.json` scripts, the page sessions of `hi-mcp/hi-mcp-server/page-bridge.ts` and the ligna-store bridge
> **Living reference**: [cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md), [hi-mcp-cloudflare-deployment.md](../skills/hi-mcp-cloudflare-deployment.md), [ADR 0004 — the server on Cloudflare Containers](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md), [ADR 0005 — deploy from `release/cloudflare`](../decisions/0005-deploy-hi-mcp-from-release-cloudflare.md)

Each issue names the problem, the cause, the to-do and its test. An issue leaves this document when
its fix is in the code.

## Overview

| # | Issue | Kind | Priority |
|---|---|---|---|
| 3 | [The public MCP endpoint has no access control](#3-the-public-mcp-endpoint-has-no-access-control) | decision still to make | medium — before the URL goes beyond a trial |

## 3. The public MCP endpoint has no access control

**Problem.** Anyone who knows the Worker URL and a session can call the tools on the page connected
to that session: `default` (no `?session=`), a user-chosen `mcp_session`, or the OS user name that
`npm run start:cf` uses. The Worker routes by `?session=` (`hi-mcp/cf/src/worker.ts:20`) and checks
nothing; a session name routes, it does not authenticate. Only the store's generated per-page
sessions are hard to guess.

**To do.** Decide the access control before the URL is handed out beyond a trial: session links as
today, Google OAuth restricted to roomle.com accounts in the Worker (as roomle-model-exporter's
`cf/src/google-auth.ts` does), or a shared secret on `/mcp`. Record the decision in the Cloudflare ADR.

**Test.** A Worker routing test in `hi-mcp/cf/tests/worker.test.ts`: a request without the
credential gets no container.
