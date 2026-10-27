# Benchmarks

Run reports record one measured source version or variant. Separate comparison documents link
those reports and show how timings change. Each report contains its measurements and source
versions, explaining where the time goes and which steps cost it. Raw captures, generated summaries and PDFs stay in `.temp/`
unless the user requests committed evidence; such evidence goes in a folder of the report's name.

Written with the skill [hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md), which also
says how to repeat a benchmark after an improvement. For detailed per-step model/tool/planner
deltas, skills-to-first-kitchen time and a local PDF, also use
[hi-mcp-timing-benchmark.md](../skills/hi-mcp-timing-benchmark.md).

## What belongs here

Point-in-time measurements and their analysis. A document covers:

- what was asked, and the tests, models and runs measured
- how it was measured, and which runs were left out and why
- where the time goes: per test, per kind of step, per tool, and what the context is made of
- the flaws that cost steps and time, each with its evidence and its cause
- the proposed improvements, each with its expected saving
- what is open, and the measurement gaps

## What does not belong here

How the chat, the server or the tools work today — that is living reference in
[`docs/`](../../docs/) and the skills. A benchmark is evidence of what was true on its date and for
its build; confirm against the code before acting on one.

## Lifecycle

A benchmark stays as the baseline until the improvements it proposes are measured. Each new measured version
has its own report next to it. A separate comparison document links the independent reports and
contains the before/after tables; earlier run reports stay unchanged. Once the improvements have
landed and are measured, the durable outcome — the step cost of a model, a rejected approach — is
promoted into the living reference, and the document can be deleted.

