#!/usr/bin/env node
/**
 * Runs prompts through the HI example chat and stores the resulting plan:
 *
 *   node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" ...]
 *     [--plan <plan snapshot id>] [--image <file>] [--out <dir>] [--dev] [--headed]
 *
 * Starts the launcher (minimal-hi-example/start.mjs <provider> <api-key>) with
 * the MCP server on its own port, opens the example page in Playwright
 * Chromium (headless unless --headed; --dev is passed to the launcher) on
 * --plan, waits until get-plan-context lists articles and the HI library has
 * loaded the plan's groups, then sends the prompts to the chat backend as
 * consecutive turns of one conversation, each until the end of its stream. --image goes along with the last prompt, prepared as the chat
 * window prepares a dropped image. Then it reads
 * roomDesignerApi.extended.getExternalObjectSnapshot() without the object GLB,
 * saves the plan with saveExternalObjectSnapshot() for its plan snapshot id and
 * writes --out (default .temp/result/<UTC timestamp>-<provider>/): run.json
 * (with every call of a plan-changing MCP tool per turn:
 * what the model sent, and the corrections, groups not loaded or error it got
 * back), plan-context.json (rooms and groups after the chat),
 * planner-calls.json (the chat's, each with the page's time in ms), prompt-image.jpg (the image sent) and every
 * snapshot field as a file of its own. Exits 1 when the chat or the snapshot
 * reported an error or no snapshot or plan snapshot id came back;
 * a stopped run (Ctrl+C) stops every server and stores nothing.
 *
 * Requires Playwright: npm install in .agents/scripts.
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { constants } from 'node:os';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LAUNCHER = join(REPO_DIR, 'minimal-hi-example', 'start.mjs');
const RESULT_DIR = join(REPO_DIR, '.temp', 'result');
// Not the launcher's 3100: example tabs of an interactive session reconnect
// to 3100 and would take the bridge away from this run's page.
const MCP_PORT = process.env.HI_MCP_PORT ?? '3110';
const CHAT_PORT = process.env.HI_CHAT_PORT ?? '3200';
const MCP_URL = `http://127.0.0.1:${MCP_PORT}/mcp`;
const CHAT_URL = `http://127.0.0.1:${CHAT_PORT}`;
const LAUNCHER_READY_TIMEOUT_MS = 3 * 60_000;
const PAGE_READY_TIMEOUT_MS = 2 * 60_000;
const CHAT_TIMEOUT_MS = 10 * 60_000;
const SNAPSHOT_TIMEOUT_MS = 2 * 60_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 1000;
const TOOL_PREFIX = '[tool] ';
// The MCP server logs what a tool was sent and the feedback it gave as one
// JSON line each.
const TOOL_CALL_LINE = /^\[hi-mcp\] tool (\S+) (args|feedback|error) (.+)$/;
const ERROR_PREFIX = '[error] ';
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
// Only the fields stored: the object GLB is not even generated.
const SNAPSHOT_REQUEST = Object.fromEntries(
  [...SNAPSHOT_FILES.map(([field]) => field), 'orderData'].map((field) => [
    field,
    true,
  ])
);
const USAGE =
  'usage: node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" ...] [--plan <plan snapshot id>] [--image <file>] [--out <dir>] [--dev] [--headed]';

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

// The tool calls of the turn that is running, from the launcher's output. The
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

const startLauncher = ({ provider, apiKey, dev }) => {
  const launcher = spawn(
    process.execPath,
    [LAUNCHER, provider, apiKey, '--no-open', ...(dev ? ['--dev'] : [])],
    {
      cwd: REPO_DIR,
      detached: true,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, HI_MCP_PORT: MCP_PORT, HI_CHAT_PORT: CHAT_PORT },
    }
  );
  const exited = new Promise((resolve) => launcher.on('exit', resolve));
  let pendingLine = '';
  launcher.stdout.on('data', (chunk) => {
    const lines = (pendingLine + chunk).split('\n');
    pendingLine = lines.pop();
    lines.forEach(recordToolCall);
  });
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
// provider, busy port, failed typecheck) or the script was stopped.
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

const callMcpTool = async (name, args) => {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const { result, error } = await response.json();
  if (error) {
    throw new Error(error.message);
  }
  const text = result.content[0].text;
  if (result.isError) {
    throw new Error(text);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

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

const planContextHasArticles = async () => {
  const context = await callMcpTool('get-plan-context', {
    include: ['articles'],
  });
  return context?.articles?.length > 0;
};

const parseFrame = (payload) => {
  try {
    return JSON.parse(String(payload));
  } catch {
    return undefined;
  }
};

// The planner calls the MCP server relays to the page, read from the bridge's
// WebSocket frames: the server's own log cuts the arguments short.
const recordPlannerCalls = (page) => {
  const calls = [];
  const startedAt = new Map();
  let resolveClientId;
  const clientId = new Promise((resolve) => {
    resolveClientId = resolve;
  });
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const message = parseFrame(payload);
      if (message?.kind === 'call') {
        calls.push({
          id: message.id,
          method: message.method,
          args: message.args,
        });
        startedAt.set(message.id, Date.now());
      }
    });
    socket.on('framesent', ({ payload }) => {
      const message = parseFrame(payload);
      if (message?.kind === 'hello' && message.clientId) {
        resolveClientId(message.clientId);
      }
      const call =
        message?.kind === 'result' && calls.find(({ id }) => id === message.id);
      if (call) {
        call.ms = Date.now() - startedAt.get(call.id);
        call.ok = message.ok;
        if (!message.ok) {
          call.error = message.error;
        }
      }
    });
  });
  return { calls, clientId };
};

const splitChatStream = (text) => {
  const lines = text.split('\n');
  return {
    answer: lines
      .filter(
        (line) =>
          !line.startsWith(TOOL_PREFIX) && !line.startsWith(ERROR_PREFIX)
      )
      .join('\n')
      .trim(),
    tools: lines
      .filter((line) => line.startsWith(TOOL_PREFIX))
      .map((line) => line.slice(TOOL_PREFIX.length)),
    errors: lines
      .filter((line) => line.startsWith(ERROR_PREFIX))
      .map((line) => line.slice(ERROR_PREFIX.length)),
  };
};

// node:http, not fetch: fetch ends a response after 300 s without data, and
// a model may think that long before the chat streams its next line. What
// came before a failure is kept.
const postChat = (messages, clientId) =>
  new Promise((resolve) => {
    const body = JSON.stringify({ messages, clientId });
    const chunks = [];
    let status;
    const settle = (error) => {
      clearTimeout(timer);
      resolve({ status, text: Buffer.concat(chunks).toString('utf8'), error });
    };
    const chatRequest = request(
      `${CHAT_URL}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        status = response.statusCode;
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => settle());
        response.on('error', settle);
      }
    );
    const timer = setTimeout(
      () =>
        chatRequest.destroy(
          new Error(`aborted after ${CHAT_TIMEOUT_MS / 1000}s`)
        ),
      CHAT_TIMEOUT_MS
    );
    chatRequest.on('error', settle);
    chatRequest.end(body);
  });

const sendChat = async (messages, clientId) => {
  const { status, text, error } = await postChat(messages, clientId);
  if (status !== undefined && status >= 300) {
    return { answer: '', tools: [], errors: [`HTTP ${status}: ${text}`] };
  }
  const turn = splitChatStream(text);
  if (error) {
    turn.errors.push(`chat request failed: ${error.message}`);
  }
  return turn;
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
// history goes along with every turn. A turn with an error ends it. The image
// goes along with the last prompt.
const runConversation = async (prompts, image, clientId) => {
  const messages = [];
  const turns = [];
  for (const [index, prompt] of prompts.entries()) {
    const turnImage = index === prompts.length - 1 ? image : undefined;
    console.log(
      `[run-hi-mcp-prompt] turn ${index + 1}/${prompts.length}: ${prompt}${turnImage ? ` [image: ${turnImage.file}]` : ''}`
    );
    messages.push(
      turnImage
        ? { role: 'user', content: prompt, images: [turnImage.dataUrl] }
        : { role: 'user', content: prompt }
    );
    const startedAt = Date.now();
    toolCalls.turn = index;
    const turn = await sendChat(messages, clientId);
    turns.push({
      prompt,
      ...(turnImage && { image: turnImage.file }),
      ...turn,
      toolCalls: toolCalls.entries
        .filter((entry) => entry.turn === index)
        .map(({ turn: _turn, open: _open, ...entry }) => entry),
      durationMs: Date.now() - startedAt,
    });
    if (turn.errors.length > 0) {
      break;
    }
    messages.push({ role: 'assistant', content: turn.answer });
  }
  return turns;
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
  { run, planContext, plannerCalls, promptImage, snapshot }
) => {
  await mkdir(runDir, { recursive: true });
  const write = (file, content) => writeFile(join(runDir, file), content);
  await write('run.json', JSON.stringify(run, null, 2));
  await write('planner-calls.json', JSON.stringify(plannerCalls, null, 2));
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
  await pollUntil(
    async () => (await fetch(`${CHAT_URL}/health`)).ok,
    LAUNCHER_READY_TIMEOUT_MS,
    'the chat backend'
  );
  const pageUrl = options.plan
    ? `${exampleUrl}&plan_id=${encodeURIComponent(options.plan)}`
    : exampleUrl;
  const page = await browser.newPage();
  const { calls: plannerCalls, clientId: pageClientId } =
    recordPlannerCalls(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await pollUntil(
    planContextHasArticles,
    PAGE_READY_TIMEOUT_MS,
    'the page and the HI library'
  );
  const clientId = await withTimeout(
    pageClientId,
    PAGE_READY_TIMEOUT_MS,
    'the page client ID'
  );
  await waitForLoadedPlanGroups(page);
  plannerCalls.length = 0;
  const readyAt = Date.now();
  console.log('[run-hi-mcp-prompt] page ready');
  const promptImage =
    options.imageBytes && (await prepareImage(page, options.imageBytes));
  const turns = await runConversation(
    options.prompts,
    promptImage && { file: options.image, dataUrl: promptImage },
    clientId
  );
  toolCalls.turn = undefined;
  const chatPlannerCalls = plannerCalls.slice();
  const errors = turns.flatMap((turn) => turn.errors);
  const chatDoneAt = Date.now();
  console.log('[run-hi-mcp-prompt] chat done, reading and saving the snapshot');
  let planContext;
  try {
    planContext = await callMcpTool('get-plan-context', {
      include: ['rooms', 'groups', 'obstacles'],
    });
  } catch (error) {
    errors.push(`plan context failed: ${error.message}`);
  }
  let snapshot;
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
  let planSnapshotId = null;
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
  const run = {
    provider: options.provider,
    plan: options.plan ?? null,
    turns,
    errors,
    planSnapshotId,
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
