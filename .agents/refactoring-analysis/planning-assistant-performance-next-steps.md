# Planning Assistant performance: the remaining work after the October 28 baselines

| Field | Value |
|---|---|
| Type / domain | Refactoring analysis / HI Planning Assistant performance |
| Status | Open — proposals, no productive implementation |
| Date / author | 2026-10-28 / Codex |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Base | roomle-hi-example `ad36f46259777c4a69dfe56ae42e0145b6013545`; roomle-ui `e6804d598a44ceb2eef5f1b23587339a73f5d921` |
| Evidence | The two October 28 baselines, their four retained captures, all 36 ticket comments and its attachment; current code and decisions |
| Scope | Analysis only. No new model requests, deployment changes or embedding-lib build |

Affected repositories:

- **roomle-ui:** proposed changes to the agent's served instructions, attribute/catalog projection and, if experiments justify them, assistant diagnostics and skill selection; corresponding tests and behaviour documentation.
- **roomle-hi-example:** this analysis and indexes; future controlled benchmark captures, evaluation and adoption of an approved embedding-lib version where necessary.

## 1. Conclusion and recommendation

The remaining problem is principally **model time and the number of model decisions**, not slow information tools. The text kitchen already meets the upper final-answer target but misses the first-kitchen target by about 14 seconds. The image kitchen is near the upper targets, with most of its remaining time spent after creation.

Start with two small experiments: **omit narration before tool calls**, and **send independent finishing edits followed by the required render in one model response**. The retained timelines expose work these can remove without a new planner API. Next, evaluate a narrowly defined extension of D122's structural attribute selection so related appearance choices can be made together in the create. Fix the existing description-shortening defect alongside its own verification; it is a context reduction, not a demonstrated latency solution.

These changes cannot honestly be promised to deliver a 10-second text kitchen. Even an instantaneous skill selector leaves about **21.4 seconds** at the observed create-call speed. Reaching 10 seconds requires reducing the dominant create model call, with a separately controlled model/configuration/deployment investigation if prompt and context experiments are insufficient. The existing skill-selector proposal can help the image target, but its net benefit is smaller than its removed round.

No proposed optimization changes `glue-logic.ts`, the library's calculation process, or RoomleCore. Library-specific limitations remain in library descriptions and the existing library backlog. The planning skills delivered by HOMAG remain intact.

## 2. Evidence, provenance and limits

The primary reports are [the walnut text baseline](../benchmarks/baseline-fkwm-az-2026-10-28.md) and [the left-wall image baseline](../benchmarks/baseline-iklw-az-2026-10-28.md). Each contains two successful turns. The image turns also contain a failed backsplash tool operation; that is a fidelity limitation, not a provider/chat failure and not a reason to exclude the turn.

Both reports use example `f5b8368`, planner `5fd409e84`, published embedding-lib `0.0.0-dev-1b4351d`, Azure Responses deployment `gpt-6-astra`, provider-default reasoning, the local planner on port 5173, no request pacing and no suite prompt suffix. The inspected roomle-ui checkout differs from the measured planner by one documentation commit only. The example still pins the measured embedding-lib. A future comparison must record the actual loaded assistant and planner separately; a newer local source checkout does not change a pinned CDN module.

Raw evidence was inspected under these local, ignored paths:

- `.temp/result/baseline-fkwm-az-2026-10-28/fkwm-rep-{1,2}/`
- `.temp/result/baseline-iklw-az-2026-10-28/iklw-rep-{1,2}/`
- `.temp/rml-18303-analysis/` — ticket export, downloaded attachment and offline calculations for this investigation.

The ticket's `planning-improvements.md` attachment was downloaded. It matches [the repository copy](../../docs/external/planning-improvements.md) after CRLF normalization. Its router and lazy skill loading are proposals to assess, not evidence of deployed capabilities or measured savings. Ticket comments describe several intermediate designs that later decisions supersede; current code and the October 28 reports determine the status below.

