# Why the agent cannot plan what the library cannot build

Can the AI agent of the HI tools create a planning that cannot be produced? How far does the
library's calculation guarantee a correct result, and what happens to input it cannot use?

## Short answer

The agent never describes furniture; it only chooses. It picks articles from the library's catalog,
sets attribute values, names one neighbour for every unit and a place for the group. Everything that
makes a planning producible is calculated by the HI library in the planner, never written by the
agent: the module tree of an article, its dimensions and parts, its docking vectors, the generated
worktop and toe kick, the position of every unit, the order lines and the price.

Input that names nothing the library has does not become furniture. An article that is not in the
catalog is not built, an attribute a module does not carry is not set, and positions and calculated
fields in a payload are dropped. Every group the planner shows has gone through the library's
calculation.

The guarantee covers the structure of a planning, not every attribute value:

- **A value the library cannot calculate is kept, not discarded.** The root module stays in the plan
  without geometry, and the result tells the agent (D95).
- **Values are not checked against the library's valid options before an edit** (D99).
- **A create skips the library's conflict resolution** for the attribute values of a root module.
- **A value the library accepts can still fail to calculate**: a library bug.
- **An exception of the library's calculation** leaves the group uncalculated, and only the console
  says so.
- **Where a group stands in the room is the user's choice**: an overlap is a hint, not a refusal.

[Where the guarantee ends](#where-the-guarantee-ends) explains each.

The roomle-ui paths below are relative to `packages/web-sdk/packages/homag-intelligence/src/`, and
`hi-mcp/` is the tool set in it. The D-numbers are the decisions in §3 of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions).

## The path of a tool call

```
agent ── tool call ──▶ HI tool set (hi-mcp/)              schema check
                          │
                          ▼
                       HI tool command                     payload reduced to article picks,
                       (hi-tool-commands.ts)               article ids checked against the catalog
                          │
                          ▼
                       glue logic (glue-logic.ts)          article picks expanded from the
                          │                                library's article templates
                          │ calculateGroup ──▶ HI library calculation script
                          ▼
                       root module arrangement             positions from the calculated
                          │                                docking vectors
                          ▼
                       RoomleCore                          loads the calculated group

get-price, get-order-data ──▶ the library's getOrderData ──▶ Order Manager
```

The calculation script, the master data and the article catalog come from TecConfig at runtime
(`onLoadJavascript`, `onLoadMasterData`, `onLoadArticleCatalog`). The library's rules are not code
of roomle-ui or of this repository.

## What the agent writes

The served rule says it plainly: "A root module is an article pick and nothing else"
(roomle-ui `hi-mcp/hi-mcp-server.ts:19`). This is everything a plan-changing call can carry:

| The agent writes | What the tools do with it | roomle-ui |
|---|---|---|
| `articleId` | Looked up in the library's article catalog. An id that differs from a catalog id only in case or whitespace is read as that id; any other unknown id is not built | `catalogArticleId`, `resolveArticleIds` (`hi-tool-ids.ts:45`, `:68`) |
| `attributes` of a root, `{ id, value }` | Set as input values on the root module, or on its sub modules that carry the attribute; the library calculates with them | `_applyRootAttributeOverrides` (`glue-logic.ts:978`) |
| `attributes` of a group | Set on every root module after the load, with the planner's attribute edit, which asks the library to resolve conflicts first | `applyGroupWideAttributes` (`hi-tool-attributes.ts:392`), `modifyAttributesOfModules` (`glue-logic.ts:2907`) |
| One relation per unit: `rightOf`, `leftOf`, `onTop`, `above`, `behind` | Compiled into docking entries between the docking vectors of the calculated modules | `relationsToDocking` (`hi-group-layout.ts:265`) |
| `placement`: a wall with alignment and offset, or a point and a rotation | The position of the group as a whole | `hi-wall-placement.ts`, `hi-group-placement.ts` |

