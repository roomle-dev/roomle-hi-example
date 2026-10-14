# The HI MCP server moves to the Roomle Cloudflare account, as a DEV and a PRD stage

> **Date**: 2026-10-14
> **Status**: Open — deployed by hand: PRD `https://hi-planning-assistant.dashiell-bell.workers.dev/mcp`, DEV `https://hi-planning-assistant-dev.dashiell-bell.workers.dev/mcp`; `account_id`, the `dev` environment, `deploy:cf:dev`, the workflow for both release branches and ADR 0008 on `ci/cludflare-deplyoment`; open: the GitHub environment `cloudflare-dev`, the Roomle API token in both environments, the first workflow runs and the teardown of `hi-mcp-poc`
> **Ticket**: [RML-18154](https://roomle.atlassian.net/browse/RML-18154)
> **Base**: roomle-hi-example `master` (`154d14f`), `release/cloudflare` (`29ac045`); wrangler 4.143.0 of the root `package-lock.json`

## Affected repositories

- **roomle-hi-example** — the wrangler config gets the Roomle account, the new Worker name and a
  `dev` environment; the deploy workflow runs for two release branches; a new `deploy:cf:dev`
  script; the Cloudflare URL of the launcher; the deployment guide, the skill, the ADRs and every
  document that names the URL.
- **ligna-store** — no code change: the store takes the server from its `mcp_server` URL
  parameter. Only the example URL in `hi-mcp/README.md:59` changes.
- Outside the repositories: the Roomle Cloudflare account (plan, members, API token), the GitHub
  environments and secrets of `roomle-dev/roomle-hi-example`, and the personal account, where the
  old Worker is removed.

## 1. What was asked and why

The MCP server runs as the Worker `hi-mcp-poc` in the Cloudflare account of Gernot Steinegger. It
is to run in the Roomle account instead, twice:

| | DEV | PRD |
|---|---|---|
| Worker | `hi-planning-assistant.dev` (as written in the ticket) | `hi-planning-assistant` |
| Local deploy, for testing and debugging only | `npm run deploy:cf:dev` | `npm run deploy:cf` |
| Release branch, deploys on every merge | `release/cloudflare.dev` | `release/cloudflare` |

The ticket asks three questions: what exactly needs to be set up (section 4), whether a Cloudflare
access token is required (section 5), and whether a local cache must be cleared before a
deployment into another account can be issued (section 6).

## 2. How the deployment works today

- **Worker and URL.** `hi-mcp/cf/wrangler.jsonc:3` names the Worker `hi-mcp-poc`. Its URL is
  `https://<worker>.<account subdomain>.workers.dev`, so
  `https://hi-mcp-poc.hi-orchestrator.workers.dev`, where `hi-orchestrator` is the workers.dev
  subdomain of the personal account. The config has no `account_id`. The container application
  `hi-mcp-poc-himcpcontainer` (`HiMcpContainer`, `basic`, at most 5 instances,
  `wrangler.jsonc:7-15`) and the Durable Object namespace belong to the Worker.
  `HI_MCP_STORE_URL` (`wrangler.jsonc:23`) carries the Worker URL as `mcp_server`.
- **No state to move.** The Durable Object holds only the container; the connected page, the
  pending calls and the undo record live in the container process and die with it
  (`hi-mcp/cf/src/container.ts:6-11`). A fresh deployment in another account loses nothing.
- **GitHub deploy.** `.github/workflows/deploy-cloudflare.yml` runs on a push to
  `release/cloudflare` (`:4-6`), in the GitHub environment `cloudflare` (`:16`), one run at a time
  (`:8-10`): `npm ci`, the typecheck and the tests, `npx wrangler deploy` with
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (`:41-45`), and an `initialize` against the
  URL written into the step (`:50`). The environment `cloudflare` admits only `release/cloudflare`
  and holds both secrets, set on 2026-10-01 for the personal account. The token was created there
  from the template "Edit Cloudflare Workers" plus Account · Containers · Edit and is limited to
  that one account (one-time setup in `docs/setup/cloudflare-mcp-server.md`).
- **Local deploy.** `npm run deploy:cf` is `cd hi-mcp/cf && npx wrangler deploy`
  (`package.json:23`), authenticated by the user's `wrangler login`
  (`~/Library/Preferences/.wrangler/config/default.toml` on macOS).
- **Who else names the URL.** `CLOUDFLARE_MCP_SERVER_URL` of the launcher
  (`minimal-hi-example/start.mjs:50-51`, used by `npm run start:cf`) and the documents of
  section 8.

## 3. Which account wrangler deploys to

wrangler 4.143.0 resolves the account in this order (`getActiveAccountId` and
`getOrSelectAccountId` in `node_modules/wrangler/wrangler-dist/cli.js`):

1. `account_id` in `wrangler.jsonc`
2. the environment variable `CLOUDFLARE_ACCOUNT_ID`
3. the account cached in `wrangler-account.json` in the cache folder
   `<nearest node_modules>/.cache/wrangler/`
4. otherwise the accounts of the login: a single one is taken and cached; with several, wrangler
   asks and caches the answer, and a non-interactive run fails

`wrangler login` and `wrangler logout` delete the cache folder of the directory they run in
(`purgeOnLoginOrLogout`).

In CI, step 2 decides today. Locally, steps 1 and 2 are not set, so the cache decides. For
`hi-mcp/cf` the nearest `node_modules` is `hi-mcp/node_modules`, and the checkout
`~/source/roomle/roomle-hi-example` holds `hi-mcp/node_modules/.cache/wrangler/wrangler-account.json`
with the account `Gernot.steinegger@roomle.com's Account`, written on 2026-09-30 when the login
had that one account. The checkout `~/source/roomle_2/roomle-hi-example_2` has no cache.

## 4. What exactly needs to be set up

### 4.1 Cloudflare — the Roomle account, once, by an account administrator

1. **Workers Paid plan.** Containers require it ($5 per month and account). Check that it is
   active on the Roomle account.
2. **Members.** Everyone who deploys by hand becomes a member with a role that may edit Workers
   and Containers (for example Administrator). Afterwards `npx wrangler whoami` lists the Roomle
   account; if it does not, `npx wrangler logout && npx wrangler login`.
3. **An API token for GitHub** — section 5.
4. **The workers.dev subdomain** of the Roomle account is the second part of both URLs: it is
   `dashiell-bell`. An account has exactly one, shared by all its Workers; it also carries
   `roomle-planner-mcp` of roomle-model-exporter, so it must not be changed, and the URLs take it
   as it is.

Nothing else is created by hand. The first `wrangler deploy` of each stage creates the Worker, its
Durable Object namespace (migration `v1`), the container application and its image repository:

| | DEV | PRD |
|---|---|---|
| Worker | `hi-planning-assistant-dev` | `hi-planning-assistant` |
| URL | `https://hi-planning-assistant-dev.dashiell-bell.workers.dev` | `https://hi-planning-assistant.dashiell-bell.workers.dev` |
| Container application | `hi-planning-assistant-himcpcontainer-dev` | `hi-planning-assistant-himcpcontainer` |

Each stage has its own containers, at most 5 each.

**The DEV Worker cannot be named `hi-planning-assistant.dev`.** A Worker name is a DNS label of the
URL, and wrangler refuses the config: *Expected "name" to be of type string, alphanumeric and
lowercase with dashes only but got "hi-planning-assistant.dev"*. A wrangler environment `dev` names
its Worker `<name>-dev`, so `hi-planning-assistant-dev`.
The branch name `release/cloudflare.dev` is valid; `release/cloudflare/dev` would not be, beside
the existing branch `release/cloudflare`.

### 4.2 GitHub — `roomle-dev/roomle-hi-example`, once, by a repository administrator

1. **Environment `cloudflare`** (PRD, branch rule `release/cloudflare`, exists): replace
   `CLOUDFLARE_API_TOKEN` with the token of section 5, and delete `CLOUDFLARE_ACCOUNT_ID` — with
   `account_id` in the config (4.3) it is not read any more.
2. **New environment `cloudflare-dev`**: branch rule `release/cloudflare.dev`, the same token as
   secret `CLOUDFLARE_API_TOKEN`. Like `cloudflare`, it keeps the token away from workflows on
   other branches of the public repository.
3. **Branch `release/cloudflare.dev`**, created from `master` once the change of 4.3 is merged.
   Creating it is the first DEV deploy.

### 4.3 The repository — one change on `master`

**`hi-mcp/cf/wrangler.jsonc`.** The top level is PRD, `env.dev` is DEV. `containers`,
`durable_objects` and `vars` are not inherited by a named environment and are repeated in it
(`notInheritable` in `cli.js`); `main`, the compatibility settings, `migrations` and
`observability` are inherited.

```jsonc
{
  "name": "hi-planning-assistant",
  "account_id": "<Roomle account id>",
  // main, compatibility_date, compatibility_flags, migrations, observability as today
  "containers": [
    {
      "class_name": "HiMcpContainer",
      "image": "./Dockerfile",
      "image_build_context": "../..",
      "instance_type": "basic",
      "max_instances": 5,
    },
  ],
  "durable_objects": {
    "bindings": [{ "name": "HI_MCP", "class_name": "HiMcpContainer" }],
  },
  "vars": {
    "HI_MCP_STORE_URL": "https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-planning-assistant.dashiell-bell.workers.dev",
  },
  "env": {
    "dev": {
      // containers and durable_objects as above
      "vars": {
        "HI_MCP_STORE_URL": "https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-planning-assistant-dev.dashiell-bell.workers.dev",
      },
    },
  },
}
```

Read by wrangler 4.143.0 (`unstable_readConfig`, for the top level and for `--env dev`), this
config gives the Worker and container application names of the table in 4.1, and `dev` inherits
`account_id` and the migration `v1`.

**`package.json`.** `deploy:cf` stays and deploys PRD; new
`"deploy:cf:dev": "cd hi-mcp/cf && npx wrangler deploy --env dev"`.

**`.github/workflows/deploy-cloudflare.yml`.** Both branches trigger it. The branch selects the
GitHub environment, the wrangler environment and the URL of the check; each stage deploys one run
at a time, independently of the other:

```yaml
on:
  push:
    branches:
      - release/cloudflare
      - release/cloudflare.dev

concurrency:
  group: deploy-cloudflare-${{ github.ref_name }}
  cancel-in-progress: false

jobs:
  deploy:
    environment: ${{ github.ref_name == 'release/cloudflare.dev' && 'cloudflare-dev' || 'cloudflare' }}
    env:
      WRANGLER_ENV: ${{ github.ref_name == 'release/cloudflare.dev' && 'dev' || '' }}
      MCP_SERVER_URL: ${{ github.ref_name == 'release/cloudflare.dev' && 'https://hi-planning-assistant-dev.dashiell-bell.workers.dev' || 'https://hi-planning-assistant.dashiell-bell.workers.dev' }}
    steps:
      # checkout, node, install, typecheck and tests as today
      - name: Deploy (builds and pushes the container image with Docker)
        working-directory: hi-mcp/cf
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: npx wrangler deploy ${WRANGLER_ENV:+--env "$WRANGLER_ENV"}
      # the verify step posts initialize to "$MCP_SERVER_URL/mcp"
```

**`minimal-hi-example/start.mjs:50-51`.** `CLOUDFLARE_MCP_SERVER_URL` becomes the DEV URL;
`npm run start:cf` uses DEV.

### 4.4 The switch, in this order

1. Cloudflare (4.1) and the token (section 5).
2. The GitHub environments and secrets (4.2). Between this step and step 5, nothing is pushed to
   `release/cloudflare`: that branch still has the old config without `account_id`, and its
   workflow would deploy `hi-mcp-poc` into the Roomle account with the new token.
3. The change of 4.3 merged to `master`.
4. `git push origin origin/master:refs/heads/release/cloudflare.dev` — DEV deploys. Check
   `initialize` → 200, a store page with `mcp_server=<DEV URL>` and `npm run start:cf`.
5. `git push origin origin/master:release/cloudflare` — PRD deploys. Check `initialize` → 200 and
   a store page with `mcp_server=<PRD URL>`.
6. The handouts and every MCP client connector point to the PRD URL.
7. The personal deployment is torn down, from the repository root (it has no wrangler config, so
   the variable selects the account):
   `CLOUDFLARE_ACCOUNT_ID=<personal account id> npx wrangler delete --name hi-mcp-poc`, then
   `npx wrangler containers list` and `npx wrangler containers delete <id>` for
   `hi-mcp-poc-himcpcontainer` with the same variable — `wrangler delete` leaves the container
   application running. Then the personal API token is deleted and, if nothing else runs there,
   the Workers Paid plan of the personal account is ended.

## 5. Is a Cloudflare access token required?

**For the GitHub deploys: yes, a new one.** CI cannot use `wrangler login`. The token in the
secret today belongs to the personal account and is limited to it, so it cannot deploy into the
Roomle account.

It is created in the Roomle account as an **account API token** (Manage Account → Account API
Tokens → Create Token), as Cloudflare's GitHub Actions guide does:

- permissions: those of "Edit Cloudflare Workers" plus **Account · Containers · Edit** — without the
  second, the deploy uploads the Worker and fails with 403 at the container step (troubleshooting
  table of `docs/setup/cloudflare-mcp-server.md`)
- account resources: the Roomle account only

An account token belongs to the account, not to a person, which is the point of this ticket. The
first DEV deploy confirms that the container step accepts it; should it not, a user token of an
account administrator with the same permissions takes its place. One token serves both stages and
goes into both GitHub environments.

**For the local deploys: no.** `npm run deploy:cf` and `npm run deploy:cf:dev` use the
`wrangler login` of a member of the Roomle account (4.1, step 2).

## 6. Must a local cache be cleared?

**Yes, as the config stands — in every checkout where `wrangler deploy` ran.** There,
`hi-mcp/node_modules/.cache/wrangler/wrangler-account.json` names the personal account
(section 3). Without `account_id` in the config and without `CLOUDFLARE_ACCOUNT_ID`, wrangler reads
that file before it looks at the accounts of the login, so `npm run deploy:cf` would create
`hi-planning-assistant` in the personal account without asking — even after the user became a
member of the Roomle account.

**With `account_id` in `wrangler.jsonc` (4.3), nothing must be cleared.** The config decides
before the cache is read, on every machine and in CI. The account ID is an identifier, not a
credential — a deploy still needs a login or token for the account — so it can stand in the public
repository. The stale file is then harmless; deleting it once removes the last pointer to the
personal account: `rm -rf hi-mcp/node_modules/.cache/wrangler`, or
`npx wrangler logout && npx wrangler login` run in `hi-mcp/cf`.

Not affected by the change of account:

- the `wrangler login` itself — it belongs to the user, not to an account; it only has to list the
  Roomle account (4.1, step 2)
- Docker — the image is rebuilt, and every deploy fetches a 15-minute push credential for the image
  registry of the target account (`dockerLoginImageRegistry` in `cli.js`)
- CI — every run starts on a fresh runner; `setup-node` with `cache: npm` caches npm's download
  cache, not `node_modules`
- `hi-mcp/cf/.wrangler/` — temporary bundles only

If the account ID is to stay out of the public repository, every developer has to clear the cache
and then answer wrangler's account prompt or export `CLOUDFLARE_ACCOUNT_ID` before each local
deploy, and CI keeps the `CLOUDFLARE_ACCOUNT_ID` secret in both environments. A forgotten step
deploys into whatever account the cache or the variable names.

## 7. Alternatives considered

- **The account ID as a secret or per machine** instead of in the config — rejected: the target of
  a local deploy then depends on the state of each machine, which is what the cache question is
  about (section 6).
- **Two wrangler config files** (`wrangler.jsonc`, `wrangler.dev.jsonc`) — rejected: every key
  twice, and nothing keeps them in step; a wrangler environment is the mechanism for stages.
- **One GitHub environment admitting both branches** — fewer secrets, but GitHub's deployment
  history mixes DEV and PRD, and a rule for PRD only, such as a required reviewer, is impossible.
- **The DEV Worker named `hi-planning-assistant.dev`** — not a valid Worker name (4.1).
- **Moving the Worker from the personal account** — there is nothing to move (section 2); the first
  deploy into the Roomle account creates it.

## 8. Code and documents the work touches

roomle-hi-example:

- `hi-mcp/cf/wrangler.jsonc`, `.github/workflows/deploy-cloudflare.yml`, `package.json`,
  `minimal-hi-example/start.mjs`
- `docs/setup/cloudflare-mcp-server.md` (one-time setup, URLs, the two stages, teardown),
  `.agents/skills/hi-mcp-cloudflare-deployment.md`, `docs/implementation/deployment-and-testing.md:39,51`,
  `docs/implementation/pages-chat-and-launcher.md:68`, `AGENTS.md` (repository structure,
  "Deploying to Cloudflare")
- the URL in `docs/hi-mcp-server.md:145`, `docs/user-guide/README.md:81,115`,
  `docs/setup/jan-ai-setup.md:38,50,63-64`, `docs/setup/ollama-vscode-mcp-setup.md:73,113`,
  `hi-mcp/README.md:17-18`, `hi-mcp/QUICKSTART.md:9-10`, `hi-mcp/hi-mcp-server/README.md:117`
- a new ADR 0008 for the two stages in the Roomle account with the account in the config; it
  supersedes the "one existing deployment" of ADR 0005 and the personal-account consequence of
  ADR 0004
- unchanged: the Worker and container code and their tests; `hi-mcp/cf/package.json` keeps the
  package name `hi-mcp-poc-cf`, which is not deployed

ligna-store: `hi-mcp/README.md:59`.

**Test.** `npx wrangler deploy --dry-run` and `npx wrangler deploy --env dev --dry-run` in
`hi-mcp/cf` (Docker running) validate both stages of the config before the merge. The workflow
change is proven by the first DEV deploy (4.4, step 4).
