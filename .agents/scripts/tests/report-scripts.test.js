import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const extract = fileURLToPath(
  new URL('../extract-run-facts.js', import.meta.url)
);
const build = fileURLToPath(
  new URL('../build-test-report.js', import.meta.url)
);

const writeJson = async (dir, name, value) => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify(value, null, 2));
};

const anchorOf = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

const brokenLinks = (report) => {
  const anchors = new Set(
    [...report.matchAll(/^#{2,3} (.+)$/gm)].map((m) => '#' + anchorOf(m[1]))
  );
  return [...report.matchAll(/\]\((#[^)]+)\)/g)]
    .map((m) => m[1])
    .filter((link) => !anchors.has(link));
};

const runDir = (session, dir) => join(session, dir);

const writeRun = async (session, dir, runJson, ctx, plannerCalls) => {
  const full = runDir(session, dir);
  await writeJson(full, 'run.json', runJson);
  await writeJson(full, 'plan-context.json', ctx);
  await writeJson(full, 'planner-calls.json', plannerCalls);
};

// A single-model session: three runs (a fixed test with corrections and an
// error, a random test with a notLoaded group and a long answer, an image test
// with no prompt and no perspective-object image) and a fourth test skipped.
const singleModelSession = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'report-scripts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = join(root, 'mcp-test-2099-01-01_00-00');
  await mkdir(session, { recursive: true });

  const tests = {
    randomTests: 1,
    models: [{ provider: 'gpt-test-a', apiKey: '$KEY' }],
    plans: { 'default-room': 'ps_room' },
    tests: [
      {
        id: 'alpha-create',
        title: 'Alpha create',
        plan: 'default-room',
        prompt: 'add one cabinet',
      },
      {
        id: 'beta-random',
        title: 'Random: beta',
        plan: 'default-room',
        random: true,
        prompt: 'make it white',
      },
      {
        id: 'gamma-image',
        title: 'Gamma image',
        plan: 'default-room',
        image: 'docs/images/gamma.png',
        prompt: null,
      },
      {
        id: 'delta-skipped',
        title: 'Delta skipped',
        plan: 'default-room',
        prompt: 'skipped',
      },
    ],
  };
  await writeJson(session, 'tests.json', tests);
  await writeJson(session, 'results.json', {
    tests: join(session, 'tests.json'),
    startedAt: '2099-01-01T00:00:00.000Z',
    finishedAt: '2099-01-01T00:10:00.000Z',
    runs: [
      {
        model: 'gpt-test-a',
        test: 'alpha-create',
        title: 'Alpha create',
        random: false,
        dir: 'gpt-test-a/01-alpha-create',
        attempts: ['gpt-test-a/01-alpha-create'],
        exitCode: 0,
        planSnapshotId: 'ps_run01',
        errors: [],
        durationMs: 1000,
      },
      {
        model: 'gpt-test-a',
        test: 'beta-random',
        title: 'Random: beta',
        random: true,
        dir: 'gpt-test-a/02-beta-random',
        attempts: ['gpt-test-a/02-beta-random'],
        exitCode: 0,
        planSnapshotId: 'ps_run02',
        errors: [],
        durationMs: 800,
      },
      {
        model: 'gpt-test-a',
        test: 'gamma-image',
        title: 'Gamma image',
        random: false,
        dir: 'gpt-test-a/03-gamma-image',
        attempts: ['gpt-test-a/03-gamma-image'],
        exitCode: 0,
        planSnapshotId: 'ps_run03',
        errors: [],
        durationMs: 700,
      },
    ],
  });

  await writeRun(
    session,
    'gpt-test-a/01-alpha-create',
    {
      provider: 'gpt-test-a',
      plan: 'default-room',
      turns: [
        {
          prompt: 'add one cabinet',
          answer: 'Added one cabinet.',
          tools: ['get-plan-context', 'create-or-replace-groups'],
          errors: [],
          toolCalls: [
            {
              tool: 'create-or-replace-groups',
              corrections: [
                'create-or-replace-groups: posGroups[0]: fixed the placement',
                'create-or-replace-groups posGroups[1]: second correction',
              ],
              notLoaded: null,
              error: null,
            },
            {
              tool: 'undo',
              corrections: [],
              notLoaded: null,
              error: 'nothing to undo',
            },
          ],
          durationMs: 900,
        },
      ],
      errors: [],
      planSnapshotId: 'ps_run01',
    },
    {
      groups: [
        {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          position: {
            pos: [100, 0, -200],
            rotationY: 270,
            footprint: { widthMm: 600, depthMm: 617 },
          },
          roots: [
            {
              articleId: 'UTB60',
              rowIndex: 1,
              desc: 'Base cabinet\nSelect for storage',
              category: 'Kitchen | Base Units',
              attributes: [{ id: 'mod_DoorDirectionSelection', value: 'Left' }],
            },
            {
              articleId: 'UTB60',
              rowIndex: 2,
              desc: 'Base cabinet',
              category: 'Kitchen | Base Units',
              attributes: [],
            },
            { articleId: 'WT60', isGenerated: true, desc: 'Worktop' },
          ],
        },
      ],
    },
    [
      { id: 1, tool: 'get-plan-context', input: {}, ms: 40, ok: true },
      {
        id: 2,
        tool: 'create-or-replace-groups',
        input: { posGroups: [] },
        ms: 900,
        ok: true,
      },
      {
        id: 3,
        tool: 'undo',
        input: {},
        ms: 10,
        ok: false,
        error: 'nothing to undo',
      },
    ]
  );
  await writeFile(
    join(session, 'gpt-test-a/01-alpha-create/perspective-object-image.png'),
    ''
  );

  await writeRun(
    session,
    'gpt-test-a/02-beta-random',
    {
      provider: 'gpt-test-a',
      plan: 'default-room',
      turns: [
        {
          prompt: 'make it white',
          answer: 'B'.repeat(600),
          tools: ['change-group-attribute'],
          errors: [],
          toolCalls: [
            {
              tool: 'create-or-replace-groups',
              corrections: [],
              notLoaded: [
                {
                  index: 0,
                  id: 'bbbb',
                  rootIds: ['cccc'],
                  errors: [
                    'A'.repeat(295) + ' BCDEFGH',
                    'first group, second error',
                  ],
                },
                {
                  index: 1,
                  id: 'dddd',
                  rootIds: ['eeee'],
                  errors: ['second group, only error'],
                },
              ],
              error: null,
            },
          ],
          durationMs: 800,
        },
      ],
      errors: [],
      planSnapshotId: 'ps_run02',
    },
    { groups: [] },
    []
  );

  await writeRun(
    session,
    'gpt-test-a/03-gamma-image',
    {
      provider: 'gpt-test-a',
      plan: 'default-room',
      turns: [
        {
          prompt: null,
          answer: 'Planned from the image.',
          tools: ['get-skill'],
          errors: [],
          toolCalls: [],
          durationMs: 700,
        },
      ],
      errors: [],
      planSnapshotId: 'ps_run03',
    },
    { groups: [] },
    []
  );

  const evals = {
    header: { planner: 'bo-test' },
    frontSections: [
      {
        heading: 'Bugs',
        body: '- one bug in [[01]] and a model finding in [[02]]; also [[03]]',
      },
    ],
    randomKeep: { '02': 'yes — covers beta' },
    skipped: ['Delta skipped — the model reads no images'],
    runs: {
      'gpt-test-a|01': {
        verdict: 'pass',
        bug: 'no',
        bugText: 'nothing failed.',
        doors: 'one door `Left`',
        evaluation: 'the cabinet stands.',
      },
      'gpt-test-a|02': {
        verdict: 'partial',
        bug: 'no: model finding',
        bugText: 'the model stopped early.',
        doors: 'no doors',
        evaluation: 'half done.',
      },
      'gpt-test-a|03': {
        verdict: 'fail',
        bug: 'yes: planner (roomle-ui)',
        bugText: 'the planner refused.',
        doors: 'no doors',
        evaluation: 'nothing created.',
      },
    },
  };
  await writeJson(session, 'evals.json', evals);
  return { session, evals };
};

// A two-model session (the second model's name has a dot): one fixed image
// test and one random test, both run by both models.
const multiModelSession = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'report-scripts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = join(root, 'mcp-test-2099-01-02_00-00');
  await mkdir(session, { recursive: true });

  const tests = {
    randomTests: 1,
    models: [
      { provider: 'gpt-test-a', apiKey: '$A' },
      { provider: 'gpt-test.b', apiKey: '$B' },
    ],
    plans: { 'default-room': 'ps_room' },
    tests: [
      {
        id: 'alpha-create',
        title: 'Alpha create',
        plan: 'default-room',
        image: 'docs/images/alpha.png',
        prompt: 'add one cabinet',
      },
      {
        id: 'beta-random',
        title: 'Random: beta',
        plan: 'default-room',
        random: true,
        prompt: 'make it white',
      },
    ],
  };
  await writeJson(session, 'tests.json', tests);

  const run = (model, nn, test, title, random, snapshot) => ({
    model,
    test,
    title,
    random,
    dir: `${model}/${nn}-${test}`,
    attempts: [`${model}/${nn}-${test}`],
    exitCode: 0,
    planSnapshotId: snapshot,
    errors: [],
    durationMs: 500,
  });
  await writeJson(session, 'results.json', {
    tests: join(session, 'tests.json'),
    startedAt: '2099-01-02T00:00:00.000Z',
    finishedAt: '2099-01-02T00:10:00.000Z',
    runs: [
      run('gpt-test-a', '01', 'alpha-create', 'Alpha create', false, 'ps_a01'),
      run('gpt-test-a', '02', 'beta-random', 'Random: beta', true, 'ps_a02'),
      run('gpt-test.b', '01', 'alpha-create', 'Alpha create', false, 'ps_b01'),
      run('gpt-test.b', '02', 'beta-random', 'Random: beta', true, 'ps_b02'),
    ],
  });

  for (const model of ['gpt-test-a', 'gpt-test.b']) {
    for (const [nn, test, prompt] of [
      ['01', 'alpha-create', 'add one cabinet'],
      ['02', 'beta-random', 'make it white'],
    ]) {
      await writeRun(
        session,
        `${model}/${nn}-${test}`,
        {
          provider: model,
          plan: 'default-room',
          turns: [
            {
              prompt,
              answer: 'Done.',
              tools: ['create-or-replace-groups'],
              errors: [],
              toolCalls: [],
              durationMs: 500,
            },
          ],
          errors: [],
          planSnapshotId: `ps_${model}_${nn}`,
        },
        { groups: [] },
        []
      );
    }
  }

  const evalEntry = (verdict, bug, bugText, evaluation) => ({
    verdict,
    bug,
    bugText,
    doors: 'no doors',
    evaluation,
  });
  await writeJson(session, 'evals.json', {
    header: {
      planner: 'bo-test',
      reasoningEffort: { 'gpt-test-a': 'high' },
    },
    frontSections: [
      {
        heading: 'Bugs',
        body: '[[gpt-test-a 01]] and [[gpt-test.b 01]] differ; [[gpt-test.b 02]] too',
      },
    ],
    runs: {
      'gpt-test-a|01': evalEntry('pass', 'no', 'nothing failed.', 'ok'),
      'gpt-test-a|02': evalEntry('pass', 'no', 'nothing failed.', 'ok'),
      'gpt-test.b|01': evalEntry(
        'partial',
        'no: model finding',
        'stopped early.',
        'half'
      ),
      'gpt-test.b|02': evalEntry('pass', 'no', 'nothing failed.', 'ok'),
    },
  });
  return session;
};

test('extracts the facts of a single-model session', async (t) => {
  const { session } = await singleModelSession(t);
  const factsFile = join(session, 'facts.json');
  await exec(process.execPath, [extract, session, factsFile]);
  const facts = JSON.parse(await readFile(factsFile, 'utf8'));

  assert.equal(facts.session, 'mcp-test-2099-01-01_00-00');
  assert.deepEqual(facts.models, ['gpt-test-a']);
  assert.equal(facts.startedAt, '2099-01-01T00:00:00.000Z');
  assert.equal(facts.finishedAt, '2099-01-01T00:10:00.000Z');
  assert.equal(facts.tests.length, 4);
  assert.equal(facts.runs.length, 3);

  const [r1, r2, r3] = facts.runs;
  assert.deepEqual(
    { ...r1, turns: undefined, groups: undefined, plannerCalls: undefined },
    {
      model: 'gpt-test-a',
      nn: '01',
      id: 'alpha-create',
      title: 'Alpha create',
      plan: 'default-room',
      random: false,
      image: null,
      promptTurns: ['add one cabinet'],
      expect: null,
      planSnapshotId: 'ps_run01',
      exitCode: 0,
      attempts: 1,
      runErrors: [],
      dir: 'gpt-test-a/01-alpha-create',
      turns: undefined,
      groups: undefined,
      plannerCalls: undefined,
    }
  );

  assert.equal(r1.groups.length, 1);
  assert.deepEqual(r1.groups[0], {
    id: 'aaaaaaaa',
    pos: [100, 0, -200],
    rot: 270,
    w: 600,
    d: 617,
    roots: [
      {
        articleId: 'UTB60',
        row: 1,
        door: 'Left',
        desc: 'Select for storage',
        category: 'Kitchen | Base Units',
      },
      {
        articleId: 'UTB60',
        row: 2,
        door: 'Automatic',
        desc: 'Base cabinet',
        category: 'Kitchen | Base Units',
      },
    ],
  });

  assert.deepEqual(r1.plannerCalls, [
    { tool: 'get-plan-context', ok: true, error: null },
    { tool: 'create-or-replace-groups', ok: true, error: null },
    { tool: 'undo', ok: false, error: 'nothing to undo' },
  ]);

  assert.equal(r2.nn, '02');
  assert.equal(r2.random, true);
  assert.equal(r2.turns[0].answer, 'B'.repeat(480) + ' …');
  assert.deepEqual(r2.turns[0].toolCalls[0].notLoaded, [
    'A'.repeat(295) + ' …',
    'first group, second error',
    'second group, only error',
  ]);

  assert.equal(r3.nn, '03');
  assert.equal(r3.random, false);
  assert.equal(r3.image, 'docs/images/gamma.png');
  assert.deepEqual(r3.promptTurns, [null]);
});

test('builds the report of a single-model session', async (t) => {
  const { session } = await singleModelSession(t);
  await exec(process.execPath, [extract, session, join(session, 'facts.json')]);
  await exec(process.execPath, [build, session]);
  const report = await readFile(join(session, 'report.md'), 'utf8');

  assert.ok(report.startsWith('# HI MCP test — 2099-01-01 00:00\n'));
  assert.ok(
    report.includes(
      '| Model | Planner | Tests | Pass | Partial | Fail | Bugs |'
    )
  );
  assert.ok(
    report.includes(
      '| gpt-test-a | bo-test | 3 run (2 fixed, 1 random), 1 skipped | 1 | 1 | 1 | 1 |'
    )
  );
  assert.ok(
    report.includes(
      '| 01 | [Alpha create](#01-alpha-create) | pass | no | `ps_run01` |'
    )
  );
  assert.ok(
    report.includes(
      '| 02 | [Random: beta](#02-random-beta) | default-room | partial | yes — covers beta |'
    )
  );
  assert.ok(report.includes('"id": "beta-random"'));
  assert.ok(
    report.includes(
      '- one bug in [01](#01-alpha-create) and a model finding in [02](#02-random-beta); also [03](#03-gamma-image)'
    )
  );

  assert.ok(
    report.includes('- **Tools**: get-plan-context, create-or-replace-groups')
  );
  assert.ok(
    report.includes(
      '- **Corrections**: `create-or-replace-groups`: posGroups[0]: fixed the placement; `create-or-replace-groups`: posGroups[1]: second correction; `undo`, error: nothing to undo'
    )
  );
  assert.ok(report.includes('- **Doors**: one door `Left`'));
  assert.ok(report.includes('- **Answer**: Added one cabinet.'));
  assert.ok(
    report.includes(
      '<img src="gpt-test-a/01-alpha-create/perspective-object-image.png" width="280">'
    )
  );
  assert.ok(report.includes('**Evaluation — pass**: the cabinet stands.'));
  assert.ok(report.includes('**Bug — no**: nothing failed.'));

  assert.ok(
    report.includes(
      '- **Random test**: generated for this session, not in `docs/test-prompts.json`'
    )
  );
  assert.ok(
    report.includes(
      `- **Corrections**: \`create-or-replace-groups\`, notLoaded: ${'A'.repeat(295)} …; \`create-or-replace-groups\`, notLoaded: first group, second error; \`create-or-replace-groups\`, notLoaded: second group, only error`
    )
  );
  assert.ok(report.includes(`- **Answer**: ${'B'.repeat(480)} …`));

  assert.ok(report.includes('> (empty)'));
  assert.ok(
    report.includes('- **Image**: [images/gamma.png](images/gamma.png)')
  );
  assert.ok(
    report.includes('| Image | Perspective | Perspective object | Top |')
  );
  assert.ok(
    report.includes(
      '<img src="gpt-test-a/03-gamma-image/prompt-image.jpg" width="210">'
    )
  );
  assert.ok(report.includes('| (no groups) |'));
  assert.ok(report.includes('**Evaluation — fail**: nothing created.'));
  assert.ok(
    report.includes('**Bug — yes: planner (roomle-ui)**: the planner refused.')
  );

  assert.ok(report.indexOf('## Skipped') > report.indexOf('## 03 Gamma image'));
  assert.ok(
    report.endsWith(
      '## Skipped\n\n- Delta skipped — the model reads no images\n'
    )
  );
  assert.deepEqual(brokenLinks(report), []);
});

test('extracts and builds a multi-model session', async (t) => {
  const session = await multiModelSession(t);
  await exec(process.execPath, [extract, session, join(session, 'facts.json')]);
  const facts = JSON.parse(await readFile(join(session, 'facts.json'), 'utf8'));
  assert.deepEqual(facts.models, ['gpt-test-a', 'gpt-test.b']);
  assert.equal(facts.runs.length, 4);
  assert.deepEqual(
    facts.runs.map((r) => `${r.model}|${r.nn}`),
    ['gpt-test-a|01', 'gpt-test-a|02', 'gpt-test.b|01', 'gpt-test.b|02']
  );

  await exec(process.execPath, [build, session]);
  const report = await readFile(join(session, 'report.md'), 'utf8');

  assert.ok(report.startsWith('# HI MCP test — 2099-01-02 00:00\n'));
  assert.ok(
    report.includes(
      '| Model | Planner | Reasoning effort | Tests | Pass | Partial | Fail | Bugs |'
    )
  );
  assert.ok(
    report.includes(
      '| gpt-test-a | bo-test | high | 2 run (1 fixed, 1 random), 0 skipped | 2 | 0 | 0 | 0 |'
    )
  );
  assert.ok(
    report.includes(
      '| gpt-test.b | bo-test |  | 2 run (1 fixed, 1 random), 0 skipped | 1 | 1 | 0 | 0 |'
    )
  );

  assert.ok(report.includes('### gpt-test-a'));
  assert.ok(report.includes('### gpt-test.b'));
  assert.ok(report.includes('](#gpt-testb--01-alpha-create)'));
  assert.ok(report.includes('## gpt-test.b — 01 Alpha create'));
  assert.ok(
    report.indexOf('## gpt-test-a — 01') <
      report.indexOf('## gpt-test-a — 02') &&
      report.indexOf('## gpt-test-a — 02') <
        report.indexOf('## gpt-test.b — 01') &&
      report.indexOf('## gpt-test.b — 01') <
        report.indexOf('## gpt-test.b — 02')
  );

  assert.ok(
    report.includes(
      '| # | Test | Plan | gpt-test-a | gpt-test.b | Keep as a fixed test |'
    )
  );
  assert.ok(
    report.includes(
      '| 02 | Random: beta | default-room | [pass](#gpt-test-a--02-random-beta) | [pass](#gpt-testb--02-random-beta) | — |'
    )
  );
  assert.ok(
    report.includes(
      'gpt-test-a [01](#gpt-test-a--01-alpha-create) and gpt-test.b [01](#gpt-testb--01-alpha-create)'
    )
  );
  assert.ok(
    report.includes(
      '<img src="gpt-test.b/01-alpha-create/prompt-image.jpg" width="210">'
    )
  );

  assert.equal((report.match(/^## .+ — \d{2} /gm) || []).length, 4);
  assert.deepEqual(brokenLinks(report), []);
});

test('fails explicitly when a required session file is missing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'report-scripts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = join(root, 'mcp-test-2099-01-03_00-00');
  await mkdir(session, { recursive: true });
  const tests = {
    models: [{ provider: 'gpt-test-a' }],
    tests: [{ id: 'alpha', title: 'Alpha', plan: 'default-room', prompt: 'p' }],
  };
  const results = {
    startedAt: '2099-01-03T00:00:00.000Z',
    finishedAt: '2099-01-03T00:10:00.000Z',
    runs: [],
  };
  const factsFile = join(session, 'facts.json');
  const expectFailure = async (pattern, breakFile) => {
    await breakFile();
    await assert.rejects(
      exec(process.execPath, [extract, session, factsFile]),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, pattern);
        return true;
      }
    );
    assert.equal(existsSync(factsFile), false);
  };

  await writeJson(session, 'tests.json', tests);
  await writeJson(session, 'results.json', results);
  await expectFailure(/cannot read .*tests\.json/, () =>
    rm(join(session, 'tests.json'))
  );
  await writeJson(session, 'tests.json', tests);
  await expectFailure(/cannot read .*results\.json/, () =>
    rm(join(session, 'results.json'))
  );
  await writeJson(session, 'results.json', results);
  await expectFailure(/cannot read .*tests\.json/, () =>
    writeFile(join(session, 'tests.json'), '{ nope')
  );
});

test('keeps the startup errors of a run whose run.json is missing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'report-scripts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = join(root, 'mcp-test-2099-01-04_00-00');
  await mkdir(join(session, 'gpt-test-a/01-alpha'), { recursive: true });
  await writeJson(session, 'tests.json', {
    models: [{ provider: 'gpt-test-a' }],
    tests: [{ id: 'alpha', title: 'Alpha', plan: 'default-room', prompt: 'p' }],
  });
  await writeJson(session, 'results.json', {
    startedAt: '2099-01-04T00:00:00.000Z',
    finishedAt: '2099-01-04T00:10:00.000Z',
    runs: [
      {
        model: 'gpt-test-a',
        test: 'alpha',
        title: 'Alpha',
        random: false,
        dir: 'gpt-test-a/01-alpha',
        attempts: ['gpt-test-a/01-alpha'],
        exitCode: 1,
        planSnapshotId: null,
        errors: ['no run.json - see console.log'],
        durationMs: 100,
      },
    ],
  });
  await exec(process.execPath, [extract, session, join(session, 'facts.json')]);
  const facts = JSON.parse(await readFile(join(session, 'facts.json'), 'utf8'));
  assert.equal(facts.runs.length, 1);
  assert.deepEqual(facts.runs[0].runErrors, ['no run.json - see console.log']);
  assert.deepEqual(facts.runs[0].turns, []);
});

test('fails without a write when an evaluation is missing or unknown', async (t) => {
  const { session, evals } = await singleModelSession(t);
  await exec(process.execPath, [extract, session, join(session, 'facts.json')]);

  const missing = structuredClone(evals);
  delete missing.runs['gpt-test-a|03'];
  const missingFile = join(session, 'evals-missing.json');
  await writeJson(session, 'evals-missing.json', missing);
  const out = join(session, 'report-missing.md');
  await assert.rejects(
    exec(process.execPath, [
      build,
      session,
      '--evals',
      missingFile,
      '--out',
      out,
    ]),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /no evaluation for run gpt-test-a\|03/);
      return true;
    }
  );
  assert.equal(existsSync(out), false);

  const unknown = structuredClone(evals);
  unknown.runs['gpt-test-a|99'] = evals.runs['gpt-test-a|01'];
  const unknownFile = join(session, 'evals-unknown.json');
  await writeJson(session, 'evals-unknown.json', unknown);
  await assert.rejects(
    exec(process.execPath, [
      build,
      session,
      '--evals',
      unknownFile,
      '--out',
      out,
    ]),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /evaluation gpt-test-a\|99 resolves to no run/);
      return true;
    }
  );
  assert.equal(existsSync(out), false);
});

