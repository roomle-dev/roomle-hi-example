# Start Page and GitHub Pages

The documentation of `pages/` — the start page of the HI examples. `npm run start:sc` serves it on
:3300 with the [sign-in example](./hi-sc-example.md) under `/hi-sc/` and the
[minifabric example](./minifabric-example.md) under `/nobilia-minifabrik/`; GitHub Pages publishes
the same at <https://roomle-dev.github.io/roomle-hi-example/>. [Back to the overview](./README.md).

| File | Responsibility |
| ---- | -------------- |
| `pages/index.html` | the start page: static HTML with inline styles, no script |
| `pages/assets/` | the images of the start page |
| `pages/examples.mjs` | `EXAMPLES` (the path of each example and its Vite project), `route`, `START_PAGE`, `START_PAGE_ASSETS` |
| `pages/serve.mjs` | the dev server of `start:sc` |
| `pages/build.mjs` | the build of the start page with the examples into `pages/dist/` |
| `pages/tests/examples.test.js` | the unit tests of the examples, the routing and the start page's links |

## The start page

The title "HOMAG Intelligence Examples" at the top left, and three square tiles in a row, each an
image with its label: **HI Sales Configurator** (`hi-sc/`, the sign-in example), **nobilia
Minifabrik** (`nobilia-minifabrik/`) and **Ligna Store** (<https://www.roomle.com/t/ligna-store/>).
The tiles wrap on a narrow screen. The two example links and the images are relative to the page,
so they work on the dev server at `/` and on GitHub Pages under `/roomle-hi-example/`.

| Image (`pages/assets/`) | Shows | Source |
| ----------------------- | ----- | ------ |
| `homag-intelligence.jpg` | the tile of both HI examples: the HI shelves | a section of `hi-sc-example/src/assets/say-hi-to-homag-intelligence.jpg` |
| `ligna-store.jpg` | the tile of the ligna-store: planning in the store | ligna-store `images/home/kitchen_1.png`, as JPEG at 600 px |
| `ligna-store-kitchen.jpg` | the background, darkened by a gradient: a kitchen | ligna-store `images/home/headerbild.png`, as JPEG |

## The dev server

`pages/serve.mjs` (the root `start:sc`, `npm run dev` in `pages/`) is one HTTP server on :3300 —
the next free port when it is taken. It prints the URLs and opens the start page in the browser;
`--no-open` (`npm run start:sc -- --no-open`) leaves the browser closed. It answers (`route`):

- `/` and `/index.html` with the start page, `/assets/<file>` with its image;
- every URL under `/hi-sc/` and `/nobilia-minifabrik/` with the example's own Vite dev server in
  middleware mode — `createServer` with the example's folder as root and the path as `base`, so
  the example's `index.html`, its modules, `@vite/client` and the shared code (`@fs/…`) are all
  under its path. Both Vite servers share the HTTP server for HMR; each answers the WebSocket
  upgrades of its own base;
- `/hi-sc` and `/nobilia-minifabrik` with a redirect to the path with its trailing slash, the query
  kept — the sign-in example reads its fields from the query;
- anything else with 404.

Each example keeps its own Vite project; `npm run dev` in its folder still serves it alone
(:3300 the sign-in example, :3400 the minifabric example).

## The build

`pages/build.mjs <base>` builds every example with Vite's `build`, its folder as root and
`<base><path>/` as base, into `pages/dist/<path>/`, and copies the start page to
`pages/dist/index.html` and its images to `pages/dist/assets/`. `npm run build:pages` in `pages/`
checks the types of both examples (`tsc -p`) and builds for the base `/roomle-hi-example/`.

## GitHub Pages

The workflow `.github/workflows/deploy.yml` publishes the build at
<https://roomle-dev.github.io/roomle-hi-example/> on every push to the branch `release/pages`, and
builds from it:

1. `npm ci`, then `npm run build:pages --workspace pages`;
2. `actions/upload-pages-artifact` uploads `pages/dist`, `actions/deploy-pages` deploys it to the
   environment `github-pages` (`permissions`: `pages: write`, `id-token: write`).

To publish, push to `release/pages`, for example `git push origin master:release/pages`. No branch
holds the build.

The repository needs, once: Pages with the source **GitHub Actions** (settings → Pages), and
`release/pages` among the deployment branches of the environment `github-pages` (settings →
Environments), which allows only the default branch at first.

## Tests

`pages/tests/examples.test.js` (`node --test`): the two examples under their paths; the start page
and its images at the root, no path out of `assets/`, every URL under an example's path to that
example, the redirect to the trailing slash with the query, 404 for other paths; the three links of
the start page, and every image it shows in `pages/assets/`.
