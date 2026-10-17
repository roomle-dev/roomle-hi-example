# Bug analysis — the door at the right end of a row is hinged on the left

> **Type**: Bug analysis
> **Status**: Open
> **Ticket**: [RML-18203](https://roomle.atlassian.net/browse/RML-18203)
> **Date**: 2026-10-17
> **Base**: `master` 5af8174; the planner of the probe: roomle-ui `release/bo-test` b2dbcb202

## Affected repositories

- **roomle-hi-example** — the served rules of the MCP server: the front rule of `AUTHORING_RULES`
  (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:19`) and its unit test, `docs/hi-mcp-behaviour.md`, two
  test prompts in `docs/test-prompts.json`, a library issue in `.agents/backlog/library-issues.md`.
  This is where the fix belongs.
- **HOMAG library (Furniture_Smith)** — the descs of the attribute `mod_DoorDirectionSelection` and
  of its value `Automatic` lack information. A library issue for the library development team; the
  library keeps its behaviour.
- **roomle-ui** — no change. The plan context lists the attribute, and the tool commands set it on a
  root module and on its door.
- **ligna-store** — no change. Its chat gets the served text from the MCP server.

## Symptom

Reported with this image:

> If you have multiple cabinets in a row, the door handles should never be on the outside of the
> row. The door of the cabinet on the far left should open to the left, with the handle on the
> right. The door of the cabinet on the far right should open to the right, with the handle on the
> left. This issue can usually be resolved by changing the opening direction of the door for
> individual cabinets.

![The door on the far right has its handle on the outside of the row](../images/door-handle-outside-of-row.png)

The door on the far right has its handle at the outer edge of the row (red frame).

## Reproduction

Without a model, through the MCP tools on the deployed bo-test planner: the example launcher on
spare ports (`EXAMPLE_PORT=3001 HI_MCP_PORT=3110 node minimal-hi-example/start.mjs --no-open`), the
page in headless Chromium, the MCP SDK client. One `create-or-replace-groups` call with three groups,
each placed by wall, each root `rightOf` the one before, no attributes:

| Group | Articles | `mod_DoorDirectionSelection` of the root and the door | `mod_DoorDirection` of `mf_Door` |
|---|---|---|---|
| closed wardrobe | `KS_HT600K` ×4 | `Automatic` | `Left` on every door |
| endless wardrobe | `HEST60`, `HEMT60`, `HEMT60`, `HEET60` | `Automatic` | `Left` on every door |
| base units | `UTB60` ×3 | `Automatic` | `Left` on every door |

Then the two ways the agent can set the side:

- `change-module-attribute` with `rootModuleIds` the right end of the closed wardrobe,
  `attributeId` `mod_DoorDirectionSelection`, `value` `Right`: `changedModuleIds` names the root
  module and `mf_Door`, the door's `mod_DoorDirection` is `Right`, its handle moves to its left edge.
- `create-or-replace-groups` with four sideboards `SB_UB600`, the first root with the attributes
  `mod_DoorDirectionSelection` `Left`, the last with `Right`: the doors are `Left`, `Left`, `Left`,
  `Right`; no corrections.

![Left: four KS_HT600K as created. Right: the last root module set to Right](../images/door-direction-before-after.png)

Left: the closed wardrobe as created — every door hinged left, the handle of the right end on the
outside. Right: after `change-module-attribute` with `Right` on the right end — its handle beside its
neighbour's.

Not checked: articles with two doors, whose values are `LeftRight`, `LeftLeft` and `RightRight`.

## Investigation trace

### What the library does

- `mod_DoorDirectionSelection` (`docs/library-information/master-data.json:8409`): name "Door
  direction", desc "Direction of the door", group `Front | Construction`, `isMain` true,
  `userRight` `Simple`, `implicitRelevant` false. Its values: `Left` "Door left hinged", `Right`
  "Door right hinged", `LeftRight`, `LeftLeft`, `RightRight` for two doors, `Automatic` "Setting via
  tab_DoorSettings".
- The root modules `mr_StorageunitSingle` and `mr_CornerunitStraight` carry it, and the front
  modules `mf_Door`, `mf_Fridge`, `mf_FillerFront` and `mf_BaseunitFridge`.
- One article of the article list sets it, `KS_HT600`, to `Automatic`; every other article gets the
  same value from the library.
- The library resolves `Automatic` of a single door to `mod_DoorDirection` `Left` — hinged on the
  left, the handle on the right — whatever the door's place in the row. `mod_DoorDirection` is
  internal: the master data does not list it. The END article of the endless wardrobe, `HEET60`, is
  hinged left too.
- `implicitRelevant` false: the door direction is not passed on between neighbours (D56). A root
  module that an edit adds to a row gets `Automatic`, so `Left`.

So by default the door at the left end of a row is as the rule wants it, hinged on the left, and
the door at the right end of every row has its handle on the outside.

### What the agent sees

- The attribute vocabulary of `get-plan-context` lists `mod_DoorDirectionSelection` with its six
  values: a root module carries it and it is customer-facing (`isCustomerFacingAttribute`, roomle-ui
  `homag-intelligence/src/hi-plan-context.ts:250`). `find-attributes` finds it by "door" or
  "hinged".
- A root of `groups` lists its input attributes only (`shapeRoot`, `hi-plan-context.ts:690`, the
  filter at :699): the door direction appears once it is set; `Automatic` and the side it resolves to
  are not shown, and the sub modules come without attributes. `rowIndex` names the place of a root
  module in its row, 1 at the left end as seen from the front (D66), so the agent knows the two ends.
- `get-plan-images` shows the handles.

### What the agent can do

- `create-or-replace-groups`: the `attributes` of a root are overrides of that root module
  (`hi-mcp-server.ts:17`), and the library passes the root module's value on to its door.
- `change-module-attribute`: sets the attribute on the root module and on every sub module that
  carries it (D54; `_attributeTargets`, roomle-ui `homag-intelligence/src/hi-tools.ts:1113`).

Both work, as the reproduction shows.

### What the served text says

- The front rule of `AUTHORING_RULES` (`hi-mcp-server.ts:19`) speaks of the front program and the
  front colour only. Nothing says on which side a door is hinged.
- The extending rule (`hi-mcp-server.ts:35`) and the descriptions of `merge-article-into-group`,
  `insert-article-into-group` and `exchange-root-module` say that a new root module inherits "fronts,
  handles, carcase" from its neighbour. That holds for the handle design, not for the hinge side,
  and nothing says that a new end of a row needs a side.
- The planning skills: `kitchen-planning/SKILL.md:132` lists "opening direction/extension" among what
  to record per cabinet, with no rule for the side; `image-planning/SKILL.md:42` reads "the handles"
  from an image as attributes of the group — the design, not the side. No skill covers a wardrobe,
  and the skills are maintained as their authors deliver them (D75).

## Root cause

The served rules never tell the agent that the doors at the two ends of a row are hinged at the
outer sides of the row. The front rule of `AUTHORING_RULES` (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:19`)
covers the front program and the front colour only, and no tool description and no planning skill
names the hinge side. So the agent leaves the door direction at the library's `Automatic`, which
hinges every single door on the left: the door at the right end of every row has its handle on the
outside — after a create, and again on every root module an edit adds at the right end.

The library data adds to it. Neither the attribute's desc "Direction of the door" nor the desc of
`Automatic`, "Setting via tab_DoorSettings", tells the agent what it gets when it leaves the value
alone. What the library does with `Automatic` is intended.

## Proposed fix

Step 1 of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): clarify the
instructions. No guard and no correction.

