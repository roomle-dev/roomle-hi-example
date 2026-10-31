import fetch from 'node-fetch';
import { pipeline } from 'stream/promises';

const AZURE_AI_ROUTE = '/azure-ai';
const AZURE_AI_PATHS = ['/chat/completions', '/responses'];
const AZURE_AI_RESPONSE_HEADERS = [
  'content-type',
  'retry-after',
  'retry-after-ms',
  'x-request-id',
  'apim-request-id',
];

/**
 * Forwards a Chat Completions or Responses request to the OpenAI v1 API of an
 * Azure AI Foundry resource. The endpoint (AZURE_AI_BASE_URL), the allowed models
 * (AZURE_AI_MODELS, comma-separated) and the key (AZURE_AI_API_KEY) come from
 * the deployment, never from the request.
 */
const forwardToAzureAi = async (req, res) => {
  const baseUrl = process.env.AZURE_AI_BASE_URL?.replace(/\/+$/, '');
  const apiKey = process.env.AZURE_AI_API_KEY;
  const models = (process.env.AZURE_AI_MODELS ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  if (!baseUrl || !apiKey || models.length === 0) {
    res.status(500).json({
      error: 'The Azure AI route of the proxy is not configured',
    });
    return;
  }
  const path = AZURE_AI_PATHS.find((candidate) =>
    req.path.endsWith(AZURE_AI_ROUTE + candidate)
  );
  if (!path) {
    res.status(404).json({
      error: `The Azure AI route serves ${AZURE_AI_PATHS.map((candidate) => AZURE_AI_ROUTE + candidate).join(' and ')} only`,
    });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'The Azure AI route serves POST only' });
    return;
  }
  const model = req.body?.model;
  if (!models.includes(model)) {
    res.status(400).json({
      error: `The model "${model}" is not served; served: ${models.join(', ')}`,
    });
    return;
  }

  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      accept: req.headers.accept ?? 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(req.body),
    compress: false,
  });
  for (const name of AZURE_AI_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) {
      res.set(name, value);
    }
  }
  res.status(response.status);
  await pipeline(response.body, res);
  console.log('Azure AI finished with', response.status, model, path);
};

export const proxy_request = async (req, res) => {
  res.set('access-control-allow-origin', '*');
  res.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.set(
    'access-control-allow-headers',
    'content-type, authorization, access-control-allow-origin'
  );
  res.set('access-control-allow-credentials', 'true');
  res.set('access-control-allow-headers', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    if (req.path.includes(AZURE_AI_ROUTE)) {
      await forwardToAzureAi(req, res);
      return;
    }

    const targetUrl = decodeURIComponent(req.query.url ?? '');
    const overrideSubscriptionId = req.query.subscriptionId;
    const subscriptionId = overrideSubscriptionId
      ? decodeURIComponent(overrideSubscriptionId)
      : process.env.SHOWCASE_SUBSCRIPTION_ID;

    const overrideApiKey = req.query.apiKey;
    const apiKey = overrideApiKey
      ? decodeURIComponent(overrideApiKey)
      : process.env.SHOWCASE_API_KEY;
    const overrideBaseUrl = req.query.baseUrl;
    const baseUrl = overrideBaseUrl
      ? decodeURIComponent(overrideBaseUrl)
      : process.env.SHOWCASE_BASE_URL;
    // const enableNobiliaHack =
    //     req.query.nobiliaHack !== undefined
    //         ? req.query.nobiliaHack == 'true'
    //         : !overrideApiKey || overrideApiKey.length < 20;

    const mandatory = { apiKey, subscriptionId, baseUrl };
    const missing = Object.keys(mandatory).filter((key) => !mandatory[key]);
    if (missing.length > 0) {
      const errorMessage = `Error: BAD REQUEST, the following params are missing: ${missing.join(', ')}`;
      console.error(errorMessage);
      if (!res.headersSent) {
        res.status(400).json({ error: errorMessage });
      }
      return;
    }

    const headersToForward = {
      accept: req.headers.accept,
      'accept-encoding': req.headers['accept-encoding'],
      'accept-language': req.headers['accept-language'],
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      authorization: `Basic ${Buffer.from(
        `${subscriptionId}:${apiKey}`
      ).toString('base64')}`,
    };

    let fullUrl = baseUrl + targetUrl;

    const SHOWCASE_BASE_URL_NOBILIA = process.env.SHOWCASE_BASE_URL_NOBILIA;
    const SHOWCASE_SUBSCRIPTION_ID_NOBILIA =
      process.env.SHOWCASE_SUBSCRIPTION_ID_NOBILIA;
    const SHOWCASE_API_KEY_NOBILIA = process.env.SHOWCASE_API_KEY_NOBILIA;

    // START NOBILIA DEMO HACKS
    if (
      // enableNobiliaHack &&
      fullUrl.match('nobilia') ||
      req.headers['x-aux-header'] === 'nobilia'
    ) {
      const overrideSubscriptionId = req.query.subscriptionId;
      const subscriptionId = overrideSubscriptionId
        ? decodeURIComponent(overrideSubscriptionId)
        : SHOWCASE_SUBSCRIPTION_ID_NOBILIA;
      const overrideApiKey = req.query.apiKey;
      const apiKey = overrideApiKey
        ? decodeURIComponent(overrideApiKey)
        : SHOWCASE_API_KEY_NOBILIA;
      const overrideBaseUrl = req.query.baseUrl;
      const baseUrl = overrideBaseUrl
        ? decodeURIComponent(overrideBaseUrl)
        : SHOWCASE_BASE_URL_NOBILIA;

      fullUrl = baseUrl + targetUrl;

      console.log(subscriptionId);
      console.log(apiKey);

      headersToForward.authorization = `Basic ${Buffer.from(
        `${subscriptionId}:${apiKey}`
      ).toString('base64')}`;
    } else {
      delete req.headers['x-aux-header'];
    }
    if (
      // enableNobiliaHack &&
      fullUrl.match('calc.js') &&
      fullUrl.match('nobilia')
    ) {
      delete headersToForward[
        'content-type'
      ]; /* = req.headers['content-type'];*/
      delete req.headers['x-aux-header'];
    }
    // END NOBILIA DEMO HACKS

    const payload = {
      method: req.method,
      headers: headersToForward,
      compress: false,
    };

    if (req.method === 'POST') {
      payload.body = JSON.stringify(req.body || {});
    }

    console.log('FullUrl:', fullUrl);
    const response = await fetch(fullUrl, payload);

    for (const [key, value] of response.headers.entries()) {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.set(key, value);
      }
    }

    res.status(response.status);

    await pipeline(response.body, res);
    console.log('Stream finished with', response.status, fullUrl);
  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  }
};
