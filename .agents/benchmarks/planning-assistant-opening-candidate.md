# Planning Assistant opening response: short action sentence

> **Type**: Benchmark and performance analysis
>
> **Date**: 2026-10-31
>
> **Status**: Measured
>
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
>
> **Source**: roomle-ui `d13592675f0bd2e750fc6a429ad4927f4ca64cac`; roomle-hi-example `5987024`

**Affected repositories**

- **roomle-ui**: the candidate replaces one planner-owned system-prompt instruction.
- **roomle-hi-example**: chat documentation and this comparison; the tracked prompt suite is unchanged.

All twelve candidate turns produce a response tied to the current request. In every turn using tools, the first text precedes the first model-requested tool; one clarification is a direct answer. Core first-text means are **3.818 s** for text and **4.788 s** for images. A German edit still waits **11.048 s**, so this is not an immediate-response guarantee. Compare with the [baseline](planning-assistant-opening-baseline.md) and [comparison](planning-assistant-opening-comparison.md).

## Method and reproduction

The approved envelope is twelve case runs / sixteen user turns: four baseline turns and twelve candidate turns, all on `azure:gpt-6-astra` with `$AZURE_GPT_KEY`, the reference cache breakpoint enabled and provider-default reasoning. No provider warm-up, request pacing or retry was added. All sixteen turns and twelve snapshot saves succeeded. Total input across the envelope: **5,908,683 tokens**. Missing counters are not treated as zero.

The unchanged baseline is a clean detached worktree at `ed4244eec`, the required `feat/hi-planning-assistant` base. The candidate was captured as that base plus the single prompt replacement and is source-equivalent to `d13592675f0bd2e750fc6a429ad4927f4ca64cac`; its prompt source SHA-256 is `92e4bb6d33d244bf1732afd1c44c4bf2ffd8c17a30929e4a17fa38d80245a7d9`. Tests and documentation do not change runtime behaviour.

Both variants use the same pinned embedding-lib, `0.0.0-dev-4c2797a`, including `https://cdn.jsdelivr.net/npm/@roomle/embedding-lib@0.0.0-dev-4c2797a/hi.js`. The planner URLs are `http://localhost:5174/` (baseline) and `http://localhost:5175/` (candidate); the example uses port 3107. Runtime: Node 24.12.0, Playwright 1.55.0, Chromium 140.0.7339.16, headless with `--enable-gpu`. Fresh browsers do not establish cold provider caches; their initial provider cache state is unknown.

The text and image comparison fixtures are `full-kitchen-walnut-marble-corner` and `image-kitchen-left-wall` from `docs/test-prompts.json` at `5987024`, each repeated twice per variant. Both use starting snapshot `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`; the image is `docs/images/kitchen-1.png`. The suite suffix, “Decide any open details yourself instead of asking.”, is retained identically in these eight turns. Capture order: baseline text 1, candidate text 1, baseline image 1, candidate image 1, candidate text 2, baseline text 2, candidate image 2, baseline image 2.

The existing prompt runner is copied to a local timestamp collector with checked replacements. It retains normal tools, snapshots and usage collection, and timestamps text parts, model fetches and forwarded tools using `performance.timeOrigin + performance.now()`. Both variants carry the same hooks; stream cloning and logging add measurement overhead. Library readiness reads warm article templates before the prompt. No permanent telemetry or production runner changes are made.

All seconds below start at the host callback. **First text is emitted text, not a painted chat frame.** The runner invokes the callback directly and bypasses the chat store. First sentence ends at the first sentence-ending punctuation in streamed text; first tool excludes the host's bootstrap context reads. First kitchen is the first successful create completion, a conservative loaded-plan milestone. Model duration includes provider/network/stream processing and does not isolate hidden reasoning or queue time.

Local evidence: `.temp/result/planning-assistant-opening-2026-10-31/` (manifest, captures, metrics and per-run `run.json`, `timeline.json`, tool logs, plan context, order data and images); collector and preflight under `.temp/analysis-immediate-acknowledgement/`. Raw evidence stays ignored. Repeat with the same selected cases, snapshots, suffix, model/options, pinned embedding version and isolated source revisions, using `.agents/scripts/run-hi-mcp-prompt.js` and the timestamp boundaries above.

