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
  /jq --slurpfile random[\s\S]*? '\n([\s\S]*?)\n' "\$SESSION\/tests\.json"/
)?.[1];
const sampler = skill.match(/node -e '([^']+)' "\$SESSION\/tests\.json"/)?.[1];
const random = Array.from({ length: 5 }, (_, i) => ({
  id: `random-${i + 1}-storage`,
  title: `Random: storage ${i + 1}`,
  plan: `room-${i + 1}`,
  random: true,
  prompt: 'Add two storage units',
  expect: 'Two storage units',
}));

const fixture = async (t, { randomCount = 5 } = {}) => {
  assert.ok(
    filter,
    'The testing skill must define executable session composition'
  );
  const root = await mkdtemp(join(tmpdir(), 'mcp-generated-tests-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tests = join(root, 'tests.json');
  const randomFile = join(root, 'random-tests.json');
  const calls = join(root, 'calls.json');
  const caseFile = join(root, 'cases.json');
  const out = join(root, 'results');
  const base = {
    models: [{ provider: 'mock', apiKey: 'unused' }],
    plans: Object.fromEntries(
      random.map((item, i) => [item.plan, `ps_fixture_${i + 1}`])
    ),
    randomTests: randomCount,
    tests: [
      {
        id: 'fixed-storage',
        title: 'Fixed storage',
        plan: random[0].plan,
        prompt: 'Add storage',
      },
    ],
  };
  await writeFile(tests, JSON.stringify(base));
  return {
    tests,
    base,
    compose: async (randomCases = random.slice(0, randomCount)) => {
      await writeFile(randomFile, JSON.stringify(randomCases));
      const { stdout } = await exec('jq', [
        '--slurpfile',
        'random',
        randomFile,
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

test('composes and executes fixed and five random tests, then resumes unchanged', async (t) => {
  const f = await fixture(t);
  const suite = await f.compose();
  assert.deepEqual(suite.tests, [...f.base.tests, ...random]);
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
  assert.equal(results.filter((run) => run.random).length, 5);
  assert.ok(results.every((run) => run.exitCode === 0));
  assert.equal((await f.calls()).length, 6);
  await f.run();
  assert.equal((await f.calls()).length, 6);
  assert.equal(await readFile(f.tests, 'utf8'), prepared);
});

test('keeps a focused session limited to its selected fixed tests', async (t) => {
  const f = await fixture(t, { randomCount: 0 });
  assert.deepEqual((await f.compose()).tests, f.base.tests);
  assert.equal((await f.run()).length, 1);
});

test('samples distinct plans up to the plan count, accepts zero and rejects larger counts', async (t) => {
  assert.ok(sampler, 'The testing skill must define executable plan sampling');
  const full = await fixture(t);
  const { stdout } = await exec(process.execPath, ['-e', sampler, full.tests]);
  assert.deepEqual(
    stdout.trim().split('\n').sort(),
    Object.keys(full.base.plans).sort()
  );
  const zero = await fixture(t, { randomCount: 0 });
  assert.equal(
    (await exec(process.execPath, ['-e', sampler, zero.tests])).stdout,
    ''
  );
  const excessive = await fixture(t, { randomCount: 6 });
  await assert.rejects(
    exec(process.execPath, ['-e', sampler, excessive.tests]),
    /randomTests.*number of plans/
  );
});

test('rejects a count above the plan count before composition or execution', async (t) => {
  const f = await fixture(t, { randomCount: 6 });
  const original = await readFile(f.tests, 'utf8');
  await assert.rejects(f.compose(), /randomTests.*number of plans/);
  assert.equal(await readFile(f.tests, 'utf8'), original);
  await assert.rejects(f.run(), /randomTests:.*number of plans/);
  assert.deepEqual(await f.calls(), []);
});

test('rejects incorrect generated counts without changing the session file', async (t) => {
  const f = await fixture(t);
  const original = await readFile(f.tests, 'utf8');
  await assert.rejects(
    f.compose(random.slice(1)),
    /Unexpected generated test counts/
  );
  assert.equal(await readFile(f.tests, 'utf8'), original);
});

test('requires generated expectations, valid plans and random markings', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.compose(random.map((item, i) => (i ? item : { ...item, expect: '' }))),
    /Generated tests need expectations and valid plans/
  );
  await assert.rejects(
    f.compose(
      random.map((item, i) => (i ? item : { ...item, plan: 'unknown' }))
    ),
    /Generated tests need expectations and valid plans/
  );
  await assert.rejects(
    f.compose(random.map((item) => ({ ...item, random: false }))),
    /Generated test markings are invalid/
  );
});

test('rejects duplicate ids in the composed session', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.compose(
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
