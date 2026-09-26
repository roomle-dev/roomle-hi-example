# Azure MCP Server — Setup Instructions

This documents the **Azure** deployment of the `hi-mcp` workspace MCP server
(`hi-mcp-poc-json`): running as an Azure App Service with a public HTTPS endpoint — in contrast
to the [local server](./local-mcp-server.md). After this setup, any browser can hold the ligna-store
session and any MCP client (on any machine) can drive it:

```text
AI agent (any MCP client, anywhere) --https--> https://<app>.azurewebsites.net/mcp
                                               Azure App Service (Linux, Node 20, TLS included)
                                               |  wss://<app>.azurewebsites.net/bridge  (page connects out)
                                               v
                                   deployed ligna-store page (https://www.roomle.com/…&mcp_server=…)
                                   executes tools against roomDesignerApi.extended
```

The same Node process serves both endpoints. App Service terminates TLS in front — the server code
runs plain HTTP/WS behind it, so no certificates are needed. WebSockets must be **enabled** (step 6
below).

## Prerequisites

- The local setup works (see [local-mcp-server.md](./local-mcp-server.md)) — Azure changes only
  **where** the server runs, so verify the chain locally first
- Azure CLI installed and logged in:

  ```bash
  brew install azure-cli     # once
  az login                   # browser login with the work account
  ```

- **Access rights**: at least *Reader* on the subscription (you can see it) and **Contributor on
  one resource group** to create and manage the app. If `az group create` fails with
  `AuthorizationFailed`, forward this request to the sys admin:

  > I need to run a small time-boxed Node.js PoC web app (App Service, Linux, B1, ~€13/month) in a
  > DevTest subscription. Please create an empty resource group (suggested `rg-hi-mcp-poc`, region
  > West Europe) and grant **Contributor on that resource group** to my user — or grant me
  > Contributor on an existing DevTest resource group. I will create exactly one App Service plan
  > and one web app in it and delete the whole resource group myself after the PoC.

- Cost decision: **B1 Basic** (~€13/month, no cold starts) or **F1 Free** (cold starts: the first
  request after idle pays ~30 s wake-up) — the commands below use B1

## Setup runbook

All commands are copy-paste. Values used throughout: resource group `rg-hi-mcp-poc`, plan
`hi-mcp-plan`, app name `hi-mcp-poc-json` (becomes `https://hi-mcp-poc-json.azurewebsites.net`),
region `westeurope`. Adapt if your admin created differently named resources.

### 1. Select the subscription

```bash
az account list -o table
az account set --subscription <SubscriptionId of a DevTest subscription>
```

### 2. Create the resource group

```bash
az group create --name rg-hi-mcp-poc --location westeurope
```

Expected: JSON with `"name": "rg-hi-mcp-poc"`, `"provisioningState": "Succeeded"`.
If `AuthorizationFailed` → see the admin request in Prerequisites.

### 3. Create the App Service plan (Linux, B1)

```bash
az appservice plan create --resource-group rg-hi-mcp-poc --name hi-mcp-plan \
  --sku B1 --is-linux
```

### 4. Create the web app (Node 20 LTS)

```bash
az webapp create --resource-group rg-hi-mcp-poc --name hi-mcp-poc-json \
  --plan hi-mcp-plan --runtime "NODE:20-lts"
```

Expected: JSON with `"state": "Running"` and the URL
`https://hi-mcp-poc-json.azurewebsites.net`. If the name is taken globally
(`NameAlreadyExists` → pick another, e.g. `hi-mcp-poc-json-<your suffix>`) — the app name must be
globally unique because it is a public domain.

### 5. Enable WebSockets (required for the page bridge)

```bash
az webapp config set --resource-group rg-hi-mcp-poc --name hi-mcp-poc-json \
  --web-sockets-enabled true
```

Portal equivalent: App → **Settings → Configuration → General settings → Web sockets → On → Save**.

### 6. Package and deploy the server

The deployment unit is the **`hi-mcp` workspace folder** (root `package.json` with the
`workspaces` field plus the `hi-mcp-poc-json/` folder) — not the repository root: App Service
expects the app's `package.json` at the root of the package.

```bash
cd <path to>/roomle-hi-example/hi-mcp
zip -r ../hi-mcp-deploy.zip . -x "node_modules/*"
cd ..
az webapp deploy --resource-group rg-hi-mcp-poc --name hi-mcp-poc-json \
  --src-path hi-mcp-deploy.zip --type zip
```

