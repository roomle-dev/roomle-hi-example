# HI Planning Assistant token count protocol

| Field | Value |
|---|---|
| Type | Feature analysis |
| Status | Implemented |
| Date | 2026-10-25 |
| Ticket | [RML-18301 — HI Planning Assistant - token count protocol](https://roomle.atlassian.net/browse/RML-18301) |
| Base | roomle-hi-example `master` at `20b45a258d`; roomle-ui local `feat/hi-mcp` at `afb5131e7d` |
| Analysis branch | roomle-hi-example `feat/hi-token-count-protocol-RML-18301` |
| Implementation | roomle-ui `feat/hi-token-count-protocol-RML-18301`, commit `c1bdbb467ebbead24ae2f7c6078ec0e6fc079103` |
| Embedding dev | `@roomle/embedding-lib@0.0.0-dev-c1bdbb4`, [workflow 40199692733](https://github.com/roomle-dev/roomle-ui/actions/runs/40199692733) |

## Affected repositories

- **roomle-ui:** capture the planning assistant's model usage in the embedding-lib, log one structured usage record per prompt, and cover the accounting with tests and agent documentation. Implementation must branch from `feat/hi-mcp`.
- **roomle-hi-example:** collect those records in the prompt runner, preserve prompt and test totals through facts extraction into the Markdown/PDF report, document the protocol, and select an embedding-lib version containing it.

## Request and scope

The ticket's two explicit requirements are to log consumed tokens for every prompt and to report
consumed tokens for every prompt and every test. Attachment `95483`, “Screenshot 2026-10-24 at
07.52.17.png”, asks for token counts in the test protocols. The ticket description and screenshot
were downloaded and read; the ticket has no comments or linked issues at the time of this analysis.

A **prompt** means one submitted chat turn, including an image-only turn. A **test** means the
conversation of prompts belonging to one test case for one model and one selected attempt. A turn
may make many model calls: all of them consume tokens, including the final answer after the tools.

The proposed scope is input, output and total token counts, with explicit handling of incomplete
measurements. The introductory material mentions prices and conversation accounting, but the two
implementation requirements request neither a pricing table nor user billing, persistence across
page reloads, a usage dashboard or a new chat control. These are separate features. Provider usage
is a measurement of what was reported, not an invoice: an interrupted request or an internal
provider retry can incur consumption for which no usage reaches the browser.

## Finding

The missing capture belongs in **roomle-ui's embedding-lib**, where `streamText` runs. The example
and the planner's tools cannot recover discarded provider usage. The report also needs changes:
adding a console line alone would leave both `run.json` and the generated report without counts.

Use the existing page-console path for a small structured usage protocol. This meets the request
without changing the planner's chat output API or adding a callback to the embedding API. An updated
embedding-lib is required for the feature to work. Local source serving can avoid a build while
developing; a shared example needs a dev or released package containing the change. A planner/UI
build is not required by this design.

## How the area works today

References to roomle-ui below use the inspected `feat/hi-mcp` commit. That local branch is clean
and 22 commits ahead of its local `origin/feat/hi-mcp` tracking ref (`5d4a0f3141`). The remote was
not fetched for this analysis; these are local inspection baselines, not a claim about the current
remote head. The tracking-ref version has the same usage-capture gap. No roomle-ui branch or source
file is changed by this analysis.

| Location | Present behaviour and implication |
|---|---|
| roomle-ui [hi-planning-assistant.ts:119–171](https://github.com/roomle-dev/roomle-ui/blob/afb5131e7d151ece3a9f172810f0277162ef9e50/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L119-L171) | Loads `ai@7.0.122`; runs up to 16 steps per prompt. The stream loop handles text, tool activity and errors only. Step and aggregate usage are discarded. Successful response messages are retained for later prompts. |
| roomle-ui [hi-planning-assistant.ts:172–178](https://github.com/roomle-dev/roomle-ui/blob/afb5131e7d151ece3a9f172810f0277162ef9e50/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L172-L178) | A failed turn logs its error and leaves conversation history unchanged. Earlier model calls of that turn can still have consumed tokens. |
| [index.html:947–959](../../minimal-hi-example/index.html#L947-L959), [index.html:1036–1040](../../minimal-hi-example/index.html#L1036-L1040) | Records the planner's output parts and starts the embedding-lib assistant. It does not call the model itself. The two package imports are pinned to `9.0.0-alpha.5`. |
| [run-hi-mcp-prompt.js:199–206](../scripts/run-hi-mcp-prompt.js#L199-L206) | Already captures `[planning-assistant]` console lines while a prompt is active. This is a usable channel for structured usage records without another browser API. |
| [run-hi-mcp-prompt.js:351–382](../scripts/run-hi-mcp-prompt.js#L351-L382), [run-hi-mcp-prompt.js:421–460](../scripts/run-hi-mcp-prompt.js#L421-L460) | Waits for each prompt callback and stores its answer, tools, errors and duration. No usage is collected. An errored turn ends the conversation. |
| [run-hi-mcp-tests.js:270–323](../scripts/run-hi-mcp-tests.js#L270-L323) | Preserves superseded attempts separately; `results.json` identifies the selected attempt and all attempt directories. Resume reuses completed results. |
| [extract-run-facts.js:109–139](../scripts/extract-run-facts.js#L109-L139) | Reads the selected `run.json`, then explicitly selects turn fields. Usage would be lost here unless the mapping is extended. |
| [build-test-report.js:190–219](../scripts/build-test-report.js#L190-L219), [build-test-report.js:263–275](../scripts/build-test-report.js#L263-L275) | Generates the per-test sections and summary tables. Neither contains token counts. The PDF renders this Markdown, so both formats can share one change. |
| [benchmark-hi-mcp-runs.js:39–44](../scripts/benchmark-hi-mcp-runs.js#L39-L44), [benchmarking skill](../skills/hi-mcp-benchmarking.md#1-the-runs) | Reads historical `[hi-chat] step` text. Current planning-assistant runs contain no such log. The [step-log backlog item](../backlog/README.md#chat) overlaps, but also requests step timing and tool attribution beyond this ticket. |

### The pinned SDK contract

The installed package is the same `ai@7.0.122` the assistant imports. Its declarations and
implementation were inspected, rather than assuming the semantics of an earlier SDK version:

- `StreamTextResult.usage` sums all steps; `totalUsage` is its deprecated alias
  (`node_modules/ai/dist/index.d.ts:2900–2914`, `dist/index.js:11620–11640`).
- A `finish-step` stream part carries that step's `usage`; `finish` carries `totalUsage`
  (`dist/index.d.ts:3159–3175`). This fits the stream the assistant already consumes.
- `onStepEnd` is the current step callback and `onEnd` the current completion callback. The pinned
  `onEnd` event also aggregates usage (`dist/index.d.ts:4243–4250`). The result promise and the
  final stream event provide clearer sources here, without another callback lifecycle.
- Counts can be `undefined`. SDK aggregation adds known counts even when another step lacks them
  (`dist/index.js:2875–2908`), so a numeric aggregate alone does not prove complete coverage.

The [official streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
confirms aggregate result usage and per-step usage. Its callback section and the pinned package
differ on the meaning of `onEnd.usage`; use the pinned implementation and test it directly. The
[example linked by the ticket](https://ai-sdk.dev/cookbook/node/stream-object-record-token-usage)
demonstrates collecting usage after streaming but does not define this repository's report contract.

## Proposed accounting and logging

Keep measurement inside the existing prompt handler. Observe completed `finish-step` parts for
coverage and partial results; use the final aggregate on normal completion. Do not add the final
aggregate to its constituent steps. Finalize the usage record once, before the prompt handler
returns, including when it catches an error or sees an abort. A synchronous model-call failure also
gets a record, with usage unavailable. Setup failure before the assistant accepts a prompt is not
a consumed prompt.

Log a single string with a fixed prefix and JSON payload, for example:

```text
[planning-assistant] usage {"provider":"azure","model":"example-deployment","status":"complete","inputTokens":1200,"outputTokens":180,"totalTokens":1380}
```

`provider` and `model` come from the resolved `PlanningAssistantConfig`, not just the launcher's
alias: `claude` and `anthropic`, for example, can select the same model. Do not log the config
object, API key, prompt, images or response body as part of this record.

| Field | Meaning |
|---|---|
| `inputTokens`, `outputTokens`, `totalTokens` | Non-negative numbers reported by the SDK; `null` where no count is known. A reported zero stays zero. Prefer a reported total; derive one from input and output only when both are known for the same step. |
| `status: complete` | The stream completed and every model step has the required counts. |
| `status: partial` | Some usage is known, but a step has missing counts or the stream failed/aborted before completion. Numeric values represent the known portion. |
| `status: unavailable` | No usage counts were received. This does not assert zero consumption. |

Use whole-prompt input, output and total counts, including repeated conversation context and tool
results sent back to the model. Do not count words or estimate tokens from text length. Reasoning
and cached-input details can be retained if needed later; they must not be added again to the
normalized input/output totals. No provider-specific response parsing is needed for Azure,
Anthropic, Mistral or Google.

This is consumption accounting, independent of plan success. A prompt with a planning error may
have complete usage; a successful plan may have unavailable usage. Preserve the existing answer,
errors, history and test verdict separately from usage coverage.

## Collection and report behaviour

The prompt runner should parse the fixed usage prefix in its existing console listener and retain
the record against the active turn. It should finalize collection after the existing prompt/abort
settlement, then store the result as `run.json.turns[n].usage`. A missing record, an older
embedding-lib or a destroyed page means unavailable usage, never zero. Malformed or duplicate
records must be diagnosed without corrupting totals or converting a usable planning into a failed
planning test. Verify delivery and attribution with a browser test; no sleeps or polling are
needed beyond the runner's existing prompt lifecycle.

The test total is the sum of its submitted turns for that model and selected attempt. Facts
extraction should preserve per-turn usage and derive the selected test's total from those turns,
so there is one calculation feeding every report table. Sum known numbers and propagate partial
coverage; if none are known, keep `null` and unavailable. An unavailable turn makes an otherwise
measured test partial. A skipped or unsubmitted prompt has no measured consumption and is labelled
not run, rather than inserted into the sum as zero.

Show input, output and total counts in the report's per-test summary and a compact per-prompt
table in each test section. Single-prompt tests still get their prompt row. Use exact integer
counts and print `partial` or `unavailable` beside incomplete values. For example:

| Prompt | Input tokens | Output tokens | Total tokens | Usage |
|---|---|---|---|---|
| 1 | 1,200 | 180 | 1,380 | complete |
| 2 | 2,400 | 220 | 2,620 | complete |
| Test total | 3,600 | 400 | 4,000 | complete |

The total above counts each request's context as consumed again. It is not the size of the final
conversation. Different models remain in their own rows; fixed, random, image and minimum-set
tests use the same path. The PDF should render these same tables without a second calculation.

Superseded retry attempts also consume tokens. Keep their own usage records in their archived run
directories. The main test total must be labelled **selected attempt** when retries exist, with
links to the preserved attempts; it must not imply all-attempt expenditure. A session billing total
or automatic accounting of attempts killed before any record is captured is outside this request.
Resuming a session must neither add the same attempt twice nor trigger reruns merely to fill usage
missing from an old result. Old reports remain renderable with unavailable usage.

## Embedding-lib delivery and branch dependency

The implementation branch in roomle-ui must start from **`feat/hi-mcp`**, not `master`. The local
baseline already contains both the assistant and the dev-package workflow. Before implementation,
reconcile the intended upstream tip without discarding the 22 local commits noted above.

There are two useful delivery modes:

| Mode | What is needed |
|---|---|
| Local development | In roomle-ui, `npm run dev:embedding -- --port 3001 --strictPort`; the default embedding port 3000 conflicts with the example. Temporarily point both imports at `http://localhost:3001/src/roomle-embedding-lib.ts` and `/src/hi.ts`, as in the [setup guide](../../docs/setup/unreleased-embedding-lib.md#from-the-source-of-a-local-roomle-ui-checkout-no-build). This serves source without publishing. Keep those localhost imports out of commits. |
| Shared example / reproducible tests | Build and publish the implementation commit through the existing dev-package workflow; pin both example imports to the exact `@roomle/embedding-lib@0.0.0-dev-<7-character-sha>` version, or a release containing it. A local source edit does not update the pinned `9.0.0-alpha.5` package. |

The workflow [cd-gcp-rubens-stage-roomle-com.yaml:540–606](https://github.com/roomle-dev/roomle-ui/blob/afb5131e7d151ece3a9f172810f0277162ef9e50/.github/workflows/cd-gcp-rubens-stage-roomle-com.yaml#L540-L606)
has `workflow_dispatch`, runs `npm run build:embedding`, sets the SHA-based version and publishes
with dist-tag `dev`. After implementation is pushed, the command is:

```bash
gh workflow run cd-gcp-rubens-stage-roomle-com.yaml \
  --repo roomle-dev/roomle-ui --ref <implementation-branch>
```

Confirm the dispatched commit, successful publish and exact package version before updating the
imports. The moving `dev` tag is insufficient for reproducibility. Workflow presence is verified
in the inspected branch; GitHub dispatch eligibility and npm publication are not exercised by this
analysis. The [setup guide](../../docs/setup/unreleased-embedding-lib.md#a-dev-version-on-npm)
describes permissions and possible dispatch failures.

`--dev` on the example changes the planner's `server_url` only; it does not select a local or dev
embedding-lib. The existing planner can stay in use because measurement is in the host and no
planner message type changes. ligna-store, RoomleCore, the HI library and `glue-logic.ts` require
no change for this request. No build or publication is performed during analysis.

## Alternatives considered

| Alternative | Assessment |
|---|---|
| Change only the report | Rejected: the current runs contain no usage to report. |
| Log only the last step | Rejected: a planning turn includes repeated model calls and their context. |
| Add a `usage` chat output type or a public telemetry callback | Not needed for this scope. It widens the iframe/public API while the runner already captures the assistant's console. A callback is appropriate if a later consumer needs a supported application telemetry API. |
| Intercept provider HTTP responses in the example | Rejected: duplicates SDK/provider handling and places measurement outside the owner of the model calls. |
| Restore the historical benchmark text format | Rejected for this ticket: it couples reports to human text and also requires step timing/tool attribution. The existing benchmark backlog remains open. |
| Count tokens locally or substitute zero for missing usage | Rejected: neither represents measured consumption, especially with images and reasoning. |
| Publish a dev package now | Rejected: an unchanged assistant still discards usage. Publish the implemented, tested commit. |

## Code and documentation affected by implementation

| Repository / file | Expected change |
|---|---|
| roomle-ui `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` | Observe step/final usage and emit one prompt record, including partial/unavailable outcomes. Keep the existing public signature and planner output types. |
| roomle-ui `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` | Mock usage-bearing streams and check prompt totals, error/abort coverage and exactly one log per prompt. |
| roomle-ui `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts` | Add a real pinned-SDK mock-model test of a tool call followed by an answer, verifying aggregate usage semantics. |
| roomle-ui `.agents/homag-intelligence/agent-architecture.md`, `packages/embedding-lib/docs/homag-intelligence-embedding.md` | Describe usage measurement/logging at the host agent loop and its coverage limits. |
| roomle-hi-example `minimal-hi-example/index.html` | Select the exact embedding package containing the implementation; no duplicate agent loop. |
| roomle-hi-example `.agents/scripts/run-hi-mcp-prompt.js` | Parse prompt usage records and persist them with their turns; include usage in the run's printed prompt summary. |
| roomle-hi-example `.agents/scripts/extract-run-facts.js` | Preserve turn usage and derive selected-test totals with coverage. |
| roomle-hi-example `.agents/scripts/build-test-report.js` | Render test-summary totals, per-prompt counts, coverage and selected-attempt labelling. |
| roomle-hi-example `.agents/scripts/tests/report-scripts.test.js`, a focused browser test in `.agents/scripts/tests/` | Cover the accounting/report pipeline and console-event delivery across consecutive prompts and failed turns. |
| roomle-hi-example `.agents/skills/hi-mcp-testing.md`, `.agents/context/deployment-and-testing.md`, `.agents/context/pages-chat-and-launcher.md`, `.agents/scripts/README.md` | Update the report specification and implementation reference in the same implementation branch. |
| roomle-hi-example `docs/test-prompts.md`, `docs/ai-chat.md`, `docs/setup/unreleased-embedding-lib.md` | Explain reported counts/coverage and the selected package for users; keep source detail in the linked agent reference. Update the package pin examples consistently. |

`run-hi-mcp-tests.js` can retain its existing results/attempt selection contract: the extractor
already reads the selected `run.json`. The generic PDF renderer needs a layout check, not a new
token-accounting implementation. No new runtime dependency is required.

## Required validation before the feature can be accepted

- **Assistant unit tests:** a text-only call; a tool call followed by an answer; consecutive
  prompts with fresh per-prompt totals; image-only prompts; zero counts; absent/partly absent
  counts; an error before usage; an error/abort after a completed step; no double counting of
  step usage and the final aggregate. Include a provider-reported total that differs from the
  simple input/output sum, and ensure telemetry cannot expose the API key.
- **Pinned-SDK integration:** use `MockLanguageModelV4` and the installed `ai@7.0.122`, with a
  two-step stream, to verify that the chosen final aggregate includes both calls. This protects
  against the misleading semantics of older SDK examples and changing online callback docs.
- **Runner browser test:** console records belong to the correct prompt, arrive before collection
  closes, survive the existing abort-settlement path, and are not taken from unrelated frame logs.
  An absent/malformed/duplicate record gives a diagnostic and correct coverage, without changing
  the planning verdict.
- **Report regression tests:** exact per-prompt and selected-test sums, two models, multi-turn and
  image-only cases, random/minimum-set reports, partial/unavailable/legacy data, preserved retries
  and resume. Verify the report needs no hand-entered counts in `evals.json`.
- **Package and report smoke check:** load the exact dev package, run a short single-prompt case
  and a multi-turn case, compare the structured log with `run.json`, `facts.json`, Markdown and
  PDF, and record the embedding version. Confirm totals are visible and tables fit the PDF.

Use `npm run test:unit -- <affected test paths>` and `npm run build:embedding` in roomle-ui, and
`node --test .agents/scripts/tests/*.test.js`, `npm run lint`, `npm run format:check` and the
Markdown-link checker in roomle-hi-example. Live provider smoke tests validate provider reporting;
the deterministic tests establish the accounting without spending model tokens.

## Analysis verification and remaining limits

This analysis reads the Jira description and attachment, both local repository baselines, the
assistant, runner, facts/report pipeline, retry selection and dev-release workflow, and the pinned
SDK's declarations and implementation. It proposes a feature; it does not claim runtime validation
of new behaviour. No productive code is changed and no model prompt, package build or workflow
dispatch is run. Documentation links and branch/file scope are checked when the document is added.

The remaining implementation questions are operational: the intended upstream `feat/hi-mcp` tip,
the dev version produced from the implementation commit, and which providers the eventual smoke
check uses. They do not prevent defining the logging/report contract. Exact consumption for a
request that never returns usage remains unknowable from the browser and must stay labelled as
incomplete.

## Implementation outcome

The approved plan was implemented on the two feature branches. The roomle-ui branch was created
from local `feat/hi-mcp` at `afb5131e7d`; its implementation commit was tested, built locally,
pushed and published by the dev-package workflow. Both example imports were pinned to the exact
published version after the registry and CDN entry points were verified. The existing planner
deployment was used for the smoke tests.

The embedding-lib logs one usage record per prompt. The shared collector/aggregation module is
`.agents/scripts/planning-assistant-usage.js`; the runner persists prompt records, the extractor
derives selected-test totals, and the report builder displays both levels with coverage. The
durable contract is in [the testing reference](../context/deployment-and-testing.md#prompt-token-accounting),
the [testing skill](../skills/hi-mcp-testing.md#token-counts) and the user-facing
[report guide](../../docs/test-prompts.md#token-counts-in-reports). The roomle-ui architecture and
embedding guide document the producer's contract. The benchmark timing backlog remains open.

Verification on 2026-10-25:

- roomle-ui: 24 tests passed across the assistant and pinned-SDK integration suites; the normal
  npm test command's lint checks, commit/push checks and `npm run build:embedding` passed using
  the repository's Node 24.12.0 and npm 11.6.2.
- roomle-hi-example: all 49 script tests and all 3 launcher tests passed; lint, formatting,
  Markdown links and whitespace checks passed.
- Published-package smoke: two tests, three prompts with `gpt-5-mini`, on the normal bo-test
  planner, all with complete usage and no collection warnings. The single-prompt total was
  19,084 tokens. The conversation's prompts used 173,931 and 154,814 tokens, totalling 328,745.
  The console records, `run.json`, `facts.json` and report tables agreed exactly. The report PDF
  was rendered and its summary layout inspected.
- Planning evaluation was one pass and one partial, with no feature bug: the model replaced a
  cabinet with a 900 mm article when asked for 800 mm. The tools performed that call and the
  report kept the model finding separate from complete usage coverage.

The smoke artifacts are under `.temp/result/rml-18301-token-usage-smoke/` (`report.md`,
`embedding-build.json`, `usage-verification.json`, runs and images); the PDF is
`.temp/reports/mcp-test-2026-10-25_gpt-5-mini-token-usage.pdf`. They remain local test artifacts.
This analysis is retained until the work lands on the default branch; no merge is part of this work.
