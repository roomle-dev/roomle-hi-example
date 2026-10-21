# Scripts and Testing

The workspaces and scripts, the unit tests, and the end-to-end runs with real models. How to run and
evaluate the MCP tests is in the [testing skill](../../.agents/skills/hi-mcp-testing.md).
[Back to the overview](./README.md).

## Workspaces and scripts

The repository root is an npm workspace root over `minimal-hi-example`.

| Where | Script | Runs |
| ----- | ------ | ---- |
| root | `start`, `dev` | the launcher, plain / `--dev` |
| root | `test` | the tests of the launcher (`minimal-hi-example/tests/`, `node --test`) |
| root | `plan:mistral`, `plan:gpt5`, `plan:gpt5.4`, `plan:gpt6` | the launcher with a chat model and its key from the environment |
| root | `format`, `format:check`, `lint`, `lint:fix` | Prettier, oxlint |

The chat of the example page loads the embedding-lib and the AI SDK from unpkg and esm.sh in the
page and needs no dependency here. Node 20 or later.

## Unit tests

| File | Covers |
| ---- | ------ |
| `minimal-hi-example/tests/start.test.js` | starts the real launcher on unused ports, with a model and a dummy key and without a model: the planning assistant config of the model, `no-store`, the 404 without a model, the 403 for a foreign Host; SIGTERM/SIGINT to only the launcher PID release the page port (POSIX; no model request) |
| `.agents/scripts/tests/*.test.js` | the test tooling (`node --test`) |

The HI tools are tested in roomle-ui, in `packages/web-sdk/packages/homag-intelligence/__tests__/hi-mcp/`
(`tool-executors`, `hi-mcp-server`, `plan-history`, `skills`, `interior-fittings`, `mcp-tool`,
`hi-mcp-tools`, `hi-mcp-fixture`), with `npm run test -- --run packages/homag-intelligence/__tests__/hi-mcp`
in `packages/web-sdk`; the forwarding of the embedding-lib in `tests/unit/embedding-lib/homag-intelligence/hi-mcp/`
(`hi-mcp-tools`, `hi-mcp-stream-text`), with `npm run test:unit:debugCI -- tests/unit/embedding-lib`.

The tool commands of the plan-changing tools are tested in roomle-ui, with `npm run test` in
`packages/web-sdk` (`packages/web-sdk/packages/homag-intelligence/__tests__/`):

| File | Covers |
| ---- | ------ |
| `hi-tool-commands/create-or-replace-groups-input-test.ts` | the payload of `create-or-replace-groups`: preparation, article ids, relations, docking corrections |
| `hi-tool-commands/create-or-replace-groups-placement-test.ts` | loading, the anchor frame from the article template, materials, obstacle hints, the placement by wall |
| `hi-tool-commands/place-group-test.ts` | `place-group` |
| `hi-tool-commands/group-commands-test.ts` | the command tools: ids, attributes, library changes, docking targets, row edits and their hints |
| `hi-tool-commands/placement-frame-test.ts` | positions in the placement frame and the `rowIndex` of every root |
| `hi-tool-commands/run-tool-command-test.ts` | the planner steps a tool command reports for undo |
| `hi-group-layout-test.ts`, `hi-group-placement-test.ts`, `hi-plan-space-test.ts` | relations to docking, including a real agent's kitchen; anchor root, anchor frames, repositioning, the placement frame; footprints, walls, corners, wall and corner placement, overlap |
| `article-template-test.ts` | `calculateArticleTemplate`: the article template calculated outside the plan, and its cache |

Many tests are named in [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md) as the guard of a decision or
a message — a renamed test breaks those references.

## End-to-end runs

The scripts in `.agents/scripts/` run real prompts through a real model, the chat of the example
page — the planning assistant and the HI MCP tools of the embedding-lib — and a headless planner. They need Playwright (`npm install` in `.agents/scripts`).

### One run — `run-hi-mcp-prompt.js`

```bash
node .agents/scripts/run-hi-mcp-prompt.js <model> <api-key> "<prompt>" ["<prompt>" …] \
  [--plan <ps_id>] [--image <file>] [--out <dir>] [--dev] [--headed]
```

1. Starts the launcher with the model, the key and `--no-open`, and parses its `Example:` line.
2. Opens the example page in headless Chromium (`--enable-gpu`: the software renderer draws the
   object-only image empty) with the plan, and waits until the plan context of the planner
   (`getExternalObjectPlanContext`) has articles.
3. Waits until the planner has loaded the plan's groups (`window.hiPosGroupsCompletelyLoaded`; it
   clears its undo history then) and the planning assistant reports the chat available
   (`window.hiPlanningAssistantOutput`).
4. Sends each prompt as one chat turn through the page (`onPlanningAssistantPrompt`; the planning
   assistant keeps the history) and waits up to 10 minutes for the turn to end. A turn that fails
   or times out is aborted (`window.hiPlanningAssistantAbort`), and the runner waits up to 3 minutes
   until the turn and the planner calls of its tools have ended; when they do not, the plan may still
   change and the run captures nothing (step 5). The answer, the tool
   activity and the errors are the output parts of the turn; the tool calls are the
   `[hi-mcp] tool <name> args|feedback|error` lines of the page console.
