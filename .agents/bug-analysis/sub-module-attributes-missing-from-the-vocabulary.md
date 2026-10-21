# Bug analysis — the plan context hides attributes of the library from the agent

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-21
> **Base**: roomle-hi-example `master` (`d2df9cb`); roomle-ui `release/bo-test` (`0e74c54fa`) — the
> planner at the example's default server URL, which serves the HI tool set (ADR 0012)

## Affected repositories

- **roomle-ui** — the fix: `compactMasterData` keeps every attribute of the library and names
  every module that carries one (`packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts`);
  a root of a group lists its sub modules with their input attributes (`shapeRoot`, same file);
  `find-attributes` searches every attribute and names the sub modules that carry a match
  (`hi-mcp/tool-executors.ts`); the served text that says "customer-facing"
  (`hi-mcp/hi-mcp-server.ts`); the tests of the compaction and of the two tools.
- **roomle-hi-example** — the living reference that describes the vocabulary as the
  customer-facing, root-assigned attributes: D48, D76 and the `find-attributes` section of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md),
  [`docs/hi-mcp-server.md`](../../docs/hi-mcp-server.md) (lines 209-214, 254-259),
  [`.agents/skills/hi-mcp-tools.md`](../skills/hi-mcp-tools.md) (lines 72, 412) and
  [`.agents/context/tool-executors.md`](../context/tool-executors.md) (line 97). No code change:
  the page forwards the planner's tools.
