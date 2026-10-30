import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fetchBackend,
  hiProxyBaseUrl,
  modelProxyConfig,
  resolveLibraryId,
} from '../src/hi-server.ts';

const BACKEND = {
  backendId: 'B_1',
  libraryId: 'Lib',
  planId: null,
  configureInRoom: null,
  additionalCatalogs: null,
};

const answer = (status: number, backends: object[] = [BACKEND]) => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(backends), { status });
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
    assert.deepEqual(await fetchBackend('Basic x', 'B_1'), {
      backend: BACKEND,
      modelProxy: false,
    });
  });

  it('checks the sign-in and returns no backend without an ID', async () => {
    answer(200);
    assert.deepEqual(await fetchBackend('Basic x', ''), { modelProxy: false });
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

  it('offers the model proxy when the only backend of the user enables it', async () => {
    const enabled = { ...BACKEND, enableAIPlanning: true };
    answer(200, [enabled]);
    assert.deepEqual(await fetchBackend('Basic x', ''), { modelProxy: true });
    assert.deepEqual(await fetchBackend('Basic x', 'B_1'), {
      backend: enabled,
      modelProxy: true,
    });
  });

  it('offers no model proxy for a backend that does not enable it or a user of several backends', async () => {
    answer(200, [{ ...BACKEND, enableAIPlanning: false }]);
    assert.equal((await fetchBackend('Basic x', '')).modelProxy, false);
    answer(200, [
      { ...BACKEND, enableAIPlanning: true },
      { ...BACKEND, backendId: 'B_2', enableAIPlanning: true },
    ]);
    assert.equal((await fetchBackend('Basic x', 'B_1')).modelProxy, false);
  });
});

describe('resolveLibraryId', () => {
  it('takes the entered library over the one of the backend', () => {
    assert.equal(resolveLibraryId('Other_Lib', BACKEND), 'Other_Lib');
  });

  it('takes the library of the backend without an entered one', () => {
    assert.equal(resolveLibraryId('', BACKEND), 'Lib');
  });

  it('asks for a library without an entered one and without a backend', () => {
    assert.throws(
      () => resolveLibraryId('', undefined),
      /Enter a library, or a backend ID that has one/
    );
  });
});

describe('modelProxyConfig', () => {
  it('reaches the model proxy of the HI server with the sign-in and no key', () => {
    assert.deepEqual(modelProxyConfig('Basic x'), {
      provider: 'openai-compatible',
      baseUrl: 'https://dfscfgtest01-app.azurewebsites.net/api/ai/v1',
      model: 'planning',
      headers: { Authorization: 'Basic x' },
      readsImages: true,
    });
  });
});
