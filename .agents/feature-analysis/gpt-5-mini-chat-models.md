# Feature Analysis: GPT-5 mini Chat Models from the HI Azure AI Foundry Resource

**Status**: Implemented

Implemented as proposed on branch `feat/gpt-5-mini-chat-models`. Verified: unit tests and typecheck
pass; with a stubbed `fetch`, both names call
`https://dfhifoundrysweden.services.ai.azure.com/openai/v1/responses` with the deployment as `model`
and the key in the `api-key` header, also with an `AZURE_RESOURCE_NAME` set; the launcher accepts
both names. Not verified here: a live request with the real key. The living reference is
[`../../minimal-hi-example/docs/ai-chat.md`](../../minimal-hi-example/docs/ai-chat.md).

## What was asked and why

A colleague shared two snippets (OpenAI SDK, JavaScript and Python) that call the deployments
`gpt-5-mini` and `gpt-5.4-mini` on the Azure AI Foundry resource `dfhifoundrysweden` through its
OpenAI v1 endpoint `https://dfhifoundrysweden.services.ai.azure.com/openai/v1`, with a single API
key. The built-in AI chat of the example should use these deployments with one command and no
extra environment variables:

```bash
npm start gpt-5-mini <api-key>
npm start gpt-5.4-mini <api-key>
```

`npm start azure <api-key>` and `npm start openai <api-key>` keep their current behaviour
(`gpt-4o`). The root README lists the two new commands right before `npm start mistral`.

## How it works today

- The launcher [`minimal-hi-example/start.mjs`](../../minimal-hi-example/start.mjs) accepts the
  provider names in `CHAT_PROVIDERS` (plus any `mistral-*`/`claude-*` id) and rejects every other
  name before anything starts. It passes the name as `HI_CHAT_PROVIDER` and the key as
  `HI_CHAT_TOKEN` to the chat backend.
- [`hi-mcp/hi-mcp-chat/chat-config.ts`](../../hi-mcp/hi-mcp-chat/chat-config.ts)
  `resolveChatModel` maps the name to `{ provider, modelId }` via `PROVIDER_MODEL_ALIASES`;
  `azure`/`openai` resolve to `{ provider: 'azure', modelId: 'gpt-4o' }`. `HI_CHAT_MODEL` overrides
  the model id, `AZURE_RESOURCE_NAME` is read into `azureResourceName`.
- [`hi-mcp/hi-mcp-chat/chat-server.ts`](../../hi-mcp/hi-mcp-chat/chat-server.ts)
  `getLanguageModel` throws for `azure` without `AZURE_RESOURCE_NAME`, then calls
  `createAzure({ apiKey, resourceName })(modelId)`.
- `@ai-sdk/azure` 4.0.85 builds `https://<resourceName>.openai.azure.com/openai/v1<path>` from the
  resource name, or uses a `baseURL` option verbatim. A `baseURL` on `.services.ai.azure.com`
  ending in `/openai/v1` is recognised as versioned: no `/v1` is appended and no `api-version`
  query is added. `provider(deploymentId)` returns a Responses API model — the same API the
  snippets call (`responses.create` / `responses.stream`). The key goes in the `api-key` header;
  the snippets send it as `Authorization: Bearer`, which the Azure v1 endpoint accepts as well.

## The gap

1. The launcher rejects `gpt-5-mini` and `gpt-5.4-mini` as unknown providers.
2. `resolveChatModel` throws for them too.
3. The backend can only reach an Azure resource by name (`.openai.azure.com`), not the Foundry
   endpoint the snippets use, and it requires `AZURE_RESOURCE_NAME`.

## Proposed change

- `chat-config.ts`: the two names are Foundry deployments. `resolveChatModel` resolves them to
  `{ provider: 'azure', modelId: <name>, baseUrl: 'https://dfhifoundrysweden.services.ai.azure.com/openai/v1' }`.
  `ChatModel` gets an optional `baseUrl`, `ChatConfig` an `azureBaseUrl` taken from it.
  `azure`/`openai` stay `gpt-4o` without a base URL.
- `chat-server.ts`: `createAzure({ apiKey, resourceName, baseURL })`; the error only fires when
  neither a base URL nor a resource name is configured. With a base URL, `@ai-sdk/azure` ignores
  the resource name, so an `AZURE_RESOURCE_NAME` left in the shell does not redirect the Foundry
  aliases. For the same reason `HI_CHAT_MODEL` does not override their deployment (added in the
  PR review).
- `start.mjs`: add both names to `CHAT_PROVIDERS` and to the usage comment.
- Tests in `hi-mcp/hi-mcp-chat/tests/chat-handler.test.ts` for the resolution and the config.
- The GPT-5 models are reasoning models and reject `temperature`; `streamText` sets none, so no
  change is needed there.

## Alternatives considered

- **Point `azure`/`openai` at the Foundry resource and switch their default model.** Rejected:
  the request keeps them on `gpt-4o`.
- **A generic `AZURE_BASE_URL` environment variable instead of named aliases.** Rejected: it still
  needs extra environment variables per start, which is what the request removes. Not added on
  top either — nothing asks for it.
- **`AZURE_RESOURCE_NAME=dfhifoundrysweden` with the resource-name URL.** Rejected: it reaches
  `dfhifoundrysweden.openai.azure.com` instead of the endpoint from the snippets, and still needs
  two environment variables.
- **Pass any `gpt-*` id through to the Foundry resource** (like `mistral-*`/`claude-*`). Rejected:
  only these two deployments are known to exist on the resource; unknown names should fail at the
  launcher, not as a provider error in the chat.

## Code and documents touched

- `hi-mcp/hi-mcp-chat/chat-config.ts`, `hi-mcp/hi-mcp-chat/chat-server.ts`,
  `minimal-hi-example/start.mjs`
- `hi-mcp/hi-mcp-chat/tests/chat-handler.test.ts`
- `README.md` (the two commands before `npm start mistral`),
  `minimal-hi-example/docs/ai-chat.md`, `.agents/skills/vercel-ai-sdk-chat.md`,
  `.agents/feature-analysis/README.md`
