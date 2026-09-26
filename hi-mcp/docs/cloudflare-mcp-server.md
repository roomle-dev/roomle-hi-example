# Cloudflare MCP Server — Setup Instructions

This documents the **Cloudflare** deployment of the `hi-mcp` workspace MCP server
(`hi-mcp-poc-json`): running as a **Cloudflare Container** behind a small Worker — in contrast
to the [local server](./local-mcp-server.md) and the [Azure App Service variant](./azure-mcp-server.md).
After this setup, anyone with the two URLs can use the PoC — no repository access, no install,
no tunnel. **Deployed and verified live (2026-09-26)**: the page's WebSocket passes through the
Worker into the container, and Mistral Le Chat drives the visible store session end-to-end.

```text
MCP client (anyone) ──https──> https://<worker>.<subdomain>.workers.dev/mcp
                                Worker (cf/src/worker.ts): routes /mcp and /bridge
                                     ▼
                          HiMcpContainer — the unchanged hi-mcp Node server
                          (Docker image, PORT env, sleeps after 15 min idle)
                                     ▲
store page (anyone's browser) ──wss──> …/bridge
```

The container is only a relay — the tool execution happens in the connected ligna-store page
(opened with the `mcp_server` parameter). Modeled on roomle-model-exporter's `cf/` deployment
(see the
[Cloudflare feature analysis](../../.agents/feature-analysis/mcp-cloudflare-containers-deployment.md)).

## Prerequisites

- A Cloudflare account with the **Workers Paid plan** (~$5/month) — Cloudflare Containers
  require it
- **Node 22+** for wrangler (on this machine: `~/.volta/bin` first on the PATH; the plain
  Node 20 fails with a version error)
- Nothing else: no domain, no certificates (Cloudflare terminates TLS), no CI

## Deploy (one command, run it yourself)

```bash
cd hi-mcp/cf
npm install            # once: the Worker + wrangler
npx wrangler login     # once: opens the browser with your Cloudflare account
npx wrangler deploy    # builds the container image and deploys the Worker
```

The login lasts — wrangler refreshes its token automatically, so deploys are just
`npx wrangler deploy`. Only when a deploy fails with `Unauthorized` (troubleshooting table
below) does a one-time `wrangler logout && wrangler login` fix the stale token.

The output prints the public URL — **it is the source of truth**. If wrangler rejects
`"instance_type": "basic"` in `wrangler.jsonc`, change it to `standard-1` and re-deploy.

## The public URL (anatomy, and the one classic mistake)

```text
https://<worker name>.<account subdomain>.workers.dev/mcp
```

- **worker name** = `"name"` in `hi-mcp/cf/wrangler.jsonc` (e.g. `hi-mcp-poc`)
- **account subdomain** = your account's workers.dev subdomain — visible on the dashboard
  (Workers & Pages → overview → "Your subdomain") and changeable there ("Change" — applies to
  every worker on the account, no redeploy)
- it is **not** the account ID (the 32-character hex that `wrangler whoami` prints) — a URL
  built from the account ID does not resolve, and every client will refuse it

## Verify, in this order

```bash
# 1. the endpoint answers (expect 200):
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<worker>.<subdomain>.workers.dev/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

2. Watch the server console: `npx wrangler tail` (in `hi-mcp/cf`) — the first request boots
   the container and must show `HI group orchestrator MCP server ready`.

3. Open the store with the `mcp_server` parameter:

```text
https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://<worker>.<subdomain>.workers.dev
```

4. `wrangler tail` shows `page connected` — the page's WebSocket reaches the container through
   the Worker (verified live; if it ever fails again, the fallback design is in the
   [feature analysis](../../.agents/feature-analysis/mcp-cloudflare-containers-deployment.md)).

5. Point any MCP client at `https://<worker>.<subdomain>.workers.dev/mcp` and run
   `get-plan-context` — the step-by-step for agents (with the Mistral example) is in
   [connect-agent-to-cloud-mcp.md](./connect-agent-to-cloud-mcp.md).

## The handout for colleagues (parallel use, per session)

Each user picks a **session name** (any short word, e.g. their first name) and appends it to
**both** URLs — every session id gets its own container, so users plan in parallel without
interfering; each agent drives exactly the kitchen in its user's own browser tab.

| Link | Where |
| ---- | ----- |
| Store page (browser, keep open) | `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://<worker>.<subdomain>.workers.dev&mcp_session=<name>` |
| MCP server (for their client's connector) | `https://<worker>.<subdomain>.workers.dev/mcp?session=<name>` |

Without a session name, everyone shares one container (`default`) — the previous
one-planning-session-at-a-time behavior. The store page's bridge reconnects on its own after the
container slept; the first request after a sleep takes ~10 s (container boot — one boot per
session).

## Updating after code changes

One command, in place — nothing is deleted, the URL stays the same:

```bash
cd hi-mcp/cf && npx wrangler deploy
```

Optionally verify locally first: `npm test` in `hi-mcp/`, or the docker build below.

## Testing the container locally (no Cloudflare account needed)

The exact image Cloudflare builds runs locally:

```bash
cd hi-mcp
docker build -f cf/Dockerfile -t hi-mcp-poc-cf .
docker run -d --name hi-mcp-cf-test -p 3101:3000 hi-mcp-poc-cf
docker logs -f hi-mcp-cf-test      # Local: http://localhost:3000/mcp
# then point store/MCP client at http://127.0.0.1:3101 (mcp_server=http://127.0.0.1:3101)
docker rm -f hi-mcp-cf-test
```

## Teardown (the container app needs its own delete)

`wrangler delete` removes the Worker but **leaves the container application running as an
orphan** (still billing, and it blocks the next deploy with a "different durable object
namespace" error). Full teardown:

```bash
cd hi-mcp/cf
npx wrangler delete                  # removes the Worker (the public URL dies)
npx wrangler containers list         # find the orphan, e.g. hi-mcp-poc-himcpcontainer
npx wrangler containers delete <ID>  # stop and remove the container application
```

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| wrangler refuses to start | Node < 22 on the PATH — use `~/.volta/bin` first |
| deploy uploads the Worker, then `Unauthorized` | **nothing to delete** — the container-app update step lost authorization (the Worker upload itself succeeded). In order: retry the deploy → fresh `wrangler logout && wrangler login` → check the container app state in the dashboard (Containers → `hi-mcp-poc-himcpcontainer`) → fall back to an API token: dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template, then `CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy`. Until a deploy fully succeeds, the running container keeps the previous image |
| `Cannot resolve host` / client refuses the URL | URL built from the **account ID** instead of the account **subdomain** — take the URL from the deploy output |
| deploy: "already an application … different durable object namespace" | orphaned container app from an earlier `wrangler delete` — `wrangler containers list` + `wrangler containers delete <ID>` |
| deploy rejects the config | `instance_type` naming — use `standard-1`; or Containers require the Workers Paid plan |
| First request is slow (~10 s) | the container boots on demand after sleeping — expected, not an error |
| `page connected` never appears in `wrangler tail` | (a) the store URL lacks `&mcp_server=…`, (b) the deployed store build lacks the `feat/hi-mcp` branch, (c) report the tail output (fallback design exists) |
| Tool error `No HI page connected` | the store tab is not open or lost the connection — reload it with the `mcp_server` parameter |
| Tool error `... is not a function` | the `bo-test` UI lacks the HI planner APIs — same as in every other setup |
| `initialize` returns 406 | the client must accept `application/json, text/event-stream` — all MCP SDK clients do |