test('fails without a write on an unresolved run ref', async (t) => {
  const { session, evals } = await singleModelSession(t);
  await exec(process.execPath, [extract, session, join(session, 'facts.json')]);

  const dangling = structuredClone(evals);
  dangling.frontSections[0].body = 'see [[99]]';
  const danglingFile = join(session, 'evals-dangling.json');
  await writeJson(session, 'evals-dangling.json', dangling);
  const out = join(session, 'report-dangling.md');
  await assert.rejects(
    exec(process.execPath, [
      build,
      session,
      '--evals',
      danglingFile,
      '--out',
      out,
    ]),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /run ref \[\[99\]\] resolves to no run/);
      return true;
    }
  );
  assert.equal(existsSync(out), false);

  const multi = await multiModelSession(t);
  await exec(process.execPath, [extract, multi, join(multi, 'facts.json')]);
  const noModel = JSON.parse(await readFile(join(multi, 'evals.json'), 'utf8'));
  noModel.frontSections[0].body = 'see [[01]]';
  const noModelFile = join(multi, 'evals-nomodel.json');
  await writeJson(multi, 'evals-nomodel.json', noModel);
  await assert.rejects(
    exec(process.execPath, [
      build,
      multi,
      '--evals',
      noModelFile,
      '--out',
      join(multi, 'report-nomodel.md'),
    ]),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /run ref \[\[01\]\] names no model/);
      return true;
    }
  );
});
