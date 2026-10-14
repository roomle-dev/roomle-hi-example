# Open issues of the deployment, the launcher and the page sessions

> **Type**: Backlog — what is still to be done about deploying the MCP server, starting the example and connecting pages to it
> **Domain**: `hi-mcp/cf/` (image, Worker, wrangler config), `.github/workflows/deploy-cloudflare.yml`, `minimal-hi-example/start.mjs` and the root `package.json` scripts, the page sessions of `hi-mcp/hi-mcp-server/page-bridge.ts` and the ligna-store bridge
> **Living reference**: [cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md), [hi-mcp-cloudflare-deployment.md](../skills/hi-mcp-cloudflare-deployment.md), [ADR 0004 — the server on Cloudflare Containers](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md), [ADR 0005 — deploy from `release/cloudflare`](../decisions/0005-deploy-hi-mcp-from-release-cloudflare.md), [ADR 0008 — PRD and DEV in the Roomle Cloudflare account](../decisions/0008-hi-mcp-prd-and-dev-in-the-roomle-cloudflare-account.md)

Each issue names the problem, the cause, the to-do and its test. An issue leaves this document when
its fix is in the code.

## Overview

| # | Issue | Kind | Priority |
|---|---|---|---|
| 3 | [The public MCP endpoint has no access control](#3-the-public-mcp-endpoint-has-no-access-control) | decision still to make | medium — before the URL goes beyond a trial |
| 4 | [The personal deployment still runs and the DEV environment admits every branch](#4-the-personal-deployment-still-runs-and-the-dev-environment-admits-every-branch) | setup outside the code | medium — the DEV token is readable by a workflow on any branch |

## 3. The public MCP endpoint has no access control

**Problem.** Anyone who knows the Worker URL and a session can call the tools on the page connected
to that session: `default` (no `?session=`), a user-chosen `mcp_session`, or the OS user name that
`npm run start:cf` uses. The Worker routes by `?session=` (`hi-mcp/cf/src/worker.ts:20-22`) and checks
nothing; a session name routes, it does not authenticate. Only the store's generated per-page
sessions are hard to guess.

**To do.** Decide the access control before the URL is handed out beyond a trial: session links as
today, Google OAuth restricted to roomle.com accounts in the Worker (as roomle-model-exporter's
`cf/src/google-auth.ts` does), or a shared secret on `/mcp`. Record the decision in a new ADR beside ADR 0008.

**Test.** A Worker routing test in `hi-mcp/cf/tests/worker.test.ts`: a request without the
credential gets no container.

## 4. The personal deployment still runs and the DEV environment admits every branch

**Problem.** Three setup steps outside the code are not done:

- The Worker `hi-mcp-poc` in the personal Cloudflare account still answers:
  `POST https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp` `initialize` → 200. Its container
  application `hi-mcp-poc-himcpcontainer` runs and bills beside it, and the personal API token and
  the Workers Paid plan of that account are still active.
- The GitHub environment `cloudflare-dev` of `roomle-dev/roomle-hi-example` has no deployment
  branch policy, so it hands `CLOUDFLARE_API_TOKEN` to a job of any branch of the public
  repository. The environment `cloudflare` admits only `release/cloudflare`. ADR 0008 and the
  one-time setup of [cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md#one-time-setup-repository-admin)
  say that each environment admits only its release branch.
- Both environments still hold a `CLOUDFLARE_ACCOUNT_ID` secret. `deploy-cloudflare.yml` does not
  pass it; wrangler takes the account from `account_id` in `hi-mcp/cf/wrangler.jsonc`.

**To do.**

1. The branch rule of `cloudflare-dev`, as the one-time setup gives it:
   `echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' | gh api -X PUT repos/roomle-dev/roomle-hi-example/environments/cloudflare-dev --input -`,
   then `gh api -X POST repos/roomle-dev/roomle-hi-example/environments/cloudflare-dev/deployment-branch-policies -f name=release/cloudflare.dev -f type=branch`.
2. Delete `CLOUDFLARE_ACCOUNT_ID` from both environments:
   `gh secret delete CLOUDFLARE_ACCOUNT_ID --env cloudflare --repo roomle-dev/roomle-hi-example`, the
   same with `--env cloudflare-dev`.
3. Tear down the personal deployment, from the repository root (it has no wrangler config there,
   so the variable selects the account):
   `CLOUDFLARE_ACCOUNT_ID=<personal account id> npx wrangler delete --name hi-mcp-poc`, then
   `npx wrangler containers list` and `npx wrangler containers delete <id>` of
   `hi-mcp-poc-himcpcontainer` with the same variable — `wrangler delete` leaves the container
   application running. Then delete the personal API token and, if nothing else runs in that
   account, end its Workers Paid plan.
4. Before step 3: every handout and MCP client connector names the PRD URL
   `https://hi-planning-assistant.dashiell-bell.workers.dev/mcp`.

**Test.** `gh api repos/roomle-dev/roomle-hi-example/environments --jq '.environments[] | {name, policy: .deployment_branch_policy}'`
shows a custom branch policy for `cloudflare` and `cloudflare-dev`, and
`gh api repos/roomle-dev/roomle-hi-example/environments/cloudflare-dev/deployment-branch-policies --jq '.branch_policies[].name'`
answers `release/cloudflare.dev`; the next push to `release/cloudflare.dev` still deploys DEV. The
`initialize` of the old URL no longer answers 200.

**Reproduce.** The two `gh api` calls of the test, and
`curl -s -o /dev/null -w '%{http_code}' -X POST https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'` → `200`.

**References.** [RML-18154](https://roomle.atlassian.net/browse/RML-18154),
[ADR 0008](../decisions/0008-hi-mcp-prd-and-dev-in-the-roomle-cloudflare-account.md),
[teardown](../../docs/setup/cloudflare-mcp-server.md#teardown-the-container-app-needs-its-own-delete).