The provider of every benchmark from 06 on is the Azure deployment `gpt-6-astra` with
`$AZURE_GPT_KEY` ([the timing skill](../skills/hi-mcp-timing-benchmark.md#1-define-the-run-and-its-clocks));
01–05 ran on direct OpenAI, so their seconds are not compared with the Azure series, their turn
shapes are.

Filename abbreviations: `iklw` = image kitchen left wall; `oa` = OpenAI Astra; `az` = Azure Astra;
`orig` = original; `base` = baseline; `rc` = response chaining; `preloads` = scoped live context and first-image guidance; `jpg` = JPEG plan images;
`due` = renders and context reads when due; `skill` = one skill round, the reference served with the skill; `state` = the plan state supplied per turn; `attrs` = the two-level attribute section; `cmp` = comparison.

The series has four numbered reports: **01 original**, **02 response chaining**, **03 response chaining plus preloads**, and **04 response chaining with JPEG plan images and renders when due**. Each contains two repetitions. The comparison is unnumbered and is extended when future runs are added.

The selected implementation uses **02's response-chaining behavior**. The automatic preloads of
03 are discarded because their added complexity has no demonstrated overall benefit. Report 03
remains measured evidence; the source-equivalent rollback requires no new benchmark. See
[ADR 0015](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/keep-live-plan-state-and-image-guidance-on-demand.md).

## Current Documents

| Document | Status | Description |
|---|---|---|
| [Benchmark 09: left-wall image kitchen with the two-level attribute section](09-iklw-az-attrs-2026-10-27.md) | Measured | Benchmark 09 of image-kitchen-left-wall with the two-level attribute section (D122), `gpt-6-astra` on Azure, in the layout of the baseline: the kitchen at call 2 with no lookup before it after 32.8 / 27.0 s (mean 29.9 s), 8,722 input tokens less per request, the create call 25.0 / 17.9 s; the handle colour looked up and set after the kitchen; the article's sink over the hob in run 2, fixed in 40.7 s in run 1 |
| [Benchmark 09: walnut text kitchen with the two-level attribute section](09-fkwm-az-attrs-2026-10-27.md) | Measured | Benchmark 09 of full-kitchen-walnut-marble-corner with the two-level attribute section (D122), `gpt-6-astra` on Azure, in the layout of the baseline: the kitchen at call 2 after 28.9 / 26.3 s (mean 27.6 s), no lookup, 8,722 input tokens less per request, the create call 22.0 / 21.7 s; the article's hob and oven are the models the baseline chose |
| [The baseline: walnut text kitchen on the Azure deployment](baseline-fkwm-az-2026-10-27.md) | Measured | The baseline of full-kitchen-walnut-marble-corner on `gpt-6-astra` on Azure with A, B, D, E, F and the plan state per turn, in the layout of 01: the kitchen at call 2 after 36.1 / 40.1 s (mean 38.1 s), the turn 68.4 / 47.4 s; the create call, 30.0 / 26.8 s, is the largest block before the kitchen |
| [The baseline: left-wall image kitchen on the Azure deployment](baseline-iklw-az-2026-10-27.md) | Measured | The baseline of image-kitchen-left-wall on `gpt-6-astra` on Azure with A, B, D, E, F and the plan state per turn, in the layout of 01: the kitchen at call 2 after 33.1 / 29.7 s (mean 31.4 s), the turn 96.9 / 54.5 s; the create call, 27.9 / 23.7 s, is the largest block before the kitchen |
| [Original left-wall image kitchen timing](01-iklw-oa-orig-2026-10-26.md) | Measured | Original baseline, preserved unchanged |
| [Left-wall image kitchen: response-chaining run](02-iklw-oa-rc-2026-10-26.md) | Measured | Two chained repetitions; independent timing and per-call byte report |
| [Left-wall image kitchen: preloads run](03-iklw-oa-rc-preloads-2026-10-26.md) | Discarded attempt — evidence retained | Two repetitions with both preloads; selected code uses response-chaining behavior from 02 |
| [Left-wall image kitchen: JPEG images and renders when due](04-iklw-oa-rc-jpg-due-2026-10-27.md) | Measured | Two repetitions on the local planner: 02's chaining with JPEG plan images and the served text on renders and reads; first kitchen 29.661 s, turn 52.327 s, 69 % less upload than 02 |
| [Left-wall image kitchen: the status line of the window](05-iklw-oa-rc-status-2026-10-27.md) | Measured | Two repetitions on 04's planner with proposal B: the create named 5.6 / 3.7 s before it runs (04: 0.18 s); the reasoning summary is a call's first output and does not fill the wait for it; first kitchen 28.456 s, turn 59.954 s with 10 / 7 calls by the agent's post-create choices |
| [One skill round on the Azure deployment](06-az-skill-2026-10-27.md) | Measured | Two repetitions each of the image kitchen and the walnut kitchen with proposal A, `gpt-6-astra` on Azure, local planner: every run creates at call 2 with the kitchen skill and its reference in one result, no reference fetch; first kitchen 29.655 s (image, the session's run: 36.4 s) and 30.290 s (text, 31.7 s); the reasoning of the reference round moved into the create call |
| [The plan state per turn on the Azure deployment](07-az-state-2026-10-27.md) | Measured | Two repetitions of the move test on the build of 06 and on the build with the plan state supplied per turn (proposal G without its selector), plus the walnut and the image kitchen against 06, `gpt-6-astra` on Azure, local planner: the move at call 1 (first change 4.5 / 3.5 s against 8.3 / 14.2 s), no model call reads the live sections, the creations as in 06 |
| [The library read before the first prompt on the Azure deployment](08-az-warm-2026-10-27.md) | Measured | Proposal F, `gpt-6-astra` on Azure, local planner, a runner whose wait calculates no article template: two invalid-key checks on the build of 07 and two on the new build, two repetitions each of the image kitchen and the walnut kitchen. Every page reads the library before the first prompt (729–754 ms); the first turn reads it in 6–8 ms and sends its first request after 0.03–0.05 s instead of 0.78–0.81 s; the creations keep the shape and kitchens of 06; accepted |
| [The Azure series: benchmark comparison](az-cmp-2026-10-27.md) | Measured | The series from 06 on against the test session of 2026-10-27 on the same deployment: the shape of a turn, the first read of a page, the timing, the decisions to keep A, the plan state per turn and the library read before the first prompt; 09 against the baselines: the two-level attribute section meets the criteria of the analysis and costs the sink of the image kitchen, not decided |
| [Left-wall image kitchen: timing comparison](iklw-oa-rc-cmp-2026-10-26.md) | Measured | Original 01, chaining 02, preloads 03, JPEG images with renders when due 04 and the status line 05; per-call bytes, timing/stage deltas, the status line and usage |
| [planning-assistant-prompt-caching.md](planning-assistant-prompt-caching.md) | Complete | A/B/C comparison selects compact library/rules; Azure boundary verifies cross-prompt reuse; final Astra minimum suite: 6 pass, 4 partial, 0 fail |
| [Shared-reference artifacts](planning-assistant-prompt-caching/README.md) | Evidence | Generated per-variant Markdown/JSON measurements and reproduction metadata |
| [kitchen-from-image-time.md](kitchen-from-image-time.md) | Measured | RML-18064 and RML-18164: where the time goes when the agent plans a kitchen from an image — gpt-6-astra baseline 92 s, 10.2 steps, 699k input tokens per run (2026-10-08); the second measurement on the runs since the five improvements (2026-10-13, `kitchen-from-image-time-2026-10-13/`); the third measurement, the six improvements of RML-18164 one after another on one build and the local planner (2026-10-14, `kitchen-from-image-time-rml-18164/<step>/`): the vocabulary section takes the search steps away, 104 s → 75 s per run |
