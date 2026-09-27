#!/usr/bin/env node
/**
 * Fetch the HI plan context of the Furniture_Smith library
 *
 * Serves fetch-hi-plan-context.html and opens it in the browser. The page loads
 * a scene (backendId HI_PRE_Roomle_Milestone_2, library Furniture_Smith,
 * language en), waits until the plan is completely loaded, calls
 * roomDesignerApi.extended.getExternalObjectPlanContext() and posts the result
 * back. The result is written unchanged to
 * docs/library-information/hi-plan-context.json.
 *
 * No dependencies, no MCP server.
 *
 * Usage:
 *   node .agents/scripts/fetch-hi-plan-context.js [--no-open]
 *
 *   --no-open  print the page URL instead of opening the browser
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3101;
const PAGE_URL = `http://localhost:${PORT}/`;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = join(SCRIPT_DIR, 'fetch-hi-plan-context.html');
const OUTPUT_PATH = join(
  SCRIPT_DIR,
  '../../docs/library-information/hi-plan-context.json',
);

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

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

const savePlanContext = async (request, response) => {
  const planContext = JSON.parse(await readBody(request));
  await writeFile(OUTPUT_PATH, `${JSON.stringify(planContext, null, 2)}\n`);
  response.writeHead(204);
  response.end(() => {
    console.log(`Saved ${relative(process.cwd(), OUTPUT_PATH)}`);
    process.exit(0);
  });
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(await readFile(PAGE_PATH));
    } else if (request.method === 'POST' && request.url === '/hi-plan-context') {
      await savePlanContext(request, response);
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    }
  } catch (error) {
    console.error('Request failed:', error);
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end(String(error));
  }
});

server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE' ? `Port ${PORT} is already in use` : error,
  );
  process.exit(1);
});

server.listen(PORT, 'localhost', () => {
  console.log(`Waiting for the plan context from ${PAGE_URL}`);
  if (process.argv.includes('--no-open')) {
    console.log('Open that URL in a browser and keep the tab open until the file is saved.');
  } else {
    openInBrowser(PAGE_URL);
  }
});
