import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const generator = fileURLToPath(
  new URL('../update-planning-results.js', import.meta.url)
);
const fakeRunner = fileURLToPath(
  new URL('./fixtures/planning-results-runner.js', import.meta.url)
);
const IMAGES = [
  'top-image.png',
  'perspective-image.png',
  'perspective-object-image.png',
];
const OLD_DOCUMENT = '# Planning Results\n\nthe last result\n';

// The generator finds the repository from its own path, so a copy in a
// temporary tree writes there and runs the fake runner beside it.
const fixture = async (t, cases) => {
  const root = await mkdtemp(join(tmpdir(), 'planning-results-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scripts = join(root, '.agents', 'scripts');
  const images = join(root, 'docs', 'images');
  await mkdir(scripts, { recursive: true });
  await mkdir(images, { recursive: true });
  await copyFile(generator, join(scripts, 'update-planning-results.js'));
  await copyFile(fakeRunner, join(scripts, 'run-hi-mcp-tests.js'));
  for (const file of ['kitchen-10.png', 'kitchen-2.jpeg', 'living-room.png']) {
    await writeFile(join(images, file), file);
  }
  await writeFile(
    join(root, 'docs', 'test-prompts.json'),
    JSON.stringify({ plans: { 'default-room': 'ps_room' } })
  );
  const document = join(root, 'docs', 'planning-results.md');
  await writeFile(document, OLD_DOCUMENT);
  const resultImages = join(images, 'planning-results');
  const run = () =>
    exec(
      process.execPath,
      [
        join(scripts, 'update-planning-results.js'),
        '--out',
        join(root, 'session'),
      ],
      {
        env: { ...process.env, PLANNING_RESULTS_CASES: JSON.stringify(cases) },
        timeout: 15_000,
      }
    ).then(
      () => 0,
      (error) => error.code
    );
  return { document, resultImages, run };
};

test('writes a section per kitchen image with its plan link and result images', async (t) => {
  const f = await fixture(t, {
    'kitchen-2': { planSnapshotId: 'ps_two', files: IMAGES },
    'kitchen-10': { planSnapshotId: 'ps_ten', files: IMAGES },
  });
  assert.equal(await f.run(), 0);
  const document = await readFile(f.document, 'utf8');
  assert.match(
    document,
    /to `gpt-6-astra` on the .*\(`ps_room`\), 2026-10-13\./
  );
  assert.deepEqual(
    [...document.matchAll(/^## (.+)$/gm)].map(([, title]) => title),
    ['Kitchen 2', 'Kitchen 10']
  );
  assert.match(
    document,
    /plan: https:\/\/www\.roomle\.com\/t\/ligna-store-test\/kitchens\/\?id=ps_two\n\nplan snapshot id: `ps_two`\n\n!\[Kitchen 2\]\(\.\/images\/kitchen-2\.jpeg\)/
  );
  assert.match(
    document,
    /\| !\[Kitchen 10 top\]\(\.\/images\/planning-results\/kitchen-10-top\.png\) \| !\[Kitchen 10 perspective\]\(\.\/images\/planning-results\/kitchen-10-perspective\.png\) \| !\[Kitchen 10 perspective object\]\(\.\/images\/planning-results\/kitchen-10-perspective-object\.png\) \|/
  );
  assert.equal(
    await readFile(
      join(f.resultImages, 'kitchen-10-perspective-object.png'),
      'utf8'
    ),
    'kitchen-10 perspective-object-image.png'
  );
});

test('leaves the document unchanged when a chat failed although its snapshot was saved', async (t) => {
  const f = await fixture(t, {
    'kitchen-2': { planSnapshotId: 'ps_two', files: IMAGES },
    'kitchen-10': {
      planSnapshotId: 'ps_partial',
      errors: ['chat request failed: terminated'],
      files: IMAGES,
    },
  });
  assert.equal(await f.run(), 1);
  assert.equal(await readFile(f.document, 'utf8'), OLD_DOCUMENT);
  assert.equal(existsSync(f.resultImages), false);
});

test('leaves the document unchanged when a result image is missing', async (t) => {
  const f = await fixture(t, {
    'kitchen-2': { planSnapshotId: 'ps_two', files: IMAGES.slice(0, 2) },
    'kitchen-10': { planSnapshotId: 'ps_ten', files: IMAGES },
  });
  assert.equal(await f.run(), 1);
  assert.equal(await readFile(f.document, 'utf8'), OLD_DOCUMENT);
  assert.equal(existsSync(f.resultImages), false);
});
