// Builds the start page with every example under its path into pages/dist, for the base path
// of the site (the first argument, "/" by default):  node build.mjs /roomle-hi-example/
import { copyFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { EXAMPLES, START_PAGE, START_PAGE_ASSETS } from './examples.mjs';

const base = process.argv[2] ?? '/';
const dist = fileURLToPath(new URL('./dist/', import.meta.url));

await rm(dist, { recursive: true, force: true });
for (const example of EXAMPLES) {
  await build({
    root: example.root,
    base: `${base}${example.path}/`,
    build: { outDir: `${dist}${example.path}`, emptyOutDir: true },
  });
}
await copyFile(START_PAGE, `${dist}index.html`);
await cp(START_PAGE_ASSETS, `${dist}assets`, { recursive: true });
