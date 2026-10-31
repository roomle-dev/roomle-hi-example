# Demo Proxy

The demo proxy is the Cloud Function `proxy_request` that forwards the requests of the Roomle demos
to HOMAG and to the Azure AI Foundry resource of the HI chat. Its code is in
[`minifabric-example/proxy-server/`](../../minifabric-example/proxy-server/). Written for
developers who change or deploy it. [Back to the overview](./README.md).

## Where it runs

| | |
| --- | --- |
| URL | `https://europe-west3-rml-showcases.cloudfunctions.net/proxy_request` |
| Function | `proxy_request`, GCP project `rml-showcases`, region `europe-west3`, Node.js 20, HTTP trigger, unauthenticated |
| Callers | the default `HOMAG_INTELLIGENCE_ENDPOINT` of the embedding-lib (roomle-ui `packages/embedding-lib/src/homag-intelligence/hi-utils.ts`) and the HI examples of roomle-ui, the `nobilia-web-sdk-demo` of roomle-dev.github.io, and bo-api-tc-emulator |

## Files

| Path | What it is |
| --- | --- |
| `minifabric-example/proxy-server/index.js` | The function: the export `proxy_request` |
| `minifabric-example/proxy-server/package.json` | The function's package; its only dependency is `node-fetch` |
| `package.json` (root) | The scripts `dev:proxy` and `deploy:proxy`, and their dev dependencies `@google-cloud/functions-framework`, `dotenv-cli` and `node-fetch` |

`proxy-server/` is the deployment unit: `deploy:proxy` uploads the folder as it is in the checkout,
and the build of the function installs the dependencies of its `package.json`. The folder is no
workspace of the repository root.

## What it forwards

- **To HOMAG:** `baseUrl` + `url` with `Authorization: Basic <subscriptionId>:<apiKey>`. The query
  parameters `subscriptionId`, `apiKey` and `baseUrl` replace the deployment's `SHOWCASE_*` values;
  a URL with `nobilia`, or the header `x-aux-header: nobilia`, takes the `SHOWCASE_*_NOBILIA`
  values instead.
- **To Azure AI Foundry:** `POST …/proxy_request/azure-ai/responses` and
  `…/proxy_request/azure-ai/chat/completions` go to `AZURE_AI_BASE_URL` with the deployment's key,
  for the models of `AZURE_AI_MODELS` only.

Every rule — the forwarded headers, the answers and the errors — is in roomle-ui
[`packages/embedding-lib/docs/homag-intelligence-embedding.md`, "The demo proxy"](https://github.com/roomle-dev/roomle-ui/blob/master/packages/embedding-lib/docs/homag-intelligence-embedding.md#the-demo-proxy).

## Configuration

The environment variables of the deployment; all are Secret Manager secrets except the plain
`AZURE_AI_BASE_URL` and `AZURE_AI_MODELS`:

| Variables | Used for |
| --- | --- |
| `SHOWCASE_SUBSCRIPTION_ID`, `SHOWCASE_API_KEY`, `SHOWCASE_BASE_URL` | the forwarding to HOMAG |
| `SHOWCASE_SUBSCRIPTION_ID_NOBILIA`, `SHOWCASE_API_KEY_NOBILIA`, `SHOWCASE_BASE_URL_NOBILIA` | the forwarding of the nobilia requests |
| `AZURE_AI_BASE_URL`, `AZURE_AI_MODELS`, `AZURE_AI_API_KEY` | the Azure AI route |

The function also carries secrets the code does not read (`RAPI_AUTH_TOKEN`,
`SHOWCASE_WEB_HOOK_*`); a deployment keeps them.

## Running it locally

`npm run dev:proxy` in the repository root starts the function in the Functions Framework on port
8080 (`npm run dev:proxy -- --port <port>` for another) with the variables of `.env.local` in the
repository root. The file is git-ignored.

## Deploying

`npm run deploy:proxy` in the repository root runs `gcloud functions deploy proxy_request` with the
settings above; it needs a gcloud login with deploy rights in `rml-showcases`. A deployment keeps
the function's variables and secrets. Add or change them with `--update-env-vars` and
`--update-secrets`, never with the `--set-*` forms, which replace the whole list — see
[Adding a secret variable to the demo proxy](../wiki/adding-a-secret-to-the-demo-proxy.md).
