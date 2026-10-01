# Cloudflare Deployment Skill — hi-mcp

**Load this skill when the task involves:** deploying, updating, or troubleshooting the
Cloudflare-hosted hi-mcp MCP server (`hi-mcp/cf/`) — `wrangler` deploys, the public URL,
container application cleanup, verification, teardown.

## Updating the server (one command, never a delete/rebuild)

The code lives in the repository; the cloud deployment is always replaced wholesale.

**The normal path is a push to `release/cloudflare`.** The workflow
`.github/workflows/deploy-cloudflare.yml` runs `npm ci`, the `hi-mcp` typecheck and unit tests,
`npx wrangler deploy`, and an `initialize` → 200 check against the public URL (about 3 min, one
deploy at a time). To release `master`:

```bash
git fetch origin && git push origin origin/master:release/cloudflare   # fast-forward
```

The credentials are the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets of the GitHub
environment `cloudflare`, which only `release/cloudflare` may use. The token comes from the
template "Edit Cloudflare Workers" plus **Account · Containers · Edit**. The one-time setup is in
[cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md#one-time-setup-repository-admin).

By hand (for dry runs and emergencies — the next push to `release/cloudflare` replaces a manual
deploy again):

```bash
cd hi-mcp/cf
npx wrangler deploy
```

or, from the repository root, `npm run deploy:cf` (the same command; arguments after `--` go to
wrangler, e.g. `npm run deploy:cf -- --dry-run` builds the image without deploying).

- rebuilds the container image from the `hi-mcp/` context and replaces the running deployment
  **in place** — same Worker, same container app, **same URL**; connectors and store links keep
  working
- wrangler requires **Node 22+** (on this machine: put `~/.volta/bin` first on the PATH; the
  plain Node 20 fails with a version error)
- the login lasts — wrangler refreshes its token; every deploy is just `npx wrangler deploy`.
  A re-login (`wrangler logout && wrangler login`) is only the one-time recovery when a deploy
  fails with `Unauthorized` (see pitfalls below)
- a changed worker name requires editing `"name"` in `hi-mcp/cf/wrangler.jsonc` first, and then
  the URL in `CLOUDFLARE_MCP_SERVER_URL` (`minimal-hi-example/start.mjs`, used by `npm run start:cf`)
  and in the verify step of `.github/workflows/deploy-cloudflare.yml`

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
   [hi-mcp/docs/cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md))
2. open the store with `&mcp_server=<the URL>` → `npx wrangler tail` shows `page connected`
3. or, without the store: `npm run start:cf` opens the HI example against the deployment
   (session = the OS user name, page port 3000 only) → the page log shows
   `MCP connected to the MCP server`, and `get-plan-context` on the printed MCP URL returns the
   articles

Both verified live on 2026-09-26: the page's WebSocket upgrade passes through the Worker into
the container, and Mistral Le Chat drives the visible store session end-to-end.

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
| image build: `npm ci` … `lock file's <pkg>@<a> does not satisfy <pkg>@<b>` | the image installs from `hi-mcp/package-lock.json`, which `npm install` never updates (`hi-mcp/` is a workspace of the repository root, so npm writes the root lockfile). Regenerate it outside the root workspace, as described in [Refreshing the image lockfile](../../hi-mcp/docs/cloudflare-mcp-server.md#refreshing-the-image-lockfile) |
| `Cannot resolve host` / a client refuses the URL | URL built from the account ID instead of the account subdomain — take the URL from the deploy output |
| deploy fails with "different durable object namespace" | orphaned container app from an earlier delete — `wrangler containers list` + `containers delete` |
| deploy uploads the Worker, then `Unauthorized` | **nothing to delete** — the container-app update step lost authorization. In order: retry the deploy → fresh `wrangler logout && wrangler login` → check the container app state in the dashboard → fall back to an API token: dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template, then `CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy` |
| GitHub deploy uploads the Worker, then `Unauthorized`/403 at the container step | the API token lacks **Account · Containers · Edit** — edit the token in Cloudflare, then "Re-run jobs" |
| GitHub run, test step: `Cannot find module @rollup/rollup-linux-x64-gnu` (or another Linux binary) | the root lockfile lost the Linux binaries (npm/cli#4828, a lockfile written from a macOS `node_modules`). Re-resolve on Linux: `npm update <package> --package-lock-only --ignore-scripts` in `node:22` with `--platform linux/amd64`, then run the workflow's steps in that container. Verify every workflow or lockfile change there — macOS proves nothing about the runner ([bug analysis](../bug-analysis/deploy-workflow-misses-linux-rollup-binary.md)) |
| GitHub deploy step is not authenticated | the secrets are missing in the `cloudflare` environment, or the run is not on `release/cloudflare` (the environment's branch rule) |
| deploy rejects `"instance_type": "basic"` | change to `standard-1` in `wrangler.jsonc` |
| first request takes ~10 s | the container boots on demand after sleeping — expected |
| agent gets "No HI page connected" | the store tab is not open — the agent names the URL to open (`HI_MCP_STORE_URL`, configured in `wrangler.jsonc` vars); open it and start planning |

## Where the details live

- Deploy/verify/teardown guide: [hi-mcp/docs/cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md)
- Connecting an agent (Mistral example): [hi-mcp/docs/connect-agent-to-cloud-mcp.md](../../hi-mcp/docs/connect-agent-to-cloud-mcp.md)
- Design and risks: [.agents/feature-analysis/mcp-cloudflare-containers-deployment.md](../feature-analysis/mcp-cloudflare-containers-deployment.md)
