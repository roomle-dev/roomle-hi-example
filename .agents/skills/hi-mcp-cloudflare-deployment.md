# Cloudflare Deployment Skill — hi-mcp

**Load this skill when the task involves:** deploying, updating, or troubleshooting the
Cloudflare-hosted hi-mcp MCP server (`hi-mcp/cf/`) — `wrangler` deploys, the public URL,
container application cleanup, verification, teardown.

## Updating the server (one command, never a delete/rebuild)

The code lives in the repository; the cloud deployment is always replaced wholesale.

**The normal path is a push to `release/cloudflare`.** The workflow
`.github/workflows/deploy-cloudflare.yml` runs `npm ci`, the `hi-mcp` typecheck and unit tests,
`npx wrangler deploy`, and an `initialize` → 200 check against the public URL (about 1.5 min, one
deploy at a time). To release `master`:

```bash
git fetch origin && git push origin origin/master:release/cloudflare   # fast-forward
```

The credentials are the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets of the GitHub
environment `cloudflare`, which only `release/cloudflare` may use. The token comes from the
template "Edit Cloudflare Workers" plus **Account · Containers · Edit**. The one-time setup is in
[cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md#one-time-setup-repository-admin).

By hand (for dry runs and emergencies — the next push to `release/cloudflare` replaces a manual
deploy again):

```bash
cd hi-mcp/cf
npx wrangler deploy
```

or, from the repository root, `npm run deploy:cf` (the same command; arguments after `--` go to
wrangler, e.g. `npm run deploy:cf -- --dry-run` builds the image without deploying).

- rebuilds the container image from the repository-root context and replaces the running deployment
  **in place** — same Worker, same container app, **same URL**; connectors and store links keep
  working
- wrangler requires **Node 22+** (on this machine: put `~/.volta/bin` first on the PATH; the
  plain Node 20 fails with a version error)
- the login lasts — wrangler refreshes its token; every deploy is just `npx wrangler deploy`.
  A re-login (`wrangler logout && wrangler login`) is only the one-time recovery when a deploy
  fails with `Unauthorized` (see pitfalls below)
- a changed worker name requires editing `"name"` in `hi-mcp/cf/wrangler.jsonc` first, and then
  the URL in `HI_MCP_STORE_URL` (the `vars` of the same file), in `CLOUDFLARE_MCP_SERVER_URL`
  (`minimal-hi-example/start.mjs`, used by `npm run start:cf`) and in the verify step of
  `.github/workflows/deploy-cloudflare.yml`

## URL anatomy (where the public URL comes from)

```text
https://<worker name>.<account subdomain>.workers.dev/mcp
```

- **worker name** — `"name"` in `hi-mcp/cf/wrangler.jsonc`
- **account subdomain** — the account's workers.dev subdomain (dashboard: Workers & Pages →
  overview → "Your subdomain" → Change; changing it moves every worker on the account,
  no redeploy needed)
- it is **not** the account ID (the 32-character hex from `wrangler whoami`) — a URL built from
  the account ID does not resolve at all
- the `wrangler deploy` output prints the full URL — it is the source of truth

## Verification after every deploy

1. `initialize` over the public URL → HTTP 200 (the exact curl command is in
   [docs/setup/cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md))
2. open the store with `store.stage=INT&mcp_server=<the URL>&mcp_session=<name>` and start planning
   (no chat model or key needed) → `npx wrangler tail` shows `page connected`;
   `get-plan-context` on `/mcp?session=<name>` returns that planner's context
3. or, without the store: `npm run start:cf` opens the HI example against the deployment
   (session = the OS user name, page port 3000 only) → the page log shows
   `MCP connected to the MCP server`, and `get-plan-context` on the printed MCP URL returns the
   articles

The page's WebSocket upgrade passes through the Worker into the container; the fallback, should it
ever stop passing, is in the [Cloudflare ADR](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md).

