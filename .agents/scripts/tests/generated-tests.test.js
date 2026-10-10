import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
const skill = await readFile(
  new URL('../../skills/hi-mcp-testing.md', import.meta.url),
  'utf8'
);
const filter = skill.match(
  /jq --slurpfile standard[\s\S]*? '\n([\s\S]*?)\n' "\$SESSION\/tests\.json"/
)?.[1];
const coverage = [
  'create',
  'place',
  'attributes',
  'edit',
  'history',
  'conversation',
];
const standards = coverage.map((topic) => ({
  id: `standard-${topic}-storage`,
  title: `Standard: ${topic} storage`,
  plan: 'room',
  prompt: ['Add storage along the left wall', 'Make the fronts white'],
  expect: 'Turn 1 creates storage; turn 2 applies white fronts',
}));
const random = Array.from({ length: 3 }, (_, i) => ({
  id: `random-${i + 1}-storage`,
  title: `Random: storage ${i + 1}`,
  plan: 'room',
  random: true,
  prompt: 'Add two storage units',
  expect: 'Two storage units',
}));

const fixture = async (t, { standardCount = 6, randomCount = 3 } = {}) => {
  assert.ok(
    filter,
    'The testing skill must define executable session composition'
  );
  const root = await mkdtemp(join(tmpdir(), 'mcp-generated-tests-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tests = join(root, 'tests.json');
  const standardFile = join(root, 'standard-tests.json');
  const randomFile = join(root, 'random-tests.json');
  const calls = join(root, 'calls.json');
  const caseFile = join(root, 'cases.json');
  const out = join(root, 'results');
  const base = {
    models: [{ provider: 'mock', apiKey: 'unused' }],
    plans: { room: 'ps_fixture' },
    randomTests: randomCount,
    tests: [
      {
        id: 'fixed-storage',
        title: 'Fixed storage',
        plan: 'room',
        prompt: 'Add storage',
      },
    ],
  };
  await writeFile(tests, JSON.stringify(base));
  return {
    tests,
    base,
    compose: async (
      standardCases = standardCount ? standards : [],
      randomCases = random.slice(0, randomCount)
    ) => {
      await writeFile(standardFile, JSON.stringify(standardCases));
      await writeFile(randomFile, JSON.stringify(randomCases));
      const { stdout } = await exec('jq', [
        '--slurpfile',
        'standard',
        standardFile,
        '--slurpfile',
        'random',
        randomFile,
        '--argjson',
        'standardCount',
        String(standardCount),
        filter,
        tests,
      ]);
      await writeFile(tests, stdout);
      return JSON.parse(stdout);
    },
    calls: async () =>
      existsSync(calls) ? JSON.parse(await readFile(calls, 'utf8')) : [],
    run: async () => {
      const suite = JSON.parse(await readFile(tests, 'utf8'));
      await writeFile(
        caseFile,
        JSON.stringify(
          suite.tests.map(() => ({
            run: {
              planSnapshotId: 'ps_fixture',
              errors: [],
              snapshotCaptured: true,
            },
          }))
        )
      );
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
    },
  };
};

test('composes and executes fixed, six standard and three random tests, then resumes unchanged', async (t) => {
  const f = await fixture(t);
  const suite = await f.compose();
  assert.deepEqual(suite.tests, [...f.base.tests, ...standards, ...random]);
  const prepared = await readFile(f.tests, 'utf8');
  const results = await f.run();
  assert.deepEqual(
    results.map((run) => run.test),
    suite.tests.map((item) => item.id)
  );
  assert.deepEqual(
    results.map((run) => run.title),
    suite.tests.map((item) => item.title)
  );
  assert.equal(results.filter((run) => run.random).length, 3);
  assert.equal(
    results.filter((run) => run.test.startsWith('standard-')).length,
    6
  );
  assert.ok(results.every((run) => run.exitCode === 0));
  assert.equal((await f.calls()).length, 10);
  await f.run();
  assert.equal((await f.calls()).length, 10);
  assert.equal(await readFile(f.tests, 'utf8'), prepared);
});

test('executes a full standard session with zero random tests', async (t) => {
  const f = await fixture(t, { randomCount: 0 });
  assert.equal((await f.compose()).tests.length, 7);
  const results = await f.run();
  assert.equal(results.length, 7);
  assert.ok(results.every((run) => !run.random));
});

test('keeps a focused session limited to its selected fixed tests', async (t) => {
  const f = await fixture(t, { standardCount: 0, randomCount: 0 });
  assert.deepEqual((await f.compose()).tests, f.base.tests);
  assert.equal((await f.run()).length, 1);
});

test('rejects incorrect generated counts without changing the session file', async (t) => {
  const f = await fixture(t);
  const original = await readFile(f.tests, 'utf8');
  await assert.rejects(
    f.compose(standards.slice(1)),
    /Unexpected generated test counts/
  );
  await assert.rejects(
    f.compose(standards, random.slice(1)),
    /Unexpected generated test counts/
  );
  assert.equal(await readFile(f.tests, 'utf8'), original);
});

test('requires all six standard coverage areas', async (t) => {
  const f = await fixture(t);
  const missingHistory = standards.map((item) =>
    item.id.startsWith('standard-history-')
      ? { ...item, id: 'standard-create-another-storage' }
      : item
  );
  await assert.rejects(
    f.compose(missingHistory),
    /Standard coverage is incomplete/
  );
});

test('requires generated expectations, valid plans and random markings', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.compose(standards.map((item, i) => (i ? item : { ...item, expect: '' }))),
    /Generated tests need expectations and valid plans/
  );
  await assert.rejects(
    f.compose(
      standards.map((item, i) => (i ? item : { ...item, plan: 'unknown' }))
    ),
    /Generated tests need expectations and valid plans/
  );
  await assert.rejects(
    f.compose(
      standards,
      random.map((item) => ({ ...item, random: false }))
    ),
    /Generated test markings are invalid/
  );
});

test('rejects duplicate ids in the composed session', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.compose(
      standards,
      random.map((item, i) => (i === 2 ? { ...item, id: random[0].id } : item))
    ),
    /Duplicate test ids/
  );
});

test('refuses to append generated tests again to a prepared session', async (t) => {
  const f = await fixture(t);
  await f.compose();
  const prepared = await readFile(f.tests, 'utf8');
  await assert.rejects(f.compose(), /Session already prepared/);
  assert.equal(await readFile(f.tests, 'utf8'), prepared);
});