All baseline seconds below use **assistant callback/turn start**, as the reports do. The product targets start at user submission. Image preparation and callback delivery can precede that clock; readiness, browser startup and snapshot saving are separate. Capture submission-to-callback explicitly before claiming a product target. Create completion is a conservative loaded-plan milestone, not a measured painted frame. “Image interpreted” has no measured boundary; neither the first text nor a reasoning-token count establishes that milestone.

Two repetitions establish the observed paths and their variation, not a p95 or a guaranteed service level. Model duration includes network, provider scheduling, input processing, reasoning and generation. A long first-output wait is **not** an isolated reasoning or prefill measurement. No estimate below sums cached tokens with input tokens or reasoning tokens with output tokens.

## 3. What is implemented, and what remains

| Ticket idea / later proposal | Current evidence | Assessment |
|---|---|---|
| Prompt caching | Shared rules/library prefix, explicit Azure boundary and stable key; first calls read 68,235/68,238 text tokens and 70,544/70,547 image tokens from cache | Implemented. The baseline is already heavily cached; another cache layer is not the missing 14 seconds. |
| Repeated context uploads | Responses chaining sends new tool outputs after call 1; every captured request reports zero repeated serialized input-item bytes | Implemented. Historical context still contributes to model input and usage. |
| Plan context on each prompt | Fresh rooms, groups, obstacles and installation elements supplied per turn, excluded from successful history | Implemented, ADR 0016 / D121. Earlier rejection of the combined preload experiment does not describe this part of current code. |
| Automatic image skill | The first model call requests the relevant skills; kitchen skill and required reference arrive together | First-image preload remains rejected by ADR 0015. The bundled reference, proposal A / D120, is implemented. |
| Skill selector | Existing [selector backlog proposal](../backlog/planning-assistant-skill-selector.md); no selector in `PlanningAssistantConfig` or the assistant loop | Open, not a new proposal here. Its live-state prerequisite is implemented. |
| Input image scaling | Chat and runner cap the long side at 1568 px and encode JPEG | Implemented. Further reduction needs image-fidelity evidence. |
| Plan image scaling / JPEG | `get-plan-images` returns JPEGs; about 193 KB and 0.45 s in these image runs | Implemented, proposal D / D117. The model round deciding to render costs much more than rendering. |
| Avoid unnecessary post-create reads/renders | Text runs answer directly after creation; image runs render for comparison | Implemented, proposal E / D118. Keep image verification; improve its scheduling. |
| Progress while writing tool arguments | Activity is emitted at `tool-input-start`, also at `tool-call` | Implemented, proposal B. It improves feedback, not completion time; reasoning summaries are not a remaining latency optimization. |
| Precalculate docking templates | Assistant reads the library before the first prompt; templates are retained by the existing template cache | Implemented form of F. Keeping another compacted-result cache was rejected. |
| Attribute indexing | D122 supplies all attribute headers, selected value lists and `valueCount`; `find-attributes` supports multiple IDs | Implemented as an information design, not a search-performance index. It deliberately moves some choices after creation. |
| Tool memoization / selective RAG | Read work is measured in milliseconds; default reference is stable and shared | No evidence supporting these as the next latency refactor. A stable smaller projection is a different, testable idea (§7). |
| Worked create examples | Authoring rules already include relation-based payload examples | Do not count adding an example as unimplemented work. |

Source locations and tests are listed in §9. D122 is implemented in the baseline even though the latest ticket comment still describes its acceptance as awaiting a decision.

## 4. The remaining latency budget

| Mean of two runs, seconds | Text: walnut corner | Image: left wall |
|---|---:|---:|
| Skill-selection model call | 2.551 | 3.880 |
| Create model call | 18.164 | 15.393 |
| Create tool | 3.236 | 2.080 |
| First kitchen | **23.980** | **21.381** |
| After first kitchen | 6.935 | 29.257 |
| Completed turn | **30.916** | **50.638** |
| Model time, whole turn | 27.647 | 47.236 |
| Tool time, whole turn, interval union | 3.254 | 3.380 |
| Model calls | 3 | 7 |

