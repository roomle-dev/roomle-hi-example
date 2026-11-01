# HI MCP Tools Skill

**Load this skill when the task involves:** MCP tool definitions, tool parameters, usage patterns, error handling for specific tools.

The behaviour reference — every guard, correction and feedback message, and the decisions behind
them — is [roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## Tool Overview

### Core Tools
| Tool | Purpose |
|---|---|
| `get-plan-context` | Get rooms, articles, the attribute vocabulary, groups, obstacles, installation elements; masterData and the full article descriptions on request |
| `create-or-replace-groups` | Create, modify and extend groups; position new groups |
| `place-group` | Move an existing group to a wall/corner or to a point and rotation |
| `get-authoring-rules` | Get HI authoring rules |
| `get-skill` | Get a planning skill (planning from an image, kitchen, kitchen in France, living room) with the planning reference it asks to read before planning, or one of its files alone — the optional source catalog |

A host with the Skills extension of MCP (`io.modelcontextprotocol/skills`) gets the same skill files
without a tool: `skills/list`, `skills/get` and the resources `skill://<name>/<path>`, served as they
are, without the session preamble of `get-skill`.

### Information Tools
| Tool | Purpose |
|---|---|
| `find-attributes` | Look up attribute definitions |

### Editing Tools
| Tool | Purpose |
|---|---|
| `change-module-attribute` | Set an attribute of one or more root modules and of their sub modules that carry it, or of one sub module of each |
| `change-group-attribute` | Set one attribute, or several in one call, on every module of a group that has them |
| `delete-group` | Delete a group |
| `delete-article-in-place` | Delete an article and leave the gap — the tool for "delete" or "remove" unless the user asks to close the gap; the rest splits where it is no longer docked together |
| `delete-article-and-compact` | Delete an article and close the gap, when the user asks for it |
| `merge-article-into-group` | Dock one more article to a free docking vector of a root module; it inherits the neighbour's fronts, handles and carcase |
| `insert-article-into-group` | Insert an article between two root modules that stand side by side, whatever the group and the article; the root modules away from the wall move; it inherits the fronts, handles and carcase of the first-named root |
| `exchange-root-module` | Replace a root module with an article, keeping its docking and the fronts, handles and carcase of the replaced one |
| `swap-root-modules` | Let two root modules of a group change places |
| `merge-groups` | Join groups where they stand |

### History Tools
| Tool | Purpose |
|---|---|
| `undo` | Revert the last tool call that changed the plan |
| `redo` | Bring back the tool call the last undo reverted |

### Result Tools
| Tool | Purpose |
|---|---|
| `get-price` | Calculate pricing |
| `get-order-data` | Get order information |
| `get-plan-images` | Render the groups alone from their front and the top view of the plan, with the doors and drawers as they are |

### View Tools
| Tool | Purpose |
|---|---|
| `open-or-close-group` | Open (`open: true`) or close every door and drawer of a group |
| `open-or-close-article` | Open or close the doors and drawers of one root module, not its neighbours |

## Tool Reference

### get-plan-context

**Purpose**: Get complete session state

**Parameters**:
```typescript
{ include?: Array<'rooms' | 'articles' | 'attributes' | 'groups' | 'obstacles' | 'installationElements' | 'masterData' | 'articleDescriptions'> }
```

**Returns**: in the planner's plan space — millimetres, right-handed, Z up, `x` to the right and `y`
to the top of the top-view image (D105); the tool turns the pos space of the planner methods into it
at its dispatch. Rooms, articles, attributes (the vocabulary: per library every attribute the agent
sees (D100) — the attribute filter leaves out the element type `mod_TypeElement`
in every section and result (D102) —, with its values for the attributes a planning sets at the
create — those the catalog names per root module (`mainAttributes`, `dimensions`), the group
settings and those of the generated root modules — and `valueCount`, the number of its values, for
every other one, whose values `find-attributes` returns by id (D122); a shared value list listed
once with `sameSelectionsAs` on the later attributes, D76), groups, obstacles, installationElements; masterData and articleDescriptions if requested. Like every JSON result of the
server: compact JSON without the `imageUrl` fields of the planner's plan context (signed CDN URLs
no agent can open, three quarters of the tokens). Every wall carries a `name` in the user's words
(back wall, front wall, left wall, right wall) beside its `side`, a door opening the `type`
`opening`, and every room a `corners` list — per corner its `name` (back left, …), `point` and the
`posRotationZ` of a corner kitchen there — so a corner placement is a lookup. Every wall carries
`start`/`end` (`[x, y, 0]`, the kernel's contour points) and `facingRotationZ`

**Obstacles**: `obstacles.objects` lists every plan object that is not an HI group — `kind` (`door`,
`window`, `object`), `outline` (floor points `[x, y, 0]` in the coordinates of the walls) and
`bottomMm`/`topMm`; a door or a window also carries `roomIndex`, `wall` (its index in the walls
array) and `fromEndMm`, its span along that wall measured from the wall's end. `obstacles.groups`
gives per HI group the room-space `outline` and height range of every root module that is not
generated, from the parts of the calculated group — the kernel's own outline of a group is not
used: it lies up to 250 mm off (D45). Root outlines bound the calculated parts and can extend past
the docking edges over a neighbour in the same group; that overlap alone is not a placement error.
Article-specific overhangs are described by the library data. No walls. Requested alone,
`obstacles` makes the server fetch the rooms too. The agent does not compare outlines itself: the results of
`create-or-replace-groups` and `place-group` name every root module on an obstacle in their `hint`,
with the free stretches of its wall and, for a group placed at a wall, the `offsetMm` that keeps it clear of a door or a window
of the adjoining wall (D55). When a door or window determines a placement, the tool description
asks the agent to name it and explain whether the final placement keeps it clear, using the
returned obstacle dimensions and final tool results. Below-sill placement, horizontal clearance
and overlap are described according to the measured result; missing data is no assurance of clearance.

**Installation elements**: `installationElements` lists the electric plugs and the water
connections of the plan — per element its `type` (`ElectricPlug` or `WaterConnection`) and its
`position` (`[x, y, z]` in the coordinates of the walls, `z` its height); a position only, no size. They are
no obstacles: a group may stand on a supply, and the `hint` of `create-or-replace-groups` and
`place-group` reports no overlap for one (D86).

**Rows**: every root module docked side by side with another one carries `rowIndex`, its place in
its row — 1 at the left end as seen from the front; floor units and wall units form rows of their
own, and a corner article joins the two legs into one row. The roots are listed in the order they
were added, an inserted one last, so "the middle unit" is read from `rowIndex` (D66). Every group a
tool returns carries it; a resubmitted group's `rowIndex` is ignored.

**Walls**: every root module at a wall carries `wall`, the name of the wall it stands at (`back
wall`, `right wall`, … — the names of the plan context's walls). The two legs of a corner group stand
at two walls, and a wall unit names the wall it hangs on; a root module at no wall, such as an
island, carries none (D113). Every group a tool returns carries it; a resubmitted group's `wall` is
ignored.

**Not built**: a root module the library could not calculate — after an edit in the planner, in a
loaded plan or after an undo (D95) — carries `calculationError`, the first line of the library's
message, and so does a group whose own calculation failed. The log messages stay withheld (D9). The
description tells the agent that such a root module or group is not built — no docking vectors and
no parts until a value the library can calculate replaces the one that failed — and that the
answer says so and never describes it as planned. Every group a tool returns carries the field; a
resubmitted group's `calculationError` is ignored (D108).

**Doors after an edit**: the description reminds the agent to hinge new row ends at the outer
sides, left at the left end and right at the right end as seen from the front. Attribute and value
come from the library's descriptions for single or paired doors; other directions stay unchanged
(D84). Both chats send this reminder in every tool list, also without fetching the authoring rules.

**Article size**: per root module of an article, `dimensions` lists the size attributes the root's
module carries, with id, name and value in millimetres (Furniture_Smith: `mod_Width`, `mod_Depth`,
`mod_Height`; the panels `mod_UprightDepth`, `mod_UprightHeight`, the island backwall
`mod_IslandBackwallWidth`; the range hood `DU` and the TV `SM_TV` have none). A corner article
(`cornerArticle: true`) also lists `cornerBackLengthsMm`: an object with the lengths of its
`LeftBackBottom`/`RightBackBottom` docking vectors in millimetres as the named fields `left` and
`right`, each present when the article has that vector. A root
in `groups` carries the same ids among its `attributes`; a group's `position.footprint` gives
`widthMm`/`depthMm` of the whole group, its `x` and `y` ranges measured from `pos`, the front towards
`−y`. A group's `position.pos` and `rotationZ` are what a
placement would name for it: the room point of its back left bottom corner of the whole group — a
rear panel included; the anchor is never a back panel, whatever the roots order (D133) — and the
rotation of the placement, whatever origin the planner keeps the group at — the agent reads back
what it placed. A
group with two corner articles also carries `position.rootId`, the corner article `pos` belongs to. A unit is resized with `change-module-attribute` and the
attribute id, never its name.

**Trusted descriptions**: every `desc` (article, root, module, attribute, attribute value) is
authoritative, and `dimensions` give the size, over the catalog images of the master data
(`imageUrl`). A colour code in the desc of an attribute value — `Cloudy blue (#506080)` — is the
colour of that value, taken as it is: light, dark and the hue come from it, not from the name (D53).
The rule covers only the catalog images, not the renderings of `get-plan-images` or an image the
user attaches. It is in `get-authoring-rules` and in the descriptions of `get-plan-context` and
`find-attributes`. The server strips every `imageUrl` and `downloadUri` from its results (D7). An article's `desc`
in the catalog is short — of a description written in sections, the text of its FUNCTION and
AI_SELECTION_HINT sections, on the line of the section name or the next; `include: ['articleDescriptions']` returns the full ones, for a question about one article —
the descriptions tell the agent that `desc` is enough to pick the articles of a planning (D63).

**Usage**:
```javascript
const context = await getPlanContext({ include: ['rooms', 'articles'] });
```

### create-or-replace-groups

**Purpose**: Create new groups or replace existing ones

**Parameters**:
```typescript
{ posGroups: PosGroup[] }
```

**Roots**: `{ id, articleId, attributes? }` plus one relation that names the neighbour — `rightOf`,
`leftOf`, `onTop` (`align`, `gapMm`), `above` (`gapMm`) or `behind`. The server builds the docking
(`contextData`) from it; a row-less panel docked `behind` a row is anchored by the server at the
row's start end (the corner of a peninsula leg, else the row's first unit as seen from its front),
so it closes the row's whole back whichever unit of the row it names, including the Top vectors of a wall unit beside a tall unit and the hang
gap of a wall unit above a floor unit — see the
[authoring rules skill](./hi-authoring-rules.md#relations). `contextData` is still accepted; a group
from `get-plan-context` carries it.

**Mounting**: choose articles and settings from the library descriptions and attributes; categories
organize the catalog. Unknown categories retain explicit `above` and `gapMm`; finishing parts
continue the wall row `rightOf` / `leftOf`. A replace, a placement by wall and `place-group` restore
the missing carrier link of a retained root the floor does not hold through its docking, at the
measured offset, to the `Top` vector of its carrier that runs the root's way, so the link never
turns it — a unit over the right leg of a corner article docks to its `RightTop` (C24 of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#8-guards-corrections-and-feedback)).

**Materials**: a root's `attributes` are overrides of that root module; one only its sub modules
carry — the sink of a sink unit — is set on those sub modules (D100). A material for the whole group
(fronts, worktop, carcase) goes into the group's `attributes`; the server sets every group attribute
that is not one of the library's group settings (`groupSettings` of the master data) on every unit and
generated root after the load — after a create and after a replace, the program attributes first, so a
colour sent with its program stays — and reports it. A root module that names its own value of a group
attribute keeps it — an accent: the same command sets that value on it after the group's (D36). An override only a generated root carries (the worktop colour on a base unit) is moved
to the group — one the modules of catalog articles carry, a width, stays with its root —, and the colours of the generated roots a resubmitted group carries are set again. A root
a replace adds inherits the attributes the library passes on between neighbours (fronts, handles,
carcase) from the root it is docked to; its own `attributes` override them (D56).

When group attributes change a floor unit’s docking height, the planner keeps the measured
clearance to any wall unit hanging above it, even if their docking link did not survive the load.
An explicit `gapMm` remains the requested clearance (D42).

**Returns**: `loaded` (the planner's object ids), `groups` (the groups of the call), `otherGroupIds` (the other groups of the plan, unchanged — D68), `groupAttributes` (`[{ index, id, set, notCarried?, rootValues? }]`: per group the group attributes set on every unit with one planner command, those no unit of the group carries — for a requested generated part, find an enabling attribute with `find-attributes`, enable it when available, then set the part's attributes after generation; report only what remains missing, D65 —, and the root modules that keep their own value of one, `{ id, value, rootModuleIds }`), a `hint` naming any group of the call that is still unpositioned (it sits at the plan origin — a group gets its position from the placement it is created with), `corrections` (what the server changed in the input, the group attributes left out because the library could not calculate root modules with them — the others are set, D128 —, what the library changed with the group attributes — a front colour reset by a front program, D59 — or with the values of a root, which the root is built with — "posGroups[0]: with mod_FrontColor "324" (…) the library changed mod_FrontProgram of root module 'w1' (OTB60) from "Classic" (…) to "Modern" (…)", D111 —, and a root override or group attribute a root module does not take by the library's own check, left out on it with the values it takes, D107) and `notLoaded` (`[{ index, id?, rootIds?, errors }]` — the groups it could not build or the planner left out, with the reason (D73), and, with `rootIds`, the roots of a loaded group it could not build (an unknown article id drops the root, not the group), matched by the planner's answer per group to the original input index, each error naming what to send instead; the other groups and roots load). A create the library cannot calculate — a root module or a group that fails after the call and did not before — changes nothing: the result is an error that names per group (`posGroups[i]`) and cause the root modules and the first line of the library's message (D106). For a discarded group, explicitly submitted roots keep the call's ids in both `rootIds` and the error; extra roots of multi-root picks and generated roots keep their calculated ids. A discarded new group is named by its original `posGroups[i]` only; a replacement also names its existing group id. A group id the agent gave an earlier group of the session replaces that group; a `hint` names each root module of the call's groups that overlaps an object or a root module of another group, or stands in front of a door or a window, with the free stretches of its wall as `fromEndMm` ranges — the group is built anyway (D55); `dockTo` on a root is read as its relation

**Usage**:
```javascript
await createOrReplaceGroups({ posGroups: [group1, group2] });
```

**Positioning**: a new group carries a placement in one of two forms. At a wall or in a room
corner: `placement: { wall, alignment?, offsetMm?, roomIndex? }` — the parameters and defaults of
`place-group`; the alignment `center` (default), the side label of the adjoining wall (flush into
that corner, a corner article into the corner) or `end`, `offsetMm` from that corner or from the
wall's end. The server loads the group, computes the target from the calculated group as
`place-group` does (an overlap moves it along the wall), reloads it there, places it once more by
its measure there when it does not stand as asked (D70), and sets its group materials after the
last reload (D23). Anywhere else,
and for a group of wall units only: `placement: { posGroup, posRotationZ, rootId? }` — `posGroup`
the room point of the group's back left bottom corner of the whole group, a rear panel included
(`z` 0 on the floor; a floor point `[x, y]` is completed to `[x, y, 0]`), `posRotationZ` the
rotation in degrees,
counter-clockwise as seen from above; `rootId` only with two corner articles, naming the one that
goes into the corner `posGroup` names. One piece of furniture is one group: relate every further
article to its neighbour instead of positioning it. `posGroup` is the back left bottom corner for
every article — the server places the anchor by the back left bottom
corner of its docking vectors, also for a range hood whose origin is its centre. See the
[authoring rules skill](./hi-authoring-rules.md#positioning-a-group).

Positioned roots with visible calculated parts carry read-only `bottomMm` and `topMm`: absolute measured heights, including generated worktops. Missing geometry supplies no height facts. Resubmitting a returned group ignores these fields.

**Existing groups**: a group resubmitted with its id and without placement keeps its position; a
placement on a group that is already in the plan is not used (the group keeps its position, and
`corrections` says so) — move it with `place-group`.

### place-group

**Purpose**: Move an existing group to a wall/corner or to an explicit point and rotation.

**Parameters**:
```typescript
{
  groupId: string,                       // a unique prefix is accepted
  wall?: 'left' | 'right' | 'top' | 'bottom' | 'back' | 'front' | number, // side label or wall index
  alignment?: 'start' | 'center' | 'end' | 'left' | 'right' | 'top' | 'bottom' | 'back' | 'front', // default 'center'
  offsetMm?: number,                     // along the wall, default 0
  roomIndex?: number,                    // default 0
  posGroup?: [number, number, number],    // point form, instead of wall
  posRotationZ?: number,                 // required with posGroup, including 0
  rootId?: string,                       // selects one of two corner roots
}
```

Point placement uses the same docking corner and rotation as a new placement. The supplied height is absolute; a two-number floor point receives height 0. It preserves the exact target, including outside the room, and reports overlaps through `hint`. Turning about a fixed centre also requires adjusting the docking-corner point. Wall fields beside point fields win and report those unused fields.

A side label as alignment means flush into the corner with that adjoining wall (`wall: 'right'`,
`alignment: 'top'` is the back right corner); a group with a corner article goes into that corner.
`back` and `front` name the `top` and `bottom` wall. A side label names the whole wall — its pieces of
wall and the doors and floor-to-ceiling windows between them; the group goes on its longest piece of
wall where it fits, else across the whole wall, and the result's `wall` is that whole wall. A wall
index names one piece. Groups may touch. A target that overlaps
another group (a root module of the one and a root module of the other overlap by more than 5 mm in
footprint and height — the box around an L-shaped group is only the quick test) is moved along the same wall
to the nearest free position; into a corner, or without a free position on the wall, the group is
placed as asked. An alignment parallel to the target wall centres the group. The reload carries
the generated roots (worktop, toe kick) with the group, so their colours stay, and docks a wall unit
hanging above a floor unit to it again, so it keeps its place (C24); a group that already
stands where asked is not reloaded. The library builds a group for its place - at a wall it may
widen the units at the end of a row, and it builds the end there without the worktop's overhang -,
so after the reload the group is measured as built there and placed once more by that measure when
it does not stand as asked (D70).

**Returns**: `placedIn` (`'point'`, `'corner'` or `'wall'`), the wall for a wall target, and the resulting group with its
`position`, plus `corrections` when the server corrected the request (an overlap, a parallel
alignment, a group that already stands there) and a `hint` when a root module stands on an object or
in front of a door or a window after the move, with the free stretches of its wall and the `offsetMm` that keeps it clear of a
door or a window of the adjoining wall (D55)

**Usage**:
```javascript
await placeGroup({ groupId: 'group-1', wall: 'right', alignment: 'top' });
```

### The command tools

**Purpose**: Edit a group that is already in the plan. Each tool is one call of the planner's group
command API (`externalObjectGroupOperation`): roomle-ui resolves the ids, corrects what it can and
performs the edit with the planner's own group features; the group keeps its position

**Parameters**:
```typescript
'change-module-attribute': { rootModuleIds: string[], rootModuleId?: string, moduleId?: string, attributeId: string, value: string | number | boolean }
'change-group-attribute':  { groupId: string, attributeId?: string, value?: string | number | boolean,
                             attributes?: { attributeId: string, value: string | number | boolean }[] }
'delete-group':            { groupId: string }
'delete-article-in-place':      { rootModuleId: string }
'delete-article-and-compact': { groupId?: string, rootModuleId: string }
'merge-article-into-group': {
  groupId: string, articleId: string, attributes?: { id, value }[],
  dockTo: { rootId: string, ownDockingVector: string, dockingVector: string,
            mode?: 'StartStart' | 'EndEnd' | 'StartEnd' | 'EndStart', offset?: [x, y, z] },
}
'insert-article-into-group': { groupId: string, articleId: string, attributes?: { id, value }[], between: [string, string] }
'exchange-root-module':    { groupId: string, rootModuleId: string, articleId: string, attributes?: { id, value }[] }
'swap-root-modules':       { groupId: string, rootModuleIds: [string, string] }
'merge-groups':            { targetGroupId: string, groupIds: string[] }
```

Group ids accept a unique prefix; ids are the ones `get-plan-context` shows (a sub module by its
id in `subModules`). A root module id that is a unique prefix, differs only in its first UUID
segment or in one character is read as that root and reported; one that matches nothing is
forwarded, and the planner's "not found" comes back with the roots of the plan. `value` numbers are passed as strings. `dockTo.ownDockingVector` is one of
the root's `freeDockingVectors`; the pairs are the docking pairs of the
[authoring rules](./hi-authoring-rules.md#valid-docking-pairs). An `articleId` in another spelling
(case, whitespace) is read in the catalog's spelling. `merge-article-into-group` docks a unit sent
to a taken side vector to the named root's free other side, else to the root at the free end of
that row (a corner article ends a row: the unit then goes to the free end of the leg in the other
direction), and a `dockingVector` the article does not have becomes the partner of `ownDockingVector`. A wall
unit, range hood or unknown-category upper article merged `*Top -> *Bottom` on a floor unit gets
the hang gap (D35) only when its offset is omitted; the offset's `z` is the clearance. Supplied numeric offsets, including zero,
remain the requested clearance. An article merged back to back, `BackBottom -> BackBottom`, without a
`mode` docks with `StartEnd` — it starts at the end of the `dockTo` root module, as `behind` places
it (D98); a mode sent stays.

`change-module-attribute` sets the value on every root module of `rootModuleIds` — one group or
several, one planner command per group (`change-attributes`); a single `rootModuleId` is read as a
list of one; with `moduleId`, one command per root module. A root module it could not change is
named in `corrections`, the others change. Before it sets the value, the tool asks the library which
values each module takes, as the planner's attribute panel does: a value a root module does not take
is not set on it, a value off a range's step is set on the nearest step, and `corrections` name the
values the module takes; when no root module takes the value, the call answers with that sentence as
its error and changes nothing (D107).

`change-group-attribute` sets one attribute with the planner's `change-group-attribute`, several
(`attributes`) with one `change-attributes` — one calculation, one undo step, the program attributes
first (D67); an attribute of the list no module of the group has is named in `corrections`. The
values go through the same check: a value some root modules do not take is set on the others. Every
tool that takes a group id reads a root id, or a unique prefix of one, as the group that holds the
root module, and says so in `corrections` (C23).

**Returns**: the two attribute commands `{ command, groupIds, changedModuleIds?, corrections?, hint? }`,
not the group (D62) — `hint` names every root module and group of the changed groups the library
still cannot calculate: "root module 'r1' (OTB60) of group 'g1' is still not built - <first line of
the library's message>. Change the value that fails, or tell the user." (D108); the others `{ command, groups, removedGroupIds, changedModuleIds?, gapClosed?, corrections?, hint? }`, once the
planner has loaded the result. A command after which the library cannot calculate a root module or
a group that it could before changes nothing: the tools calculate the change and discard it before
the load, the group stays as it was, and the result is an error — "<tool>: nothing was changed - the
library could not calculate root module '…' (…) of group '…' - <first line of the library's
message>. Change the failing values or replace the article, and send the call again." (D106) — the
new root module of `exchange-root-module` named by the call's `rootModuleId`, the new unit of
`merge-article-into-group` and `insert-article-into-group` "the new root module (…)"; a
failure a follow-up calculation after the load leaves is named in `libraryFailures` and kept. Attribute commands also wait for the kernel's planning-situation
callback and its calculated follow-up load; their library-change feedback reads the actual
placement's attributes, including a height the library adjusts:

- `groups`: the affected groups in the `get-plan-context` shape; `groupIds` for the attribute
  commands
- `changedModuleIds`: for `change-group-attribute`, and for `change-module-attribute` without `moduleId` —
  the root modules and the sub modules it set
- `gapClosed`: for `delete-article-and-compact` — `true` when the gap was closed, `false` when the
  unit was deleted as `delete-article-in-place` does
- `corrections`: what the server corrected before forwarding — the docking of
  `merge-article-into-group`, two roots of `insert-article-into-group` that are no neighbours, a
  root id read as the plan's id it abbreviates or misspells — and what the planner corrected or
  could not keep, prefixed with the command: a docking the new unit of `exchange-root-module` or `swap-root-modules` cannot take,
  a unit above that keeps its place, with the unit above that moved in and now overlaps it and the two edits that
  resolve the overlap — the agent makes one of them with one more call in the same turn (D124) —, or a deletion instead of
  closing the gap (`delete-article-and-compact`), with each named root labelled by its id and article id
  from the original group, falling back to its article name or id alone;
  after `change-module-attribute` and `change-group-attribute`, a value a root module does not take by
  the library's own check — "change-module-attribute: root module 'w1' (OTB60) does not take
  mod_FrontColor "999" - it kept its value; the values it takes: "152", …" (D107) —, and, last,
  every other attribute the library
  changed with the one set — "with mod_FrontColor "324" (Dark marble (#404040)) the library changed
  mod_FrontProgram of root module 'w1' (OTB60) from "Classic" (…) to "Modern" (Mitred frame fronts with
  glass filling)"; several root modules changed alike by article and count, "of 3 root modules
  (OTB60 ×3)" (D59). A `notLoaded` entry has one error per cause, the root modules that failed alike
  in one sentence (D73)
- `hint`: after a row edit (insert, `delete-article-and-compact`, exchange, swap) — names the units above that moved with
  the unit below them by root id and article id, also those of other groups, says when the row now reaches past a wall or into another group, and names a
  root module that now stands in front of a door or a window or on an object, with the free stretches
  of its wall (D43, D55). A turned leg is named by its original wall and the wall it now runs along
  when known, with the ids and article ids of its roots together (D52). Before/after room positions
  and rotations distinguish a rotation in place from a change of group frame

Both attribute tools append the settled raw roots' first Error/Fatal diagnostic line to
`corrections`, naming group/root ids and articles and asking for corrected attribute values or
another article. Roots with the same cause are grouped per group. Applied edits and other
roots remain; warnings and unrelated groups are omitted. Recovery uses newly calculated
geometry, retains the requested mode when original vectors are absent, and keeps the group
transform when either whole docking footprint cannot be measured.

- `delete-article-in-place`: deletes the unit and leaves the gap: units no longer docked together become
  separate groups where they stand, while a unit hanging above another one stays with it (D103);
  deleting the only unit deletes the group; generated roots
  (worktop, toe kick) cannot be deleted
- `delete-article-and-compact`: deletes the unit and closes the gap: its neighbours are docked to each
  other, the end of the row at a wall stays, a unit hung on it hangs on the neighbour that moves into
  the gap, or keeps its place when that neighbour carries a unit above already, and `corrections`
  names the units that now overlap (D42, D124); a unit at a row end is deleted and nothing else moves; a corner article between two legs
  is deleted and the gap closed by turning one leg by 90° with the units above it, and the
  `corrections` name the roots of the leg that turned, and `hint` names its original and destination wall when known (D52); wall
  units of other groups move with the units below them, each within its group, and their groups
  are returned beside the edited group (D42); the only unit is deleted with its group
  (`gapClosed: false`). `delete-article-and-compact` never splits a group
- `exchange-root-module`: the article has one root module; the new unit keeps the position and
  the docking of the replaced one; `attributes` override attributes of the new unit (`mod_Width` for
  another width: the rest of the row moves by the difference, with the units hanging from it, also
  in other groups, the end at a wall stays); a docking the new article cannot take is named in
  `corrections`
- `insert-article-into-group`: the new unit is docked to both roots of `between` (two neighbours in
  either order); the end of the row at a wall or in a corner keeps its place and the rest of the row
  moves by the unit's width; units hanging from a unit move with it, also in other groups. Two roots
  of one row that are no neighbours put the unit beside the first-named root, towards the second,
  reported in `corrections`
- `swap-root-modules`: two units change places, neighbours or not, with their attributes and the
  units hanging from them, also in other groups; the row keeps its length and its end at a wall; a
  corner article and a straight unit cannot change places
- `merge-groups`: the groups are merged into the target where they stand, like the planner's merge
  action — nothing is moved and no docking is added; groups of different libraries cannot be merged
  (the planner's message is passed on)

**Usage**:
```javascript
await mergeArticleIntoGroup({
  groupId: 'group-1',
  articleId: 'drawer-unit-600',
  dockTo: { rootId: 'root-3', ownDockingVector: 'RightBottom', dockingVector: 'LeftBottom' },
});
await changeGroupAttribute({ groupId: 'group-1', attributeId: 'front', value: 'white' });
```

### undo and redo

**Purpose**: Revert the last tool call that changed the plan, or bring it back

**When**: `undo` for a result that is not what was asked, then the corrected call; `redo` when the
user asks to redo or to bring back what was undone — another `undo` reverts one more call

**Parameters**: none

**How**: the server records every tool call that changed the plan with the planner steps it made
(one per load and group command, as the planner reports them; a kitchen with a material is two) and
the groups of the plan before and after it. `undo` steps the planner's undo history back by that many steps, each confirmed
by the history event the page relays (`onHistoryChange`), and compares the plan with the state
before the call. Only tool calls are reverted: after a change in the planner the records are
forgotten (D38).

**Returns**: `{ undone | redone: <tool> | null, groups, removedGroupIds?, otherGroupIds?, hint? }` — the
groups the reverted call changed, as they are now, the groups the revert took out of the plan, and the
others by their id (D68); every group of the plan when nothing was reverted; `null` and a
`hint` when there is nothing to undo or redo, the plan was changed in the planner, or the planner's
history no longer holds the call; an undo or redo that does not give back the plan before or after
the call (the user changed the plan in the planner while the call ran) is taken back, with a `hint`;
the planner answers a call after its last reload, so `undo` never waits for one (D77)

### find-attributes

**Purpose**: Look up attribute definitions

**Parameters**:
```typescript
{ text?: string, ids?: string[], libraryId?: string } // text or ids
```

**Usage**:
```javascript
const { matches } = await findAttributes({ text: 'front colour' });
const { matches: models } = await findAttributes({ ids: ['mod_HobId', 'mod_HandleColor'] });
```

The tool answers a question about an attribute; the `attributes` section of `get-plan-context`
lists every attribute by default and the values of those a planning sets at the create (D76); the
values of an attribute it shows with `valueCount` come from `ids` — several attributes in one call,
first in the result, in their order and uncapped; an unknown id is named in `notFound` with a
`hint`, the known ones are answered (D122). Every word of the text
is matched on its own, in any order, and colour/color, grey/gray and worktop/countertop read alike:
one search for `color` returns every colour attribute. A value
list several attributes share is listed once; the later attributes carry `sameSelectionsAs`, the
id of the attribute that lists it (D64). Every match names the root modules that carry it,
`rootModules: [{ id, name }]`, and the sub modules that carry it, `subModules: [{ id, name }]`,
when there are any (D100); the attributes the root modules in the plan and their sub modules
carry come first —
the panel top's colour, named Color like the worktop's, comes after the worktop's in a group that
has a worktop. The description tells the agent that its answer names the attribute by its name and
its id with the values it lists — `Front color` (`mod_FrontColor`) —, since several attributes can
share a name (D76).

The matches include the attributes of the roots the library generates (worktop `mr_Countertop`,
toe kick, finger grip, backsplash, …): the compacted master data lists the root modules and the
sub modules of the master data's `Root` group, which are the generated roots, as `modules`. The worktop colour is
`mod_CountertopColor`, set on the whole group with `change-group-attribute` or as a group attribute
of `create-or-replace-groups`. The desc of a colour
value carries its code — `Cloudy blue (#506080)` —, the colour of that value; the description of
`find-attributes` tells the agent to choose a dark, a light or a blue value by it (D53).

### get-price, get-order-data, get-plan-images

**Purpose**: Calculate pricing, get order data, render images

**Parameters**: None

**Timeout**: 30 seconds for `get-price`; 2 minutes for `get-order-data` and `get-plan-images`
(snapshots)

`get-price` and `get-order-data` return the planner's answer as it is, without the `downloadUri` of
its images (D7). The group and root attributes of the order data carry the library's `displayName`,
`category`, `isMain` and `displayValue`. The price and the order count
every root module of the plan, also one the library could not calculate; when the plan holds such a
root module or group, a `hint` beside the answer names it with the first line of the library's
message — "root module 'r1' (OTB60) of group 'g1' is not built - … The price includes what is not
built, without calculated dimensions and parts - say so in the answer, or change the value that
fails." — and the agent tells the user. An answer of `null` with such a root module is the hint
alone (D108).

`get-plan-images` renders when the user asks to see the plan or to look inside a cabinet, or to
compare a planning from an image with that image; a create or edit result already carries the
positions to verify, so a check needs no render. It returns one text content that names the
images, then the group view — the groups alone, seen from their front without the room (`perspectiveObjectImage`) — and the top view
of the whole plan; without groups the text says so and the top view comes alone. It asks the
snapshot for `keepOpenGeometry`: the images show the doors and drawers as they are in the planner.
Both images are JPEG at 1024 px on a white background, about 0.2 MB of tool result for a kitchen.
One camera serves all groups: where fronts face opposite directions one side is seen from behind,
and a root module not seen is not missing — `get-plan-context` lists them.

### open-or-close-group, open-or-close-article

**Purpose**: Open or close doors and drawers, so `get-plan-images` shows the inside of a cabinet

**Parameters**: `groupId` or `rootModuleId` (the ids of `get-plan-context`), `open` (boolean)

**Result**: `{ command, groups: [], removedGroupIds: [], changed: false, corrections? }` — the
view of the planner changes, the plan does not: no undo step, nothing saved, price and order
unchanged. `corrections` names a target without doors or drawers. They switch at once, and a root
module opens without the root modules docked to it.

## Usage Patterns

### Standard Workflow
```javascript
const skill = await getSkill({ name: 'kitchen-planning' }); // for a room of a kind the get-skill description lists, image-planning for an image
const context = await getPlanContext();
const newGroup = buildGroup(context);
await createOrReplaceGroups({ posGroups: [newGroup] });
const { totalPrice } = await getPrice();
```

### Extending Groups
```javascript
const context = await getPlanContext();
const group = context.groups.find(g => g.id === 'target');
// Add the new root with its relation to the root it continues
const anchorRoot = group.roots.find(r => r.freeDockingVectors?.includes('RightBottom'));
group.roots.push({ id: 'n1', articleId: 'base-unit-600', rightOf: anchorRoot.id });
await createOrReplaceGroups({ posGroups: [group] });
```

### Error Handling
```javascript
try {
  await createOrReplaceGroups({ posGroups: [group] });
} catch (error) {
  if (error.message.includes('No HI page connected')) {
    console.log('Open the ligna-store with mcp_server');
  }
}
```

## Common Errors

| Error | Cause | Solution |
|---|---|---|
| No HI page connected | No planner page on the bridge | Open the ligna-store with `mcp_server` (the URL the error names) and keep it open |
| Invalid pos groups - nothing was loaded | No group of the `create-or-replace-groups` call can be built | Fix the listed errors — each names what to send instead |
| articleId '…' is not in the article catalog | Article not in catalog (another spelling of a catalog id is read in the catalog's spelling and reported in `corrections`) | Use a valid articleId from context (the message lists them). In `create-or-replace-groups` the group is in `notLoaded`; a command tool fails |
| roots '…' are not docked to a placed root (in `notLoaded`) | A part the docking does not connect to the first root, which the server cannot dock to the free end of a row: no free row end, a wall unit without a wall-unit row | Dock it to a placed root (the error names the placed roots and the entry to send). Only for docking written as `contextData`: with relations, such a root continues the row of its kind |
| duplicate root id '…' named in the docking (in `notLoaded`) | Two roots of a group share an id that a docking entry names | Give every root a unique id |
| Root module '…' has no free docking vector '…' | `merge-article-into-group` on a side the planner reports as taken although the row ends there; a taken side with a free row end is moved there and reported in `corrections` | Use one of the root's `freeDockingVectors` (the error lists them) |
| No module of root module '…' has the attribute '…' (with `moduleId`: Module '…' has no attribute '…') | `change-module-attribute` with an attribute the master data assigns neither to the root modules nor to their sub modules (with `moduleId`: not to that sub module) | Look the attribute up with `find-attributes` — its `rootModules` name the modules that have it |
| Root module '…' is generated by the library | `delete-article-in-place` or `delete-article-and-compact` on a worktop or toe kick | Remove the article root instead; the library regenerates the rest |
| Article '…' has n root modules | `exchange-root-module` or `insert-article-into-group` with an article of several root modules | Pick an article of one root module, or rebuild with `create-or-replace-groups` |
| '…' and '…' are not in one row | `insert-article-into-group` with two roots that stand in no row together | Send two neighbours of one row — the error names the side neighbours of the first root |
| both ids name the root '…' | `swap-root-modules` with one root twice | Name the two units that change places |
| A corner article and a straight unit cannot change places | `swap-root-modules` with a corner article and a straight unit | Swap two straight units, or two corner articles |
| Groups of different libraries cannot be merged | `merge-groups` across libraries | Merge groups of one library only |
| Another operation on group '…' is still in progress | A delete or merge of the group has not finished | Wait for the first call's result |

**Corrections are no errors.** Most input mistakes are corrected and listed in `corrections` of the
result: positions on groups and roots dropped, `repositioningData` taken as the placement, a
placement the server cannot use or one on a group already in the plan not used (the planner
positions the group, an existing group keeps its position), unconnected roots docked to the free
end of a row, a unit on a taken side moved to the free end of the row, an article id read in the
catalog's spelling, a target of `place-group` or of a placement by wall moved off an overlap or
centred on a parallel alignment, a value of a placement by wall it cannot read taken as its default.
Every guard and correction:
[hi-tools-behaviour.md §8](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#8-guards-corrections-and-feedback).

## Timeouts

The timeout applies to each planner call the server makes in the page; a tool that changes the plan
is one call, which roomle-ui performs:

- Most planner calls: 30 seconds
- The tools that change the plan (`create-or-replace-groups`, `place-group`, the command tools) and snapshots (`get-order-data`, `get-plan-images`): 2 minutes

## Best Practices

1. The Planning Assistant supplies the compact library reference and, with every turn, the plan state — rooms, groups, obstacles and installationElements — as the state before the first change of the turn; without it, read them with `get-plan-context` first. Within the turn, build the next change on the result of the last one, and read again only for what a result does not carry, or after undo and redo. Image and room guidance is obtained through `get-skill`, with genuine successful results retained in history.
2. Validate article IDs before using
3. Use free docking vectors when extending
4. Position every new group with a placement — at a wall or in a room corner by `wall`, `alignment` and `offsetMm`, anywhere else by `posGroup` and `posRotationZ`
5. Edit existing groups with the command tools; resubmit a whole group only to rebuild it

## Interior Design tools

Use `get-interior-design-options` for a loaded group before adding, moving, deleting or replacing interior fittings. Four command tools implement those edits through the existing planner route. Use installed instance IDs and newly discovered destination tuples; choose replacements from that fitting's `replacementArticles`, including when no additions fit. `articleId` filters addition and replacement candidates. A fitting's `position` is where its parts start — the back left bottom corner of their boxes —, in its parent's frame (`x` right, `y` towards the back, `z` up), the frame of `insertPosition`: move a fitting by adding the offset to its position. `defaultInteriors` lists what a parent shows of its own while its container holds no fitting — its parts by name and count; any fitting added to that parent replaces all of them, and no fitting adds to them, and the corrections of an edit name a default interior it replaced or brought back. Clarify ambiguous instances. See [the complete contract](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#interior-design-tools) and [implementation ownership](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md#interior-design-fittings).