- **The library (HOMAG Furniture_Smith)** — no change. `mod_SinkId` is in the master data with
  its twelve values and their descs (section 2.8 of
  [`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md),
  applied).
- **ligna-store** — no change: it gets the tool set from the same planner.
- **embedding-lib** — no new version: the forwarding of `createHiMcpTools` does not change.

## Symptom

`npm start gpt-6-astra $AZURE_GPT_KEY`, the chat asked:

- "what are the option values for mod_FrontColor" — the agent lists the 21 values with their
  names and colour codes.
- "what are the option values for mod_SinkId" — the agent answers that `mod_SinkId` was not found
  in the loaded catalog's attribute vocabulary, and that a search for "sink" found no
  sink-selection attribute either (`.temp/Screenshot 2026-10-21 at 19.49.50.png`).

The answer is right about what the tools served and wrong about the library: Furniture_Smith has
`mod_SinkId` (Article code of the sink, a dropdown of twelve sinks,
`docs/library-information/master-data.json:11522`), and the sink base units of the article list
set it on their sink (`docs/library-information/article.json:292`, `Axia_Grey_L`).

Reproduce without a model: `compactMasterData` of roomle-ui on the stored master data
(`docs/library-information/master-data.json`), in a scratch vitest beside
`__tests__/hi-plan-context-test.ts`, returns 73 of the library's 398 attributes: `mod_FrontColor`
is among them, `mod_SinkId` and `mod_HobId` are not, and no module `mf_Sink`.

## Investigation trace

1. **The attribute is a sub module's.** The master data assigns `mod_SinkId` to one module only:
   `mf_Sink` (`moduleType: SubModule`, group `Appliance`, `master-data.json:937-950`), together
   with `mod_SinkSupplier`, `mod_MixerId`, `mod_MixerSupplier`, `mod_SinkMoveDepth` and
   `mod_SinkMoveWidth`. `mod_FrontColor` is assigned to the root modules of the units (and to their
   fronts).
2. **The planner filters the master data twice.** `getPlanContext` returns the `masterData`
   section through `compactMasterData` (`hi-plan-context.ts:1045-1052`). It keeps the root modules
   and the generated roots (`isRootModule`, `isGeneratedRootModule` — a sub module of the group
   `Root`, `hi-plan-context.ts:249-256`), and of the attributes only those these modules carry and
   that are customer-facing (`isMain` or `userRight: Simple`) or Bool
   (`hi-plan-context.ts:261-263, 279-290`):

   ```ts
   const assignedAttributeIds = new Set<string>(
     rootModules.flatMap((module) => module.assignedAttributes ?? []),
   );
   const attributes = (masterData?.attributes ?? []).filter(
     (attribute) =>
       assignedAttributeIds.has(attribute.id) &&
       (isCustomerFacingAttribute(attribute) || attribute.type === MDType.Bool),
   );
   ```

   `mf_Sink` is no root module, so `mod_SinkId` is dropped. The second filter drops every
   attribute a root module carries with the user right `Advanced` or `Master` that is not main and
   not Bool.
3. **The vocabulary is that filtered list.** `get-plan-context` builds its `attributes` section
   from the compacted master data (`hi-mcp/tool-executors.ts:470-471`, `agentFacingAttributes`,
   `hi-mcp/agent-facing.ts:223-231`). `mod_FrontColor` is there, `mod_SinkId` is not.
4. **`find-attributes` searches the same list.** It requests the `masterData` section and matches
   only its attributes (`hi-mcp/tool-executors.ts:479-531`; the comment at line 504: "The master
   data arrives compacted: root modules and their customer-facing or Bool attributes"). The
   agent's search for "sink" cannot find `mod_SinkId`.
5. **The plan's groups hide the values of sub modules.** The catalog lists a root module's sub
   modules with `id`, `name`, `desc` and `imageUrl` (`hi-plan-context.ts:665-670`), a root of a
   group its sub modules with `id` and `imageUrl` (`hi-plan-context.ts:716-719`) — without their
   attributes. The agent cannot tell which sink a unit in the plan has.
6. **The group settings come without their definitions.** `groupSettings` lists the attribute ids
   of the group orchestrator (`hi-plan-context.ts:306-308`); their values and descs are not in the
   vocabulary unless they pass the filters.
7. **The served text says nothing is filtered.** The rules say "Attribute ids and their values
   are in the attributes section of get-plan-context - every customer-facing attribute with its
   values" (`hi-mcp/hi-mcp-server.ts:19`), the description of `get-plan-context` "per library every
   customer-facing attribute" (line 328), and `change-module-attribute` takes a sub module by its
   id in `subModules`, with "attribute ids and values are in the attributes section of
   get-plan-context" (lines 580-585).
8. **The edit side has every attribute.** `changeModuleAttribute`, `changeGroupAttribute` and
   `changeAttributes` read the full master data of the library
   (`hi-tools.ts:467-468, 525-526, 560-561`) and set the attribute on every module of a root that
   carries it (`_attributeTargets`, `collectModulesWithAttribute`, `hi-tools.ts:1352-1378`).
   `change-module-attribute` with the root module of a sink unit, `mod_SinkId` and a value reaches
   `mf_Sink` (from the code; not run live). The tools set what the agent is not allowed to see.

The filters are as old as the compaction itself (roomle-hi-example `9c4a537a`, the server of the
time): its comment said "Everything else stays reachable through find-attributes", because
`find-attributes` searched the full master data then. Since `find-attributes` searches the
compacted master data (D48, D76), the filtered attributes reach the agent nowhere.

## Root cause

`compactMasterData` decides which attributes of the library the agent may know (roomle-ui
`packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts:283-290`): only those a root
module or a generated root carries, and of these only the customer-facing and the Bool ones. Every
other attribute — `mod_SinkId` of the sub module `mf_Sink` among them — is dropped with its values
from both the `attributes` section of `get-plan-context` and `find-attributes`, which read the
compacted master data, and no result says that anything was dropped.

## Why the current code produces wrong results

The agent needs every attribute of the library: the user may ask for any of them — a sink, a hob,
an oven, a drawer type, a position of a fitting — and the tools set any attribute a module carries.
The server cannot know which attribute a user will ask for, and it must not decide it silently. The
vocabulary is the only place the agent learns an attribute's id and its values; an attribute that is
not there does not exist for the agent. It answers that the library has no such attribute, and it
cannot set it although the planner could.

The filters hide 325 of the 398 attributes of Furniture_Smith. The rule is library-neutral; any
library loses its sub module attributes and the attributes of its `Advanced` and `Master` user
rights the same way.

## Proposed fix

No attribute of the library is hidden from the agent.

1. **`compactMasterData` keeps every attribute of the library** with its values, compacted to the
   fields of `compactAttribute` as today. The filter on the carrying module and on the user right
   goes; `isCustomerFacingAttribute` is unused afterwards and goes with it.
2. **The compacted master data names every module that carries an attribute.** `modules` stays
   the list of the root modules, generated roots included, each with all its attributes. A new
   `subModules` lists every other module of the master data — the sub modules, the group
   orchestrator —, each `{ id, name, desc, imageUrl, attributes }`. `groupSettings` stays.
3. **The vocabulary lists every attribute.** The `attributes` section of `get-plan-context` is
   the compacted list, a value list several attributes share listed once (`sameSelectionsAs`,
   unchanged).
4. **`find-attributes` searches every attribute and names its carriers.** Beside `rootModules`, a
   match carries `subModules: [{ id, name }]` — `mod_SinkId` names `mf_Sink` (Sink). The catalog
   lists `mf_Sink` among the `subModules` of the sink base units, so the agent finds the articles,
   and `change-module-attribute` sets the value on their root modules (or with
   `moduleId: 'mf_Sink'`).
5. **A root of a group shows the attributes of its sub modules.** `shapeRoot` lists every sub
   module with its input attributes, `{ id, imageUrl, attributes: [{ id, value }] }`, as it lists
   those of the root (`isInput`). The agent sees which sink a unit has.
6. **The served text says "every attribute".** The rules (`hi-mcp-server.ts:19`) and the
   description of `get-plan-context` (line 328): every attribute of the library with its values,
   instead of every customer-facing attribute; the description of `find-attributes` (lines
   378-381): the root modules and the sub modules that carry them; the groups in the description of
   `get-plan-context`: the sub modules of a root with their input attributes.
7. **Tests** (roomle-ui), the changed expectations an approved change of behaviour:
   - `__tests__/hi-plan-context-test.ts`: `it('should keep only the modules of group roots and
     their customer-facing attributes')` becomes "keeps every attribute of the library and names
     the modules that carry them" — `attr-assigned-not-facing` and `attr-facing-not-assigned` are
     in `attributes`, `sub-b` and `orchestrator-e` in `subModules`;
     `it('keeps unassigned and submodule-only Bools out of the vocabulary')` becomes the opposite:
     both Bools are in the vocabulary; a new test for an `isMain` attribute only a sub module
     carries — the case of `mod_SinkId`; `shapeRoot` lists the input attributes of a sub module.
   - `__tests__/hi-mcp/tool-executors-test.ts`: `get-plan-context` lists an attribute only a sub
     module carries in its `attributes` section; `find-attributes` matches it by a word of its
     desc and names the sub module in `subModules` (beside `it('lists the attributes the root
     modules in the plan carry first, and names the root modules')`).
   - `__tests__/hi-mcp/hi-mcp-server-test.ts`: the served text says every attribute of the library
     is in the `attributes` section.
8. **Documentation** (roomle-hi-example): D48 and D76 of `docs/hi-mcp-behaviour.md` — D76 rejects
   "every attribute assigned to a root module"; the new decision (user, 2026-10-21) is that no
   attribute of the library is hidden from the agent, and the rejection goes. The
   `find-attributes` section (lines 725-742), `docs/hi-mcp-server.md`,
   `.agents/skills/hi-mcp-tools.md` and `.agents/context/tool-executors.md`, where they describe
   the vocabulary as the customer-facing, root-assigned attributes.
