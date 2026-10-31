# Adding a secret variable to the demo proxy (`proxy_request`)

The demo proxy is the Cloud Function `proxy_request` of the GCP project `rml-showcases`, region
`europe-west3`. It forwards the requests of the roomle-ui HI catalog example to HOMAG. Its code is
in this repository, `minifabric-example/proxy-server/index.js`; `npm run deploy:proxy` and
`npm run dev:proxy` are scripts of the root `package.json`. How it is built:
[Demo proxy](../context/demo-proxy.md). What the proxy does is described in roomle-ui
`packages/embedding-lib/docs/homag-intelligence-embedding.md`, section "The demo proxy".

All commands run in the root of a roomle-hi-example checkout.

## Adding a secret

1. Create the secret in Secret Manager:

   ```bash
   printf '%s' 'THE_VALUE' | gcloud secrets create MY_SECRET \
     --project rml-showcases --replication-policy=automatic --data-file=-
   ```

2. Attach it to the function as an environment variable:

   ```bash
   npm run deploy:proxy -- --update-secrets=MY_SECRET=MY_SECRET:latest
   ```

3. Read it in the code (`minifabric-example/proxy-server/index.js`):

   ```js
   const mySecret = process.env.MY_SECRET;
   ```

4. For local development, add `MY_SECRET=...` to `.env.local` in the repository root and run
   `npm run dev:proxy`.

## Changing the value

```bash
printf '%s' 'NEW_VALUE' | gcloud secrets versions add MY_SECRET --project rml-showcases --data-file=-
npm run deploy:proxy
```

Redeploying makes the function load the new value right away. Without it, instances that are
already running keep the old one.

## Things to know

- **Use `--update-secrets`, never `--set-secrets`.** `--set-secrets` replaces the whole list, so
  the function's existing secrets would be removed.
- **Deploying uploads the local `minifabric-example/proxy-server` folder**, so make sure the
  checkout holds the code you want live.
- **No extra permissions are needed:** the function's runtime account can already read every
  secret in the project.
- **Secrets can be created and updated, but not read back.** To see a stored value, ask an admin
  of the GCP project `rml-showcases` (Owner or Secret Manager Admin).
