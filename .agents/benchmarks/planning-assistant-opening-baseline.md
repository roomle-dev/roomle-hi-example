# Planning Assistant opening response: unchanged baseline

> **Type**: Benchmark and performance analysis
>
> **Date**: 2026-10-31
>
> **Status**: Measured
>
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
>
> **Source**: roomle-ui `ed4244eec`; roomle-hi-example `5987024`

**Affected repositories**

- **roomle-ui**: the candidate replaces one planner-owned system-prompt instruction.
- **roomle-hi-example**: chat documentation and this comparison; the tracked prompt suite is unchanged.

The first call fetches skills silently; first text appears in model call 2. Text-kitchen first text is **17.503–18.208 s**; image-kitchen first text is **12.311–13.557 s**. All four turns complete. Compare with the [candidate](planning-assistant-opening-candidate.md) and [comparison](planning-assistant-opening-comparison.md).

## Method and reproduction

The approved envelope is twelve case runs / sixteen user turns: four baseline turns and twelve candidate turns, all on `azure:gpt-6-astra` with `$AZURE_GPT_KEY`, the reference cache breakpoint enabled and provider-default reasoning. No provider warm-up, request pacing or retry was added. All sixteen turns and twelve snapshot saves succeeded. Total input across the envelope: **5,908,683 tokens**. Missing counters are not treated as zero.

The unchanged baseline is a clean detached worktree at `ed4244eec`, the required `feat/hi-planning-assistant` base. The candidate was captured as that base plus the single prompt replacement and is source-equivalent to `d13592675f0bd2e750fc6a429ad4927f4ca64cac`; its prompt source SHA-256 is `92e4bb6d33d244bf1732afd1c44c4bf2ffd8c17a30929e4a17fa38d80245a7d9`. Tests and documentation do not change runtime behaviour.

Both variants use the same pinned embedding-lib, `0.0.0-dev-4c2797a`, including `https://cdn.jsdelivr.net/npm/@roomle/embedding-lib@0.0.0-dev-4c2797a/hi.js`. The planner URLs are `http://localhost:5174/` (baseline) and `http://localhost:5175/` (candidate); the example uses port 3107. Runtime: Node 24.12.0, Playwright 1.55.0, Chromium 140.0.7339.16, headless with `--enable-gpu`. Fresh browsers do not establish cold provider caches; their initial provider cache state is unknown.

The text and image comparison fixtures are `full-kitchen-walnut-marble-corner` and `image-kitchen-left-wall` from `docs/test-prompts.json` at `5987024`, each repeated twice per variant. Both use starting snapshot `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`; the image is `docs/images/kitchen-1.png`. The suite suffix, “Decide any open details yourself instead of asking.”, is retained identically in these eight turns. Capture order: baseline text 1, candidate text 1, baseline image 1, candidate image 1, candidate text 2, baseline text 2, candidate image 2, baseline image 2.

The existing prompt runner is copied to a local timestamp collector with checked replacements. It retains normal tools, snapshots and usage collection, and timestamps text parts, model fetches and forwarded tools using `performance.timeOrigin + performance.now()`. Both variants carry the same hooks; stream cloning and logging add measurement overhead. Library readiness reads warm article templates before the prompt. No permanent telemetry or production runner changes are made.

All seconds below start at the host callback. **First text is emitted text, not a painted chat frame.** The runner invokes the callback directly and bypasses the chat store. First sentence ends at the first sentence-ending punctuation in streamed text; first tool excludes the host's bootstrap context reads. First kitchen is the first successful create completion, a conservative loaded-plan milestone. Model duration includes provider/network/stream processing and does not isolate hidden reasoning or queue time.

Local evidence: `.temp/result/planning-assistant-opening-2026-10-31/` (manifest, captures, metrics and per-run `run.json`, `timeline.json`, tool logs, plan context, order data and images); collector and preflight under `.temp/analysis-immediate-acknowledgement/`. Raw evidence stays ignored. Repeat with the same selected cases, snapshots, suffix, model/options, pinned embedding version and isolated source revisions, using `.agents/scripts/run-hi-mcp-prompt.js` and the timestamp boundaries above.

## Milestones

All values are seconds from host turn start; columns are elapsed durations/times, not wall-clock timestamps.

| Run / turn | First text | Sentence complete | First tool | First kitchen | Turn complete |
|---|---:|---:|---:|---:|---:|
| text-1 | 18.208 | 18.692 | 3.972 | 28.660 | 36.739 |
| image-1 | 13.557 | 14.691 | 3.449 | 23.553 | 46.218 |
| text-2 | 17.503 | 17.819 | 2.890 | 25.899 | 31.425 |
| image-2 | 12.311 | 13.294 | 5.162 | 21.819 | 43.555 |

## Work and usage

Model seconds sum the SDK model-call durations; tool seconds are the union of forwarded tool intervals. They can overlap and are not added together as a wall-time decomposition.

