import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { externalObjectSettings, requestPrice } from '../src/hi-planner.ts';

describe('externalObjectSettings', () => {
  it('sets the parameter level and the library configuration', () => {
    assert.deepEqual(
      externalObjectSettings('Advanced', { language: 'de-DE', libraryId: 'L' }),
      {
        enableArrangementCorrection: true,
        uiConfiguration: {
          userRight: 'Advanced',
          showPossibleSubModules: true,
          animatedOpenClose: false,
          showThumbnails: true,
        },
        materialConfiguration: {
          defaultMaterial: 'roomle_script_test:gray_transparent',
        },
        debugConfiguration: { createDebugGeometry: false },
        tecConfigInfo: { language: 'de-DE', libraryId: 'L' },
      }
    );
  });
});

describe('requestPrice', () => {
  it('posts the order data to the price calculation with the headers', async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ total: 1 }));
    };

    const answer = await requestPrice(
      { libraryId: 'L', serverOptions: { baseUrl: 'https://proxy/?url=' } },
      { items: [] },
      { 'x-aux-header': 'nobilia' }
    );

    assert.deepEqual(answer, { total: 1 });
    assert.equal(requests.length, 1);
    assert.match(
      requests[0].url,
      /^https:\/\/proxy\/\?url=%2Fapi%2Fprice%2Fcalculate&/
    );
    assert.equal(requests[0].init.method, 'POST');
    assert.equal(
      requests[0].init.body,
      JSON.stringify({ orderData: { items: [] } })
    );
    assert.equal(
      (requests[0].init.headers as Record<string, string>)['x-aux-header'],
      'nobilia'
    );
  });
});
