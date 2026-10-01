# HI MCP Tools Skill

**Load this skill when the task involves:** MCP tool definitions, tool parameters, usage patterns, error handling for specific tools.

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
no agent can open, three quarters of the tokens)

**Article size**: per root module of an article, `dimensions` lists the size attributes with id,
name and value in millimetres (Furniture_Smith: `mod_Width`, `mod_Depth`, `mod_Height`; the panels
`mod_UprightDepth`, `mod_UprightHeight`; the range hood `DU` and the TV `SM_TV` have none). A root
in `groups` carries the same ids among its `attributes`; a group's `position.footprint` gives
`widthMm`/`depthMm` of the whole group. A unit is resized with `change-module-attribute` and the
attribute id, never its name.

**Trusted descriptions**: every `desc` (article, root, module, attribute, attribute value) is
authoritative, and `dimensions` give the size. The agent evaluates an image (`get-plan-images`, a
user picture) only for what no `desc` and no dimension states — the rule is in
`get-authoring-rules` and in the descriptions of `get-plan-context` and `get-plan-images`.

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

**Returns**: Created/updated groups, deleted IDs, log messages, and a `hint` naming any group of the call that is still unpositioned (it sits at the plan origin — a group gets its position from the placement it is created with)

**Usage**:
```javascript
await createOrReplaceGroups({ posGroups: [group1, group2] });
```

**Positioning**: a new group carries `placement: { posGroup, posRotationY, rootId? }` —
`posGroup` the room point of the group's back left bottom corner, `posRotationY` the rotation in
degrees, counter-clockwise as seen from above; `rootId` only with two corner articles, naming the
one that goes into the corner `posGroup` names. One kitchen is one group: dock every further unit
instead of positioning it. Against a wall: `posRotationY` = the wall's `facingRotationY`,
`posGroup` = the wall's `end` (flush into that corner) or a point from `end` towards `start`; in a
corner: the corner point and the `facingRotationY` of the wall that ends there (for a right-handed
corner article the server adds 90°, see the table in the authoring rules). See the
[authoring rules skill](./hi-authoring-rules.md#positioning-a-group).

**Existing groups**: a group resubmitted with its id and without placement keeps its position; a
placement on a group that is already in the plan is rejected — move it with `place-group`.

### place-group

**Purpose**: Move an existing group against a wall or into a room corner; the server computes the
position

**Parameters**:
```typescript
{
  groupId: string,                       // a unique prefix is accepted
  wall: 'left' | 'right' | 'top' | 'bottom' | number, // side label or wall index
  alignment?: 'start' | 'center' | 'end' | 'left' | 'right' | 'top' | 'bottom', // default 'center'
  offsetMm?: number,                     // along the wall, default 0
  roomIndex?: number,                    // default 0
}
```

A side label as alignment means flush into the corner with that adjoining wall (`wall: 'right'`,
`alignment: 'top'` is the back right corner); a group with a corner article goes into that corner.
A target that meets another group is rejected and the group is not moved.

**Returns**: `placedIn` (`'corner'` or `'wall'`), the wall, and the resulting group with its
`position`

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
'change-module-attribute': { rootModuleId: string, moduleId?: string, attributeId: string, value: string | boolean }
'change-group-attribute':  { groupId: string, attributeId: string, value: string | boolean }
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
id in `subModules`). `value` numbers are passed as strings. `dockTo.ownDockingVector` is one of
the root's `freeDockingVectors`; the pairs are the docking pairs of the
[authoring rules](./hi-authoring-rules.md#valid-docking-pairs).

**Returns**: `{ command, groups, removedGroupIds, changedModuleIds? }` once the planner has loaded
the result — the affected groups in the `get-plan-context` shape; `changedModuleIds` for
`change-group-attribute`

- `delete-root-module`: units no longer docked together become separate groups where they stand;
  removing the only unit removes the group; generated roots (worktop, toe kick) cannot be removed
- `exchange-root-module`: the article has one root module; the new unit keeps the position and
  the docking of the replaced one
- `merge-groups`: the groups are merged into the target where they stand, like the planner's merge
  action — nothing is moved and no docking is added; groups of different libraries are rejected

**Usage**:
```javascript
await mergeArticleIntoGroup({
  groupId: 'group-1',
  articleId: 'drawer-unit-600',
  dockTo: { rootId: 'root-3', ownDockingVector: 'RightBottom', dockingVector: 'LeftBottom' },
});
await changeGroupAttribute({ groupId: 'group-1', attributeId: 'front', value: 'white' });
```

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
// Add new root docked to existing
const anchorRoot = group.roots.find(r => r.freeDockingVectors?.length > 0);
// ... add docking and new root
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
  // Check logMessages for warnings even on success
}
```

## Common Errors

| Error | Cause | Solution |
|---|---|---|
| No page connected | Page not loaded with ?mcp=true | Open browser page |
| Invalid articleId | Article not in catalog | Use valid articleId from context |
| roots '…' are not docked to a placed root | A root or a chain the docking does not connect to the first root of the group | Dock it to a placed root (the error names the placed roots) |
| roots '…' are docked to the RightBottom of root '…' with the same mode and offset | Two roots on one side vector at the same place | Continue the row from the free side vector of its last unit |
| repositioningData is not supported | Payload with a `repositioningData` field | Use `placement` |
| placement takes only posGroup, posRotationY and rootId | A stale field (`wall`, `alignment`, …) in the placement | Give `posGroup` and `posRotationY` from a wall, or create the group and call `place-group` |
| placement: rootId must be the id of one of the group's roots | `rootId` names no root of the group | Name a root of the group, or leave `rootId` out |
| placement positions a new group only | A placement on a group that is already in the plan | Resubmit the group without placement, or move it with `place-group` |
| Placement rejected - the group was not moved | `place-group` target meets another group | Dock the units to that group instead (the error names its free docking vectors) |
| Alignment '…' runs parallel to this '…' wall | `place-group` alignment names a wall parallel to the target wall | Use `start`, `center`, `end` or the side label of an adjoining wall |
| Root module '…' has no free docking vector '…' | `merge-article-into-group` names an occupied vector | Use one of the root's `freeDockingVectors` (the error lists them) |
| Module '…' has no attribute '…' | `change-module-attribute` with an attribute the module's master data does not assign (planners with roomle-ui `fix/hi-attribute-commands-RML-18004`; older builds report success and change nothing) | Look the attribute up with `find-attributes` — its `rootModules` name the modules that have it |
| Root module '…' is generated by the library | `delete-root-module` on a worktop or toe kick | Remove the article root instead; the library regenerates the rest |
| Article '…' has n root modules | `exchange-root-module` with an article of several root modules | Pick an article of one root module, or rebuild with `create-or-replace-groups` |
| Groups of different libraries cannot be merged | `merge-groups` across libraries | Merge groups of one library only |
| Another operation on group '…' is still in progress | A delete or merge of the group has not finished | Wait for the first call's result |

## Timeouts

The tools run in the server; the timeout applies to each planner call they make in the page:

- Most planner calls: 30 seconds
- Loading groups (`create-or-replace-groups`, `place-group`, the command tools) and snapshots (`get-order-data`, `get-plan-images`): 2 minutes

## Best Practices

1. Always start with `get-plan-context`
2. Validate article IDs before using
3. Use free docking vectors when extending
4. Check logMessages for warnings
5. Position every new group with a placement — for a wall, its end point and its facingRotationY
6. Edit existing groups with the command tools; resubmit a whole group only to rebuild it
