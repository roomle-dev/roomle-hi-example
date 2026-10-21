# Bug analysis — the attributes of sub modules are missing from the attribute vocabulary

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-21
> **Base**: roomle-hi-example `master` (`d2df9cb`); roomle-ui `release/bo-test` (`0e74c54fa`) — the
> planner at the example's default server URL, which serves the HI tool set (ADR 0012)

## Affected repositories

- **roomle-ui** — the fix: `compactMasterData` keeps the customer-facing attributes a sub module
  carries and names the sub modules that carry them
  (`packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts`); `find-attributes` names
  those sub modules in its matches (`hi-mcp/tool-executors.ts`); one phrase in the description of
  `find-attributes` (`hi-mcp/hi-mcp-server.ts`); the tests beside the existing vocabulary tests.
- **roomle-hi-example** — the living reference that describes the vocabulary as root-assigned:
  D48, D76 and the `find-attributes` section of
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
`mod_SinkId` (Article code of the sink, `isMain: true`, `userRight: Simple`, a dropdown of twelve
sinks, `docs/library-information/master-data.json:11522`), and the sink base units of the article
list set it on their sink (`docs/library-information/article.json:292`, `Axia_Grey_L`).

Reproduce without a model: `compactMasterData` of roomle-ui on the stored master data
(`docs/library-information/master-data.json`), in a scratch vitest beside
`__tests__/hi-plan-context-test.ts`, returns 73 attributes: `mod_FrontColor` is among them,
`mod_SinkId` and `mod_HobId` are not, and no module `mf_Sink`.

## Investigation trace

1. **The attribute is a sub module's.** The master data assigns `mod_SinkId` to one module only:
   `mf_Sink` (`moduleType: SubModule`, group `Appliance`, `master-data.json:937-950`), together
   with `mod_SinkSupplier`, `mod_MixerId`, `mod_MixerSupplier`, `mod_SinkMoveDepth` and
   `mod_SinkMoveWidth`. `mod_FrontColor` is assigned to the root modules of the units (and to their
   fronts).
2. **The planner compacts the master data to the root modules.** `getPlanContext` returns the
   `masterData` section through `compactMasterData`
   (`hi-plan-context.ts:1045-1052`). It keeps the root modules and the generated roots
   (`isRootModule`, `isGeneratedRootModule` — a sub module of the group `Root`,
   `hi-plan-context.ts:249-256`) and only the attributes these modules carry
   (`hi-plan-context.ts:279-290`):

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

   `mf_Sink` is neither, so `mod_SinkId` is dropped although it is customer-facing.
3. **The vocabulary is that compacted list.** `get-plan-context` builds its `attributes` section
   from the compacted master data (`hi-mcp/tool-executors.ts:470-471`, `agentFacingAttributes`,
   `hi-mcp/agent-facing.ts:223-231`). `mod_FrontColor` is there, `mod_SinkId` is not.
