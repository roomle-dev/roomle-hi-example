> **Type**: Bug Analysis
> **Domain**: hi-mcp — Cloudflare container image (`hi-mcp/cf/Dockerfile`, `hi-mcp/package-lock.json`)
> **Trigger**: `npx wrangler deploy` in `hi-mcp/cf` fails during the image build
> **Date**: 2026-09-29
> **Author**: AI Assistant
> **Status**: Fixed

---

## Symptom and Reproduction

`npx wrangler deploy` (wrangler 4.143.0) in `hi-mcp/cf` stopped at the image build step:

```text
ERROR [6/8] RUN npm ci --workspace hi-mcp-poc-json
npm error `npm ci` can only install packages when your package.json and package-lock.json
          or npm-shrinkwrap.json are in sync.
npm error Invalid: lock file's zod@4.5.4 does not satisfy zod@4.6.5
```

The same failure reproduced without Cloudflare, using the local build of the same image:

```bash
cd hi-mcp && docker build -f cf/Dockerfile -t hi-mcp-poc-cf .
```

The `EBADENGINE` warnings in the same output (wrangler and miniflare want Node 22, the image has
Node 20) are only warnings. They were present before and did not cause the failure.

## Investigation

- `hi-mcp/cf/wrangler.jsonc` builds the image with `"image_build_context": ".."`, which is the
  `hi-mcp/` folder.
- `hi-mcp/cf/Dockerfile:9` copies `package.json` and `package-lock.json` from that folder, and
  `hi-mcp/cf/Dockerfile:13` runs `npm ci --workspace hi-mcp-poc-json`. The image reads
  `hi-mcp/package-lock.json`, not the repository-root lockfile.
- The repository has two lockfiles:
  - `package-lock.json` at the repository root. It belongs to the root workspace, which lists
    `hi-mcp`, `hi-mcp/hi-mcp-poc-json`, `hi-mcp/hi-mcp-chat`, `hi-mcp/cf` and
    `minimal-hi-example`.
  - `hi-mcp/package-lock.json`. It belongs to the `hi-mcp` workspace root, which lists
    `hi-mcp-poc-json`, `hi-mcp-chat` and `cf`.
- Commit `9cec6cb` (*feat: add mistral ai chat to the hi example*) raised zod in
  `hi-mcp/hi-mcp-poc-json/package.json` from 4.5.4 to 4.6.5 and added the `hi-mcp-chat` workspace.
  It refreshed only the root `package-lock.json`. `hi-mcp/package-lock.json:39` still pinned
  `"zod": "4.5.4"`, and the file had no `hi-mcp-chat` entry.

## Root Cause

`hi-mcp/` is itself a workspace of the repository root, so every `npm install` run inside `hi-mcp/`
(including the one the launcher `minimal-hi-example/start.mjs` runs) resolves up to the root
workspace and writes the root `package-lock.json`. Normal development therefore never updates
`hi-mcp/package-lock.json`. Only the container image reads that file, so nothing notices when it
goes stale until the next image build. `npm ci` requires the lockfile to match every manifest
exactly, so the first dependency change after the last refresh broke the build.

## Fix

- `hi-mcp/package-lock.json` was regenerated from the current `hi-mcp` manifests. This was done in
  an isolated copy, outside the root workspace, starting from the existing lockfile so that every
  unchanged dependency kept its pinned version. The diff sets zod to 4.6.5 and adds the
  `hi-mcp-chat` workspace with its dependencies. Nothing else changed.
- The Dockerfile did not change. `npm ci --workspace hi-mcp-poc-json` accepts a lockfile that
  lists a workspace whose manifest is not in the image.
- The regeneration command is documented in the troubleshooting of
  [hi-mcp/docs/cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md) and in the
  skill [hi-mcp-cloudflare-deployment.md](../skills/hi-mcp-cloudflare-deployment.md).

### Not done: one lockfile

The trap stays: the next dependency change in a `hi-mcp` workspace makes `hi-mcp/package-lock.json`
stale again. The structural fix would remove `hi-mcp/package-lock.json` and build the image from
the repository-root lockfile. That needs the build context moved to the repository root, all
workspace manifests copied into the image, a `.dockerignore` for the root, and the start command
changed to `npm start --workspace hi-mcp/hi-mcp-poc-json`, because npm handles workspaces nested
in workspaces poorly. It is a larger change than this fix and is left as a separate decision.

## Validation

- Before the fix: `docker build -f cf/Dockerfile -t hi-mcp-poc-cf .` in `hi-mcp/` fails with the
  error above.
- After the fix: the build succeeds. `docker run -p 3101:3000 hi-mcp-poc-cf` logs
  `HI group orchestrator MCP server ready`, and the `initialize` request from the deploy guide sent
  to `http://127.0.0.1:3101/mcp` returns HTTP 200 with `serverInfo` `hi-group-orchestrator`.
