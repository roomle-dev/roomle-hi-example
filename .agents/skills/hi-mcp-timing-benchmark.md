---
name: hi-mcp-timing-benchmark
description: Create detailed HI Planning Assistant timing reports with per-step model, tool and planner deltas, skills-to-first-plan latency, and a local PDF.
---

# HI MCP Timing Benchmark

**Load when:** the user asks how long each part of an HI agent turn takes, how long the agent
operates at each step, how long tools take to assemble information, or how long it takes from
skills to the first kitchen or from start to finish. For a question about an existing report,
answer from its tables; run the full workflow when a benchmark or report update is requested.

**Goal:** A report in `.agents/benchmarks/<slug>.md` with explicit duration columns, plus a PDF in
`.temp/`. Keep raw captures, instrumentation and generated summaries in `.temp/`; commit only the
report and its index entries unless the user requests evidence publication.

Use [hi-mcp-benchmarking](hi-mcp-benchmarking.md) for the sampling, comparison and diagnosis rules,
and [hi-mcp-testing](hi-mcp-testing.md) for the prompt runner. This skill adds the timing capture
and report contract. The [left-wall image kitchen report](../benchmarks/01-iklw-oa-orig-2026-10-26.md)
is an example of the output, not a set of timings or model defaults to reuse.

## Independent reports

Each measured source version or variant has its own report and PDF. A repeat creates a new
report; keep earlier reports unchanged. Put before/after timings in a separate comparison
document that links the standalone reports. Do not append earlier runs or another variant's
timelines to the new-run report.

When continuing an existing benchmark series, use the original report as the baseline and
preserve its section order, table columns and per-call **Request bytes** column in the new report.
Number only the standalone measurements (01, 02, 03, …). Keep one unnumbered comparison and
extend it with future results; do not replace the original baseline with an extra measurement.
Use existing captures for document corrections; a layout change needs no new model run.

## Procedure

### 1. Define the run and its clocks

Preserve the requested test, model/provider, key variable, planner URL and reasoning setting.
`openai:<model>` uses direct OpenAI; a bare `gpt-*` name selects an Azure deployment in the launcher.
Do not substitute one for the other. Keep credentials in the environment and put only variable
references such as `$AZURE_GPT_KEY` in session files.

**The provider of every benchmark from 06 on is the Azure deployment:** `azure:gpt-6-astra` with the
key `$AZURE_GPT_KEY` and the cache breakpoint — in the runner's tests file its entry of
`docs/test-prompts.json`, `{ "provider": "azure:gpt-6-astra", "apiKey": "$AZURE_GPT_KEY", "cacheBreakpoint": true }`,
on the command line `azure:gpt-6-astra "$AZURE_GPT_KEY" --cache-breakpoint`. Benchmarks 01–05 ran on direct OpenAI
(`openai:gpt-6-astra`, `$OPENAI_ASSISTANT_API_KEY`) and are not continued: compare their turns with
the Azure series for the shape of a turn, not for the seconds.

Reuse usable captures first. An explicit request to run the named benchmark is authorization;
state the repetition count and expected cost without asking for the same approval again. When new
paid runs are not authorized, obtain that authorization before starting them. Use two valid runs
per test/model for the normal repeated measurement; label a user-requested single run as a pilot.
Creating or validating this skill does not authorize a model run.

Create a fresh session under `.temp/result/`, with one repetition directory per run. Select only
the requested cases from `docs/test-prompts.json`, with `randomTests: 0`. Record whether the suite's
`promptSuffix` is applied; send the same effective prompt in every repetition. Use the testing
skill's preparation and bounded retry workflow, retaining failed attempts and exclusions.

Record a local manifest with:

- Both repository SHAs and any source modifications used during capture.
- Test ID, starting plan, effective prompt, image path/digest, resolved provider/model and reasoning setting.
- Planner and embedding module URLs actually loaded, Node/browser versions, repetition and request pacing.
- Initial provider cache state as observed or unknown; browser HTTP cache and any warm-up/readiness reads.

Name the time origins before collecting data: assistant callback start, recorded runner start,
and full runner subprocess start. They answer different questions. The runner's recorded start
is after browser launch; subprocess elapsed time also includes launch and shutdown.

### 2. Capture the missing boundaries

Inspect the current [prompt runner](../scripts/run-hi-mcp-prompt.js), example's `recordedPlannerApi`,
and roomle-ui's `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` and
`packages/web-sdk/packages/homag-intelligence/src/hi-mcp/planner-api.ts`.

Existing `run.json.turns[].usage.diagnostics` version 1 supplies model durations, first generated
output, first visible text, reference acquisition, turn duration, usage, request bytes and digests.
`planner-calls.json` records forwarded tool durations, not all nested planner durations. Existing
`[hi-mcp] call` lines mark planner starts only. Neither file alone provides the complete timeline.

