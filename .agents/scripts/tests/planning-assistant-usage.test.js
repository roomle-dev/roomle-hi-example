import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  collectPromptUsage,
  summarizeUsage,
  unavailableUsage,
} from '../planning-assistant-usage.js';

const measured = {
  provider: 'azure',
  model: 'test-deployment',
  status: 'complete',
  inputTokens: 100,
  outputTokens: 20,
  totalTokens: 125,
};

test('sums prompt usage once and propagates incomplete coverage and known zero', () => {
  assert.deepEqual(summarizeUsage([measured, measured]), {
    status: 'complete',
    inputTokens: 200,
    outputTokens: 40,
    totalTokens: 250,
  });
  assert.deepEqual(summarizeUsage([measured, undefined]), {
    status: 'partial',
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 125,
  });
  assert.deepEqual(summarizeUsage([]), unavailableUsage());
  assert.deepEqual(
    summarizeUsage([undefined, unavailableUsage()]),
    unavailableUsage()
  );
  assert.deepEqual(
    summarizeUsage([
      { ...measured, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ]),
    { status: 'complete', inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
});

let browser;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});

const newPage = async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto('about:blank');
  return page;
};

test('collects each prompt through its callback completion, ignoring planner-frame logs', async (t) => {
  const page = await newPage(t);
  await page.setContent('<iframe srcdoc="<p>planner</p>"></iframe>');
  for (const inputTokens of [100, 200]) {
    const finish = collectPromptUsage(page);
    await page
      .frames()
      .find((frame) => frame !== page.mainFrame())
      .evaluate(
        (record) =>
          console.log('[planning-assistant] usage ' + JSON.stringify(record)),
        measured
      );
    const record = { ...measured, inputTokens, totalTokens: inputTokens + 25 };
    await page.evaluate(async (usage) => {
      await Promise.resolve();
      console.log('[planning-assistant] usage ' + JSON.stringify(usage));
    }, record);
    assert.deepEqual(await finish(), { usage: record, usageWarnings: [] });
  }
});

test('retains known usage from a failed or aborted prompt', async (t) => {
  const page = await newPage(t);
  for (const outcome of ['failed', 'aborted']) {
    const finish = collectPromptUsage(page);
    const partial = { ...measured, status: 'partial' };
    await assert.rejects(
      page.evaluate(
        ({ record, outcome }) => {
          console.log('[planning-assistant] usage ' + JSON.stringify(record));
          throw new Error(outcome);
        },
        { record: partial, outcome }
      ),
      new RegExp(outcome)
    );
    assert.deepEqual(await finish(), { usage: partial, usageWarnings: [] });
  }
});

test('preserves current diagnostics and keeps old records readable', async (t) => {
  const page = await newPage(t);
  const record = {
    ...measured,
    diagnostics: {
      version: 1,
      details: {
        cacheReadTokens: { tokens: 0, status: 'complete' },
        cacheWriteTokens: { tokens: null, status: 'unavailable' },
      },
      modelCalls: [{ responseTimeMs: 100 }],
      requests: [{ bytes: 500, sha256: 'hash' }],
    },
  };
  const finish = collectPromptUsage(page);
  await page.evaluate(
    (value) =>
      console.log('[planning-assistant] usage ' + JSON.stringify(value)),
    record
  );
  assert.deepEqual(await finish(), { usage: record, usageWarnings: [] });
});

test('diagnoses missing, malformed and duplicate records without inventing counts', async (t) => {
  const page = await newPage(t);
  for (const lines of [
    [],
    ['not json'],
    [JSON.stringify(measured), JSON.stringify(measured)],
    [JSON.stringify({ ...measured, totalTokens: -1 })],
  ]) {
    const finish = collectPromptUsage(page);
    await page.evaluate(
      (messages) =>
        messages.forEach((line) =>
          console.log('[planning-assistant] usage ' + line)
        ),
      lines
    );
    const result = await finish();
    assert.deepEqual(result.usage, unavailableUsage());
    assert.ok(result.usageWarnings.length > 0);
  }
});
