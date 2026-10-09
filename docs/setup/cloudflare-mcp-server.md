# Cloudflare MCP Server — Setup Instructions

This documents the **Cloudflare** deployment of the `hi-mcp` workspace MCP server
(`hi-mcp-server`): running as a **Cloudflare Container** behind a small Worker — in contrast
to the [local server](./local-mcp-server.md) and the [Azure App Service variant](./azure-mcp-server.md).
After this setup, anyone with the two URLs can use the PoC — no repository access, no install,
no tunnel. The page's WebSocket passes through the Worker into the container.

```text
MCP client (anyone) ──https──> https://<worker>.<subdomain>.workers.dev/mcp
                                Worker (cf/src/worker.ts): routes /mcp and /bridge
                                     ▼
                          HiMcpContainer — the unchanged hi-mcp Node server
                          (Docker image, PORT env, sleeps after 15 min idle)
                                     ▲
store page (anyone's browser) ──wss──> …/bridge
```

The container runs the tools and relays their planner calls into the connected ligna-store page
(opened with `mcp_server` and a matching `mcp_session`) — the planning session itself lives in that page.
Modeled on roomle-model-exporter's `cf/` deployment. The decisions and the rejected alternatives:
[ADR 0004 — the server on Cloudflare Containers](../../.agents/decisions/0004-hi-mcp-server-on-cloudflare-containers.md),
[ADR 0005 — deploy from `release/cloudflare`](../../.agents/decisions/0005-deploy-hi-mcp-from-release-cloudflare.md).

## Prerequisites

- A Cloudflare account with the **Workers Paid plan** (~$5/month) — Cloudflare Containers
  require it
- **Node 22+** for wrangler (on this machine: `~/.volta/bin` first on the PATH; the plain
  Node 20 fails with a version error)