For session-routing or bridge changes, run the [live session checks](../../docs/setup/cloudflare-mcp-server.md#live-session-checks): independent pages/devices, shared-session ownership and reconnect/handoff, and five-session capacity/recovery. Authenticate to the hosted store first. Dummy chat keys and direct MCP requests suffice; do not submit model prompts just to check isolation. A synthetic planner probe checks the live server but does not establish hosted-store plan changes or chat feedback.

Container startup belongs to SDK `containerFetch`, after setting the session-specific `HI_MCP_STORE_URL`. It returns 503 for exhausted capacity, 429 for startup throttling, and 500 for other startup failures. Keep that error handling in the request path; `cf/tests/container-startup-errors.test.ts` exercises the installed SDK with failing startup.

## Verifying a workflow or lockfile change on Linux

The workflow runs on `ubuntu-24.04` with Node 22. A lockfile written from a macOS `node_modules`
lists only the macOS binary of a native package ([npm/cli#4828](https://github.com/npm/cli/issues/4828)),
so a green run on macOS proves nothing about the runner. Run the workflow's steps on Linux x64,
against a clean copy of the branch:

```bash
docker run --rm --platform linux/amd64 -v <clean copy>:/src:ro node:22 bash -c \
  'cp -r /src /work && cd /work && npm ci && cd hi-mcp && npm run typecheck && npx tsc --noEmit --project cf/tsconfig.json && npm test'
```

To add the missing platform binaries of a package, re-resolve it on Linux without a
`node_modules` (a copy of the `package.json` files and the lockfile in `<relock>`):

```bash
docker run --rm --platform linux/amd64 -v <relock>:/relock -w /relock \
  node:22 npm update <package> --package-lock-only --ignore-scripts
```

Removing the package's entries and running `npm install --package-lock-only` does not help: npm
reports "up to date" and leaves the package out.

## Teardown gotcha: `wrangler delete` leaves the container app behind

Deleting the Worker (`npx wrangler delete`) does **not** remove the container application —
it keeps running (and billing) as an orphan, and the next deploy fails with
*"already an application with the name … deployed that is associated with a different durable
object namespace"*. Full teardown:

```bash
npx wrangler delete                        # removes the Worker (public URL dies)
npx wrangler containers list               # find the orphan, e.g. hi-mcp-poc-himcpcontainer
npx wrangler containers delete <ID>        # stop and remove the container application
```

## Common pitfalls

| Symptom | Fix |
| ------- | --- |
| wrangler refuses to start | Node < 22 on the PATH — use `~/.volta/bin` first |
| image build: `npm ci` … `lock file's <pkg>@<a> does not satisfy <pkg>@<b>` | a workspace manifest and the root `package-lock.json` disagree — update the root lockfile and verify the Linux image build; see [Updating image dependencies](../../docs/setup/cloudflare-mcp-server.md#updating-image-dependencies) |
| `Cannot resolve host` / a client refuses the URL | URL built from the account ID instead of the account subdomain — take the URL from the deploy output |
| deploy fails with "different durable object namespace" | orphaned container app from an earlier delete — `wrangler containers list` + `containers delete` |
| deploy uploads the Worker, then `Unauthorized` | **nothing to delete** — the container-app update step lost authorization. In order: retry the deploy → fresh `wrangler logout && wrangler login` → check the container app state in the dashboard → fall back to an API token: dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template, then `CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy` |
| GitHub deploy uploads the Worker, then `Unauthorized`/403 at the container step | the API token lacks **Account · Containers · Edit** — edit the token in Cloudflare, then "Re-run jobs" |
| GitHub run, test step: `Cannot find module @rollup/rollup-linux-x64-gnu` (or another Linux binary) | the root lockfile lost the Linux binaries (npm/cli#4828, a lockfile written from a macOS `node_modules`). Re-resolve on Linux: `npm update <package> --package-lock-only --ignore-scripts` in `node:22` with `--platform linux/amd64`, then run the workflow's steps in that container — see [Verifying a workflow or lockfile change on Linux](#verifying-a-workflow-or-lockfile-change-on-linux) |
| GitHub deploy step is not authenticated | the secrets are missing in the `cloudflare` environment, or the run is not on `release/cloudflare` (the environment's branch rule) |
| deploy rejects `"instance_type": "basic"` | change to `standard-1` in `wrangler.jsonc` |
| first request takes ~10 s | the container boots on demand after sleeping — expected |
| agent gets "No HI page connected" | no page is connected to this session — open the suggested store URL and start planning. `HiMcpContainer.fetch` adds the requesting session, or `mcp_session=default` for an unnamed agent, to `HI_MCP_STORE_URL` before container startup; the page needs no chat credentials. Keep the tab open |

## Where the details live

- Deploy/verify/teardown guide: [docs/setup/cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md)
- Connecting an agent (Mistral example): [docs/setup/connect-agent-to-cloud-mcp.md](../../docs/setup/connect-agent-to-cloud-mcp.md)
- Decisions: [ADR 0004 — the server on Cloudflare Containers](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md),
  [ADR 0005 — deploy from `release/cloudflare`](../decisions/0005-deploy-hi-mcp-from-release-cloudflare.md)
- Open issues: [deployment-and-session-issues.md](../backlog/deployment-and-session-issues.md)