The additional functional cases are `image-only-no-text` on `ps_sje41pva5egn6qp5xti55q6c7fcfin5` with `docs/images/kitchen-4.png`, twice, and a three-turn German conversation on `ps_s3p5hmscmmsnshopj2tybjwmt7ijy5o`, twice. Its exact prompts are “Mach alle Schrankfronten weiß.”, “Was kostet es jetzt?” and “Ändere eine der Innenausstattungen.” No suffix is attached to the clarification scenario. These cases assess behaviour and are not paired latency comparisons.

## Milestones

All values are seconds from host turn start; columns are elapsed durations/times, not wall-clock timestamps.

| Run / turn | First text | Sentence complete | First tool | First kitchen | Turn complete |
|---|---:|---:|---:|---:|---:|
| text-1 | 3.811 | 4.503 | 4.719 | 28.260 | 38.351 |
| image-1 | 3.647 | 3.882 | 4.760 | 20.497 | 44.760 |
| text-2 | 3.825 | 4.177 | 4.668 | 22.153 | 29.218 |
| image-2 | 5.929 | 6.428 | 7.144 | 24.008 | 43.075 |
| imageOnly-1 | 3.804 | 4.725 | 5.542 | 36.065 | 84.166 |
| followup-1/t1 | 11.048 | 11.218 | 12.050 | — | 15.748 |
| followup-1/t2 | 2.069 | 2.197 | 2.556 | — | 7.007 |
| followup-1/t3 | 2.691 | 2.917 | — | — | 3.678 |
| imageOnly-2 | 2.971 | 3.243 | 4.445 | 41.230 | 82.630 |
| followup-2/t1 | 2.557 | 2.628 | 3.413 | — | 6.206 |
| followup-2/t2 | 3.041 | 3.123 | 3.478 | — | 7.939 |
| followup-2/t3 | 2.919 | 3.410 | 3.888 | — | 9.205 |

## Work and usage

Model seconds sum the SDK model-call durations; tool seconds are the union of forwarded tool intervals. They can overlap and are not added together as a wall-time decomposition.

| Run / turn | Model calls | Model s | Tool s | Input tokens | Output tokens | Cache read / write |
|---|---:|---:|---:|---:|---:|---:|
| text-1 | 3 | 35.262 | 3.045 | 224,210 | 1,175 | 139,351 / 84,850 |
| image-1 | 7 | 40.967 | 3.738 | 577,516 | 1,233 | 553,056 / 24,439 |
| text-2 | 3 | 26.258 | 2.917 | 223,251 | 1,083 | 205,556 / 17,686 |
| image-2 | 7 | 40.092 | 2.927 | 574,560 | 1,197 | 554,769 / 19,770 |
| imageOnly-1 | 10 | 77.317 | 6.794 | 889,608 | 2,652 | 848,422 / 41,156 |
| followup-1/t1 | 2 | 15.209 | 0.490 | 137,086 | 99 | 132,809 / 4,271 |
| followup-1/t2 | 2 | 6.521 | 0.458 | 167,142 | 106 | 133,121 / 34,015 |
| followup-1/t3 | 1 | 3.641 | 0.000 | 98,482 | 37 | 64,373 / 34,106 |
| imageOnly-2 | 10 | 76.102 | 6.468 | 909,666 | 2,692 | 875,305 / 34,331 |
| followup-2/t1 | 2 | 5.675 | 0.484 | 137,086 | 98 | 137,080 / 0 |
| followup-2/t2 | 2 | 7.356 | 0.553 | 167,141 | 106 | 133,120 / 34,015 |
| followup-2/t3 | 2 | 9.030 | 0.142 | 202,441 | 169 | 162,853 / 39,582 |

All recorded turn-level cache-read/write coverage is complete in this envelope. Byte counts below describe each individual serialized request body, including the input and tools where present; caching does not avoid upload.

## Opening content and saved plans