Everything else in a payload is dropped before the planner sees it:

- `toArticlePick` (`hi-tool-payload.ts:9`) rebuilds every root from its id, article id, library id,
  attribute ids and values, docking and relation. A module tree, parts, `posData` or dimensions
  written by the agent never reach the planner.
- `prepareGroup` (`hi-tool-payload.ts:704`) drops the positions of roots (`articlePos`,
  `rotationY`) and of groups (`pos`, `rotationY`) and the generated roots (worktop, toe kick), which
  the library regenerates. Each drop is named in `corrections`.
- The read-only fields of a group from `get-plan-context` (`dockingVectors`, `subModules`,
  `logMessages` and the others) are ignored (`hi-tool-payload.ts:372`, `:385`).
- The group sent to the planner keeps `id`, `libraryId`, `roots`, `repositioningData` and
  `attributes` only (`hi-tool-commands.ts:624-653`).
- No tool takes a price, an order line or a part list. `get-price` and `get-order-data` read what
  the library calculates.

## What the library calculates

- **The article.** `prepareArticlePickRoots` (`glue-logic.ts:1017`) replaces every article pick by a
  copy of the article as the library's article catalog defines it — its root modules, its sub
  modules (fronts, appliances) and its internal docking — and sets the agent's attribute values on
  it as inputs.
- **The calculation.** Every new group (`_addNewGroup`, `glue-logic.ts:2341`) and every change
  (`_runGroupCalculation`, `:2267`) goes through `calculateGroup` of the library (`_calculate`,
  `:3456`). The library computes the dimensions, the parts, the docking vectors, the generated roots
  and the attribute values that depend on others. A library with a group orchestrator also checks a
  new group (`solveInitial`, `_solveInitialNewGroup`, `:3585`).
- **Attribute edits.** Before a value is set, the library resolves its conflicts with the module's
  other values (`solveModuleAttributeConflict`, `glue-logic.ts:2919`). Every value the library
  changes beyond the one sent is named in `corrections` (`withLibraryChanges`,
  `hi-tool-attributes.ts:237`, D59).
- **Positions.** The root module arrangement places every root by the docking vectors the library
  calculated; a root without docking vectors is not docked. RoomleCore loads the calculated group as
  it is.
- **Price and order.** `getGroupDataForOrder` (`glue-logic.ts:1955`) hands the groups of the scene to
  the library's `getOrderData`, and the Order Manager prices that order.

## What happens to wrong input

| Input | Outcome | What the agent reads |
|---|---|---|
| A call that does not match the tool's schema | Nothing runs | An error result (`hi-mcp/mcp-tool.ts:40`) |
| An article id that is not in the catalog | That root is not built, the other roots of the group are; a group without a known article is not built | `notLoaded` with the valid ids; an error when nothing in the call can be built |
| A position, a generated root, a calculated field | Dropped | `corrections` |
| An attribute the module does not carry, in `change-module-attribute` or `change-group-attribute` | Not set: "Module '…' has no attribute '…'" (`hi-tools.ts:520`, `:544`) | `corrections`: the root module kept its value (`hi-tool-commands.ts:981`); an error when no change could be made |
| A root attribute in a create that only the generated roots carry | Set on the whole group (`hi-tool-attributes.ts:80`) | `corrections` |
| A value that conflicts with another attribute, in an edit | The library changes the other attribute | `corrections` names the change (D59) |
| A value the library cannot calculate | **Kept**: the root module stays with its `Error` diagnostic, without docking vectors and front parts, until a valid value recalculates it | `notLoaded` (create, `hi-tool-commands.ts:748`) or `corrections` (attribute edits, `hi-tool-attributes.ts:270`): the first line of the diagnostic and what to change (D95) |
| An exception of the library's calculation | The group stays as it was sent, without a calculation (`_calculate`, `glue-logic.ts:3456`) | Nothing; the console only |
| A group on an obstacle, in front of a window or outside the room | Built | `hint` (D51, D55) |

