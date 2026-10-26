# Planning Assistant shared-reference benchmark

> **Date**: 2026-10-26
> **Status**: Complete — implementation and validation committed locally; not pushed
> **Task**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303), prompt-prefix caching

## Scope

This experiment compares the current on-demand reference workflow with a stable reference before
conversation history. It measures provider input/cache counters separately from transmitted bytes,
model calls, request latency and planning quality. The implementation is in roomle-ui on
`feat/hi-mcp-performance`; the runner, retained evidence and this interpretation are in
roomle-hi-example on `docs/planning-assistant-prompt-caching`. All task commits are local.

The source hypothesis comes from the
[performance note](https://github.com/Rabbid76/desktop-vault/blob/master/projects/ai%20assistant/performance.md).
Prompt caching can reuse input computation; it does not avoid sending the full request. The
[analysis](../refactoring-analysis/planning-assistant-azure-prompt-caching.md) separates those goals.
The implemented design and reasons live in roomle-ui's
[prompt-caching reference](https://github.com/roomle-dev/roomle-ui/blob/feat/hi-mcp-performance/.agents/homag-intelligence/prompt-caching.md)
and [ADR 0014](https://github.com/roomle-dev/roomle-ui/blob/feat/hi-mcp-performance/.agents/decisions/the-planning-assistant-uses-a-shared-reference-prefix.md).
Those branch links become available remotely only after a later authorized push.

## Protocol and source versions

| Variant | Content/policy | roomle-ui commit | Retained measurements |
|---|---|---|---|
| A | On-demand reference; telemetry only | `509f6e51df21f43e6a4f43dc0878910a18e01419` | [Baseline](planning-assistant-prompt-caching/baseline/benchmark.md) |
| B | Common rules and compact library before history; automatic caching | `35de729ab975d2f0f8b89fbe0c4e6482c5172239` | [Library/rules](planning-assistant-prompt-caching/library-rules/benchmark.md) |
| C | B plus the four operational skills and planning references; automatic caching | `bc7242b1d0766b158b7958ece058d4f18113b62b` | [Operational skills](planning-assistant-prompt-caching/operational-skills/benchmark.md) |

Each content variant uses two repetitions of these four fixed cases, in this order:

1. `full-kitchen-walnut-marble-corner` — text creation, materials and a corner layout.
2. `image-kitchen-left-wall` — image plus a named wall.
3. `image-only-no-text` — image-only galley layout in an L-shaped room.
4. `edit-add-move-delete-subarticle` — three consecutive shelf-edit turns.

That is eight case runs and twelve user turns per content variant. All comparative requests use
`gpt-6.1-sol`, `$AZURE_GPT_SOL_KEY`, its `controller-mes-resource` Responses endpoint and the
deployment's default reasoning effort. API keys are never retained. The separately evaluated final
minimum MCP suite uses **gpt-6-astra with `$AZURE_GPT_KEY`**, as corrected by the user; it is not a
paired latency comparison with Sol.

The planner is served from the recorded checkout at `http://localhost:5173`; both embedding imports
use port 3001 (`/src/roomle-embedding-lib.ts` and `/src/hi.ts`). Every case runs in a fresh browser
with `--dev`. The runner records both imported module URLs and planner-frame origins. A fresh
browser is **not** a cold provider cache. Variant order is sequential, not randomized.

The first unpaced pilot encountered provider rate limits on the image cases. All pilot attempts are
retained in [unpaced-pilot](planning-assistant-prompt-caching/unpaced-pilot/benchmark.md); provider
failures are excluded from successful-run means. The paired A/B/C measurements use the same
test-only minimum request-start interval of **20 seconds**. This pacing is outside production code.
It inflates elapsed time and SDK model-call timings; neither is a production latency or isolated
prefill measurement. Removing recorded waits arithmetically would not reproduce an unpaced run.

The baseline benefits from pilot cache warming. The first request's actual read/write counters are
reported instead of labelling entire repetitions cold/warm. There are no keep-alive requests.
Planning failures are not rerun for a better outcome. Tool errors can occur in a completed model
conversation and remain part of its measurements and quality evaluation.

The example measurement code is `c362aad` for A and `29d9453` for B. During B repetition 2, launcher
commit `2d20251` adds a capability field for the later boundary experiment. B's pinned embedding
ignores that field, so its serialized cache policy remains automatic. C uses `2d20251` with the
same ignored field. Manifests preserve this detail; no B/C result is described as explicitly cached.

## Cache-boundary capability check

Identical reference bytes do not alone prove the provider stores an entry at their endpoint. In
B repetition 1, the text, image and edit cases share the reference digest
`ed8801dd17e42748c33ae385b131ea4e69c719f77053967819e9064bce7d3a88` and **295,284 bytes**.
Nevertheless, the first image request reads only 13,386 tokens and writes 63,804 of its 77,193 input
tokens. A repeated identical image prompt in repetition 2 reads 77,190 tokens. This is evidence of
conversation-specific reuse, not full cross-prompt reuse of the library.

[Azure's current documentation](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching)
describes an explicit boundary after reusable content for supported GPT-5.6-and-later Standard
deployments. The default implicit policy also caches the latest message. Breakpoints do not apply
to older models or PTU-M; model names alone are insufficient capability evidence.

Two short direct Responses probes per deployment verified acceptance and reuse with a changed
question after the same marked reference:

| Deployment / resource | First input / read / write | Second input / read / write | HTTP |
|---|---|---|---|
| `gpt-6.1-sol` / `controller-mes-resource` | 3,541 / 0 / 3,538 | 3,541 / 3,527 / 11 | 200 / 200 |
| `gpt-6-astra` / `dfhifoundrysweden` | 3,541 / 0 / 3,538 | 3,541 / 3,527 / 11 | 200 / 200 |

These tiny probes establish API acceptance and cache behavior, not full planning performance.
Responses identify the requested model and expose cache-write counts. The Azure CLI session was
expired, so the exact ARM deployment SKU and the customer's tariff were not independently read.
No currency savings or precise SKU are inferred from deployment names. API acceptance and observed
reuse justify the narrowly configured capability in the launcher.

The option adds a text-block boundary and a digest-derived routing key under the adapter's
**azure** namespace. It retains the implicit history policy and default lifetime. It sends neither
an explicit-only policy nor a deprecated retention setting. The real pinned-adapter wire test
verifies serialization, role/order, reasoning effort, absence by default and measured request bytes.

## Measurement interpretation

The generated JSON retains per-turn cache-detail coverage, per-call counters/timing, transport
bytes/digests, reference bytes/digests, source manifests and actual runtime URLs. Provider totals are
counted once; aggregate totals are never added to per-step totals. Cache reads are a subset of input,
and reasoning is a subset of output. Missing counters are unknown rather than zero.

`reference` excludes tools, history and the current request; it is a local byte/hash identity check,
not a provider token count. `requests` counts UTF-8 serialized bodies for every fetch attempt,
including retries and inline images. No headers, credentials or request bodies are retained.
`referenceAcquisitionMs` covers the compact-library read and measurement before the model call.
First generated output can be a tool call or reasoning; first visible text can be an early progress
message rather than the final answer. Tool durations can overlap model output and must not be
subtracted as a presumed parallel critical path.

With two samples per case, the report uses median and range; it does not claim statistical
significance or a p95. The automated benchmark's plan-change count counts attempted plan-changing
tool calls, including rejected ones. It is not a count of successful mutations.

An all-raw-data variant is limited to the offline size comparison: the three generated source
catalog/master-data files total 944,238 compact JSON bytes, and all skill Markdown totals 123,450
source bytes. These are not model tokens or actual wire payloads. Adding raw master data beside
the existing compact vocabulary duplicates information; no paid all-raw variant is justified by
the present task. Detailed descriptions and source catalogs remain available on demand.

## Content-variant results and decision

| Case | Variant | Calls, median (range) | Input k, median (range) | Request MB, median (range) | Paced chat s, median (range) |
|---|---|---|---|---|---|
| Text corner kitchen | A | 5.5 (5.0–6.0) | 413.7 (359.9–467.5) | 1.86 (1.63–2.10) | 96.7 (87.1–106.3) |
| Text corner kitchen | B | 6.0 (5.0–7.0) | 547.7 (436.0–659.4) | 2.44 (1.96–2.92) | 112.8 (87.0–138.5) |
| Text corner kitchen | C | 4.0 (3.0–5.0) | 415.9 (301.2–530.6) | 2.12 (1.83–2.41) | 79.4 (71.3–87.6) |
| Left-wall image | A | 10.0 (10.0–10.0) | 851.3 (848.8–853.8) | 9.06 (9.02–9.10) | 189.6 (189.1–190.1) |
| Left-wall image | B | 9.0 (9.0–9.0) | 880.6 (870.8–890.4) | 8.84 (8.81–8.87) | 173.7 (172.9–174.5) |
| Left-wall image | C | 6.0 (6.0–6.0) | 659.1 (656.5–661.8) | 7.16 (7.08–7.25) | 116.8 (109.2–124.5) |
| Image-only galley | A | 13.5 (13.0–14.0) | 1363.7 (1098.7–1628.7) | 12.91 (9.80–16.01) | 296.5 (262.8–330.2) |
| Image-only galley | B | 10.0 (9.0–11.0) | 1100.7 (896.9–1304.5) | 9.04 (7.97–10.11) | 195.0 (173.1–216.9) |
| Image-only galley | C | 11.0 (10.0–12.0) | 1384.1 (1154.4–1613.7) | 17.09 (15.32–18.86) | 287.2 (258.8–315.7) |
| Three-turn shelf edit | A | 10.0 (10.0–10.0) | 382.4 (246.9–517.8) | 1.62 (1.03–2.21) | 183.1 (182.8–183.4) |
| Three-turn shelf edit | B | 12.0 (12.0–12.0) | 1141.2 (1140.7–1141.6) | 5.06 (4.89–5.23) | 234.1 (225.4–242.8) |
| Three-turn shelf edit | C | 12.0 (12.0–12.0) | 1388.2 (1387.9–1388.6) | 7.99 (7.75–8.22) | 292.8 (282.7–302.9) |

All 24 A/B/C case runs completed without a chat/provider failure. Tool-level calculation errors
are retained, not excluded. Values include all three turns for the shelf-edit case; MB is decimal.

| Eight-case cohort | Input tokens | Cache reads | Cache writes | Model calls | Request bytes | Paced chat seconds |
|---|---:|---:|---:|---:|---:|---:|
| A | 6,022,184 | 5,693,398 | 328,552 | 78 | 50,901,708 | 1,531.7 |
| B | 7,340,349 | 6,768,582 | 571,545 | 74 | 50,764,782 | 1,431.2 |
| C | 7,694,697 | 7,188,600 | 505,899 | 66 | 68,718,174 | 1,552.5 |

**Select B, the smaller library/rules prefix.** C removes reference-tool calls, and its text kitchen
and left-wall image results are encouraging. Across the whole measured mix, however, C uses 4.8%
more input and 35.4% more request bytes than B. Its paced chat duration is 8.5% higher despite 10.8%
fewer model calls. Its lower write count does not establish a currency winner without the tariff.
The larger bundle's overall benefit is inconclusive, so the approved plan's simpler-layout rule
applies. Operational skills and their references stay on demand. C remains in the Git history and
retained measurements; it is not the final default.

B itself has a significant edit penalty compared with A: the three-turn shelf case has median
1.141 million input tokens versus 0.382 million, and twelve calls versus ten. Overall input rises
21.9%, while request bytes are essentially unchanged. Do not describe the content refactor alone
as a general cost, network or latency improvement. The separate explicit boundary is necessary to
verify the intended cross-prompt library reuse on these deployments. The first A requests were
prewarmed by the pilot, so the cohort write totals are not a clean cold-start comparison.

## Planning-quality observations

The [retained observations](planning-assistant-prompt-caching/quality-observations.json) keep each
run's snapshot ID, final composition/placement/materials, fitting positions, answers and tool errors.
Full captures remain in the named session folders. These are benchmark quality checks, not a
replacement for the final evaluated minimum suite.

- All six text-kitchen results contain the corner layout and requested appliances/storage. Saved
  fronts use Walnut (215), and worktops Dark marble (324). Layouts and appliance housings vary.
- All six shelf conversations preserve the three carcasses and finish with two explicit shelves
  on the left, none in the middle and one on the right. The retained original left shelf is at
  1,665.5 mm, the new one at 1,050 mm and the moved right shelf at 1,198.5 mm, exactly 500 mm lower.
  Deleting the middle explicit shelf reveals the library's default interior and is disclosed.
- Left-wall image results stand at the requested wall and retain green/wood finishes. B includes
  dishwasher substitutions in both repetitions, deviating from the photo's storage arrangement.
  C preserves that sequence better here. Backsplash generation fails across the variants and is
  disclosed in their final answers.
- The galley images retain opposing runs in the narrow wing and a clear passage. Photo fidelity
  varies: A repetition 1 and both C repetitions choose a tall pantry/storage article where the
  expectation asks for a fridge. Glazing, extractor arrangement and some other photo details remain
  incomplete. B's galley results use fridge articles. This small sample does not establish a causal
  quality effect of prefix size, and provides no quality reason to prefer C.
- Material/handle changes and backsplash generation produce existing library calculation failures
  (notably 22025, the `None` JSON error and 14034), sometimes leading to repeated corrections and
  extra images. Those changing paths explain part of the timing/input spread. The current master
  data exposes the attempted handle values as selections and the backsplash switch as Bool;
  per-article verified-option restrictions still require separate investigation where applicable.

No France-specific or living-room end-to-end case is in this comparison. Deterministic source and
scope tests do not prove a model follows regional precedence in every conversation.

## Boundary validation and final minimum suite

The initial full-workload boundary check exposed an implementation defect: Azure rejected the
77-character key composed of a label plus SHA-256. All four requests failed before any model usage
was reported. [Those requests](planning-assistant-prompt-caching/boundary-rejected/benchmark.md)
remain excluded from successful means; their usage is unknown, not invented as zero. A regression
assertion fails against the original format and passes with the digest alone (64 characters).
This is a corrected implementation defect, not a rate-limit/environment failure.

The [corrected workload](planning-assistant-prompt-caching/boundary-validated/benchmark.md) completes
all four cases and six turns with UI `1c3cbd6be7d84b67709a5acc0e600f7725b2edd7` and example
`6e041409ee3476c5858300b55f41d5d2aad62073`. This is one additional repetition, using the same
Sol deployment and 20-second request pacing. Its reference digest is
`ac8d9cfdec1783b554b3bb08dc3d3e8b2bdd5858203f1f33eb3f61b851cb3633`; the serialized reference is
295,383 bytes. The additional 99 bytes versus B are provider metadata, not extra library content.

The first request of each fresh conversation reports:

| Case | Input tokens | Cache read | Cache write | No cache |
|---|---:|---:|---:|---:|
| Text kitchen | 74,884 | 0 | 74,881 | 3 |
| Left-wall image | 77,193 | 74,806 | 2,384 | 3 |
| Image-only galley | 76,122 | 74,806 | 1,313 | 3 |
| Shelf editing | 74,838 | 74,806 | 29 | 3 |

These observations verify reuse of the common prefix across different user prompts, images and
fresh browsers. In the automatic-only B cohort, the first different image reused only 13,386
tokens and wrote 63,804. With the verified boundary, the same case reuses 74,806 and writes 2,384.
This is stronger evidence for the boundary than comparing total cache-hit percentages after many
conversation steps. Later shelf turns also reuse their successful conversation history, reporting
90,554 and 100,959 cached tokens in their first requests.

Across the four corrected cases, measured input is 3,677,296 tokens, of which 3,439,790 are cache
reads and 237,392 are cache writes; 114 are uncached. There are 38 model calls and 31,206,182 request
bytes. The workload still sends the full reference on each request. Existing backsplash and handle
calculation failures recur in the image cases; text creation and shelf editing have no tool errors.
One repetition and different model decisions do not establish an overall latency or price gain.
Use the actual deployment's input/read/write tariffs before claiming a monetary saving.

The final **minimum** suite runs with `gpt-6-astra` and `$AZURE_GPT_KEY`, deployment-default
reasoning, the selected implementation and no artificial request pacing. It completes from
11:51:16 to 12:10:20 Europe/Vienna on 2026-10-26: **10 cases / 12 turns, 6 pass, 4 partial,
0 fail** for the selected attempts. This is correctness evidence on the requested model, not a
paired latency experiment against Sol. [Measurements](planning-assistant-prompt-caching/final-minimum/benchmark.md)
and [evaluations](planning-assistant-prompt-caching/final-minimum/evaluation.json) preserve its
provenance, prompts, initial plans, snapshot IDs and reasons.

| Selected-attempt measurement | Value |
|---|---:|
| Input tokens | 7,861,901 |
| Output tokens | 21,206 |
| Cache reads, already within input | 7,512,800 |
| Cache writes, already within input | 348,789 |
| Noncached input | 312 |
| Completed model calls | 80 |
| Fetch attempts, including SDK retries | 104 |
| Transmitted request bytes | 113,506,907 |

All twelve completed turns have complete usage coverage. Each selected conversation's first
request reuses at least 74,806 tokens. These are not controlled cold starts: prior attempts and
probes can warm the deployment cache. Three superseded attempts fail from Azure token-rate limits:
two shelf conversations and one family kitchen. Their known additional usage is 954,629 input
and 1,798 output tokens, with unavailable failed-request usage left unknown. The retained benchmark
contains all thirteen attempts and excludes the three failures from success means.

Quality findings are independent of cache counters:

- The three-turn shelf conversation preserves identities/placement and makes the requested edits.
- Text kitchens and the tall-bank/island image satisfy their requested layouts and appliances.
- The sink-at-water case is partial: the local planner lacks the release water-level override,
  so the visible supply is served as an anonymous obstacle and not an installation element.
  The assistant requests fresh installation data and reports its absence.
- Three image recreations are partial because of missing backsplashes, microwave/extractor or
  bridge details, and approximate glazing/finishes. Existing library issues 9, 10, 11 and 17
  reproduce; failed calculations retain the valid plan and the model recovers where possible.
- Four case rows reproduce two known catalog/planner or renderer issues. No new defect of
  reference assembly, retained history or Azure cache controls is identified. This minimum suite
  does not establish universal planning quality or regional compliance.

The complete illustrated report is
`.temp/result/mcp-test-2026-10-26_11-51-16/report.md`; its shareable PDF is
`.temp/reports/mcp-test-minimum-2026-10-26_gpt-6-astra.pdf`. The report's four bug-marked rows count
reproductions, not four new bugs. Reproduction references in the existing backlog are refreshed.
Both temporary source imports are restored after validation. The local embedding build passes;
no package publication is needed. UI `f2662f7c4` only normalizes an erased type annotation and
`387b45a71` aligns documentation; neither changes the measured `1c3cbd6` runtime.

## Reproduction

Use [reproduction.json](planning-assistant-prompt-caching/reproduction.json) for the original
prompts, initial snapshot IDs, image paths/hashes and settings. Check out the chosen UI commit in
an isolated worktree, with its dependencies installed or linked to a compatible checkout. Use the
Node version pinned by roomle-ui. From that checkout, run these in separate terminals:

```sh
npm run dev -- --port 5173 --strictPort
npm run dev:embedding -- --port 3001 --strictPort
```

Temporarily point **both** example imports to the source URLs listed in the manifest. Do not
publish a dev package or change the checked-in CDN version for this validation. Verify the module
URLs and planner origin in each captured `run.json`; `--dev` alone does not replace the embedding
library. Prepare a session from the manifest rather than the evolving tracked test suite:

```js
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const protocol = JSON.parse(await readFile(
  '.agents/benchmarks/planning-assistant-prompt-caching/reproduction.json', 'utf8'));
const session = '.temp/result/prompt-caching-repeat';
await mkdir(session, { recursive: true });
await writeFile(`${session}/tests.json`, JSON.stringify({
  models: protocol.model,
  randomTests: 0,
  plans: protocol.plans,
  promptSuffix: protocol.promptSuffix,
  categories: [{ category: 'benchmark', tests: protocol.cases }],
}, null, 2));
```

With `$AZURE_GPT_SOL_KEY` available in the environment, run:

```sh
HI_MCP_REQUEST_INTERVAL_MS=20000 node .agents/scripts/run-hi-mcp-tests.js \
  .temp/result/prompt-caching-repeat/tests.json \
  --out .temp/result/prompt-caching-repeat --dev
node .agents/scripts/benchmark-hi-mcp-runs.js \
  .temp/result/prompt-caching-repeat --out .temp/result/prompt-caching-repeat/benchmark
```

Use a separate session for each repetition, retain failures and record the exact new source commits
and actual cache counters. A different date can involve changed library data or service behavior;
compare reference digests and image hashes before claiming an exact repetition. Restore the two
temporary imports afterwards. Full plan XML, order data, answers and images of the original runs
remain in their `.temp/result/` directories; the retained JSON keeps measurements and provenance
without copying those large captures into Git.
