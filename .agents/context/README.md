# HI Presets Example — Implementation

How the example of this repository is built: the example page, its launcher and its chat, and the
end-to-end prompt runs. Written for developers who change or extend the code.

This folder is the digital brain for the implementation in this repository: every new feature is
documented and added here, and every change to the implementation requires an update here.

The HI tools, the planning assistant and the chat window the example runs are roomle-ui code, and
roomle-ui documents them: the
[HOMAG Intelligence guideline](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md)
with the package layout and how to change the tools, the
[agent architecture](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/agent-architecture.md),
the [behaviour reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md)
— what the tools do towards an agent and why, with every decision, guard, correction and feedback
message — and the
[tool reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-reference.md).
How to use the HI MCP is in the [user guide](../../docs/user-guide/README.md), how to install and
deploy it in [setup](../../docs/setup/).

| Page | Covers |
| ---- | ------ |
| [HI presets example](./hi-mcp-server.md) | The example page: architecture, running, a demo walkthrough, example prompts, troubleshooting |
| [Pages, chat and launcher](./pages-chat-and-launcher.md) | `start.mjs`, the chat of the example page |
| [HI sign-in example](./hi-sc-example.md) | `hi-sc-example/`: the planner with its chat in TypeScript behind a sign-in page |
| [Sales portal example](./df-sales-portal-sc-example.md) | `df-salesPortal_sc-example/`: the sales configurator page of the df-salesPortal with the AI Planning Assistant on the model proxy of the HI server |
| [HI minifabric example](./minifabric-example.md) | `minifabric-example/`: the planner with the nobilia library through the demo proxy, the testing credentials, the AI kitchen generation and the chat; the code shared with the sign-in example |
| [Start page and GitHub Pages](./start-page.md) | `pages/`: the start page of the TypeScript examples on :3300 and on GitHub Pages, its dev server and its build |
| [Demo proxy](./demo-proxy.md) | `minifabric-example/proxy-server/`: the Cloud Function `proxy_request` that forwards the requests of the Roomle demos to HOMAG and Azure AI Foundry; running it locally, deploying it |
| [Scripts and testing](./deployment-and-testing.md) | The workspaces and scripts, the unit tests, the end-to-end test runs |

## The example

- **The example page needs no server.** It runs the planning assistant of the roomle-ui
  embedding-lib (`startPlanningAssistant`) in the page, with the tools the planner serves
  (`createHiMcpTools`, `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/`)
  ([Pages, chat and launcher](./pages-chat-and-launcher.md#the-chat-of-the-example-page)).
- **The tools come with the planner.** The page loads the planner from its server URL and gets the
  tools, their served text and the planning skills with it; a change to a tool needs no change here.

### Processes and ports

| Process | Started by | Port | Code |
| ------- | ---------- | ---- | ---- |
| Example page (static files, the model of its chat) | `npm start` (`minimal-hi-example/start.mjs`) | 3000, the next free port when taken (`EXAMPLE_PORT` pins the requested port) | `minimal-hi-example/index.html` |
| Start page with the sign-in example (`/hi-sc/`) and the minifabric example (`/nobilia-minifabrik/`) on their Vite dev servers | `npm run start:sc` | 3300 | `pages/serve.mjs` |
| Demo proxy (Functions Framework, local run) | `npm run dev:proxy` | 8080 | `minifabric-example/proxy-server/` |

## Repository map

| Path | What it is |
| ---- | ---------- |
| `minimal-hi-example/index.html` | The example page: HI presets demo, the planning assistant of the embedding-lib in the planner's chat window |
| `minimal-hi-example/start.mjs` | The launcher: static serving, the model of the chat at `/planning-assistant-config.json` |
| `hi-sc-example/` | The sign-in example in TypeScript: the HI server login, backend, library and the chat model entered on the page |
| `df-salesPortal_sc-example/index.html` | The sales portal example: plain JavaScript, the planner with prices and the order, the planning assistant on the model proxy of the HI server |
| `minifabric-example/` | The minifabric example in TypeScript: the nobilia library through the demo proxy, the settings panel, the AI kitchen generation and the chat |
| `shared/` | The code the sign-in and minifabric examples share: the planner basics and the price request |
| `pages/` | The start page of the sign-in and minifabric examples: its dev server (`start:sc`) and the GitHub Pages build |
| `minifabric-example/proxy-server/` | The demo proxy: the Cloud Function `proxy_request`, deployed with `npm run deploy:proxy` |
| `.agents/scripts/run-hi-mcp-prompt.js`, `run-hi-mcp-tests.js` | End-to-end runs of prompts through the chat of the example page in a headless planner |
| `docs/test-prompts.json` | The end-to-end test cases |

## Contracts with roomle-ui

- **The log format is parsed.** `run-hi-mcp-prompt.js` collects the tool calls of a turn from the
  `[hi-mcp] tool <name> args|feedback|error <json>` lines the tools in the planner log to the console
  of the planner's frame, which the page console carries.
- **The test scripts use page globals** of `index.html` — see
  [Pages, chat and launcher](./pages-chat-and-launcher.md#before-you-change-these-files).
