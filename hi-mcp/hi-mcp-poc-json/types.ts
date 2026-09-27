export const HI_MCP_PORT = 3100;

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
