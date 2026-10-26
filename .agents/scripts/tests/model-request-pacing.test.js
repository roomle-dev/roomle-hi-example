import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { installModelRequestPacing } from '../model-request-pacing.js';

test('paces only model requests and records the wait without payloads', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      })
    );
    await installModelRequestPacing(page, 40);
    await page.goto('http://test.local/');
    const result = await page.evaluate(async () => {
      await fetch('/openai/v1/responses', {
        method: 'POST',
        body: 'private prompt',
      });
      await fetch('/other', { method: 'POST' });
      await fetch('/openai/v1/responses', { method: 'POST' });
      return window.hiModelRequestPacing;
    });
    assert.equal(result.length, 2);
    assert.ok(result[1].waitMs > 0);
    assert.deepEqual(Object.keys(result[1]), ['waitMs']);
    await assert.rejects(installModelRequestPacing(page, -1), /nonnegative/);
  } finally {
    await browser.close();
  }
});
