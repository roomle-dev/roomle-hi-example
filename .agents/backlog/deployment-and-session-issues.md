# Open issues of the deployment, the launcher and the page sessions

> **Type**: Backlog — what is still to be done about deploying the MCP server, starting the example and connecting pages to it
> **Domain**: `hi-mcp/cf/` (image, Worker, wrangler config), `.github/workflows/deploy-cloudflare.yml`, `minimal-hi-example/start.mjs` and the root `package.json` scripts, the page sessions of `hi-mcp/hi-mcp-server/page-bridge.ts` and the ligna-store bridge
> **Living reference**: [cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md), [hi-mcp-cloudflare-deployment.md](../skills/hi-mcp-cloudflare-deployment.md), [ADR 0004 — the server on Cloudflare Containers](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md), [ADR 0005 — deploy from `release/cloudflare`](../decisions/0005-deploy-hi-mcp-from-release-cloudflare.md)

Each issue names the problem, the cause, the to-do and its test. An issue leaves this document when
its fix is in the code.

## Overview

| # | Issue | Kind | Priority |
|---|---|---|---|
| 1 | [A store page opened for an external agent never connects](#1-a-store-page-opened-for-an-external-agent-never-connects) | gap between the ligna-store and the deployment config | high — the "No HI page connected" error sends the user to a page that does not connect |
| 2 | [Per-page isolation is not checked on the live deployment](#2-per-page-isolation-is-not-checked-on-the-live-deployment) | live check still to do | medium |
| 3 | [The public MCP endpoint has no access control](#3-the-public-mcp-endpoint-has-no-access-control) | decision still to make | medium — before the URL goes beyond a trial |
| 4 | [The Cloudflare image installs from a second lockfile](#4-the-cloudflare-image-installs-from-a-second-lockfile) | build trap | medium — the next dependency change of `hi-mcp-server` breaks the deploy |
| 5 | [The root npm scripts swallow the launcher's flags](#5-the-root-npm-scripts-swallow-the-launchers-flags) | launcher defect | low |
| 6 | [SIGTERM to the launcher leaves the servers running](#6-sigterm-to-the-launcher-leaves-the-servers-running) | launcher defect | low — Ctrl+C is not affected |

## 1. A store page opened for an external agent never connects

**Problem.** The ligna-store starts its page bridge only together with its chat window: `Planner.vue:263`
(`if (chatOptions)`) and `resolveChatOptions` (`hi-mcp/chat-options.ts:60-91`) need `model`,
`api_key` and `mcp_server` (ligna-store `origin/master`). The deployment's `HI_MCP_STORE_URL`
(`hi-mcp/cf/wrangler.jsonc:23`) is `…/ligna-store-test/?store.stage=INT&mcp_server=…` without them,
and the "No HI page connected" error (`page-bridge.ts:123`) tells the agent to send the user there:
the page opens, no bridge starts, and every tool call fails the same way. An external agent (Le Chat,
Claude Code, Jan, Copilot) needs a store page with a chat model and a key it does not use.

**Cause.** The store ties its bridge to the chat window (`if (chatOptions)`), while
`HI_MCP_STORE_URL` and the agent guides assume a bridge that starts with `mcp_server` alone.

**To do.** ligna-store: start the bridge whenever `mcp_server` is a valid server URL, with the page
session of `mcp_session` (or a generated one); show the chat window only when `model` and `api_key`
are set as well. Then drop the chat parameters from the store URLs of the agent guides
([connect-agent-to-cloud-mcp.md](../../docs/setup/connect-agent-to-cloud-mcp.md),
[jan-ai-setup.md](../../docs/setup/jan-ai-setup.md)), and `HI_MCP_STORE_URL` names a page that
connects. Constraint: an INT page without `mcp_server` starts no bridge.

**Test.** A test of the option resolution — the ligna-store has no test runner, so it needs one
first: `mcp_server` alone yields bridge options and no chat options; neither parameter yields neither.

**Reproduce.** Open `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev&mcp_session=check`,
then call `get-plan-context` on `https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp?session=check`.

## 2. Per-page isolation is not checked on the live deployment

**Problem.** The page sessions are deployed (the store generates one session per page, the server
refuses a second page with WebSocket 4409 and a foreign browser chat with HTTP 409), but they are
checked only by unit tests and a local probe. Not checked against
`https://hi-mcp-poc.hi-orchestrator.workers.dev`:

- two store chat tabs with the same URL and no `mcp_session` plan independently — on two devices as
  well;
- two pages with the same explicit `mcp_session`: the second one's chat shows the planner in use, the
  first keeps working, and neither can change the other's plan, also while one reconnects;
- a sixth concurrent session (`max_instances: 5`, `hi-mcp/cf/wrangler.jsonc:13`): what the chat
  shows when no container is free.

**To do.** Run the three checks in the deployed store; check the handout's sentence on a sixth session
("the chat stays disabled and reports that it cannot connect") against what the store shows, and
correct it, in the handout section of [cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md#the-handout-for-colleagues-parallel-use-per-session).

**Test.** The unit level is guarded: `it('rejects a second page without disrupting the active planner call')`
and `it('only lets the matching browser chat call its planner')` in
`hi-mcp/hi-mcp-server/tests/page-bridge.test.ts`; `it('routes ?session= to a container of its own (parallel users)')`
in `hi-mcp/cf/tests/worker.test.ts`.

**Reproduce.** Two tabs of `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&model=<model>&api_key=<key>&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev`.

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

## 4. The Cloudflare image installs from a second lockfile

**Problem.** The image runs `npm ci --workspace hi-mcp-server` on `hi-mcp/package-lock.json`
(`hi-mcp/cf/Dockerfile:9-13`). `hi-mcp/` is a workspace of the repository root, so every
`npm install` writes the root lockfile and never this one. It is stale already: its `hi-mcp-chat`
entry (`hi-mcp/package-lock.json:33`) lacks `@ai-sdk/google`. That does not break the build, because
the image copies only the manifests of the `hi-mcp` root, `hi-mcp-server` and `cf`; the next
dependency change in one of those does, in the Deploy step of `deploy-cloudflare.yml`.

**To do.** Build the image from the root lockfile and delete `hi-mcp/package-lock.json`: build context
at the repository root, every workspace manifest copied, a `.dockerignore` at the root, the start
command `npm start --workspace hi-mcp/hi-mcp-server`. Constraints: npm resolves workspaces nested in
workspaces poorly, so the image names the nested workspace from the root; the `cf` tooling (wrangler)
stays out of the image. Until then, [Refreshing the image lockfile](../../docs/setup/cloudflare-mcp-server.md#refreshing-the-image-lockfile)
is the manual step.

**Test.** `docker build` of the image (the Deploy step of `deploy-cloudflare.yml`, or locally as in
[Testing the container locally](../../docs/setup/cloudflare-mcp-server.md#testing-the-container-locally-no-cloudflare-account-needed))
passes after a version change in `hi-mcp/hi-mcp-server/package.json` with only the root lockfile
refreshed.

**Reproduce.** `hi-mcp/package-lock.json:33`: the `hi-mcp-chat` entry lacks the `@ai-sdk/google` of
`hi-mcp/hi-mcp-chat/package.json`.

## 5. The root npm scripts swallow the launcher's flags

**Problem.** The root scripts forward through a second npm (`package.json:15-18`:
`npm start --workspace minimal-hi-example`, `npm run start:cf --workspace minimal-hi-example`). The
inner npm takes `--no-open` as its own option, so `npm start -- --no-open` and
`npm run start:cf -- --no-open` from the root still open the browser, although the launcher's usage
comment (`minimal-hi-example/start.mjs:9`) names `npm start -- --no-open`. Positional arguments
(`npm start mistral <key>`) pass. `node minimal-hi-example/start.mjs --no-open` works.

**To do.** Let the root scripts run the launcher directly (`node minimal-hi-example/start.mjs`, with
`--dev` and `--cf`), so `npm start -- --no-open` reaches it.

**Test.** `npm start -- --no-open` from the root starts the servers without opening a browser.

**Reproduce.** `npm start -- --no-open` from the root opens the browser.

## 6. SIGTERM to the launcher leaves the servers running

**Problem.** `shutdown` (`minimal-hi-example/start.mjs:274-281`) kills the npm processes it spawned;
npm does not pass the signal on to the vite-node servers, so the MCP server (:3100) and the chat
backend (:3200) keep running after a `kill -TERM` of the launcher. The server's own orphan guard
(`hi-mcp/hi-mcp-server/server.ts:132-133`) arms only when its stdin is a pipe, and the launcher
spawns it with `stdio: 'inherit'` (`start.mjs:187`); the chat backend has no guard. Ctrl+C in a
terminal signals the whole process group and is not affected.

**To do.** Spawn the servers so that the launcher can end them: in a process group of their own
(`detached: true`, then `process.kill(-child.pid)`), or `vite-node` without the npm layer.

**Test.** Start `node minimal-hi-example/start.mjs --no-open mistral <key>`, send SIGTERM to its PID:
`lsof -ti tcp:3100,3200` lists nothing.

**Reproduce.** The same steps today: `lsof -ti tcp:3100,3200` lists both servers.
