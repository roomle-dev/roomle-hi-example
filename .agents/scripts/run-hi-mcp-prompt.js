#!/usr/bin/env node
/**
 * Runs prompts through the HI example chat and stores the resulting plan:
 *
 *   node .agents/scripts/run-hi-mcp-prompt.js <model> <api-key> "<prompt>" ["<prompt>" ...]
 *     [--plan <plan snapshot id>] [--image <file>] [--out <dir>] [--dev] [--headed]
 *
 * Starts the launcher (minimal-hi-example/start.mjs <model> <api-key>), opens
 * the example page in Playwright Chromium (headless unless --headed; --dev is
 * passed to the launcher) on --plan, waits until the library context lists
 * articles, the HI library has loaded the plan's groups and the planning
 * assistant of the page is available, then sends the prompts to the planning
 * assistant as consecutive turns of one conversation, each until the turn
 * ends - as the chat window sends them. --image goes along with the last
 * prompt, prepared as the chat window prepares a dropped image. Then it reads
 * roomDesignerApi.extended.getExternalObjectSnapshot() without the object GLB,
 * saves the plan with saveExternalObjectSnapshot() for its plan snapshot id and
 * writes --out (default .temp/result/<UTC timestamp>-<model>/): run.json
 * (with every call of a plan-changing MCP tool per turn: what the model sent,
 * and the corrections, groups not loaded or error it got back, read from the
 * [hi-mcp] lines the tools log in the console of the planner frame, and per
 * turn its duration and the time until the planner's history first changed),
 * plan-context.json (rooms and groups after the chat, in the agent's words),
 * planner-calls.json (the chat's tool calls the planner ran, each with the page's time in ms), prompt-image.jpg (the image sent),
 * turn-<n>-plan-images-<k>-perspective-object.jpg and -top.jpg, .png from a planner
 * that answers PNG (the images the k-th get-plan-images call of turn n showed
 * the agent, listed in the turn's
 * planImages) and every snapshot field as a file of its own; the snapshot
 * keeps the doors and drawers as the agent left them. Exits 1 when the chat or the snapshot
 * reported an error or no snapshot or plan snapshot id came back;
 * a stopped run (Ctrl+C) stops the launcher and stores nothing.
 *
 * Requires Playwright: npm install in .agents/scripts.
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { installModelRequestPacing } from './model-request-pacing.js';
import { recordNavigations } from './mcp-test-navigation.js';
import { planImageFiles } from './plan-images.js';
import { collectPromptUsage } from './planning-assistant-usage.js';
import { collectFirstPlanChange, recordPlanChanges } from './planning-time.js';

const REPO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LAUNCHER = join(REPO_DIR, 'minimal-hi-example', 'start.mjs');
const RESULT_DIR = join(REPO_DIR, '.temp', 'result');
const LAUNCHER_READY_TIMEOUT_MS = 3 * 60_000;
const PAGE_READY_TIMEOUT_MS = 2 * 60_000;
const CHAT_TIMEOUT_MS = 10 * 60_000;
const SNAPSHOT_TIMEOUT_MS = 2 * 60_000;
const SETTLE_TIMEOUT_MS = 3 * 60_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 1000;
// The HI MCP tools log what a tool was sent and the feedback it gave as one
// JSON line each, in the console of the planner frame, which the page console
// carries.
const TOOL_CALL_LINE = /^\[hi-mcp\] tool (\S+) (args|feedback|error) (.+)$/;
// The lines of the page console that go to the run's output while a turn
// runs: the tool calls, the planner calls of the tools and the errors of the
// planning assistant. The plan context read after the chat uses tools of its
// own, whose planner calls are not the chat's.
const PAGE_CONSOLE_LINE = /^\[(hi-mcp|planning-assistant)\] /;
// Headless Chromium falls back to SwiftShader (software GL) without this -
// and the planner's object-only perspective render (the HI objects of the
// snapshot) comes back empty under SwiftShader. --enable-gpu makes headless
// use the real GPU; a machine without one falls back to software as before.
const CHROMIUM_ARGS = ['--enable-gpu'];
// As the chat window sends a dropped image (prepareImage in
// minimal-hi-example/index.html).
const IMAGE_MAX_SIDE = 1568;
const IMAGE_QUALITY = 0.9;
const PROMPT_IMAGE_FILE = 'prompt-image.jpg';
const SNAPSHOT_FILES = [
  ['topImage', 'top-image.png', 'base64'],
  ['perspectiveImage', 'perspective-image.png', 'base64'],
  ['topObjectImage', 'top-object-image.png', 'base64'],
  ['perspectiveObjectImage', 'perspective-object-image.png', 'base64'],
  ['planXML', 'plan.xml', 'utf8'],
];
// Only the fields stored: the object GLB is not even generated. The doors and
// drawers stay as the agent left them, as get-plan-images shows them.
const SNAPSHOT_REQUEST = {
  ...Object.fromEntries(
    [...SNAPSHOT_FILES.map(([field]) => field), 'orderData'].map((field) => [
      field,
      true,
    ])
  ),
  keepOpenGeometry: true,
};
const USAGE =
  'usage: node .agents/scripts/run-hi-mcp-prompt.js <model> <api-key> "<prompt>" ["<prompt>" ...] [--plan <plan snapshot id>] [--image <file>] [--out <dir>] [--dev] [--headed]';

const parseOptions = () => {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        plan: { type: 'string' },
        image: { type: 'string' },
        out: { type: 'string' },
        dev: { type: 'boolean', default: false },
        headed: { type: 'boolean', default: false },
      },
    });
    const [provider, apiKey, ...prompts] = positionals;
    if (prompts.length === 0) {
      throw new Error('no prompt');
    }
    return { provider, apiKey, prompts, ...values };
  } catch {
    console.error(USAGE);
    process.exit(1);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = (promise, ms, description) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`timed out after ${ms / 1000}s waiting for ${description}`)
        ),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const pollUntil = async (check, ms, description) => {
  const poll = async () => {
    while (!(await check().catch(() => false))) {
      await sleep(POLL_INTERVAL_MS);
    }
  };
  await withTimeout(poll(), ms, description);
};

const loadChromium = async () => {
  try {
    return (await import('playwright')).chromium;
  } catch {
    throw new Error(
      'Playwright is missing - run npm install in .agents/scripts'
    );
  }
};

// The tool calls of the turn that is running, from the page console. The
// plan-changing tools run one after another in the order of their calls, and
// each call ends with one feedback or error line, so feedback belongs to the
// first open call of its tool - also when the agent calls a tool twice at
// once, which logs both argument lines before the first call runs.
const toolCalls = { turn: undefined, entries: [] };

const recordToolCall = (line) => {
  const match = line.match(TOOL_CALL_LINE);
  if (!match || toolCalls.turn === undefined) {
    return;
  }
  const [, tool, kind, json] = match;
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    payload = json;
  }
  if (kind === 'args') {
    toolCalls.entries.push({
      turn: toolCalls.turn,
      tool,
      args: payload,
      open: true,
    });
    return;
  }
  const feedback =
    kind === 'error' ? { error: payload?.message ?? payload } : payload;
  const call = toolCalls.entries.find(
    (entry) =>
      entry.turn === toolCalls.turn && entry.tool === tool && entry.open
  );
  if (call) {
    Object.assign(call, feedback, { open: false });
  } else {
    toolCalls.entries.push({
      turn: toolCalls.turn,
      tool,
      ...(kind === 'error' &&
        payload?.args !== undefined && { args: payload.args }),
      ...feedback,
      open: false,
    });
  }
};

const recordPageConsole = (page) =>
  page.on('console', (message) => {
    const text = message.text();
    if (toolCalls.turn !== undefined && PAGE_CONSOLE_LINE.test(text)) {
      console.log(text);
      recordToolCall(text);
    }
  });

const startLauncher = ({ provider, apiKey, dev }) => {
  const launcher = spawn(
    process.execPath,
    [LAUNCHER, provider, apiKey, '--no-open', ...(dev ? ['--dev'] : [])],
    {
      cwd: REPO_DIR,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const exited = new Promise((resolve) => launcher.on('exit', resolve));
  launcher.stderr.on('data', (chunk) => process.stderr.write(chunk));
  const exampleUrl = new Promise((resolve) => {
    let output = '';
    launcher.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (output === undefined) {
        return;
      }
      output += chunk;
      const match = output.match(/Example:\s+(\S+)\n/);
      if (match) {
        output = undefined;
        resolve(match[1]);
      }
    });
  });
  const isRunning = () => {
    try {
      process.kill(-launcher.pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const stop = async () => {
    if (!isRunning()) {
      return;
    }
    process.kill(-launcher.pid, 'SIGTERM');
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
    while (isRunning() && Date.now() < deadline) {
      await sleep(200);
    }
    if (isRunning()) {
      process.kill(-launcher.pid, 'SIGKILL');
    }
  };
  return { exampleUrl, exited, stop };
};

// Rejects when the run has to end early: the launcher exited (unknown
// model, busy port) or the script was stopped.
const aborted = (launcher) =>
  new Promise((_, reject) => {
    const abort = (message, exitCode) =>
      reject(Object.assign(new Error(message), { exitCode }));
    launcher.exited.then((code) =>
      abort(`the launcher exited with code ${code}`, code || 1)
    );
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () =>
        abort(`stopped by ${signal}`, 128 + constants.signals[signal])
      );
    }
  });

// The planner clears its undo history when the HI library has loaded the
// plan's groups (the example page sets hiPosGroupsCompletelyLoaded then).
// Changes of the chat made before would be gone from the history, and an undo
// turn would find nothing to revert.
const waitForLoadedPlanGroups = async (page) => {
  try {
    await page.waitForFunction(
      () => window.hiPosGroupsCompletelyLoaded === true,
      null,
      { timeout: PAGE_READY_TIMEOUT_MS }
    );
  } catch {
    console.log(
      '[run-hi-mcp-prompt] the HI library did not report the plan groups loaded - the chat starts anyway'
    );
  }
};

const libraryContextHasArticles = (page) =>
  page.evaluate(async () => {
    const context =
      await window.instance?.extended.getExternalObjectLibraryContext([
        'articles',
      ]);
    return context?.articles?.length > 0;
  });

// The planning assistant of the page is in place once it reports its
// availability to the chat window.
const waitForPlanningAssistant = async (page) => {
  await page.waitForFunction(
    () =>
      window.hiPlanningAssistantOutput?.some(
        (part) => part.type === 'availability'
      ),
    null,
    { timeout: PAGE_READY_TIMEOUT_MS }
  );
  const availability = await page.evaluate(() =>
    window.hiPlanningAssistantOutput.findLast(
      (part) => part.type === 'availability'
    )
  );
  if (!availability.available) {
    throw new Error(
      `the planning assistant is not available: ${availability.text}`
    );
  }
};

// A turn that failed or timed out may still run in the page: it is aborted,
// and the runner waits until the turn and the planner calls of its tools have
// ended. False when they do not end, so the plan may still change.
const settleTurn = async (page, turn) => {
  try {
    await withTimeout(
      (async () => {
        await page.evaluate(() => window.hiPlanningAssistantAbort());
        await turn.catch(() => {});
        await page.waitForFunction(
          () => window.hiPlannerCalls.every((call) => 'ok' in call),
          null,
          { timeout: SETTLE_TIMEOUT_MS }
        );
      })(),
      SETTLE_TIMEOUT_MS,
      'the aborted chat turn to end'
    );
    return true;
  } catch {
    return false;
  }
};

// A turn as the chat window sends it: the prompt and the image go to the
// planning assistant of the page, which answers in the output of the window.
const sendPrompt = async (page, text, image) => {
  const finishUsage = collectPromptUsage(page);
  const outputStart = await page.evaluate(
    () => window.hiPlanningAssistantOutput.length
  );
  const turn = page.evaluate(
    (prompt) =>
      window.instance.extended.callbacks.onPlanningAssistantPrompt(prompt),
    { text, images: image ? [image] : [] }
  );
  let failure;
  let settled = true;
  try {
    await withTimeout(turn, CHAT_TIMEOUT_MS, 'the chat turn');
  } catch (error) {
    failure = error;
    settled = await settleTurn(page, turn);
  }
  const { usage, usageWarnings } = await finishUsage();
  const parts = await page.evaluate(
    (start) => window.hiPlanningAssistantOutput.slice(start),
    outputStart
  );
  const texts = (type) =>
    parts.filter((part) => part.type === type).map((part) => part.text);
  return {
    usage,
    usageWarnings,
    answer: texts('text').join('').trim(),
    tools: texts('activity'),
    errors: [
      ...texts('error'),
      ...(failure ? [`chat turn failed: ${failure.message}`] : []),
    ],
    settled,
  };
};

// Redrawn in the page as JPEG on white with the EXIF rotation applied, the
// long side at most IMAGE_MAX_SIDE px.
const prepareImage = (page, bytes) =>
  page.evaluate(
    async ({ base64, maxSide, quality }) => {
      const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([data]), {
        imageOrientation: 'from-image',
      });
      const scale = Math.min(
        1,
        maxSide / Math.max(bitmap.width, bitmap.height)
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL('image/jpeg', quality);
    },
    {
      base64: bytes.toString('base64'),
      maxSide: IMAGE_MAX_SIDE,
      quality: IMAGE_QUALITY,
    }
  );

// The prompts are the turns of one conversation, as in the chat window: the
// planning assistant keeps the history. A turn with an error ends it. The
// image goes along with the last prompt. The planner calls of a turn are the
// ones the page recorded while it ran. settled is false when a failed turn did
// not end in the page.
const runConversation = async (page, prompts, image) => {
  const turns = [];
  const plannerCallTurns = [];
  let settled = true;
  for (const [index, prompt] of prompts.entries()) {
    const turnImage = index === prompts.length - 1 ? image : undefined;
    console.log(
      `[run-hi-mcp-prompt] turn ${index + 1}/${prompts.length}: ${prompt}${turnImage ? ` [image: ${turnImage.file}]` : ''}`
    );
    const startedAt = Date.now();
    const finishPlanChange = await collectFirstPlanChange(page, startedAt);
    const pacingStart = await page.evaluate(
      () => window.hiModelRequestPacing?.length ?? 0
    );
    toolCalls.turn = index;
    const plannerCallsBefore = await page.evaluate(
      () => window.hiPlannerCalls.length
    );
    const { settled: turnSettled, ...turn } = await sendPrompt(
      page,
      prompt,
      turnImage?.dataUrl
    );
    settled &&= turnSettled;
    const plannerCallsAfter = await page.evaluate(
      () => window.hiPlannerCalls.length
    );
    plannerCallTurns.push(
      ...Array(plannerCallsAfter - plannerCallsBefore).fill(index)
    );
    turns.push({
      prompt,
      ...(turnImage && { image: turnImage.file }),
      ...turn,
      toolCalls: toolCalls.entries
        .filter((entry) => entry.turn === index)
        .map(({ turn: _turn, open: _open, ...entry }) => entry),
      durationMs: Date.now() - startedAt,
      firstPlanChangeMs: await finishPlanChange(),
      requestPacing: await page.evaluate(
        (start) => (window.hiModelRequestPacing ?? []).slice(start),
        pacingStart
      ),
    });
    if (turn.errors.length > 0) {
      break;
    }
  }
  return { turns, plannerCallTurns, settled };
};

const evaluateInPage = (page, method, description, argument) =>
  withTimeout(
    page.evaluate(
      ([name, arg]) => window.instance.extended[name](arg),
      [method, argument]
    ),
    SNAPSHOT_TIMEOUT_MS,
    description
  );

const storeResult = async (
  runDir,
  { run, planContext, plannerCalls, planImages, promptImage, snapshot }
) => {
  await mkdir(runDir, { recursive: true });
  const write = (file, content) => writeFile(join(runDir, file), content);
  await write('run.json', JSON.stringify(run, null, 2));
  await write('planner-calls.json', JSON.stringify(plannerCalls, null, 2));
  for (const { file, data } of planImages) {
    await write(file, data);
  }
  if (promptImage) {
    await write(
      PROMPT_IMAGE_FILE,
      Buffer.from(promptImage.split(',')[1], 'base64')
    );
  }
  if (planContext !== undefined) {
    await write('plan-context.json', JSON.stringify(planContext, null, 2));
  }
  if (!snapshot) {
    return;
  }
  if (snapshot.orderData) {
    await write('order-data.json', JSON.stringify(snapshot.orderData, null, 2));
  }
  for (const [field, file, encoding] of SNAPSHOT_FILES) {
    if (typeof snapshot[field] === 'string') {
      await write(file, Buffer.from(snapshot[field], encoding));
    }
  }
};

const runSession = async (options, launcher, browser) => {
  const startedAt = new Date();
  const exampleUrl = await withTimeout(
    launcher.exampleUrl,
    LAUNCHER_READY_TIMEOUT_MS,
    'the launcher'
  );
  const pageUrl = options.plan
    ? `${exampleUrl}&id=${encodeURIComponent(options.plan)}`
    : exampleUrl;
  const page = await browser.newPage();
  const requestIntervalMs = Number(process.env.HI_MCP_REQUEST_INTERVAL_MS ?? 0);
  await installModelRequestPacing(page, requestIntervalMs);
  const embeddingModules = new Set();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.origin === 'http://localhost:3001' &&
      ['/src/hi.ts', '/src/roomle-embedding-lib.ts'].includes(url.pathname)
    ) {
      embeddingModules.add(url.origin + url.pathname);
    }
  });
  const navigation = recordNavigations(page);
  recordPageConsole(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await pollUntil(
    () => libraryContextHasArticles(page),
    PAGE_READY_TIMEOUT_MS,
    'the page and the HI library'
  );
  await waitForLoadedPlanGroups(page);
  await waitForPlanningAssistant(page);
  await recordPlanChanges(page);
  const readyAt = Date.now();
  console.log('[run-hi-mcp-prompt] page ready');
  const promptImage =
    options.imageBytes && (await prepareImage(page, options.imageBytes));
  navigation.setPhase('chat');
  const { turns, plannerCallTurns, settled } = await runConversation(
    page,
    options.prompts,
    promptImage && { file: options.image, dataUrl: promptImage }
  );
  toolCalls.turn = undefined;
  const recordedPlannerCalls = await page.evaluate(() => window.hiPlannerCalls);
  const chatPlannerCalls = recordedPlannerCalls.map(
    ({ result: _result, ...call }) => call
  );
  // the get-plan-images calls of a turn, with their results
  const planImageAnswers = recordedPlannerCalls.flatMap((call, index) =>
    call.tool === 'get-plan-images' &&
    call.ok &&
    plannerCallTurns[index] !== undefined
      ? [{ turn: plannerCallTurns[index], result: call.result }]
      : []
  );
  const planImages = planImageFiles(planImageAnswers);
  const errors = turns.flatMap((turn) => turn.errors);
  const chatDoneAt = Date.now();
  navigation.setPhase('snapshot');
  console.log('[run-hi-mcp-prompt] chat done, reading and saving the snapshot');
  let planContext;
  let snapshot;
  let planSnapshotId = null;
  // a turn that did not end may still change the plan: nothing is captured
  if (!settled) {
    errors.push(
      'the aborted chat turn did not end - the plan was not captured'
    );
  } else {
    try {
      planContext = await withTimeout(
        page.evaluate(
          (include) => window.hiAgentPlanContext(include),
          ['rooms', 'groups', 'obstacles']
        ),
        SNAPSHOT_TIMEOUT_MS,
        'the plan context'
      );
    } catch (error) {
      errors.push(`plan context failed: ${error.message}`);
    }
    try {
      snapshot = await evaluateInPage(
        page,
        'getExternalObjectSnapshot',
        'the snapshot',
        SNAPSHOT_REQUEST
      );
      if (!snapshot) {
        errors.push('getExternalObjectSnapshot returned no snapshot');
      }
    } catch (error) {
      errors.push(`snapshot failed: ${error.message}`);
    }
    try {
      const saved = await evaluateInPage(
        page,
        'saveExternalObjectSnapshot',
        'the saved snapshot'
      );
      planSnapshotId = saved?.planSnapshotId ?? null;
      if (!planSnapshotId) {
        errors.push('saveExternalObjectSnapshot returned no plan snapshot id');
      }
    } catch (error) {
      errors.push(`saving the snapshot failed: ${error.message}`);
    }
  }
  navigation.setPhase('complete');
  const run = {
    provider: options.provider,
    runtime: {
      requestIntervalMs,
      embeddingModules: [...embeddingModules],
      plannerOrigins: page
        .frames()
        .filter((frame) => frame !== page.mainFrame())
        .map((frame) => new URL(frame.url()).origin),
    },
    plan: options.plan ?? null,
    // after the snapshot, so a failure logged after its turn's response is in
    turns: turns.map((turn, index) => ({
      ...turn,
      planImages: planImages
        .filter((image) => image.turn === index)
        .map(({ file }) => file),
    })),
    errors,
    planSnapshotId,
    snapshotCaptured: !!snapshot,
    navigations: navigation.entries,
    exampleUrl: pageUrl,
    startedAt: startedAt.toISOString(),
    durationsMs: {
      ready: readyAt - startedAt.getTime(),
      chat: chatDoneAt - readyAt,
      snapshot: Date.now() - chatDoneAt,
    },
  };
  return {
    run,
    planContext,
    plannerCalls: chatPlannerCalls,
    planImages,
    promptImage,
    snapshot,
  };
};

const main = async () => {
  const options = parseOptions();
  options.imageBytes = options.image && (await readFile(options.image));
  const chromium = await loadChromium();
  // Playwright's own signal handlers exit before the servers are stopped.
  const browser = await chromium.launch({
    headless: !options.headed,
    args: CHROMIUM_ARGS,
    handleSIGINT: false,
    handleSIGTERM: false,
  });
  const launcher = startLauncher(options);
  try {
    const result = await Promise.race([
      runSession(options, launcher, browser),
      aborted(launcher),
    ]);
    const { run } = result;
    const runDir = options.out
      ? resolvePath(options.out)
      : join(
          RESULT_DIR,
          `${run.startedAt.slice(0, 19).replaceAll(':', '-')}-${run.provider}`
        );
    await storeResult(runDir, result);
    console.log('');
    for (const [index, turn] of run.turns.entries()) {
      console.log(`  Turn ${index + 1}:  ${turn.answer || '(no answer)'}`);
      console.log(`  Tools:   ${turn.tools.join(', ') || '(none)'}`);
      console.log(
        `  Tokens:  ${turn.usage.inputTokens ?? 'unavailable'} in, ${turn.usage.outputTokens ?? 'unavailable'} out, ${turn.usage.totalTokens ?? 'unavailable'} total (${turn.usage.status})`
      );
      for (const warning of turn.usageWarnings)
        console.log(`  Usage:   ${warning}`);
      for (const { tool, args: _args, ...feedback } of turn.toolCalls) {
        if (Object.keys(feedback).length > 0) {
          console.log(`  ${tool}:  ${JSON.stringify(feedback)}`);
        }
      }
    }
    if (run.errors.length > 0) {
      console.log(`  Errors:  ${run.errors.join(' | ')}`);
    }
    console.log(`  Plan snapshot:  ${run.planSnapshotId ?? '(none)'}`);
    console.log(`  Result:  ${relative(process.cwd(), runDir)}`);
    console.log('');
    process.exitCode = run.errors.length > 0 ? 1 : 0;
  } finally {
    await browser.close().catch(() => {});
    await launcher.stop();
  }
};

// An aborted session keeps waiting in the background; the run is over once
// the servers are stopped.
main()
  .catch((error) => {
    console.error(`[run-hi-mcp-prompt] ${error.message}`);
    process.exitCode = error.exitCode ?? 1;
  })
  .finally(() => process.exit());
