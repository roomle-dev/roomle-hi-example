import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const runner = fileURLToPath(
  new URL('../run-hi-mcp-tests.js', import.meta.url)
);
const preload = fileURLToPath(
  new URL('./fixtures/prompt-run-preload.js', import.meta.url)
);
const navigationFailure = {
  planSnapshotId: null,
  errors: [
    'snapshot failed: Execution context was destroyed, most likely because of a navigation',
  ],
};
const transportFailure = {
  planSnapshotId: 'ps_partial',
  errors: [
    'chat request failed: Failed to process successful response',
    'terminated',
    'read ECONNRESET',
  ],
  snapshotCaptured: true,
};
const success = {
  planSnapshotId: 'ps_fixture',
  errors: [],
  snapshotCaptured: true,
};

const fixture = async (t, cases, suite = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-suite-navigation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tests = join(root, 'tests.json');
  const caseFile = join(root, 'cases.json');
  const calls = join(root, 'calls.json');
  const out = join(root, 'results');
  const dir = join(out, 'mock', '01-navigation');
  const first = `${dir}.attempt-1`;
  await writeFile(caseFile, JSON.stringify(cases));
  await writeFile(
    tests,
    JSON.stringify({
      models: [{ provider: 'mock', apiKey: 'unused' }],
      plans: { room: 'ps_original' },
      categories: [
        {
          category: 'navigation',
          tests: [
            {
              id: 'navigation',
              title: 'Navigation',
              plan: 'room',
              prompt: 'A test prompt',
            },
          ],
        },
      ],
      ...suite,
    })
  );
  const runAll = async () => {
    await exec(
      process.execPath,
      ['--import', preload, runner, tests, '--out', out],
      {
        env: {
          ...process.env,
          TEST_PROMPT_CASES: caseFile,
          TEST_PROMPT_CALLS: calls,
        },
        timeout: 15_000,
      }
    );
    return JSON.parse(await readFile(join(out, 'results.json'), 'utf8')).runs;
  };
  return {
    dir,
    first,
    calls: async () =>
      existsSync(calls) ? JSON.parse(await readFile(calls, 'utf8')) : [],
    run: async () => (await runAll())[0],
    runAll,
  };
};

test('retries navigation failure once and preserves the first result and log', async (t) => {
  const f = await fixture(t, [
    { run: navigationFailure, firstOnly: true },
    { run: success },
  ]);
  const result = await f.run();
  assert.equal((await f.calls()).length, 2);
  assert.equal(result.planSnapshotId, 'ps_fixture');
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.attempts, [
    'mock/01-navigation.attempt-1',
    'mock/01-navigation',
  ]);
  assert.deepEqual(
    JSON.parse(await readFile(join(f.first, 'run.json'), 'utf8')),
    navigationFailure
  );
  assert.equal(
    (await readFile(join(f.first, 'console.log'), 'utf8')).trim(),
    'attempt-1'
  );
  assert.equal(
    await readFile(join(f.first, 'first-only.txt'), 'utf8'),
    'attempt-1'
  );
  assert.equal(
    (await readFile(join(f.dir, 'console.log'), 'utf8')).trim(),
    'attempt-2'
  );
  assert.equal(existsSync(join(f.dir, 'first-only.txt')), false);
  await f.run();
  assert.equal((await f.calls()).length, 2);
});

test('retries a lost render after recorded planner-frame navigation and a timeout', async (t) => {
  const f = await fixture(t, [
    {
      run: {
        planSnapshotId: null,
        errors: ['snapshot failed: timed out waiting for the snapshot'],
        snapshotCaptured: false,
        navigations: [
          {
            phase: 'snapshot',
            mainFrame: false,
            fragmentOnly: false,
            url: 'http://fixture/planner',
          },
        ],
      },
    },
    { run: success },
  ]);
  assert.equal((await f.run()).planSnapshotId, 'ps_fixture');
  assert.equal((await f.calls()).length, 2);
});

test('keeps three navigation failures without retrying again on resume', async (t) => {
  const f = await fixture(t, [
    { run: navigationFailure },
    { run: navigationFailure },
    { run: navigationFailure },
  ]);
  const result = await f.run();
  assert.equal(result.exitCode, 1);
  assert.equal(result.planSnapshotId, null);
  assert.deepEqual(result.errors, navigationFailure.errors);
  assert.equal(result.attempts.length, 3);
  assert.equal((await f.run()).planSnapshotId, null);
  assert.equal((await f.calls()).length, 3);
});

