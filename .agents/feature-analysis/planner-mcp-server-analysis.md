# Planner MCP Server Analysis - roomle-model-exporter

> **Status**: Implemented  
> **Type**: Feature Analysis  
> **Domain**: MCP Server Architecture, Roomle Planner Integration  
> **Source**: [roomle-model-exporter/docs/mcp-server.md](../../../roomle-model-exporter/docs/mcp-server.md)  
> **Date**: 2026-09-25  
> **Author**: AI Assistant

---

## Executive Summary

The **Planner MCP Server** in roomle-model-exporter is a sophisticated Model Context Protocol (MCP) implementation that provides LLM agents with live, programmatic control over a headless Roomle planner instance. It enables AI assistants to create, modify, and analyze 3D room plans through a comprehensive set of tools that abstract the Roomle SDK's complexity.

This analysis document provides a complete architectural breakdown, implementation details, deployment models, and comparative analysis with the HI MCP server in roomle-hi-example.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Components](#2-core-components)
3. [Protocol Implementation](#3-protocol-implementation)
4. [Tool Capabilities](#4-tool-capabilities)
5. [Coordinate System](#5-coordinate-system)
6. [Session Management](#6-session-management)
7. [Rendering Pipeline](#7-rendering-pipeline)
8. [Security Model](#8-security-model)
9. [Deployment Models](#9-deployment-models)
10. [Comparative Analysis with HI MCP Server](#10-comparative-analysis-with-hi-mcp-server)
11. [Strengths and Limitations](#11-strengths-and-limitations)
12. [Recommendations](#12-recommendations)

---

## 1. Architecture Overview

### 1.1 Design Philosophy

The Planner MCP Server follows a **headless, worker-based architecture** that:

- **Isolates** the Roomle SDK in a separate process (worker) to prevent state pollution
- **Exposes** SDK capabilities through a clean MCP tool interface
- **Maintains** strict unit consistency (millimeters throughout)
- **Supports** both local development and cloud deployment
- **Prioritizes** security with fine-grained access control

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MCP Client (Claude, etc.)                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Transport Layer (stdio/HTTP)                         │
│  ┌─────────────────────┐  ┌──────────────────────────────────────────┐ │
│  │   stdio.ts           │  │         http.ts (Streamable HTTP)          │ │
│  │  - Bun stdio         │  │  - POST /mcp endpoint                       │ │
│  │  - Local development │  │  - Cloud Run / Cloudflare deployment      │ │
│  └─────────────────────┘  └──────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         runtime.ts (MCP Runtime)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  - Tool registry and dispatch                                       │ │
│  │  - Request serialization (one at a time)                            │ │
│  │  - Session lifecycle management                                      │ │
│  │  - Environment configuration                                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       session.ts (PlannerSession)                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  - Unix socket IPC with worker process                                │ │
│  │  - Request/response framing                                           │ │
│  │  - Worker boot and shutdown management                                │ │
│  │  - Product ID tracking for inserted objects                            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    session-worker.ts (Worker Process)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  - HeadlessRoomleSdk instance                                         │ │
│  │  - Headless planner initialization                                      │ │
│  │  - Operation execution (load, call, snapshot, etc.)                   │ │
│  │  - Event tracking (onPlanChanged, onSelectionChange, etc.)             │ │
│  │  - Bridge to SDK internals                                             │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Bun (JavaScript runtime) | Fast startup, native TypeScript |
| MCP SDK | @modelcontextprotocol/sdk | MCP protocol implementation |
| Roomle SDK | @roomle/web-sdk | 3D room planning |
| Transport | Unix domain sockets | Inter-process communication |
| Framing | Custom binary protocol | Efficient message passing |
| Rendering | THREE.js | 3D scene rendering |

---

## 2. Core Components

### 2.1 Transport Layer

#### stdio.ts
- **Purpose**: Local development transport via standard I/O
- **Use Case**: Claude Desktop on local machine
- **Protocol**: MCP over stdio (JSON-RPC)
- **Boot Time**: ~400ms
- **Behavior**: Starts worker in background, tool listing responds immediately

#### http.ts
- **Purpose**: Remote deployment via HTTP
- **Protocol**: Streamable HTTP with JSON-RPC
- **Endpoints**:
  - `POST /mcp` - Main MCP endpoint
  - `GET /healthz` - Health check
  - `GET /readyz` - Readiness check
  - `GET /` - Health check
  - `POST /internal/snapshot` - Save plan snapshot
  - `POST /internal/restore` - Restore plan from ID

### 2.2 Runtime (runtime.ts)

The `McpRuntime` interface is the central coordination point:

```typescript
interface McpRuntime {
  session: PlannerSession;           // Worker process manager
  tools: Tool[];                     // Registered MCP tools
  instructions: string;              // Server instructions
  allowEval: boolean;                // Eval tool permission
  sessionReady(): Promise<void>;     // Boot worker on first call
  serialized<T>(work: () => Promise<T>): Promise<T>;  // Sequential execution
  pendingCalls(): number;            // Current call count
  shutdown(reason: string): Promise<void>;  // Clean shutdown
}
```

**Key Features:**
- **Lazy Initialization**: Worker boots on first tool call
- **Request Serialization**: All tool calls execute sequentially (no interleaving)
- **Automatic Restart**: Restarts dead workers automatically
- **Environment Configuration**: Reads from process.env

### 2.3 Session Management (session.ts)

`PlannerSession` manages the worker process lifecycle:

```typescript
class PlannerSession {
  // State
  proc: Bun.spawn result          // Worker process
  server: Bun.listen result         // Unix socket server
  framed: FramedSocket              // Binary framing
  pending: Map<number, Pending>     // In-flight requests
  nextRequestId: number            // Request counter
  tmpDir: string                   // Temporary directory
  socketPath: string               // IPC socket path
  
  // Lifecycle
  start(): Promise<void>           // Boot worker
  restart(): Promise<void>         // Restart worker
  shutdown(): Promise<void>        // Clean shutdown
  dispose(): void                 // Cleanup temp files
  
  // Operations
  load(scene: SceneSource): Promise<SessionResult>
  request(op: SessionOp, body?: Buffer): Promise<SessionResult>
  
  // Tracking
  recordInsert(runtimeId: number, productId: string)
  productIdOf(runtimeId: number): string | null
  status(): SessionStatus
}
```

**Communication Protocol:**
1. Creates Unix domain socket at temporary path
2. Spawns worker process with `IPC_SOCKET` environment variable
3. Uses `FramedSocket` for binary message framing
4. Implements request/response matching via IDs
5. Handles timeouts (default: 180,000ms = 3 minutes)

### 2.4 Worker Process (session-worker.ts)

The worker process contains the actual Roomle SDK instance:

```typescript
// Initialization
const sdk = await HeadlessRoomleSdk.create({
  configuratorId: CONFIGURATOR_ID,
  animateCamera: false,
  customApiUrl: WORKER_API_URL,
});
await sdk.createHeadlessPlanner();
const planner = await sdk.getPlannerApi();
planner.disableSnapping();

// Roots for reflection
const roots: BridgeRoots = {
  planner,
  sdk,
  THREE,
  get sceneManager() { return planner.getSceneManager(); },
  get scene() { return planner.getScene(); },
};

// Bridge for reflection tools
const bridge = new Bridge(roots);
roots.h = bridge.handleScope;
```

**Event Tracking:**
Watches SDK callbacks for:
- `onPlanChanged`
- `onPlanElementChanged`
- `onSelectionChange`
- `onSelectionCancel`
- `onCompletelyLoaded`
- `onItemsLoaded`

Events are collected and returned with each operation response.

### 2.5 Bridge (bridge.ts)

The `Bridge` class provides reflective access to the SDK object graph:

```typescript
class Bridge {
  handles: HandleTable;           // Handle table for object references
  
  // Reflection operations
  call(path: string, args: unknown[]): Promise<unknown>
  callAtomic(path: string, args: unknown[]): Promise<unknown>
  get(path: string): unknown
  set(path: string, value: unknown): unknown
  evaluate(code: string): Promise<unknown>
  inspect(path: string): { type: string; members: string[] }
  
  // Internal
  resolve(path: string): Resolved   // Navigate object graph
  present(value: unknown): unknown  // Serialize for transport
}
```

**Path Resolution:**
- Splits paths like `planner.getSceneManager` into segments
- Navigates from root objects (planner, sdk, THREE, sceneManager, scene)
- Supports nested property access
- Handles null/undefined gracefully

---

## 3. Protocol Implementation

### 3.1 Binary Framing (protocol.ts, session-protocol.ts)

Custom binary protocol for efficient message passing:

```
┌─────────────────────────────────────────┐
│ Frame Header (8 bytes)                    │
│ ┌──────────┬──────────┐                 │
│ │ jsonLen  │ bodyLen  │ (both uint32 LE)  │
│ └──────────┴──────────┘                 │
├─────────────────────────────────────────┤
│ JSON Header (variable length)              │
│ { type, id, op, args, ... }                │
├─────────────────────────────────────────┤
│ Binary Body (optional, for large payloads) │
│ - Plan XML (can be very large)             │
│ - Snapshot PNG                              │
│ - GLB/USDZ export                           │
└─────────────────────────────────────────┘
```

**Frame Functions:**
```typescript
function frameBytes(header: object, body: Buffer | null): Buffer {
  const headerBuf = Buffer.from(JSON.stringify(header), 'utf8');
  const bodyBuf = body ?? Buffer.alloc(0);
  const lens = Buffer.alloc(8);
  lens.writeUInt32LE(headerBuf.byteLength, 0);
  lens.writeUInt32LE(bodyBuf.byteLength, 4);
  return Buffer.concat([lens, headerBuf, bodyBuf]);
}
```

### 3.2 Message Types

#### Session Protocol (session-protocol.ts)

**Requests (SessionRequest):**
```typescript
type SessionOp =
  | { op: 'load'; scene: WireScene }
  | { op: 'call'; path: string; args: unknown[]; atomic?: boolean }
  | { op: 'get'; path: string }
  | { op: 'inspect'; path: string }
  | { op: 'overview' }
  | { op: 'savePlan' }
  | { op: 'setColor'; runtimeId: number; rgb: number }
  | { op: 'set'; path: string; value: unknown }
  | { op: 'eval'; code: string }
  | { op: 'snapshot'; view: SnapshotView; size: number; ssaa: number; runtimeIds?: number[] }
  | { op: 'frames'; count: number }
  | { op: 'settle'; timeoutMs: number }
  | { op: 'export'; format: SessionExportFormat }

type SessionRequest = { type: 'request'; id: number } & SessionOp;
```

**Responses (SessionReply):**
```typescript
interface SessionReply {
  type: 'reply';
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
  ms: number;
  events: string[];           // SDK callbacks that fired
  bytes?: number;            // Binary body size
  contentType?: string;      // MIME type for binary body
}
```

**Special Messages:**
```typescript
interface SessionReadyMessage {
  type: 'ready';
  bootMs: number;             // Worker boot time in ms
}

{ type: 'shutdown' }         // Request worker to exit
```

### 3.3 Scene Source Encoding

To handle large plan XML efficiently:

```typescript
type SceneSource =
  | { kind: 'id'; id: string }
  | { kind: 'planXml'; planXml: string }
  | { kind: 'configurationString'; configurationString: string }

type WireScene =
  | { kind: 'id'; id: string }
  | { kind: 'planXml'; bytes: number }           // Body carries actual XML
  | { kind: 'configurationString'; bytes: number }  // Body carries actual JSON

function toWire(scene: SceneSource): { wire: WireScene; body: Buffer | null }
function fromWire(wire: WireScene, body: Buffer): SceneSource
```

---

## 4. Tool Capabilities

### 4.1 Tool Categories

The server provides **32 tools** across 7 categories:

| Category | Tools | Count | Purpose |
|----------|-------|-------|---------|
| Session | `session_status`, `session_reset` | 2 | Worker state management |
| Scene | `new_plan`, `load_scene`, `get_plan_xml`, `share_plan` | 4 | Plan lifecycle |
| Guidance | `design_guidelines` | 1 | Design rules and best practices |
| Catalog | `search_products`, `preview_product` | 2 | Product discovery |
| Planner | `draw_walls`, `insert_objects`, `edit_objects`, `select_object`, `move_camera`, `undo`, `redo`, `plan_overview` | 8 | Core planning operations |
| Reflection | `describe_api`, `inspect`, `call`, `get_property`, `set_property`, `eval` | 6 | SDK introspection |
| Rendering | `snapshot`, `step_frames`, `settle`, `export_scene` | 4 | Visual output |

### 4.2 Tool Details

#### Session Tools

**`session_status`**
- Returns: pid, uptime, boot time, calls made, last scene, API index size
- Read-only, no parameters
- Use: Check worker health and state

**`session_reset`**
- Action: Kill worker and boot fresh one
- Effect: Discards scene, handles, undo history
- Use: Recover from corrupted state

#### Scene Tools

**`new_plan`**
- Action: Start empty plan
- Required: Before any mutation in fresh session
- Behavior: Restarts worker if scene already loaded (loading empty plan doesn't clear existing objects)

**`load_scene`**
- Parameters: Exactly one of:
  - `id`: Catalog item, configuration, or plan ID
  - `planXml`: Inline plan XML
  - `configurationString`: Inline configuration JSON
- Replaces current scene

**`get_plan_xml`**
- Returns: Current plan as XML string
- Use: Checkpoint before risky edits
- Can be fed back to `load_scene`

**`share_plan`**
- Action: Save current plan as Roomle snapshot
- Returns: URL that opens in Roomle planner
- Fallback: Returns plan XML on failure

#### Guidance Tools

**`design_guidelines`**
- Source: `src/mcp/design-guidelines.json`
- Parameters:
  - `query`: Room type or furniture piece
  - `limit`: Rules to return (default: 12)
- Returns: Size ranges, furnishing checklists, placement rules
- Structure: Rules have `source` field for provenance tracking

#### Catalog Tools

**`search_products`**
- **Purpose**: Find products in Roomle catalog
- **Parameters**:
  - `filter`: Global constraints (room, style, material, color, shape, catalogs)
  - `searches`: Array of per-piece searches
  - `queries`: Shorthand for text-only searches
  - `query`: Single text-only search
  - `previews`: Number of inline images (0-3 per search, max 12 total)
  - `limit`: Results per search
- **Per-search parameters**:
  - `label`: User-defined name for the piece
  - `query`: Text description
  - `likeIds`: Similar to these rapiIds
  - `likePlaced`: Similar to currently placed products
  - `imageUrl`: Visual similarity matching
  - `type`, `detailType`: Category filters
  - `maxWidth`, `maxDepth`, `maxHeight`: Size constraints (mm)
- **Returns**: rapiId, size, tags, notes, distance, total matches
- **Limitations**:
  - Max 12 searches per call
  - Max 50 results per search (8 for single search)
  - Max 1000 offset
  - AI-generated placeholders excluded by default

**`preview_product`**
- **Purpose**: Show catalog images for up to 8 rapiIds
- **Note**: Usually unnecessary - `search_products` can return images directly
- **Caveat**: Only works for rapiIds from previous `search_products` call (URL caching)

#### Planner Tools

**`draw_walls`**
- **Purpose**: Define room geometry
- **Parameters**:
  - `walls`: Array of wall segments
  - Each wall: `from`, `to` (PlanPoint), optional `thickness` (mm, default 120), `height` (mm, default 2800)
- **Coordinate System**: Millimeters, z=0
- **Note**: Walls are centered on drawn line, usable floor starts 60mm inside

**`insert_objects`**
- **Purpose**: Place products in the plan
- **Parameters**:
  - `objects`: Array of object definitions
  - Each object: `id` (rapiId), `key` (name), `position` OR `nextTo`, `facing`, optional `color`
- **Placement Options**:
  - `position`: Absolute center position (mm)
  - `nextTo`: Relative placement to existing object
    - `runtimeId`: Existing object ID
    - `key`: Earlier object in same call
    - `side`: left, right, front, behind
    - `gap`: Distance in mm (default: 400)
- **Behavior**:
  - Objects inserted in order
  - Keys must appear before being referenced
  - Doors/windows snap to nearest wall
  - Returns runtimeId per object, also by key
- **Constraints**: Furniture must not intersect walls

**`edit_objects`**
- **Purpose**: Modify existing objects
- **Parameters**:
  - `edits`: Array of edit operations
  - Each edit: `runtimeId` (required), plus one of:
    - `position`: New absolute position
    - `nextTo`: New relative position
    - `facing`: New orientation
    - `color`: New hex color
    - `remove`: Delete object
- **Behavior**: Each edit runs as separate undo step

**`plan_overview`**
- **Purpose**: Get current plan state
- **Returns**:
  - `area`: Total area in mm²
  - `bounds`: Overall dimensions
  - `rooms`: Array of rooms with:
    - `area`, `bounds`: Room dimensions
    - `objects`: Objects in this room
  - `objects`: All objects with:
    - `runtimeId`, `catalogItemId`, `label`
    - `center`: Position (mm)
    - `dimensions`: Size (mm)
    - `rotation`: Radians
    - `facing`: Derived from rotation
    - `productId`: From tracking
- **Use**: Always call before editing to get valid runtimeIds

**`select_object`**
- **Purpose**: Select object by runtimeId
- **Use**: For selection-scoped SDK calls

**`move_camera`**
- **Parameters**:
  - `yaw`, `pitch`: Radians
  - `distance`: Meters
  - `targetX`, `targetY`, `targetZ`: Meters
- **Affects**: `screenshot` view

**`undo` / `redo`**
- **Purpose**: Navigate undo history
- **Scope**: One interaction step per call

#### Reflection Tools

**`describe_api`**
- **Purpose**: Search SDK API documentation
- **Parameters**:
  - `query`: Method name, keyword, or type name
  - `limit`: Results per section (default: 12)
- **Returns**: Matching signatures with doc comments and type definitions
- **Source**: `src/mcp/api-index.json` (939 SDK members, 507 types)

**`inspect`**
- **Purpose**: List live members of any object
- **Parameters**: `path` to object
- **Returns**: Type name and all members (including prototype chain)

**`call`**
- **Purpose**: Call any method by path
- **Parameters**:
  - `path`: Dot notation path to method
  - `args`: Arguments array
  - `atomic`: If true, wraps in undo step
- **Access**: Can call private methods
- **Note**: Only tool requiring authentication in remote deployments

**`get_property`**
- **Purpose**: Read any property
- **Example**: `sceneManager._cameraControl3D._camera.fov`

**`set_property`**
- **Purpose**: Write any property

**`eval`**
- **Purpose**: Execute arbitrary JavaScript
- **Scope Variables**: `planner`, `sdk`, `sceneManager`, `scene`, `THREE`, `h`
- **Security**: Gated by `MCP_ALLOW_EVAL` environment variable
- **Warning**: Arbitrary code execution - never enable on shared hosts

#### Rendering Tools

**`snapshot`**
- **Purpose**: Render plan as PNG
- **Parameters**:
  - `view`: `perspective`, `screenshot`, or `top`
  - `size`: Resolution (pixels)
  - `ssaa`: Super-sampling anti-aliasing factor
  - `runtimeIds`: Subset of objects to frame (for `top` view)
- **Returns**: PNG image
- **Note**: `top` view has +y up, +x right

**`step_frames`**
- **Purpose**: Advance render loop
- **Parameters**: `count` of frames to advance

**`settle`**
- **Purpose**: Wait until scene stops changing
- **Parameters**: `timeoutMs` (default: 8000ms for snapshots)
- **Returns**: `quiet` or `timeout`

**`export_scene`**
- **Purpose**: Export scene to 3D format
- **Parameters**: `format` (`glb` or `usdz`)
- **Returns**: File path

---

## 5. Coordinate System

### 5.1 Plan Space

- **Units**: Millimeters (consistent across all tools)
- **Axes**:
  - **x**: Right (positive)
  - **y**: Into the plan / depth (positive)
  - **z**: Up (positive)
- **Origin**: Object center
- **Z-position**: Bottom of object (z=0 for floor-standing objects)

### 5.2 Orientation

- **Facing**: Which way the object's front points
- **Values**: `-y`, `+x`, `+y`, `-x`
- **Rotation**:
  - 0 radians = facing `-y`
  - Positive rotation = counter-clockwise
  - Conversion: `toFacing(rotation)` and `toRotation(facing)`

### 5.3 Example

A 4m × 3m room:
- x: 0 to 4000
- y: 0 to 3000
- Wall thickness: 120mm (centered on drawn line)
- Usable floor: starts 60mm inside wall
- Accessible via `rooms[].bounds` from `plan_overview`

### 5.4 SDK Conversion

The Roomle SDK uses different units internally:
- `insertObject`: Meters with y up
- Conversion handled in `src/mcp/placement.ts`:

```typescript
function toSceneMetres({ x, y, z }: PlanPoint) {
  return { 
    x: x / 1000, 
    y: z / 1000, 
    z: y / -1000 
  };
}
```

This is the **only place** where coordinate systems meet.

---

## 6. Session Management

### 6.1 Worker Lifecycle

1. **Boot**: 
   - Runtime creates `PlannerSession`
   - Session starts Unix socket server
   - Session spawns worker process
   - Worker initializes SDK and connects back
   - Boot time: ~400ms

2. **First Tool Call**:
   - Triggers `sessionReady()` if not already booted
   - Worker boots if not running
   - Request is queued until ready

3. **Request Processing**:
   - Requests are serialized (one at a time)
   - Each request gets unique ID
   - Timeout: 180,000ms (3 minutes)
   - Worker processes and responds

4. **Worker Death**:
   - Automatic restart on next tool call
   - Plan is empty after restart
   - Use `load_scene` with last snapshot ID to restore

5. **Shutdown**:
   - Graceful shutdown on SIGINT/SIGTERM
   - Cleans up pending requests
   - Sends shutdown message to worker
   - Waits for worker to exit
   - Cleans up temporary files

### 6.2 State Management

**State Location**:
- **Worker Process**: Holds the actual Roomle SDK instance and scene
- **Session**: Manages worker lifecycle, not scene state
- **MCP Server**: Stateless - state is in worker

**State Isolation**:
- Each HTTP request creates new transport/server pair
- But all share the same `PlannerSession` (same worker)
- Worker state accumulates across calls
- Only `session_reset` or worker restart clears state

**Concurrency Model**:
- Requests are **serialized** (one at a time)
- No interleaving of tool calls
- Cloud Run: Up to 80 concurrent requests queued
- Worker processes requests sequentially from queue

---

## 7. Rendering Pipeline

### 7.1 Snapshot Generation

**`snapshot` tool flow:**

1. **Settle**: Wait for scene to stop changing (8000ms timeout)
2. **Render**:
   - `top` view: Use `planner.prepareTopImage()`
   - `screenshot`/`perspective`: Use `runExport()`
3. **Return**: PNG as base64-encoded image

**Top Image**:
```typescript
async function topImage(size: number, runtimeIds?: number[]) {
  const { image } = await planner.prepareTopImage({
    size,
    ...(runtimeIds?.length ? { runtimeIds } : {}),
  });
  return Buffer.from(
    String(image).replace(/^data:image\/\w+;base64,/, ''),
    'base64',
  );
}
```

### 7.2 Export Generation

**`export_scene` tool flow:**

Uses `run-export.ts` to export to GLB or USDZ:

```typescript
const out = await runExport(sdk, format, options);
return {
  result: { format, bytes: out.bytes },
  body: out.body,
  contentType: out.contentType,
};
```

### 7.3 GL Keepalive

**Purpose**: Prevent GPU context loss in headless mode

- Uses `gl-keepalive.ts` to periodically trigger WebGL operations
- Prevents GPU driver from timing out
- Critical for long-running worker processes

---

## 8. Security Model

### 8.1 Access Control (access.ts)

**Policy Configuration**:
```typescript
interface AccessPolicy {
  bearerToken: string | null;    // From MCP_BEARER_TOKEN
  cidrs: Cidr[];                // From MCP_ALLOWED_CIDRS
}
```

**Default Policy**:
- Bearer token: Not set (null)
- CIDRs: `160.79.104.0/21` (Anthropic's egress range)

**Token Presentation**:
1. `X-API-Key` header (checked first)
2. `Authorization: Bearer <token>`
3. `Authorization: <token>` (bare)

**IP-based Access**:
- Checks `X-Forwarded-For` header (Cloud Run)
- Falls back to socket address
- Converts IPv6-mapped IPv4 addresses
- Validates against configured CIDRs

### 8.2 Protected Operations

**Guarded Methods** (require authentication):
- `tools/call` - Only reflection call tool is protected

**Open Operations**:
- All other tools (session, scene, catalog, planner, rendering)
- Server discovery
- Tool listing

**Rationale**:
- `call` allows arbitrary SDK method invocation
- Could potentially be used for unintended operations
- Other tools have controlled, safe operations

### 8.3 Local vs Remote Security

**Local (stdio)**:
- No authentication (local machine only)
- All tools available
- `MCP_ALLOW_EVAL` enables `eval` tool

**Remote (HTTP)**:
- CIDR-based access for Anthropic clients
- Bearer token required for `call` tool
- `MCP_ALLOW_EVAL` should never be enabled
- IP allowlist for development

---

## 9. Deployment Models

### 9.1 Local Development

**Command**:
```bash
bun run mcp        # stdio mode
bun run mcp:http   # HTTP mode
```

**Environment**:
- Loads `.env` file automatically
- Sets `MCP_API_URL`, `MCP_CONFIGURATOR_ID`, `MCP_ALLOW_EVAL`

**Claude Desktop Configuration**:
```json
{
  "mcpServers": {
    "roomle-planner": {
      "command": "/Users/you/.bun/bin/bun",
      "args": ["run", "/absolute/path/to/roomle-model-exporter/src/mcp/stdio.ts"],
      "env": {
        "MCP_CONFIGURATOR_ID": "demoConfigurator",
        "MCP_ALLOW_EVAL": "1"
      }
    }
  }
}
```

### 9.2 Cloud Run Deployment

**Configuration**:
- `MCP_MODE=1`: Run HTTP MCP server instead of export pool
- Image: Same Docker image as export service
- Instances: Max 1 (`--max-instances 1`)
- Idle timeout: 15 minutes (`MCP_IDLE_EXIT_MS=900000`)

**Environment Variables**:
| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MCP_BEARER_TOKEN` | Yes | - | Authentication token |
| `MCP_ALLOWED_CIDRS` | No | `160.79.104.0/21` | Allowed IP ranges |
| `PORT` | No | 3000 | HTTP port |

**GitHub Actions**: `.github/workflows/cd-gcp.yaml`
- Deploys on push to `feat/planner-mcp` or `master`
- Service name: `roomle-planner-mcp-test`
- Region: `europe-west1`

**Client Connection**:
```bash
# Get URL
gcloud run services describe roomle-planner-mcp-test \
  --region europe-west1 --project rml-showcases \
  --format 'value(status.url)'

# Claude Code
claude mcp add --transport http roomle-planner <URL>/mcp \
  --header "X-API-Key: <MCP_BEARER_TOKEN>"
```

**Behavior**:
- Stateless Streamable HTTP
- GET /mcp returns 405
- Tool calls run sequentially
- Cold start: Few seconds (worker + planner boot)
- Can use `--min-instances 1` to eliminate cold starts

### 9.3 Cloudflare Deployment

**Architecture**:
- Cloudflare Containers for worker processes
- Cloudflare Worker as edge proxy
- Per-user container allocation

**Features**:
- Each roomle.com user gets their own container
- Container sleeps after 15 minutes without calls
- Container retired after 4 hours
- Plan snapshot saved before sleep/retire
- Next call restores snapshot to fresh container

**Authentication**:
- Google OAuth via Cloudflare Worker
- Only roomle.com accounts (configurable)
- Session cookie for persistence

**Setup**:
1. Google OAuth consent screen setup
2. Create KV namespace for session storage
3. Configure secrets:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `COOKIE_ENCRYPTION_KEY`
   - `MCP_INTERNAL_TOKEN`
4. Repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

**GitHub Actions**: `.github/workflows/cd-cloudflare.yaml`

**Client Connection**:
- URL: `https://roomle-planner-mcp.<account>.workers.dev/mcp`
- Authentication: Browser-based OAuth flow
- No headers required for authenticated users

**Behavior**:
- Plan follows user across chats
- Multiple chats share same planner
- Tool discovery served by Worker
- Only tool calls run in container
- Idle connector costs nothing
- Logo served at `/roomle-planner-mcp-logo-512.png`

---

## 10. Comparative Analysis with HI MCP Server

### 10.1 Architecture Comparison

| Feature | Planner MCP Server | HI MCP Server (roomle-hi-example) |
|---------|---------------------|-----------------------------------|
| **Transport** | stdio + HTTP | HTTP only (Streamable HTTP) |
| **Runtime** | Bun | Node.js (no dependencies) |
| **SDK Access** | HeadlessRoomleSdk (full) | roomDesignerApi.extended (browser) |
| **Worker Model** | Separate process (Unix socket) | Same process (in-page) |
| **State** | Worker process | Browser page |
| **Coordinate System** | Millimeters, x-right, y-depth, z-up | Millimeters, same system |
| **Unit Conversion** | Centralized in placement.ts | Handled by browser API |
| **Dependencies** | @modelcontextprotocol/sdk, @roomle/web-sdk | Zero dependencies |
| **Start Time** | ~400ms | Immediate (page already loaded) |

### 10.2 Capability Comparison

**Planner MCP Server Has:**
- ✅ Full Roomle SDK access
- ✅ Headless operation (no browser needed)
- ✅ Direct SDK method invocation
- ✅ Arbitrary code execution (eval)
- ✅ GLB/USDZ export
- ✅ Cloud deployment (Cloud Run, Cloudflare)
- ✅ Per-user isolation (Cloudflare)
- ✅ Complete catalog search
- ✅ Design guidelines
- ✅ Snapshot sharing

**HI MCP Server Has:**
- ✅ Zero dependencies
- ✅ Browser-based (uses existing page)
- ✅ Server-Sent Events bridge
- ✅ Simpler deployment
- ✅ HI-specific authoring rules
- ✅ Group-based placement
- ✅ Docking vector support

**Both Have:**
- ✅ MCP protocol support
- ✅ Plan creation and modification
- ✅ Product search and placement
- ✅ Rendering (snapshots)
- ✅ Undo/redo
- ✅ Plan overview

### 10.3 Use Case Fit

**Planner MCP Server is Better For:**
- Autonomous AI agents creating complete room plans
- Complex multi-step planning workflows
- Access to full SDK capabilities
- Cloud deployment scenarios
- High-volume, automated planning
- Testing and blind evaluation

**HI MCP Server is Better For:**
- Human-in-the-loop planning with AI assistance
- HI-specific authoring workflows
- Simple, lightweight deployment
- Development and experimentation
- Environments where Bun/dependencies are not available
- Direct integration with existing Roomle planner page

### 10.4 Design Philosophy Differences

| Aspect | Planner MCP Server | HI MCP Server |
|--------|---------------------|----------------|
| **Complexity** | High (full SDK) | Low (focused) |
| **Isolation** | Process-level | Page-level |
| **Portability** | Requires Bun + dependencies | Zero-dependency |
| **Flexibility** | Full SDK access | HI-specific operations |
| **Performance** | Process overhead | Direct in-page |
| **Maintenance** | Complex (SDK updates) | Simple |

---

## 11. Strengths and Limitations

### 11.1 Strengths

✅ **Comprehensive SDK Access**
- Full Roomle SDK capabilities available
- Reflection tools allow exploration of SDK internals
- Can call any method, read/write any property

✅ **Robust Architecture**
- Clean separation between transport, runtime, session, worker
- Process isolation prevents state corruption
- Well-defined protocol with binary framing
- Automatic worker restart on failure

✅ **Production-Ready Deployment**
- Multiple deployment options (stdio, HTTP, Cloud Run, Cloudflare)
- Per-user isolation in Cloudflare
- Fine-grained access control
- Health checks and monitoring

✅ **Developer Experience**
- Fast local development with stdio
- Comprehensive documentation
- Well-structured codebase
- Clear error handling

✅ **Testing Framework**
- Smoke tests (`bun run smoke:mcp`)
- Blind test methodology
- Automated grading with `plan_overview` and `snapshot`

✅ **Coordinate System Consistency**
- All tools use same unit system (millimeters)
- Clear conversion layer for SDK internals
- Well-documented axis conventions

### 11.2 Limitations

⚠️ **Complexity**
- Significant codebase complexity
- Multiple processes and protocols to understand
- Dependencies on Bun and Roomle SDK

⚠️ **Resource Intensive**
- Each worker consumes GPU resources
- Headless SDK has overhead
- Not suitable for very high concurrency

⚠️ **State Management**
- Worker state is shared across all calls
- No per-conversation isolation (Claude limitation)
- Cloud Run: All users share one planner
- Cloudflare: All user chats share one planner

⚠️ **Security Concerns**
- `eval` tool allows arbitrary code execution
- `call` tool can invoke any SDK method
- Must be carefully configured in production

⚠️ **Deployment Constraints**
- Requires Bun runtime
- Cloud Run: Cold starts can be slow
- Cloudflare: Complex OAuth setup required

⚠️ **Known Issues**
- `THREE` is project's instance, not SDK's (instanceof may fail)
- Not integrated with `RenderWorkerPool`
- `preview_product` only works with cached URLs from `search_products`
- Some catalog items fail to construct
- No per-chat isolation (Claude limitation)

⚠️ **Coordinate Edge Cases**
- SDK mixes units internally
- Conversion only happens in placement.ts
- Bypassing typed tools with `call` requires manual conversion

---

## 12. Recommendations

### 12.1 For roomle-hi-example

**Consider Adopting from Planner MCP Server:**

1. **Coordinate System**: Adopt the millimeter-based system consistently
2. **Design Guidelines**: Integrate `design-guidelines.json` for AI guidance
3. **Error Handling**: Adopt the structured error response pattern
4. **Documentation**: Use the comprehensive tool documentation style
5. **Testing**: Implement smoke tests and blind test methodology

**Avoid in roomle-hi-example:**

1. **Process Model**: Keep the zero-dependency, in-page approach
2. **Complex Reflection**: The HI MCP server doesn't need full SDK reflection
3. **Multiple Transports**: HTTP-only is sufficient for the use case

### 12.2 For Planner MCP Server

**Potential Improvements:**

1. **Per-Chat Isolation**: Work with Claude team to support conversation IDs
2. **Better Error Recovery**: More graceful handling of failed SDK operations
3. **Performance Optimization**: Reduce worker boot time
4. **Resource Limits**: Add configurable limits on plan complexity
5. **Audit Logging**: Enhanced logging for security auditing
6. **Rate Limiting**: Protect against abuse in shared deployments

### 12.3 Architecture Patterns to Share

1. **Framed Protocol**: The binary framing approach could be useful for other MCP servers
2. **Worker Isolation**: Process isolation pattern for stateful tools
3. **Access Control**: CIDR + token authentication model
4. **Deployment Patterns**: Cloud Run and Cloudflare deployment configurations

### 12.4 Documentation Improvements

The Planner MCP Server documentation is excellent and could serve as a template for:
- Tool parameter documentation
- Usage examples
- Deployment guides
- Troubleshooting sections

---

## Conclusion

The Planner MCP Server in roomle-model-exporter represents a **production-grade, comprehensive implementation** of MCP for Roomle planning. It demonstrates sophisticated architecture patterns including process isolation, custom binary protocols, and multi-environment deployment.

While complex, it provides **unparalleled flexibility** for AI agents to control Roomle's 3D planning capabilities. The HI MCP Server in roomle-hi-example takes a different, simpler approach that is more appropriate for its focused use case of HI authoring assistance.

Both servers serve different but complementary purposes, and there is **valuable knowledge transfer** opportunity between the two projects, particularly in areas of coordinate systems, tool design patterns, and deployment strategies.

---

## Appendix A: Environment Variables Reference

| Variable | Default | Description | Planner MCP | HI MCP |
|----------|---------|-------------|-------------|---------|
| `MCP_CONFIGURATOR_ID` | demoConfigurator | Roomle configurator ID | ✅ | ✅ |
| `MCP_API_URL` | SDK default | RAPI origin | ✅ | ✅ |
| `MCP_ALLOW_EVAL` | off | Enable eval tool | ✅ | ❌ |
| `MCP_REQUEST_TIMEOUT_MS` | 180000 | Per tool call timeout | ✅ | ❌ |
| `MCP_BOOT_TIMEOUT_MS` | 180000 | Worker boot timeout | ✅ | ❌ |
| `MCP_PLAN_URL_TEMPLATE` | roomle.com | Share plan URL template | ✅ | ❌ |
| `MCP_MODE` | unset | Run HTTP MCP server | ✅ | ❌ |
| `PORT` | 3000 | HTTP port | ✅ | ✅ (3100) |
| `MCP_IDLE_EXIT_MS` | 900000 | Idle exit timeout | ✅ | ❌ |
| `MCP_ALLOWED_CIDRS` | 160.79.104.0/21 | Allowed IP ranges | ✅ | ❌ |
| `MCP_BEARER_TOKEN` | unset | Authentication token | ✅ | ❌ |

---

## Appendix B: Tool Usage Example

Complete workflow example from documentation:

```
1. new_plan
2. draw_walls [(0,0)->(5000,0), (5000,0)->(5000,4000), (5000,4000)->(0,4000), (0,4000)->(0,0)]
3. search_products:
   - filter: {room: [living-room]}
   - searches: [
     {label: sofa, query: "three seater sofa fabric modern", detailType: [living_couch], maxWidth: 2400},
     {label: table, query: "coffee table wood round", type: [table], maxHeight: 550}
     ]
   - previews: 2
4. insert_objects:
   - [{ key: sofa, id: <sofa-id>, position: {x:2500, y:3400, z:0}, facing: "-y" },
      { key: table, id: <table-id>, nextTo: {key: sofa, side: "front", gap: 450}, facing: "-y" }]
5. search_products: {label: lamp, likePlaced: true, detailType: [lamp_standing]}
6. plan_overview -> validate placement (gap should be ~447mm)
7. snapshot: {view: "top"}
8. edit_objects: [{ runtimeId: 41, facing: "+x" }]
9. snapshot: {view: "perspective"}
```

---

## Appendix C: File Structure

```
roomle-model-exporter/src/mcp/
├── stdio.ts              # stdio transport entry point
├── http.ts               # HTTP transport entry point
├── runtime.ts            # MCP runtime and server
├── session.ts            # Worker session management
├── tools.ts              # All tool definitions
├── placement.ts          # Coordinate system utilities
├── access.ts             # Access control and authentication
├── product-search.ts      # Catalog search implementation
├── product-vocabulary.json # Product category definitions
├── design-guidelines.ts   # Guideline search implementation
├── design-guidelines.json # Design rules and best practices
├── api-index.ts          # SDK API index loader
├── api-index.json        # SDK API documentation
├── plan-snapshot.ts       # Plan snapshot utilities
└── instructions.md        # Server instructions

roomle-model-exporter/src/worker/
├── session-worker.ts     # Worker process main
├── protocol.ts           # Binary framing protocol
├── session-protocol.ts   # Session message types
├── bridge.ts             # Reflection bridge
├── transport.ts          # Unix socket transport
├── handles.ts            # Object handle management
├── load-source.ts        # Scene loading
├── gl-keepalive.ts       # WebGL keepalive
├── render-throttle.ts    # Render throttling
├── render-worker.ts      # Render worker
└── run-export.ts         # Export generation
```

---

*Analysis completed on 2026-09-25*