| Run / turn | Model calls | Model s | Tool s | Input tokens | Output tokens | Cache read / write |
|---|---:|---:|---:|---:|---:|---:|
| text-1 | 3 | 33.744 | 2.955 | 223,121 | 1,156 | 139,241 / 83,871 |
| image-1 | 7 | 43.049 | 3.105 | 577,279 | 1,348 | 552,644 / 24,614 |
| text-2 | 3 | 28.996 | 2.374 | 221,868 | 987 | 212,312 / 9,547 |
| image-2 | 7 | 40.323 | 3.184 | 578,226 | 1,272 | 565,907 / 12,298 |

All recorded turn-level cache-read/write coverage is complete in this envelope. Byte counts below describe each individual serialized request body, including the input and tools where present; caching does not avoid upload.

## Opening content and saved plans

| Run / turn | First text call | Opening / direct clarification | Saved snapshot |
|---|---:|---|---|
| text-1 | 2 | I’ll create an L-shaped kitchen with the sink and preparation area on the back wall, and the oven, hob, hood and fridge on the right wall. | `ps_tfcolpqmkzo7ioxm5mytppto83enp3m` |
| image-1 | 2 | I’ll recreate the straight run on the left wall: a tall fridge-freezer, drawer-and-door storage, an oven and hob, then storage and a sink, with three wall cupboards around a chimney hood. | `ps_tfcck5g97dd0zecn5dpw1t4cf1f2uzk` |
| text-2 | 2 | I’ll build an L-shaped kitchen in the back-right corner, with walnut-effect fronts and a dark-marble-effect worktop. | `ps_tfctk5w0a9eyh9m6l8sy9zyuopnwwi0` |
| image-2 | 2 | I’ll recreate the straight run on the left wall: a tall fridge-freezer, drawer-and-door storage, oven and hob, then storage and sink, with three wall cabinets and a chimney hood. | `ps_tfcma75j08yoqy487x3xqkdlrvxujvx` |

## Evaluation

Both text plans contain one corner group with sink, hob, oven, hood, fridge, drawer storage and wall cabinets, using walnut decor and dark-marble decor. Both image plans are straight runs on the left wall with the image’s main appliances and storage. Saved context, order data, top views and object views were inspected. The image plans have library/finish substitutions and lack the backsplash; these are disclosed in their answers. These fidelity limitations are not a first-response failure, and the benchmark does not certify installation readiness.

## Individual model requests

Each duration is the SDK model-call delta; TTFO is first generated provider output, which can be a tool event rather than visible text. Request bytes are per HTTP attempt, not cumulative.

| Run / turn | Call | Model Δ s | TTFO s | Input tokens | Output tokens | Request bytes |
|---|---:|---:|---:|---:|---:|---:|
| text-1 | 1 | 3.948 | 3.421 | 66,173 | 22 | 300,228 |
| text-1 | 2 | 21.729 | 14.231 | 73,074 | 878 | 81,478 |
| text-1 | 3 | 8.068 | 4.772 | 83,874 | 256 | 83,412 |
| image-1 | 1 | 3.421 | 3.289 | 68,482 | 55 | 564,992 |
| image-1 | 2 | 18.323 | 10.105 | 76,930 | 783 | 88,663 |
| image-1 | 3 | 2.963 | 2.186 | 85,054 | 35 | 73,258 |
| image-1 | 4 | 2.748 | 1.862 | 85,670 | 68 | 48,168 |
| image-1 | 5 | 3.353 | 2.814 | 85,875 | 75 | 46,248 |
| image-1 | 6 | 7.864 | 4.050 | 86,314 | 216 | 46,674 |
| image-1 | 7 | 4.377 | 2.104 | 88,954 | 116 | 238,853 |
| text-2 | 1 | 2.851 | 2.528 | 66,173 | 22 | 300,228 |
| text-2 | 2 | 20.631 | 14.609 | 73,074 | 812 | 81,478 |
| text-2 | 3 | 5.515 | 2.130 | 82,621 | 153 | 78,301 |
| image-2 | 1 | 5.133 | 4.907 | 68,482 | 55 | 564,992 |
| image-2 | 2 | 14.754 | 7.147 | 76,930 | 729 | 88,663 |
| image-2 | 3 | 3.170 | 2.765 | 84,650 | 34 | 72,059 |
| image-2 | 4 | 3.178 | 2.280 | 86,022 | 82 | 51,450 |
| image-2 | 5 | 3.057 | 2.284 | 86,243 | 96 | 46,248 |
| image-2 | 6 | 6.614 | 4.566 | 86,671 | 133 | 46,596 |
| image-2 | 7 | 4.418 | 1.895 | 89,228 | 143 | 238,073 |

## Limits

Two repetitions per core case do not establish tail latency, a general SLA or statistical significance. Source/fixture, warm-library, provider-cache and prompt-suffix conditions are explicit above. The unchanged call counts in the paired cases establish that the opening did not consume a separate model step; they do not prove unchanged cost or identical plans. Total planning-time differences stay within the observed spread. No live model-proxy or cross-provider latency comparison is performed. All chat-error exclusions and retries: **none**.
