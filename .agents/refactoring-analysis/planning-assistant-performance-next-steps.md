# Planning Assistant performance: the remaining work after the October 28 baselines

| Field | Value |
|---|---|
| Type / domain | Refactoring analysis / HI Planning Assistant performance |
| Status | Open — proposals, no productive implementation |
| Date / author | 2026-10-28 / Codex |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Base | roomle-hi-example `ad36f46259777c4a69dfe56ae42e0145b6013545`; roomle-ui `e6804d598a44ceb2eef5f1b23587339a73f5d921` |
| Evidence | The two October 28 baselines, their four retained captures, the ticket's original 36 comments and attachment; current code/decisions and auxiliary offline catalog probes |
| Scope | Analysis only. No new model requests, deployment changes or embedding-lib build |

Affected repositories:

- **roomle-ui:** proposed changes to the agent's served instructions, attribute/catalog projection, batch article retrieval and optional category discovery/description sharing; if experiments justify them, assistant diagnostics and skill selection; corresponding tests and behaviour documentation.
- **roomle-hi-example:** this analysis and indexes; future controlled benchmark captures, evaluation and adoption of an approved embedding-lib version where necessary.

## 1. Conclusion and recommendation

The remaining problem is principally **model time and the number of model decisions**, not slow information tools. The text kitchen already meets the upper final-answer target but misses the first-kitchen target by about 14 seconds. The image kitchen is near the upper targets, with most of its remaining time spent after creation.

**The workflow should establish a valid layout first and resolve product details afterward.** This follows the user's planning process: the first kitchen establishes the arrangement, functions and space requirements; finishes and other choices that do not determine that layout can follow. The performance objective is an earlier useful layout and an efficiently completed result, not the fewest model calls at any cost. Section 7 defines the boundary and the implications for article information.

Start with two small experiments that fit that workflow: **omit narration before tool calls**, and **send independent finishing edits followed by the required render in one model response**. The retained timelines expose work these can remove without a new planner API. Fix the existing description-shortening defect alongside its own verification. Prefer staged information access over expanding appearance choices in the initial reference; retain the D122 family experiment (§7.1) only as a comparator for work whose details are already known or affect the layout.

**For article information, prefer a useful overview plus batch details on request.** The initial reference need not contain every article's template detail or every finish choice. Keep enough information to choose feasible articles for the layout; retrieve information about the selected articles and relevant attributes when refining it. For libraries too large for that overview, evaluate a category directory with batch retrieval and an unrestricted search fallback. Description sharing can complement either design, but derive it from exact repeated passages: similar descriptions do not establish equivalent articles. In the inspected catalog its additional byte benefit is small after description shortening is corrected (§7.2).

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
| Tool memoization / selective retrieval | Read work is measured in milliseconds; default reference is stable and shared | No evidence supporting more memoization as the next latency refactor. A smaller overview and batch/category retrieval are separate context-size and scaling proposals (§7.2), with additional model rounds to measure. |
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

