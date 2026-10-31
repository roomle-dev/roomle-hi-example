# Planning Assistant opening response: comparison and validation

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

A single planner-owned prompt replacement moves the request-specific opening into the first model response. It uses the existing stream and agent loop. In this paired sample, first text arrives substantially earlier; an 11-second functional-case outlier remains.

The [baseline report](planning-assistant-opening-baseline.md) and [candidate report](planning-assistant-opening-candidate.md) retain their own measurements, request sizes, source revisions, snapshots and evaluations.

## Paired results

Each value is the mean of two valid runs, in seconds from host callback start.

| Case / metric | Baseline | Candidate | Candidate − baseline |
|---|---:|---:|---:|
| text / first text | 17.855 | 3.818 | -14.037 |
| text / first kitchen | 27.279 | 25.206 | -2.073 |
| text / completed turn | 34.082 | 33.785 | -0.298 |
| image / first text | 12.934 | 4.788 | -8.146 |
| image / first kitchen | 22.686 | 22.253 | -0.433 |
| image / completed turn | 44.887 | 43.918 | -0.969 |

In all four candidate comparison runs, the opening precedes the first tool and belongs to model call 1; baseline text belongs to call 2. Text turns retain **3 model calls** and image turns **7**, with no acknowledgement-only model step. The first-kitchen and full-turn differences are small relative to the run spread and do not establish faster planning.

## Functional validation and limitations

The complete envelope contains **12 case runs / 16 user turns**, **0 chat errors**, **0 retries**, and **5,908,683 input tokens**. Additional candidate first-text times are:

| Scenario | Run 1 s | Run 2 s | Outcome |
|---|---:|---:|---|
| Image only | 3.804 | 2.971 | Two facing runs; image-specific opening; finish/backsplash fidelity partial and disclosed |
| German front edit | 11.048 | 2.557 | All three fronts become Schneeweiß; layout retained |
| German price follow-up | 2.069 | 3.041 | get-price; €1,438.52; correct conversation context |
| Unspecified interior change | 2.691 | 2.919 | Clarifies cabinet and change; no guessed edit |

The 11.048-second edit wait is retained, not excluded. Its reference acquisition is only 34.7 ms and first provider output waits 11.009 s; the available boundaries do not identify queueing versus prefill. A short opening instruction is therefore **not an immediate-response guarantee**. No separate lightweight generator is introduced.

## Implementation and offline verification

The only productive change is `packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts` in roomle-ui, commit `d13592675f0bd2e750fc6a429ad4927f4ca64cac`, directly based on `ed4244eec` of `feat/hi-planning-assistant`. The captured prompt source digest matches that commit: `92e4bb6d33d244bf1732afd1c44c4bf2ffd8c17a30929e4a17fa38d80245a7d9`. The same pinned embedding-lib is used for both variants; no embedding build, new dependency, tool contract, planner calculation, proxy route or provider reasoning setting changes. A planner deployment and restarted assistant session are needed for consumers to receive the instruction.

- **8 SDK prompt tests** pass, including the opening/continuation instruction and retained planning rules.
- **76 targeted unit/integration tests** pass, including gated early text, successful and failed history, ordinary compatible-provider lifecycle, real pinned Azure/OpenAI Responses tool execution, commentary/final phase metadata and stored item references, and chat rendering.
- Real desktop and mobile chat forms pass with delayed intercepted provider fixtures: opening while busy, subsequent tool/final result, later prompt and error replacement. Eight provider requests are intercepted; **zero live model requests** are made for these UI checks. Screenshots were inspected. These fixtures verify rendering, not real-provider latency.
- Type checks, code linting and flag checks pass. Full lint does **not** pass: UI TypeDoc exits 3 on the same 22 warnings as a clean unchanged base worktree. SDK TypeDoc also exits 3 on the same two errors on both sources (`bun-webgpu/src/structs_ffi.ts:703` and `common-core/__tests__/image-renderer.ts:157`). The failures are reproduced on the required base under the same installed dependencies; no warning suppression or unrelated fixes are applied.
- Formatting and Markdown link checks cover the changed documents and code. The code-lint warning about unused `isCeilingShown` belongs to the unchanged planner test.

## Method and evidence

Both independent reports contain the fixture/suffix, runtime and measurement contract. Local evidence is `.temp/result/planning-assistant-opening-2026-10-31/`; preflight, UI fixtures/screenshots, lint and test logs are in `.temp/analysis-immediate-acknowledgement/`. The starting snapshots and pinned modules are checked without model calls. The callback-based prompt runner does not drive a visible chat turn, so its first-text timestamp is not presented as a painted frame. Raw evidence stays local; the reports retain all timing values, request bytes and snapshot IDs needed to assess the result. No provider/cross-model generalisation, p95, hidden-reasoning duration, currency saving or production-deployment claim is made.
