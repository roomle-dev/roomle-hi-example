import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveBridgeUrls, startMcpBrowserBridge } from '../browser-bridge';
import { BRIDGE_PROTOCOL } from '../types';

const PAGE_URL = 'http://localhost:3000/?store.stage=INT&id=ps_demo';

// The browser WebSocket surface the bridge uses
class FakeWebSocket {
  public static instances: FakeWebSocket[] = [];
  public sent: string[] = [];
  public close = vi.fn(() => this.onclose?.({ code: 1000 }));
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => Promise<void>) | null = null;
  public onerror: (() => void) | null = null;
  public onclose: ((event: { code: number }) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  public send(data: string): void {
    this.sent.push(data);
  }
}

const startBridge = (
  extended: Record<string, unknown>,
  pageUrl = PAGE_URL
): FakeWebSocket => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('window', { location: { href: pageUrl, protocol: 'http:' } });
  startMcpBrowserBridge({ extended });
  const socket = FakeWebSocket.instances[0];
  socket.onopen?.();
  return socket;
};

const eventsOf = (socket: FakeWebSocket) =>
  socket.sent
    .map((data) => JSON.parse(data))
    .filter((message) => message.kind === 'event');

const receive = (socket: FakeWebSocket, message: unknown) =>
  socket.onmessage?.({
    data: typeof message === 'string' ? message : JSON.stringify(message),
  });

const repliesOf = (socket: FakeWebSocket) =>
  socket.sent
    .map((data) => JSON.parse(data))
    .filter((message) => message.kind === 'result');

