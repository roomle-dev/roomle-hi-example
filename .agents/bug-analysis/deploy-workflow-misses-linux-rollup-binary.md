> **Type**: Bug Analysis
> **Domain**: CI/CD, Cloudflare deploy workflow, npm lockfile
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Fixed

---

## Symptom

The first run of `.github/workflows/deploy-cloudflare.yml` (run 36892165227, push of `3a5ac16` to
`release/cloudflare`) failed in the step "Type-check and test":

```text
> hi-mcp@0.0.0 test
> vitest run
Error: Cannot find module @rollup/rollup-linux-x64-gnu. npm has a bug related to optional
dependencies (https://github.com/npm/cli/issues/4828).
```

The typecheck passed. Nothing was deployed, because the test gate stopped the job before
`wrangler deploy`.

## Reproduction

Run the workflow's steps in `node:22` on `linux/amd64` (Node 22.23.3, npm 10.9.9 — the runner's
versions), against a clean copy of `release/cloudflare`:

```bash
docker run --rm --platform linux/amd64 -v <clean copy>:/src:ro node:22 bash -c \
  'cp -r /src /work && cd /work && npm ci && cd hi-mcp && npm run typecheck && npm test'
```

The result is the same error as on GitHub.

## Root cause

The root `package-lock.json` had rollup nested as `hi-mcp/node_modules/rollup` (4.63.5, the
dependency of `hi-mcp/node_modules/vite` 6.4.3). Its lockfile entry listed all 26 platform
binaries as `optionalDependencies`. The lockfile itself, however, contained an entry for only
one of them, `hi-mcp/node_modules/@rollup/rollup-darwin-arm64`. Neither rollup entry had a
`resolved` or `integrity` field.

This is [npm/cli#4828](https://github.com/npm/cli/issues/4828): npm wrote the lockfile from an
existing macOS `node_modules`, and that tree holds only the binary for the current platform.
`npm ci` installs exactly what the lockfile lists. On Linux, rollup therefore came without its
native binary, and vitest (through vite) failed when it loaded rollup.

A scan of every lockfile entry with `optionalDependencies` found no other gap: only this rollup
entry lacked its `linux-x64` packages. The image's own lockfile `hi-mcp/package-lock.json` was
complete.

## Why the earlier verification missed it

The workflow was verified on macOS only (feature analysis
[deploy-hi-mcp-on-push-to-release-cloudflare.md](../feature-analysis/deploy-hi-mcp-on-push-to-release-cloudflare.md),
section 3). On macOS, the one binary in the lockfile is exactly the one needed, so the clean
`npm ci` and the tests passed there.

## Fix

Re-resolve rollup on Linux, without a `node_modules`, so npm adds every platform binary:

```bash
docker run --rm --platform linux/amd64 -v <copy of package.json files + lockfile>:/relock -w /relock \
  node:22 npm update rollup --package-lock-only --ignore-scripts
```

Removing the rollup entries and running `npm install --package-lock-only` does **not** help.
npm reports "up to date" and leaves rollup out entirely, because it does not re-resolve a missing
dependency of a package already in the lockfile.

Result:

- rollup moves to `node_modules/rollup` (4.63.5 → 4.63.6, a patch within vite's `^4.34.9`)
- all 26 `@rollup/*` platform entries are added, with `resolved` and `integrity`
- no other package changes

## Verification

| Where | Result |
| ----- | ------ |
| `node:22` on `linux/amd64`: `npm ci`, typecheck, `tsc` for `cf`, `npm test` | ok, 214/214 tests; `node_modules/@rollup/rollup-linux-x64-gnu` installed |
| macOS, clean copy: `npm ci`, typecheck, `npm test`, `wrangler deploy --dry-run` | ok, 214/214 tests; image built, Worker bundled |
| Lockfile scan for missing `linux-x64` optional dependencies | none |

The authenticated deploy is verified only once the fixed lockfile reaches `release/cloudflare`.

## Prevention

Verify a change to the workflow or to the lockfile on Linux x64: run the workflow's steps in
`node:22` with `--platform linux/amd64`, as in the reproduction above. A green run on macOS
proves nothing about the runner's platform binaries. The troubleshooting tables of
[cloudflare-mcp-server.md](../../hi-mcp/docs/cloudflare-mcp-server.md) and the
[deployment skill](../skills/hi-mcp-cloudflare-deployment.md) carry the symptom and the fix.
