# Deployment and Testing

The workspaces and scripts, the Cloudflare deployment, the unit tests, and the end-to-end runs with
real models. How to deploy step by step is in [cloudflare-mcp-server.md](../setup/cloudflare-mcp-server.md)
and the [deployment skill](../../.agents/skills/hi-mcp-cloudflare-deployment.md); how to run and
evaluate the MCP tests in the [testing skill](../../.agents/skills/hi-mcp-testing.md).
[Back to the overview](./README.md).

## Workspaces and scripts

The repository root is an npm workspace root over `hi-mcp`, `hi-mcp/hi-mcp-server`,
`hi-mcp/hi-mcp-chat`, `hi-mcp/cf` and `minimal-hi-example`; `hi-mcp/` is a workspace root of its own
over `hi-mcp-server`, `hi-mcp-chat` and `cf`. `hi-mcp-client` has no `package.json` — it is covered
by the typecheck and the tests only.

There are two lockfiles: the root `package-lock.json` (CI) and `hi-mcp/package-lock.json` (the
Dockerfile and the launcher's `npm install`).

| Where | Script | Runs |
| ----- | ------ | ---- |
| root | `start`, `dev`, `start:cf` | the launcher, plain / `--dev` / `--cf` |
| root | `mcp-server` | the MCP server alone |
| root | `plan:mistral`, `plan:gpt5`, `plan:gpt5.4`, `plan:gpt6` | the launcher with a chat model and its key from the environment |
| root | `deploy:cf` | `wrangler deploy` in `hi-mcp/cf` — for dry runs and emergencies |
| root | `format`, `format:check`, `lint`, `lint:fix` | Prettier, oxlint |
| `hi-mcp/` | `start` | the MCP server |
| `hi-mcp/` | `test` | vitest across the server, the client, the chat and `cf` |
| `hi-mcp/` | `typecheck` | `tsc --noEmit` for the server, the client and the chat (not `cf`) |

Main dependencies: `@modelcontextprotocol/sdk`, `ws`, `zod`, run with `vite-node` (pinned to 3.2.4
with `vite` 6.4.3 — newer `vite-node` needs `vite` 8 and Node 20.19); the chat: `ai` and the
`@ai-sdk/*` providers and `@ai-sdk/mcp`. Node 20 or later; CI and wrangler use Node 22.

## Cloudflare

```text
client ── https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp?session=<name> ──┐
page   ── wss://…/bridge?session=<name> ───────────────────────────────────────┤
                                                                              ▼
                          Worker (src/worker.ts): /mcp and /bridge only, else 404
                            env.HI_MCP.getByName(session ?? 'default').fetch(request)
                                                                              ▼
                          Container (src/container.ts): one per session, the MCP server
                            on port 3000, asleep after 15 minutes
```

| File | Content |
| ---- | ------- |
| `hi-mcp/cf/wrangler.jsonc` | Worker `hi-mcp-poc`; container `HiMcpContainer` built from `./Dockerfile` with the build context `hi-mcp/`, instance type `basic`, at most 5 instances; Durable Object binding `HI_MCP`; `HI_MCP_STORE_URL` |
| `hi-mcp/cf/src/worker.ts` | routes `/mcp` and `/bridge` to the container of the `session` query parameter (`default` without one) |
| `hi-mcp/cf/src/container.ts` | `defaultPort` 3000, `sleepAfter` 15 minutes, passes `PORT` and `HI_MCP_STORE_URL`; starts the container on the first request |
| `hi-mcp/cf/Dockerfile` | `node:20-slim`; installs only the server workspace (`npm ci --workspace hi-mcp-server`), copies the server sources, `npm start` |

- **One session, one container, one page.** The page passes its session as `mcp_session`, appended
  to `/bridge?session=`; MCP clients use `/mcp?session=`. A container keeps the page, the pending
  calls and the undo record in memory; they are lost when it sleeps or restarts, and the page's
  bridge reconnects.
- **Origins:** the container runs with the default page origins (`http://localhost:3000`,
  `http://127.0.0.1:3000`, `https://www.roomle.com`) — which is why `npm run start:cf` needs page
  port 3000.
- **Deploy:** a push to `release/cloudflare` runs `.github/workflows/deploy-cloudflare.yml` — Node 22,
  `npm ci` at the root, the typecheck, the `cf` typecheck, `npm test`, `wrangler deploy` with the
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets, then a smoke test that posts
  `initialize` to `/mcp` and expects HTTP 200 ([ADR 0005](../../.agents/decisions/0005-deploy-hi-mcp-from-release-cloudflare.md)).
  Verify a workflow or lockfile change on Linux first
  ([how](../../.agents/skills/hi-mcp-cloudflare-deployment.md#verifying-a-workflow-or-lockfile-change-on-linux)).

## Unit tests

`npm test` in `hi-mcp/` runs vitest over every workspace (`hi-mcp/vitest.config.ts`; `cloudflare:workers`
is aliased to a stub).

| File | Covers |
| ---- | ------ |
| `hi-mcp-server/tests/tool-executors.test.ts` | every tool executor against a fake planner: plan context, validation and loading of `create-or-replace-groups`, the anchor probe, relations, materials, compile corrections, `place-group`, positions in the placement frame, the command tools, undo |
| `hi-mcp-server/tests/hi-mcp-server.test.ts` | the tool registrations and descriptions, tool calls through the MCP server, the server with a page bridge |
| `hi-mcp-server/tests/group-layout.test.ts` | relations to docking, including a real agent's kitchen |
| `hi-mcp-server/tests/group-placement.test.ts` | anchor root, anchor frames, repositioning, the placement frame |
| `hi-mcp-server/tests/plan-space.test.ts` | footprints, walls, corners, wall and corner placement, overlap |
| `hi-mcp-server/tests/plan-history.test.ts` | the undo record and history events |
| `hi-mcp-server/tests/page-bridge.test.ts` | handshake, one page, call correlation, timeouts, disconnect (with `fake-page-socket.ts`) |
| `hi-mcp-server/tests/planner-api.test.ts` | the methods and timeouts; the client allow-list matches |
| `hi-mcp-client/tests/browser-bridge.test.ts` | the page side of the bridge |
| `hi-mcp-chat/tests/*.test.ts` | provider resolution, request handling, the step loop, the Mistral image middleware |
| `cf/tests/worker.test.ts` | the Worker's routing |

Many tests are named in [hi-mcp-behaviour.md](../hi-mcp-behaviour.md) as the guard of a decision or
a message — a renamed test breaks those references.

## End-to-end runs

The scripts in `.agents/scripts/` run real prompts through a real model, the chat backend, the MCP
server and a headless planner. They need Playwright (`npm install` in `.agents/scripts`).

### One run — `run-hi-mcp-prompt.js`

```bash
node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" …] \
  [--plan <ps_id>] [--operations <json>] [--image <file>] [--out <dir>] [--dev] [--headed]
```

1. Starts the launcher with `--no-open`, the MCP server on 3110 (so open interactive tabs, which
   reconnect to 3100, cannot take the bridge), and parses its `Example:` line and the server's
   `[hi-mcp] tool <name> args|feedback|error` lines.
2. Opens the example page in headless Chromium (`--enable-gpu`: the software renderer draws the
   object-only image empty) with the plan, and waits until `get-plan-context` returns articles.
3. Runs the setup `operations` (tool calls) after the planner has loaded its groups
   (`window.hiPosGroupsCompletelyLoaded`), takes the page's `clientId` from its `hello` frame.
4. Sends each prompt as one chat turn with the whole history (over `node:http`, because `fetch` ends a
   response after 300 s without data).
5. Reads the plan context and takes a snapshot in the page (`window.instance.extended`): images,
   plan XML, order data, and a saved plan snapshot id.

Output in `--out` or `.temp/result/<time>-<provider>/`: `run.json` (turns, answers, tool calls,
errors, the snapshot id), the plan context, the planner calls, the images, the plan XML and the
order data. Exit code 1 on an error or without a snapshot id.

### The suite — `run-hi-mcp-tests.js`

```bash
node .agents/scripts/run-hi-mcp-tests.js [docs/test-prompts.json] [--out <dir>] [--dev]
```

Reads `models` (provider and key, `"$NAME"` reads the environment), `plans` and `tests` from the test
file, validates it, and runs every model × test as a child `run-hi-mcp-prompt.js`. A test directory
that already holds `run.json` is skipped, so a rerun with the same `--out` resumes; `results.json` is
rewritten after every run. The `expect` of a test is not evaluated by the script — the evaluation is
part of the [testing skill](../../.agents/skills/hi-mcp-testing.md). With 3 models and about 30 tests a
full run takes close to an hour.

When an interactive `npm start` holds ports 3000 and 3200, run with `EXAMPLE_PORT` and `HI_CHAT_PORT`
set to free ports.