Model time is about **89.4%** of text time and **93.3%** of image time. Information-tool unions are 17.4/17.7 ms for text and 28.7/33.3 ms for images. Removing all of that read work cannot materially change these targets.

Against [the response-time targets](../wiki/planning-assistant-response-time-targets.md):

- Text first kitchen: **13.980 s above 10 s**; both runs miss. Final answers, 29.054–32.778 s, fit the 20–40 s range.
- Image first kitchen: mean **1.381 s above 20 s**, individual runs 18.850–23.913 s. Final answers 49.673/51.603 s straddle the 50 s upper target. This is not consistent target attainment.
- The 15 s and 25 s lower ends for image work remain farther away; the image-interpretation target is unmeasured.

### A useful bound for the text target

Subtracting the entire skill-selection call from the observed first-kitchen mean gives **21.429 s**. Even subtracting the entire create tool as well leaves approximately **18.193 s**. These are counterfactual accounting bounds, not predicted results of a selector or planner optimization.

With skill selection taking zero time and the current 3.236 s create tool plus about 0.019 s bootstrap retained, a 10 s target permits approximately **6.75 s** for the create model call. Its observed mean is 18.164 s: a reduction of about **63%** is required. A real selector consumes part of that budget. Therefore neither memoization, description shortening nor the selector alone closes the text gap.

For images, subtracting the skill call gives **17.501 s**, leaving only about 2.5 s for a selector and any extra first-request work to stay below 20 s. This makes a bounded selector experiment relevant to images, without establishing its benefit in advance.

## 5. New proposal: generate the action before narrating it

### Finding and cause

The retained `timeline.json` output events show a planning preamble in **every create call**. The current `SYSTEM_PROMPT` asks for tools and a summary, but does not specify that explanatory prose follows the action. `SKILL_IN_SESSION` already adapts the delivered room skills to a concept-planning session; it is the appropriate place to clarify when to communicate assumptions without rewriting those skills.

| Run | Preamble characters | First text delta → first create activity | First create activity → tool execution |
|---|---:|---:|---:|
| Text 1 | 272 | 1.494 s | 5.990 s |
| Text 2 | 255 | 1.424 s | 5.945 s |
| Image 1 | 326 | 2.145 s | 6.110 s |
| Image 2 | 339 | 2.081 s | 5.801 s |

The activity is emitted when tool input starts. These intervals split the report's “remaining stream” into user-facing narration and tool-input production. They do not measure isolated inference CPU time.

### Proposed target

Clarify the planner's served instruction: for an actionable request, issue the tool calls directly; put the explanation, assumptions, substitutions and unresolved checks in the final answer. Preserve necessary clarification and the existing progress indicator. Do not suppress text in the UI after the model has generated it: that saves no generation time.

**Opportunity:** 1.46 s of observed pre-create narration for text, 2.11 s for images, and fewer output tokens. Actual savings can be smaller, zero, or displaced into reasoning/tool generation. Token savings are not measured by character count. Keep the final answer concise but complete; do not replace it with a success template that cannot describe corrections.

**Scope/tests:** `hi-agent-prompts.ts`, and `SKILL_IN_SESSION` only where necessary; their prompt/served-text tests and fixture. A paid comparison must verify tool-first output, first-kitchen time and equal plan quality. The original skills, including their checks and regional scope, remain unchanged.

## 6. New proposal: one decision for independent finishing edits and verification

### Finding and cause

Both image turns have the same seven-call structure:

`skills → create → attribute lookup → edit A → edit B → render → answer`

The edits set handles and attempt the backsplash, in opposite orders between runs. Their inputs use the group ID already returned by the create. The image call has no arguments and does not need a fresh model decision to select a camera. Its description says when images are needed but does not explain that it can follow an already specified edit in the same response.

`tool-executors.ts` already queues plan changes **and** `get-plan-images` through `oneAtATime`. A failed command does not poison the queue. Existing tests prove images wait for an opening submitted before them. Thus this proposal needs no parallel planner writes, new queue, batch endpoint or automatic render after every mutation.