4. **`find-attributes` searches the same list.** It requests the `masterData` section and matches
   only its attributes (`hi-mcp/tool-executors.ts:479-531`; the comment at line 504: "The master
   data arrives compacted: root modules and their customer-facing or Bool attributes"). The
   agent's search for "sink" cannot find `mod_SinkId`.
5. **Nothing else in the plan context carries it.** The catalog lists a root module's sub modules
   with `id`, `name`, `desc` and `imageUrl` (`hi-plan-context.ts:665-670`), a root of a group its
   sub modules with `id` and `imageUrl` (`hi-plan-context.ts:716-719`) — no attributes.
6. **The served text promises the attribute.** The rules say "Attribute ids and their values are
   in the attributes section of get-plan-context - every customer-facing attribute with its
   values" (`hi-mcp/hi-mcp-server.ts:19`), the description of `get-plan-context` "per library every
   customer-facing attribute" (line 328), and `change-module-attribute` takes a sub module by its
   id in `subModules`, with "attribute ids and values are in the attributes section of
   get-plan-context" (lines 580-585).
7. **The edit side has the attribute.** `changeModuleAttribute`, `changeGroupAttribute` and
   `changeAttributes` read the full master data of the library
   (`hi-tools.ts:467-468, 525-526, 560-561`) and set the attribute on every module of a root that
   carries it (`_attributeTargets`, `collectModulesWithAttribute`, `hi-tools.ts:1352-1378`).
   `change-module-attribute` with the root module of a sink unit, `mod_SinkId` and a value reaches
   `mf_Sink` (from the code; not run live). The agent lacks only the id and the values.

The root-only compaction is as old as the compaction itself (roomle-hi-example `9c4a537a`, the
server of the time): its comment said "Everything else stays reachable through find-attributes",
because `find-attributes` searched the full master data then. Since `find-attributes` searches the
compacted master data (D48, D76), nothing reaches the attributes of sub modules.

## Root cause

`compactMasterData` keeps only the attributes assigned to root modules and generated roots
(roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts:283-290`). The
customer-facing attributes the library assigns to a sub module — `mod_SinkId` of `mf_Sink` — are
dropped, and with them their values, from both the `attributes` section of `get-plan-context` and
`find-attributes`, which both read the compacted master data.

## Why the current code produces wrong results

The library marks an attribute for the customer with `isMain` or `userRight: Simple`, whichever
module carries it. The compaction asks a second question — does a root module carry it — that the
served text does not ask: the rules and the tool descriptions say every customer-facing attribute
is in the vocabulary, and `change-module-attribute` offers to set it on a sub module. The agent
trusts the vocabulary, answers that the attribute does not exist, and cannot choose a sink, a hob,
an oven or another appliance the user asks for, although the planner can set it.

For Furniture_Smith, 42 customer-facing attributes are carried only by sub modules, all missing:

| Sub module | Attributes |
|---|---|
| `mf_Sink` | `mod_SinkId`, `mod_SinkSupplier`, `mod_MixerId`, `mod_MixerSupplier`, `mod_SinkMoveDepth`, `mod_SinkMoveWidth` |
| `mf_Hob` | `mod_HobId`, `mod_HobSupplier` |
| `mf_Oven` | `mod_OvenId1`-`3`, `mod_OvenSupplier1`-`3` |
| `mf_Fridge`, `mf_BaseunitFridge`, `mf_Dishwasher`, `me_LaundryMachine` | their `…Id` and `…Supplier` |
| `mf_Drawer`, `mf_Fliplift`, `mf_RackArea` | `mod_DrawerType`, `mod_FlipliftType`, `mod_RackAreaType` |
| the front modules (11) | `mod_FrontHeightSelection` |
| the interior fittings (`me_InnerDrawerGroup`, `me_ShelfadjMultiple01`, `me_Vertdivider01`, `me_Shelffixed01`, `me_ClothingOrganizer01`) | 15 position and layout attributes |

The rule is library-neutral; any library that puts a customer-facing attribute on a sub module
loses it the same way.

## Proposed fix

One change in the compaction, in roomle-ui; the served text then says what the tools do.

1. **`compactMasterData` keeps the customer-facing attributes of sub modules.** An attribute stays
   when it is customer-facing (`isCustomerFacingAttribute`: `isMain` or `userRight: Simple`) and a
   root module, a generated root or a sub module carries it; a Bool that is not customer-facing
   stays only when a root or a generated root carries it (the rule the test
   `it('keeps unassigned and submodule-only Bools out of the vocabulary')` guards, unchanged).
   Unassigned attributes stay out. The result gets `subModules`: the sub modules that carry a kept
   attribute, each `{ id, name, desc, imageUrl, attributes }` like `modules`, which stays the list
   of the root modules (its shape and the existing tests unchanged).
2. **`find-attributes` names the sub modules that carry a match.** Beside `rootModules`, a match
   carries `subModules: [{ id, name }]` from the compacted `subModules` — `mod_SinkId` names
   `mf_Sink` (Sink). The catalog lists `mf_Sink` among the `subModules` of the sink base units, so
   the agent finds the articles, and `change-module-attribute` sets the value on their root modules
   (or with `moduleId: 'mf_Sink'`).
3. **The served text.** The rules (`hi-mcp-server.ts:19`) and the description of
   `get-plan-context` (line 328) need no change — they become true. The description of
   `find-attributes` (lines 378-381) says "the root modules and the sub modules that carry them"
   instead of "the root modules that carry them".
4. **Tests** (roomle-ui):
   - `__tests__/hi-plan-context-test.ts`, beside the Bool tests: `it('keeps the customer-facing
     attributes a sub module carries and names the sub module')` — a `SubModule` fixture module
     with an `isMain` and a `Simple` attribute no root carries; both are in `attributes`, the
     sub module in `subModules`; a non-customer-facing attribute of the sub module stays out.
   - `__tests__/hi-mcp/tool-executors-test.ts`: `get-plan-context` lists such an attribute in its
     `attributes` section, and `find-attributes` matches it by a word of its desc and names the
     sub module in `subModules` (beside `it('lists the attributes the root modules in the plan
     carry first, and names the root modules')`).
5. **Documentation** (roomle-hi-example): D48 and D76 and the `find-attributes` section of
   `docs/hi-mcp-behaviour.md`, `docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md` and
   `.agents/context/tool-executors.md`, where they describe the vocabulary as root-assigned.

**Cost.** For Furniture_Smith the vocabulary grows from 73 to 115 attributes, from about 25.7k to
37.8k characters without the image URLs — about 3k tokens more in every step that reads the plan
context. D76 accepted about 5k tokens per step so that a planning needs no search.

**Alternative, for the review: keep the default vocabulary as it is.** Step 1 as proposed, but the
`attributes` section of `get-plan-context` lists only the attributes a root module carries;
`find-attributes` finds the attributes of the sub modules as well. No token cost per step; a
question or a planning that sets an appliance needs one `find-attributes` call. The rules and the
description of `get-plan-context` then have to say that the section holds the attributes of the
root modules and that `find-attributes` finds those of the sub modules (the fronts and appliances).
Not recommended: the agent has to know that an attribute it does not see exists, and the served
text grows by a rule that the recommended fix does not need. The choice between the two is the
token budget of every step against one search step when it matters.

## Related, not part of this defect

- The attributes of the group orchestrator (`groupSettings`, `hi-plan-context.ts:306-308`) are
  listed by id only, without their values; five of them are `Simple` in Furniture_Smith
  (`mod_GroupGenerationLogic`, `mod_GroupWidthAdjustment` and others).
- A root of a group lists its sub modules without their attribute values
  (`hi-plan-context.ts:716-719`): after the fix the agent knows the sinks the library offers, not
  which sink a unit in the plan has.
