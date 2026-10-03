import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import type { PageBridge } from '../page-bridge';
import type { McpBridgeCall } from '../types';
import { BRIDGE_PROTOCOL } from '../types';

export type PageResponder = (method: string, args: unknown[]) => unknown;

// The minimal ws WebSocket surface PageBridge uses. With a responder it
// answers every call the way a connected page executes a planner method.
export class FakePageSocket {
  public sent: string[] = [];
  public readyState: number = WebSocket.OPEN;
  public respond: PageResponder | undefined;
  private emitter = new EventEmitter();

  public on(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.on(event, handler);
  }

  public send(data: string): void {
    this.sent.push(data);
    const respond = this.respond;
    if (respond) {
      const call = JSON.parse(data) as McpBridgeCall;
      if (call.kind !== 'call') {
        return;
      }
      queueMicrotask(() =>
        this.receive({
          kind: 'result',
          id: call.id,
          ok: true,
          result: respond(call.method, call.args),
        }),
      );
    }
  }

  public close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emitter.emit('close');
  }

  public receive(message: unknown): void {
    this.emitter.emit('message', Buffer.from(JSON.stringify(message)));
  }
}

export const attachPage = (
  bridge: PageBridge,
  hello: Record<string, unknown> = {},
): FakePageSocket => {
  const socket = new FakePageSocket();
  bridge.attachPage(socket as unknown as WebSocket);
  socket.receive({
    kind: 'hello',
    example: 'ligna-store',
    url: 'http://localhost:3000/?store.stage=INT&id=ps_demo',
    protocol: BRIDGE_PROTOCOL,
    ...hello,
  });
  return socket;
};
