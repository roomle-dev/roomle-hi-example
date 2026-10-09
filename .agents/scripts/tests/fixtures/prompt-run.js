import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cases = JSON.parse(readFileSync(process.env.TEST_PROMPT_CASES, 'utf8'));
const calls = existsSync(process.env.TEST_PROMPT_CALLS)
  ? JSON.parse(readFileSync(process.env.TEST_PROMPT_CALLS, 'utf8'))
  : [];
const scenario = cases[calls.length];
assert.ok(scenario, 'The suite launched more attempts than expected');
const dir = process.argv[process.argv.indexOf('--out') + 1];
calls.push(dir);
writeFileSync(process.env.TEST_PROMPT_CALLS, JSON.stringify(calls));
const marker = `attempt-${calls.length}`;
console.log(marker);
writeFileSync(join(dir, 'artifact.txt'), marker);
if (scenario.firstOnly) writeFileSync(join(dir, 'first-only.txt'), marker);
if (scenario.run) {
  writeFileSync(join(dir, 'run.json'), JSON.stringify(scenario.run));
  if (scenario.run.snapshotCaptured) {
    writeFileSync(join(dir, 'top-image.png'), marker);
  }
}
process.exitCode = scenario.exitCode ?? (scenario.run?.errors.length ? 1 : 0);