## Where the guarantee ends

### A failed calculation is kept, not discarded

When the library cannot calculate a root module with the values it has, the planner keeps the edit
and the calculation (D95, `_runGroupCalculation`, `glue-logic.ts:2267`). The root module stays in
the plan without docking vectors and front parts until a valid value recalculates it, and the tool
result names it. Discarding it is a rejected approach: the value may be the user's, resetting it
needs the library's valid combinations, and a kept group is one the agent repairs with one more
call. D99 calls this handling a fallback that keeps the plan usable, not a path a valid planning
takes.

roomle-ui does not take such a root module out of the price or the order: `getGroupDataForOrder`
hands every group of the scene to the library. What `getOrderData` does with a root module that
carries an `Error` is decided by the library script, outside these repositories.

### Values are not checked before an edit

The library can say which values a module takes: a list with `Normal`, `Conflicting` and `Invalid`
entries, or a range (`getVerifiedAttributeOptions`, `glue-logic.ts:2448`). The planner's attribute
panel uses it; no HI tool does. The agent reads the values of an attribute from the master data,
the same for every article. A value the module does not take is therefore caught only by the
calculation. For Furniture_Smith the check would not cover the size attributes either: the library
does not verify `mod_Width` and `mod_Height`. The open work is
[attribute-values-checked-before-an-edit.md](../backlog/attribute-values-checked-before-an-edit.md).

### A create is not the planner's interactive path

- The attribute values of a root in `create-or-replace-groups` go into the layout and are
  calculated with it. The library's conflict resolution (`solveModuleAttributeConflict`) runs only
  in the attribute edits (`modifyAttributesOfModules`). A create can therefore load a front program
  with a front colour that an edit would switch, and the planner renders it (D60). The served
  Fronts rule keeps the agent from it.
- An article the user drags in gets the library's check of every root module (`solveInitialModule`
  in `newPosDataFromId`, `glue-logic.ts:707`). A group of a create gets the check of the group only,
  and only from a library with a group orchestrator.

### A value the library accepts can still fail

A value the library offers must calculate. When it does not — a wall unit at 900 mm with a single
door, a drawer sideboard lowered to 720 mm — the library is at fault (D99). Such issues are tracked
in [library-issues.md](../backlog/library-issues.md) and reported to the library development team.

### An exception of the calculation reaches only the console

`_calculate` (`glue-logic.ts:3456`) catches an exception of the library's `calculateGroup` and
returns the group as it was sent. Every later step takes that group for a calculated one, and no
tool result names it
([roomle-ui `library-errors.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/library-errors.md#the-library-boundary)).

### The row edits report no library error

`place-group`, the delete, merge, exchange, insert and swap commands and `merge-groups` do not read
the library's diagnostics. A root module the library cannot calculate after such an edit stays in
the plan without a note
([roomle-ui `library-errors.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/library-errors.md#the-other-tool-commands)).

### Where a group stands is the user's choice

The tools build a group that overlaps an object, stands in front of a window or stands outside the
room, and say so in `hint` (D51, D55). The user may want it there, and the tools cannot tell such a
request from a mistake.

## Who fixes a failure

| Failure | Where the fix belongs |
|---|---|
| The tools sent a value the library rules out | The MCP: the served text, the tool API or a check before the edit — [mcp-issues.md](../backlog/mcp-issues.md) |
| A value the library accepts does not calculate | The library — [library-issues.md](../backlog/library-issues.md) |
| The agent picks the wrong article or value because the library data lacks the information | The `desc` in the library data — [library-issues.md](../backlog/library-issues.md) |

## Related

- [roomle-ui `library-errors.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/library-errors.md)
  — every call into the library and how its errors reach the agent
- [roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md)
  — D51, D59, D60, D95, D99 and the corrections and feedback of §8
- [roomle-ui `homag-intelligence.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md)
  — the architecture of the HI integration