- Nothing else: no domain, no certificates (Cloudflare terminates TLS)
- For deploys from GitHub: the one-time [setup of the token and the environment](#one-time-setup-repository-admin)

## Deploy from GitHub (push to `release/cloudflare`)

The workflow [`deploy-cloudflare.yml`](../../.github/workflows/deploy-cloudflare.yml) runs on
every push to `release/cloudflare`:

1. `npm ci`
2. the typecheck and the unit tests of the `hi-mcp` workspace
3. `npx wrangler deploy` — builds and pushes the image, uploads the Worker
4. an `initialize` against the public URL, which must answer 200

A failing test or image build deploys nothing. Only one deploy runs at a time; a second push
waits for the first. A run takes about 1.5 minutes.

To release `master`:

```bash
git fetch origin && git push origin origin/master:release/cloudflare   # fast-forward
```

Watch the run with `gh run watch --repo roomle-dev/roomle-hi-example` or in the Actions tab. To
retry a failed deploy, use "Re-run jobs" there.

A manual `npm run deploy:cf` (below) still replaces the deployment. After a manual deploy, the
running server no longer matches `release/cloudflare` until the next push, so keep manual deploys
for dry runs and emergencies.

### One-time setup (repository admin)

1. **Cloudflare API token** — create it in the account that owns `hi-mcp-poc`:
   1. Go to My Profile → API Tokens → Create Token and pick the template
      **"Edit Cloudflare Workers"**.
   2. Keep the template's permissions and add one row: **Account · Containers · Edit**.
   3. Under Account Resources, include this one account only.
   4. Create the token and copy it (it is shown only once).
   5. Get the account ID: `npx wrangler whoami` in `hi-mcp/cf` prints it.
2. **GitHub environment `cloudflare` with the two secrets.** The environment hands its secrets
   only to jobs that run for `release/cloudflare`. The repository is public, so no workflow on
   another branch may read them.

```bash
R=roomle-dev/roomle-hi-example
echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
  | gh api -X PUT repos/$R/environments/cloudflare --input -
gh api -X POST repos/$R/environments/cloudflare/deployment-branch-policies \
  -f name=release/cloudflare -f type=branch
gh secret set CLOUDFLARE_API_TOKEN  --env cloudflare --repo $R   # prompts for the token
gh secret set CLOUDFLARE_ACCOUNT_ID --env cloudflare --repo $R   # prompts for the account id
```

The same in the web UI:

1. Go to Settings → Environments → New environment `cloudflare`.
2. Under Deployment branches and tags, choose "Selected branches and tags" and add
   `release/cloudflare`.
3. Add both secrets as environment secrets.

## Deploy by hand (one command, run it yourself)

```bash
cd hi-mcp/cf
npm install            # once: the Worker + wrangler
npx wrangler login     # once: opens the browser with your Cloudflare account
npx wrangler deploy    # builds the container image and deploys the Worker
```

The login lasts — wrangler refreshes its token automatically, so deploys are just
`npx wrangler deploy`, or `npm run deploy:cf` from the repository root (the same command, run in
`hi-mcp/cf`; arguments after `--` go to wrangler, e.g. `npm run deploy:cf -- --dry-run`). Only when a deploy fails with `Unauthorized` (troubleshooting table
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

3. Open the store with `mcp_server` and a session name, then start planning. The bridge needs
   no chat model or API key:

```text
https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://<worker>.<subdomain>.workers.dev&mcp_session=<name>
```

4. `wrangler tail` shows `page connected` — the page's WebSocket reaches the container through
   the Worker (if it ever stops passing, the fallback is in the
   [Cloudflare ADR](../../.agents/decisions/0004-hi-mcp-server-on-cloudflare-containers.md)).

5. Point any MCP client at `https://<worker>.<subdomain>.workers.dev/mcp?session=<name>` (the
   session of step 3) and run `get-plan-context` — the step-by-step for agents (with the Mistral example) is in
   [connect-agent-to-cloud-mcp.md](./connect-agent-to-cloud-mcp.md).

## The handout for colleagues (parallel use, per session)

The store bridge generates a fresh session ID per page automatically. Two tabs opened with the same
store URL, without `mcp_session`, get separate containers and independent planners. At most five
containers can run at once; when capacity is exhausted, the chat stays disabled and reports that
it cannot connect. The bridge retries every three seconds. Closing a page does not free its
container immediately: it sleeps after 15 minutes without activity. Once a slot is available,
the waiting page can connect to its own planner.

Container startup and forwarding use the SDK's `containerFetch`. Exhausted capacity returns HTTP
503, startup throttling returns 429, and other startup failures return 500. Browser WebSocket
errors do not expose that HTTP response body, so the chat reports a connection failure rather
than a capacity-specific error.

An external MCP client that must share a page's planner still needs a known
session name: supply `mcp_session=<name>` on that store page and use the same name in the client URL.

| Link | Where |
| ---- | ----- |
| Store page (browser, keep open) | `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://<worker>.<subdomain>.workers.dev&mcp_session=<name>` |
| MCP server (for their client's connector) | `https://<worker>.<subdomain>.workers.dev/mcp?session=<name>` |

Without a session name, an external MCP client connects to `default`; use `mcp_session=default`
to share its planner. A store URL without `mcp_session` generates its own session. Before starting
each container, `HiMcpContainer.fetch` adds the request's session (or `default`) to `HI_MCP_STORE_URL`.
The no-page error therefore suggests a store link for that agent's container, preserving the
configured stage and server. Chat is optional: add `model` and `api_key` to show the store chat.
The store page's bridge reconnects on its own after the
container slept; the first request after a sleep takes ~10 s (container boot — one boot per
session). Which setup needs which URL parameters — local server, deployed store, cloud server,
parallel sessions — is covered by the **setup matrix** in the
[PoC README](../../hi-mcp/hi-mcp-server/README.md#the-setup-matrix-which-setup-needs-which-url-parameters).

### Live session checks

Use the hosted test store and the public Worker, with temporary plans. Authenticate to the store
before starting; a blank page with HTTP 401 is its Basic Auth challenge, not a bridge failure.
Chat controls can be checked with a supported `model` and a dummy `api_key` without submitting a
prompt. Direct MCP calls with the page's captured `session` and `client` verify the planner and
browser CORS without sending plan data to an AI provider.

| Check | Expected result |
| --- | --- |
| Same store URL in two pages, without `mcp_session`; repeat on two devices | Different generated sessions; both receive bridge `ready`. A reversible edit and undo in one plan leave the other unchanged. Cross-client requests return 409. |
| Two pages with the same explicit `mcp_session` | The owner keeps working; the second bridge closes with 4409, shows the occupied message, disables chat and stops automatic retries. |
| Reconnect and owner handoff | Reconnecting within a page keeps its identity. After the owner disconnects, another page may become the owner; pending calls fail and the old client's requests return 409. Reloading a page generates a new identity. |
| Five controlled sessions and a sixth | The first five stay usable. The sixth has no `ready` or other planner's context and keeps chat disabled. After a controlled session closes and its container sleeps, the sixth connects to its own planner. |

Record Worker/image and store versions, session/client IDs, close codes, HTTP and MCP results,
plan states and visible feedback. A server test using synthetic planner replies verifies routing
and ownership; checking actual plan changes and chat feedback requires the real hosted store.
Close the test pages and stop polling their sessions after the checks so their containers sleep.

## Browser clients (CORS)

Besides server-side MCP clients, a browser page may call `/mcp` directly: the ligna-store chat
window (`?store.stage=INT&model=…&api_key=…&mcp_server=<this URL>`) runs the Vercel AI SDK in the
page and takes its tools from here. The server answers such cross-origin calls only for the page
origins in `HI_MCP_PAGE_ORIGINS` (default `http://localhost:3000`, `http://127.0.0.1:3000`,
`https://www.roomle.com`) — the same list that guards the `/bridge` WebSocket. Allowed origins get
the CORS headers and a `204` preflight; any other origin gets no CORS headers and a `403` preflight,
so the browser blocks it. The container does not set the variable, so the default applies; a store
on another origin needs it in the container's `envVars` (`cf/src/container.ts`).

Check after a deploy (expect `204` and the origin echoed back):

```bash
curl -s -o /dev/null -D - -X OPTIONS https://<worker>.<subdomain>.workers.dev/mcp \
  -H "Origin: https://www.roomle.com" -H "Access-Control-Request-Method: POST" \
  | grep -i -E "^HTTP|access-control-allow-origin"
```

A browser that cached a page from before the deploy may keep failing with "Failed to fetch" —
reload without cache.

## Trying it with the HI example (no store)

From the repository root, `npm run start:cf` opens the HI presets example connected to this
deployment. `npm run start:cf mistral <api-key>` also starts the built-in chat. No local MCP
server starts. The page connects to `wss://<worker>.<subdomain>.workers.dev/bridge?session=<OS user name>`,
and the launcher prints `https://<worker>.<subdomain>.workers.dev/mcp?session=<OS user name>` for
external MCP clients. The example has to run on port 3000, because `http://localhost:3000` is the
only local origin in the server's default `HI_MCP_PAGE_ORIGINS`, and the launcher refuses another
`EXAMPLE_PORT`. The OS user name keeps the session the same across restarts and networks, so an
external connector is set up once; two machines with the same user name share the container. The
example always talks to the last deployed image, so deploy first to try server changes from a
branch. The Worker URL is the constant `CLOUDFLARE_MCP_SERVER_URL` in
`minimal-hi-example/start.mjs`, so a changed worker name needs it updated as well, together with
the URL in the verify step of `.github/workflows/deploy-cloudflare.yml`.

## Updating after code changes

Push to `release/cloudflare` ([Deploy from GitHub](#deploy-from-github-push-to-releasecloudflare)).
The deployment is replaced in place: nothing is deleted, and the URL stays the same. By hand, the
same is one command:

```bash
npm run deploy:cf        # from the repository root; same as: cd hi-mcp/cf && npx wrangler deploy
```

Optionally verify locally first: `npm test` in `hi-mcp/`, or the docker build below.

## Testing the container locally (no Cloudflare account needed)

The exact image Cloudflare builds runs locally:

```bash
# from the repository root
docker build --platform linux/amd64 -f hi-mcp/cf/Dockerfile -t hi-mcp-poc-cf .
docker run -d --platform linux/amd64 --name hi-mcp-cf-test -p 3101:3000 hi-mcp-poc-cf
docker logs -f hi-mcp-cf-test      # Local: http://localhost:3000/mcp
# then point store/MCP client at http://127.0.0.1:3101 (mcp_server=http://127.0.0.1:3101)
docker rm -f hi-mcp-cf-test
```

## Updating image dependencies

The image and CI use the repository-root `package-lock.json`. Wrangler's `image_build_context`
is `../..` relative to `hi-mcp/cf/wrangler.jsonc`, so every `COPY` path is relative to the repository
root. The Dockerfile copies all five workspace manifests before running
`npm ci --workspace hi-mcp/hi-mcp-server --omit=dev`; the workspace path selects the server alone.
Chat/provider SDKs, Cloudflare tooling and development packages stay out of the runtime image.
The root `.dockerignore` includes only the manifests, lockfile, shared TypeScript config and server
source, keeping host dependencies and other repository content outside the context.

After changing a workspace dependency, update the root lockfile:

```bash
# from the repository root
npm install --package-lock-only --ignore-scripts
```

Keep the manifests and root lockfile in the same commit. Check the local image build above and
the [Linux CI steps](../../.agents/skills/hi-mcp-cloudflare-deployment.md#verifying-a-workflow-or-lockfile-change-on-linux).
The deploy workflow builds this same image after its typechecks and tests.

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
| image build: `npm ci` … `Invalid: lock file's <pkg>@<a> does not satisfy <pkg>@<b>` | a workspace manifest and the root `package-lock.json` disagree — update the root lockfile and verify the Linux build; see [Updating image dependencies](#updating-image-dependencies) |
| deploy uploads the Worker, then `Unauthorized` | **nothing to delete** — the container-app update step lost authorization (the Worker upload itself succeeded). In order: retry the deploy → fresh `wrangler logout && wrangler login` → check the container app state in the dashboard (Containers → `hi-mcp-poc-himcpcontainer`) → fall back to an API token: dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template, then `CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy`. Until a deploy fully succeeds, the running container keeps the previous image |
| GitHub deploy uploads the Worker, then `Unauthorized`/403 at the container step | the API token lacks **Account · Containers · Edit** — edit the token in Cloudflare, then "Re-run jobs" |
| GitHub run, test step: `Cannot find module @rollup/rollup-linux-x64-gnu` (or another `…-linux-x64…` binary) | the root `package-lock.json` lost the Linux binaries ([npm/cli#4828](https://github.com/npm/cli/issues/4828): a lockfile written from a macOS `node_modules`). Re-resolve the package on Linux with `npm update <package> --package-lock-only --ignore-scripts` in `node:22` (`--platform linux/amd64`), then run the workflow's steps in the same container — see [Verifying a workflow or lockfile change on Linux](../../.agents/skills/hi-mcp-cloudflare-deployment.md#verifying-a-workflow-or-lockfile-change-on-linux) |
| GitHub deploy step: `CLOUDFLARE_API_TOKEN` missing / not authenticated | the secrets are not set in the `cloudflare` environment, or the run is not on `release/cloudflare` — see [One-time setup](#one-time-setup-repository-admin) |
| `Cannot resolve host` / client refuses the URL | URL built from the **account ID** instead of the account **subdomain** — take the URL from the deploy output |
| deploy: "already an application … different durable object namespace" | orphaned container app from an earlier `wrangler delete` — `wrangler containers list` + `wrangler containers delete <ID>` |
| deploy rejects the config | `instance_type` naming — use `standard-1`; or Containers require the Workers Paid plan |
| First request is slow (~10 s) | the container boots on demand after sleeping — expected, not an error |
| `page connected` never appears in `wrangler tail` | (a) the store URL lacks a valid `mcp_server` or its planner is not started, (b) the page origin is not in `HI_MCP_PAGE_ORIGINS`, (c) the WebSocket upgrade does not pass the Worker — the fallback is in the [Cloudflare ADR](../../.agents/decisions/0004-hi-mcp-server-on-cloudflare-containers.md) |
| Tool error `No HI page connected` | no page is connected to this session — open the suggested store URL and start planning; its `mcp_session` matches the client's `?session=<name>` or `default` when absent. Keep the tab open |
| The store chat reports the planner in use (WebSocket close 4409) | another page holds this session's planner (two pages with the same `mcp_session`) — the first page keeps it; close it or drop `mcp_session` |
| Tool error `... is not a function` | the `bo-test` UI lacks the HI planner APIs — same as in every other setup |
| `initialize` returns 406 | the client must accept `application/json, text/event-stream` — all MCP SDK clients do |
