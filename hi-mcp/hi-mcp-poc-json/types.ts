export const HI_MCP_PORT = 3100;

// The planner api of the connected page (ligna-store): the extended.* proxy,
// whose methods derive from RoomlePlanner.prototype.
export type RoomDesignerApiType = any;

export interface McpBridgeHello {
  kind: 'hello';
  example: string;
  url: string;
}

export interface McpBridgeCall {
  kind: 'call';
  id: number;
  tool: string;
  args: Record<string, unknown>;
}

export interface McpBridgeResult {
  kind: 'result';
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type McpBridgeMessage = McpBridgeHello | McpBridgeCall | McpBridgeResult;
