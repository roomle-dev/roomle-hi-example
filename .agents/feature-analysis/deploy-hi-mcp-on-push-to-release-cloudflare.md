> **Type**: Feature Analysis
> **Domain**: HI MCP Server, Cloudflare deployment, CI/CD
> **Trigger**: "Is it possible to implement a GitHub workflow which deploys the hi-mcp on Cloudflare? I want that if something is pushed to the branch release/cloudflare, the hi mcp is deployed for this branch."
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Implemented (first deploy run pending the one-time setup)

---

## Executive Summary

**Yes.** A GitHub Actions workflow triggered by a push to `release/cloudflare` can run the same
`npx wrangler deploy` that is run by hand today. Every step except the Cloudflare authentication
ran successfully on a clean clone of `release/cloudflare`, including the image build
(section 3). The authenticated part is proven on GitHub's runners by the in-house reference:
roomle-model-exporter's `cd-cloudflare.yaml`, whose last five runs passed in about 2.5 minutes
each.

What it takes:

1. **Credentials** — a Cloudflare API token for the account that owns `hi-mcp-poc` (Workers and
   Containers edit), stored together with the account ID as secrets of a GitHub environment that
   only `release/cloudflare` may use. The repository admin sets this up (section 5).
2. **The workflow file** (section 4).
3. **A one-line vitest fix** — the worker tests fail today, so a test gate would block every
   deploy (section 3.2).

**Interpretation of "deployed for this branch":** `release/cloudflare` becomes the source of the
**existing** deployment — the same worker `hi-mcp-poc` and the same URL. It does not mean a
separate worker per branch (see alternatives, section 6).

---

## 1. What Was Asked and Why

Today the Cloudflare deployment is a manual `npm run deploy:cf` from a developer machine with a
wrangler OAuth login. The deployed image is whatever was checked out on that machine. The goal:
a push to `release/cloudflare` deploys, so the running server always matches a known branch in
the repository.

---

## 2. How It Works Today