What Azure does with it: unpacks it, runs `npm install` (the workspace and all dependencies), and
starts the server with `npm start`. Azure injects `PORT`, and the server listens on it
(`HI_MCP_PORT`/`PORT` are supported by `server.ts`). No certificates are configured —
App Service provides the HTTPS endpoint in front of the plain-HTTP process.
The first deployment takes a few minutes (build + start).

### 7. Verify, in this order

```bash
# 7a. The server answers (expect 200):
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://hi-mcp-poc-json.azurewebsites.net/mcp \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

7b. Watch the server console: portal → App → **Monitoring → Log stream** — it must show
`HI group orchestrator MCP server ready` and `waiting for the ligna-store page`.

7c. Open the store with the `mcp_server` parameter appended:

```text
https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=ps_bse5tc50687uh64hm8jul7j1kiuacyx&mcp_server=https://hi-mcp-poc-json.azurewebsites.net
```

The page's bridge normalizes the URL to `wss://…/bridge` and connects outward to the app; the log
stream shows `page connected`. The store deployment must contain the `feat/hi-mcp` branch
(`hi-mcp/` bridge + the hook in `Planner.vue`).

7d. Point any MCP client at `https://hi-mcp-poc-json.azurewebsites.net/mcp` and run
`get-plan-context` (same registrations as in the [local guide](./local-mcp-server.md), just with
the Azure URL).

## Configuration on Azure

| Setting | Value on Azure | How |
| ------- | -------------- | --- |
| `PORT` | injected by App Service | nothing to do |
| `HOST` | default (all interfaces) | nothing to do |
| `HI_MCP_TLS_CERT` / `HI_MCP_TLS_KEY` | **unset** — TLS is terminated by App Service | nothing to do |
| `HI_MCP_PAGE_ORIGINS` | default already contains `https://www.roomle.com` | only change for other store deployments |

To set an app setting explicitly:

```bash
az webapp config appsettings set --resource-group rg-hi-mcp-poc --name hi-mcp-poc-json \
  --settings HI_MCP_PAGE_ORIGINS="http://localhost:3000,https://www.roomle.com"
```

## Redeploying after code changes

Same packaging and deploy command as step 6:

```bash
cd <path to>/roomle-hi-example/hi-mcp
zip -r ../hi-mcp-deploy.zip . -x "node_modules/*"
cd .. && az webapp deploy --resource-group rg-hi-mcp-poc --name hi-mcp-poc-json \
  --src-path hi-mcp-deploy.zip --type zip
```

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `AuthorizationFailed` on create | no write rights — send the admin request from Prerequisites |
| `NameAlreadyExists` on web app create | the app name is globally unique — pick another suffix; use the same name in the store URL's `mcp_server` |
| App shows "Application Error" / unresponsive after deploy | Log stream (Monitoring → Log stream): if the server does not start, the build/startup failed — check Deployment Center for the `npm install`/build error |
| `page connected` never appears | (a) WebSockets not enabled (step 5), (b) the store URL lacks `&mcp_server=https://<app>.azurewebsites.net`, (c) the deployed store build lacks the `feat/hi-mcp` branch, (d) page origin not in `HI_MCP_PAGE_ORIGINS` |
| Tool error `No HI page connected` | the store tab is not open or lost the connection — reload it with the `mcp_server` parameter; the bridge reconnects on its own after a page reload |
| Tool error `... is not a function` | the UI served for the stage does not contain the HI planner APIs — independent of Azure (same as locally) |
| First request is very slow (~30 s) | F1 plan cold start — use B1, or just retry |

## Security notes

`https://<app>.azurewebsites.net/mcp` is a **public** endpoint: anyone who knows the URL can call
the tools while a page is connected. For the PoC:

- keep the app name unguessable and the deployment time-boxed,
- delete the whole resource group when the demo is over (costs stop too):

  ```bash
  az group delete --name rg-hi-mcp-poc
  ```

A shared-secret header check on `/mcp` or App Service Easy Auth are the follow-up options once the
PoC becomes a shared setup (see the
[Azure analysis](../../.agents/feature-analysis/mcp-azure-deployment-and-session-bootstrapping.md)).
The server holds **one connected page at a time** — a second tab replaces the first.
