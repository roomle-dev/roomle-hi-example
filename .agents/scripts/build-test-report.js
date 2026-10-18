#!/usr/bin/env node
/**
 * Builds the report of a "test the mcp" session:
 *
 *   node .agents/scripts/build-test-report.js <sessionDir> [--facts <file>] [--evals <file>] [--out <file>]
 *
 * Reads the facts of extract-run-facts.js (default <sessionDir>/facts.json) and
 * the evaluation, evals.json (default <sessionDir>/evals.json) — the content
 * that cannot be derived from the runs: per run the verdict, the bug, the doors
 * and the evaluation text; the planner of the header row; the sections between
 * the random tests and the run sections; the random tests worth keeping; the
 * skipped tests. Writes report.md (default <sessionDir>/report.md). The
 * markdown template of skill hi-mcp-testing, section 6, is the content spec:
 * when this script's rendering and the template disagree, the template wins;
 * fix the script.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

const USAGE =
  'usage: node .agents/scripts/build-test-report.js <sessionDir> [--facts <file>] [--evals <file>] [--out <file>]';

const anchorOf = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

const short = (s, n) => {
  const norm = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return norm.length > n
    ? norm.slice(0, n).replace(/\s+\S*$/, '') + ' …'
    : norm;
};

const stripToolPrefix = (tool, text) => {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.startsWith(tool + ': ')) return t.slice(tool.length + 2);
  if (t.startsWith(tool + ' ')) return t.slice(tool.length + 1);
  return t;
};

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    facts: { type: 'string' },
    evals: { type: 'string' },
    out: { type: 'string' },
  },
});
const session = positionals[0];
if (!session) {
  console.error(USAGE);
  process.exit(1);
}
const factsFile = values.facts || join(session, 'facts.json');
const evalsFile = values.evals || join(session, 'evals.json');
const outFile = values.out || join(session, 'report.md');

const facts = JSON.parse(readFileSync(factsFile, 'utf8'));
const evals = JSON.parse(readFileSync(evalsFile, 'utf8'));

const multi = facts.models.length > 1;
const byKey = new Map(facts.runs.map((r) => [`${r.model}|${r.nn}`, r]));
const evalOf = (r) => evals.runs[`${r.model}|${r.nn}`];
const runsOf = (model) =>
  facts.runs
    .filter((r) => r.model === model)
    .sort((a, b) => a.nn.localeCompare(b.nn));
const nnOfTest = new Map(
  facts.tests.map((t, i) => [t.id, String(i + 1).padStart(2, '0')])
);

const headingOf = (r) =>
  multi ? `${r.model} — ${r.nn} ${r.title}` : `${r.nn} ${r.title}`;
const anchorOfRun = (r) => '#' + anchorOf(headingOf(r));

const problems = [];
for (const r of facts.runs) {
  if (!evals.runs?.[`${r.model}|${r.nn}`]) {
    problems.push(`no evaluation for run ${r.model}|${r.nn}`);
  }
}
for (const key of Object.keys(evals.runs || {})) {
  if (!byKey.has(key)) problems.push(`evaluation ${key} resolves to no run`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const m = basename(session).match(
  /^mcp-test-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})/
);
const title = m
  ? `# HI MCP test — ${m[1]} ${m[2]}:${m[3]}`
  : evals.header?.title || '# HI MCP test';

const effort = evals.header?.reasoningEffort;
const headerCells = [
  'Model',
  'Planner',
  ...(effort ? ['Reasoning effort'] : []),
  'Tests',
  'Pass',
  'Partial',
  'Fail',
  'Bugs',
];
const headerRow = (model) => {
  const rs = runsOf(model);
  const ev = rs.map(evalOf);
  const count = (v) => ev.filter((e) => e.verdict === v).length;
  const nBugs = ev.filter((e) => String(e.bug).startsWith('yes')).length;
  const cells = [
    model,
    evals.header?.planner || '',
    ...(effort ? [effort[model] || ''] : []),
    `${rs.length} run (${rs.filter((r) => !r.random).length} fixed, ${rs.filter((r) => r.random).length} random), ${facts.tests.length - rs.length} skipped`,
    String(count('pass')),
    String(count('partial')),
    String(count('fail')),
    String(nBugs),
  ];
  return `| ${cells.join(' | ')} |`;
};

const toolsLine = (r) =>
  r.turns.length === 1
    ? (r.turns[0].tools || []).join(', ')
    : r.turns
        .map((t, i) => `turn ${i + 1}: ${(t.tools || []).join(', ')}`)
        .join('; ');

const correctionsLine = (r) => {
  const entries = [];
  r.turns.forEach((t, i) => {
    for (const c of t.toolCalls || []) {
      const prefix = r.turns.length > 1 ? `turn ${i + 1}, ` : '';
      for (const corr of c.corrections || []) {
        entries.push(
          `${prefix}\`${c.tool}\`: ${short(stripToolPrefix(c.tool, corr), 240)}`
        );
      }
      if (c.notLoaded) {
        entries.push(`${prefix}\`${c.tool}\`, notLoaded: ${c.notLoaded}`);
      }
      if (c.error) entries.push(`${prefix}\`${c.tool}\`, error: ${c.error}`);
    }
  });
  return entries.length ? entries.join('; ') : 'none';
};

const answerLine = (r) =>
  r.turns.length === 1
    ? r.turns[0].answer
    : r.turns.map((t, i) => `turn ${i + 1}: ${t.answer}`).join(' / ');

const imageTable = (r) => {
  const objImg = existsSync(
    join(session, r.dir, 'perspective-object-image.png')
  )
    ? `<img src="${r.dir}/perspective-object-image.png" width="W">`
    : '(no groups)';
  if (r.image) {
    return [
      '| Image | Perspective | Perspective object | Top |',
      '|---|---|---|---|',
      `| <img src="${r.dir}/prompt-image.jpg" width="210"> | <img src="${r.dir}/perspective-image.png" width="210"> | ${objImg.replace('W', '210')} | <img src="${r.dir}/top-image.png" width="210"> |`,
    ];
  }
  return [
    '| Perspective | Perspective object | Top |',
    '|---|---|---|',
    `| <img src="${r.dir}/perspective-image.png" width="280"> | ${objImg.replace('W', '280')} | <img src="${r.dir}/top-image.png" width="280"> |`,
  ];
};

const runSection = (r) => {
  const e = evalOf(r);
  const L = [];
  L.push(`## ${headingOf(r)}`);
  L.push('');
  for (const p of r.promptTurns) L.push(`> ${p || '(empty)'}`);
  L.push('');
  L.push(`Plan: ${r.plan}`);
  L.push('');
  if (r.random) {
    L.push(
      '- **Random test**: generated for this session, not in `docs/test-prompts.json`'
    );
  }
  if (r.image) {
    const b = basename(r.image);
    L.push(`- **Image**: [images/${b}](images/${b})`);
  }
  L.push(`- **Plan snapshot**: \`${r.planSnapshotId}\``);
  L.push(`- **Tools**: ${toolsLine(r)}`);
  L.push(`- **Corrections**: ${correctionsLine(r)}`);
  L.push(`- **Doors**: ${e.doors ?? ''}`);
  L.push(`- **Answer**: ${answerLine(r)}`);
  L.push('');
  L.push(...imageTable(r));
  L.push('');
  L.push(`**Evaluation — ${e.verdict}**: ${e.evaluation}`);
  L.push('');
  L.push(`**Bug — ${e.bug}**: ${e.bugText}`);
  return L;
};

const expandRefs = (body) =>
  body.replace(/\[\[([^\]]+)\]\]/g, (_, ref) => {
    const parts = ref.trim().split(/\s+/);
    const named = parts.length === 2;
    const model = named ? parts[0] : facts.models[0];
    const nn = named ? parts[1] : parts[0];
    if (multi && !named) {
      problems.push(`run ref [[${ref}]] names no model`);
      return ref;
    }
    if (!multi && named && model !== facts.models[0]) {
      problems.push(`run ref [[${ref}]] names another model`);
      return ref;
    }
    const r = byKey.get(`${model}|${nn}`);
    if (!r) {
      problems.push(`run ref [[${ref}]] resolves to no run`);
      return ref;
    }
    return multi
      ? `${model} [${nn}](${anchorOfRun(r)})`
      : `[${nn}](${anchorOfRun(r)})`;
  });

const out = [];
out.push(title);
out.push('');
out.push(`| ${headerCells.join(' | ')} |`);
out.push(`|${'---|'.repeat(headerCells.length)}`);
for (const model of facts.models) out.push(headerRow(model));
out.push('');
out.push('## Summary');
out.push('');
for (const model of facts.models) {
  if (multi) {
    out.push(`### ${model}`);
    out.push('');
  }
  out.push('| # | Test | Verdict | Bug | Plan snapshot |');
  out.push('|---|---|---|---|---|');
  for (const r of runsOf(model)) {
    const e = evalOf(r);
    out.push(
      `| ${r.nn} | [${r.title}](${anchorOfRun(r)}) | ${e.verdict} | ${e.bug} | \`${r.planSnapshotId}\` |`
    );
  }
  out.push('');
}
out.push('## Random tests');
out.push('');
out.push(
  'Generated for this session by the agent that ran it; not in `docs/test-prompts.json`.'
);
out.push('');
const randomTests = facts.tests.filter((t) => t.random === true);
const randomRows = randomTests.filter((t) =>
  facts.models.some((model) => byKey.has(`${model}|${nnOfTest.get(t.id)}`))
);
if (multi) {
  out.push(
    `| # | Test | Plan | ${facts.models.join(' | ')} | Keep as a fixed test |`
  );
  out.push(`|---|---|---|${'---|'.repeat(facts.models.length + 1)}`);
  for (const t of randomRows) {
    const nn = nnOfTest.get(t.id);
    const cells = facts.models.map((model) => {
      const r = byKey.get(`${model}|${nn}`);
      return r ? `[${evalOf(r).verdict}](${anchorOfRun(r)})` : '—';
    });
    out.push(
      `| ${nn} | ${t.title} | ${t.plan} | ${cells.join(' | ')} | ${evals.randomKeep?.[nn] || '—'} |`
    );
  }
} else {
  out.push('| # | Test | Plan | Verdict | Keep as a fixed test |');
  out.push('|---|---|---|---|---|');
  for (const t of randomRows) {
    const nn = nnOfTest.get(t.id);
    const r = byKey.get(`${facts.models[0]}|${nn}`);
    out.push(
      `| ${nn} | [${t.title}](${anchorOfRun(r)}) | ${t.plan} | ${evalOf(r).verdict} | ${evals.randomKeep?.[nn] || '—'} |`
    );
  }
}
out.push('');
out.push('```json');
out.push(JSON.stringify(randomTests, null, 2));
out.push('```');
out.push('');
for (const section of evals.frontSections || []) {
  out.push(`## ${section.heading}`);
  out.push('');
  out.push(expandRefs(section.body));
  out.push('');
}
for (const model of facts.models) {
  for (const r of runsOf(model)) {
    out.push(...runSection(r));
    out.push('');
  }
}
if (evals.skipped?.length) {
  out.push('## Skipped');
  out.push('');
  for (const line of evals.skipped) out.push(`- ${line}`);
  out.push('');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const report = out.join('\n');
writeFileSync(outFile, report);

const headings = [...report.matchAll(/^#{2,3} (.+)$/gm)].map(
  (x) => '#' + anchorOf(x[1])
);
const links = [...report.matchAll(/\]\((#[^)]+)\)/g)].map((x) => x[1]);
const broken = links.filter((l) => !headings.includes(l));
console.log('written:', outFile, report.length, 'chars');
console.log(
  'models:',
  facts.models
    .map((model) => `${model} (${runsOf(model).length} runs)`)
    .join(', ')
);
console.log(
  'run sections:',
  facts.runs.length,
  '| links:',
  links.length,
  '| broken links:',
  broken.length,
  broken.slice(0, 5)
);
for (const model of facts.models) {
  const ev = runsOf(model).map(evalOf);
  const count = (v) => ev.filter((e) => e.verdict === v).length;
  console.log(
    `verdicts ${model}: pass ${count('pass')}, partial ${count('partial')}, fail ${count('fail')}, bugs ${ev.filter((e) => String(e.bug).startsWith('yes')).length}`
  );
}
