import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planningAssistantConfig } from '../src/model-config.ts';

const FOUNDRY_BASE_URL =
  'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';

describe('planningAssistantConfig', () => {
  it('reaches a gpt-* model as a deployment on the HI Foundry resource', () => {
    assert.deepEqual(planningAssistantConfig('GPT-6-Astra', 'key'), {
      provider: 'azure',
      model: 'gpt-6-astra',
      apiKey: 'key',
      baseUrl: FOUNDRY_BASE_URL,
      readsImages: true,
      referenceCacheBreakpoint: true,
    });
    assert.equal(
      planningAssistantConfig('gpt-5.4-mini', 'key').reasoningEffort,
      'high'
    );
    assert.deepEqual(planningAssistantConfig('gpt-7-new', 'key'), {
      provider: 'azure',
      model: 'gpt-7-new',
      apiKey: 'key',
      baseUrl: FOUNDRY_BASE_URL,
      readsImages: true,
    });
  });

  it('reaches a deployment on another resource at the endpoint of that resource', () => {
    assert.equal(
      planningAssistantConfig('gpt-6.1-sol', 'key').baseUrl,
      'https://controller-mes-resource.services.ai.azure.com/openai/v1'
    );
  });

  it('calls mistral-large-3 on the Foundry resource through Chat Completions', () => {
    const config = planningAssistantConfig('mistral-large-3', 'key');
    assert.equal(config.provider, 'azure');
    assert.equal(config.chatCompletions, true);
  });

  it('passes the model id after openai: through unchanged', () => {
    assert.deepEqual(planningAssistantConfig('OpenAI:GPT-X:mini', 'key'), {
      provider: 'openai',
      model: 'GPT-X:mini',
      apiKey: 'key',
      readsImages: true,
    });
  });

  it('resolves the aliases and passes provider model ids through', () => {
    assert.deepEqual(planningAssistantConfig('claude', 'key'), {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      apiKey: 'key',
      readsImages: true,
    });
    assert.equal(
      planningAssistantConfig('mistral-medium', 'key').model,
      'mistral-medium-latest'
    );
    assert.equal(
      planningAssistantConfig('gemini-3-pro-preview', 'key').provider,
      'google'
    );
  });

  it('lets only the Mistral models known to read images read them', () => {
    assert.equal(planningAssistantConfig('mistral', 'key').readsImages, true);
    assert.equal(
      planningAssistantConfig('mistral-small-latest', 'key').readsImages,
      false
    );
  });

  it('rejects an unknown model and a model without its key', () => {
    assert.throws(
      () => planningAssistantConfig('llama-3', 'key'),
      /Unknown model "llama-3"/
    );
    assert.throws(
      () => planningAssistantConfig('gpt-6-astra', ''),
      /needs a model and its API key/
    );
    assert.throws(
      () => planningAssistantConfig('', 'key'),
      /needs a model and its API key/
    );
  });
});
