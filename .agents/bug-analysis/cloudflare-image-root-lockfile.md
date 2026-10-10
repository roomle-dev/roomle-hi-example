# Build the Cloudflare MCP image from the repository lockfile

> **Status:** Fixed locally — image and Linux CI verified
> **Date:** 2026-10-09
> **Backlog:** Deployment and session issues, item 4

## Affected repositories

- **roomle-hi-example:** use the root Docker build context and lockfile, copy all workspace manifests for npm, remove the nested install lockfile, and update the deployment references.

## Root cause

`hi-mcp/cf/wrangler.jsonc` sets `image_build_context` to `..` (the `hi-mcp` directory).
Its Dockerfile copies that directory's `package-lock.json` and installs `hi-mcp-server`.
The root package declares `hi-mcp` and each of its nested packages as workspaces, so ordinary
npm installs update only the root lockfile. The separate `hi-mcp/package-lock.json` can therefore
diverge from workspace manifests. It also omits the chat's `@ai-sdk/google` dependency.

## Implementation plan

1. Set the image context to `../..`, keeping the Dockerfile in `hi-mcp/cf`.
2. Copy the root manifest and lockfile, and all five declared workspace manifests in their
   repository paths. Install only `hi-mcp/hi-mcp-server`, named by its path from the root.
   Keep the runtime dependencies, Node base image and server behavior unchanged; do not install
   chat/provider SDKs, wrangler, or root development tools in the image.
3. Copy the shared TypeScript config and server sources under `hi-mcp/`, and start with
   `npm start --workspace hi-mcp/hi-mcp-server`.
4. Put the image ignore rules at the root, limiting context to the manifests, lockfile and server
   source. Delete the obsolete nested lockfile and ignore file.
5. Replace the separate-lockfile refresh workaround in living deployment documentation with
   root npm install/build instructions. Update the deployment decision, indexes and backlog.

## Verification

- Build the image from the root on Linux amd64 after deleting the nested lockfile.
- Start the image locally and check `initialize` and `tools/list` on `/mcp`; its no-page response
  must be a planner connection hint, not an import/startup failure.
- Inspect the image: the root lockfile is present; chat/provider SDKs, wrangler and development
  tooling are not installed. Confirm the expected dependency pins match the root lockfile.
- Run the CI install/typechecks/tests against a clean Linux x64 copy, plus local formatting/lint
  and markdown-link checks. No cloud deployment is part of this local fix.

## Baseline

Branch `feat/rml-18103-follow-up-issues`, commit `84b212f`. The root lockfile carries the current
workspace manifests and Linux Rollup binary. Docker Desktop is installed but its daemon was stopped
at the first check; start it for the image verification.

## Implementation and verification

- Wrangler resolves `image_build_context: "../.."` relative to the configuration directory;
  its installed CLI code confirms the resulting context is the repository root.
- The Dockerfile copies all five declared workspace manifests, uses the unchanged root lockfile,
  installs only `hi-mcp/hi-mcp-server` with `--omit=dev`, and starts that workspace explicitly.
  The obsolete nested lockfile and ignore file are deleted. The root ignore file excludes host
  dependencies, hidden files, PEM files and server tests/docs.
- Reproduction: the baseline Dockerfile in a clean temporary copy fails its lockfile COPY after
  removing the nested lockfile. The new root-context image builds on Linux amd64 without it.
- The image's five direct server dependency versions match the root lockfile. Chat/provider SDKs,
  wrangler, Cloudflare Containers and development tools are absent; only their workspace manifests
  are copied for npm resolution. Server tests/docs and the nested lockfile are absent as well.
- A separate temporary copy changes only the server's `ws` pin to `8.18.1` and updates its root
  lockfile through npm. Its image rebuild succeeds and installs `8.18.1` without a nested lockfile.
  The repository's server pin remains `8.21.3`; this is an isolated dependency-change check.
- The local image answers MCP `initialize` and `tools/list` (20 tools). `get-plan-context` without
  a page returns the configured no-page connection hint. No model or planner page is required.
- A clean Linux amd64 copy with Node 22 runs the workflow's `npm ci`, server/client/chat and
  Cloudflare typechecks, and all **593 tests in 15 files** successfully.

Formatting, root lint, whitespace and markdown-link checks pass (`bad 0`).

The living setup guide, implementation reference and deployment skill describe the root-lockfile
workflow. The deployment decision carries the install constraints, and backlog item 4 is removed.
No dependency pins, workflow credentials or running cloud deployment are changed. The analysis
stays until the fix lands on master.
