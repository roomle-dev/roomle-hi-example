import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  isNavigationInterrupted,
  recordNavigations,
} from '../mcp-test-navigation.js';

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
  await page.route('**/*', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body:
        new URL(route.request().url()).pathname === '/example'
          ? '<iframe src="/planner"></iframe>'
          : '<p>Fixture planner</p>',
    })
  );
  const navigation = recordNavigations(page);
  await page.goto('http://mcp-navigation.test/example');
  assert.ok(navigation.entries.some((entry) => entry.mainFrame));
  assert.ok(navigation.entries.some((entry) => !entry.mainFrame));
  assert.ok(navigation.entries.every((entry) => entry.phase === 'loading'));
  assert.equal(
    isNavigationInterrupted({
      errors: [],
      snapshotCaptured: false,
      navigations: navigation.entries,
    }),
    false
  );
  return { page, navigation };
};

test('records main-page navigation that destroys a pending capture context', async (t) => {
  const { page, navigation } = await newPage(t);
  navigation.setPhase('snapshot');
  const capture = page
    .evaluate(() => {
      window.captureStarted = true;
      return new Promise(() => {});
    })
    .then(
      () => null,
      (error) => error
    );
  await page.waitForFunction(() => window.captureStarted === true);
  await page.goto('http://mcp-navigation.test/next');
  const error = await capture;
  assert.match(error.message, /Execution context was destroyed/);
  assert.ok(
    navigation.entries.some(
      (entry) =>
        entry.mainFrame &&
        entry.phase === 'snapshot' &&
        entry.url.endsWith('/next')
    )
  );
  assert.equal(
    isNavigationInterrupted({
      planSnapshotId: null,
      errors: [error.message],
      snapshotCaptured: false,
      navigations: navigation.entries,
    }),
    true
  );
});

test('records planner-frame navigation while the example page stays loaded', async (t) => {
  const { page, navigation } = await newPage(t);
  navigation.setPhase('chat');
  const planner = page.frames().find((frame) => frame !== page.mainFrame());
  const capture = planner
    .evaluate(() => {
      window.captureStarted = true;
      return new Promise(() => {});
    })
    .then(
      () => null,
      (error) => error
    );
  await planner.waitForFunction(() => window.captureStarted === true);
  await planner.goto('http://mcp-navigation.test/planner-next');
  assert.match((await capture).message, /Execution context was destroyed/);
  assert.equal(page.url(), 'http://mcp-navigation.test/example');
  assert.ok(
    navigation.entries.some(
      (entry) =>
        !entry.mainFrame &&
        entry.phase === 'chat' &&
        entry.url.endsWith('/planner-next')
    )
  );
  assert.equal(
    isNavigationInterrupted({
      planSnapshotId: null,
      errors: ['snapshot failed: timed out waiting for the snapshot'],
      snapshotCaptured: false,
      navigations: navigation.entries,
    }),
    true
  );
});

test('keeps a complete capture and ignores a fragment change for retry purposes', async (t) => {
  const { page, navigation } = await newPage(t);
  navigation.setPhase('chat');
  await page.goto('http://mcp-navigation.test/example#view');
  const entry = navigation.entries.at(-1);
  assert.equal(entry.fragmentOnly, true);
  assert.equal(
    isNavigationInterrupted({
      errors: ['snapshot failed: unrelated failure'],
      snapshotCaptured: false,
      navigations: navigation.entries,
    }),
    false
  );
  await page.goto('http://mcp-navigation.test/next');
  assert.equal(
    isNavigationInterrupted({
      planSnapshotId: 'ps_fixture',
      errors: [],
      snapshotCaptured: true,
      navigations: navigation.entries,
    }),
    false
  );
});
