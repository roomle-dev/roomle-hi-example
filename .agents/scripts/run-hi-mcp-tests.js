#!/usr/bin/env node
/**
 * Runs the HI MCP test suite: every test of a test file for every model of
 * it, one run of run-hi-mcp-prompt.js after another (the ports are fixed):
 *
 *   node .agents/scripts/run-hi-mcp-tests.js [<tests.json>] [--out <dir>] [--dev]
 *
 * The test file (default docs/test-prompts.json) holds models
 * ({ provider, apiKey }; apiKey "$NAME" reads the environment variable NAME),
 * plans ({ <name>: <plan snapshot id> }), tests
 * ({ id, title, plan, prompt?, image?, expect?, random? }; a prompt list is
 * sent as consecutive turns of one chat) and randomTests (how many random tests
 * the "test the mcp" skill adds; checked only). Before the first run it checks
 * the file, the images and the keys. A run goes
 * to <out>/<provider>/<NN>-<id>/ with its console.log. Missing run.json or a
 * navigation-interrupted capture gets one retry; the first attempt is kept
 * in <NN>-<id>.attempt-1/. Other stored results and an exhausted retry are
 * skipped on resume with the same --out. <out>/results.json lists the runs and is
 * rewritten after each one (default out: .temp/result/mcp-test-<local time>/).
 */

import { spawn } from 'node:child_process';
import { existsSync, openSync, closeSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isNavigationInterrupted } from './mcp-test-navigation.js';

const REPO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN_SCRIPT = join(REPO_DIR, '.agents', 'scripts', 'run-hi-mcp-prompt.js');
const DEFAULT_TESTS = join(REPO_DIR, 'docs', 'test-prompts.json');
const RESULT_DIR = join(REPO_DIR, '.temp', 'result');
const TEST_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const USAGE =
  'usage: node .agents/scripts/run-hi-mcp-tests.js [<tests.json>] [--out <dir>] [--dev]';

const parseOptions = () => {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        dev: { type: 'boolean', default: false },
      },
    });
    if (positionals.length > 1) {
      throw new Error('one test file');
    }
    return { tests: resolvePath(positionals[0] ?? DEFAULT_TESTS), ...values };
  } catch {
    console.error(USAGE);
    process.exit(1);
  }
};

const localTimestamp = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
};

// The key itself, or $NAME for the key in the environment variable NAME.
const resolveApiKey = (apiKey) =>
  apiKey.startsWith('$') ? process.env[apiKey.slice(1)] : apiKey;

// One chat message, or a list of them sent as consecutive turns of one chat.
const isPrompt = (prompt) =>
  typeof prompt === 'string' ||
  (Array.isArray(prompt) &&
    prompt.length > 0 &&
    prompt.every((turn) => typeof turn === 'string' && turn !== ''));

const problemsOf = ({ models, plans, tests, randomTests }) => {
  const problems = [];
  if (
    randomTests !== undefined &&
    !(Number.isInteger(randomTests) && randomTests >= 0)
  ) {
    problems.push('randomTests: a whole number, 0 or more');
  }
  if (!Array.isArray(models) || models.length === 0) {
    problems.push('models: a non-empty list of { provider, apiKey }');
  }
  for (const model of Array.isArray(models) ? models : []) {
    if (
      typeof model?.provider !== 'string' ||
      typeof model?.apiKey !== 'string'
    ) {
      problems.push(
        `model ${JSON.stringify(model?.provider)}: needs provider and apiKey`
      );
    } else if (!resolveApiKey(model.apiKey)) {
      problems.push(
        `model ${model.provider}: ${model.apiKey || 'apiKey'} is empty`
      );
    }
  }
  if (!Array.isArray(tests) || tests.length === 0) {
    problems.push('tests: a non-empty list');
  }
  const ids = new Set();
  for (const test of Array.isArray(tests) ? tests : []) {
    const name = `test ${test?.id ?? JSON.stringify(test)}`;
    if (!TEST_ID.test(test?.id ?? '') || ids.has(test.id)) {
      problems.push(`${name}: needs a unique kebab-case id`);
    }
    ids.add(test?.id);
    if (!plans?.[test?.plan]) {
      problems.push(`${name}: plan '${test?.plan}' is not in plans`);
    }
    if (!test?.prompt && !test?.image) {
      problems.push(`${name}: needs a prompt, an image or both`);
    }
    if (test?.prompt !== undefined && !isPrompt(test.prompt)) {
      problems.push(`${name}: prompt must be a text or a list of texts`);
    }
    if (test?.random !== undefined && typeof test.random !== 'boolean') {
      problems.push(`${name}: random must be true or false`);
    }
    if (test?.image && !existsSync(join(REPO_DIR, test.image))) {
      problems.push(`${name}: image ${test.image} does not exist`);
    }
  }
  return problems;
};

