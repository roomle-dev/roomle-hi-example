// The start page of the HI examples on :3300 (the next free port if it is taken), with each
// example's Vite dev server under its path:  npm run start:sc [-- --no-open]
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname } from 'node:path';
import { createServer } from 'vite';
import { EXAMPLES, START_PAGE, route } from './examples.mjs';

const PORT = 3300;
const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png' };

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

const listen = (server, port) =>
  new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      if (error.code === 'EADDRINUSE') {
        resolve(listen(server, port + 1));
      } else {
        reject(error);
      }
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });

const server = http.createServer();
const viteServers = new Map(
  await Promise.all(
    EXAMPLES.map(async (example) => [
      example.path,
      await createServer({
        root: example.root,
        base: `/${example.path}/`,
        server: { middlewareMode: true, hmr: { server } },
      }),
    ])
  )
);

server.on('request', async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const target = route(url.pathname, url.search);
  if (target.kind === 'start-page') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(await readFile(START_PAGE));
  } else if (target.kind === 'start-page-asset') {
    try {
      const body = await readFile(target.file);
      response.writeHead(200, {
        'content-type':
          CONTENT_TYPES[extname(target.file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  } else if (target.kind === 'redirect') {
    response.writeHead(302, { location: target.location }).end();
  } else if (target.kind === 'example') {
    viteServers
      .get(target.example.path)
      .middlewares(request, response, () =>
        response.writeHead(404).end('Not found')
      );
  } else {
    response.writeHead(404).end('Not found');
  }
});

const port = await listen(server, PORT);
const url = `http://localhost:${port}/`;
console.log(`HI examples: ${url}`);
for (const example of EXAMPLES) {
  console.log(`  ${url}${example.path}/`);
}
if (!process.argv.includes('--no-open')) {
  openInBrowser(url);
}
