import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  collectFirstPlanChange,
  recordPlanChanges,
  summarizePlanningTime,
} from '../planning-time.js';

test('sums the turns and adds the earlier turns to a later first plan change', () => {
  assert.deepEqual(
    summarizePlanningTime([{ durationMs: 9000, firstPlanChangeMs: 4000 }]),
    { planningMs: 9000, firstResultMs: 4000, planChanged: true }
  );
  assert.deepEqual(
    summarizePlanningTime([
      { durationMs: 5000, firstPlanChangeMs: null },
      { durationMs: 8000, firstPlanChangeMs: 3000 },
      { durationMs: 2000, firstPlanChangeMs: 1000 },
    ]),
    { planningMs: 15000, firstResultMs: 8000, planChanged: true }
  );
});

test('tells a plan that did not change from turns that did not measure it', () => {
  assert.deepEqual(
    summarizePlanningTime([
      { durationMs: 5000, firstPlanChangeMs: null },
      { durationMs: 1000, firstPlanChangeMs: null },
    ]),
    { planningMs: 6000, firstResultMs: null, planChanged: false }
  );
  assert.deepEqual(summarizePlanningTime([{ durationMs: 5000 }]), {
    planningMs: 5000,
    firstResultMs: null,
    planChanged: null,
  });
  assert.deepEqual(summarizePlanningTime([]), {
    planningMs: null,
    firstResultMs: null,
    planChanged: null,
  });
  assert.equal(summarizePlanningTime([{}]).planningMs, null);
});

let browser;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});

// A page whose planner API keeps the history callbacks it was called with.
const plannerPage = async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto('about:blank');
  await page.evaluate(() => {
    window.historyCalls = [];
    window.instance = {
      extended: {
        callbacks: {
          onHistoryChange: (undo, redo) =>
            window.historyCalls.push([undo, redo]),
        },
      },
    };
  });
  return page;
};

const changePlan = (page) =>
  page.evaluate(() =>
    window.instance.extended.callbacks.onHistoryChange(true, false)
  );

test('measures the first plan change of a prompt and keeps the page handler', async (t) => {
  const page = await plannerPage(t);
  await recordPlanChanges(page);
  await changePlan(page);

  const startedAt = Date.now();
  const finish = await collectFirstPlanChange(page, startedAt);
  assert.equal(await finish(), null);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await changePlan(page);
  await changePlan(page);
  const firstPlanChangeMs = await finish();

  assert.ok(firstPlanChangeMs >= 50, `${firstPlanChangeMs} ms`);
  assert.ok(firstPlanChangeMs <= Date.now() - startedAt);
  assert.deepEqual(
    await page.evaluate(() => window.historyCalls),
    Array(3).fill([true, false])
  );
});