describe('startMcpBrowserBridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('announces itself with the bridge protocol version', () => {
    const socket = startBridge({});
    expect(JSON.parse(socket.sent[0])).toEqual({
      kind: 'hello',
      example: 'ligna-store',
      url: PAGE_URL,
      protocol: BRIDGE_PROTOCOL,
    });
  });

  it('keeps the api_key of the chat window out of the announced page url', () => {
    const socket = startBridge(
      {},
      `${PAGE_URL}&model=gpt-5-mini&api_key=secret-key&mcp_server=http://localhost:3100`
    );
    const { url } = JSON.parse(socket.sent[0]);
    expect(url).toBe(
      `${PAGE_URL}&model=gpt-5-mini&mcp_server=http%3A%2F%2Flocalhost%3A3100`
    );
    expect(url).not.toContain('secret-key');
  });

  it('executes an exposed planner method with its positional arguments', async () => {
    const getExternalObjectPlanContext = vi.fn(async () => ({ articles: [] }));
    const socket = startBridge({ getExternalObjectPlanContext });
    await receive(socket, { kind: 'ready' });
    await receive(socket, {
      kind: 'call',
      id: 7,
      method: 'getExternalObjectPlanContext',
      args: [['articles']],
    });
    expect(getExternalObjectPlanContext).toHaveBeenCalledWith(['articles']);
    expect(repliesOf(socket)).toEqual([
      { kind: 'result', id: 7, ok: true, result: { articles: [] } },
    ]);
  });

  it('executes undo and redo', async () => {
    const undo = vi.fn(async () => undefined);
    const redo = vi.fn(async () => undefined);
    const socket = startBridge({ undo, redo });
    await receive(socket, { kind: 'ready' });
    await receive(socket, { kind: 'call', id: 1, method: 'undo', args: [] });
    await receive(socket, { kind: 'call', id: 2, method: 'redo', args: [] });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
    expect(repliesOf(socket).map((reply) => reply.ok)).toEqual([true, true]);
  });

  it("relays the planner's history changes once accepted and keeps the host's handler", async () => {
    const hostHandler = vi.fn();
    const callbacks: Record<string, unknown> = { onHistoryChange: hostHandler };
    const socket = startBridge({ callbacks });
    const relay = callbacks.onHistoryChange as (u: boolean, r: boolean) => void;
    relay(true, false);
    expect(eventsOf(socket)).toEqual([]);
    expect(hostHandler).toHaveBeenCalledWith(true, false);

    await receive(socket, { kind: 'ready' });
    relay(false, true);
    expect(eventsOf(socket)).toEqual([
      { kind: 'event', name: 'historyChange', undo: false, redo: true },
    ]);
    expect(hostHandler).toHaveBeenLastCalledWith(false, true);
  });

  it("puts the host's handler back on disposal", async () => {
    const hostHandler = vi.fn();
    const callbacks: Record<string, unknown> = { onHistoryChange: hostHandler };
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      location: { href: PAGE_URL, protocol: 'http:' },
    });
    const bridge = startMcpBrowserBridge({ extended: { callbacks } });
    const socket = FakeWebSocket.instances[0];
    socket.onopen?.();
    await receive(socket, { kind: 'ready' });
    const relay = callbacks.onHistoryChange as (u: boolean, r: boolean) => void;
    bridge.dispose();
    relay(true, false);
    expect(callbacks.onHistoryChange).toBe(hostHandler);
    expect(eventsOf(socket)).toEqual([]);
  });

  it('rejects a method that is not exposed without touching the planner', async () => {
    const placeOrder = vi.fn(async () => undefined);
    const socket = startBridge({ placeOrder });
    await receive(socket, { kind: 'ready' });
    await receive(socket, {
      kind: 'call',
      id: 1,
      method: 'placeOrder',
      args: [],
    });
    expect(placeOrder).not.toHaveBeenCalled();
    expect(repliesOf(socket)).toEqual([
      {
        kind: 'result',
        id: 1,
        ok: false,
        error: 'Planner method not exposed: placeOrder',
      },
    ]);
  });

  it('relays a failing planner call as a failed result with its message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchPrice = vi.fn(async () => {
      throw new Error('price service down');
    });
    const socket = startBridge({ fetchPrice });
    await receive(socket, { kind: 'ready' });
    await receive(socket, {
      kind: 'call',
      id: 3,
      method: 'fetchPrice',
      args: [],
    });
    expect(repliesOf(socket)).toEqual([
      { kind: 'result', id: 3, ok: false, error: 'price service down' },
    ]);
  });

  it('requires acceptance before forwarding calls and stops reconnecting on occupation', async () => {
    vi.useFakeTimers();
    try {
      const fetchPrice = vi.fn(async () => null);
      const onStatusChange = vi.fn();
      FakeWebSocket.instances = [];
      vi.stubGlobal('WebSocket', FakeWebSocket);
      vi.stubGlobal('window', {
        location: { href: PAGE_URL, protocol: 'http:' },
      });
      const { retry } = startMcpBrowserBridge(
        { extended: { fetchPrice } },
        { clientId: 'tab-1', onStatusChange }
      );
      const socket = FakeWebSocket.instances[0];
      socket.onopen?.();
      expect(JSON.parse(socket.sent[0]).clientId).toBe('tab-1');
      await receive(socket, {
        kind: 'call',
        id: 1,
        method: 'fetchPrice',
        args: [],
      });
      expect(fetchPrice).not.toHaveBeenCalled();
      socket.onclose?.({ code: 4409 });
      expect(onStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: 'occupied' })
      );
      vi.advanceTimersByTime(3000);
      expect(FakeWebSocket.instances).toHaveLength(1);
      retry();
      expect(FakeWebSocket.instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('notifies on acceptance and disables the chat on connection loss', async () => {
    vi.useFakeTimers();
    try {
      const onStatusChange = vi.fn();
      FakeWebSocket.instances = [];
      vi.stubGlobal('WebSocket', FakeWebSocket);
      vi.stubGlobal('window', {
        location: { href: PAGE_URL, protocol: 'http:' },
      });
      startMcpBrowserBridge({ extended: {} }, { onStatusChange });
      const socket = FakeWebSocket.instances[0];
      socket.onopen?.();
      await receive(socket, { kind: 'ready' });
      expect(onStatusChange).toHaveBeenLastCalledWith({
        state: 'connected',
        message: '',
      });
      socket.onclose?.({ code: 1006 });
      expect(onStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: 'unavailable' })
      );
      vi.advanceTimersByTime(3000);
      expect(FakeWebSocket.instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes the active socket and ignores callbacks and retries after disposal', async () => {
    vi.useFakeTimers();
    try {
      const onStatusChange = vi.fn();
      FakeWebSocket.instances = [];
      vi.stubGlobal('WebSocket', FakeWebSocket);
      vi.stubGlobal('window', {
        location: { href: PAGE_URL, protocol: 'http:' },
      });
      const { retry, dispose } = startMcpBrowserBridge(
        { extended: {} },
        { onStatusChange }
      );
      const socket = FakeWebSocket.instances[0];
      socket.onopen?.();
      await receive(socket, { kind: 'ready' });
      const notifications = onStatusChange.mock.calls.length;

      dispose();
      expect(socket.close).toHaveBeenCalledOnce();
      socket.onopen?.();
      await receive(socket, { kind: 'ready' });
      retry();
      vi.advanceTimersByTime(3000);
      expect(onStatusChange).toHaveBeenCalledTimes(notifications);
      expect(FakeWebSocket.instances).toHaveLength(1);

      startMcpBrowserBridge({ extended: {} });
      expect(FakeWebSocket.instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a pending reconnect and closes a connecting socket on disposal', () => {
    vi.useFakeTimers();
    try {
      FakeWebSocket.instances = [];
      vi.stubGlobal('WebSocket', FakeWebSocket);
      vi.stubGlobal('window', {
        location: { href: PAGE_URL, protocol: 'http:' },
      });
      const { dispose } = startMcpBrowserBridge({ extended: {} });
      const socket = FakeWebSocket.instances[0];
      socket.onclose?.({ code: 1006 });
      dispose();
      vi.advanceTimersByTime(3000);
      expect(FakeWebSocket.instances).toHaveLength(1);

      const next = startMcpBrowserBridge({ extended: {} });
      const connectingSocket = FakeWebSocket.instances[1];
      next.dispose();
      expect(connectingSocket.close).toHaveBeenCalledOnce();
      connectingSocket.onopen?.();
      expect(connectingSocket.sent).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not send an in-flight planner result after disposal', async () => {
    let finishPrice!: (price: number) => void;
    const fetchPrice = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          finishPrice = resolve;
        })
    );
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      location: { href: PAGE_URL, protocol: 'http:' },
    });
    const { dispose } = startMcpBrowserBridge({ extended: { fetchPrice } });
    const socket = FakeWebSocket.instances[0];
    socket.onopen?.();
    await receive(socket, { kind: 'ready' });
    const pending = receive(socket, {
      kind: 'call',
      id: 1,
      method: 'fetchPrice',
      args: [],
    });

    dispose();
    finishPrice(42);
    await pending;
    expect(repliesOf(socket)).toEqual([]);
  });

  it('ignores malformed messages and messages that are not calls', async () => {
    const fetchPrice = vi.fn(async () => ({ price: 1 }));
    const socket = startBridge({ fetchPrice });
    await receive(socket, 'not json');
    await receive(socket, { kind: 'result', id: 1, ok: true, result: null });
    expect(fetchPrice).not.toHaveBeenCalled();
    expect(socket.sent).toHaveLength(1);
  });
});

