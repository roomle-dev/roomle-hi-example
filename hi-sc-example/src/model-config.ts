import type { PlanningAssistantConfig } from '@roomle/embedding-lib/hi';

type ProviderModel = Pick<PlanningAssistantConfig, 'provider' | 'model'>;

const FOUNDRY_BASE_URL =
  'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';
const FOUNDRY_DEPLOYMENTS = new Map<string, Partial<PlanningAssistantConfig>>([
  ['gpt-5-mini', { reasoningEffort: 'high' }],
  ['gpt-5.4-mini', { reasoningEffort: 'high' }],
  ['gpt-6-astra', { referenceCacheBreakpoint: true }],
  [
    'gpt-6.1-sol',
    {
      baseUrl:
        'https://controller-mes-resource.services.ai.azure.com/openai/v1',
      referenceCacheBreakpoint: true,
    },
  ],
  ['mistral-large-3', { chatCompletions: true }],
]);
const MODEL_ALIASES = new Map<string, ProviderModel>([
  ['mistral', { provider: 'mistral', model: 'mistral-large-latest' }],
  ['mistral-medium', { provider: 'mistral', model: 'mistral-medium-latest' }],
  ['mistral-large-4', { provider: 'mistral', model: 'mistral-large-4-0' }],
  ['claude', { provider: 'anthropic', model: 'claude-sonnet-4-5' }],
  ['claude-opus', { provider: 'anthropic', model: 'claude-opus-4-1' }],
  ['gemini', { provider: 'google', model: 'gemini-2.5-pro' }],
  ['gemini-flash', { provider: 'google', model: 'gemini-2.5-flash' }],
]);
const PASS_THROUGH_PREFIXES = new Map<string, ProviderModel['provider']>([
  ['mistral-', 'mistral'],
  ['claude-', 'anthropic'],
  ['gemini-', 'google'],
]);
const MISTRAL_IMAGE_MODELS = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-large-4-0',
];

const providerModel = (name: string): ProviderModel | undefined => {
  const provider = [...PASS_THROUGH_PREFIXES].find(([prefix]) =>
    name.startsWith(prefix)
  )?.[1];
  return MODEL_ALIASES.get(name) ?? (provider && { provider, model: name });
};

/**
 * The PlanningAssistantConfig of the embedding-lib for a model name of
 * `npm start <model>`: `openai:<model-id>`, a deployment on an Azure AI
 * Foundry resource (every `gpt-*`), an alias or a `mistral-*`, `claude-*` or
 * `gemini-*` model id.
 */
export const planningAssistantConfig = (
  name: string,
  apiKey: string
): PlanningAssistantConfig => {
  const model = name.trim();
  if (!model || !apiKey) {
    throw new Error('The chat needs a model and its API key');
  }
  const lower = model.toLowerCase();
  if (lower.startsWith('openai:')) {
    return {
      provider: 'openai',
      model: model.slice('openai:'.length),
      apiKey,
      readsImages: true,
    };
  }
  if (lower.startsWith('gpt-') || FOUNDRY_DEPLOYMENTS.has(lower)) {
    return {
      provider: 'azure',
      model: lower,
      apiKey,
      baseUrl: FOUNDRY_BASE_URL,
      readsImages: true,
      ...FOUNDRY_DEPLOYMENTS.get(lower),
    };
  }
  const resolved = providerModel(lower);
  if (!resolved) {
    throw new Error(`Unknown model "${model}"`);
  }
  return {
    ...resolved,
    apiKey,
    readsImages:
      resolved.provider !== 'mistral' ||
      MISTRAL_IMAGE_MODELS.includes(resolved.model),
  };
};
