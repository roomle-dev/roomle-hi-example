# HI MCP Server Skill

**Load this skill when the task involves:** MCP server architecture, HTTP handling, SSE bridge, Model Context Protocol implementation, tool registration, or server-side logic in `hi-mcp-server.js`.

## Overview

The HI MCP Server is a zero-dependency Node.js server that implements the Model Context Protocol (MCP) to enable AI agents to orchestrate HOMAG Intelligence (HI) object groups in live Roomle room-planner sessions.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  HI MCP Server (Node.js)                   │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  HTTP Server │    │   MCP Layer  │    │  SSE Bridge  │  │
│  │   (port 3100)│    │ (JSON-RPC)   │    │   (SSE+fetch)│  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Tool Execution                        │  │
│  │  - get-plan-context                                  │  │
│  │  - create-or-replace-groups                          │  │
│  │  - place-group                                       │  │
│  │  - get-price                                         │  │
│  │  - get-order-data                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Bridge to Browser                    │  │
│  │  Relay tool calls to roomDesignerApi.extended        │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Browser Page    │
                     │  (index.html)    │
                     │  roomDesignerApi │
                     └─────────────────┘
```

### Key Components

#### 1. HTTP Server (`createServer`)
- **Port**: 3100 (configurable via `PORT` constant)
- **Static serving**: Serves `index.html` and other static files
- **Routes**:
  - `GET /` — Serves index.html
  - `POST /mcp` — MCP endpoint (Streamable HTTP)
  - `GET /bridge` — SSE endpoint for page bridge
  - `POST /bridge/result` — Result endpoint for page bridge

#### 2. MCP Protocol Layer
- **Protocol**: JSON-RPC over HTTP with Streamable HTTP support
- **Versions**: Supports `2025-06-18`, `2025-03-26`, `2024-11-05`
- **Transport**: Hand-rolled implementation (no external dependencies)
- **Capabilities**: Tools, Resources, Prompts

#### 3. SSE Bridge
- **Technology**: Server-Sent Events (SSE) + fetch
- **Purpose**: Connect MCP server to browser page context
- **Flow**:
  1. Page opens with `?mcp=true` parameter
  2. Server establishes SSE connection to page
  3. MCP tool calls are relayed to page via SSE
  4. Page executes calls against `roomDesignerApi.extended`
  5. Results returned via fetch to `/bridge/result`

## Server Lifecycle

### Startup Sequence

1. Parse command line arguments
2. Create HTTP server
3. Set up MCP state (connected clients, page connections, timeouts)
4. Define tools in `TOOLS` array
5. Start listening on port 3100
6. Open browser (unless `--no-open` flag is set)

### Request Handling

All requests are routed through a central handler:
- Static files served from the server directory
- MCP requests handled via JSON-RPC protocol
- SSE bridge connections managed separately

## MCP Implementation Details

### Protocol Version Negotiation

The server supports multiple MCP protocol versions and negotiates with the client.

### Tool Registration

Tools are defined with:
- Name
- Description
- Input schema
- Handler function

### MCP Request Types

1. **Initialize** - Establish session, get server capabilities
2. **Tools/List** - Get available tools
3. **Tools/Call** - Execute a tool
4. **Resources/List** - List available resources
5. **Resources/Read** - Read resource content

### Error Handling

All errors returned in MCP-compatible format with proper error codes.

## SSE Bridge Implementation

### Connection Flow

The bridge connects MCP server to browser page:
1. Page opens with `?mcp=true`
2. Server establishes SSE connection
3. Tool calls relayed to page via SSE
4. Page executes against `roomDesignerApi.extended`
5. Results returned via fetch

### Server-Side

- Manages page connections with cleanup
- Validates bridge messages
- Relays tool calls and results

### Client-Side (index.html)

- Establishes SSE connection when `?mcp=true`
- Executes tool calls against `roomDesignerApi.extended`
- Returns results via fetch to `/bridge/result`

## Tool Execution Flow

1. MCP Client sends tool/call request
2. Server validates request
3. Server sends tool call to page via SSE
4. Page executes tool via `roomDesignerApi.extended`
5. Page returns result via fetch
6. Server forwards result to MCP client

## Timeouts and Error Handling

- Default timeout: 30 seconds
- Snapshot calls: 2 minutes (120 seconds)
- Proper error codes for all scenarios
- Comprehensive logging

## Static File Serving

Serves static files from server directory with proper content types.

## Command Line Interface

```bash
# Start server and open browser
node hi-mcp-server.js

# Start server without opening browser
node hi-mcp-server.js --no-open
```

## Browser Integration

The `index.html` page:
- Loads Roomle planner/editor
- Exposes `roomDesignerApi.extended` globally
- Sets up MCP bridge when `?mcp=true` is in URL
- Provides preset configurations

## Performance Considerations

- Memory usage per page connection
- CPU usage for image generation and snapshots
- Connection limits (currently unlimited)

## Development Guidelines

### Adding New Tools

1. Define tool in `TOOLS` array
2. Implement handler with error handling
3. Add JSDoc documentation
4. Update documentation
5. Test thoroughly

### Modifying Existing Tools

1. Understand current behavior
2. Maintain backward compatibility
3. Update schema if needed
4. Test with existing clients

## Common Issues and Solutions

| Issue | Solution |
|---|---|
| Page not connecting | Ensure `?mcp=true` parameter |
| Tools timing out | Check if expensive operation, increase timeout |
| Invalid parameters | Validate against schema |
| CORS errors | Verify headers and client configuration |

## Useful Commands

```bash
npm start
npm start -- --no-open
PORT=4000 node hi-mcp-server.js
```