describe('resolveBridgeUrls', () => {
  it('normalizes an https server url to the wss bridge endpoint', () => {
    expect(resolveBridgeUrls('https://hi-mcp.azurewebsites.net')).toEqual([
      'wss://hi-mcp.azurewebsites.net/bridge',
    ]);
  });

  it('keeps an explicit websocket url and appends /bridge when missing', () => {
    expect(resolveBridgeUrls('wss://hi-mcp.azurewebsites.net')).toEqual([
      'wss://hi-mcp.azurewebsites.net/bridge',
    ]);
    expect(resolveBridgeUrls('wss://hi-mcp.azurewebsites.net/bridge')).toEqual([
      'wss://hi-mcp.azurewebsites.net/bridge',
    ]);
  });

  it('normalizes an http server url to ws and strips trailing slashes', () => {
    expect(resolveBridgeUrls('http://localhost:3100///')).toEqual([
      'ws://localhost:3100/bridge',
    ]);
  });

  it('appends the session id to the bridge url', () => {
    expect(
      resolveBridgeUrls('https://hi-mcp-poc.example.com', 'alice')
    ).toEqual(['wss://hi-mcp-poc.example.com/bridge?session=alice']);
  });

  it('leaves the bridge url unchanged without a session id', () => {
    expect(resolveBridgeUrls('https://hi-mcp-poc.example.com')).toEqual([
      'wss://hi-mcp-poc.example.com/bridge',
    ]);
  });
});