| Run / turn | First text call | Opening / direct clarification | Saved snapshot |
|---|---:|---|---|
| text-1 | 1 | I’ll create an L-shaped kitchen in the back-right corner with walnut fronts, a dark-marble worktop, and all the requested appliances and storage. | `ps_tfc86lqkhfyewk9kknzabc56642dacm` |
| image-1 | 1 | I’ll recreate the image’s cabinet layout and green-and-wood finish on the left-hand wall, choosing the closest available fittings and finishes. | `ps_tfc1eyww2dg3ymhr5qvc113aayokeku` |
| text-2 | 1 | I’ll create an L-shaped kitchen in the back-right corner with walnut fronts, a dark-marble worktop, and the requested appliances and storage. | `ps_tfcaaxgjmqcehhabhhvh1poa9t8epw5` |
| image-2 | 1 | I’ll recreate the image’s green-and-wood kitchen along the left-hand wall, choosing the closest available cabinets and finishes. | `ps_tfc148ne8fl5k1yi2enz3nh69niwvfgr` |
| imageOnly-1 | 1 | I’ll match the photo’s narrow galley layout, light fronts and dark wood worktops as closely as the room and catalog allow. | `ps_tfcn9iwyok88ibsnkvzztuydpyyyyqj` |
| followup-1/t1 | 1 | Ich stelle alle Schrankfronten auf Schneeweiß um. | `ps_tfc9lpo9l9lxhfj0zwlhfda0cee5lwt` |
| followup-1/t2 | 1 | Ich berechne den aktuellen Preis der Planung. | `ps_tfc9lpo9l9lxhfj0zwlhfda0cee5lwt` |
| followup-1/t3 | 1 | Ich kann eine Innenausstattung ändern. | `ps_tfc9lpo9l9lxhfj0zwlhfda0cee5lwt` |
| imageOnly-2 | 1 | I’ll match the photographed galley kitchen as closely as the catalog and your room allow. | `ps_tfc10l8izyo8m95xpn2rgexq3cfjqsi3` |
| followup-2/t1 | 1 | Ich stelle alle Schrankfronten auf Schneeweiß um. | `ps_tfd15ey2xlfpxwhumiuxtqsg8c98x97q` |
| followup-2/t2 | 1 | Ich ermittle den aktuellen Preis der Planung. | `ps_tfd15ey2xlfpxwhumiuxtqsg8c98x97q` |
| followup-2/t3 | 1 | Ich prüfe die vorhandenen Innenausstattungen, damit wir die gewünschte Änderung festlegen können. | `ps_tfd15ey2xlfpxwhumiuxtqsg8c98x97q` |

## Evaluation

The four core plans retain the requested corner/text or left-wall/image layout and main appliances/storage. Both image-only plans form two facing runs, use warm-white fronts and walnut worktops, and preserve the door passage; their tops stay below the rear window. The library rejects backsplash/handle options in image cases; the final answers report missing/substituted content. Exact photo fidelity is therefore partial. These limitations are recorded rather than counted as perfect planning results.

Both German conversations change all three cabinet fronts to value `192` (Schneeweiß), retain the three cabinets and placement, call `get-price` and answer **€1,438.52** from the current plan, then clarify which interior fitting/cabinet should change. The second clarification first reads `get-interior-design-options`; neither clarification makes an unspecified edit. All openings use German and successful context carries into later turns.

The first German edit has 34.7 ms of reference acquisition but about 11.009 s to first provider output; its repeat starts text after 2.557 s. The capture cannot separate provider queue, prefill and other waiting. This outlier limits the claim to an observed improvement in the paired kitchen cases.

## Individual model requests

Each duration is the SDK model-call delta; TTFO is first generated provider output, which can be a tool event rather than visible text. Request bytes are per HTTP attempt, not cumulative.

