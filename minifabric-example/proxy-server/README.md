# Demo Proxy

The Cloud Function `proxy_request` (GCP project `rml-showcases`, region `europe-west3`) that forwards
the requests of the Roomle demos to HOMAG and to Azure AI Foundry:
<https://europe-west3-rml-showcases.cloudfunctions.net/proxy_request>. How it is built, configured
and deployed: [.agents/context/demo-proxy.md](../../.agents/context/demo-proxy.md).

In the repository root, after `npm install`:

```bash
npm run dev:proxy      # local run on :8080 with the variables of .env.local
npm run deploy:proxy   # deploys this folder to the Cloud Function
```
