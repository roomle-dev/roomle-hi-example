import { WebSocket } from 'ws';
import type { McpBridgeCall, McpBridgeMessage } from './types';
import { BRIDGE_PROTOCOL } from './types';

export const DEFAULT_CALL_TIMEOUT_MS = 30_000;
export const SNAPSHOT_CALL_TIMEOUT_MS = 120_000;

interface PendingCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class PageBridge {
  private _page: WebSocket | null = null;
  private _pageUrl = '';
  private _pageProtocol: number | undefined;
  private _clientId: string | undefined;
  private _nextCallId = 1;
  private _pendingCalls = new Map<number, PendingCall>();

  public attachPage(socket: WebSocket): void {
    socket.on('message', (data) => {
      let message: McpBridgeMessage;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (typeof message !== 'object' || message === null) {
        return;
      }
      if (message.kind === 'hello') {
        if (this._page && this._page !== socket) {
          socket.close(4409, 'Planner session in use');
          return;
        }
        this._page = socket;
        this._pageUrl = message.url;
        this._pageProtocol = message.protocol;
        this._clientId = message.clientId;
        socket.send(JSON.stringify({ kind: 'ready' }));
        console.log(`[hi-mcp] page connected: ${message.url}`);
        return;
      }
      // every call goes to the active page, so only the active page answers
      if (message.kind === 'result' && socket === this._page) {
        const pendingCall = this._pendingCalls.get(message.id);
        if (!pendingCall) {
          return;
        }
        this._pendingCalls.delete(message.id);
        clearTimeout(pendingCall.timeout);
        if (message.ok) {
          pendingCall.resolve(message.result);
        } else {
          pendingCall.reject(new Error(message.error ?? 'Tool call failed'));
        }
      }
    });
    socket.on('close', () => {
      if (this._page === socket) {
        console.log(`[hi-mcp] page disconnected: ${this._pageUrl}`);
        this._page = null;
        this._clientId = undefined;
        this._rejectPendingCalls('The demo page disconnected');
      }
    });
  }

  private _rejectPendingCalls(reason: string): void {
    for (const pendingCall of this._pendingCalls.values()) {
      clearTimeout(pendingCall.timeout);
      pendingCall.reject(new Error(reason));
    }
    this._pendingCalls.clear();
  }

  public isClientActive(clientId: string): boolean {
    return this._page?.readyState === WebSocket.OPEN && this._clientId === clientId;
  }

  public async call(
    method: string,
    args: unknown[],
    timeoutMs: number = DEFAULT_CALL_TIMEOUT_MS,
    clientId?: string,
  ): Promise<unknown> {
    if (clientId && !this.isClientActive(clientId)) {
      throw new Error('This chat is not connected to its planner page');
    }
    const page = this._page;
    if (!page || page.readyState !== WebSocket.OPEN) {
      throw new Error(
        'No HI page connected. Have the user open the ligna-store in their browser at ' +
          (process.env.HI_MCP_STORE_URL ??
            'http://localhost:3000/?store.stage=INT') +
          ' and start planning there - the page connects to this server on its own, and the ' +
          'tools work in that tab while it stays open.',
      );
    }
    if (this._pageProtocol !== BRIDGE_PROTOCOL) {
      throw new Error(
        `The connected page (${this._pageUrl}) runs an outdated HI MCP page bridge that expects tool calls. ` +
          `Have the user update the page bridge to protocol ${BRIDGE_PROTOCOL} (ligna-store hi-mcp/browser-bridge.ts, ` +
          'minimal-hi-example/index.html) and reload the page.',
      );
    }
    const id = this._nextCallId++;
    console.log(
      `[hi-mcp] call ${id}: ${method} ${JSON.stringify(args).slice(0, 400)}`,
    );
    const call: McpBridgeCall = { kind: 'call', id, method, args };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingCalls.delete(id);
        reject(
          new Error(`Planner call '${method}' timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);
      this._pendingCalls.set(id, { resolve, reject, timeout });
      page.send(JSON.stringify(call));
    });
  }
}