| Fact | Where |
| ---- | ----- |
| Deploy = `npx wrangler deploy` in `hi-mcp/cf`; root script `deploy:cf` | [package.json:22](../../package.json#L22) |
| wrangler builds the image from `hi-mcp/cf/Dockerfile` (build context `hi-mcp/`), pushes it to Cloudflare's registry, uploads the Worker, and updates the container application | [hi-mcp/cf/wrangler.jsonc:7-15](../../hi-mcp/cf/wrangler.jsonc#L7-L15) |
| Worker `hi-mcp-poc` on the Cloudflare account "Gernot.steinegger@roomle.com's Account", workers.dev subdomain `hi-orchestrator` → `https://hi-mcp-poc.hi-orchestrator.workers.dev` | [wrangler.jsonc:3](../../hi-mcp/cf/wrangler.jsonc#L3), `wrangler whoami` |
| wrangler 4.143.0 is locked in the **root** `package-lock.json` (`hi-mcp/cf` is a root workspace) | [package.json:7-13](../../package.json#L7-L13) |
| wrangler needs Node 22+; the image itself runs `node:20-slim` | [skill](../skills/hi-mcp-cloudflare-deployment.md), [Dockerfile:4](../../hi-mcp/cf/Dockerfile#L4) |
| The image installs from `hi-mcp/package-lock.json`, not from the root lockfile | [Dockerfile:8-13](../../hi-mcp/cf/Dockerfile#L8-L13) |

GitHub state of `roomle-dev/roomle-hi-example`, checked with `gh api`:

- **Public** repository; Actions enabled, all actions allowed.
- No workflow files (`.github/` holds only the Copilot instructions and a skill), no Actions
  secrets, one environment (`copilot`).
- `release/cloudflare` exists on origin, is unprotected, and points at the same commit as
  `master` (`57f1647`).

**Reference:** [roomle-model-exporter `.github/workflows/cd-cloudflare.yaml`](https://github.com/roomle-dev/roomle-model-exporter/blob/feat/planner-mcp/.github/workflows/cd-cloudflare.yaml)
runs on a push to `master` or `feat/planner-mcp`. On `ubuntu-24.04` it does `setup-node` 24,
then `npm ci`, a typecheck, and `npx wrangler deploy` with the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets. Docker is preinstalled on the runner, and wrangler
uses it to build and push the image.

The exporter's secrets belong to the account the exporter deploys to. `hi-mcp-poc` lives on a
personal account, so it needs its own token. A token for a different account would deploy a
second `hi-mcp-poc` there, under a different URL.

---

## 3. Verified Locally

Checked on 2026-10-01 against a clean clone of `origin/release/cloudflare` (Node 23, Docker 29.8,
no Cloudflare credentials):

| Step | Result |
| ---- | ------ |
| `npm ci` at the root | ok, 3 s |
| `npm run typecheck` in `hi-mcp` | ok |
| `npx tsc --noEmit --project cf/tsconfig.json` in `hi-mcp` | ok |
| `npm test` in `hi-mcp` | **one suite fails**: `cf/tests/worker.test.ts`; the 209 tests in the other 10 files pass |
| `npx wrangler deploy --dry-run` in `hi-mcp/cf` | ok: Worker bundled (53.76 KiB), image `hi-mcp-poc-himcpcontainer` built from the Dockerfile |

Not verifiable locally: the authenticated image push and the deploy with an API token. The
first workflow run answers both.

### 3.1 The gap

Only the credentials and the workflow file are missing. The build itself needs nothing new.

### 3.2 Finding: the worker tests fail since the lockfile pinned `@cloudflare/containers` 0.3.7

`cf/tests/worker.test.ts` does not load: `Cannot find module …/@cloudflare/containers/dist/index.js`.
It fails the same way in the working copy, so the clean clone is not the cause. The file exists,
and the error message hides the real cause:

- `dist/index.js` of 0.3.7 imports `./lib/container` **without a file extension**.
- Node's ESM loader cannot resolve that import:
  `node -e "import('@cloudflare/containers')"` → `ERR_MODULE_NOT_FOUND …/dist/lib/container`.
- vitest leaves packages in `node_modules` to Node, so the test hits the same error.

The version arrived with `9cec6cb` (2026-09-29, root lockfile; `cf/package.json` asks for
`latest`). wrangler's bundler resolves the import, so the **deploy is unaffected** — only the
tests break.

Fix, verified in the scratch clone (5/5 worker tests pass): let vite transform the package.

```ts
// hi-mcp/vitest.config.ts, inside `test`
server: { deps: { inline: ['@cloudflare/containers'] } },
```

Without this fix, a test gate in the workflow fails on every push.

---

## 4. Proposed Design

`.github/workflows/deploy-cloudflare.yml`:

```yaml
name: Deploy hi-mcp to Cloudflare

on:
  push:
    branches:
      - release/cloudflare

concurrency:
  group: deploy-cloudflare
  cancel-in-progress: false

jobs:
  deploy:
    name: Test, build image & deploy Worker
    runs-on: ubuntu-24.04
    environment: cloudflare
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install
        run: npm ci

      - name: Type-check and test
        working-directory: hi-mcp
        run: |
          npm run typecheck
          npx tsc --noEmit --project cf/tsconfig.json
          npm test

      - name: Deploy (builds and pushes the container image with Docker)
        working-directory: hi-mcp/cf
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler deploy

      - name: Verify the MCP endpoint answers
        run: |
          curl -sf --retry 5 --retry-all-errors --max-time 60 -o /dev/null -w '%{http_code}\n' \
            -X POST https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp \
            -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
            -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"ci","version":"0"}}}'
```

| Decision | Why |
| -------- | --- |
| Trigger: push to `release/cloudflare` only | As asked. To retry a failed deploy, use "Re-run jobs" in the Actions tab; no `workflow_dispatch` is needed |
| Environment `cloudflare`, limited to `release/cloudflare` | The repository is public. The environment hands its secrets only to jobs that run for that branch, so a workflow pushed on any other branch cannot read the token. Pull requests from forks never get secrets anyway |
| `concurrency` without cancelling | One deploy at a time: a second push waits instead of racing the first rollout. A deploy is never stopped midway, because a half-finished deploy (Worker uploaded, container application not updated) is exactly the shape of the documented `Unauthorized` pitfall |
| Node 22 | The minimum wrangler accepts. The image keeps `node:20-slim` |
| Root `npm ci` | wrangler is locked in the root lockfile, and installing every workspace takes 3 s |
| Typecheck and all unit tests before deploying | A broken server never reaches the deployment |
| `initialize` → 200 as the last step | The first check of the documented post-deploy verification. Retries cover the ~10 s container boot |

A stale `hi-mcp/package-lock.json` (the [image lockfile bug](../bug-analysis/cf-docker-build-stale-hi-mcp-lockfile.md))
still fails the image build. The build is the first step of `wrangler deploy` (visible in the dry
run), so a failing build deploys nothing.

**What stays the same:** `npm run deploy:cf` from a laptop still works and still replaces the
deployment. The deployment matches `release/cloudflare` only as long as nobody deploys by hand.
Recommendation: keep manual deploys for `--dry-run` and emergencies only, and document that.

---

## 5. Setup Steps for the Repository Admin

Do this once, before the first push.

### 5.1 Cloudflare API token

1. Log in to the Cloudflare dashboard with the account that owns `hi-mcp-poc`
   ("Gernot.steinegger@roomle.com's Account").
2. Go to **My Profile → API Tokens → Create Token**, pick the **"Edit Cloudflare Workers"**
   template, and click **Use template**.
3. **Permissions:** keep the template's rows and add one row: **Account · Containers · Edit**.
   The container image push and the container application update need it.
4. **Account Resources:** Include → this one account only. **Zone Resources:** keep the
   template default (the Worker uses no routes).
5. Optionally set a TTL. Click **Continue to summary → Create Token** and copy the token. It is
   shown only once.
6. Get the **account ID**: run `npx wrangler whoami` in `hi-mcp/cf` (the "Account ID" column),
   or open the dashboard → Workers & Pages → Account details.

### 5.2 GitHub environment and secrets

In the web UI:

1. Go to **Settings → Environments → New environment** and name it `cloudflare`.
2. Under **Deployment branches and tags**, choose **Selected branches and tags** and add the
   rule `release/cloudflare`.
3. Under **Environment secrets**, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Or with `gh`:

```bash
R=roomle-dev/roomle-hi-example
echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
  | gh api -X PUT repos/$R/environments/cloudflare --input -
gh api -X POST repos/$R/environments/cloudflare/deployment-branch-policies \
  -f name=release/cloudflare -f type=branch
gh secret set CLOUDFLARE_API_TOKEN  --env cloudflare --repo $R   # prompts: paste the token
gh secret set CLOUDFLARE_ACCOUNT_ID --env cloudflare --repo $R   # prompts: paste the account id
gh secret list --env cloudflare --repo $R                        # both are listed
```

`gh secret set` prompts for the value, so the token does not end up in the shell history.

### 5.3 Going live (after the workflow PR is merged into `master`)

1. Bring `release/cloudflare` up to `master`:
   `git fetch origin && git push origin origin/master:release/cloudflare`. This is a
   fast-forward, because `release/cloudflare` is at `master`'s commit today. A PR from `master`
   into `release/cloudflare` works too. The workflow file must be on `release/cloudflare`
   itself, because GitHub runs the workflow as it exists in the pushed commit.
2. Watch the run: `gh run watch --repo roomle-dev/roomle-hi-example`, or the Actions tab
   (about 3 min).
3. Verify:
   - the workflow's last step passes (`initialize` → 200);
   - `npm run start:cf` → the page log shows `MCP connected to the MCP server`.
4. If the deploy step uploads the Worker and then fails with `Unauthorized`/403 at the container
   step, the token lacks **Containers · Edit**. Edit the token in Cloudflare, then use
   "Re-run jobs".

Every later release works the same way: merge into `master`, then fast-forward
`release/cloudflare` (or push to it directly).

---

## 6. Alternatives Considered

1. **A worker per branch** (`hi-mcp-poc-<branch>`) — rejected for now. Every branch would need
   its own worker name and container application, and teardown is a trap: a deleted Worker
   leaves its container application running and billing. The store link and `npm run start:cf`
   also point at one fixed URL. This was not asked for.
2. **Cloudflare Workers Builds** (the dashboard's Git integration) — not chosen. It moves the
   pipeline out of the repository and needs the Cloudflare GitHub App installed on the
   `roomle-dev` organization, which is an organization-level decision. GitHub Actions matches the
   exporter and keeps the test gate in the repository.
3. **`cloudflare/wrangler-action`** — not needed. It only runs wrangler, while a plain
   `npx wrangler deploy` uses the locked wrangler version and matches the exporter.
4. **Repository secrets instead of an environment** — works (the exporter does it), but in a
   public repository the environment's branch rule is a cheap extra guard.

---

## 7. Risks

- **Personal account.** The deployment and the token belong to a personal Cloudflare account.
  Moving to a company account changes the workers.dev subdomain, and with it the URL. The URL
  would then need updating in `HI_MCP_STORE_URL` (`wrangler.jsonc`), `CLOUDFLARE_MCP_SERVER_URL`
  (`minimal-hi-example/start.mjs`), the workflow's verify step, and every handout.
- **Manual deploys override CI** (section 4).
- **`latest` ranges in `hi-mcp/cf/package.json`.** CI installs from the lockfile, so nothing
  changes silently. A lockfile refresh, however, can pull in a new `@cloudflare/containers`
  again, the way 0.3.7 broke the tests (section 3.2). The test gate catches that before deploying.

---

## 8. Files the Work Would Touch

| Path | Change |
| ---- | ------ |
| `.github/workflows/deploy-cloudflare.yml` | new — section 4 |
| `hi-mcp/vitest.config.ts` | inline `@cloudflare/containers` (section 3.2) |
| `hi-mcp/docs/cloudflare-mcp-server.md` | Prerequisites ("no CI") → the workflow; "Updating after code changes" → push to `release/cloudflare`, manual deploy for dry runs; the one-time setup of section 5 |
| `.agents/skills/hi-mcp-cloudflare-deployment.md` | "Updating the server": the workflow first; the missing Containers permission as a pitfall |
| `AGENTS.md` | Repository structure (`.github/workflows/`); Development workflow: deploying via `release/cloudflare` |
| `.agents/README.md` | index line for this document |

---

## 9. Close-out (2026-10-01)

Implemented on `feat/cloudflare-deploy-workflow`:

| Change | Verified |
| ------ | -------- |
| `.github/workflows/deploy-cloudflare.yml`, as in section 4 | actionlint 1.7.7 clean. The verify step's `curl` gets 200 from the live deployment. The install, typecheck and test steps pass on a clean clone of `release/cloudflare` with this branch's vitest config |
| `hi-mcp/vitest.config.ts`: `@cloudflare/containers` inlined (section 3.2) | 214/214 tests in 11 files, in the working copy and in the clean clone |
| Docs: [cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md) (deploy from GitHub, one-time setup, update section, troubleshooting), the [skill](../skills/hi-mcp-cloudflare-deployment.md), `README.md`, `minimal-hi-example/docs/hi-mcp-server.md`, `AGENTS.md` | — |

Not verified yet: the first authenticated run. It needs the one-time setup of section 5 (token,
environment, secrets), the merge into `master`, and the fast-forward of `release/cloudflare`.
