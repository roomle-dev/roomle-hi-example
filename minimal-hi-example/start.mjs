// Starts the HI example page and the hi-mcp-poc-json MCP server together:
//   - installs and typechecks the hi-mcp workspace before anything starts
//   - serves this directory (the example page) on port 3000 - the port the
//     MCP server's default origin allow-list already contains
//   - spawns the MCP server (vite-node hi-mcp/hi-mcp-poc-json/server.ts) on
//     port 3100 and points its "no page connected" error at the example URL
//
// Start it with:  npm start   (from the repository root or this directory)
// No browser:     npm start -- --no-open
// Other page port: EXAMPLE_PORT=3101 npm start

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const HI_MCP_DIR = join(EXAMPLE_DIR, '..', 'hi-mcp');
const STATIC_PORT = Number(process.env.EXAMPLE_PORT ?? 3000);
const MCP_PORT = process.env.HI_MCP_PORT ?? '3100';
const EXAMPLE_URL = `http://localhost:${STATIC_PORT}/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`;
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let shuttingDown = false;

const runNpm = (args) => {
  const result = spawnSync(npmCommand, args, { cwd: HI_MCP_DIR, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[hi-example] npm ${args.join(' ')} failed`);
    process.exit(result.status ?? 1);
  }
};

const buildHiMcp = () => {
  if (!existsSync(join(HI_MCP_DIR, 'node_modules'))) {
    console.log('[hi-example] installing the hi-mcp workspace (first run)');
    runNpm(['install']);
  }
  console.log('[hi-example] typechecking the MCP server');
  runNpm(['run', 'typecheck']);
};

const serveStatic = (response, pathname) => {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = normalize(join(EXAMPLE_DIR, relativePath));
  const contentType = STATIC_CONTENT_TYPES[extname(filePath)];
  if (!filePath.startsWith(EXAMPLE_DIR) || !contentType) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
    return;
  }
  readFile(filePath)
    .then((content) => {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content);
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    });
};

const startExampleServer = () =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      serveStatic(response, new URL(request.url, `http://localhost:${STATIC_PORT}`).pathname);
    });
    server.on('error', reject);
    server.listen(STATIC_PORT, () => resolve(server));
  });

const startMcpServer = () => {
  const mcpServer = spawn(npmCommand, ['start', '--workspace', 'hi-mcp-poc-json'], {
    cwd: HI_MCP_DIR,
    stdio: 'inherit',
    env: { ...process.env, HI_MCP_STORE_URL: EXAMPLE_URL },
  });
  mcpServer.on('exit', (code) => {
    if (!shuttingDown) {
      process.exit(code ?? 0);
    }
  });
  return mcpServer;
};

const openInBrowser = (url) => {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', () => {});
  child.unref();
};

const main = async () => {
  buildHiMcp();
  try {
    await startExampleServer();
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`[hi-example] port ${STATIC_PORT} is already in use.`);
      console.error('[hi-example] pick another port: EXAMPLE_PORT=3101 npm start');
    } else {
      console.error('[hi-example] the example server failed to start', error);
    }
    process.exit(1);
  }
  const mcpServer = startMcpServer();
  console.log('');
  console.log('  HI example ready');
  console.log('');
  console.log(`  ➜  Example:  ${EXAMPLE_URL}`);
  console.log(`  ➜  MCP:      http://localhost:${MCP_PORT}/mcp`);
  console.log('');
  if (!process.argv.includes('--no-open')) {
    openInBrowser(EXAMPLE_URL);
  }
  const shutdown = () => {
    shuttingDown = true;
    mcpServer.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main();