### 1. The served rule (roomle-hi-example)

One library-neutral sentence in the front rule of `AUTHORING_RULES` — no attribute id, no value.
For example:

> A door is hinged on one side and has its handle on the other. In a row, the door at the left end
> is hinged on the left and the door at the right end on the right, as seen from the front, so no
> handle is on the outside of the row: set the attribute of the vocabulary that says on which side a
> door is hinged in the attributes of those two root modules, and on the new end after an edit that
> gives the row a new end.

`AUTHORING_RULES` reaches every agent: at initialize, and through `get-authoring-rules`, which the
description of `create-or-replace-groups` names, in the chats. A unit test in
`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` guards the sentence, beside
`it('tells the agent that the front program says how a front is built and that a colour can switch it')`.

### 2. Not proposed: the server sets the side

After a create or an edit, the tool command could set the hinge side of a row's two ends itself, by
`rowIndex`. It would have to know the library's door direction attribute and its values — library
information in the server's logic, against §2.4 of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#24-instructions). For the same reason
there is no correction.

### 3. The library issue

The desc of `mod_DoorDirectionSelection` says that left and right are seen from the front and that
the handle is on the other side; the desc of `Automatic` says what it chooses — a single door hinged
on the left — instead of naming an internal table. A new item of
[`.agents/backlog/library-issues.md`](../backlog/library-issues.md), not reported yet. The served
rule works without it: the agent sets both ends.

### 4. Documentation and tests

- `docs/hi-mcp-behaviour.md`: the fronts bullet of §5.2 and a decision row (the doors at the ends of
  a row are hinged at the outer sides; the agent sets it).
- `.agents/skills/hi-authoring-rules.md`: its **Fronts** paragraph.
- `docs/test-prompts.json`, on the plan `closets`: a wardrobe of four single-door cabinets on the
  back wall — the left end hinged left, the right end right; a cabinet added at the right end of a
  row — the new end hinged right.

## Open points

1. **The former end after an extension.** After a cabinet is added at the right end, the former end
   keeps `Right`, its handle now beside its left neighbour's. The rule names the ends only, so it
   stays — or should the agent set it back?
2. **A row with a corner article.** An L-shaped group has two free ends; the rule takes them as the
   ends of the row, and the corner article stands inside it. Confirm.

## Acceptance criteria (from the ticket)

- The served rules say, in library-neutral words, that the doors at the two ends of a row are hinged
  at the outer sides of the row, and how the agent sets it; a unit test guards the sentence.
- Test prompt: a row of four single-door wardrobe cabinets — the left end root module is hinged
  left, the right end root module right.
- Test prompt: a cabinet added at the right end of an existing row — the new end is hinged right.
- The missing information in the descs of the door direction is a library issue in
  `.agents/backlog/library-issues.md`.
