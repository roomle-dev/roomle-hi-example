#!/usr/bin/env node
/**
 * Extracts the per-run facts of a "test the mcp" session into one JSON document:
 *
 *   node .agents/scripts/extract-run-facts.js <sessionDir> [outFile]
 *
 * Reads <sessionDir>/tests.json and results.json and, per run, the run's
 * run.json, plan-context.json and planner-calls.json. Writes the facts to
 * outFile, or to stdout without one; a tests.json without categories is
 * rejected before anything is written. The facts are the working file of the
 * evaluation (skill hi-mcp-testing, section 5) and the input of
 * build-test-report.js: per run the test, the planning time and the time to
 * the first plan change, whether model requests were spaced, the turns with
 * their tools and tool calls (corrections, the notLoaded errors, error) and
 * the shortened answer,
 * the groups after the chat and the tool calls the planner ran (in a session
 * recorded before the tools ran in the planner, its plan-changing calls), and
 * the testSet of a session run from a subset such as the minimum set. A
 * multi-model session is keyed by model and test, so every model's run of a
 * test is kept.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  summarizeUsage,
  unavailableUsage,
} from './planning-assistant-usage.js';
import { summarizePlanningTime } from './planning-time.js';

const USAGE =
  'usage: node .agents/scripts/extract-run-facts.js <sessionDir> [outFile]';

const short = (s, n) => {
  const norm = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return norm.length > n
    ? norm.slice(0, n).replace(/\s+\S*$/, '') + ' …'
    : norm;
};

const notLoadedTexts = (notLoaded) => {
  if (!notLoaded) return [];
  const entries = Array.isArray(notLoaded) ? notLoaded : [notLoaded];
  return entries.flatMap((entry) => {
    if (typeof entry === 'string') return [short(entry, 300)];
    const errors = Array.isArray(entry?.errors)
      ? entry.errors
      : entry?.errors
        ? [entry.errors]
        : [];
    return errors.filter(Boolean).map((error) => short(error, 300));
  });
};

// A session recorded before the tools ran in the planner holds planner calls:
// a plan-changing one names its tool in args[0], the reads name none.
const plannerCallFacts = (call) => {
  const tool =
    call.tool ??
    (call.method === 'externalObjectGroupOperation'
      ? call.args?.[0]
      : undefined);
  return tool === undefined
    ? []
    : [{ tool, ok: call.ok !== false, error: call.error || null }];
};

const session = process.argv[2];
if (!session) {
  console.error(USAGE);
  process.exit(1);
}
const outFile = process.argv[3];

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};

const readRequiredJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`extract-run-facts: cannot read ${path} (${error.message})`);
    process.exit(1);
  }
};

const suite = readRequiredJson(join(session, 'tests.json'));
if (!Array.isArray(suite.categories)) {
  console.error(
    `extract-run-facts: ${join(session, 'tests.json')} has no categories - a session prepared before the test categories; prepare it again`
  );
  process.exit(1);
}
const tests = suite.categories.flatMap((c) => c.tests || []);
const results = readRequiredJson(join(session, 'results.json'));
const runsByModelAndTest = new Map(
  (results.runs || []).map((r) => [`${r.model}/${r.test}`, r])
);
const models = suite.models?.length
  ? suite.models.map((m) => m.provider)
  : [...new Set((results.runs || []).map((r) => r.model))];

const runs = [];
for (const model of models) {
  tests.forEach((t, i) => {
    const run = runsByModelAndTest.get(`${model}/${t.id}`);
    if (!run) return;
    const nn = String(i + 1).padStart(2, '0');
    const runJson = readJson(join(session, run.dir, 'run.json'), {});
    const ctx = readJson(join(session, run.dir, 'plan-context.json'), {});
    const plannerCalls = readJson(
      join(session, run.dir, 'planner-calls.json'),
      []
    );
    runs.push({
      model,
      nn,
      id: t.id,
      title: t.title,
      plan: t.plan,
      random: t.random === true,
      image: t.image || null,
      promptTurns: Array.isArray(t.prompt) ? t.prompt : [t.prompt],
      expect: t.expect || null,
      planSnapshotId: run.planSnapshotId || runJson.planSnapshotId || null,
      exitCode: run.exitCode ?? null,
      attempts: Array.isArray(run.attempts) ? run.attempts.length : 1,
      attemptDirs: run.attempts || [run.dir],
      usage: summarizeUsage((runJson.turns || []).map((turn) => turn.usage)),
      time: summarizePlanningTime(runJson.turns || []),
      requestIntervalMs: runJson.runtime?.requestIntervalMs ?? 0,
      runErrors: runJson.errors || run.errors || [],
      turns: (runJson.turns || []).map((turn) => ({
        prompt: turn.prompt,
        usage: turn.usage || unavailableUsage(),
        usageWarnings: turn.usageWarnings || [],
        time: summarizePlanningTime([turn]),
        tools: turn.tools,
        toolCalls: (turn.toolCalls || []).map((c) => ({
          tool: c.tool,
          corrections: (c.corrections || []).filter(Boolean),
          notLoaded: notLoadedTexts(c.notLoaded),
          error: c.error || null,
        })),
        answer: short(turn.answer, 480),
      })),
      groups: (ctx.groups || []).map((g) => ({
        id: g.id.slice(0, 8),
        pos: g.position.pos,
        // rotationY: a run folder of a planner build before the agent's plan space
        rot: g.position.rotationZ ?? g.position.rotationY,
        w: g.position.footprint.widthMm,
        d: g.position.footprint.depthMm,
        roots: (g.roots || [])
          .filter((r) => r.isGenerated !== true)
          .map((r) => ({
            articleId: r.articleId,
            row: r.rowIndex != null ? r.rowIndex : null,
            door:
              (r.attributes || []).find(
                (a) => a.id === 'mod_DoorDirectionSelection'
              )?.value || 'Automatic',
            desc: short((r.desc || '').split('\n').pop() || r.desc || '', 46),
            category: r.category || null,
          })),
      })),
      plannerCalls: (plannerCalls || []).flatMap(plannerCallFacts),
      dir: run.dir,
    });
  });
}

const facts = {
  session: basename(session),
  startedAt: results.startedAt || null,
  finishedAt: results.finishedAt || null,
  testSet: suite.testSet || null,
  models,
  tests,
  runs,
};

const json = JSON.stringify(facts, null, 2) + '\n';
if (outFile) writeFileSync(outFile, json);
else process.stdout.write(json);
