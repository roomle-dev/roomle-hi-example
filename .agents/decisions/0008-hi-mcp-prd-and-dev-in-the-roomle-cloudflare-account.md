# ADR 0008 — The HI MCP server runs in the Roomle Cloudflare account, as PRD and DEV

> **Status**: Accepted
> **Date**: 2026-10-14
> **Analysis**: the move of the deployment to the Roomle Cloudflare account, [RML-18154](https://roomle.atlassian.net/browse/RML-18154); guide [cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md#deploy-from-github-push-to-a-release-branch)

## Context

The server ran as one Worker, `hi-mcp-poc`, in a personal Cloudflare account
([ADR 0004](0004-hi-mcp-server-on-cloudflare-containers.md)), deployed from `release/cloudflare`
([ADR 0005](0005-deploy-hi-mcp-from-release-cloudflare.md)). It has to run in the Roomle account,
which already pays for Workers and Containers, as a production and a development stage.

## Decision

- Two stages in the Roomle account, both from `hi-mcp/cf/wrangler.jsonc`: the top level is PRD,
  the Worker `hi-planning-assistant`; the wrangler environment `dev` is DEV, the Worker
  `hi-planning-assistant-dev`. `dev` repeats `containers`, `durable_objects` and `vars`, which a
  wrangler environment does not inherit.
- The URLs are `https://hi-planning-assistant.dashiell-bell.workers.dev` (PRD) and
  `https://hi-planning-assistant-dev.dashiell-bell.workers.dev` (DEV). `dashiell-bell` is the
  workers.dev subdomain of the Roomle account: one per account, shared by all its Workers, also
  by `roomle-planner-mcp` of roomle-model-exporter. It is not changed.
- `account_id` in `wrangler.jsonc` names the Roomle account. wrangler reads it before the
  `CLOUDFLARE_ACCOUNT_ID` variable and before the account it caches in
  `node_modules/.cache/wrangler/`, so no machine and no CI run can deploy into another account.
- `.github/workflows/deploy-cloudflare.yml` deploys PRD on a push to `release/cloudflare`
  (GitHub environment `cloudflare`) and DEV on a push to `release/cloudflare.dev` (environment
  `cloudflare-dev`); each environment holds the Roomle account's API token and admits only its
  branch. `npm run deploy:cf` and `npm run deploy:cf:dev` deploy by hand.

## Consequences

- The account ID stands in the public repository. It is an identifier, not a credential: a deploy
  needs a login or token of the account.
- A login or token without access to the Roomle account fails with an authentication error instead
  of deploying elsewhere.
- Each stage has its own Durable Object namespace and container application
  (`hi-planning-assistant-himcpcontainer`, `hi-planning-assistant-himcpcontainer-dev`), at most
  5 containers each; DEV and PRD deploy independently, each one run at a time.
- `npm run start:cf` uses DEV.

## Rejected

- Renaming the Roomle account's workers.dev subdomain: it moves every Worker of the account and
  breaks the URL and the Google sign-in callback of `roomle-planner-mcp`.
- A separate Cloudflare account with a subdomain of its own: a second Workers Paid plan for a name.
- The DEV Worker named `hi-planning-assistant.dev`: a Worker name is lowercase letters, digits and
  dashes only, and wrangler refuses the config.
- The account ID as a secret or per machine: the target of a local deploy then depends on each
  machine's wrangler cache.
- Two wrangler config files: every key twice, nothing keeps them in step.
- One GitHub environment for both branches: GitHub's deployment history mixes the stages, and a rule
  for PRD only is impossible.
