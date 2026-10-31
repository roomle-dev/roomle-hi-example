import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AI_KITCHEN_GENERATION_URL,
  fetchAiKitchenLayout,
  loadLayout,
  parseLayout,
  removeExternalObjectGroups,
} from '../src/layout.ts';

const fakePlanner = (groupIds: string[]) => {
  const calls: unknown[][] = [];
  return {
    calls,
    extended: {
      getExternalObjectGroups: async () => groupIds.map((id) => ({ id })),
      removeExternalObject: async (id: string) => {
        calls.push(['remove', id]);
      },
      loadExternalObjectGroupLayout: async (...args: unknown[]) => {
        calls.push(['load', ...args]);
      },
    },
  };
};

describe('fetchAiKitchenLayout', () => {
  it('asks the AI kitchen generation through the demo proxy for the elements catalogue', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = async (url, init) => {
      request = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ articles: [] }));
    };

    assert.deepEqual(await fetchAiKitchenLayout(new AbortController().signal), {
      articles: [],
    });
    assert.equal(request?.url, AI_KITCHEN_GENERATION_URL);
    assert.match(
      AI_KITCHEN_GENERATION_URL,
      /^https:\/\/europe-west3-rml-showcases\.cloudfunctions\.net\/proxy_request\?url=v1%2Fgenerate.*&baseUrl=https%3A%2F%2Fapim-aiplanner-ki-stage\.azure-api\.net%2F&subscriptionId=a&apiKey=b$/
    );
    assert.equal(request?.init.method, 'POST');
    assert.equal(
      request?.init.body,
      JSON.stringify({ metaData: { catalogue: { id: 'elements' } } })
    );
  });

  it('fails with the status of a failed generation', async () => {
    globalThis.fetch = async () => new Response('', { status: 502 });
    await assert.rejects(
      fetchAiKitchenLayout(new AbortController().signal),
      /Kitchen generation failed with status 502/
    );
  });
});

describe('parseLayout', () => {
  it('takes a JSON object', () => {
    assert.deepEqual(parseLayout('{"articles":[]}'), { articles: [] });
  });

  it('rejects anything else with the reason in the console', (t) => {
    const error = t.mock.method(console, 'error', () => {});
    assert.equal(parseLayout('[]'), null);
    assert.equal(parseLayout('null'), null);
    assert.equal(parseLayout('{'), null);
    assert.equal(error.mock.callCount(), 3);
  });
});

describe('removeExternalObjectGroups and loadLayout', () => {
  it('removes every group, then loads the layout where it finds free space', async () => {
    const planner = fakePlanner(['g1', 'g2']);
    await removeExternalObjectGroups(planner);
    await loadLayout(planner, { articles: [] });
    assert.deepEqual(planner.calls, [
      ['remove', 'g1'],
      ['remove', 'g2'],
      ['load', { articles: [] }, 'nobila', { findFreeSpaceInPlan: true }],
    ]);
  });
});