Implemented as D123, measured in benchmark 10 and reverted: both image kitchens kept one call per response, the finishing edits and the render one by one, although the path runs the calls of one response in the order sent ([10 against the baselines](../benchmarks/az-cmp-2026-10-27.md#10-against-the-baselines)). D123 of roomle-ui’s behaviour reference records the rejected proposal.

## 7. Further proposals, ranked by evidence and scope

### Planning sequence: establish the layout, then refine the selected products

The user's clarification makes staged planning the preferred design. Separate the **decisions needed to establish a feasible layout** from the **details needed to finish the requested result**. Information retrieval follows that sequence. A later detail lookup is useful work when it allows the layout to appear sooner; the number of rounds alone is not the acceptance criterion.

| Stage | Decisions and information | Visible outcome |
|---|---|---|
| Layout | Required functions and appliance spaces, arrangement, dimensions, corner/mounting behaviour, openings and circulation, connections and other constraints that determine fit | A complete, usable arrangement represented by valid library articles; unspecified or deferred settings use valid defaults |
| Refinement | Requested finishes, colours, handles, fittings and precise product variants where their constraints permit deferral; retrieve the selected articles' details and relevant attribute values together | The layout refined to the requested result, with compatibility corrections, remaining choices and unavailable details explained |

This is a decision boundary, not a fixed list of “structural” and “cosmetic” attribute names. A handleless construction, appliance model, worktop thickness, handedness or sink overhang can change geometry, clearance or compatibility. An explicit product requirement that determines fit belongs in the layout stage. Where a description leaves that uncertain, retrieve the relevant detail before relying on the layout. Use library data and existing checks; `isMain`, attribute groups, category names and similar descriptions are not a formal dependency graph. Do not add library-specific IDs or infer that a field called colour can never trigger a library correction.

**The current tools need real article IDs.** The near-term proposal creates a complete arrangement with valid articles/defaults whose detailed configuration may remain provisional. It does not introduce abstract cabinets or promise that any final product will fit an arbitrary placeholder. Planning with product-neutral families and resolving them to concrete articles later would require a separate feature analysis: each family must establish feasible dimensions, mounting and compatibility, and article replacement must preserve relations and placement. Description sharing alone cannot establish that equivalence.

Retain requirements already supplied in the original prompt or image across both stages. A walnut front or black handle requested at the start is deferred work, not a preference to forget or ask for again. Apply a known compatible detail in the create when it requires no extra selection work and does not delay the layout; the stages need not force an otherwise unnecessary edit. If the user asks for a complete kitchen, continue refinement in the same turn. If the user asks only for a layout, stop at that scope and leave later choices to the user. This proposal adds no compulsory approval pause between stages.

Refinement uses the returned group/root IDs and existing attribute/exchange tools. Preserve the established layout when the change permits it; if a selected variant or library correction changes dimensions, mounting or arrangement, revalidate the affected layout before claiming the final result. Batch independent known choices as in §6; consume correction/compatibility results before dependent choices. Preserve existing undo boundaries and the valid layout if an optional refinement fails. Final verification and disclosure still apply.

The code already supports part of this process: D122 explicitly leaves attributes with `valueCount` at their defaults until after creation, and both image baselines perform finishing edits after the first kitchen. The remaining opportunity is to make the information boundary match that process. **Moving decisions later while still preloading all their value lists does not reduce the initial context.** Evaluate a layout-oriented article/attribute projection and fetch only the additional information required for refinement. Preserve internal full-catalog D122 calculations and the metadata needed to discover attributes; do not blindly remove all main-attribute defaults or selection lists. Where the data cannot safely establish what may be deferred, retain the relevant information.

Measure first valid layout and completed requested result independently. A complete arrangement with provisional finishes is useful; an isolated base row with missing requested appliances is not a complete layout. Keep the historical first-successful-create measurement and the final-quality gate, and add an explicit layout-quality assessment at the intermediate state. The final snapshot alone cannot prove what was valid at the first create. A faster layout can justify a necessary later lookup, but the final latency, cost, corrections and quality remain visible. This design has not yet demonstrated a saving against the October 28 captures.

### 7.1 Structural attribute families — a comparator to staged refinement

This experiment supplies more detail before creation. Under the preferred layout-then-refinement workflow, it is **not the default recommendation for appearance-only choices**. Keep it as a controlled alternative where those choices affect fit or where already-known compatible details can reduce total work without delaying the layout. The measured input increase below is a reason to compare it against later targeted lookup.

**Exact cause:** `createAttributeIds` selects value lists from catalog main attributes/dimensions, group settings and generated-root module attributes. This includes handle design but excludes handle colour and position in the measured library. The authoring rules explicitly say: “an attribute with valueCount keeps its article's value until you change it after the create.” The later lookup and handle edit therefore follow the interface's instructions; they are not unexplained model inefficiency.

Test this library-neutral candidate: include the value lists of attributes with the **same complete, non-empty library `group` path** as an attribute selected by the existing create criterion. Use the library's grouping as data; do not match words such as “handle”, invent attribute IDs, or follow textual descriptions as executable dependencies. Retain shared-list deduplication and every value's description/colour code. Preserve all headers and explicit lookup for remaining details.

An offline probe ran the current `agentFacingAttributes` projection over the retained October 27 article/master-data sections. The candidate expands the eligible set only; it does not modify master data. The projected attribute object grows from **87,653 to 103,844 bytes (+16,191)**, makes 31 additional attributes' lists available and leaves 71 `valueCount` entries instead of 102. It includes handle colour and position. These are **older-data, offline byte measurements**, not a new October 28 baseline or a token/latency result. The probe result is retained locally as `attribute-family-probe.json`.

The risk is concrete: library groups organize editing and are not a formal dependency graph. A broad group can add unnecessary choices, and absent groups add none. This candidate needs current-data and second-library tests before selection; it is not an accepted replacement for D122. Empty or missing group metadata leaves the original criterion in effect. No configurable thresholds, per-library allow-list or new library API is proposed.

With these values supplied, the model can set the intended appearance with the initial group attributes, which the create tool already supports. For this comparator, record whether it finishes those choices in the create; the staged design does not require final handles at its first-layout milestone. Both must preserve final layout/appearance quality. Check the library's design/colour compatibility: setting black changes the rail handle to a bow handle in both baselines, so moving the setting earlier must not hide that correction or promise an unavailable rail finish.

**Opportunity:** the handle-edit rounds cost 3.416/3.188 s including their tools. The lookup rounds cost 2.225/14.077 s, but also request the backsplash and therefore cannot all be credited to handles. At best this removes the handle round and, only when nothing else needs lookup, its lookup round. More first-call input and more creation work can make the first kitchen later. Measure both milestones; do not accept a faster final answer bought by missing the first-kitchen target. Savings overlap with §6 and must not be added to it.

Scope: `agent-facing.ts` and the corresponding vocabulary tests; the authoring-rule explanation, fixture and D122 reference if adopted. No assistant or embedding-lib change is necessary for a planner-owned projection change.

### 7.2 Supply useful article summaries, retrieve details in batches, and scale discovery separately

**Implemented as a whole; failed and rejected.** The article catalog in three levels — `articles` as the catalog overview, `find-articles` for articles in full and for the overview of categories or of a text search, the `categories` directory as the library reference above a `libraryReferenceBudget`, the docking vector of `merge-article-into-group` derived by the server — was implemented in roomle-ui 818b261ee and measured by [benchmark 12](../benchmarks/12-iklw-az-ovw-2026-10-28.md) and [benchmark 13](../benchmarks/13-iklw-az-dir-2026-10-28.md). It made no turn faster: every request carried 7,542 input tokens less than in the baselines, read from the cache, and the seconds stayed within the provider's spread; the category directory made the kitchens later, and no library of the HOMAG test proxy is too large for the model's context window. Description sharing was measured on the four libraries and not built. roomle-ui ecd685571 reverts the change; D125 of the [behaviour reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions) records the rejected proposal. A first attempt of two narrow pieces, measured by [benchmark 11](../benchmarks/11-iklw-az-arts-2026-10-28.md), is reverted as well (roomle-ui c13969005). The subsections below are the proposal as it was analysed.

#### 7.2.1 What already exists, and what is missing

The initial article reference is already a projection, not the raw library. `compactArticle` in `hi-plan-context.ts:625` supplies identity, description, category, corner information and each root's module, dimensions, main attributes, docking vectors and submodules. `agentFacingArticle` at `hi-mcp/agent-facing.ts:362` removes the corner point and shortens sectioned descriptions. The assistant requests **all articles and the attribute vocabulary** in `hi-planning-assistant.ts:273`; that reference is acquired for each turn. A separate pre-prompt read warms article templates.

D63 already separates short descriptions from full descriptions. However, `get-plan-context` currently selects sections, not article IDs: asking for `articleDescriptions` returns the descriptions of **every article**. This leaves a concrete gap between “more information about these seven articles” and the available API. Batch detail retrieval would close that gap without requiring a new library calculation API.

MCP issue 117 is fixed on its own, without `articleIds`: `shortDescription` (`agent-facing.ts`) reads a section's text on the line of its name and on the next line — roomle-ui `da0f50b80` on `feat/hi-mcp-performance`, guarded by `it('shortens a description that writes each section on the line of its name')` in `__tests__/hi-mcp/tool-executors-test.ts`. Of the 111 descriptions of the library data none stays in full, the `articles` section is 11,010 bytes smaller (193,090 to 182,080), and the sink units keep the drainer constraint in both their lines; a description without the sections and `articleDescriptions` stay as they are.

Two existing contracts matter to this proposal:

- **D63 rejects category filtering that requires the agent to know an unseen category.** A directory plus fallback search is a proposed reassessment for large catalogs, not an already accepted decision. It must demonstrate discoverability and quality before that decision changes.
- **`HiLibraryContextOptions.articleIds` is not a result filter.** In `hi-library-context.ts:27–82` it limits which templates supply docking/corner geometry; the final map still returns every article. Preserve that documented meaning. A new selection/projection needs an explicit contract, not reuse of that option with silently different semantics.

#### 7.2.2 Recommended information levels

The minimum should mean **enough to choose correctly**, not just an ID and a name. The following are information levels, not a requirement for three new tools.

| Level | Information | When to supply it |
|---|---|---|
| Category directory | Library identity, exact library-provided category labels/paths, article counts and a route to uncategorized articles | Initially when the all-article overview exceeds a measured input budget; optional navigation alongside an overview |
| Article overview | Library/article identity, name, short function/selection description, category, reliable corner indication, root identity/count, dimensions and defaults needed for a feasible layout, concise included-component information needed for selection | Initially for manageable catalogs; otherwise for requested categories or search matches. Final finish alternatives need not accompany every article |
| Article details | The selected articles' full descriptions and existing detailed root/module/submodule, docking and insertion information; attribute definitions can be obtained through the existing batch attribute lookup | On demand for a **set of article IDs**, especially unusual mounting, alternatives, included appliances or compatibility questions |

Do not defer constraints needed for the initial choice: floor/wall use, handedness, required services, exclusions and geometry extending beyond the cabinet can distinguish superficially similar articles. Read these from the library's data and descriptions. There is no universal hardcoded list of kitchen attributes or article kinds. If a library's unstructured description cannot safely be shortened, retain it. A selected article's details should be self-contained, including any shared description text expanded into ordinary prose.

Dimensions must retain their attribute IDs and root association. They are parameter defaults, not necessarily the article's complete occupied envelope; `cornerArticle` can depend on calculated docking. Do not synthesize a universal width/depth interpretation or mark uncalculated corner information false. Preserve multi-root articles and included-component distinctions: a module name alone can lose information that its description carries.

Implement selection and projection in the planner's HI tool layer. Preserve the existing public `articles` result for callers that need it, and introduce an explicit overview section/result if adopted. One read operation can support batch category/search discovery and batch ID details; prefer this over per-article calls or a tool for every category. Its contract must define exact IDs, result completeness and requested detail level. An ID detail request must not disappear because it is outside a previously selected category. Return known articles and identify unknown IDs without discarding the whole batch. Do not invent new attribute compatibility data: the existing library checks and attribute tools remain authoritative.

The first version can select from the existing planner library read inside the tools, without extending the public planner method or changing `glue-logic.ts`. That reduces what reaches the model, but the underlying read still compacts all articles. If profiling a large library exposes a material preparation cost, analyse that separately in the tool/library-context implementation; the context-size experiment does not establish a need for a new public API.

Derive D122 eligibility from the **full internal catalog before projection**, regardless of which overview or category subset is sent. `createAttributeIds` uses catalog root-module IDs to distinguish ordinary modules from generated ones; a partial catalog would misclassify omitted ordinary roots and expand attribute lists. Overview reduction does not automatically reduce the separate attribute vocabulary.

#### 7.2.3 Categories help navigation; they must not restrict legitimate choices

Generate the directory and membership index from each library's category data. Scope identities by library; display the complete source category value. Do not assume every library uses `|`, English category names or a meaningful hierarchy. Derive parent/child navigation only where the data contract defines it. Missing categories need an explicit reachable bucket, and very broad categories need bounded pages with total counts and continuation, not silent truncation.

The difference between the two proposed maps is material:

- An **article-to-category map listing every ID** is still proportional to the article count. It can be a compact index for a moderate catalog, but names/categories alone may force another read before the agent can choose.
- A **category directory with counts and no full membership list** can keep initial input proportional to the number of categories. Fetch several categories together, then fetch details for the chosen set. This scales only when categories usefully partition the catalog; one category containing most articles provides little benefit.

The agent must be able to search across the whole loaded library using its names/descriptions, fetch known IDs directly and broaden a failed category search. Category membership is not a compatibility rule: a kitchen can need articles from several categories, and a legitimate request can combine furniture types. Do not infer category choice from a fixed room-type classifier. If source taxonomy or wording is poor, report that limitation; avoid an automatic semantic taxonomy or embedding service as the first implementation. Batch retrieval, transparent pagination and a lexical fallback are a smaller first design.

For a large catalog, this gives an initial directory plus summaries for the candidate subset plus details for selected articles. It avoids transmitting all detailed articles merely to discover the few needed. It does **not** guarantee fewer model calls or that the first chosen subset contains every useful alternative.

#### 7.2.4 Offline size evidence and its limits

An auxiliary retained capture, `.temp/result/benchmark-09-az-attrs-2026-10-28/probe/articles.json`, contains **111 articles in 27 complete category paths**, with 1–14 articles per category. All have one root; it does not validate multi-root or missing-category behaviour. Its SHA-256 is `3e3b77b5f17e40a3fdddf4500507f326a2c75ef552ca953d6e67d890df0667e6`. The local calculation is retained in `.temp/rml-18303-analysis/catalog-probe.mjs` and `catalog-probe.json`.

| Offline representation | Compact UTF-8 article-array bytes | Interpretation |
|---|---:|---|
| Captured article projection | 116,454 | Auxiliary catalog capture, not a new baseline request |
| Correct inline/newline description shortening | 105,131 | 19 descriptions changed; 11,323 bytes removed |
| Candidate overview after shortening | 81,804 | Keeps module IDs/names, root dimensions/main attributes and submodule IDs/names; removes catalog duplication, module/submodule descriptions and docking detail |
| Identity/name/library/category only | 13,095 | Much smaller, but insufficient for reliable selection; not the recommended default |

The candidate overview saves a further **23,327 bytes** after shortening. It is an information-boundary experiment, **not an approved field deletion**: selection may need an omitted submodule description or geometry fact. The earlier, more aggressive 77,534-byte projection discarded module identity and all submodule information; its attractive size is not a reason to choose it. These figures exclude attributes, instructions, tool schemas, wrappers and later retrievals; they are neither tokenizer counts nor measured latency savings.

The first creates in the two text repetitions use the same **10 distinct article IDs across six categories**; the image repetitions use **seven across six categories**. In this auxiliary catalog those exact subsets occupy 10,430 and 6,976 bytes respectively, whereas all articles from those categories occupy 40,291 bytes/35 articles and 38,783 bytes/34 articles. This shows why batch detail retrieval can be useful. It is a **hindsight selection**, not evidence that the agent can discover those IDs or categories without alternatives or extra calls. Do not use those subset sizes as a claimed initial-prompt budget.

#### 7.2.5 Share repeated description passages dynamically, without merging article meaning

The suggested grouping is feasible as a **derived representation built when catalog data is loaded**. Several variants can share descriptive text while keeping their identity, dimensions, defaults and distinguishing text. This is independent of category navigation: articles in one category need not share a description, and sharing prose does not establish compatibility or interchangeability.

Start with **exact repeated sections or complete passages**, not semantic similarity. Build a library-scoped dictionary of verbatim text and let each affected article refer to shared passages plus its own text in the original order. Keep a direct description when sharing would make it larger or less readable. For example, a common placement paragraph can be stored once while each article retains its different width and door/drawer arrangement. Full detail retrieval expands the references so the caller does not need another dictionary lookup. The current `withSharedSelectionsOnce` is a precedent for library-scoped sharing, but description composition needs its own contract and tests.

Near-identical prose can identify candidates for inspection; it cannot justify inheriting a common meaning automatically. “May be wall-mounted” versus “must not be wall-mounted”, left/right variants, dimensions, exceptions and appliance inclusions must remain distinct. Avoid a model-generated family summary, fuzzy cluster representative or longest-common-substring compression as the first design. Arbitrary fragments make the agent reconstruct prose and can obscure a negation even when byte reconstruction is technically lossless. Prefer a shallow shared passage plus explicit article-specific text; no nested inheritance or override rules. Structured metadata may establish variant families where a library supplies it, but do not guess a universal family from ID prefixes or similar names.

The inspected capture gives a useful priority check:

- All **111 whole descriptions are distinct**. Repetition is in parts of descriptions, including placement, requirements and style passages.
- Before the shortening fix, an exact line-sharing prototype saves **2,304 bytes** after dictionary/reference overhead, using 23 shared blocks in 19 articles. An English sentence-segmentation variant saves 1,977 bytes. The scripts assert exact reconstruction of each changed description.
- After shortening, the same line approach has no reusable blocks and would add 24 bytes for an empty dictionary; omit that representation. Sentence sharing saves just **96 bytes**, with five shared passages across 12 articles. This is not enough evidence to prioritize a new description format for this catalog.
- Repeated root/submodule description text accounts for another 6,578 raw bytes before reference overhead. Some disappears in the proposed overview. It must not be counted again as an independent saving.

These are results for specific offline encodings, not a theoretical compression limit. English sentence segmentation is a probe for this English capture, not a library-independent production rule. A production design must handle the library's language and formatting or fall back to unchanged text. A much larger library with long repeated descriptions may show a different balance; measure it **after** shortening/projection, where the shared text would actually remain. Sharing may still help expanded detail batches, but do not add complexity solely to compress text that is already omitted initially.

Precompute using deterministic text processing, without paid model calls. A map keyed by complete passages avoids comparing every article with every other article. Scope any retained derived dictionary/index to the loaded library/catalog content, locale and projection version; rebuild when those inputs change. Stable content-derived references and ordering keep identical catalogs identical across turns; do not add load timestamps or random IDs to the prefix, and verify text equality when hashes identify passages. Every response must contain the shared definitions it references or expanded text, with no dependency on a previous turn's dictionary. Retain the authoritative full catalog unchanged in the planner.

Compute this with the library lifecycle or prepare it during the existing pre-prompt read; reuse it only for the same catalog snapshot. This is not a second cache of mutable plan state. The current assistant reacquires its library reference each turn, so any reuse must preserve that freshness. Measure catalog-load/readiness time, memory and UI responsiveness as well as prompt latency: moving expensive work before submission does not make it free. Likewise, a smaller model-facing overview does not by itself remove the existing all-article template warmup, especially when reliable corner information depends on it.

#### 7.2.6 Round cost, caching and recommended order

With an all-article overview, ordinary requests can still follow **skills → layout create → selected detail/attribute lookup → refinement → final review**. For many choices, the detail read belongs after the layout. If a detail is needed to establish fit and its article ID is already known, request it alongside the skill call; when its selection depends on the skill response, another decision remains necessary. A directory-only path can become **categories + skills → layout create**, followed by refinement, when category summaries support a valid arrangement. It needs a pre-create detail round only where those summaries omit a constraint required for that arrangement. Batch requests prevent a separate round for every article/category, but do not remove actual dependencies.

Keep the stable overview/directory and shared definitions in the cacheable prefix, with variable retrieval results afterward. Selective retrieval does not inherently invalidate that stable prefix. Cached input still occupies model context, while fewer serialized bytes do not prove shorter model time. References also add indirection and can increase selection effort. Measure token counts, cache coverage, retrievals, first-output wait, create duration and completed-turn time separately. Do not reduce schema readability merely to save the already stable 44,156 schema bytes per request.

Recommended sequence:

1. Correct shortening and add **batch full-description/details by article ID**, preserving existing callers. This makes on-demand expansion possible and avoids returning every description for a question about a few articles.
2. Evaluate a stable overview oriented toward layout across the current catalog and a second library, including which attribute information is actually needed initially. For the 111-article benchmark, avoid compulsory pre-create lookup for final finishes; retrieve details afterward for refinement. Preserve necessary early constraint reads and compare both milestones with equal final quality.
3. Evaluate **directory-first discovery for substantially larger catalogs** where an all-article overview is costly or exceeds the input budget. Choose the transition from measured serialized/token budgets and workload behaviour, not a hardcoded library name or arbitrary article-count threshold. Extra retrieval rounds can be justified here by making planning feasible within the context budget; report this as a scaling benefit separately from faster current kitchens.
4. Add **exact description sharing** only where representative data shows net savings after steps 1–2 and models preserve variant selection. Keep similarity-based semantic grouping out of the initial implementation.

The recommended target is an expandable catalog, not mandatory detail requests for every create. Keeping every article reachable and preserving selection constraints are acceptance conditions for every size of library.

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
| Layout then refinement | Served instructions in `HI/src/hi-mcp/hi-mcp-server.ts` / `HI/src/hi-agent-prompts.ts`; article/attribute projection in `HI/src/hi-mcp/agent-facing.ts`, lookup in `tool-executors.ts`, initial reference in `EM/hi-planning-assistant.ts:273`. Use the existing assistant loop and tools; a separate agent or mandatory phase switch is unnecessary | Prompt/projection and assistant tests: preserve original requirements, create with valid defaults, retain layout-critical data, retrieve deferred information in batches, complete refinement without an extra user prompt when already requested, respect layout-only scope, and retain full internal D122 eligibility |
| Finishing calls and images | `HI/src/hi-mcp/hi-mcp-server.ts:962` and system instructions; existing queue `HI/src/hi-mcp/tool-executors.ts:268`, render at `:732` | `HI/__tests__/hi-mcp/tool-executors-test.ts:1908` already tests an opening then images; extend to two edits with one failure, final-state images and unchanged history; extend `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts` to prove real SDK submission order |
| D122 family experiment | `HI/src/hi-mcp/agent-facing.ts:298` (`createAttributeIds`), `:324` (`agentFacingAttributes`), authoring text at `hi-mcp-server.ts:21` | Vocabulary cases in `HI/__tests__/hi-mcp/tool-executors-test.ts`; exact full group matching, empty groups, library isolation, duplicate value lists, description preservation, excluded element type and unchanged fallback lookup; fixtures for different libraries guard a library-neutral selection rule |
| Layout defaults and later refinement | Existing group attribute support in `HI/src/hi-tool-commands.ts:508`, `:852`, `HI/src/hi-tool-attributes.ts:665`; existing attribute/exchange commands, no new setter required | `HI/__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`, `group-commands-test.ts`, `HI/__tests__/hi-attribute-check-test.ts`; root accents win, allowed-value corrections survive, known appearance edits preserve layout, dimension-changing replacements trigger layout verification, failed optional generated part preserves useful work, undo/redo retain their current boundaries |
| Description shortening / overview | `HI/src/hi-mcp/agent-facing.ts:185`, `:362`; `HI/src/hi-mcp/tool-executors.ts:483`; overview section/schema in `HI/src/hi-mcp/hi-mcp-server.ts`, bootstrap include in `EM/hi-planning-assistant.ts:273`; source projection in `HI/src/hi-plan-context.ts:625` | Existing article-description tests; inline/newline/CRLF headings, unstructured fallback, full-description retrieval, multi-root identity, included components, selection constraints and unchanged D122 eligibility. Assistant bootstrap/freshness tests for a new section |
| Batch article details / category discovery | `HI/src/hi-mcp/hi-mcp-server.ts`, `tool-executors.ts`, `agent-facing.ts`; consume the existing read contract in `HI/src/hi-library-context.ts:27` / `HI/src/external-object-api.ts:232` without changing its meaning; assistant reference selection as above | `HI/__tests__/hi-library-context-test.ts`, `hi-mcp/tool-executors-test.ts`, server schema/wire tests. Preserve the existing geometry-only `articleIds` option, old callers and full-catalog D122 input; exact batch IDs, partial unknown IDs, library isolation, missing categories, cross-category lookup, bounded complete pagination, stale cursors after catalog changes and unrestricted fallback |
| Shared descriptions, only if size/quality evidence supports them | Planner-owned derived projection beside `HI/src/hi-mcp/agent-facing.ts`; lifecycle in the library/tool integration above, no interpretation in the host | Exact text reconstruction and deterministic output under reordered source input; negate/left-right/dimension/exception variants stay distinct; unfamiliar formats/languages retain text; standalone batch details; no cross-library references, dangling references or hash-collision merges; library/locale changes invalidate derived data; dictionary/reference overhead included |
| Selector, only if selected | `EM/hi-planning-assistant.ts` config, setup and turn input; `HI/src/hi-agent-prompts.ts`, `HI/src/external-object-api.ts`, planner prompt contract in `packages/web-sdk/packages/planner-core/src/roomle-planner.ts` | Existing `hi-planning-assistant.spec.ts`, `hi-planning-{azure,openai,continuation}.spec.ts`; scope/France precedence, later image, retained skills, absent config, timeout/error fallback, complete usage, changed library and abort |
| Provider diagnostics, where captures are insufficient | `EM/hi-planning-assistant.ts:112` transport, `:364` model callback and stream loop; `EM/hi-planning-usage.ts` | `tests/unit/embedding-lib/homag-intelligence/hi-planning-usage.spec.ts` plus assistant and adapter specs; missing counters/IDs remain unknown, continuation rejection does not replay mutations, request association and sensitive-data exclusion |

Any served-text/schema change also updates `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` and its fixture test. Planner documentation affected by adopted proposals: `.agents/homag-intelligence/hi-tools-behaviour.md` (including D63, D122 or skill decisions where changed), `hi-tools-reference.md`, `tool-executors.md`; assistant changes additionally update `prompt-caching.md` and `agent-architecture.md`. Only an actual changed decision warrants a new/superseding ADR. No catalog proposal changes `glue-logic.ts`.

In **roomle-hi-example**, the future measurement surface is `.agents/scripts/run-hi-mcp-prompt.js`, `planning-assistant-usage.js`, `benchmark-hi-mcp-runs.js` and their tests under `.agents/scripts/tests/`; prefer temporary timing hooks when existing diagnostics suffice. Retain compatibility with old runs. Update `.agents/context/deployment-and-testing.md` if capture behaviour changes, and `.agents/context/pages-chat-and-launcher.md`, `docs/ai-chat.md`, `minimal-hi-example/start.mjs` and its tests only for an approved new assistant configuration. A changed embedding-lib needs an explicitly approved build and matching pin in `minimal-hi-example/index.html`; planner-only instruction/projection changes do not.

Source review links at the inspected commit: [assistant](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts), [system prompt](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts), [served rules/tools](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts), [projection](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/agent-facing.ts), [executors](https://github.com/roomle-dev/roomle-ui/blob/e6804d598a44ceb2eef5f1b23587339a73f5d921/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts).

## 10. Benchmark and acceptance contract

Use the two requested October 28 reports as historical baselines. For a candidate, collect a contemporaneous control as well; one later fast pair cannot establish a causal improvement over an earlier pair on a variable shared deployment.

**Minimum comparative screen:** two fixtures × two valid repetitions × control/candidate = **eight planning turns** per isolated candidate. The existing captures imply approximately **7–8 minutes of subprocess time and 3.28M input tokens** for that comparison, most cached in these baselines; setup/failures add time and future cache rates are unknown. Four candidate-only turns cost about 3.6 minutes and 1.64M input tokens but establish only path/quality and a pilot comparison, not a strong latency claim. No currency estimate is justified without the actual deployment tariff. No new paid run was made for this analysis.

Keep `gpt-6-astra` on Azure with `$AZURE_GPT_KEY`, provider-default reasoning, `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`, the exact prompts and omitted suffix, image `kitchen-1.png` with SHA-256 `07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95`, the same collector and no pacing. Interleave control/candidate order. Use fresh sessions, record both repository SHAs, actual module URLs, library-data digests, runtime versions and observed/unknown provider cache state. Never overwrite the existing sessions or switch/restart the user's planner implicitly.

Measure these independently:

1. User submission → callback, callback → first loaded kitchen, and callback/submission → completed answer. For staged planning also assess when the first complete valid layout exists; retain the original create-completion clock alongside that quality assessment.
2. Per model call: first output, preamble duration, tool-input production, response duration, input/output/reasoning and covered cache counters, individual request bytes. Count selector calls too.
3. Tool and planner interval unions, overlaps, failure/recovery steps, post-create rounds, and final saved plan. Do not substitute summed concurrent intervals for wall time.
4. Quality at the layout stage: complete arrangement, required functions/appliance spaces, corner/left-wall placement, window/door clearance and sink/hob/drainer separation, with valid provisional defaults. At completion also require the requested fronts/worktop, handles and reported substitutions. Preserve the image comparison and truthful missing-backsplash disclosure while its library failure remains. Capture the intermediate state through test instrumentation and account for its overhead; do not infer it solely from the final saved plan.

| Candidate | Structural acceptance before interpreting seconds | Quality / timing condition |
|---|---|---|
| Tool-first generation | No planning preamble before create in both repetitions | Same final assumptions/omissions and equivalent kitchen; lower first-kitchen time without longer later recovery |
| Independent edits + render | Seven-call image path becomes at most five where inputs are already known; render after queued edits and before final review | Same final loaded state, errors and undo boundaries; lower full-turn time, no stale images |
| Layout then refinement | Complete valid layout before optional final choices; initial reference omits safely deferred detail; original requirements persist into refinement | Measure time to valid layout and final completion separately, including refinement/rework/cost. No missing structural content disguised as a faster layout; no unrequested approval pause |
| Attribute families, comparator only | Record which appearance choices finish in create and the additional initial context | Compare against targeted later retrieval; preserve layout latency and final compatibility/fidelity rather than requiring finished handles in every first layout |
| Article overview + batch details | Smaller stable prefix; necessary layout constraints present; ordinary current-library layout needs no compulsory lookup for final finishes | Same final quality envelope; measure both milestones and all retrievals. A useful post-layout detail round is compatible with the design; its total cost remains part of the comparison |
| Directory-first catalog | Initial data fits the declared budget; category/search discovery can reach every article, including uncategorized and cross-category results; selected details returned in batches | Compare small and large libraries separately; count extra decisions, missed alternatives and fallbacks. Context-budget feasibility is a scaling result, not evidence of lower current-baseline latency |
| Description sharing | Exact reconstruction, stable references and self-contained detail results; net savings after shortening/overview and reference overhead | Same variant choices, restrictions and quality; measure tokenizer counts and model time. Reject a smaller encoding that causes extra lookups or selection errors |
| Selector | Create is first planning-model call; selector included in elapsed time and usage | Net improvement including wrong/missing selection, no penalty hidden on edits; compare against current 2.551/3.880 s round |
| Configuration/deployment | One explicit changed variable, verified supported by the actual endpoint | Same quality gates and error handling; report separately from code refactoring |

Before adoption, extend beyond two happy paths: France kitchen, image-only tall units, a living-room request, a simple edit, a later image in an existing conversation, undo/redo, missing reference, an unsupported generated part and a second library. For the staged workflow include a layout-only request, a complete request with finishes specified upfront, a precise product requirement affecting dimensions, a refinement that changes the envelope and a failed optional finish that leaves the layout usable. Reuse existing prompt fixtures where available; identify missing coverage explicitly. More runs require a separately scoped run request, not an implicit full-suite spend. Two valid repetitions are a screening minimum; repeat a promising result when spread masks the difference and collect enough operational samples for percentile claims.

For the catalog proposals, first run offline contract/size checks on the current library, a different library and genuinely larger representative data. Synthetic expansion can test serialization, indexing, paging, memory and readiness cost, but duplicated articles cannot validate discovery or article-choice quality. Include flat/absent/oversized categories, multiple libraries, multiple roots, nearly identical descriptions with opposite restrictions and changed library data between turns. Compare shortening alone, overview plus batch details, directory discovery and shared descriptions as separate variants; report overlapping savings only once. Capture input tokens for the **whole turn**, schema/reference overhead, startup preparation, cold and warm reads, retrieved article counts, model rounds and both user-visible milestones. New paid model runs still require the scoped authorization described above.

Run the relevant unit/wire suites through roomle-ui's npm scripts and the example's reporting tests when those modules change. The documentation-only analysis is verified by checking calculations against the retained captures, code/decision references, index entries and Markdown links. It establishes opportunities and acceptance criteria; it does not mark any proposal implemented or any unmeasured saving achieved.
