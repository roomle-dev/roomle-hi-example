import { fstatSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebSocketServer } from 'ws';
import { createHiMcpServer } from './hi-mcp-server';
import { PageBridge } from './page-bridge';
import { createPlannerApi } from './planner-api';
import { HI_MCP_PORT } from './types';

const bridge = new PageBridge();
const plannerApi = createPlannerApi(bridge);

// Azure App Service injects PORT and expects HOST=0.0.0.0; locally the
// defaults keep the single-user setup: port 3100, all interfaces, the local
// dev server plus the deployed store pages as allowed origins.
const serverPort = Number(process.env.HI_MCP_PORT ?? process.env.PORT) || HI_MCP_PORT;
const pageOrigins = process.env.HI_MCP_PAGE_ORIGINS
  ? process.env.HI_MCP_PAGE_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://www.roomle.com',
    ];

const requestHandler = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  if (!request.url?.startsWith('/mcp')) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found - the MCP endpoint is /mcp');
    return;
  }
  try {
    const mcpServer = createHiMcpServer(plannerApi);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      transport.close();
      mcpServer.close();
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    console.error('[hi-mcp] request failed', error);
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain' });
      response.end('Internal server error');
    }
  }
};

// Optional TLS: with a locally trusted certificate (e.g. mkcert) the MCP
// endpoint also answers https/wss — the wss fallback of the page bridge for
// browsers that refuse the (spec-exempt) ws loopback connection.
const tlsCertPath = process.env.HI_MCP_TLS_CERT;
const tlsKeyPath = process.env.HI_MCP_TLS_KEY;
const tlsOptions =
  tlsCertPath && tlsKeyPath
    ? { cert: readFileSync(tlsCertPath), key: readFileSync(tlsKeyPath) }
    : undefined;
const httpServer = tlsOptions
  ? createHttpsServer(tlsOptions, requestHandler)
  : createServer(requestHandler);

const webSocketServer = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (request, socket, head) => {
  const { origin } = request.headers;
  // query parameters are allowed on /bridge (the Cloudflare session routing
  // appends ?session=…)
  const { pathname } = new URL(request.url ?? '', 'http://localhost');
  if (pathname !== '/bridge' || (origin && !pageOrigins.includes(origin))) {
    console.error(
      `[hi-mcp] rejected websocket upgrade (url: ${request.url}, origin: ${origin})`,
    );
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (pageSocket) =>
    bridge.attachPage(pageSocket),
  );
});

// vite-node keeps running when the surrounding dev script dies (the npm layer
// between concurrently and vite-node can lose the termination signal), which
// leaves an orphaned server holding the port. stdin is the pipe whose other
// end the dev script holds: when the script dies - however it dies - the pipe
// ends and this instance shuts down with it. A standalone or detached start
// (stdin is a terminal or /dev/null) arms no guard and keeps running.
try {
  const stdinStat = fstatSync(0);
  if (!process.stdin.isTTY && (stdinStat.isFIFO() || stdinStat.isSocket())) {
    process.stdin.resume();
    process.stdin.on('end', () => {
      console.log('[hi-mcp] dev script ended - shutting down');
      process.exit(0);
    });
    process.stdin.on('error', () => {});
  }
} catch {
  // stdin is not inspectable - run without the orphan guard
}

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[hi-mcp] port ${serverPort} is already in use - a previous MCP server instance is still running.`,
    );
    console.error(
      `[hi-mcp] stop it first: lsof -ti tcp:${serverPort} | xargs kill`,
    );
  } else {
    console.error('[hi-mcp] server failed to start', error);
  }
  process.exit(1);
});

const startListening = () => {
  console.log('');
  console.log('  HI group orchestrator MCP server ready');
  console.log('');
  console.log(
    `  \u279c  Local:   http${tlsOptions ? 's' : ''}://localhost:${serverPort}/mcp`,
  );
  console.log('');
  console.log(
    '[hi-mcp] waiting for the ligna-store page (start it with npm run dev and open it with the store.stage=INT query parameter)',
  );
};

if (process.env.HOST) {
  httpServer.listen(serverPort, process.env.HOST, startListening);
} else {
  httpServer.listen(serverPort, startListening);
}
