# ADR 0005 — The HI MCP server is deployed by a push to `release/cloudflare`

> **Status**: Accepted
> **Date**: 2026-10-01
> **Analysis**: the feature analysis of the deploy workflow (git history); guide [cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md#deploy-from-github-push-to-releasecloudflare)

## Context

The Cloudflare deployment ([ADR 0004](0004-hi-mcp-server-on-cloudflare-containers.md)) was a manual
`npx wrangler deploy` from a developer machine: the running server was whatever that machine had
checked out. The repository is public.

## Decision

- The GitHub Actions workflow `.github/workflows/deploy-cloudflare.yml` deploys on every push to
  `release/cloudflare`: `npm ci`, the typecheck and the unit tests of the `hi-mcp` workspace,
  `npx wrangler deploy` (builds and pushes the image, uploads the Worker), and an `initialize`
  against the public URL that must answer HTTP 200.
- `release/cloudflare` is the source of the one existing deployment — the Worker `hi-mcp-poc` and
  its URL. A release is a fast-forward of `release/cloudflare` to `master`.
- The credentials (`CLOUDFLARE_API_TOKEN` with Containers · Edit, `CLOUDFLARE_ACCOUNT_ID`) are
  secrets of the GitHub environment `cloudflare`, which only `release/cloudflare` may use.
- One deploy at a time (`concurrency` without cancelling): a deploy stopped midway leaves the Worker
  uploaded and the container application on the previous image.
- A manual `npm run deploy:cf` is for dry runs and emergencies only.

## Consequences

- A failing test or image build deploys nothing; the running server matches `release/cloudflare`
  unless someone deploys by hand.
- The runner is Linux x64: the root lockfile must carry the Linux platform binaries of its native
  packages. A change to the workflow or the lockfile is checked in `node:22` on `linux/amd64`
  ([deployment skill](../skills/hi-mcp-cloudflare-deployment.md#verifying-a-workflow-or-lockfile-change-on-linux)); macOS proves nothing about the
  runner.
- The image still installs from `hi-mcp/package-lock.json`
  ([backlog](../backlog/deployment-and-session-issues.md#4-the-cloudflare-image-installs-from-a-second-lockfile)).
- `hi-mcp/cf/package.json` asks for `latest`; a lockfile refresh can pull in a new
  `@cloudflare/containers` or wrangler, which the test gate catches before a deploy.

## Rejected

- A Worker per branch: every branch would need its own Worker and container application, a deleted
  Worker leaves its container application running, and the store link and `npm run start:cf` point
  at one fixed URL.
- Cloudflare Workers Builds (the dashboard's Git integration): it moves the pipeline out of the
  repository and needs the Cloudflare GitHub App on the organization.
- `cloudflare/wrangler-action`: a plain `npx wrangler deploy` uses the locked wrangler.
- Repository secrets instead of an environment: in a public repository the environment's branch
  rule keeps the token from workflows on other branches.