| Run / turn | Call | Model Δ s | TTFO s | Input tokens | Output tokens | Request bytes |
|---|---:|---:|---:|---:|---:|---:|
| text-1 | 1 | 4.691 | 3.784 | 66,209 | 60 | 300,439 |
| text-1 | 2 | 20.492 | 14.233 | 73,148 | 874 | 81,478 |
| text-1 | 3 | 10.079 | 7.002 | 84,853 | 241 | 86,399 |
| image-1 | 1 | 4.733 | 3.622 | 68,518 | 90 | 565,203 |
| image-1 | 2 | 13.955 | 8.152 | 77,001 | 651 | 88,663 |
| image-1 | 3 | 3.727 | 3.550 | 84,909 | 98 | 72,989 |
| image-1 | 4 | 4.786 | 3.967 | 85,729 | 97 | 48,701 |
| image-1 | 5 | 4.833 | 4.196 | 86,188 | 85 | 46,678 |
| image-1 | 6 | 2.760 | 1.833 | 86,356 | 35 | 46,005 |
| image-1 | 7 | 6.173 | 2.235 | 88,815 | 177 | 229,189 |
| text-2 | 1 | 4.643 | 3.802 | 66,209 | 59 | 300,439 |
| text-2 | 2 | 14.565 | 9.274 | 73,147 | 772 | 81,478 |
| text-2 | 3 | 7.050 | 3.338 | 83,895 | 252 | 83,053 |
| image-2 | 1 | 7.119 | 5.904 | 68,518 | 87 | 565,203 |
| image-2 | 2 | 15.225 | 9.595 | 76,998 | 694 | 88,663 |
| image-2 | 3 | 2.799 | 2.242 | 84,529 | 35 | 71,526 |
| image-2 | 4 | 2.570 | 1.959 | 85,145 | 53 | 48,168 |
| image-2 | 5 | 2.526 | 1.796 | 85,336 | 51 | 46,248 |
| image-2 | 6 | 4.751 | 3.053 | 85,746 | 118 | 46,678 |
| image-2 | 7 | 5.104 | 2.015 | 88,288 | 159 | 228,841 |
| imageOnly-1 | 1 | 5.516 | 3.778 | 68,208 | 89 | 548,724 |
| imageOnly-1 | 2 | 12.023 | 10.661 | 76,690 | 323 | 88,663 |
| imageOnly-1 | 3 | 16.332 | 7.505 | 79,455 | 913 | 55,621 |
| imageOnly-1 | 4 | 7.744 | 7.487 | 89,143 | 349 | 77,383 |
| imageOnly-1 | 5 | 2.770 | 2.366 | 90,217 | 51 | 47,799 |
| imageOnly-1 | 6 | 7.058 | 6.946 | 91,617 | 268 | 51,709 |
| imageOnly-1 | 7 | 10.514 | 10.354 | 92,475 | 299 | 47,358 |
| imageOnly-1 | 8 | 4.178 | 3.837 | 93,296 | 57 | 47,206 |
| imageOnly-1 | 9 | 4.565 | 2.590 | 102,975 | 95 | 80,434 |
| imageOnly-1 | 10 | 6.618 | 2.249 | 105,532 | 208 | 179,929 |
| followup-1/t1 | 1 | 12.010 | 11.009 | 68,439 | 72 | 308,179 |
| followup-1/t1 | 2 | 3.199 | 2.812 | 68,647 | 27 | 46,110 |
| followup-1/t2 | 1 | 2.536 | 2.049 | 68,751 | 31 | 309,327 |
| followup-1/t2 | 2 | 3.985 | 2.778 | 98,391 | 75 | 175,908 |
| followup-1/t3 | 1 | 3.641 | 2.660 | 98,482 | 37 | 439,895 |
| imageOnly-2 | 1 | 4.414 | 2.941 | 68,208 | 80 | 548,724 |
| imageOnly-2 | 2 | 19.075 | 18.274 | 76,681 | 557 | 88,663 |
| imageOnly-2 | 3 | 14.641 | 4.557 | 78,364 | 853 | 50,671 |
| imageOnly-2 | 4 | 4.757 | 4.589 | 89,953 | 137 | 86,208 |
| imageOnly-2 | 5 | 4.573 | 4.425 | 97,383 | 190 | 73,925 |
| imageOnly-2 | 6 | 4.978 | 4.822 | 98,129 | 230 | 47,258 |
| imageOnly-2 | 7 | 4.763 | 4.572 | 98,915 | 184 | 47,258 |
| imageOnly-2 | 8 | 6.211 | 5.660 | 99,536 | 141 | 46,761 |
| imageOnly-2 | 9 | 5.268 | 3.382 | 99,958 | 119 | 46,782 |
| imageOnly-2 | 10 | 7.424 | 3.524 | 102,539 | 201 | 190,273 |
| followup-2/t1 | 1 | 3.373 | 2.517 | 68,439 | 72 | 308,179 |
| followup-2/t1 | 2 | 2.302 | 1.848 | 68,647 | 26 | 46,110 |
| followup-2/t2 | 1 | 3.456 | 3.019 | 68,750 | 30 | 309,327 |
| followup-2/t2 | 2 | 3.900 | 2.441 | 98,391 | 76 | 175,908 |
| followup-2/t3 | 1 | 3.863 | 2.894 | 98,483 | 70 | 439,895 |
| followup-2/t3 | 2 | 5.167 | 2.981 | 103,958 | 99 | 62,219 |

## Limits

Two repetitions per core case do not establish tail latency, a general SLA or statistical significance. Source/fixture, warm-library, provider-cache and prompt-suffix conditions are explicit above. The unchanged call counts in the paired cases establish that the opening did not consume a separate model step; they do not prove unchanged cost or identical plans. Total planning-time differences stay within the observed spread. No live model-proxy or cross-provider latency comparison is performed. All chat-error exclusions and retries: **none**.