Use the existing diagnostics where sufficient. Add missing markers with temporary browser hooks
or Playwright response transforms, keeping scratch collectors in `.temp/`. For local assistant
source use [the local embedding setup](../../docs/setup/unreleased-embedding-lib.md): `--dev`
selects the planner on port 5173 but does not select a local embedding-lib. Use free ports for the
example and embedding server, and verify the loaded module URLs. Do not restart the user's planner.
Source transforms must check that their target matches; validate the hooks without model calls
before the paid run. A relocated runner must preserve its original repository/launcher paths and
resolve imports from `.agents/scripts/`; moving it changes the `import.meta.url` base. Browser
routing disables the normal HTTP cache, and extra logging/serialization has overhead: disclose
those effects. If permanent logging is necessary, follow that repository's change workflow.

Record these boundaries using `performance.timeOrigin + performance.now()` so host and iframe
markers can be compared. Keep IDs and parent call IDs where available.

| Boundary | Record |
|---|---|
| Assistant turn | Start and completion; the existing diagnostic turn duration |
| Model call | SDK start/end when available, response duration, first generated output, finish reason and call order |
| Model transport | Fetch start, response headers/status and failure; request bytes/digest, without bodies or headers |
| Tool | Forward start/end, tool ID/name/input, success or error and result bytes |
| Nested planner call | Method, start/end, call ID and enough arguments to identify the requested section or command |
| Skill response | Skill name/file and completion time, including later mandatory references |
| Plan creation | The successful create call and confirmation that it returned/loaded a nonempty group |
| Visible text | First text delta; capture final-answer text start separately if that latency is requested |

If the SDK supplies only completion time and response duration, derive `start = end − duration`
and label that start as derived. Keep fetch and SDK timings separate. Preserve partial/failed
requests and missing counters rather than inventing completed calls or zero usage.

For nested calls, correlate IDs where possible. Otherwise use tool-start log order and method/
argument evidence only where attribution is unambiguous. Temporal containment alone cannot assign
a planner call to one of several concurrent tools; leave an ambiguous parent unknown.

Preserve `run.json`, `planner-calls.json`, timestamped events (for example `timeline.json`), console
output, final plan context, snapshot ID and screenshots locally. Record tool result bytes as UTF-8
of the serialized result, distinguishing base64 image bytes from tokens. Do not retain credentials
or model authorization headers. Stop only the temporary processes started for the capture.

### 3. Calculate explicit deltas

Use measured durations, not token-based estimates. For intervals, `unionMs` means the length of
their merged time ranges: two parallel 100 ms calls can occupy 100 ms of wall time, not 200 ms.

| Report value | Calculation / boundary |
|---|---|
| Individual call delta | `end − start`, in seconds; retain milliseconds for short tool/planner work |
| Agent/model delta | SDK model-call response duration; provider round trip and stream handling included |
| Tools delta per agent step | `unionMs` of the tools attributable to that model step |
| Total step delta | Model start to its tools' completion; final step ends at turn completion |
| Uncovered step time | Total step delta minus the union of model/tool intervals within that step |
| Whole-turn model/tool time | Separate interval unions; measure their intersection so overlap is counted once |
| Other turn time | Turn duration minus the union of all model/tool intervals |
| First kitchen | First successful create completion minus turn start; also show runner-start latency |
| After initial skills | First kitchen completion minus the last initial SKILL.md response completion |
| After all required skill files | First kitchen completion minus the last required skill/reference response completion |
| Post-create latency | Turn completion minus first kitchen completion |
| Recorded run duration | Runner ready + chat + snapshot phases |
| Full run duration | Runner subprocess start through browser/launcher shutdown |

Associate steps with actual model/tool calls. Keep bootstrap reference acquisition outside the
first model step. State that small gaps between steps are outside their step totals; do not claim
that summing step durations reproduces the turn when gaps or overlap exist.

Name the two skills-to-kitchen intervals separately when the agent retrieves a planning reference
after the initial skill responses. If the material was supplied up front, mark it supplied rather
than inventing a fetch. If no kitchen is created, report that milestone as unavailable. A failed
create or a successful result containing only `notLoaded` entries does not establish it.

Call create completion a conservative loaded-plan milestone. Do not call it the first painted
frame without a scene/render marker. Likewise, model duration is not isolated reasoning/compute;
first generated output can be a tool call or reasoning and is distinct from first visible text.

### 4. Write the report with durations in the tables

Use the general benchmark's document outline. Include source versions, run settings, exclusions,
clock definitions, repeat procedure, uncertainty and the following tables. Do not make readers
subtract cumulative timestamps to learn how long each agent step took.

| Required table | Columns / contents |
|---|---|
| Milestones, both runs and mean | Initialization, warm reference acquisition, first output/text, first kitchen, completed answer, snapshot/save and full run; name each origin |
| Agent steps, per run | Step, work/following tools, Start s, End s, **Agent/model delta s**, **Tools delta s**, **Total step delta s** |
| Model calls, per run | Call, start/end, **Delta s**, first-output wait, remaining stream time, input/output/reasoning tokens, **Request bytes** and following tools |
| Tools, per run | Call, requested information/operation, start/end, **Delta s**, elapsed ms, nested planner time, remaining time, result bytes and outcome |
| Nested planner calls | Call/parent tool, method/arguments, start/end, **Delta s** and elapsed ms |
| Skills to first kitchen | Initial skills complete, last required reference complete, create start/end; both interval deltas, with model/create/local-gap breakdown where measured |
| Turn accounting | Model union, tool union, overlap, other work and total, with shares |
| Usage and transport | Calls, tokens, independently covered cache counters, reference bytes, each individual HTTP request body and available input/tools/envelope sections, retries and saved snapshot IDs |

