import { describe, expect, it } from 'vitest';
import { resolveBridgeUrls } from '../browser-bridge';

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
});
