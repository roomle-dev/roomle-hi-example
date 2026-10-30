import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planningAssistantConfig } from '../src/model-config.ts';

describe('planningAssistantConfig', () => {
  it('passes the provider, the exact model id and the key through', () => {
    assert.deepEqual(
      planningAssistantConfig('mistral', 'Mistral-Medium-2508', 'key'),
      {
        provider: 'mistral',
        model: 'Mistral-Medium-2508',
        apiKey: 'key',
        readsImages: true,
      }
    );
  });

  it('reaches an azure model as a deployment on the HI Foundry resource', () => {
    assert.equal(
      planningAssistantConfig('azure', 'gpt-6-astra', 'key').baseUrl,
      'https://dfhifoundrysweden.services.ai.azure.com/openai/v1'
    );
  });

  it('rejects a chat without its provider, model or key', () => {
    for (const [provider, model, apiKey] of [
      ['', 'gpt-6-astra', 'key'],
      ['openai', '', 'key'],
      ['openai', 'gpt-6-astra', ''],
    ] as const) {
      assert.throws(
        () => planningAssistantConfig(provider, model, apiKey),
        /needs a provider, a model and an API key/
      );
    }
  });
});
