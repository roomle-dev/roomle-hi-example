import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { DEFAULT_CALL_TIMEOUT_MS, PageBridge } from '../page-bridge';
import { BRIDGE_PROTOCOL } from '../types';
import { attachPage, FakePageSocket } from './fake-page-socket';

describe('PageBridge.call', () => {
  it('rejects with the default store URL when no page is connected', async () => {
    const bridge = new PageBridge();
    await expect(
      bridge.call('getExternalObjectPlanContext', [['rooms']])
    ).rejects.toThrow(
      /No HI page connected.*http:\/\/localhost:3000\/\?store\.stage=INT.*start planning/s
    );
  });

  it.each([
    [undefined, undefined, undefined, undefined, 'http://localhost:3100'],
    ['3110', '3200', undefined, undefined, 'http://localhost:3110'],
    [undefined, '3200', undefined, undefined, 'http://localhost:3200'],
    ['3110', undefined, 'cert.pem', 'key.pem', 'https://localhost:3110'],
  ])(
    'includes the local MCP server in the default store link (%s, %s, %s, %s)',
    async (mcpPort, port, cert, key, serverUrl) => {
      vi.stubEnv('HI_MCP_STORE_URL', undefined);
      vi.stubEnv('HI_MCP_PORT', mcpPort);
      vi.stubEnv('PORT', port);
      vi.stubEnv('HI_MCP_TLS_CERT', cert);
      vi.stubEnv('HI_MCP_TLS_KEY', key);
      try {
        const error = await new PageBridge()
          .call('getExternalObjectPlanContext', [['rooms']])
          .catch((error: Error) => error);
        expect(error).toBeInstanceOf(Error);
        const url = new URL((error as Error).message.match(/at (\S+) and/)![1]);
        expect(url.searchParams.get('mcp_server')).toBe(serverUrl);
        expect(url.searchParams.get('store.stage')).toBe('INT');
        expect(url.searchParams.has('api_key')).toBe(false);
      } finally {
        vi.unstubAllEnvs();
      }
    }
  );

  it('names the configured store URL when HI_MCP_STORE_URL is set', async () => {
    vi.stubEnv(
      'HI_MCP_STORE_URL',
      'https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://example.workers.dev'
    );
    try {
      const bridge = new PageBridge();
      await expect(
        bridge.call('getExternalObjectPlanContext', [['rooms']])
      ).rejects.toThrow(
        /www\.roomle\.com\/t\/ligna-store-test\/\?store\.stage=INT&mcp_server=https:\/\/example\.workers\.dev/s
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('relays the planner call to the page and resolves on the result', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);

    const promise = bridge.call('getExternalObjectPlanContext', [['articles']]);
    expect(JSON.parse(socket.sent[0])).toEqual({ kind: 'ready' });
    expect(JSON.parse(socket.sent[1])).toEqual({
      kind: 'call',
      id: 1,
      method: 'getExternalObjectPlanContext',
      args: [['articles']],
    });

    socket.receive({
      kind: 'result',
      id: 1,
      ok: true,
      result: { articles: [] },
    });
    await expect(promise).resolves.toEqual({ articles: [] });
  });

  it('rejects calls with an update hint when the page runs an outdated bridge', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge, { protocol: undefined });
    await expect(bridge.call('fetchPrice', [])).rejects.toThrow(
      /outdated HI MCP page bridge.*protocol 2.*reload the page/s
    );
    expect(socket.sent).toHaveLength(1);
  });

  it('rejects on an error result and correlates ids', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);

    const first = bridge.call('fetchPrice', []);
    const second = bridge.call('getExternalObjectSnapshot', [
      { orderData: true },
    ]);
    socket.receive({ kind: 'result', id: 2, ok: false, error: 'boom' });
    await expect(second).rejects.toThrow('boom');
    socket.receive({ kind: 'result', id: 1, ok: true, result: { price: 42 } });
    await expect(first).resolves.toEqual({ price: 42 });
  });

  it('times out a call that the page never answers', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new PageBridge();
      attachPage(bridge);
      const promise = bridge.call('fetchPrice', [], 500);
      vi.advanceTimersByTime(500);
      await expect(promise).rejects.toThrow(/timed out after 500ms/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the default timeout of 30 seconds', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new PageBridge();
      attachPage(bridge);
      const promise = bridge.call('fetchPrice', []);
      vi.advanceTimersByTime(DEFAULT_CALL_TIMEOUT_MS - 1);
      const settled = await Promise.race([
        promise.then(
          () => 'settled',
          () => 'settled'
        ),
        Promise.resolve('pending'),
      ]);
      expect(settled).toBe('pending');
      vi.advanceTimersByTime(1);
      await expect(promise).rejects.toThrow(
        new RegExp(`timed out after ${DEFAULT_CALL_TIMEOUT_MS}ms`)
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PageBridge page lifecycle', () => {
  it('RML-18033: ignores a JSON null frame instead of throwing from the socket listener', () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    expect(() => socket.receive(null)).not.toThrow();
  });

  it('RML-18033: accepts results only from the active planner socket', async () => {
    const bridge = new PageBridge();
    const active = attachPage(bridge);
    const other = new FakePageSocket();
    bridge.attachPage(other as unknown as WebSocket);

    const pending = bridge.call('fetchPrice', []);
    other.receive({ kind: 'result', id: 1, ok: true, result: { price: 999 } });
    active.receive({ kind: 'result', id: 1, ok: true, result: { price: 42 } });

    await expect(pending).resolves.toEqual({ price: 42 });
  });

  it('rejects a second page without disrupting the active planner call', async () => {
    const bridge = new PageBridge();
    const first = attachPage(bridge);
    const pending = bridge.call('getExternalObjectPlanContext', [['rooms']]);

    const second = new FakePageSocket();
    bridge.attachPage(second as unknown as WebSocket);
    second.receive({
      kind: 'hello',
      example: 'ligna-store',
      url: 'http://localhost:3000/?store.stage=INT&id=ps_other',
      protocol: BRIDGE_PROTOCOL,
    });

    expect(second.readyState).toBe(WebSocket.CLOSED);
    expect(second.sent).toHaveLength(0);
    expect(first.readyState).toBe(WebSocket.OPEN);
    first.receive({ kind: 'result', id: 1, ok: true, result: { rooms: [] } });
    await expect(pending).resolves.toEqual({ rooms: [] });

    const promise = bridge.call('fetchPrice', []);
    first.receive({ kind: 'result', id: 2, ok: true, result: null });
    await expect(promise).resolves.toBeNull();
  });

  it('accepts a replacement when the previous socket is closing', async () => {
    const bridge = new PageBridge();
    const first = attachPage(bridge, { clientId: 'first' });
    const pending = bridge.call('fetchPrice', []);
    first.readyState = WebSocket.CLOSING;

    const second = attachPage(bridge, { clientId: 'second' });
    await expect(pending).rejects.toThrow(/disconnected/);
    expect(second.sent.map((message) => JSON.parse(message))).toEqual([
      { kind: 'ready' },
    ]);
    expect(bridge.isClientActive('second')).toBe(true);

    first.close();
    const next = bridge.call('fetchPrice', [], undefined, 'second');
    second.receive({ kind: 'result', id: 2, ok: true, result: 42 });
    await expect(next).resolves.toBe(42);
  });

  it('only lets the matching browser chat call its planner', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge, { clientId: 'first' });
    expect(bridge.isClientActive('first')).toBe(true);
    expect(bridge.isClientActive('second')).toBe(false);
    await expect(
      bridge.call('fetchPrice', [], undefined, 'second')
    ).rejects.toThrow(/not connected to its planner page/);
    expect(socket.sent).toHaveLength(1);
    const pending = bridge.call('fetchPrice', [], undefined, 'first');
    socket.receive({ kind: 'result', id: 1, ok: true, result: 42 });
    await expect(pending).resolves.toBe(42);
    socket.close();
    expect(bridge.isClientActive('first')).toBe(false);
  });

  it('rejects pending calls when the page disconnects', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    const pending = bridge.call('getExternalObjectPlanContext', [['rooms']]);
    socket.close();
    await expect(pending).rejects.toThrow(/The demo page disconnected/);
  });

  it('relays the history events of the active page to its listeners', () => {
    const bridge = new PageBridge();
    const listener = vi.fn();
    bridge.onHistoryChange(listener);
    const socket = attachPage(bridge);
    socket.receive({
      kind: 'event',
      name: 'historyChange',
      undo: true,
      redo: false,
    });
    expect(listener).toHaveBeenCalledWith(true, false);
  });

  it('ignores history events from another socket and events of another name', () => {
    const bridge = new PageBridge();
    const listener = vi.fn();
    bridge.onHistoryChange(listener);
    const active = attachPage(bridge);
    const other = attachPage(bridge);
    other.receive({
      kind: 'event',
      name: 'historyChange',
      undo: true,
      redo: false,
    });
    active.receive({ kind: 'event', name: 'selectionChange' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('tells its listeners when a page is accepted', () => {
    const bridge = new PageBridge();
    const listener = vi.fn();
    bridge.onPageAccepted(listener);
    const first = attachPage(bridge);
    attachPage(bridge);
    expect(listener).toHaveBeenCalledTimes(1);
    first.close();
    attachPage(bridge);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignores results for unknown call ids', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    socket.receive({ kind: 'result', id: 99, ok: true, result: 1 });
    const promise = bridge.call('fetchPrice', []);
    socket.receive({ kind: 'result', id: 1, ok: true, result: { price: 1 } });
    await expect(promise).resolves.toEqual({ price: 1 });
  });
});
