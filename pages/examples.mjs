import { fileURLToPath } from 'node:url';

export const START_PAGE = fileURLToPath(
  new URL('./index.html', import.meta.url)
);

/** The examples of the start page: the path each one has under it, and its Vite project. */
export const EXAMPLES = [
  { path: 'hi-sc', root: '../hi-sc-example/' },
  { path: 'nobilia-minifabrik', root: '../minifabric-example/' },
].map(({ path, root }) => ({
  path,
  root: fileURLToPath(new URL(root, import.meta.url)),
}));

/**
 * What the dev server answers for the URL path `pathname` with the query
 * `search`: the start page, the example under whose path it is, a redirect
 * to the path of an example with its trailing slash, or nothing.
 */
export const route = (pathname, search = '') => {
  if (pathname === '/' || pathname === '/index.html') {
    return { kind: 'start-page' };
  }
  for (const example of EXAMPLES) {
    if (pathname === `/${example.path}`) {
      return { kind: 'redirect', location: `/${example.path}/${search}` };
    }
    if (pathname.startsWith(`/${example.path}/`)) {
      return { kind: 'example', example };
    }
  }
  return { kind: 'not-found' };
};
