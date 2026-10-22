import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cases = JSON.parse(process.env.PLANNING_RESULTS_CASES);
const suite = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[process.argv.indexOf('--out') + 1];
const { provider } = suite.models[0];
const tests = suite.categories.flatMap((category) => category.tests);
const runs = tests.map((test, index) => {
  const { planSnapshotId = null, errors = [], files = [] } = cases[test.id];
  const dir = join(
    provider,
    `${String(index + 1).padStart(2, '0')}-${test.id}`
  );
  mkdirSync(join(out, dir), { recursive: true });
  for (const file of files) {
    writeFileSync(join(out, dir, file), `${test.id} ${file}`);
  }
  return { model: provider, test: test.id, dir, planSnapshotId, errors };
});
writeFileSync(
  join(out, 'results.json'),
  JSON.stringify({ startedAt: '2026-10-13T08:00:00.000Z', runs })
);
