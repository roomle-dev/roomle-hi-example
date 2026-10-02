import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { DEFAULT_CALL_TIMEOUT_MS, PageBridge } from '../page-bridge';
import { BRIDGE_PROTOCOL } from '../types';
import { attachPage, FakePageSocket } from './fake-page-socket';

describe('PageBridge.call', () => {
  it('rejects with the default store URL when no page is connected', async () => {
    const bridge = new PageBridge();
    await expect(bridge.call('getExternalObjectPlanContext', [['rooms']])).rejects.toThrow(
      /No HI page connected.*http:\/\/localhost:3000\/\?store\.stage=INT.*start planning/s,
    );
  });

  it('names the configured store URL when HI_MCP_STORE_URL is set', async () => {
    vi.stubEnv(
      'HI_MCP_STORE_URL',
      'https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://example.workers.dev',
    );
    try {
      const bridge = new PageBridge();
      await expect(bridge.call('getExternalObjectPlanContext', [['rooms']])).rejects.toThrow(
        /www\.roomle\.com\/t\/ligna-store-test\/\?store\.stage=INT&mcp_server=https:\/\/example\.workers\.dev/s,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('relays the planner call to the page and resolves on the result', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);

    const promise = bridge.call('getExternalObjectPlanContext', [['articles']]);
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toEqual({
      kind: 'call',
      id: 1,
      method: 'getExternalObjectPlanContext',
      args: [['articles']],
    });

    socket.receive({ kind: 'result', id: 1, ok: true, result: { articles: [] } });
    await expect(promise).resolves.toEqual({ articles: [] });
  });

  it('rejects calls with an update hint when the page runs an outdated bridge', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge, { protocol: undefined });
    await expect(bridge.call('fetchPrice', [])).rejects.toThrow(
      /outdated HI MCP page bridge.*protocol 2.*reload the page/s,
    );
    expect(socket.sent).toHaveLength(0);
  });

  it('rejects on an error result and correlates ids', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);

    const first = bridge.call('fetchPrice', []);
    const second = bridge.call('getExternalObjectSnapshot', [{ orderData: true }]);
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
          () => 'settled',
        ),
        Promise.resolve('pending'),
      ]);
      expect(settled).toBe('pending');
      vi.advanceTimersByTime(1);
      await expect(promise).rejects.toThrow(
        new RegExp(`timed out after ${DEFAULT_CALL_TIMEOUT_MS}ms`),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PageBridge page lifecycle', () => {
  it.fails('RML-18033: ignores a JSON null frame instead of throwing from the socket listener', () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    expect(() => socket.receive(null)).not.toThrow();
  });

  it.fails('RML-18033: accepts results only from the active planner socket', async () => {
    const bridge = new PageBridge();
    const active = attachPage(bridge);
    const other = new FakePageSocket();
    bridge.attachPage(other as unknown as WebSocket);

    const pending = bridge.call('fetchPrice', []);
    other.receive({ kind: 'result', id: 1, ok: true, result: { price: 999 } });
    active.receive({ kind: 'result', id: 1, ok: true, result: { price: 42 } });

    await expect(pending).resolves.toEqual({ price: 42 });
  });

  it('a newer page replaces the current one and rejects its pending calls', async () => {
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

    await expect(pending).rejects.toThrow(
      /The demo page was replaced by a newer one/,
    );
    expect(first.readyState).toBe(WebSocket.CLOSED);

    const promise = bridge.call('fetchPrice', []);
    second.receive({ kind: 'result', id: 2, ok: true, result: null });
    await expect(promise).resolves.toBeNull();
  });

  it('rejects pending calls when the page disconnects', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    const pending = bridge.call('getExternalObjectPlanContext', [['rooms']]);
    socket.close();
    await expect(pending).rejects.toThrow(/The demo page disconnected/);
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
