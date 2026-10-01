# Cloudflare Deployment Skill — hi-mcp

**Load this skill when the task involves:** deploying, updating, or troubleshooting the
Cloudflare-hosted hi-mcp MCP server (`hi-mcp/cf/`) — `wrangler` deploys, the public URL,
container application cleanup, verification, teardown.

## Updating the server (one command, never a delete/rebuild)

The code lives in the repository; the cloud deployment is always replaced wholesale:

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
- a changed worker name requires editing `"name"` in `hi-mcp/cf/wrangler.jsonc` first

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
| deploy rejects `"instance_type": "basic"` | change to `standard-1` in `wrangler.jsonc` |
| first request takes ~10 s | the container boots on demand after sleeping — expected |
| agent gets "No HI page connected" | the store tab is not open — the agent names the URL to open (`HI_MCP_STORE_URL`, configured in `wrangler.jsonc` vars); open it and start planning |

## Where the details live

- Deploy/verify/teardown guide: [hi-mcp/docs/cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md)
- Connecting an agent (Mistral example): [hi-mcp/docs/connect-agent-to-cloud-mcp.md](../../hi-mcp/docs/connect-agent-to-cloud-mcp.md)
- Design and risks: [.agents/feature-analysis/mcp-cloudflare-containers-deployment.md](../feature-analysis/mcp-cloudflare-containers-deployment.md)