### Proposed target

For independent edits whose complete arguments are already known, ask the model to issue them in one response, each as its existing tool call, followed by `get-plan-images` when verification is due. Review all results and the resulting images together in the next model call. The candidate image path becomes:

`skills → create → attribute lookup → independent edits + render → answer`

Keep dependent work separate: when the next action needs a newly assigned ID, a returned allowed value, a correction, or a decision about a failed operation, consume that result first. Do not blindly bundle a sequence whose second edit undoes the first. In particular, **do not merge the failing backsplash and valid handles into one attribute transaction**: its failure could discard the useful change. Separate tool calls preserve their existing failure and undo boundaries.

The executor guarantees submission order, not arbitrary model intent. The real pinned SDK/bridge must be tested to establish that calls emitted as edits-then-render reach the queue in that order. A prompt instruction alone does not prove that transport property. If it fails, do not ship this optimization on a timing assumption; consider an explicitly ordered tool contract only in a separate design.

**Opportunity:** two fewer model calls in these seven-call traces. Calls 5 and 6 occupy 10.813 s in image run 1 and 8.109 s in run 2, **9.461 s mean**. That is the observed round budget being combined, not a guaranteed saving: their tool arguments still need generation, edits and the 0.45 s render still execute, and final review remains. It avoids roughly two full-context model evaluations; the observed input counts of those removed calls total about 175.8k per image turn, before accounting for changed combined calls and retained chain context. First-kitchen time should be unchanged.

**Scope/tests:** served system/tool text; executor ordering/failure tests; real `streamText` forwarding and Azure/OpenAI wire tests for several calls/results and image content. Assert images represent the final queued state, useful edits survive another tool's error, each changed tool retains its undo step, and verification can still trigger a repair. Acceptance requires both lower completion time and retained image comparison.

## 7. Further proposals, ranked by evidence and scope

### 7.1 Extend D122 by structural attribute families — experiment, not a hardcoded handle exception

**Exact cause:** `createAttributeIds` selects value lists from catalog main attributes/dimensions, group settings and generated-root module attributes. This includes handle design but excludes handle colour and position in the measured library. The authoring rules explicitly say: “an attribute with valueCount keeps its article's value until you change it after the create.” The later lookup and handle edit therefore follow the interface's instructions; they are not unexplained model inefficiency.

Test this library-neutral candidate: include the value lists of attributes with the **same complete, non-empty library `group` path** as an attribute selected by the existing create criterion. Use the library's grouping as data; do not match words such as “handle”, invent attribute IDs, or follow textual descriptions as executable dependencies. Retain shared-list deduplication and every value's description/colour code. Preserve all headers and explicit lookup for remaining details.

An offline probe ran the current `agentFacingAttributes` projection over the retained October 27 article/master-data sections. The candidate expands the eligible set only; it does not modify master data. The projected attribute object grows from **87,653 to 103,844 bytes (+16,191)**, makes 31 additional attributes' lists available and leaves 71 `valueCount` entries instead of 102. It includes handle colour and position. These are **older-data, offline byte measurements**, not a new October 28 baseline or a token/latency result. The probe result is retained locally as `attribute-family-probe.json`.

The risk is concrete: library groups organize editing and are not a formal dependency graph. A broad group can add unnecessary choices, and absent groups add none. This candidate needs current-data and second-library tests before selection; it is not an accepted replacement for D122. Empty or missing group metadata leaves the original criterion in effect. No configurable thresholds, per-library allow-list or new library API is proposed.

With these values supplied, the model can set the intended appearance with the initial group attributes, which the create tool already supports. Require the measured first kitchen to contain the intended handles and retain layout quality. Check the library's design/colour compatibility: setting black changes the rail handle to a bow handle in both baselines, so moving the setting earlier must not hide that correction or promise an unavailable rail finish.

