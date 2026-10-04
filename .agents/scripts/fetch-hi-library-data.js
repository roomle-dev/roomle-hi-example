#!/usr/bin/env node
/**
 * Fetch the Furniture_Smith article catalog and master data from the HOMAG
 * backend (via its proxy) and write them as two separate JSON files:
 *
 *   docs/library-information/article.json     articles without sub-articles
 *   docs/library-information/master-data.json library master data
 *
 * The requests are the ones libLoadArticleCatalog and libLoadMasterData of the
 * roomle-ui embedding-lib send (packages/embedding-lib/src/homag-intelligence/
 * hi-requests.ts): the relative path api/pos/libraries/{libraryId}/{type} is
 * URL-encoded after the proxy's url= parameter, with Basic authorization and
 * Accept-Language headers. Articles with isConfigDummy are sub-articles (see
 * loadPosData in packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts)
 * and are filtered out. materialProviders is dropped: no consumer needs it and
 * the planner's plan context never contained it.
 *
 * No dependencies, no planner, no browser. Node.js 18+ (global fetch).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_ID = 'HI_PRE_Roomle_Milestone_2';
const LIBRARY_ID = 'Furniture_Smith';
const LANGUAGE = 'en';
const PROXY_BASE_URL = 'https://dfscfgtest01-app.azurewebsites.net';
const AUTH_DATA = `Basic ${Buffer.from('test:6mABjMDnEq4tvaN').toString('base64')}`;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LIBRARY_INFORMATION_DIR = join(
  SCRIPT_DIR,
  '../../docs/library-information'
);
const ARTICLES_PATH = join(LIBRARY_INFORMATION_DIR, 'article.json');
const MASTER_DATA_PATH = join(LIBRARY_INFORMATION_DIR, 'master-data.json');

const fetchLibraryData = async (type) => {
  const url =
    `${PROXY_BASE_URL}/proxy_request?backendId=${encodeURIComponent(BACKEND_ID)}` +
    `&url=${encodeURIComponent(`api/pos/libraries/${LIBRARY_ID}/${type}`)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: AUTH_DATA,
      'Accept-Language': LANGUAGE,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`${type}: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const save = async (path, data) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Saved ${relative(process.cwd(), path)}`);
};

const main = async () => {
  const [articleCatalog, masterData] = await Promise.all([
    fetchLibraryData('articles'),
    fetchLibraryData('masterData'),
  ]);
  const articles = articleCatalog.articles.filter(
    (article) => !article.isConfigDummy
  );
  delete masterData.materialProviders;
  await save(ARTICLES_PATH, { articles });
  await save(MASTER_DATA_PATH, masterData);
  console.log(
    `${articles.length} articles (${articleCatalog.articles.length - articles.length} sub-articles filtered out)`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
