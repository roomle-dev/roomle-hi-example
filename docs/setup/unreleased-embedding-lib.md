# Using an unreleased embedding-lib

The example page `minimal-hi-example/index.html` imports `@roomle/embedding-lib` and its `hi.js` from
unpkg, pinned to the dev version `0.0.0-dev-c1bdbb4` with prompt token-usage logging:

```js
import RoomleConfiguratorApi from 'https://unpkg.com/@roomle/embedding-lib@0.0.0-dev-c1bdbb4';
import { /* … */ setupHi } from 'https://unpkg.com/@roomle/embedding-lib@0.0.0-dev-c1bdbb4/hi.js';
```

To try a change that exists only on a roomle-ui branch, point these two imports somewhere else. Two ways
work: the source of a local roomle-ui checkout, and a dev version on npm.

## From the source of a local roomle-ui checkout (no build)

The embedding dev server of roomle-ui compiles the source on request and answers a page on any
`localhost` port, so the example page can import the lib straight from it. Nothing is built or published.

For MCP tests run the planner with `npm run dev -- --port 5173 --strictPort` as well, then pass
`--dev` to the test runner. That flag selects the local planner only; both import overrides below
are also required to test a local assistant. `run.json.runtime` records loaded local embedding
module URLs and planner origins. Verify them against the recorded source commit.

`npm run build:embedding` in roomle-ui validates local packaging and declarations separately.
Neither the source-server workflow nor that build publishes a dev package. Keep local imports
uncommitted and restore them after testing; a remote publication needs a pushed commit and its
own authorization.

1. Check out the roomle-ui branch and run `npm ci` once.
2. In roomle-ui, start the embedding dev server on a free port. Not 3000 — that is the port of this
   example:

   ```bash
   npm run dev:embedding -- --port 3001 --strictPort
   ```

3. In `minimal-hi-example/index.html`, replace the two import URLs. Keep this change local and do not
   commit it:

   ```js
   import RoomleConfiguratorApi from 'http://localhost:3001/src/roomle-embedding-lib.ts';
   import { /* … */ setupHi } from 'http://localhost:3001/src/hi.ts';
   ```

4. Start the example as usual (`npm start`). A reload of the page picks up a change of the source.
5. If the change needs the Rubens UI of the same branch as well (for example a new tool command), run the
   UI dev server of the checkout on its own port and hand it to the launcher:

   ```bash
   # in roomle-ui
   npm run dev -- --port 5174 --strictPort

   # here
   EXAMPLE_SERVER_URL=http://localhost:5174/ npm start
   ```

Checked on 2026-10-20: a page on another `localhost` port imports `/src/roomle-embedding-lib.ts` and
`/src/hi.ts` from the dev server, with every export the example uses.

This works only on the machine with the roomle-ui checkout.

## A dev version on npm

A manual run of the roomle-ui workflow `cd-gcp-rubens-stage-roomle-com.yaml` builds the embedding-lib of
the chosen branch and publishes it as `@roomle/embedding-lib@0.0.0-dev-❬7-character commit sha❭` with the
dist-tag `dev` ([RML-18202](https://roomle.atlassian.net/browse/RML-18202)). The released versions
(`latest`, `alpha`) do not change, and no version range matches a `0.0.0-dev-…` version.

1. Start the workflow for the branch. It needs a GitHub login with write access to roomle-ui
   (`gh auth status`). Until the workflow change is on the `master` of roomle-ui, only the CLI or the
   REST API can start it; the "Run workflow" button in the Actions tab ("CD - GCP - rubens.\*") appears
   once the copy on `master` has the manual trigger.

   ```bash
   gh workflow run cd-gcp-rubens-stage-roomle-com.yaml \
     --repo roomle-dev/roomle-ui \
     --ref ❬branch❭

   # the same through the REST API
   gh api -X POST repos/roomle-dev/roomle-ui/actions/workflows/cd-gcp-rubens-stage-roomle-com.yaml/dispatches \
     -f ref=❬branch❭
   ```

   If GitHub answers with HTTP 422 "Workflow does not have 'workflow_dispatch' trigger", nothing runs:
   the copy of the workflow on that branch has no manual trigger, or GitHub wants the trigger on
   `master` first.

2. Follow the run:

   ```bash
   gh run list --repo roomle-dev/roomle-ui --workflow cd-gcp-rubens-stage-roomle-com.yaml \
     --branch ❬branch❭ --limit 1
   gh run watch ❬run id❭ --repo roomle-dev/roomle-ui
   ```

3. Take the version from the run summary, from npm or from the head commit of the branch:

   ```bash
   npm view @roomle/embedding-lib dist-tags

   # in a roomle-ui checkout
   git rev-parse --short=7 origin/❬branch❭
   ```

4. Point the two imports of `index.html` at it:

   ```js
   import RoomleConfiguratorApi from 'https://unpkg.com/@roomle/embedding-lib@0.0.0-dev-abc1234';
   import { /* … */ setupHi } from 'https://unpkg.com/@roomle/embedding-lib@0.0.0-dev-abc1234/hi.js';
   ```

Pin the exact version: the dist-tag `dev` moves with every run of any branch.

This works on every machine and needs no roomle-ui checkout. A run uses the workflow file of the chosen
branch, so the branch needs the version of that file with the manual trigger. `feat/hi-mcp` and
branches derived from it carry that trigger. Build from the branch containing the source change,
then pin its verified SHA version in both imports. `--dev` changes the planner URL only and does not
select an embedding-lib version.

## What does not work

| Way | Why not |
|---|---|
| A local build copied into `minimal-hi-example/`, or a build committed to this repository | The launcher serves only `.html`, `.js`, `.md` and `.json` files (`STATIC_CONTENT_TYPES` in `minimal-hi-example/start.mjs`); the chunks of the lib are `.mjs` files and get a 404 |
| roomle-ui as a git submodule | roomle-ui is a private repository, so every clone needs access to it, and it needs the full roomle-ui install and build — too heavy for a static page |
| An npm git dependency (`github:roomle-dev/roomle-ui#❬branch❭`) | npm cannot install a package from a subfolder of a repository, and the lib has to be built first |
| `patch-package` or `npm patch` | They patch the built, hashed files of a published version; the page does not use `node_modules`, and new modules and exports cannot be expressed as a patch |
| GitHub Packages or a workflow artifact | Downloads need a token, and unpkg cannot serve them |
| jsDelivr or raw GitHub URLs | roomle-ui is private, and the built lib is not in git |
| The preview of a roomle-ui pull request (`test.roomle.com/t/cp/❬PR❭/examples/`) | It holds the example pages only, without the library files, and it is behind a Google login |
