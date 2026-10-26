# Planning Assistant: live context and image-skill preloads

> **Type**: Feature analysis
> **Status**: Implemented on `feat/hi-mcp-performance` — two-repetition benchmark complete; awaiting merge
> **Date**: 2026-10-26
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-hi-example `3d01b27a4e2b2669c3bc92cdcc3bb29357bc753c`; roomle-ui `80484dc71e0889e24d3251e42090c1ff2eca10f7`, `feat/hi-mcp-performance`

## Affected repositories

- **roomle-ui** — the embedding-lib's prompt bootstrap and history lifecycle; the planner's instructions that distinguish supplied current state from information still needing a tool read; associated tests and architecture reference.
- **roomle-hi-example** — this analysis and its indexes; independent benchmark reports and adoption of the resulting embedding version if implementation is approved.

## 1. Answers and recommendation

| Question | Recommendation | Important limit |
|---|---|---|
| Automatically add plan context to each user prompt? | **Yes: evaluate a fresh, scoped live-plan snapshot at the start of each accepted user turn.** Include rooms, groups, obstacles and installation elements, using the existing agent-facing projection. | Compact articles/attributes are already supplied. Do not duplicate them by adding the complete default tool response. Large populated plans and read-only turns need measurement. |
| Automatically add image-planning to the first user prompt containing an image? | **Yes: preload the served image-planning SKILL.md before that turn's first model call.** This is a small, deterministic prerequisite for planning from an image. | Retain its confirmed presence in successful conversation history. A temporary first-turn-only reference is lost on the next user turn. Apply the guidance only when relevant to the user's request. |

Both ideas are sensible candidates for the planning-first PoC. They can make the first model decision better informed and remove redundant retrievals. **Neither alone, nor both together, is proven to remove a model round in the measured kitchen case:** the same round also fetches kitchen guidance, and the model then requests its planning reference. Fewer tool calls are not automatically fewer model calls or a measured time saving.

This analysis makes no productive-code changes, package publication or new paid model requests.

## 2. What “plan context” means here

There are three different kinds of input:

| Input | Current behavior | Proposed lifecycle |
|---|---|---|
| Common authoring instructions and compact library reference | Supplied before history. Articles and the attribute vocabulary are acquired each turn. | Preserve the shared prefix and its digest. Plan edits must not change it. |
| Live plan state: rooms, groups, obstacles, installationElements | The model requests it through get-plan-context. Previous tool results remain historical observations. | Acquire at turn start; supply as the current snapshot for that turn. Refresh when later changes or uncertainty require it. |
| Image-planning guidance | The model obtains it through get-skill when an image is supplied. Its returned text becomes part of successful tool history. | Acquire before the first image-bearing turn's first model call; retain the supplied guidance with successful history. |

The proposed plan preload is **not** raw master data, the entire article catalog again, plan images, order data or interior-fitting discovery. It does not put removed library properties back into HiPlanContext.

## 3. Current code and contracts

Paths below are roomle-ui paths, pinned to the inspected revision.

