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

Filename abbreviations: `iklw` = image kitchen left wall; `oa` = OpenAI Astra;
`orig` = original; `base` = baseline; `rc` = response chaining; `cmp` = comparison.

The series has two numbered run reports: **01 original** and **02 response chaining**. Each contains two repetitions. The comparison is unnumbered and is extended when future runs are added.

## Current Documents

| Document | Status | Description |
|---|---|---|
| [Original left-wall image kitchen timing](01-iklw-oa-orig-2026-10-26.md) | Measured | Original baseline, preserved unchanged |
| [Left-wall image kitchen: response-chaining run](02-iklw-oa-rc-2026-10-26.md) | Measured | Two chained repetitions; independent timing and per-call byte report |
| [Left-wall image kitchen: timing comparison](iklw-oa-rc-cmp-2026-10-26.md) | Measured | Unnumbered comparison of original 01, response chaining 02 and future runs; per-call bytes and duration deltas |
| [planning-assistant-prompt-caching.md](planning-assistant-prompt-caching.md) | Complete | A/B/C comparison selects compact library/rules; Azure boundary verifies cross-prompt reuse; final Astra minimum suite: 6 pass, 4 partial, 0 fail |
| [Shared-reference artifacts](planning-assistant-prompt-caching/README.md) | Evidence | Generated per-variant Markdown/JSON measurements and reproduction metadata |
| [kitchen-from-image-time.md](kitchen-from-image-time.md) | Measured | RML-18064 and RML-18164: where the time goes when the agent plans a kitchen from an image — gpt-6-astra baseline 92 s, 10.2 steps, 699k input tokens per run (2026-10-08); the second measurement on the runs since the five improvements (2026-10-13, `kitchen-from-image-time-2026-10-13/`); the third measurement, the six improvements of RML-18164 one after another on one build and the local planner (2026-10-14, `kitchen-from-image-time-rml-18164/<step>/`): the vocabulary section takes the search steps away, 104 s → 75 s per run |
