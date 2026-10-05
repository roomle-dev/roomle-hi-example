# HI MCP Tools Skill

**Load this skill when the task involves:** MCP tool definitions, tool parameters, usage patterns, error handling for specific tools.

The behaviour reference — every guard, correction and feedback message, and the decisions behind
them — is [`hi-mcp/docs/hi-mcp-behaviour.md`](../../hi-mcp/docs/hi-mcp-behaviour.md).

## Tool Overview

### Core Tools
| Tool | Purpose |
|---|---|
| `get-plan-context` | Get rooms, articles, groups, masterData |
| `create-or-replace-groups` | Create, modify and extend groups; position new groups |
| `place-group` | Move an existing group against a wall or into a room corner |
| `get-authoring-rules` | Get HI authoring rules |

### Information Tools
| Tool | Purpose |
|---|---|
| `find-attributes` | Look up attribute definitions |

### Editing Tools
| Tool | Purpose |
|---|---|
| `change-module-attribute` | Set an attribute of a root module or sub module |
| `change-group-attribute` | Set an attribute on every module of a group that has it |
| `delete-group` | Remove a group |
| `delete-root-module` | Remove one unit; the rest splits where it is no longer docked together |
| `merge-article-into-group` | Dock one more unit to a free docking vector of a root |
| `exchange-root-module` | Replace a unit with an article, keeping its docking |
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
| `get-plan-images` | Render plan images |

## Tool Reference

### get-plan-context

**Purpose**: Get complete session state

**Parameters**:
```typescript
{ include?: Array<'masterData' | 'rooms' | 'articles' | 'groups'> }
```

**Returns**: Rooms, articles, groups, masterData (if requested). Like every JSON result of the
server: compact JSON without the `imageUrl` fields of the planner's plan context (signed CDN URLs
no agent can open, three quarters of the tokens). Every wall carries a `name` in the user's words
(back wall, front wall, left wall, right wall) beside its `side`, a door opening the `type`
`opening`, and every room a `corners` list — per corner its `name` (back left, …), `point` and the
`posRotationY` of a corner kitchen there — so a corner placement is a lookup

**Article size**: per root module of an article, `dimensions` lists the size attributes with id,
name and value in millimetres (Furniture_Smith: `mod_Width`, `mod_Depth`, `mod_Height`; the panels
`mod_UprightDepth`, `mod_UprightHeight`; the range hood `DU` and the TV `SM_TV` have none). A root
in `groups` carries the same ids among its `attributes`; a group's `position.footprint` gives
`widthMm`/`depthMm` of the whole group. A group's `position.pos` and `rotationY` are what a
placement would name for it: the room point of its back left bottom corner and the rotation of the
placement, whatever origin the planner keeps the group at — the agent reads back what it placed. A
group with two corner articles also carries `position.rootId`, the corner article `pos` belongs to. A unit is resized with `change-module-attribute` and the
attribute id, never its name.

**Trusted descriptions**: every `desc` (article, root, module, attribute, attribute value) is
authoritative, and `dimensions` give the size, over the catalog images of the master data
(`imageUrl`). The rule covers only the catalog images, not the renderings of `get-plan-images` or
an image the user attaches. It is in `get-authoring-rules` and in the description of
`get-plan-context`. The server strips every `imageUrl` from its results today.

**Usage**:
```javascript
const context = await getPlanContext({ include: 'rooms,articles' });
```

### create-or-replace-groups

**Purpose**: Create new groups or replace existing ones

**Parameters**:
```typescript
{ posGroups: PosGroup[] }
```