| Code | Finding |
|---|---|
| [hi-planning-assistant.ts:188](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L188) | Each accepted turn creates the current user text/image message and prepares reference material before calling the model. |
| [hi-planning-assistant.ts:216](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L216) | The bootstrap already calls get-plan-context with `include: ['articles', 'attributes']`. It does not acquire live plan sections. |
| [hi-planning-assistant.ts:244](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L244) | The reference digest covers instructions and referenceMessages; the optional Azure cache key uses that digest. Messages are assembled as reference, successful history, current user message. |
| [hi-planning-assistant.ts:280](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L280) | OpenAI/Azure Responses continue with new tool outputs inside a turn. The chain is independent at the start of the next user turn. |
| [hi-planning-assistant.ts:343](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L343) | Only the actual user message and successful responseMessages are retained. Temporary referenceMessages are not stored in history. |
| [hi-agent-prompts.ts:22](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts#L22) | Instructions require fresh rooms/groups/obstacles/installation elements before edits, use supplied skill files, and retrieve missing information. Kitchen guidance is regional; image/text determine the layout. |
| [tool-executors.ts:48](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts#L48) | Default get-plan-context includes articles/attributes as well as live sections. Calling it without an explicit include list would duplicate the supplied library reference. |
| [tool-executors.ts:479](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts#L479) | One tool call can request both plan/library sections; the executor reads their separate planner methods and applies agent-facing projections. Its existing operation queue orders reads with agent changes. |
| [hi-mcp-server.ts:81](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts#L81), [get-skill:450](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts#L450) | The served SKILL.md includes SKILL_IN_SESSION, adapting survey/catalog guidance to the actual plan. This is session guidance, **not** a loaded-skill registry. |
| [image-planning/SKILL.md](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills/image-planning/SKILL.md), [skills.ts:165](https://github.com/roomle-dev/roomle-ui/blob/80484dc71e0889e24d3251e42090c1ff2eca10f7/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills.ts#L165) | Image-planning is one SKILL.md, sourced from the planner's skill registry. It interprets furniture/layout, gives text precedence, and obtains applicable room guidance. It is not specific to kitchens or a library. |

## 4. Automatic live plan context

### Recommended shape

Extend the existing bootstrap's explicit include list to:

```text
articles, attributes, rooms, groups, obstacles, installationElements
```

Partition the projected result into the existing library message and a separate live-plan message. This can use the existing tool without a new planner endpoint, raw DTO serializer or second copy of tool logic. Keep library serialization/order consistent with the current prefix and verify that changing only groups does not change its bytes or digest.

Place the snapshot **after historical messages and before the newest user message**, labelled as current state acquired for that turn. Historical tool results then remain history, and the user request keeps its normal position and priority. Treat plan data as reference data, not instructions.

The live snapshot must stay outside referenceMessages and the shared reference digest/cache boundary. Do not append automatic plan snapshots to successful conversation history. Acquire again on the next user turn instead of accumulating another stale snapshot there. Genuine model-requested tool results keep their normal history.

### Freshness and scope

- A supplied snapshot can satisfy the initial fresh-state read. Clarify the planner's instruction to use supplied current-turn state and fetch missing or stale sections; otherwise the model may repeat the same read automatically.
- Capture through get-plan-context so the existing projection, plan frame, opening labels and operation ordering apply. Do not bypass it with a host read of the raw planner DTO.
- A start-of-turn snapshot does not stay current after plan changes. Use confirmed write results and re-read where necessary, including known manual UI changes, changed groups or uncertain state. It does not remove the need for later tools or close every concurrent-edit race.
- Empty `groups: []` is valid. A missing groups section or failed read is not evidence of an empty room. On preload failure, keep the existing on-demand tool path and avoid declaring unavailable sections supplied.
- Keep interior fittings, images, order data and full master-data details on demand. Do not silently truncate a large plan or invent a host intent classifier to decide whether a user message is “worth” context.

For this PoC, consistently preloading these four live sections on every accepted user turn is a reasonable candidate. Its benefit is less certain for a simple thank-you, a catalog question, price-only work or a large populated plan. Those cases should establish whether the default adds acceptable overhead. Any later compact-summary projection would need its own design; it is not a prerequisite for trying the existing live sections.

A combined library/plan read also couples their acquisition latency and failure outcome. Validate that behavior; do not assume bootstrap stays as cheap as the library-only call. The existing tool already reads the two sources internally, so there is no need for new host synchronization, polling or invalidation machinery.

## 5. Automatic image-planning on the first image-bearing turn

### Trigger and source

Use the first accepted user message whose actual image array is nonempty. It can occur after earlier text-only turns. A filename in text, an older attachment, or a plan image returned by a tool is not a new user image. Respect the configured image capability and the existing image-only fallback prompt.

Before the first model call of that turn, execute the existing get-skill tool for `image-planning` and use its **served** text, including the session preamble. Do not copy SKILL.md into the example, import the planner's skill bundle into the embedding host, or put every skill in the common setup-time referenceBlocks. The existing tools are available to the assistant at that point.

Supplying guidance is not authorization to create furniture. Preserve user-text precedence and apply the guidance to relevant image-planning work. A screenshot/question asking only for description or diagnosis must not become an unsolicited plan edit. The model can determine relevance from the image and request; a separate image-classification model call would undermine this optimization.

### Retention is essential

“Fetch once” and “make available once” are different:

1. The first image turn receives a labelled skill-reference message before its first model request.
2. On a **successful** turn, retain that actual reference with the existing successful conversation history, alongside the user message and genuine assistant/tool results.
3. Later turns see that retained guidance when the assistant reconstructs their first request. It is not fetched again merely because a new user prompt arrives.
4. A failed/aborted first image turn does not permanently mark missing history as loaded. A later valid image turn can obtain the skill again.

Do not fabricate assistant tool calls/results to persist the preload. A genuine labelled reference message suffices. Recognize earlier successful on-demand loading as supplied too, rather than adding another copy. Any small presence state should follow the same successful-history commit and reset lifecycle, not become a second skill cache or registry.

Putting the skill only in temporary referenceMessages would fail this lifecycle: those messages are not stored, and turn-local response chaining does not carry them into the next user turn. The session preamble does not fix this; it describes how to use the plan, not which skill bytes the next request includes.

Image-planning has no additional files of its own. Applicable kitchen/living-room guidance and any required references remain on demand. Do not infer that every furniture image is a kitchen or preload both the general and French kitchen skills. Preserve regional scope, image layout precedence, concept assumptions and optional source-catalog behavior.

## 6. Combined message order and measurements

| Order | Content | Retained after success? |
|---|---|---|
| 1 | Stable system/common authoring instructions | Existing setup lifecycle |
| 2 | Current compact library reference | Reacquired each turn; existing shared-prefix digest |
| 3 | Successful history, including previously supplied image guidance | Yes |
| 4 | New image-planning reference, only if not already supplied and this user message has images | Yes, with this successful turn |
| 5 | Fresh live-plan snapshot | No; acquire again on the next turn |
| 6 | Current user text and image parts | Yes, with this successful turn |

Within OpenAI/Azure Responses turns, the initial preloads become part of the stored response context and later requests carry only new tool results. Other provider routes still upload their accumulated context, so their transport overhead can differ.

Measure combined bootstrap wall time, live-context bytes, supplied-skill bytes and their acquisition spans where actual boundaries exist. Keep the stable library-reference digest separate. A combined tool read does not expose independent plan/library CPU time; do not invent such a split. Retain first-output, first-visible-text, first-kitchen and full-turn measurements, per-call bytes, token/cache coverage and actual model-call counts.

## 7. What the existing benchmark establishes

Evidence: the two [response-chaining repetitions](../benchmarks/02-iklw-oa-rc-2026-10-26.md), with the [comparison](../benchmarks/iklw-oa-rc-cmp-2026-10-26.md) kept separately. The following are recorded tool-result bytes, **not** exact added request bytes or token estimates.

| Information in the first part of the turn | Result bytes | Run 1 tool ms | Run 2 tool ms |
|---|---:|---:|---:|
| Already-preloaded articles/attributes | 270,617 | 11.5 | 12.0 |
| Initial live rooms/groups/obstacles/installations | 5,631 | 9.5 | 11.0 |
| Image-planning SKILL.md, including served preamble/wrapper | 5,658 | 9.4 | 10.5 |
| Kitchen-planning SKILL.md | 20,247 | 9.5 | 10.4 |
| Kitchen planning reference | 15,393 | 0.7 | 1.3 |

The initial model decision takes **3.815 / 5.864 s** and calls live context, image-planning and kitchen-planning together. The next model decision takes **13.731 / 12.467 s** and obtains the kitchen reference. The create decision follows.

Consequences for the two proposals:

| Candidate | What it removes from observed round 1 | Remaining dependency |
|---|---|---|
| Live context preload only | Model-requested initial context call | Both image and kitchen skills still need loading |
| Image skill preload only | Model-requested image skill call | Live context and kitchen skill still need loading |
| Both | Initial context and image skill calls | Kitchen skill still needs loading; the later reference round is not inherently removed |

Therefore, do not claim that either proposal saves the whole first 3.8–5.9 s decision or the later 12.5–13.7 s reference decision. They may shorten decisions/output and improve choices, but that requires observation. Removing the remaining discovery round would need applicable room guidance too; the host cannot safely choose a room skill from the mere presence of an image.

Context size also changes with the plan. A later full live-context result in run 1 is **32,438 bytes**, versus 5,631 in the empty-room read. Its 472.1 ms outer duration overlaps image work and must not be treated as isolated context-assembly CPU time. Measure larger populated plans directly rather than extrapolating linearly.

## 8. Scope, alternatives and verification

### Locations a future implementation would affect

| Location | Change / check |
|---|---|
| `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` | Bootstrap the explicit live sections, partition stable/dynamic content, conditionally obtain image guidance, retain it only with successful history, and keep plan snapshots out of history/shared digest. |
| `packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts` | State that supplied current-turn context satisfies the initial read; refresh missing/stale state. Preserve image/user-text and regional precedence. |
| `.../src/hi-mcp/hi-mcp-server.ts` | Align the get-plan-context description only where it would otherwise require a duplicate read. Reuse its existing get-skill serving path and preamble. |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` | Prefix partitioning, changing plan state, first/later image turns, failure/abort/history retention and no redundant preload. |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-continuation.spec.ts`, `hi-planning-openai.spec.ts`, `hi-planning-azure.spec.ts` | Real pinned-adapter wire tests: one copy of supplied data, correct order, preserved continuations/options and complete successful history. |
| HI `__tests__/hi-agent-prompts-test.ts`, `__tests__/hi-mcp/hi-mcp-server-test.ts`, `skills-test.ts` | Instructions recognize supplied state; preloaded skill equals served source including preamble. Regenerate `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` if served text changes. |
| roomle-ui `.agents/homag-intelligence/prompt-caching.md`, `agent-architecture.md`, `hi-tools-behaviour.md` and applicable decision | Describe the accepted ownership, freshness and history contracts. |
| roomle-hi-example context, benchmark reports and indexes | Record actual runtime/adoption and separate before/after evidence, if implementation proceeds. |

No planner API addition, glue-logic change, library-calculation change, host-owned copy of skills or universal operational-skill preload is required. The public tools remain available to the model and other hosts. This is assistant input assembly, not removal of on-demand capabilities.

### Alternatives considered

| Alternative | Assessment |
|---|---|
| Add the whole default context beside the existing library reference | Reject: duplicates articles/attribute vocabulary. Use explicit sections and a stable/dynamic partition. |
| Put live plan data in the shared prefix/digest | Reject: plan edits contaminate a reference that should stay invariant. |
| Persist every automatic plan snapshot | Reject: accumulates stale state; reacquire per turn. |
| Supply image skill only in the first temporary image-turn reference | Reject: it disappears from the next turn's reconstructed context. |
| Add image skill to every setup-time prompt | Unnecessary input for text-only conversations; use the actual first image-bearing turn. |
| Preload kitchen guidance for every image | Reject: furniture kind and jurisdiction are not known from attachment presence. |
| Leave all discovery on demand | Current valid alternative; avoids unrelated first-call input, but supplies neither deterministic input before the first decision. Compare it rather than assuming the preloads are faster. |

### Required validation

Use deterministic unit/wire tests for empty and populated plans, manual edits between turns, missing/failed sections, text-only turns before the first image, image-only input, later images, prior on-demand skill loading, abort/retry and a non-planning image question. Assert no unsolicited plan changes, no lost user/image content, correct scoped skills, and no declaration that absent data is supplied. Verify byte-identical library prefix/digest when only live groups change.

For performance, compare four versions with the current response-chaining implementation held fixed: **current**, **live context only**, **image skill only**, and **both**. Two valid `image-kitchen-left-wall` repetitions per version means **eight runs**, using `openai:gpt-6-astra`, `$OPENAI_ASSISTANT_API_KEY`, provider-default reasoning, the same image/prompt/plan and local planner. Keep each version's report independent and place comparisons in a separate document. The current observed input usage suggests roughly **4.3–4.5 million input tokens** for eight similar runs, plus setup/variation; this is a planning estimate, not an authorized experiment here. A four-run current-versus-both comparison is a smaller alternative but cannot isolate each preload's contribution.

Include text-only/read-only and large-plan serialization checks without model calls first. Measure whether required model rounds actually disappear, whether references are redundantly fetched, how initial input/cache behavior changes, and whether saved-plan quality and skill scope remain correct. Keep the existing backsplash calculation finding separate. No new benchmark is run during this analysis.

## 9. Implementation and measured outcome — 2026-10-26

The approved implementation plan is [comment 156546 of RML-18303](https://roomle.atlassian.net/browse/RML-18303?focusedCommentId=156546).
Both preloads are implemented in roomle-ui commit `5426d65c4845ba1371de92e48b49f8bb58c8a6b8`
on `feat/hi-mcp-performance`. The example pins the verified published package
`@roomle/embedding-lib@0.0.0-dev-5426d65` ([build](https://github.com/roomle-dev/roomle-ui/actions/runs/40379495687)).

The assistant partitions one explicit context read into stable library reference and a transient
current-turn snapshot. Its first user-image preload uses the served skill/preamble, retaining
actual guidance and supplied presence only with successful history and recognizing successful
on-demand loads. Missing/failed acquisition preserves ordinary tools. Freshness and history
contracts are promoted to roomle-ui's prompt-caching, architecture, behaviour reference (D115)
and ADR 0014; example integration is in [pages-chat-and-launcher.md](../context/pages-chat-and-launcher.md).

Verification: **115 embedding tests**, **250 SDK tests**, types, code lint, formatting and the
embedding build pass. Source and published-package browser preflights make zero provider requests
and verify first/later-image retention, one live snapshot per turn and stable library bytes.
The synthetic 100-group live snapshot is **2,282,198 bytes**, with no truncation or write tools;
the whole offline source turn takes **28.7 ms**. This is not a physically loaded large scene or
an isolated CPU measurement. Unit coverage additionally preserves 1,000 groups.

The approved smaller measurement adds only the combined variant as
[benchmark 03](../benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md), reusing preserved 01/02 as
historical comparisons in the [same comparison document](../benchmarks/iklw-oa-rc-cmp-2026-10-26.md).
Both new kitchens are saved and centred on the left wall; both answers disclose the unchanged
backsplash calculation failure. Mean first-kitchen time is **29.974 s** versus **30.815 s** in 02;
mean complete-turn time is **54.359 s** versus **53.601 s**. Each new turn uses **eight** model
calls versus **six** in 02; mean input is **730,936.5** versus **548,708.5** tokens. Initial
image/context reads are supplied, but kitchen guidance/reference discovery remains and post-create
reads run sequentially. **No overall completion-time benefit is established.**

Full repository lint is not green: UI TypeDoc reports 22 warnings treated as errors; SDK TypeDoc
reports type errors in `image-renderer.ts:156` and `bun-webgpu/src/structs_ffi.ts:703`. Identical
findings reproduce in an isolated clean checkout of base `80484dc` with an identical lockfile
and installed dependencies. These unrelated documentation/tooling findings remain outside this
implementation. The optional four-variant experiment and paid large-scene latency testing are
not performed; individual preload effects and broader workload overhead remain unmeasured.

Keep this analysis until the implementation lands on the default/release branch; its durable
contracts already live in the architecture reference. Raw evidence, logs and PDFs stay in `.temp/`.
