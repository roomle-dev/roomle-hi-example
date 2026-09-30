#!/usr/bin/env node
/**
 * Runs prompts through the HI example chat and stores the resulting plan:
 *
 *   node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" ...]
 *     [--out <dir>] [--dev] [--headed]
 *
 * Starts the launcher (minimal-hi-example/start.mjs <provider> <api-key>) with
 * the MCP server on its own port, opens the example page in Playwright
 * Chromium (headless unless --headed; --dev is passed to the launcher), waits
 * until get-plan-context lists articles, then sends the prompts to the chat
 * backend as consecutive turns of one conversation, each until the end of its
 * stream. Then it reads roomDesignerApi.extended.getExternalObjectSnapshot(),
 * saves the plan with saveExternalObjectSnapshot() for its plan snapshot id and
 * writes --out (default .temp/result/<UTC timestamp>-<provider>/): run.json,
 * plan-context.json (rooms and groups after the chat), planner-calls.json,
 * snapshot.json and every snapshot field as a file of its own. Exits 1 when the chat or the snapshot reported an error; a stopped run
 * (Ctrl+C) stops every server and stores nothing.
 *
 * Requires Playwright: npm install in .agents/scripts.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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
const ERROR_PREFIX = '[error] ';
const CHROMIUM_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];
const SNAPSHOT_FILES = [
  ['topImage', 'top-image.png', 'base64'],
  ['perspectiveImage', 'perspective-image.png', 'base64'],
  ['topObjectImage', 'top-object-image.png', 'base64'],
  ['perspectiveObjectImage', 'perspective-object-image.png', 'base64'],
  ['objectGlb', 'object.glb', 'base64'],
  ['planXML', 'plan.xml', 'utf8'],
];
const USAGE =
  'usage: node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" ["<prompt>" ...] [--out <dir>] [--dev] [--headed]';

const parseOptions = () => {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
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
      () => reject(new Error(`timed out after ${ms / 1000}s waiting for ${description}`)),
      ms,
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
    throw new Error('Playwright is missing - run npm install in .agents/scripts');
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
    },
  );
  const exited = new Promise((resolve) => launcher.on('exit', resolve));
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
      abort(`the launcher exited with code ${code}`, code || 1),
    );
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () =>
        abort(`stopped by ${signal}`, 128 + constants.signals[signal]),
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
  const { result } = await response.json();
  if (result.isError) {
    throw new Error(result.content[0].text);
  }
  return JSON.parse(result.content[0].text);
};

const planContextHasArticles = async () => {
  const context = await callMcpTool('get-plan-context', { include: ['articles'] });
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
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const message = parseFrame(payload);
      if (message?.kind === 'call') {
        calls.push({ id: message.id, method: message.method, args: message.args });
      }
    });
    socket.on('framesent', ({ payload }) => {
      const message = parseFrame(payload);
      const call =
        message?.kind === 'result' && calls.find(({ id }) => id === message.id);
      if (call) {
        call.ok = message.ok;
        if (!message.ok) {
          call.error = message.error;
        }
      }
    });
  });
  return calls;
};

const splitChatStream = (text) => {
  const lines = text.split('\n');
  return {
    answer: lines
      .filter((line) => !line.startsWith(TOOL_PREFIX) && !line.startsWith(ERROR_PREFIX))
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

const sendChat = async (messages) => {
  try {
    const response = await fetch(`${CHAT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) {
      return { answer: '', tools: [], errors: [`HTTP ${response.status}: ${text}`] };
    }
    return splitChatStream(text);
  } catch (error) {
    return { answer: '', tools: [], errors: [`chat request failed: ${error.message}`] };
  }
};

// The prompts are the turns of one conversation, as in the chat window: the
// history goes along with every turn. A turn with an error ends it.
const runConversation = async (prompts) => {
  const messages = [];
  const turns = [];
  for (const [index, prompt] of prompts.entries()) {
    console.log(`[run-hi-mcp-prompt] turn ${index + 1}/${prompts.length}: ${prompt}`);
    messages.push({ role: 'user', content: prompt });
    const startedAt = Date.now();
    const turn = await sendChat(messages);
    turns.push({ prompt, ...turn, durationMs: Date.now() - startedAt });
    if (turn.errors.length > 0) {
      break;
    }
    messages.push({ role: 'assistant', content: turn.answer });
  }
  return turns;
};

const evaluateInPage = (page, method, description) =>
  withTimeout(
    page.evaluate((name) => window.instance.extended[name](), method),
    SNAPSHOT_TIMEOUT_MS,
    description,
  );

const storeResult = async (runDir, { run, planContext, plannerCalls, snapshot }) => {
  await mkdir(runDir, { recursive: true });
  const write = (file, content) => writeFile(join(runDir, file), content);
  await write('run.json', JSON.stringify(run, null, 2));
  await write('planner-calls.json', JSON.stringify(plannerCalls, null, 2));
  if (planContext !== undefined) {
    await write('plan-context.json', JSON.stringify(planContext, null, 2));
  }
  if (snapshot === undefined) {
    return;
  }
  await write('snapshot.json', JSON.stringify(snapshot, null, 2));
  if (snapshot?.orderData) {
    await write('order-data.json', JSON.stringify(snapshot.orderData, null, 2));
  }
  for (const [field, file, encoding] of SNAPSHOT_FILES) {
    if (typeof snapshot?.[field] === 'string') {
      await write(file, Buffer.from(snapshot[field], encoding));
    }
  }
};

const runSession = async (options, launcher, browser) => {
  const startedAt = new Date();
  const exampleUrl = await withTimeout(
    launcher.exampleUrl,
    LAUNCHER_READY_TIMEOUT_MS,
    'the launcher',
  );
  await pollUntil(
    async () => (await fetch(`${CHAT_URL}/health`)).ok,
    LAUNCHER_READY_TIMEOUT_MS,
    'the chat backend',
  );
  const page = await browser.newPage();
  const plannerCalls = recordPlannerCalls(page);
  await page.goto(exampleUrl, { waitUntil: 'domcontentloaded' });
  await pollUntil(
    planContextHasArticles,
    PAGE_READY_TIMEOUT_MS,
    'the page and the HI library',
  );
  plannerCalls.length = 0;
  const readyAt = Date.now();
  console.log('[run-hi-mcp-prompt] page ready');
  const turns = await runConversation(options.prompts);
  const chatPlannerCalls = plannerCalls.slice();
  const errors = turns.flatMap((turn) => turn.errors);
  const chatDoneAt = Date.now();
  console.log('[run-hi-mcp-prompt] chat done, reading and saving the snapshot');
  let planContext;
  try {
    planContext = await callMcpTool('get-plan-context', { include: ['rooms', 'groups'] });
  } catch (error) {
    errors.push(`plan context failed: ${error.message}`);
  }
  let snapshot;
  try {
    snapshot = await evaluateInPage(page, 'getExternalObjectSnapshot', 'the snapshot');
  } catch (error) {
    errors.push(`snapshot failed: ${error.message}`);
  }
  let planSnapshotId = null;
  try {
    const saved = await evaluateInPage(
      page,
      'saveExternalObjectSnapshot',
      'the saved snapshot',
    );
    planSnapshotId = saved?.planSnapshotId ?? null;
  } catch (error) {
    errors.push(`saving the snapshot failed: ${error.message}`);
  }
  const run = {
    provider: options.provider,
    turns,
    errors,
    planSnapshotId,
    exampleUrl,
    startedAt: startedAt.toISOString(),
    durationsMs: {
      ready: readyAt - startedAt.getTime(),
      chat: chatDoneAt - readyAt,
      snapshot: Date.now() - chatDoneAt,
    },
  };
  return { run, planContext, plannerCalls: chatPlannerCalls, snapshot };
};

const main = async () => {
  const options = parseOptions();
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
          `${run.startedAt.slice(0, 19).replaceAll(':', '-')}-${run.provider}`,
        );
    await storeResult(runDir, result);
    console.log('');
    for (const [index, turn] of run.turns.entries()) {
      console.log(`  Turn ${index + 1}:  ${turn.answer || '(no answer)'}`);
      console.log(`  Tools:   ${turn.tools.join(', ') || '(none)'}`);
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
