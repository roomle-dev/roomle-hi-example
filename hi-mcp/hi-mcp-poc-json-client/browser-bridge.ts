import type {
  McpBridgeMessage,
  McpBridgeResult,
  RoomDesignerApiType,
} from './types';
import { BRIDGE_PROTOCOL, HI_MCP_PORT } from './types';

const RECONNECT_DELAY_MS = 3000;

// The planner methods the MCP server may call on this page - nothing else
// (no orders, no plan overwrites) is reachable from the server.
export const PLANNER_METHODS = [
  'getExternalObjectPlanContext',
  'loadExternalObjectGroupLayout',
  'externalObjectGroupOperation',
  'fetchPrice',
  'getExternalObjectSnapshot',
  'getExternalObjectGroups',
  'removeExternalObject',
];

export interface BrowserBridgeOptions {
  /**
   * Base URL of the MCP server, e.g. `https://hi-mcp.azurewebsites.net` or
   * `wss://hi-mcp.azurewebsites.net`. Without it the bridge connects to the
   * local MCP server (port 3100).
   */
  serverUrl?: string;
  /**
   * Session id (the store's `mcp_session` query parameter). The Cloudflare
   * Worker routes `?session=<id>` to a container of its own, so parallel
   * users do not interfere; every other setup ignores it.
   */
  sessionId?: string;
}

// An explicit server URL (mcp_server query param) is normalized to the
// matching websocket scheme; http(s) input is accepted as well as ws(s).
const normalizeBridgeUrl = (serverUrl: string): string => {
  let url = serverUrl.trim().replace(/\/+$/, '');
  if (url.startsWith('https://')) {
    url = `wss://${url.slice('https://'.length)}`;
  } else if (url.startsWith('http://')) {
    url = `ws://${url.slice('http://'.length)}`;
  }
  if (!url.endsWith('/bridge')) {
    url = `${url}/bridge`;
  }
  return url;
};

// Loopback connections are not mixed content, so ws://localhost works even
// from an https page (deployed store). wss is the fallback for strict
// browsers, served when the MCP server runs with a certificate
// (HI_MCP_TLS_CERT/HI_MCP_TLS_KEY). With a session id, every URL carries
// ?session=… so the server can route the page to its own container.
export const resolveBridgeUrls = (
  serverUrl?: string,
  sessionId?: string,
): string[] => {
  const withSession = (url: string) =>
    sessionId ? `${url}?session=${encodeURIComponent(sessionId)}` : url;
  if (serverUrl) {
    return [withSession(normalizeBridgeUrl(serverUrl))];
  }
  const urls = [withSession(`ws://localhost:${HI_MCP_PORT}/bridge`)];
  if (window.location.protocol === 'https:') {
    urls.push(withSession(`wss://localhost:${HI_MCP_PORT}/bridge`));
  }
  return urls;
};

// The page URL the server logs and names in its errors - without the API key
// of the chat window.
const pageUrlWithoutApiKey = (): string => {
  const url = new URL(window.location.href);
  url.searchParams.delete('api_key');
  return url.toString();
};

export const startMcpBrowserBridge = (
  roomDesignerApi: RoomDesignerApiType,
  options: BrowserBridgeOptions = {},
): void => {
  const bridgeUrls = resolveBridgeUrls(
      options.serverUrl,
      options.sessionId,
    );
  let candidate = 0;

  const connect = () => {
    const bridgeUrl = bridgeUrls[candidate % bridgeUrls.length];
    const socket = new WebSocket(bridgeUrl);
    let opened = false;

    socket.onerror = () => {
      console.warn(
        '[hi-mcp] cannot connect to the MCP server at',
        bridgeUrl,
      );
    };

    const reply = (result: McpBridgeResult) => {
      socket.send(JSON.stringify(result));
    };

    socket.onopen = () => {
      opened = true;
      console.log('[hi-mcp] connected to the MCP server');
      socket.send(
        JSON.stringify({
          kind: 'hello',
          example: 'ligna-store',
          url: pageUrlWithoutApiKey(),
          protocol: BRIDGE_PROTOCOL,
        }),
      );
    };

    socket.onmessage = async (event) => {
      let message: McpBridgeMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.kind !== 'call') {
        return;
      }
      if (!PLANNER_METHODS.includes(message.method)) {
        reply({
          kind: 'result',
          id: message.id,
          ok: false,
          error: `Planner method not exposed: ${message.method}`,
        });
        return;
      }
      console.log('[hi-mcp] executing', message.method, message.args);
      try {
        const result = await roomDesignerApi.extended[message.method](
          ...message.args,
        );
        reply({ kind: 'result', id: message.id, ok: true, result });
      } catch (error) {
        console.error('[hi-mcp] planner call failed', message.method, error);
        reply({
          kind: 'result',
          id: message.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    socket.onclose = () => {
      if (!opened) {
        candidate += 1;
      }
      setTimeout(connect, RECONNECT_DELAY_MS);
    };
  };

  connect();
};