**Opportunity:** the handle-edit rounds cost 3.416/3.188 s including their tools. The lookup rounds cost 2.225/14.077 s, but also request the backsplash and therefore cannot all be credited to handles. At best this removes the handle round and, only when nothing else needs lookup, its lookup round. More first-call input and more creation work can make the first kitchen later. Measure both milestones; do not accept a faster final answer bought by missing the first-kitchen target. Savings overlap with §6 and must not be added to it.

Scope: `agent-facing.ts` and the corresponding vocabulary tests; the authoring-rule explanation, fixture and D122 reference if adopted. No assistant or embedding-lib change is necessary for a planner-owned projection change.

### 7.2 Complete description shortening, then evaluate a stable smaller article projection

The first part is existing [MCP issue 117](../backlog/mcp-issues.md#117-the-catalog-serves-19-descriptions-in-full): `shortDescription` at `agent-facing.ts:185` only recognizes section content on the line after its heading. Inline `FUNCTION: ...` and `AI_SELECTION_HINT: ...` leave 19 full descriptions in the reference. The recorded opportunity is about 11 KB. Support both formats, preserve unrecognized descriptions and the explicit full-description path. Test sink-selection information survives; smaller text that loses the drainer constraint is a regression.

A separate exploratory refactor could supply a **stable catalog overview**, retaining every article, instead of all template detail in the bootstrap. This differs from per-request RAG: there is no search round and the same library still produces the same prefix. Keep article IDs, descriptions, categories, dimensions, corner flags, main/default attributes and multi-root structure; detailed submodules and docking remain retrievable. The planner owns the projection, with a distinct requested section if the existing public `articles` contract must stay intact. The host must not maintain its own interpretation of library data.

Derive D122 eligibility from the full planner catalog before producing that overview. `createAttributeIds` needs root-module IDs to distinguish ordinary catalog modules from generated ones; dropping those IDs before this calculation would silently expand the attribute selection and defeat the projection's purpose.

An intentionally lossy offline projection of the older 111-article capture, keeping identity/description/category/library/corner fields plus root dimensions/main attributes, reduces the article array from **116,454 to 77,534 bytes**. This **38,920-byte difference is a size ceiling for that particular deletion experiment**, not a production design: module identity, submodule contents and docking can matter to selection and edits. A viable projection must retain the information their consumer tests require; do not claim that entire saving in advance.

Measure prefix size, first-output wait and create-call duration independently. A 95–98% cache-hit rate proves reuse, not that context size has zero remaining cost; conversely, fewer bytes do not prove a latency improvement. Reject the projection if it introduces catalog lookups before creation or degrades article/appliance selection. Do not redesign the tool vocabulary merely to save cached schema bytes: schemas are already stable, though the captures show 44,156 schema bytes still accompany every request.

### 7.3 Reassess the existing skill selector against today's smaller round

The [backlog design](../backlog/planning-assistant-skill-selector.md) already defines planner-owned skill metadata, a small selector, retained supplied skills and fallback. Do not silently revive the rejected all-skills prefix or first-image-only preload, and do not call the selector newly invented work.

Its net latency must include the selector request, selection errors, skill acquisition and any increase in the first planning request. The current maximum removed model work is only 2.551 s for text and 3.880 s for images, rather than the older 3.3–4.9 s range used in its proposal. Later edits that already have the skill can gain nothing and may pay a new selector cost. Use the same existing skill scope and France precedence. It cannot meet the text target on its own (§4).

Keep this behind the two small experiments and a measured selector-deployment choice. Model names in the attachment are not proof of available Azure deployments. A selector must outperform the current round with quality held constant; a fallback restores correctness but consumes time and must remain in the results.

### 7.4 Diagnose and reduce the create model call; separate configuration from code changes

The text create waits **10.132/11.346 s** for first output, then streams for **7.483/7.368 s**. Approximately 1.46 s of that stream is preamble (§5), leaving about six seconds from tool-input start to execution. Removing narration and eliminating the skill round still leaves most of the gap. A smaller JSON spelling alone cannot supply the roughly 11.4 s reduction required in §4; the current API already derives docking and placement from compact relations.

For the provider boundary, retain fetch start, headers/first chunk, first generated output, first text, tool-input start/completion, completion time, request ID when exposed, usage and cache coverage. Record deployment/model version, region, concurrent traffic and observed throttling without credentials or request bodies. Correlate long waits with existing Azure deployment metrics if available; do not label the 13.480 s image lookup wait as reasoning when the usage reports zero reasoning tokens.

Microsoft's [latency guidance](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/latency) distinguishes token generation, prompt processing and deployment load, and recommends examining first-response and token-generation latency alongside token counts. It also distinguishes throughput quota from per-call latency. These are diagnostic directions, not evidence that this resource is overloaded or that buying capacity will reach 10 seconds.

Reasoning effort is an **existing** `PlanningAssistantConfig` option and launcher override, with separate work in RML-18043. The text baseline explicitly leaves it out of scope. Keep provider-default reasoning for code experiments; if that scope is reopened, benchmark supported effort settings as their own variants. Likewise, a different deployment or model is a separate quality/cost experiment, not a hidden change to the baseline. Do not add a new option where one already exists, nor prescribe an unsupported effort or service tier from a model name.

If the 10 s target is mandatory and the same model/configuration still spends over that budget in one create response, the remaining decision is product/serving capability: a faster validated planning configuration or a larger server-assisted layout design. There is no evidence here to promise a deterministic kitchen solver will preserve open-ended requests while fitting that budget; it needs its own feature analysis. Keep full kitchens as the milestone, not a partial row labelled as success.

## 8. Known limitations and alternatives not selected

| Candidate | Why it is not the next implementation |
|---|---|
| More tool memoization, a second attribute search index, redoing template precalculation | The relevant reads take milliseconds and templates are already retained. Fresh plan state must not become stale. |
| Skip image verification | It removes useful work and changes the quality contract. §6 changes when the render is requested, keeping the comparison. |
| Put every setting, including the failing generated part, in the first create | The backsplash calculation can invalidate the first kitchen. Preserve the existing isolation until the capability works. |
| Retry known backsplash failure, or suppress it by a Furniture_Smith rule | Both baseline attempts fail with library Error 14034. The tool text deliberately asks for a separate attempt; [library issue 10](../backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate) tracks the actual calculation problem and description wording. No safe general rule derives permanent incapability from two failures. An authoritative library description may prevent futile attempts, but this is a dependency, not a claimed two-repository speedup. |
| Training the skills into model weights | Does not remove the need for current library and plan data; delivered skills and regional rules change. No model-training proposal is needed to test the identified round reductions. |
| Retry/watchdog, hedged calls or paid keep-alives | No evidence that restarting legitimate slow calls reduces end-to-end time. It can double paid work; plan-changing calls must never replay as a latency strategy. |
| Stream incomplete roots into the planner | Violates the complete-group relation/layout contract and changes the milestone. |
| Optimize price refresh from overlapping intervals alone | Price calls overlap observed work, but the captures do not isolate a blocking dependency. Profile before changing it; never move an assistant fix into `glue-logic.ts`. |
| Tight output-token cap or answer template | A cap can truncate a valid create; a template cannot safely infer all corrections and omissions. Prefer less unnecessary prose and preserve a real final review. |

The living response-time wiki says planner creation takes at most 1–2 seconds; these text runs measure **2.999–3.473 seconds**. Its categorical statements that cached input or payload changes cannot help should be treated as prior conclusions with a stated evidence boundary. This analysis leaves those documents and the historical reports unchanged; an adopted result should update the relevant living reference.

## 9. Implementation surface and behaviour tests

The following is the scope and test contract of the proposals, not an approved implementation plan. Paths in this table are relative to **roomle-ui**, with `HI = packages/web-sdk/packages/homag-intelligence` and `EM = packages/embedding-lib/src/homag-intelligence`.

| Area | Current source / proposed change | Existing tests and additions needed |
|---|---|---|
| Tool-first narration | `HI/src/hi-agent-prompts.ts:15`, `HI/src/hi-mcp/hi-mcp-server.ts` (`SKILL_IN_SESSION`) | `HI/__tests__/hi-agent-prompts-test.ts`, `HI/__tests__/hi-mcp/hi-mcp-server-test.ts`; preserve assumptions, clarifications and omissions in final output; verify no unsupported promise of zero reasoning |
| Finishing calls and images | `HI/src/hi-mcp/hi-mcp-server.ts:962` and system instructions; existing queue `HI/src/hi-mcp/tool-executors.ts:268`, render at `:732` | `HI/__tests__/hi-mcp/tool-executors-test.ts:1908` already tests an opening then images; extend to two edits with one failure, final-state images and unchanged history; extend `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts` to prove real SDK submission order |
| D122 family experiment | `HI/src/hi-mcp/agent-facing.ts:298` (`createAttributeIds`), `:324` (`agentFacingAttributes`), authoring text at `hi-mcp-server.ts:21` | Vocabulary cases in `HI/__tests__/hi-mcp/tool-executors-test.ts`; exact full group matching, empty groups, library isolation, duplicate value lists, description preservation, excluded element type and unchanged fallback lookup; fixtures for different libraries guard a library-neutral selection rule |
| First-create appearance | Existing group attribute support in `HI/src/hi-tool-commands.ts:508`, `:852`, `HI/src/hi-tool-attributes.ts:665`; no new setter required | `HI/__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`, `group-commands-test.ts`, `HI/__tests__/hi-attribute-check-test.ts`; root accents win, allowed-value corrections survive, failed optional generated part does not discard unrelated useful work |
| Description shortening / optional overview | `HI/src/hi-mcp/agent-facing.ts:185`, `:362`; `HI/src/hi-mcp/tool-executors.ts:483`; overview section/schema only if selected, bootstrap include in `EM/hi-planning-assistant.ts:273` | Existing article-description tests; inline/newline/CRLF headings, unstructured fallback, full-description retrieval, multi-root identity, selection data and unchanged D122 eligibility; `HI/__tests__/hi-library-context-test.ts` and assistant bootstrap/freshness tests for a new section |
| Selector, only if selected | `EM/hi-planning-assistant.ts` config, setup and turn input; `HI/src/hi-agent-prompts.ts`, `HI/src/external-object-api.ts`, planner prompt contract in `packages/web-sdk/packages/planner-core/src/roomle-planner.ts` | Existing `hi-planning-assistant.spec.ts`, `hi-planning-{azure,openai,continuation}.spec.ts`; scope/France precedence, later image, retained skills, absent config, timeout/error fallback, complete usage, changed library and abort |
| Provider diagnostics, where captures are insufficient | `EM/hi-planning-assistant.ts:112` transport, `:364` model callback and stream loop; `EM/hi-planning-usage.ts` | `tests/unit/embedding-lib/homag-intelligence/hi-planning-usage.spec.ts` plus assistant and adapter specs; missing counters/IDs remain unknown, continuation rejection does not replay mutations, request association and sensitive-data exclusion |

Any served-text/schema change also updates `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` and its fixture test. Planner documentation affected by adopted proposals: `.agents/homag-intelligence/hi-tools-behaviour.md` (including D122 or skill decisions where changed), `hi-tools-reference.md`, `tool-executors.md`; assistant changes additionally update `prompt-caching.md` and `agent-architecture.md`. Only an actual changed decision warrants a new/superseding ADR.

In **roomle-hi-example**, the future measurement surface is `.agents/scripts/run-hi-mcp-prompt.js`, `planning-assistant-usage.js`, `benchmark-hi-mcp-runs.js` and their tests under `.agents/scripts/tests/`; prefer temporary timing hooks when existing diagnostics suffice. Retain compatibility with old runs. Update `.agents/context/deployment-and-testing.md` if capture behaviour changes, and `.agents/context/pages-chat-and-launcher.md`, `docs/ai-chat.md`, `minimal-hi-example/start.mjs` and its tests only for an approved new assistant configuration. A changed embedding-lib needs an explicitly approved build and matching pin in `minimal-hi-example/index.html`; planner-only instruction/projection changes do not.

Source review links at the inspected commit: [assistant](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts), [system prompt](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts), [served rules/tools](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts), [projection](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/agent-facing.ts), [executors](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts).

## 10. Benchmark and acceptance contract

Use the two requested October 28 reports as historical baselines. For a candidate, collect a contemporaneous control as well; one later fast pair cannot establish a causal improvement over an earlier pair on a variable shared deployment.

**Minimum comparative screen:** two fixtures × two valid repetitions × control/candidate = **eight planning turns** per isolated candidate. The existing captures imply approximately **7–8 minutes of subprocess time and 3.28M input tokens** for that comparison, most cached in these baselines; setup/failures add time and future cache rates are unknown. Four candidate-only turns cost about 3.6 minutes and 1.64M input tokens but establish only path/quality and a pilot comparison, not a strong latency claim. No currency estimate is justified without the actual deployment tariff. No new paid run was made for this analysis.

Keep `gpt-6-astra` on Azure with `$AZURE_GPT_KEY`, provider-default reasoning, `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`, the exact prompts and omitted suffix, image `kitchen-1.png` with SHA-256 `07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95`, the same collector and no pacing. Interleave control/candidate order. Use fresh sessions, record both repository SHAs, actual module URLs, library-data digests, runtime versions and observed/unknown provider cache state. Never overwrite the existing sessions or switch/restart the user's planner implicitly.

Measure these independently:

1. User submission → callback, callback → first loaded kitchen, and callback/submission → completed answer.
2. Per model call: first output, preamble duration, tool-input production, response duration, input/output/reasoning and covered cache counters, individual request bytes. Count selector calls too.
3. Tool and planner interval unions, overlaps, failure/recovery steps, post-create rounds, and final saved plan. Do not substitute summed concurrent intervals for wall time.
4. Quality: complete kitchen, appliance counts, corner/left-wall placement, window/door clearance, sink/hob/drainer separation, requested fronts/worktop, handles and reported substitutions. Preserve the image comparison and truthful missing-backsplash disclosure while its library failure remains.

| Candidate | Structural acceptance before interpreting seconds | Quality / timing condition |
|---|---|---|
| Tool-first generation | No planning preamble before create in both repetitions | Same final assumptions/omissions and equivalent kitchen; lower first-kitchen time without longer later recovery |
| Independent edits + render | Seven-call image path becomes at most five where inputs are already known; render after queued edits and before final review | Same final loaded state, errors and undo boundaries; lower full-turn time, no stale images |
| Attribute families | Relevant appearance choices set in create, with no new lookup before it | No regression of first-kitchen time or compatibility/fidelity; report context increase and any remaining lookup separately |
| Catalog reduction | Smaller stable prefix with all necessary selection data, no extra pre-create retrieval | Same article choices/quality envelope; measure create time instead of inferring it from bytes |
| Selector | Create is first planning-model call; selector included in elapsed time and usage | Net improvement including wrong/missing selection, no penalty hidden on edits; compare against current 2.551/3.880 s round |
| Configuration/deployment | One explicit changed variable, verified supported by the actual endpoint | Same quality gates and error handling; report separately from code refactoring |

Before adoption, extend beyond two happy paths: France kitchen, image-only tall units, a living-room request, a simple edit, a later image in an existing conversation, undo/redo, missing reference, an unsupported generated part and a second library. Reuse existing prompt fixtures where available; identify missing coverage explicitly. More runs require a separately scoped run request, not an implicit full-suite spend. Two valid repetitions are a screening minimum; repeat a promising result when spread masks the difference and collect enough operational samples for percentile claims.

Run the relevant unit/wire suites through roomle-ui's npm scripts and the example's reporting tests when those modules change. The documentation-only analysis is verified by checking calculations against the retained captures, code/decision references, index entries and Markdown links. It establishes opportunities and acceptance criteria; it does not mark any proposal implemented or any unmeasured saving achieved.
