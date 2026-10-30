import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchBackend, hiProxyBaseUrl } from '../src/hi-server.ts';

const BACKEND = {
  backendId: 'B_1',
  libraryId: 'Lib',
  planId: null,
  configureInRoom: null,
  additionalCatalogs: null,
};

const answer = (status: number) => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify([BACKEND]), { status });
};

describe('hiProxyBaseUrl', () => {
  it('names the backend, or leaves it to the proxy without one', () => {
    assert.equal(
      hiProxyBaseUrl('B 1'),
      'https://dfscfgtest01-app.azurewebsites.net/proxy_request?backendId=B%201&url='
    );
    assert.equal(
      hiProxyBaseUrl(''),
      'https://dfscfgtest01-app.azurewebsites.net/proxy_request?url='
    );
  });
});

describe('fetchBackend', () => {
  it('returns the backend of the ID', async () => {
    answer(200);
    assert.deepEqual(await fetchBackend('Basic x', 'B_1'), BACKEND);
  });

  it('checks the sign-in and returns no backend without an ID', async () => {
    answer(200);
    assert.equal(await fetchBackend('Basic x', ''), undefined);
    answer(401);
    await assert.rejects(fetchBackend('Basic x', ''), /Wrong user or password/);
  });

  it('rejects a backend ID the HI server does not have', async () => {
    answer(200);
    await assert.rejects(
      fetchBackend('Basic x', 'B_2'),
      /The HI server has no backend "B_2"/
    );
  });
});
