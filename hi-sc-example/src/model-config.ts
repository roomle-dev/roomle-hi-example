import type { PlanningAssistantConfig } from '@roomle/embedding-lib/hi';

export type Provider = PlanningAssistantConfig['provider'];

const FOUNDRY_BASE_URL =
  'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';

/**
 * The PlanningAssistantConfig of the embedding-lib: the provider, the exact
 * model id and its API key. An `azure` model is a deployment on the HI Azure
 * AI Foundry resource.
 */
export const planningAssistantConfig = (
  provider: Provider | '',
  model: string,
  apiKey: string
): PlanningAssistantConfig => {
  if (!provider || !model || !apiKey) {
    throw new Error('The chat needs a provider, a model and an API key');
  }
  return {
    provider,
    model,
    apiKey,
    readsImages: true,
    ...(provider === 'azure' && { baseUrl: FOUNDRY_BASE_URL }),
  };
};
