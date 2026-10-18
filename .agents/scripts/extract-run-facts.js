#!/usr/bin/env node
/**
 * Extracts the per-run facts of a "test the mcp" session into one JSON document:
 *
 *   node .agents/scripts/extract-run-facts.js <sessionDir> [outFile]
 *
 * Reads <sessionDir>/tests.json and results.json and, per run, the run's
 * run.json, plan-context.json and planner-calls.json. Writes the facts to
 * outFile, or to stdout without one. The facts are the working file of the
 * evaluation (skill hi-mcp-testing, section 5) and the input of
 * build-test-report.js: per run the test, the turns with their tools and tool
 * calls (corrections, notLoaded, error) and the shortened answer, the groups
 * after the chat and the planner calls the server sent. A multi-model session
 * is keyed by model and test, so every model's run of a test is kept.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

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

const notLoadedText = (notLoaded) => {
  if (!notLoaded) return null;
  const first = Array.isArray(notLoaded)
    ? notLoaded[0]?.errors?.[0]
    : typeof notLoaded === 'object'
      ? notLoaded.errors?.[0]
      : notLoaded;
  return short(first ?? '', 300);
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

const suite = readJson(join(session, 'tests.json'), {});
const results = readJson(join(session, 'results.json'), {});
const runsByModelAndTest = new Map(
  (results.runs || []).map((r) => [`${r.model}/${r.test}`, r])
);
const models = suite.models?.length
  ? suite.models.map((m) => m.provider)
  : [...new Set((results.runs || []).map((r) => r.model))];

const runs = [];
for (const model of models) {
  (suite.tests || []).forEach((t, i) => {
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
      runErrors: runJson.errors || [],
      turns: (runJson.turns || []).map((turn) => ({
        prompt: turn.prompt,
        tools: turn.tools,
        toolCalls: (turn.toolCalls || []).map((c) => ({
          tool: c.tool,
          corrections: (c.corrections || []).filter(Boolean),
          notLoaded: notLoadedText(c.notLoaded),
          error: c.error || null,
        })),
        answer: short(turn.answer, 480),
      })),
      groups: (ctx.groups || []).map((g) => ({
        id: g.id.slice(0, 8),
        pos: g.position.pos,
        rot: g.position.rotationY,
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
      plannerCalls: (plannerCalls || [])
        .filter((c) => c.method === 'externalObjectGroupOperation')
        .map((c) => ({
          tool: c.args[0],
          ok: c.ok !== false,
          error: c.error || null,
        })),
      dir: run.dir,
    });
  });
}

const facts = {
  session: basename(session),
  startedAt: results.startedAt || null,
  finishedAt: results.finishedAt || null,
  models,
  tests: suite.tests || [],
  runs,
};

const json = JSON.stringify(facts, null, 2) + '\n';
if (outFile) writeFileSync(outFile, json);
else process.stdout.write(json);
