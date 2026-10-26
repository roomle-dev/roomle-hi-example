import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { benchmarkRun, toMarkdown } from '../benchmark-hi-mcp-runs.js';

test('uses current model-call timing, preserves unknown counters and excludes errors', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hi-benchmark-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const diagnostics = {
    version: 1,
    modelCalls: [
      {
        inputTokens: 100,
        outputTokens: 10,
        responseTimeMs: 40,
        timeToFirstOutputMs: 15,
      },
    ],
    requests: [{ bytes: 500 }],
    details: { cacheReadTokens: { tokens: 0, status: 'complete' } },
  };
  const data = {
    provider: 'sol',
    turns: [
      {
        usage: {
          status: 'complete',
          inputTokens: 100,
          outputTokens: 10,
          totalTokens: 110,
          diagnostics,
        },
      },
    ],
    durationsMs: { chat: 80 },
  };
  await writeFile(join(dir, 'run.json'), JSON.stringify(data));
  const run = benchmarkRun(dir);
  assert.equal(run.inputTokens, 100);
  assert.equal(run.modelMs, 40);
  assert.equal(run.toolsMs, null);
  assert.equal(run.reasoningTokens, null);
  assert.equal(run.diagnostics[0].details.cacheReadTokens.tokens, 0);
  assert.match(toMarkdown([run]), /fewer than 2/);
  assert.match(toMarkdown([run]), /0 \/ complete \| – \/ unavailable/);
  data.turns[0].errors = ['provider unavailable'];
  await writeFile(join(dir, 'run.json'), JSON.stringify(data));
  assert.match(toMarkdown([benchmarkRun(dir)]), /Left out of the per-test/);
});

test('old runs without measurements do not become zero-token runs', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hi-benchmark-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(
    join(dir, 'run.json'),
    JSON.stringify({ provider: 'old', turns: [{}] })
  );
  const run = benchmarkRun(dir);
  assert.equal(run.inputTokens, null);
  assert.equal(run.modelMs, null);
  assert.equal(run.toolsMs, null);
  assert.equal(run.otherMs, null);
  assert.match(toMarkdown([run]), /fewer than 2\) \| – \| – \| – \| –/);
  assert.match(toMarkdown([run]), /unavailable/);
});