test('resumes an incomplete first attempt that already has run.json', async (t) => {
  const f = await fixture(t, [{ run: success }]);
  await mkdir(f.dir, { recursive: true });
  await writeFile(join(f.dir, 'run.json'), JSON.stringify(navigationFailure));
  await writeFile(join(f.dir, 'console.log'), 'interrupted first attempt');
  assert.equal((await f.run()).planSnapshotId, 'ps_fixture');
  assert.equal((await f.calls()).length, 1);
  assert.equal(
    await readFile(join(f.first, 'console.log'), 'utf8'),
    'interrupted first attempt'
  );
});

test('resumes after the first attempt was archived but before the retry began', async (t) => {
  const f = await fixture(t, [{ run: success }]);
  await mkdir(f.dir, { recursive: true });
  await writeFile(join(f.dir, 'run.json'), JSON.stringify(navigationFailure));
  await rename(f.dir, f.first);
  assert.equal((await f.run()).planSnapshotId, 'ps_fixture');
  assert.equal((await f.calls()).length, 1);
});

test('preserves missing-run.json attempts and keeps the retry limit across resume', async (t) => {
  const f = await fixture(t, [
    { exitCode: 1 },
    { exitCode: 1 },
    { exitCode: 1 },
  ]);
  const result = await f.run();
  assert.equal(result.attempts.length, 3);
  assert.deepEqual(result.errors, ['no run.json - see console.log']);
  assert.equal(
    (await readFile(join(f.first, 'console.log'), 'utf8')).trim(),
    'attempt-1'
  );
  assert.equal(
    (await readFile(join(f.dir, 'console.log'), 'utf8')).trim(),
    'attempt-3'
  );
  const resumed = await f.run();
  assert.deepEqual(resumed.attempts, result.attempts);
  assert.equal(existsSync(f.dir), true);
  assert.equal(existsSync(`${f.dir}.attempt-3`), false);
  assert.equal(
    (await readFile(join(f.dir, 'console.log'), 'utf8')).trim(),
    'attempt-3'
  );
  assert.equal((await f.calls()).length, 3);
});

test('retries a transport failure and preserves the failed attempt', async (t) => {
  const f = await fixture(t, [
    { run: transportFailure, firstOnly: true },
    { run: success },
  ]);
  const result = await f.run();
  assert.equal((await f.calls()).length, 2);
  assert.equal(result.planSnapshotId, 'ps_fixture');
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.attempts, [
    'mock/01-navigation.attempt-1',
    'mock/01-navigation',
  ]);
  assert.deepEqual(
    JSON.parse(await readFile(join(f.first, 'run.json'), 'utf8')),
    transportFailure
  );
  assert.equal(
    (await readFile(join(f.first, 'console.log'), 'utf8')).trim(),
    'attempt-1'
  );
  assert.equal(
    (await readFile(join(f.dir, 'console.log'), 'utf8')).trim(),
    'attempt-2'
  );
});

test('stops a transport failure after three attempts', async (t) => {
  const f = await fixture(t, [
    { run: transportFailure },
    { run: transportFailure },
    { run: transportFailure },
  ]);
  const result = await f.run();
  assert.equal((await f.calls()).length, 3);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.attempts, [
    'mock/01-navigation.attempt-1',
    'mock/01-navigation.attempt-2',
    'mock/01-navigation',
  ]);
  assert.deepEqual(result.errors, transportFailure.errors);
  const resumed = await f.run();
  assert.equal(resumed.planSnapshotId, result.planSnapshotId);
  assert.deepEqual(resumed.errors, result.errors);
  assert.deepEqual(resumed.attempts, result.attempts);
  assert.equal(existsSync(`${f.dir}.attempt-3`), false);
  assert.deepEqual(
    JSON.parse(await readFile(join(f.dir, 'run.json'), 'utf8')),
    transportFailure
  );
  assert.equal(
    (await readFile(join(f.dir, 'console.log'), 'utf8')).trim(),
    'attempt-3'
  );
  assert.equal((await f.calls()).length, 3);
});

test('never retries a completed error-free run', async (t) => {
  const f = await fixture(t, [{ run: success }]);
  const result = await f.run();
  assert.equal((await f.calls()).length, 1);
  assert.equal(result.planSnapshotId, 'ps_fixture');
  assert.deepEqual(result.attempts, ['mock/01-navigation']);
  assert.equal(existsSync(f.first), false);
});