Keep the **Request bytes** column in each model-call table, alongside its duration and tokens; a separate transport breakdown supplements it. Request bytes are each call's actual UTF-8 body, with SDK step association where available. Label
turn sums separately. Net growth is not the new-content payload; new/repeated item measurements
are independent of provider cache reads.

Explain that Start/End are timestamps relative to turn start and Delta is elapsed duration. Keep
sub-millisecond gaps out of unsupported precision claims and note display rounding.

Use run/step/call identifiers to support findings. Tool elapsed minus nested planner time includes
forwarding, scheduling, validation, projection and serialization; it is not pure assembly CPU time.
The runner's readiness catalog read calculates the article templates before the prompt, so label
subsequent reads warm. A measurement of a page's first read waits for the catalog with an empty
list of article ids (`getExternalObjectLibraryContext(['articles'], { articleIds: [] })`), which
lists the articles without calculating a template, and lets the prompt follow the page's own reads
— the planning assistant reads the library before the first prompt — as
[benchmark 08](../benchmarks/08-az-warm-2026-10-27.md) does.
Report provider queueing, prefill, reasoning, generation, network and kernel/render work as unknown
where the markers do not separate them. Equal byte lengths do not establish equal reference
content; compare digests before claiming reuse. Do not fit a performance model to a tiny sample.

Use [benchmark-hi-mcp-runs.js](../scripts/benchmark-hi-mcp-runs.js) to generate its supported summary
under the local session. Its current model-call path leaves aggregate tool/other time unknown;
compute those from the captured intervals rather than filling them by subtracting assumed tools
from model time. Keep the report self-contained with the measurements and metadata needed to
interpret it; write local evidence locations as inline code, not links that break in a clone.

### 5. Generate the PDF and verify

Render from the final `.agents/benchmarks/<slug>.md`, not a stale scratch copy:

```sh
node .agents/scripts/render-report-pdf.js \
  ".agents/benchmarks/<slug>.md" --out ".temp/<slug>.pdf"
```

For wide tables, use a scratch copy of that renderer with landscape pages and wrapping cells.
A relocated copy must resolve `marked`, `playwright` and `sharp` from `.agents/scripts/node_modules`
instead of relying on module resolution from `.temp/`. Inspect the agent-step and detailed tool
tables for clipped columns and page breaks. Regenerate the PDF after every report change. Keep the PDF and any renderer adaptations in `.temp/`.

Before delivery, check:

- Runtime origins/modules and manifest agree with the requested provider, planner and source versions.
- Model requests/callbacks and tool/planner starts/ends pair; ambiguous or missing events stay explicit.
- Model/tool interval accounting reconciles with the measured turn, including overlaps and gaps.
- Skills-to-kitchen deltas use the recorded reference and successful create endpoints.
- Usage/request-byte totals agree with diagnostics; missing coverage is not zero.
- The plan/snapshot supports the creation milestone and final answer; note errors and fidelity limits.
- Relative report links resolve; the PDF is readable and reflects the final report.

Run a scratch calculation check on known or synthetic intervals when adding a collector or
changing aggregation: overlapping calls, no creation, a failed create before a successful one,
and missing correlation must not become misleading durations. Use existing parser tests where
applicable. Validation of a documentation-only skill uses local artifacts and no model requests.

## Hard rules

- Preserve the user's run scope and existing authorization; estimate additional paid runs before requesting them.
- Explicit step-duration columns and the skills-to-kitchen delta are part of the report, not optional prose.
- Keep raw evidence, generated summaries, instrumentation and PDF local in `.temp/` by default.
- Register the report in the benchmarks and master indexes. Publish or comment externally only
  when the user's request or an explicitly invoked workflow authorizes it; this skill adds no such authorization.
- Load [hi-github-workflow](hi-github-workflow.md) when commit/push/PR work is requested. Do not
  infer publication from a request to measure performance.

## Completion checklist

- [ ] Requested fixture/provider/key reference and actual runtime/source versions recorded.
- [ ] Repeated usable runs or a clearly labelled pilot; failures retained and exclusions explained.
- [ ] Per-step agent/model, tool and total deltas; per-call durations; both skill milestones where relevant.
- [ ] First kitchen, completed answer and full-run time use named boundaries; overlaps/gaps reconcile.
- [ ] Self-contained report in `.agents/benchmarks/`, with both index entries.
- [ ] PDF generated from the final report in `.temp/` and checked for clipping.
- [ ] Raw captures and temporary code remain local; no new model run for skill validation.
