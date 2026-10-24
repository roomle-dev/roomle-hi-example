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

- **A change the library cannot calculate is not made.** The tools discard it before it is loaded:
  the group before the change stays, the plan never shows the change, and the result tells the agent
  that nothing was changed and which root modules failed and why (D106, D109). An edit the user makes
  in the planner is kept with its failed calculation (D95), and the agent reads that the root module
  is not built (D108).
- **A value the library's own check rules out is not set** (D107), but the library does not verify
  every attribute: for Furniture_Smith not the sizes.
- **A create skips the library's conflict resolution** for the attribute values of a root module.
- **A value the library accepts can still fail to calculate**: a library bug.
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
| `attributes` of a root, `{ id, value }` | Checked against the library's verified options on the article template, then set as input values on the root module, or on its sub modules that carry the attribute; the library calculates with them | `checkRootOverrides` (`hi-tool-attributes.ts`), `_applyRootAttributeOverrides` (`glue-logic.ts`) |
| `attributes` of a group | Checked against the library's verified options on the loaded group, then set on the root modules that take them, with the planner's attribute edit, which asks the library to resolve conflicts first | `applyGroupWideAttributes` (`hi-tool-attributes.ts`), `modifyAttributesOfModules` (`glue-logic.ts`) |
| One relation per unit: `rightOf`, `leftOf`, `onTop`, `above`, `behind` | Compiled into docking entries between the docking vectors of the calculated modules | `relationsToDocking` (`hi-group-layout.ts:265`) |
| `placement`: a wall with alignment and offset, or a point and a rotation | The position of the group as a whole | `hi-wall-placement.ts`, `hi-group-placement.ts` |

Everything else in a payload is dropped before the planner sees it:

- `toArticlePick` (`hi-tool-payload.ts:10`) rebuilds every root from its id, article id, library id,
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
  `:3458`). The library computes the dimensions, the parts, the docking vectors, the generated roots
  and the attribute values that depend on others. A library with a group orchestrator also checks a
  new group (`solveInitial`, `_solveInitialNewGroup`, `:3585`).
- **Attribute edits.** Before a value is set, the tools ask the library whether the module takes
  it (D107), and the library resolves its conflicts with the module's other values (`solveModuleAttributeConflict`, `glue-logic.ts:2919`). Every value the library
  changes beyond the one sent is named in `corrections` (`withLibraryChanges`,
  `hi-tool-attributes.ts:231`, D59).
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
| A value a module does not take by the library's verified options — in an attribute edit, a root override or a group attribute of a create | Not set on that root module; the rest of the call is set | `corrections` names the values the module takes; an error when no root module takes a value of the call (D107) |
| A value that conflicts with another attribute, in an edit | The library changes the other attribute | `corrections` names the change (D59) |
| A value the library cannot calculate — in a tool call that changes the plan | **Not made**: the HI tools let the library calculate the change and discard it before the load, per group; the group before the change stays (D106, `hi-tools.ts`) | A create: `notLoaded` for the discarded group, the other groups built; every other call: an error result — nothing was changed, the root modules per group and cause with the first line of the library's message, and what to change (`runToolCommand`, `hi-tool-commands.ts`) |
| An exception of the library's calculation | **Not made**, as above: `_calculate` (`glue-logic.ts:3458`) marks the group with a `Fatal` message | An error result that names the group |
| A group on an obstacle, in front of a window or outside the room | Built | `hint` (D51, D55) |

## Where the guarantee ends

### A failed calculation of the agent's change is discarded, the user's is kept

A change of the agent that the library cannot calculate — a root module or a group that it could
calculate before — is not made (D106). The HI tools own the load: they let the library calculate the
change, compare the group before and after the calculation, and load only a clean result; otherwise
the group before the change goes back, nothing reaches the scene, and the agent is told that nothing
was changed — in `notLoaded` for a group of a create, whose other groups are built, in the error
result for every other call — with the failing root modules, the first line of the library's message
and what to change. A row edit, which the glue logic calculates and loads in one call, is staged on
a copy first. The planning in the scene never vanishes while the agent adapts, improves or fixes it
(D109).