test('reports an API save failure without navigation without retrying it', async (t) => {
  const saveFailure = {
    planSnapshotId: null,
    errors: ['saving the snapshot failed: Http error "400"'],
    snapshotCaptured: true,
    navigations: [
      { phase: 'loading', mainFrame: true, url: 'http://fixture/example' },
    ],
  };
  const f = await fixture(t, [{ run: saveFailure }]);
  const result = await f.run();
  assert.equal(result.exitCode, 1);
  assert.equal((await f.calls()).length, 1);
  assert.equal(existsSync(f.first), false);
  await f.run();
  assert.equal((await f.calls()).length, 1);
});

test('appends the prompt suffix to the first turn of every test, not to an image sent alone', async (t) => {
  const suffix = 'Decide any open details yourself instead of asking.';
  const f = await fixture(
    t,
    [{ run: success }, { run: success }, { run: success }, { run: success }],
    {
      promptSuffix: suffix,
      categories: [
        {
          category: 'prompts',
          tests: [
            {
              id: 'single',
              title: 'Single',
              plan: 'room',
              prompt: 'add a cabinet',
            },
            {
              id: 'conversation',
              title: 'Conversation',
              plan: 'room',
              prompt: ['Plan a kitchen.', 'make it white'],
            },
            {
              id: 'question',
              title: 'Question',
              plan: 'room',
              prompt: 'which colours can I choose?',
            },
            {
              id: 'image-only',
              title: 'Image only',
              plan: 'room',
              image: 'docs/images/three-tall-units.png',
            },
          ],
        },
      ],
    }
  );
  await f.run();
  assert.deepEqual(
    (await f.calls()).map((call) => call.prompts),
    [
      [`add a cabinet. ${suffix}`],
      [`Plan a kitchen. ${suffix}`, 'make it white'],
      [`which colours can I choose? ${suffix}`],
      [''],
    ]
  );
});

test('sends the prompts unchanged without a prompt suffix', async (t) => {
  const f = await fixture(t, [{ run: success }]);
  await f.run();
  assert.deepEqual(
    (await f.calls()).map((call) => call.prompts),
    [['A test prompt']]
  );
});

test('rejects an empty prompt suffix before the first run', async (t) => {
  const f = await fixture(t, [], { promptSuffix: ' ' });
  await assert.rejects(f.run(), /promptSuffix: a non-empty text/);
  assert.deepEqual(await f.calls(), []);
});

test('runs the tests of every category in the order of the file, numbered across the categories', async (t) => {
  const testOf = (id) => ({ id, title: id, plan: 'room', prompt: id });
  const f = await fixture(
    t,
    [{ run: success }, { run: success }, { run: success }],
    {
      categories: [
        { category: 'cabinet', tests: [testOf('first'), testOf('second')] },
        { category: 'kitchen', tests: [testOf('third')] },
      ],
    }
  );
  const runs = await f.runAll();
  assert.deepEqual(
    runs.map((run) => run.dir),
    ['mock/01-first', 'mock/02-second', 'mock/03-third']
  );
  assert.deepEqual(
    (await f.calls()).map((call) => call.prompts),
    [['first'], ['second'], ['third']]
  );
});

test('rejects categories without a unique name or without tests, and test ids repeated across categories', async (t) => {
  const testOf = (id) => ({ id, title: id, plan: 'room', prompt: id });
  const f = await fixture(t, [], {
    categories: [
      { category: 'cabinet', tests: [testOf('same')] },
      { category: 'cabinet', tests: [testOf('same')] },
      { category: ' ', tests: [testOf('other')] },
      { category: 'empty', tests: [] },
    ],
  });
  await assert.rejects(f.run(), (error) => {
    assert.match(error.stderr, /category "cabinet": needs a unique name/);
    assert.match(error.stderr, /category " ": needs a unique name/);
    assert.match(
      error.stderr,
      /category "empty": tests must be a non-empty list/
    );
    assert.match(error.stderr, /test same: needs a unique kebab-case id/);
    return true;
  });
  assert.deepEqual(await f.calls(), []);
});

test('rejects a test file without categories before the first run', async (t) => {
  const f = await fixture(t, [], {
    categories: undefined,
    tests: [{ id: 'flat', title: 'Flat', plan: 'room', prompt: 'p' }],
  });
  await assert.rejects(
    f.run(),
    /categories: a non-empty list of \{ category, tests \}/
  );
  assert.deepEqual(await f.calls(), []);
});
