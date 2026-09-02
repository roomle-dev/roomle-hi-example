# HI Presets Example

A standalone, copy-paste version of the embedding-lib HI presets demo. It
contains the complete interface and browser JavaScript in one
[`index.html`](./index.html), requires no build step, and loads only
`@roomle/embedding-lib@7.1.0` from unpkg.

## Run it

Serve this directory over HTTP so browser ES module imports work:

```bash
cd packages/embedding-lib/docs/hi-presets-example
npx http-server -c-1 -p 39485
```

Then open <http://127.0.0.1:39485>.

## Configure it

The preset dropdown is filled from `GET <HI_SERVER_BASE_URL>/backends/list`,
the same endpoint the source presets demo uses. There is no hardcoded preset
list: when the request fails the dropdown stays empty, the failure is logged to
the panel, and the page falls back to the `backendId` and `library_id` query
parameters.

Use the preset and library controls in the top bar, or supply query parameters:

- `backendId` selects the HI backend.
- `library_id` overrides the preset's library.
- `plan_id` selects the plan loaded at startup.
- `language` selects the HI and planner locale.
- `user_right` accepts `Simple`, `Advanced`, or `Master`.

The page also forwards the optional feature and debug query parameters used by
the original presets demo. Browser developer tools expose the planner as
`window.instance` for debugging.

The example uses the shared HI test proxy. Deployments should replace
`HI_SERVER_BASE_URL`, `HI_AUTH_DATA`, `EMBEDDING_ID`, default plan, and API
credentials with their own environment-specific values. The included
`HI_AUTH_DATA` is the same test-proxy credential used by the source presets
demo; it must not be reused as a production credential.
