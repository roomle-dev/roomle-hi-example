# HI MCP Tools Skill

**Load this skill when the task involves:** MCP tool definitions, tool parameters, usage patterns, error handling for specific tools.

## Tool Overview

### Core Tools
| Tool | Purpose |
|---|---|
| `get-plan-context` | Get rooms, articles, groups, masterData |
| `create-or-replace-groups` | Create/modify groups |
| `place-group` | Move existing group |
| `get-authoring-rules` | Get HI authoring rules |

### Information Tools
| Tool | Purpose |
|---|---|
| `find-attributes` | Look up attribute definitions |

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

**Returns**: Rooms, articles, groups, masterData (if requested)

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

**Returns**: Created/updated groups, deleted IDs, log messages

**Usage**:
```javascript
await createOrReplaceGroups({ posGroups: [group1, group2] });
```

### place-group

**Purpose**: Move existing group to different wall

**Parameters**:
```typescript
{ groupId: string, wall?: string | number, alignment?: string, offsetMm?: number }
```

**Usage**:
```javascript
await placeGroup({ groupId: 'group-1', wall: 'right', alignment: 'center' });
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
| Root not docked | Undocked root in group | Dock all non-first roots |
| Invalid wall | Wall doesn't exist | Use valid wall from room.walls |
| Placement overlap | Group overlaps existing | Adjust placement |

## Timeouts

- Most tools: 30 seconds
- `get-price`, `get-order-data`, `get-plan-images`: 2 minutes

## Best Practices

1. Always start with `get-plan-context`
2. Validate article IDs before using
3. Use free docking vectors when extending
4. Check logMessages for warnings
5. Use placement for walls, repositioningData for precise coordinates
