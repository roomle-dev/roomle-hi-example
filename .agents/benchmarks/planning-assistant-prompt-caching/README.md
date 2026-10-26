# Shared-reference measurement artifacts

[Interpretation and reproduction](../planning-assistant-prompt-caching.md) explains the protocol,
limitations and selection. Each generated Markdown report has its machine-readable `benchmark.json`
beside it; the JSON retains per-turn measurements, source manifests and runtime URLs.
The [reproduction manifest](reproduction.json) preserves original prompts, plan snapshot IDs,
source-image hashes, provider/SDK settings and the four short capability-probe observations.

| Report | Scope |
|---|---|
| [Baseline](baseline/benchmark.md) | Two paced repetitions, on-demand reference |
| [Library/rules](library-rules/benchmark.md) | Two paced repetitions, compact library and common rules in the prefix |
| [Operational skills](operational-skills/benchmark.md) | Two paced repetitions, adding all four operational skills and planning references |
| [Unpaced pilot](unpaced-pilot/benchmark.md) | Rate-limit investigation, including failed attempts; separate from the paired comparison |
| [Rejected boundary requests](boundary-rejected/benchmark.md) | Four requests rejected for a 77-character cache key; the implementation uses the 64-character digest after correction |
| [Validated boundary](boundary-validated/benchmark.md) | Four cases, six turns with the selected compact prefix and explicit Azure boundary; cross-prompt cache reuse verified |
| [Final minimum suite](final-minimum/benchmark.md) | Astra correctness run, 10 selected results and three preserved rate-limit attempts; separate from the Sol latency comparison |

[Final evaluations](final-minimum/evaluation.json) retain the prepared prompts, expectations,
initial plan IDs, selected snapshots, verdicts and measured totals. The shareable report and PDF
remain under `.temp/result/mcp-test-2026-10-26_11-51-16/` and `.temp/reports/`.
