# Feature Analysis: `npm run dev` Script with Local Rubens UI Server

**Date:** 2026-09-28
**Status:** Implemented

## What Was Asked and Why

Add an `npm run dev` script to `minimal-hi-example/package.json`. It should behave exactly
like `npm start` (`node start.mjs`), except the example page must load the planner from
`http://localhost:5173/` instead of `https://www.roomle.com/t/bo-test/`. The local server on
port 5173 (a Rubens UI dev server, e.g. `roomle-ui`) is started manually by the user before
running the script. This requires the `server_url` query parameter to be set.

Motivation: developing against a local Rubens UI build instead of the deployed `bo-test`
instance — the page's web-sdk then contains the local (possibly newer) plan-context APIs
(`getPlanContext`, see `glue-logic.ts`), which the deployed instance may lack.

## How the Area Works Today

- `minimal-hi-example/start.mjs` is the launcher: build gate, static file server on
  `EXAMPLE_PORT` (default 3000), spawns the hi-mcp-poc-json MCP server, opens the browser at
  `EXAMPLE_URL` (`start.mjs:20`-`27`).
- `EXAMPLE_URL` is built as
  `http://localhost:${STATIC_PORT}/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`
  plus `mcp_port` when `HI_MCP_PORT` is set. There is no `server_url` in it today.
- `minimal-hi-example/index.html:234` defines
  `DEFAULT_SERVER_URL = 'https://www.roomle.com/t/bo-test/'` and passes
  `overrideServerUrl: getQueryParam('server_url') ?? DEFAULT_SERVER_URL` into the planner
  config (`index.html:486`). **The page already supports the `server_url` query parameter —
  no page change is needed.**
- `minimal-hi-example/package.json` currently has a single script: `"start": "node start.mjs"`.

## The Gap

`start.mjs` never sets `server_url`, so the page always falls back to the deployed
`bo-test` server. Pointing it at a local UI dev server requires hand-editing the URL in the
browser after every start.

## Proposed Design

1. `start.mjs`: read `process.env.EXAMPLE_SERVER_URL`. When set, append
   `&server_url=<encoded value>` to `EXAMPLE_URL`. Nothing else changes — the static server,
   the MCP server, the bridge origin allow-list, and the browser open logic are untouched
   (the page origin is still `http://localhost:3000`; `server_url` only controls which
   Rubens UI the planner iframe loads).
2. `minimal-hi-example/package.json`: add
   `"dev": "EXAMPLE_SERVER_URL=http://localhost:5173/ node start.mjs"`.

The `dev` script inherits everything from `start.mjs`: `--no-open`, `EXAMPLE_PORT`, and
`HI_MCP_PORT` still work.

## Alternatives Considered and Rejected

- **Hardcode the 5173 URL in `start.mjs` behind a `--dev` flag** — an env var keeps the
  launcher generic and needs no argument parsing; the npm script is the only place the
  concrete port 5173 appears.
- **A separate `start-dev.mjs`** — duplicates the whole launcher for a one-line difference.
- **Setting `server_url` from within the page when `mcp=true`** — mixes concerns; the
  launcher owns the URL composition already.

## Code and Documents the Work Touches

- `minimal-hi-example/start.mjs` — `EXAMPLE_URL` composition + header comment
- `minimal-hi-example/package.json` — `dev` script
- `minimal-hi-example/README.md` — document `npm run dev`
- `minimal-hi-example/docs/hi-mcp-server.md` — document `npm run dev` in the starting section
- `.agents/README.md` — index entry for this analysis

## Assumptions

- The user is on a POSIX shell; the inline env var in the npm script does not need to work
  on Windows `cmd`.
- The local dev server on port 5173 serves a Rubens UI compatible with the page
  (`overrideServerUrl` contract); the script does not check or start it.
- Only `minimal-hi-example/package.json` gets the script; the repository root `package.json`
  is left as is (root has `npm start`; a root `dev` was not requested).

## Close-Out (2026-09-28)

Implemented as proposed:

- `start.mjs` reads `EXAMPLE_SERVER_URL` and appends the percent-encoded
  `server_url` to `EXAMPLE_URL` (header comment updated with the
  `npm run dev` usage line).
- `minimal-hi-example/package.json` gained
  `"dev": "EXAMPLE_SERVER_URL=http://localhost:5173/ node start.mjs"`.
- `minimal-hi-example/README.md` and
  `minimal-hi-example/docs/hi-mcp-server.md` document `npm run dev` (the
  docs' file table now describes both scripts).

Verified by running `npm run dev -- --no-open`: the launcher printed

```text
http://localhost:3000/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&server_url=http%3A%2F%2Flocalhost%3A5173%2F
```

and the MCP server came up on :3100; the typecheck of both hi-mcp PoCs
passed as part of the build gate. `URLSearchParams` in the page decodes the
percent-encoded value back to `http://localhost:5173/`. The plain `npm start`
path is unchanged (`EXAMPLE_SERVER_URL` unset → no `server_url` appended).
