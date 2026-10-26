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

The HI tools, their tool commands and the forwarding of the embedding-lib are tested in roomle-ui, see
[Testing](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md#testing) of its HOMAG
Intelligence guideline.

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
   object-only image empty) with the plan, and waits until the library context of the planner
   (`getExternalObjectLibraryContext`) has articles.
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

### Prompt token accounting

`planning-assistant-usage.js` listens for `[planning-assistant] usage <JSON>` while one prompt runs.

Version 1 `diagnostics` travels unchanged from that record into each turn's usage and extracted
facts. It holds per-model-call timings, independent cache/reasoning coverage, request byte counts
and digests, reference metadata and whole-turn timing. Reports show cache coverage and transport
bytes separately from the token totals. The benchmark reads these current records first, with
legacy step-log support for older runs. Absent counters stay unknown; tool time is not inferred
from model-call time. A run with chat errors stays in the output and is excluded from successful-run
comparisons.

`HI_MCP_REQUEST_INTERVAL_MS` optionally spaces Azure model requests in the test browser. The
default is zero. The runner records the interval, loaded local embedding module URLs, planner
origins and per-turn waits in `run.json`. This is test-only pacing for rate-limited deployments;
it leaves production code unchanged. Compare runs with the same interval and report waits
separately. Paced chat/model times are not normal interactive latency measurements.
It verifies the console message's execution context is the host page, then validates the resolved
provider/model, non-negative integer counts and coverage. The collector stops after the prompt
callback and any abort settlement, and awaits the context checks already in flight. It uses no
extra wait or timer. Missing, malformed, duplicate or inaccessible records produce `usageWarnings`
and unavailable counts; these diagnostics are separate from planning errors and verdicts.

`run.json.turns[].usage` holds `provider` and `model` when known, `inputTokens`, `outputTokens`,
`totalTokens` and `status`: `complete`, `partial` or `unavailable`. Unknown counts are `null`, zero
is measured, and partial numbers cover only the known portion. The embedding-lib measures all
model calls of the prompt, including tool results and conversation context sent again; the final
aggregate is not added to its steps. Interrupted requests can consume tokens the provider never
reports. The record is not an invoice or the size of the final conversation.

`extract-run-facts.js` preserves prompt usage and derives each selected test's total once from its
submitted turns. It retains `attemptDirs` for links to retry diagnostics. Reports show exact token
counts per prompt and test, the coverage, and `not run` for unsubmitted prompts. Test totals cover
the selected attempt; archived attempts retain their own records and are linked separately. Resume
does not add the same attempt twice or rerun an old result to fill missing measurements. Legacy
results render with unavailable usage. `build-test-report.js` renders the same counts into the
Markdown consumed by the generic PDF renderer; `evals.json` supplies no token counts. The
Random tests overview includes input, output and total tokens and coverage for every random run,
using the same selected-attempt totals as the main summary. Multi-model reports render a random-test
table per model and mark a missing run as `not run`; retention recommendations remain advisory.

`tests/planning-assistant-usage.test.js` covers aggregation and real Chromium console delivery,
including consecutive prompts, failed/aborted turns, invalid records and ignored planner-frame
logs. `tests/report-scripts.test.js` covers selected-attempt totals, multiple models, minimum and
random tests, images, known zero, legacy and partial measurements, and repeat extraction.

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

Reads `models` (provider and key, `"$NAME"` reads the environment), `plans` and `categories` from
the test file, validates it, and runs every model × test as a child `run-hi-mcp-prompt.js`. A
category is `{ category, tests }`: a unique name and at least one test. The runner runs the tests
of all categories one list in the order of the file and numbers the run directories across the
categories. An explicit `randomTests` count must be a whole number from 0 to the number of
available plans.

The [testing skill](../../.agents/skills/hi-mcp-testing.md#3-tests) prepares a full session file
from the selected fixed cases, then the requested number of random cases in a last category
`random`.
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