**Roots**: `{ id, articleId, attributes? }` plus one relation that names the neighbour — `rightOf`,
`leftOf`, `onTop` (`align`, `gapMm`), `above` (`gapMm`) or `behind`. The server builds the docking
(`contextData`) from it, including the Top vectors of a wall unit beside a tall unit and the hang
gap of a wall unit above a floor unit — see the
[authoring rules skill](./hi-authoring-rules.md#relations). `contextData` is still accepted; a group
from `get-plan-context` carries it.

**Materials**: a root's `attributes` are overrides of that unit. A material for the whole kitchen
(fronts, worktop, carcase) goes into the group's `attributes`; the server sets every group attribute
that is not one of the library's group settings on every unit and generated root after the load and
reports it. An override only a generated root carries (the worktop colour on a base unit) is moved
to the group, and the colours of the generated roots a resubmitted group carries are set again.

**Returns**: `loaded` (the planner's object ids), `groups` (every group in the plan), a `hint` naming any group of the call that is still unpositioned (it sits at the plan origin — a group gets its position from the placement it is created with), `corrections` (what the server changed in the input) and `notLoaded` (`[{ index, id?, rootIds?, errors }]` — the groups it could not build and, with `rootIds`, the roots of a loaded group it could not build (an unknown article id drops the root, not the group), each error naming what to send instead; the other groups and roots load). A group id the agent gave an earlier group of the session replaces that group; a new group at the place of another gets a `hint`; `dockTo` on a root is read as its relation

**Usage**:
```javascript
await createOrReplaceGroups({ posGroups: [group1, group2] });
```

**Positioning**: a new group carries `placement: { posGroup, posRotationY, rootId? }` —
`posGroup` the room point of the group's back left bottom corner, `posRotationY` the rotation in
degrees, counter-clockwise as seen from above; `rootId` only with two corner articles, naming the
one that goes into the corner `posGroup` names. One kitchen is one group: relate every further unit
to its neighbour instead of positioning it. Against a wall: `posRotationY` = the wall's `facingRotationY`,
`posGroup` = the wall's `end` (flush into that corner) or a point from `end` towards `start`; in a
corner: the corner point and the `facingRotationY` of the wall that ends there (for a right-handed
corner article the server adds 90° itself, see the table in the authoring rules). `posGroup` is the
back left bottom corner for every article — the server places the anchor by the back left bottom
corner of its docking vectors, also for a range hood whose origin is its centre. See the
[authoring rules skill](./hi-authoring-rules.md#positioning-a-group).

**Existing groups**: a group resubmitted with its id and without placement keeps its position; a
placement on a group that is already in the plan is not used (the group keeps its position, and
`corrections` says so) — move it with `place-group`.

### place-group

**Purpose**: Move an existing group against a wall or into a room corner; the server computes the
position

**Parameters**:
```typescript
{
  groupId: string,                       // a unique prefix is accepted
  wall: 'left' | 'right' | 'top' | 'bottom' | 'back' | 'front' | number, // side label or wall index
  alignment?: 'start' | 'center' | 'end' | 'left' | 'right' | 'top' | 'bottom' | 'back' | 'front', // default 'center'
  offsetMm?: number,                     // along the wall, default 0
  roomIndex?: number,                    // default 0
}
```

A side label as alignment means flush into the corner with that adjoining wall (`wall: 'right'`,
`alignment: 'top'` is the back right corner); a group with a corner article goes into that corner.
`back` and `front` name the `top` and `bottom` wall. Groups may touch. A target that overlaps
another group (footprints and height ranges overlap by more than 5 mm) is moved along the same wall
to the nearest free position; into a corner, or without a free position on the wall, the group is
placed as asked. An alignment parallel to the target wall centres the group. The reload carries
the generated roots (worktop, toe kick) with the group, so their colours stay; a group that already
stands where asked is not reloaded.

**Returns**: `placedIn` (`'corner'` or `'wall'`), the wall, and the resulting group with its
`position`, plus `corrections` when the server corrected the request (an overlap, a parallel
alignment, a group that already stands there)

**Usage**:
```javascript
await placeGroup({ groupId: 'group-1', wall: 'right', alignment: 'top' });
```

### The command tools

**Purpose**: Edit a group that is already in the plan. Each tool forwards one command to the
planner's group command API (`externalObjectGroupOperation`), which performs it with the planner's
own group features; the group keeps its position

**Parameters**:
```typescript
'change-module-attribute': { rootModuleId: string, moduleId?: string, attributeId: string, value: string | number | boolean }
'change-group-attribute':  { groupId: string, attributeId: string, value: string | number | boolean }
'delete-group':            { groupId: string }
'delete-root-module':      { rootModuleId: string }
'merge-article-into-group': {
  groupId: string, articleId: string, attributes?: { id, value }[],
  dockTo: { rootId: string, ownDockingVector: string, dockingVector: string,
            mode?: 'StartStart' | 'EndEnd' | 'StartEnd' | 'EndStart', offset?: [x, y, z] },
}
'exchange-root-module':    { groupId: string, rootModuleId: string, articleId: string }
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
unit or a range hood merged `*Top -> *Bottom` on a floor unit without a y offset gets the hang gap
of the wall units (D35), reported.

**Returns**: `{ command, groups, removedGroupIds, changedModuleIds? }` once the planner has loaded
the result — the affected groups in the `get-plan-context` shape; `changedModuleIds` for
`change-group-attribute`; `corrections` when the server corrected the input before forwarding
(`merge-article-into-group`, `exchange-root-module`)

- `delete-root-module`: units no longer docked together become separate groups where they stand;
  removing the only unit removes the group; generated roots (worktop, toe kick) cannot be removed
- `exchange-root-module`: the article has one root module; the new unit keeps the position and
  the docking of the replaced one
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

**Parameters**: none

**How**: the server records every tool call that changed the plan with the planner steps it made
(one per load, group command and removal; a kitchen with a material is two) and the raw groups
before and after it. `undo` steps the planner's undo history back by that many steps, each confirmed
by the history event the page relays (`onHistoryChange`), and compares the plan with the state
before the call. Only tool calls are reverted: after a change in the planner the records are
forgotten (D38). The anchor probe undoes its own load, so it leaves no step.

**Returns**: `{ undone | redone: <tool> | null, groups, hint? }` — every group of the plan; `null` and a
`hint` when there is nothing to undo or redo, the plan was changed in the planner, or the planner's
history no longer holds the call; an undo or redo that does not give back the plan before or after
the call (the user changed the plan in the planner while the call ran) is taken back, with a `hint`;
`undo` waits for a late follow-up reload of the last call and says when it is still outstanding

### find-attributes

**Purpose**: Look up attribute definitions

**Parameters**:
```typescript
{ text: string, libraryId?: string }
```

**Usage**:
```javascript
const { matches } = await findAttributes({ text: 'front' });
```

The matches include the attributes of the roots the library generates (worktop `mr_Countertop`,
toe kick, finger grip, backsplash, …) — the worktop colour is `mod_CountertopColor`, set on the
kitchen with `change-group-attribute`. Needs a planner with roomle-ui
`fix/hi-attribute-commands-RML-18004`; older builds leave these attributes out of the master data
([analysis](../bug-analysis/worktop-colour-not-discoverable.md)).

### get-price, get-order-data, get-plan-images

**Purpose**: Calculate pricing, get order data, render images

**Parameters**: None (or viewport options for images)

**Timeout**: 2 minutes (expensive operations)

## Usage Patterns

### Standard Workflow
```javascript
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
  if (error.message.includes('No page connected')) {
    console.log('Open page with ?mcp=true');
  }
}
```

## Common Errors

| Error | Cause | Solution |
|---|---|---|
| No page connected | Page not loaded with ?mcp=true | Open browser page |
| Invalid pos groups - nothing was loaded | No group of the `create-or-replace-groups` call can be built | Fix the listed errors — each names what to send instead |
| articleId '…' is not in the article catalog | Article not in catalog (another spelling of a catalog id is read in the catalog's spelling and reported in `corrections`) | Use a valid articleId from context (the message lists them). In `create-or-replace-groups` the group is in `notLoaded`; a command tool fails |
| roots '…' are not docked to a placed root (in `notLoaded`) | A part the docking does not connect to the first root, which the server cannot dock to the free end of a row: no free row end, a wall unit without a wall-unit row | Dock it to a placed root (the error names the placed roots and the entry to send). Only for docking written as `contextData`: with relations, such a root continues the row of its kind |
| duplicate root id '…' named in the docking (in `notLoaded`) | Two roots of a group share an id that a docking entry names | Give every root a unique id |
| Root module '…' has no free docking vector '…' | `merge-article-into-group` on a side the planner reports as taken although the row ends there (a stale docking entry after a deletion); a taken side with a free row end is moved there and reported in `corrections` | Use one of the root's `freeDockingVectors` (the error lists them) |
| Module '…' has no attribute '…' | `change-module-attribute` with an attribute the module's master data does not assign (planners with roomle-ui `fix/hi-attribute-commands-RML-18004`; older builds report success and change nothing) | Look the attribute up with `find-attributes` — its `rootModules` name the modules that have it |
| Root module '…' is generated by the library | `delete-root-module` on a worktop or toe kick | Remove the article root instead; the library regenerates the rest |
| Article '…' has n root modules | `exchange-root-module` with an article of several root modules | Pick an article of one root module, or rebuild with `create-or-replace-groups` |
| Groups of different libraries cannot be merged | `merge-groups` across libraries | Merge groups of one library only |
| Another operation on group '…' is still in progress | A delete or merge of the group has not finished | Wait for the first call's result |

**Corrections are no errors.** Most input mistakes are corrected and listed in `corrections` of the
result: positions on groups and roots dropped, `repositioningData` taken as the placement, a
placement the server cannot use or one on a group already in the plan not used (the planner
positions the group, an existing group keeps its position), unconnected roots docked to the free
end of a row, a unit on a taken side moved to the free end of the row, an article id read in the
catalog's spelling, a `place-group` target moved off an overlap or centred on a parallel alignment.
Every guard and correction:
[hi-mcp-behaviour.md §8](../../hi-mcp/docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback).

## Timeouts

The tools run in the server; the timeout applies to each planner call they make in the page:

- Most planner calls: 30 seconds
- Loading groups (`create-or-replace-groups`, `place-group`, the command tools) and snapshots (`get-order-data`, `get-plan-images`): 2 minutes

## Best Practices

1. Always start with `get-plan-context`
2. Validate article IDs before using
3. Use free docking vectors when extending
4. Position every new group with a placement — for a wall, its end point and its facingRotationY
5. Edit existing groups with the command tools; resubmit a whole group only to rebuild it
