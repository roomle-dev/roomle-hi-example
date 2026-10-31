import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EXAMPLES, START_PAGE, route } from '../examples.mjs';

const folder = (relative) => fileURLToPath(new URL(relative, import.meta.url));

describe('EXAMPLES', () => {
  it('puts the sign-in and minifabric examples under their paths', () => {
    assert.deepEqual(EXAMPLES, [
      { path: 'hi-sc', root: folder('../../hi-sc-example/') },
      { path: 'nobilia-minifabrik', root: folder('../../minifabric-example/') },
    ]);
  });
});

describe('route', () => {
  it('answers the root with the start page', () => {
    assert.deepEqual(route('/'), { kind: 'start-page' });
    assert.deepEqual(route('/index.html'), { kind: 'start-page' });
  });

  it('hands every URL under the path of an example to that example', () => {
    assert.equal(route('/hi-sc/').example, EXAMPLES[0]);
    assert.equal(route('/hi-sc/src/main.ts').example, EXAMPLES[0]);
    assert.equal(
      route('/nobilia-minifabrik/@vite/client').example,
      EXAMPLES[1]
    );
  });

  it('redirects the path of an example to its trailing slash with the query', () => {
    assert.deepEqual(route('/hi-sc', '?backendId=B'), {
      kind: 'redirect',
      location: '/hi-sc/?backendId=B',
    });
    assert.deepEqual(route('/nobilia-minifabrik'), {
      kind: 'redirect',
      location: '/nobilia-minifabrik/',
    });
  });

  it('answers nothing for other paths', () => {
    assert.deepEqual(route('/hi-scx/'), { kind: 'not-found' });
    assert.deepEqual(route('/minifabric-example/'), { kind: 'not-found' });
  });
});

describe('the start page', () => {
  it('links the two examples relative to it and the ligna-store', async () => {
    const links = [
      ...(await readFile(START_PAGE, 'utf8')).matchAll(/href="([^"]+)"/g),
    ].map(([, href]) => href);
    assert.deepEqual(links, [
      'hi-sc/',
      'nobilia-minifabrik/',
      'https://www.roomle.com/t/ligna-store/',
    ]);
  });
});