// The child of the run that is going on; a stop is passed on to it, and the
// run script stops its servers before it exits.
let child;
let stopped = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopped = true;
    child?.kill('SIGTERM');
  });
}

const runOnce = (args, logFile) =>
  new Promise((resolve) => {
    const log = openSync(logFile, 'w');
    child = spawn(process.execPath, [RUN_SCRIPT, ...args], {
      cwd: REPO_DIR,
      stdio: ['ignore', log, log],
    });
    child.on('exit', (code, signal) => {
      closeSync(log);
      child = undefined;
      resolve(code ?? (signal ? 1 : 0));
    });
  });

const readRun = async (dir) => {
  try {
    return JSON.parse(await readFile(join(dir, 'run.json'), 'utf8'));
  } catch {
    return undefined;
  }
};

const main = async () => {
  const options = parseOptions();
  const suite = JSON.parse(await readFile(options.tests, 'utf8'));
  const problems = problemsOf(suite);
  if (problems.length > 0) {
    console.error(
      `[run-hi-mcp-tests] ${relative(process.cwd(), options.tests)}:`
    );
    problems.forEach((problem) => console.error(`  - ${problem}`));
    process.exit(1);
  }
  const outDir = resolvePath(
    options.out ?? join(RESULT_DIR, `mcp-test-${localTimestamp(new Date())}`)
  );
  await mkdir(outDir, { recursive: true });
  const results = {
    tests: relative(REPO_DIR, options.tests),
    startedAt: new Date().toISOString(),
    runs: [],
  };
  const writeResults = () =>
    writeFile(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  const total = suite.models.length * suite.tests.length;
  for (const model of suite.models) {
    for (const [index, test] of suite.tests.entries()) {
      if (stopped) {
        break;
      }
      const number = String(index + 1).padStart(2, '0');
      const dir = join(outDir, model.provider, `${number}-${test.id}`);
      const args = [
        model.provider,
        resolveApiKey(model.apiKey),
        ...[test.prompt ?? ''].flat(),
        '--plan',
        suite.plans[test.plan],
        ...(test.image ? ['--image', test.image] : []),
        ...(options.dev ? ['--dev'] : []),
        '--out',
        dir,
      ];
      const startedAt = Date.now();
      let exitCode = null;
      let run = await readRun(dir);
      const firstAttemptDir = `${dir}.attempt-1`;
      let hasFirstAttempt = existsSync(firstAttemptDir);
      if ((!run || isNavigationInterrupted(run)) && !stopped) {
        if (existsSync(dir) && !hasFirstAttempt) {
          await rename(dir, firstAttemptDir);
          hasFirstAttempt = true;
          run = undefined;
        }
        if (!existsSync(dir)) {
          for (
            let attempt = hasFirstAttempt ? 1 : 0;
            attempt < 2 && !stopped;
            attempt++
          ) {
            await mkdir(dir, { recursive: true });
            exitCode = await runOnce(args, join(dir, 'console.log'));
            run = await readRun(dir);
            if (
              (run && !isNavigationInterrupted(run)) ||
              attempt === 1 ||
              stopped
            ) {
              break;
            }
            await rename(dir, firstAttemptDir);
            hasFirstAttempt = true;
            run = undefined;
          }
        }
      }
      if (stopped && !run) {
        break;
      }
      results.runs.push({
        model: model.provider,
        test: test.id,
        title: test.title,
        random: test.random === true,
        dir: relative(outDir, dir),
        attempts: (hasFirstAttempt ? [firstAttemptDir, dir] : [dir]).map(
          (attemptDir) => relative(outDir, attemptDir)
        ),
        exitCode,
        planSnapshotId: run?.planSnapshotId ?? null,
        errors: run ? run.errors : ['no run.json - see console.log'],
        durationMs: exitCode === null ? null : Date.now() - startedAt,
      });
      await writeResults();
      console.log(
        `[run-hi-mcp-tests] ${results.runs.length}/${total} ${model.provider} ${number}-${test.id}: ` +
          `${exitCode === null ? 'done before' : `exit ${exitCode}`}, ` +
          `${run?.planSnapshotId ?? 'no plan snapshot'}`
      );
    }
  }
  results.finishedAt = new Date().toISOString();
  await writeResults();
  console.log(
    `[run-hi-mcp-tests] ${relative(process.cwd(), join(outDir, 'results.json'))}`
  );
  process.exitCode = stopped ? 130 : 0;
};

main().catch((error) => {
  console.error(`[run-hi-mcp-tests] ${error.message}`);
  process.exitCode = 1;
});
