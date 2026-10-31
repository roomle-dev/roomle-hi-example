import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  externalObjectSettings,
  importOrder,
  requestPrice,
} from '../src/hi-planner.ts';

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

describe('importOrder', () => {
  const hiOptions = {
    libraryId: 'L',
    serverOptions: { baseUrl: 'https://proxy/?url=' },
  };

  const answerRequests = (answers: unknown[]) => {
    const requests: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(answers[requests.length - 1]));
    };
    return requests;
  };

  it('imports the order and reads the status of its import', async (t) => {
    const logs = t.mock.method(console, 'info', () => {});
    const requests = answerRequests([
      { correlationId: 'c1' },
      { state: 'Done', link: 'https://om/order' },
    ]);

    await importOrder(hiOptions, { items: [] }, { Authorization: 'Basic a' });

    assert.equal(requests.length, 2);
    assert.match(
      requests[0].url,
      /^https:\/\/proxy\/\?url=%2Fapi%2ForderManager%2Forders%2Fimport&/
    );
    assert.equal(requests[0].init.method, 'POST');
    assert.equal(requests[0].init.body, JSON.stringify({ items: [] }));
    assert.match(
      requests[1].url,
      /^https:\/\/proxy\/\?url=%2Fapi%2ForderManager%2Forders%2Fimport%2Fc1&/
    );
    assert.equal(requests[1].init.method, 'GET');
    for (const { init } of requests) {
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        'Basic a'
      );
    }
    assert.equal(
      logs.mock.calls.at(-1)?.arguments[0],
      'OrderManager Order: https://om/order'
    );
  });

  it('reads no import status without a correlation id', async (t) => {
    t.mock.method(console, 'info', () => {});
    const requests = answerRequests([{ error: 'invalid order' }]);

    await importOrder(hiOptions, { items: [] }, { Authorization: 'Basic a' });

    assert.equal(requests.length, 1);
  });
});