The discard refuses the agent's input — a guard, the last step of
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort). The steps before it do not meet
the rule: the served text cannot name the value combinations a library's tables lack, as they are
library data and the served text stays library-neutral; the check of a value against the library's
verified options before an edit (D107) prevents only part of the failures;
the server knows no valid combination to correct the input to; and building what it can leaves the
failed root module in the plan, which the user rules out. The guard is as narrow as it can be: it
discards one group's change before the load, never the planning that stands, and the error says what
failed, why, and what to send instead.

The discard covers the agent's calls only and lives in the HI tools. The glue logic calculates the
user's edits in the planner as well and keeps every calculation (D95, `_runGroupCalculation`,
`glue-logic.ts`): it is not part of the discard. `delete-article-in-place` and `merge-groups` change
the plan in the kernel before the library calculates, and the kernel's position answer after a load
recalculates a group at its place: a root module they leave uncalculated is kept and named in
`libraryFailures` and `calculationError`. A root module the
library could not calculate after an edit in the planner, or in a loaded plan, stays in the plan
without docking vectors and front parts until a valid value recalculates it. It does not stand
against a later tool call; the agent can repair it. D99 calls this handling a fallback that keeps
the plan usable, not a path a valid planning takes.

The agent sees such a root module (D108). In `get-plan-context` and in every group a tool returns,
it carries `calculationError`, the first line of the library's message (`shapeRoot`,
`hi-plan-context.ts:730`), and the `get-plan-context` description tells the agent that it is not
built and that the answer says so. A group whose own calculation failed carries the field as well.
A loaded plan is calculated again when it loads, so the field is current. The attribute tools
answer without groups; their `hint` names every root module of the changed groups that is still
not built, so a repair that fails again shows (`compactAttributeResult`,
`hi-mcp/tool-executors.ts:240`).

roomle-ui does not take such a root module out of the price or the order: `getGroupDataForOrder`
hands every group of the scene to the library. What `getOrderData` does with a root module that
carries an `Error` is decided by the library script, outside these repositories.

### Only the attributes the library verifies are checked before an edit

The library can say which values a module takes: a list with `Normal`, `Conflicting` and `Invalid`
entries, or a range (`getVerifiedAttributeOptions`, `glue-logic.ts`). The planner's attribute panel
narrows its choices with it, and the tools ask it before they set a value (D107): a value the module
does not take is not set on it, and the result names the values it takes. The agent reads the
values of an attribute from the master data, the same for every article, so the check is where it
learns what one module takes. The check covers the attributes the library verifies for the module.
For Furniture_Smith those are the programs, colours and designs and the plinth height, not
`mod_Width`, `mod_Height` or the door direction: a size the library accepts and cannot calculate is
caught only by the calculation (D106). The library's group settings sent with a create are not
checked either.

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

### Where a group stands is the user's choice

The tools build a group that overlaps an object, stands in front of a window or stands outside the
room, and say so in `hint` (D51, D55). The user may want it there, and the tools cannot tell such a
request from a mistake.

## Who fixes a failure

| Failure | Where the fix belongs |
|---|---|
| The tools sent a value the library rules out | The MCP: the served text, the tool API or the check before the edit (D107) — [mcp-issues.md](../backlog/mcp-issues.md) |
| A value the library accepts does not calculate | The library — [library-issues.md](../backlog/library-issues.md) |
| The agent picks the wrong article or value because the library data lacks the information | The `desc` in the library data — [library-issues.md](../backlog/library-issues.md) |
| The agent's path skips a step of the library that the planner's UI runs — the conflict resolution, the check of a root module | The HI tools (`hi-tool-*.ts`, `hi-tools.ts`, `hi-mcp/`), never the glue logic, which serves the UI ([Hard Rule](../../AGENTS.md#hard-rule-the-planning-assistant-stays-out-of-the-glue-logic)) — [library-calculation-gaps.md](../backlog/library-calculation-gaps.md) |

## Related

- [library-calculation-gaps.md](../backlog/library-calculation-gaps.md) — the open work that closes
  these gaps
- [roomle-ui `library-errors.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/library-errors.md)
  — every call into the library and how its errors reach the agent
- [roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md)
  — D51, D59, D60, D95, D99, D106, D107, D108, D109 and the corrections and feedback of §8
- [roomle-ui `homag-intelligence.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md)
  — the architecture of the HI integration