5. Reads the plan context (`window.hiAgentPlanContext`) and takes a snapshot in the page
   (`window.instance.extended`): images, plan XML, order data, and a saved plan snapshot id. The
   tool calls the planner ran during the chat come from `window.hiPlannerCalls`.

Output in `--out` or `.temp/result/<time>-<model>/`: `run.json` (turns, answers, tool calls,
errors, the snapshot id, `snapshotCaptured` and `navigations`), the plan context, the planner calls,
the images, the plan XML and the order data. Exit code 1 on an error or without a snapshot id.
Frame navigation is logged to `console.log` and stored with its timestamp, URL, main-frame flag,
run phase (`loading`, `chat`, `snapshot`, `complete`) and whether only the URL fragment changed.

### Snapshot persistence and repository ownership

`getExternalObjectSnapshot()` collects images, XML and order data. The separate
`saveExternalObjectSnapshot()` call persists the plan and returns `planSnapshotId`; local images
and XML alone do not establish that the plan was saved.

| Repository | Responsibility |
|---|---|
| roomle-hi-example | The prompt runner calls the planner API and stores its returned snapshot id and errors. The example's Save snapshot button uses the same API. |
| roomle-ui | The planner saves the external-object and full-plan snapshots through `RoomlePlanner` and `RapiAccess.savePlanSnapshot()`. `RapiAccess._fetch()` owns endpoint version selection through `resolveRapiUrl()`. |
| ligna-store | The planner and cart consume the same snapshot APIs supplied by roomle-ui. Endpoint selection belongs to the planner SDK. |
| RoomleCore | Supplies the plan XML and scene data; the planner SDK sends the persistence request. |

`/planSnapshots` requests use RAPI v2. In roomle-ui,
`packages/common/src/utils/rapi-version.ts` switches a versioned base URL per request: only paths
listed in `RAPI_V3_PATHS` use v3; plan snapshots are outside that list. Custom proxy base URLs
without a version suffix are preserved. The test runner and host pages use the planner API
without constructing or overriding the snapshot endpoint. The routing tests are in roomle-ui's
`tests/unit/common/utils/rapi-version.spec.ts`.

An API save failure is recorded as `saving the snapshot failed: …` in `run.json`. It is distinct
from interrupted browser capture and does not by itself trigger the suite's navigation retry.

### The suite — `run-hi-mcp-tests.js`

```bash
node .agents/scripts/run-hi-mcp-tests.js [docs/test-prompts.json] [--out <dir>] [--dev]
```

Reads `models` (provider and key, `"$NAME"` reads the environment), `plans` and `tests` from the test
file, validates it, and runs every model × test as a child `run-hi-mcp-prompt.js`. An explicit
`randomTests` count must be a whole number from 0 to the number of available plans.

The [testing skill](../../.agents/skills/hi-mcp-testing.md#3-tests) prepares a full session file
from the selected fixed cases, then the requested number of random cases.
The agent writes their prompts and expectations before running them. A `jq` composition command
checks the generated counts, expectations, plans, markings and unique ids. Cases stay
in the session directory, and a resumed session uses the same prepared file. Runs limited to
named tests add cases only when requested. The CLI executes supplied cases; it does not generate
them. Direct execution on `docs/test-prompts.json` runs its fixed cases only.

The suite makes at most three attempts when a run produces no `run.json`, navigation interrupts its
snapshot capture, or a provider/transport error matches `Failed to process successful response`,
`ECONNRESET`, `socket hang up`, `fetch failed`, `terminated` or `AI_APICallError`. A capture is
interrupted when it has no saved snapshot id and a destroyed-context/navigation error, or when
`snapshotCaptured` is false and a frame navigated during `chat` or `snapshot`. Initial loading and
fragment-only URL changes do not trigger the latter condition. A missing saved snapshot id alone
does not trigger a retry.

Before a retry, the entire superseded directory is moved to `<NN>-<test id>.attempt-<n>/`. The retry uses
the original plan and prompts in a fresh browser and writes to the normal test directory.
`results.json` names that selected directory in `dir` and lists all attempt directories in
`attempts`; reports evaluate the selected directory and retain every superseded attempt as diagnostics.
A rerun with the same `--out` resumes an interrupted attempt or an archived attempt awaiting
its retry. With two superseded attempts, the third attempt stays in the normal directory, including
its failure or its console log when no `run.json` exists. Resume neither archives it nor launches
another attempt. Completed error-free runs and errors outside the retry conditions are skipped.

`results.json` is rewritten after every run and preserves ids, titles and the random flag. The
`expect` of a test is evaluated by the agent, not by the script. The skill
writes one report and PDF per session, with separate fixed and random counts and the
generated case JSON. The duration depends on the selected models, case count and number of turns.

The test infrastructure has regression coverage independent of the MCP unit tests:

```bash
node --test .agents/scripts/tests/*.test.js
```

The suite tests run the actual runner with local fake prompt processes. The generated-case tests
execute the skill's documented `jq` composition filter and cover counts, case metadata,
fixed/random execution, zero random cases, focused runs and resume without duplication.
The browser tests use
Playwright and intercepted test pages to navigate the main page and planner frame while a capture
is pending. They make no model requests and require the existing Playwright installation in
`.agents/scripts/`; the generated-case tests also require `jq`.

When an interactive `npm start` holds port 3000, run with `EXAMPLE_PORT` set to a free port.
