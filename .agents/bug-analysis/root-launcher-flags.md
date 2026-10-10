# Forward launcher flags through the root npm scripts

> **Status:** Fixed locally — npm forwarding and live startup verified
> **Date:** 2026-10-09
> **Former backlog item:** Deployment and session issues, item 5

## Affected repositories

- **roomle-hi-example:** invoke the launcher directly from root start/dev/Cloudflare scripts, document npm flag forwarding, and remove the solved backlog item after verification.

## Root cause

The root scripts invoke another npm command targeting `minimal-hi-example`. The outer npm
appends `--no-open` to that inner command, which consumes it as an npm option. The launcher never
receives it and opens the browser. The workspace scripts already invoke Node directly.

## Implementation plan

Change only the root `start`, `dev` and `start:cf` scripts to run
`node minimal-hi-example/start.mjs`, with `--dev` and `--cf` on their respective commands.
Keep provider/key arguments, convenience aliases, build gate, server startup and shutdown as
they are. Update the root quickstart and launcher reference; remove backlog item 5 and its rows.
The SIGTERM cleanup defect in item 6 is separate.

## Verification

- Run the actual npm commands in an isolated manifest copy with an argv-recording launcher.
  Reproduce missing flags, then verify `start`, `dev`, `start:cf`, explicit mode flags and provider
  positional arguments, all with `--no-open`. This makes no browser or provider request.
- Run the real `npm start -- --no-open` on unused page/MCP ports, with a temporary browser-opener
  recorder on PATH. Verify the example page and MCP initialize response, no opener invocation,
  and preservation of dev/provider launch arguments. Use process-group cleanup so the separate
  item 6 does not leave servers from this check running.
- Run formatting, root lint and markdown-link/whitespace checks. No dependency or lockfile
  changes, cloud deployment or tests in ligna-store are needed.

## Baseline

Branch `feat/rml-18103-follow-up-issues`, commit `6e5ddea`. Root npm scripts contain the second npm
invocation; the launcher checks `process.argv.includes("--no-open")` before opening a browser.

## Implementation and verification

The three root scripts invoke Node directly; only their preselected `--dev` and `--cf` flags
are added. The workspace scripts, launcher code, dependency pins and lockfile stay unchanged.

Five actual npm CLI probes in an isolated copy use an argv-recording launcher:
`npm start -- --no-open`, `npm run dev -- --no-open`, `npm run start:cf -- --no-open`,
explicit `--dev --cf --no-open`, and provider/key arguments together with `--no-open`.
All five reproduced dropped flags before the script change; all five pass after it.

The real root `start` and `dev` commands ran sequentially on unused page/MCP ports 3300 and 3310.
Both passed the launcher's typecheck gate, served the example with HTTP 200 and answered MCP
initialize with HTTP 200. A temporary `open` recorder on PATH was never invoked. Dev startup
retained `server_url=http://localhost:5173/`; both retained the selected MCP port. Their process
groups were stopped after the checks, leaving neither test port occupied.

Cloudflare/provider argument forwarding was checked in the isolated CLI copy; no cloud server,
provider or browser was contacted. No tests or dependencies were added to ligna-store. Item 6
remains separate, and cleanup used process-group signals without changing the launcher shutdown.
The root guide, launcher reference and MCP skill describe npm flags after `--`; backlog item 5
and its index rows are removed. This analysis stays until the fix lands on master.

Root lint, formatting and whitespace checks pass. Markdown-link checks pass for the other
touched documents. The root README produces a pre-existing checker false positive for an
unchanged angle-wrapped external SharePoint URL; this change adds no README links.
