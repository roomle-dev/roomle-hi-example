# Planning Assistant: a shared prompt prefix for Azure

> **Type**: Refactoring analysis
> **Status**: Done — implemented and verified on local branches; retained until merge to the default branch
> **Date**: 2026-10-26
> **Ticket**: [RML-18303 — HI Planning Assistant: token usage and performance optimization](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-hi-example `master`, `77730b61e06c656b876513976cbbd4aaaaa34614`; roomle-ui `feat/hi-mcp-performance`, `3299f52329a1f81805f53151aa52c6e4d2c7a495`

## Affected repositories

- **roomle-ui** — assemble the shared reference, place it before conversation messages, align the served instructions, retain cache measurements and test the actual provider requests.
- **roomle-hi-example** — consume the resulting embedding-lib version, retain and report cache measurements, and provide the reproducible comparison. This repository holds this analysis.

## 1. Recommendation

**Yes: the master-data information, articles and reusable skills that the assistant needs should form a stable reference prefix before the first user request.** They should remain in that position on later model calls. Different users can then ask different questions after the same reference, rather than each introducing the reference through a different tool-call history.

That does **not** mean concatenating every raw file into one enormous system instruction. The recommended candidate is one logically ordered reference consisting of:

1. the existing system instructions and stable tool definitions;
2. the common authoring rules;
3. a named, scoped bundle of operational planning skills and their required planning references;
4. the compact article catalog and the attribute vocabulary derived from master data;
5. only then, the conversation, the current request, images and live plan results.

Keep one copy of each fact. Full master data, full article descriptions and skill source catalogs remain available through tools unless measurements justify including them. Cacheability makes repeated input cheaper to process; it does not make irrelevant input free or remove it from the context window.

**The immediate refactoring is prompt assembly and measurement, not a cache server.** Azure already has a prompt cache. No Redis, vector database, MCP server or cache-handle lifecycle is needed for this task.

The recommendation is a design candidate to measure, not a claim of an established speedup. First retain cache-read/write usage in the existing architecture, then compare the smaller library/rules prefix with the operational-skills bundle and an all-data bundle. Section 10 defines the comparison and the conditions for adopting it.

## 2. Scope and source interpretation

The ticket contains five ideas: prompt caching, tool memoization, precalculated article docking vectors, attribute indexing and selective RAG. This analysis covers the first. It also answers the follow-up question about putting invariant master data, articles and skills into one large initial prompt.

The supplied [desktop-vault performance note](https://github.com/Rabbid76/desktop-vault/blob/master/projects/ai%20assistant/performance.md) supplies the hypothesis. The supplied [agent architecture](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/.agents/homag-intelligence/agent-architecture.md) supplies the component map. Both were checked against the implementation, the pinned SDK sources and current provider documentation. The vault is an input to this analysis; this task does not edit it.

The selected sentence in the vault combines two different objectives:

- **Reduce repeated model prefill and billed input cost:** a reusable prefix can help.
- **Avoid sending the large text over the network:** prefix caching alone does not do this. The current assistant serializes and sends the reference on every request. A provider-side conversation reference would be a separate transport/state design.

The latter conclusion follows directly from the current loop and provider adapter: they send the accumulated input; this assistant does not use `previousResponseId` or a stored conversation. A cache key is not a reference that substitutes for omitted text.

### Current Azure rules that affect this decision

Azure enables caching automatically on supported models and requires a matching initial prefix of at least 1,024 tokens. GPT-5.5 and earlier use 128-token cache increments; that rounding does not apply to GPT-5.6 and later. Newer families can charge for cache writes and support explicit breakpoints on Standard pay-as-you-go deployments; PTU-M does not support those breakpoints. For these newer models, Azure documents `prompt_cache_options` with a `30m` minimum lifetime; older retention controls differ. Cache keys improve reuse but cannot repair differing content. Cache sharing does not cross Azure subscriptions. These are deployment-sensitive capabilities, not properties of every model reached through the Azure provider. [Microsoft: prompt caching](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching).

OpenAI describes reuse in terms of the **rendered model context**, including instructions, tools and messages. Relevant settings and tool ordering can affect the match. Therefore, stable JavaScript object identity or moving the JSON property `instructions` above `messages` is insufficient evidence. Inspect the adapter's serialized requests and measure provider-reported usage. [OpenAI: prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

The vault's universal discount percentages, retention durations and expected latency reductions must not become acceptance criteria. Use the actual Azure deployment's capability and tariff. In particular, a generic `provider: 'azure'` also covers the example's Mistral deployment, to which GPT cache settings must not be applied automatically.

## 3. What the code does today

Paths in this section are roomle-ui paths unless explicitly prefixed with roomle-hi-example. Links are pinned to the inspected revision so their line numbers remain meaningful.

### 3.1 The host already has stable instructions and tool definitions

[`hi-planning-assistant.ts:140`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L140) loads the AI SDK, provider, planner prompts and tool definitions once. At line 170 each turn calls `streamText` with:

```typescript
instructions: prompts.systemPrompt,
messages: [...messages, userMessage],
tools,
```

The system text is a constant in [`hi-agent-prompts.ts:11`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts#L11). [`hi-mcp-tools.ts:84`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/embedding-lib/src/homag-intelligence/hi-mcp-tools.ts#L84) preserves the planner's tool definition order and forwards calls. Successful turns append their user and response messages at line 200 of the loop. Failed turns do not enter that history.

These are already good properties for prefix reuse. The last step changes `toolChoice` to `none`; it does not deliberately replace the `tools` object. Its wire representation and cache behavior still need a regression case.

The inspected fixture contains **28 tools**, whose `JSON.stringify(fixture.tools)` occupies **42,189 JavaScript string characters**. This is a fixture-size observation, not a provider token count or proof of a hit.

### 3.2 Most reusable knowledge arrives after variable content

The agent requests `get-plan-context`, `get-authoring-rules` and `get-skill` after seeing the user's request. [`tool-executors.ts:479`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts#L479) gives `get-plan-context` these default sections:

```text
rooms, articles, attributes, groups, obstacles, installationElements
```

Its result combines plan data with library data. Reordering properties inside this tool result cannot move its library data ahead of the already different user request and tool call.

Conceptually, the existing request sequence is:

```text
Request A: instructions + tools + user's kitchen request
Request B: same prefix + assistant tool calls + rules/skills/library/plan results
Request C: same history + further calls/results

Another conversation:
instructions + tools + a different user request + different calls + same library
                     ^ cross-conversation prefix diverges here
```

The later tool results can still be reused in an unchanged prefix within one conversation. The problem is **limited cross-conversation reuse of shared knowledge**, not an assertion that current requests never hit a cache.

### 3.3 The library/plan split already exists below the tool

[`hi-library-context.ts:27`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/web-sdk/packages/homag-intelligence/src/hi-library-context.ts#L27) builds master data, articles and sub-articles from loaded libraries. It reads no plan state. Article geometry comes from templates rather than configured roots in the plan. [ADR 0013](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/.agents/decisions/the-library-context-is-a-planner-method-of-its-own.md) explicitly preserves the public tool's defaults while separating the underlying library method.

The existing tool can already return the proposed library prefix:

```typescript
await tools['get-plan-context'].execute({
  include: ['articles', 'attributes'],
});
```

This takes the library-only path. The executor reads master data to derive `attributes`, applies the agent-facing filters and removes the unrequested master-data section. The result passes through the existing serialization that strips `imageUrl`. No new library calculation, API endpoint or implementation in `glue-logic.ts` is required.

### 3.4 Static skills are deliberately fetched on demand today

[`hi-mcp-server.ts:427`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts#L427) serves authoring rules and skills. The system prompt says to fetch the applicable skill; the tool descriptions also require fetching rules/skills. A skill body receives the `SKILL_IN_SESSION` preamble, which makes planning a concept with available planner data take precedence over interviewing the user first.

[`skills.ts`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills.ts) already has a structured registry: names, descriptions, file paths and texts. This is the source for a preload bundle. Do not copy skills into the example page or extract their identities by parsing prose in tool descriptions.

Simply adding skill bodies to the prompt would leave contradictory instructions to fetch them again. A preload design must change the loading instructions and retain their scope, required references and session preamble.

### 3.5 The measurements discard the fields needed here

[`hi-planning-assistant.ts:50`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts#L50) retains only `inputTokens`, `outputTokens` and `totalTokens`. It collects step usage but logs only a whole-turn aggregate. The example's [`planning-assistant-usage.js`](../scripts/planning-assistant-usage.js) validates and copies only those same three counters. Adding fields in roomle-ui alone would therefore lose them in saved runs.

The installed `ai@7.0.122` exposes `inputTokenDetails.cacheReadTokens`, `cacheWriteTokens` and `noCacheTokens`, plus output reasoning details and raw usage. The field is **`inputTokenDetails`**, singular `Token`.

The exact pinned Azure package `@ai-sdk/azure@4.0.85` delegates to `@ai-sdk/openai@4.0.81`. Inspection of those published sources confirms:

- Azure uses the `azure` provider-options namespace for both API paths.
- `promptCacheKey`, `promptCacheOptions` and `promptCacheRetention` are serialized to their snake-case API fields.
- Content/message `providerOptions.azure.promptCacheBreakpoint` reaches supported content blocks.
- Responses usage reads `input_tokens_details.cached_tokens` and `cache_write_tokens`; Chat Completions reads `prompt_tokens_details`.
- The adapter's normalized cache-read count defaults to zero if the raw field is missing. A normalized zero alone does not establish that the deployment reported cache support.

Source artifacts: [Azure package manifest](https://unpkg.com/@ai-sdk/azure@4.0.85/package.json), [Azure adapter](https://unpkg.com/@ai-sdk/azure@4.0.85/dist/index.js), [Responses adapter](https://unpkg.com/@ai-sdk/openai@4.0.81/src/responses/openai-responses-language-model.ts), [message conversion](https://unpkg.com/@ai-sdk/openai@4.0.81/src/responses/convert-to-openai-responses-input.ts), [usage conversion](https://unpkg.com/@ai-sdk/openai@4.0.81/dist/internal/index.js). Provider support does not prove that the target Azure deployment accepts every setting.

## 4. Should all master data, articles and skills be included?

### 4.1 Static within a configuration, not identical everywhere

The user's premise holds for repeated requests against the same loaded data and skill revision. The sharing scope must also account for backend, loaded libraries/catalog contents, language, permissions that change visible content, skill revision and tool/prompt revision. A plan edit should not alter these sections. A library update can.

The stable prefix must exclude room/group identifiers, walls, obstacles, current attribute selections, current prices, available fitting destinations, images of the plan, user preferences, timestamps and request IDs. In particular, `find-attributes` also ranks results using the current plan; its complete result is not the static master-data vocabulary.

### 4.2 Use an agent-facing projection of master data

`agentFacingAttributes` in [`agent-facing.ts:293`](https://github.com/roomle-dev/roomle-ui/blob/3299f52329a1f81805f53151aa52c6e4d2c7a495/packages/web-sdk/packages/homag-intelligence/src/hi-mcp/agent-facing.ts#L293) includes attribute definitions and selection values, with shared lists represented by `sameSelectionsAs`. `agentFacingArticle` supplies compact descriptions, dimensions and relevant article properties. These are already the default information supplied for planning.

Full `masterData` additionally supplies module-to-attribute assignments and group settings. Those are useful for particular questions, but including full master data **and** the complete derived vocabulary repeats information. If a full-data variant wins, design one nonduplicating representation; do not append raw master data beside the existing vocabulary.

The checked-in generated library files illustrate the size risk:

| Input file | UTF-8 bytes after parsing and compact JSON serialization |
|---|---:|
| `docs/library-information/master-data.json` | 695,491 |
| `docs/library-information/article.json` | 248,747 |

These are local generated reference files, **not** the current provider payload or a measurement of the compact tool result. Their combined 944,238 bytes are a reason to measure the real agent-facing projection, not an estimate of its tokens. Never preload these files from disk/CDN in the application: the loaded planner library is authoritative.

### 4.3 Skills are reusable, but not all instructions apply simultaneously

Offline measurement of the roomle-ui skill source files at the base revision:

| Skill | `SKILL.md` UTF-8 bytes | All Markdown files, including references |
|---|---:|---:|
| image-planning | 4,830 | 4,830 |
| kitchen-planning | 19,280 | 39,639 |
| kitchen-planning-fr | 14,217 | 39,621 |
| living-room-planning | 17,596 | 39,360 |
| **Total** | **55,923** | **123,450** |

All four main files plus their operational `planning-reference.md` files total **101,336 bytes**. The optional source catalogs account for the remaining **22,114 bytes**. These are source bytes, before the session preamble, section labels and JSON escaping; no token conversion is assumed.

There is a plausible benefit to preloading operational skills: the measured image run in section 5 requests several skill files, rules and the plan context before or during planning. Preloading can eliminate some requests for already-present information. It removes a model round trip only when that round trip contains no other necessary work; several calls can occur in one step.

The bundle must preserve these distinctions:

- Kitchen versus living-room guidance applies only to the corresponding task.
- France-specific kitchen guidance is selected by the project's jurisdiction, not merely the UI language; it does not silently combine with another regional ruleset.
- Image planning preserves the image's brief and its existing precedence over recommendations from a room skill.
- The session preamble still governs how incomplete information is handled.
- Required operational references accompany the corresponding skill; optional provenance catalogs stay retrievable when asked for.

The recommended **skill-preload candidate** includes the operational bundle with an index and explicit applicability, in a fixed order independent of the user's wording. The smaller comparison candidate keeps these skills on demand. Do not add a classifier model solely to choose a cache prefix: it adds another request and changes the scope of this task.

### 4.4 One logical prefix, not necessarily one message

Separate blocks for rules, skill files and library data make provenance and applicability explicit. They can still form one identical prefix. API tool definitions remain in the tool field; their rendering is the provider's responsibility. Do not duplicate their schemas into prose.

Send this reference as part of the first real model request and include it in later requests. Do not make an extra model call merely to upload or acknowledge it. The preparatory reads are planner/tool reads; they need no LLM response. A single initial upload followed by requests that omit the text is not the design described here.

Library descriptions are reference data about products, not higher-priority instructions to the assistant. A stable reference message before the first real user message can carry them, with the system prompt defining its meaning. Do not fabricate an assistant tool call and tool result to make preloaded data look agent-requested. Preserve roles, real tool-call IDs and successful history.

## 5. Evidence from existing runs and its limits

The following measurements were read from existing local artifacts under `.temp/result/mcp-test-2026-10-25_15-24-34/gpt-6-astra/`. No new provider calls were made for this analysis.

| Run directory | Turn | Reported input tokens | Reported output tokens | Chat time |
|---|---:|---:|---:|---:|
| `01-edit-add-move-delete-subarticle` | 1 | 58,325 | 276 | 12.441 s |
| same | 2 | 71,518 | 184 | 9.808 s |
| same | 3 | 86,851 | 183 | 10.951 s |
| `05-full-kitchen-walnut-marble-corner` | 1 | 360,023 | 1,069 | 38.017 s |
| `07-image-kitchen-left-wall` | 1 | 470,408 | 1,385 | 48.648 s |
| `10-image-only-no-text` | 1 | 1,488,158 | 2,791 | 455.374 s |

Each selected turn reports complete **total-token** coverage and no turn error. These counts sum model calls within a turn; they are not the size of one prompt. They reveal neither cache-read/write counts nor uncached prefill. They are single examples, not a repeated benchmark baseline.

`planner-calls.json` records the image-left-wall run's default `get-plan-context` call at 15 ms, plus `get-skill` calls for planning guidance and `get-authoring-rules`. The full-kitchen run also reads default context at 15 ms. The subarticle conversation reads only `groups` and uses fitting tools. This last case is a useful counterexample: eagerly injecting the whole catalog and every skill can add work to a conversation that currently needs neither.

The saved `plan-context.json` files contain rooms, obstacles and groups, not the library sections. They cannot establish the current static prefix size. The selected console logs contain no legacy `[hi-chat] step` records. The [existing benchmark script](../scripts/benchmark-hi-mcp-runs.js) parses that old format, so running it unchanged cannot produce the cache or current per-step measurements required here.

The older [kitchen-from-image benchmark](../benchmarks/kitchen-from-image-time.md) supports investigating repeated reference material, but uses earlier builds. Its latency coefficients and catalog sizes must not be presented as current measurements or a prediction of this refactoring's gain.

## 6. Proposed target shape

```text
Planner-owned reference sources
  prompts + authoring rules + skill registry + compact library projection
                                |
                                v
Host assembles the identical beginning of each model request
  instructions / tools
  common rules / scoped operational skills
  current library reference
  ---------------------------------------------------------------
  successful conversation history
  latest user text and images
  new assistant tool calls and fresh planner results
                                |
                                v
Azure request -> reported cache reads/writes + response
```

### 6.1 Keep ownership in roomle-ui

For the smallest candidate, the assistant can obtain the library reference and authoring rules through the existing forwarded tools before sending its first model request. These are real reads performed by the host and do not require a model turn.

For the candidate that includes all operational skills, prefer an **optional structured reference on the existing `getExternalObjectAgentPrompts()` response**. Keep the base `systemPrompt` and `imagePrompt` contract. Let the planner assemble the common rules and skill texts from their actual sources and include their names/file paths. The host must not hardcode the four current skill names or copy their contents.

`RoomlePlanner.getExternalObjectAgentPrompts` is already asynchronous. Assemble additional reference information through the existing lazy HI tool module at this boundary; avoid importing all skills into the ordinary planner's eager bundle. The rule/skill builder belongs beside the tool registry, sharing its constants and `skills` registry. The library projection can continue through `get-plan-context` with explicit sections. This requires no additional plan-operation method and no change to `glue-logic.ts`.

An older planner that supplies only the existing two prompts continues through the on-demand path. A newer planner can supply optional reference data without forcing custom hosts to use it. The model's tool list remains usable by hosts that supply no reference at all.

### 6.2 Readiness and freshness

Build the prefix from successfully loaded library data, not the temporary empty state during planner initialization. The prompt runner already waits for library availability; the interactive assistant must have the equivalent readiness guarantee. Resolve this through the library/host lifecycle, not a timer or polling loop.

The simplest correctness-first design reads the library-only projection at the beginning of each user turn and retains that serialized reference for every model step of the turn. Identical content yields identical text. This avoids introducing application-level memoization or invalidation infrastructure into the prompt-caching task. Measure this local read separately.

A later optimization may reuse the assembled text for the lifetime of a known library load. It needs a real existing load/reload signal, not a TTL. Do not infer unchanged content solely from `libraryId`. A catalog can change under the same ID.

The example's preset/library controls reload the page (`index.html:447`), recreating the assistant. Other hosts can have different lifecycles. A mid-turn library replacement must end/restart the turn through the assistant's existing abort lifecycle; it must not rewrite reference content halfway through the agent loop. Between turns, a changed reference replaces the separately held reference block, while successful conversation records remain chronological. Its old cache prefix is intentionally no longer reusable after the changed content.

### 6.3 Deterministic content

Use the existing compact representations and image-URL removal. Keep fixed section ordering; put content that changes least often before library-specific content. Preserve the source text of a skill. Do not insert fetch timestamps, a plan ID, an API key, latency numbers or a random session identifier into the reference.

Check independent library loads for stable ordering. `createLibraryContext` iterates maps, and attribute compaction chooses the first owner of a shared selection list. If load order changes the serialization, normalize the relevant unordered collections before compaction. Do not recursively sort every array: roots, docking relations, coordinates and preference order can carry meaning. Keep `sameSelectionsAs` references valid.

Successful history remains append-only. Never reorder historical tool calls or remove a call's identifier to chase cache hits. Keep diagnostic measurements outside the model-visible reference.

### 6.4 Make loading instructions agree with preloading

The system and tool descriptions should say, in effect: **use reference material already supplied; fetch missing files or sections with the existing tools; read current plan state before a change.** They must continue to work for a host with no preloaded reference.

With articles and attributes supplied, teach the assistant to request live state using:

```json
{"include":["rooms","groups","obstacles","installationElements"]}
```

Keep the public default `get-plan-context` result intact, as ADR 0013 requires. If the agent still requests the default, return it truthfully and record the duplication; do not silently strip requested sections in the host. The tools remain the authority for live state and validation.

Update the system/image prompt, the `get-authoring-rules` and `get-skill` loading instructions, and the image skill's instruction to fetch a room skill when it is already present. Do not remove the skills' actual constraints or their session adaptations to save tokens.

### 6.5 Azure controls are a separate, measured layer

The portable reference layout comes first. Keep existing reasoning effort and endpoint/API selection unchanged during comparisons.

For an explicitly supported Azure GPT deployment, a stable `providerOptions.azure.promptCacheKey` can identify the reference cohort. Derive it from the actual reference/tool revision and the authorized configuration scope; do not use an API key, user prompt, or random conversation ID. A digest belongs in request options and diagnostic records, not at the very start of the model text where a library update would also destroy reuse of preceding generic guidance. No new user-facing cache setting is needed for the basic layout.

For deployments that support it, test an explicit breakpoint at the end of the shared reference **while retaining implicit caching for growing conversation history**. The pinned adapter supports this. Explicit-only caching would require intentional later boundaries as well; otherwise it can discard the benefit of repeated tool history. Do not enable it as a universal default. Do not add legacy extended-retention parameters to newer models blindly.

Verify capability for the actual Azure deployment and pricing tier. A deployment name is user-configurable and is not a reliable model-family capability flag. Unsupported configurations retain automatic caching with the ordinary request shape. No keep-alive or paid warm-up service is proposed.

## 7. Measurement contract

Extend the current one-record-per-turn protocol rather than introducing a second competing total. Retain:

| Measurement | Meaning |
|---|---|
| input/output/total tokens | Existing totals; preserve their current semantics |
| cache-read tokens | Provider-reported reuse, a subset of input |
| cache-write tokens | Provider-reported writes where available |
| noncached input | The adapter's measured category, with its provider-specific meaning |
| cache-detail coverage | Whether the raw provider actually reported the categories; distinguish unknown from zero |
| per-model-call usage and elapsed time | Separates the first request from later tool/history requests |
| response-start latency | Request start to first received model stream event; distinguish first visible text |
| reference bytes/digest, request-body bytes | Verifies identity and transport size without logging private contents |
| reference acquisition, tools and whole-turn time | Prevents attributing local work or tool execution to model prefill |

Use `inputTokenDetails` from the pinned AI SDK and inspect raw field presence where normalization hides missing values. Keep cache-detail coverage independent of total-token coverage: a complete total can coexist with unavailable cache-write data. An interrupted call can provide partial usage; a missing count is not zero.

Aggregate completed step measurements **or** the final aggregate once. Never add both. Cache reads/writes and reasoning are already contained in the associated totals; do not add them to total tokens again. The example collector, facts extractor and report must retain the added fields rather than whitelist them away.

Report at least:

```text
cache read share = sum(known cache-read tokens) / sum(input tokens of those calls)
non-read input   = input tokens - cache-read tokens
```

`non-read input` is not necessarily the uncached billing category: it can include cache writes. For the inspected adapter, the categories are total input minus read minus write, read, and write. A cost estimate must apply the actual Azure tariff to those categories, including its write-charge semantics, and include output/reasoning costs correctly. No currency saving can be established from total input alone.

Do not label response-start latency as pure prefill time: networking, queueing and other provider work are included. Similarly, a model step can overlap tool execution; the old benchmark's assumption that the longest tool represents parallel tool time does not describe today's serialized planner tool queue. Record actual boundaries and avoid subtracting overlapping durations twice.

## 8. Scope by file

These are anticipated implementation locations, not files changed by this analysis. The optional rows apply only if the corresponding candidate is selected after measurement.

### roomle-ui

| Location | Proposed responsibility |
|---|---|
| `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` | Reference assembly order, per-turn library acquisition, preserved history, cache usage/timing, supported provider options; extend its prompt response type for an optional skill/rule reference |
| `packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts` | Explain supplied reference versus missing material and live state; type the optional reference |
| `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts` | Share authoring rules/session adaptation with the reference builder; align fetching descriptions; retain tool defaults and results |
| `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills.ts` | Source the named skill files for the preload candidate; retain the existing registry as the only source |
| `packages/web-sdk/packages/planner-core/src/roomle-planner.ts` | For skill preload, enrich the existing prompts response through the lazy tool module |
| `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills/image-planning/SKILL.md` | Use the supplied room skill/reference where present, fetch otherwise |
| `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts`, `agent-facing.ts`, `hi-library-context.ts` | Reuse their projections; change only if deterministic-order tests reveal a real ordering defect |
| `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` | Regenerate expected descriptions if served text changes |
| `package.json` and the npm lockfile, if needed by adapter tests | Pin the same Azure adapter as a development test dependency; it is CDN-loaded in production and is not installed in the inspected checkout |
| `.agents/homag-intelligence/agent-architecture.md` | Document reference lifecycle, request ordering and the measured usage protocol |
| `.agents/homag-intelligence/hi-tools-behaviour.md`, `hi-tools-reference.md`, `tool-executors.md` | Document preloaded versus on-demand information and preserved live-state behavior; record the deliberate extension of the on-demand-skills decision |
| `packages/embedding-lib/docs/planning-assistant-embedding.md` | Document any public configuration or optional prompt/reference contract that an embedding consumer needs |

`hi-mcp-tools.ts` should continue forwarding faithfully. No provider cache logic belongs in tool commands, the UI store, `glue-logic.ts`, library calculations or RoomleCore. A new helper file is justified only if the shared reference assembly needs one cohesive home; do not introduce a generic caching framework.

### roomle-hi-example

| Location | Proposed responsibility |
|---|---|
| `minimal-hi-example/index.html` | Advance both embedding-lib imports after an authorized release; retain the existing forwarding/instrumentation; adjust readiness only if the chosen contract requires it |
| `minimal-hi-example/start.mjs` | Only if needed, pass explicitly configured deployment capabilities; no guessing from arbitrary deployment names |
| `.agents/scripts/planning-assistant-usage.js` | Validate and preserve cache details and coverage |
| `.agents/scripts/run-hi-mcp-prompt.js` | Capture per-call/reference measurements and write them to run artifacts |
| `.agents/scripts/extract-run-facts.js`, `build-test-report.js` | Carry and display the new measurements without changing existing totals |
| `.agents/scripts/benchmark-hi-mcp-runs.js` | Support current assistant measurements; keep legacy-run compatibility with unavailable fields clearly marked |
| `.agents/context/pages-chat-and-launcher.md`, `deployment-and-testing.md` | Describe the updated configuration, lifecycle and measurement schema |
| `docs/ai-chat.md`, `docs/test-prompts.md` | Explain observable behavior and how to read cache measurements |
| `.agents/skills/hi-mcp-benchmarking.md` | Replace the obsolete statement that current runs have no usage information; document the new per-call/cache contract when implemented |

The example cannot enable this by rearranging launcher JSON or changing its HTML alone: the loop is delivered by the embedding-lib, and rules/skills come from the planner. Deploy both compatible pieces. An embedding-lib build/publish is a separate, explicitly authorized action under this repository's rules.

## 9. Tests and observable changes

Existing coverage provides the starting points:

- `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts`: provider options, setup, one tool set across turns, retained successful history, failed-turn omission, aggregate/partial/unavailable usage.
- `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts`: the real pinned AI SDK with a mock model, tool schemas, tool outputs, images and aggregate usage.
- `packages/web-sdk/packages/homag-intelligence/__tests__/hi-library-context-test.ts`: library sections, no plan access, copied data and template geometry.
- HI tests `hi-mcp/tool-executors-test.ts`, `hi-mcp/hi-mcp-server-test.ts`, `hi-mcp/hi-mcp-fixture-test.ts`, `hi-mcp/skills-test.ts`, and `hi-agent-prompts-test.ts`: projections, served rules, fixtures and skill behavior.
- `packages/web-sdk/packages/planner-core/__tests__/roomle-planner.ts`: planner agent-method contracts.
- Example tests `.agents/scripts/tests/planning-assistant-usage.test.js`, `report-scripts.test.js` and `suite-runner.test.js`: collection, incomplete measurements and reports.

Required additional cases:

| Case | What it establishes |
|---|---|
| Two fresh conversations with different first user texts/images | Identical reference/tool prefix through the intended boundary |
| Several model steps and a second user turn | Reference appears once in the logical context; existing messages remain unchanged and new messages append |
| Rule/skill preload | Same served texts and session adaptation, required references present, names/paths retained, no copied host catalog of skills |
| Missing preloaded file or old planner | Existing tool retrieval remains available; no false claim that material was supplied |
| Kitchen, French kitchen, living room, image | Scope and image precedence survive the bundle; all skills are not applied at once |
| Plan edit, undo and fitting change | Library prefix remains stable; live groups/options reflect the actual plan |
| Library/catalog/language change and different load order | Correct new reference, deterministic representation where semantically equivalent, valid shared-selection references |
| Library not ready, failed read, mid-turn host reload | No frozen empty/error reference; existing error/abort lifecycle remains coherent |
| Adapter with fake HTTP for Responses and Chat Completions | Actual serialized instruction/reference ordering, stable tools including the final step, keys/breakpoints only when enabled |
| Usage with read/write counts, missing raw fields, zero, interruption | Counts are retained once; unknown stays unknown; total-token coverage remains independent |
| Report on mixed old/new runs | No fabricated cache rate, no double count, old runs still readable |

The provider-wire test should use the pinned adapter and intercepted HTTP, not only an assertion on the `streamText` options. Unit tests prove input layout and bookkeeping; they cannot prove Azure routing or cache hits.

Expected changes are earlier reference availability, fewer redundant reference reads where the model follows the supplied instructions, larger first requests, and additional diagnostic/report fields. Existing tool output schemas, plan correctness, undo semantics and the final answer's factual standards remain requirements. Changes in tool-call counts and chosen plans must be evaluated, not assumed harmless because the code change is called a refactoring.

## 10. Before/after benchmark

### 10.1 Variants

| Variant | Shared reference before the user |
|---|---|
| A — measured baseline | Current instructions and tool definitions; existing on-demand reads |
| B — library and rules | Compact articles, derived attribute vocabulary and common authoring rules |
| C — operational skills | B plus the fixed, scoped operational skill bundle, including required planning references |
| D — all data | Comparison only: full agent-facing master data without duplicated vocabulary, full article descriptions and all skill files |

Compare B/C/D against the **same instrumented baseline**, not against uninstrumented older logs. Compare provider cache options separately after selecting the content layout; changing both at once obscures the cause.

### 10.2 Cases

Use the existing `full-kitchen-walnut-marble-corner`, `image-kitchen-left-wall`, `image-only-no-text`, `kitchen-conversation` and `edit-add-move-delete-subarticle` cases. Add a read-only price/description request that does not need the whole reference. Include a French-kitchen and a living-room case for skill-scope correctness.

For each candidate and the same Azure deployment:

1. Measure its first request and record the **observed** cache state. A new browser is not proof of a cold provider cache.
2. Start another fresh conversation promptly with a **different first user request**, the same library and the same shared-prefix identity. This isolates reuse across conversations; repeating the exact same prompt would overstate what moving reference data achieves.
3. Continue a conversation through tool results and another user turn to measure growing-history reuse.
4. Repeat with changed live plan state, then changed library content/language. The former should preserve the reference; the latter must update it.
5. Collect at least two valid runs per case/configuration as the repository minimum; use more repeats before asserting small latency differences. Report every run, median and spread, and classify failed turns separately.

Keep model/deployment, endpoint/API, reasoning effort, library revision, plan snapshot, image bytes, planner build, embedding-lib version, browser and request cadence fixed where the case permits. Record deployment tier and cache-option capability. Do not distribute one cohort across different Azure resources and then interpret misses as a prompt-layout defect.

Record startup/reference acquisition separately from chat time. Compare cached input, writes, non-read input, output/reasoning, model-call count, reference-tool calls, actual request bytes, response-start latency, full-turn duration and plan correctness. For small samples report the sample distribution rather than a persuasive-looking p95.

### 10.3 Adoption criteria

- Fresh conversations with different user requests demonstrably reuse more of the intended reference than A, with provider-reported data.
- Quality checks show correct library selection, scope, fresh plan reads and no skill-precedence regression.
- The realistic mixture of planning, editing and simple requests has lower measured cost and/or useful latency improvement; cold-start and simple-request regressions are shown explicitly.
- C is preferred over B only if its avoided reads/model work justify the added skill input. D is adopted only if its additional information has demonstrated value.
- No claim is made that transmitted bytes fell merely because cache reads rose. First-request bytes may increase.

The existing runner can supply the cases, but the new cache/per-call recording and benchmark parsing are prerequisites. Store comparison artifacts under `.temp/result/` and publish the interpreted benchmark under `.agents/benchmarks/` when the experiment is performed.

No paid model runs, embedding-lib builds or deployments are performed by this analysis. There is no measured saving to report yet.

## 11. Alternatives and boundaries

| Alternative | Assessment for this task |
|---|---|
| Reorder fields in the current `get-plan-context` response | Too late: preceding user/tool-call content already differs |
| Only add `promptCacheKey` | Useful routing control on supported deployments, but does not move shared data ahead of variable messages |
| Preload raw JSON files and every skill without scopes | Large redundant context, ambiguous applicable guidance, and stale data risk; use the planner's projections and a named bundle |
| Preload only the chosen skill by interpreting every request first | Splits prefixes and can add a routing step; compare stable configured bundles before adding such a mechanism |
| Remove all on-demand tools | Breaks custom hosts and uncommon detail requests; the prefix is an optimization, not the only access path |
| Strip old results or rewrite history on every step | Changes conversational semantics and destroys growing-prefix reuse; out of scope |
| Keep-alive requests | Additional paid traffic with no measured need; not proposed |
| Store a provider conversation and send only new input | Separate transport/state work; not a substitute for this prefix analysis |
| Memoize all reads | Live plan reads would become stale; tool memoization is a separate ticket idea |
| RAG, indexing or new docking precalculation | Separate investigations; not required to assemble a shared prefix |

The architectural outcome to pursue is a **planner-owned, compact, deterministic reference before all conversation-specific content**, with evidence showing which parts deserve to be there. The user's invariant articles/master data/skills make that feasible; relevance, freshness and measured total cost determine how large that reference should be.

## 12. Implementation record — 2026-10-26

The sections above record the investigation before implementation. The approved plan was posted
on the Jira ticket; its implementation is committed locally on roomle-ui
`feat/hi-mcp-performance` and roomle-hi-example `docs/planning-assistant-prompt-caching`. No push,
package publication or pull request is part of this execution.

### Selected behavior and reasons

The selected common prefix contains system instructions, common authoring rules and the compact
article/attribute projection, followed by genuine successful history and current text/images.
Library descriptions use a labelled user-role data message. The planner supplies rules from their
existing source, and the host calls the existing library-context projection once per user turn.
This avoids another invalidation lifecycle; unavailable or malformed reference falls back to
ordinary tools and is retried on the next turn. Live plan data remains outside the common prefix.

The all-operational-skills candidate was implemented and measured, then removed from the final
default. Against the smaller prefix it used 4.8% more input and 35.4% more request bytes across the
eight-case cohort; fewer model calls did not produce a consistent overall benefit. The approved
plan calls for the simpler layout when the larger bundle is inconclusive. Skills and their
references therefore remain on demand. Raw master data is not appended beside the derived
vocabulary, and no all-raw paid experiment is justified.

The separate Azure policy check establishes that placement alone does not consistently cache the
entire common library. The optional `referenceCacheBreakpoint` marks its end and adds a
digest-derived key only for verified Azure Responses deployments. It preserves implicit history
caching and default lifetime. Direct probes verify both configured GPT-6 deployments; the example
enables the capability for them. Arbitrary Azure deployment names, Chat Completions and other
providers retain their defaults. A real-request key-length defect was corrected to use the
64-character SHA-256 alone, with a regression test and the failed attempts retained.

The first different image request on the corrected implementation reports 74,806 cached tokens
and 2,384 writes, compared with 13,386 / 63,804 without the boundary, at the same 77,193 input
tokens. This is evidence of cross-prompt reference reuse, not a claim of fewer uploaded bytes or
universal cost savings. Simple edits have a substantial input penalty from the unconditional
library prefix. Full measurements and quality limitations are in the
[benchmark](../benchmarks/planning-assistant-prompt-caching.md).

### Changed implementation and durable documentation

| Repository / area | Outcome |
|---|---|
| roomle-ui embedding-lib `hi-planning-assistant.ts` | Reference acquisition/assembly, optional verified cache boundary, preserved history and fallback behavior |
| roomle-ui embedding-lib `hi-planning-usage.ts` | Independent cache/reasoning coverage, per-call timing, request/reference bytes and digests; no prompt or credential logging |
| roomle-ui HI prompts/server and planner API | Optional planner-owned reference blocks, common-rule source equality, conditional reference retrieval and fresh live-state instructions |
| roomle-ui tests and package files | Prefix/history/fallback tests, pinned Azure adapter wire tests, key-length regression; Azure adapter is development-only |
| roomle-hi-example runner/report/benchmark scripts | Retain diagnostics, current per-call benchmarks, coverage-aware reports, test-only request pacing and runtime provenance |
| roomle-hi-example launcher and prompt expectations | Verified deployment capability, image expectations accept supplied guidance or tool retrieval; model lists and user prompts stay unchanged |

The implementation's permanent home is roomle-ui's
[prompt-caching reference](https://github.com/roomle-dev/roomle-ui/blob/feat/hi-mcp-performance/.agents/homag-intelligence/prompt-caching.md)
and [ADR 0014](https://github.com/roomle-dev/roomle-ui/blob/feat/hi-mcp-performance/.agents/decisions/the-planning-assistant-uses-a-shared-reference-prefix.md),
with architecture/behavior/tool/embedding documentation updated beside the code. Example-side
ownership and test measurement are documented in
[pages/chat/launcher](../context/pages-chat-and-launcher.md) and
[deployment/testing](../context/deployment-and-testing.md). The
[local setup guide](../../docs/setup/unreleased-embedding-lib.md) documents both embedding imports
and the local planner. Branch links are not remotely available until a later authorized push.

### Verification and limitations

- The final embedding-loop, usage and real Azure-adapter suites pass: 33 tests. The key-length
  regression first fails at 77 characters and passes at 64. The existing real-SDK tool-loop checks
  also pass during implementation.
- The selected SDK prompt/server/fixture/skill suites pass: 118 tests. Earlier broader affected
  SDK coverage passes 359 tests with one existing skip; these sets overlap and are not added.
- UI, SDK and embedding type checks and code lint pass. The local embedding production build
  passes. No published dev package is required for source-based validation.
- The example's 57 script tests and three launcher tests pass. Documentation links resolve.
- Full `npm run lint` does not pass: UI TypeDoc warnings fail its documentation stage, and the
  SDK documentation stage reports existing Bun WebGPU/`image-renderer.ts` type errors. The same
  diagnostics were reproduced on the telemetry-only baseline; they are outside this change.
- A/B/C comprise 24 completed case runs / 36 turns. The unpaced pilot's rate-limit/transport
  failures and the four rejected-key requests remain retained and excluded from success means.
  Twenty-second benchmark pacing prevents production-latency claims. Deployment tariff and exact
  ARM SKU are unavailable; no currency-saving figure is asserted.

The corrected boundary check completes all four cases / six turns and verifies 74,806 common
cached tokens across different prompts and images. The final **minimum** MCP suite uses
`gpt-6-astra` and `$AZURE_GPT_KEY`, per the user's correction: **6 pass, 4 partial, 0 fail** across
ten selected cases / twelve turns. Partial results concern existing water-connection metadata and
image/library limitations. No new prefix, history or cache-control defect is identified. Three
earlier attempts fail from Azure rate limiting; their partial usage and artifacts remain retained.
The comparative benchmarks retain `gpt-6.1-sol` and `$AZURE_GPT_SOL_KEY`.

The illustrated report is `.temp/result/mcp-test-2026-10-26_11-51-16/report.md`, with PDF
`.temp/reports/mcp-test-minimum-2026-10-26_gpt-6-astra.pdf`. The
[retained benchmark and evaluation](../benchmarks/planning-assistant-prompt-caching/README.md)
record all cohorts, source commits, failed attempts, selected snapshot IDs and quality findings.
Selected Astra usage is 7,861,901 input and 21,206 output tokens with complete coverage; preserved
failed attempts have another 954,629 known input and 1,798 output tokens plus unknown failed-request
usage. Monetary and universal latency savings remain unproven.

Runtime validation uses UI `1c3cbd6be7d84b67709a5acc0e600f7725b2edd7` and example
`6e041409ee3476c5858300b55f41d5d2aad62073`. UI `f2662f7c4` is type-only formatting and
`387b45a71` completes the architecture timeline/documentation. Both temporary embedding imports
are restored to the checked-in CDN version. Build artifacts and raw test captures remain ignored;
no dev package is published and no changes are pushed.

This analysis is retained on the unmerged branches. The durable reference and decisions are
promoted; deletion waits until the implementation reaches the default branch, as required by
the repository's closeout workflow.
