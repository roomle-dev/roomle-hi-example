#!/usr/bin/env node
/**
 * Breaks the chat time of HI MCP test runs down per model step, from the chat
 * backend's step log in each run's console.log: per step the tokens in, out
 * and spent on reasoning, the tools the model called and how long they took,
 * the model's own time (the step without its tools), the tokens the step's
 * tool results added to the next step's input, and the planner calls the
 * tools made.
 *
 *   node .agents/scripts/benchmark-hi-mcp-runs.js <dir> [<dir> ...] [--test <id>]... [--out <dir>]
 *
 * A <dir> is a run directory of run-hi-mcp-prompt.js (it holds run.json and
 * console.log) or a directory above one, e.g. a "test the mcp" session;
 * --test keeps the runs of that test id and can be repeated. Prints the
 * benchmark as Markdown; with --out it writes benchmark.md and benchmark.json
 * there instead. A planner call is timed when planner-calls.json carries its
 * ms.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';

const USAGE =
  'usage: node .agents/scripts/benchmark-hi-mcp-runs.js <dir> [<dir> ...] [--test <id>]... [--out <dir>]';
const INFO_TOOLS = new Set([
  'get-plan-context',
  'find-attributes',
  'get-authoring-rules',
  'get-plan-images',
  'get-price',
  'get-order-data',
]);
const LINE = {
  turn: /^\[run-hi-mcp-prompt\] turn (\d+)\//,
  toolDone: /^\[hi-chat\] tool (done|failed): (\S+) \((\d+)ms\)/,
  step: /^\[hi-chat\] step \d+: (\d+) in, (\d+) out, (\d+) reasoning tokens; .*; (\S+); (\d+) ms$/,
  chatDone: /^\[hi-chat\] chat done \((\d+)ms\)/,
  serverTool: /^\[hi-mcp\] tool (\S+)$/,
  plannerCall: /^\[hi-mcp\] call (\d+): (\S+)/,
};

const parseOptions = () => {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        test: { type: 'string', multiple: true },
        out: { type: 'string' },
      },
    });
    if (positionals.length === 0) {
      throw new Error('a directory');
    }
    return { dirs: positionals.map((dir) => resolvePath(dir)), ...values };
  } catch {
    console.error(USAGE);
    process.exit(1);
  }
};

const readJson = (file) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;

const findRunDirs = (dir) => {
  if (existsSync(join(dir, 'run.json'))) {
    return [dir];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => findRunDirs(join(dir, entry.name)));
};

const emptyStep = () => ({ tools: [], plannerCalls: [] });

// The console.log lines of the chat, in order: tool done, server tool start,
// planner call, and the step line that closes a step.
const parseSteps = (log, plannerMs) => {
  const steps = [];
  let turn = 0;
  let chatting = false;
  let current = emptyStep();
  let serverTool;
  for (const line of log.split('\n')) {
    const turnStart = line.match(LINE.turn);
    if (turnStart) {
      turn = Number(turnStart[1]);
      chatting = true;
      current = emptyStep();
      continue;
    }
    if (!chatting) {
      continue;
    }
    const toolDone = line.match(LINE.toolDone);
    const serverToolStart = line.match(LINE.serverTool);
    const plannerCall = line.match(LINE.plannerCall);
    const step = line.match(LINE.step);
    if (toolDone) {
      current.tools.push({
        name: toolDone[2],
        ms: Number(toolDone[3]),
        ...(toolDone[1] === 'failed' && { failed: true }),
      });
    } else if (serverToolStart) {
      serverTool = serverToolStart[1];
    } else if (plannerCall) {
      const id = Number(plannerCall[1]);
      current.plannerCalls.push({
        id,
        method: plannerCall[2],
        tool: serverTool,
        ms: plannerMs.get(id) ?? null,
      });
    } else if (step) {
      const [inputTokens, outputTokens, reasoningTokens, , ms] = step
        .slice(1)
        .map(Number);
      // The tools of a step run side by side, so the longest one counts.
      const toolsMs = Math.max(0, ...current.tools.map((tool) => tool.ms));
      steps.push({
        turn,
        inputTokens,
        outputTokens,
        reasoningTokens,
        finish: step[4],
        ms,
        toolsMs,
        modelMs: ms - toolsMs,
        resultTokens: null,
        ...current,
      });
      current = emptyStep();
    } else if (LINE.chatDone.test(line)) {
      chatting = false;
    }
  }
  steps.forEach((step, index) => {
    const next = steps[index + 1];
    if (next?.turn === step.turn) {
      step.resultTokens =
        next.inputTokens - step.inputTokens - step.outputTokens;
    }
  });
  return steps;
};

const sum = (values) => values.reduce((total, value) => total + value, 0);

const benchmarkRun = (dir) => {
  const run = readJson(join(dir, 'run.json'));
  const plannerMs = new Map(
    (readJson(join(dir, 'planner-calls.json')) ?? [])
      .filter((call) => typeof call.ms === 'number')
      .map((call) => [call.id, call.ms])
  );
  const log = existsSync(join(dir, 'console.log'))
    ? readFileSync(join(dir, 'console.log'), 'utf8')
    : '';
  const steps = parseSteps(log, plannerMs);
  const toolCalls = run.turns.flatMap((turn) => turn.toolCalls ?? []);
  const tools = {};
  for (const tool of steps.flatMap((step) => step.tools)) {
    tools[tool.name] ??= { calls: 0, ms: 0 };
    tools[tool.name].calls += 1;
    tools[tool.name].ms += tool.ms;
  }
  const chatMs = run.durationsMs?.chat ?? null;
  return {
    dir,
    model: run.provider,
    test: basename(dir).replace(/^\d+-/, ''),
    turns: run.turns.length,
    chatMs,
    steps: steps.length,
    modelMs: sum(steps.map((step) => step.modelMs)),
    toolsMs: sum(steps.map((step) => step.toolsMs)),
    otherMs: chatMs === null ? null : chatMs - sum(steps.map((s) => s.ms)),
    inputTokens: sum(steps.map((step) => step.inputTokens)),
    outputTokens: sum(steps.map((step) => step.outputTokens)),
    reasoningTokens: sum(steps.map((step) => step.reasoningTokens)),
    planChanges: sum(
      Object.entries(tools)
        .filter(([name]) => !INFO_TOOLS.has(name))
        .map(([, tool]) => tool.calls)
    ),
    corrections: sum(toolCalls.map((call) => call.corrections?.length ?? 0)),
    notLoaded: sum(toolCalls.map((call) => call.notLoaded?.length ?? 0)),
    toolErrors: toolCalls.filter((call) => call.error).length,
    errors: run.errors?.length ?? 0,
    tools,
    stepLog: steps,
  };
};

const seconds = (ms) => (ms === null ? '–' : (ms / 1000).toFixed(1));
const thousands = (tokens) => `${(tokens / 1000).toFixed(1)}k`;
const mean = (values) => sum(values) / values.length;

const groupBy = (items, keyOf) => {
  const groups = new Map();
  for (const item of items) {
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }
  return groups;
};

const plannerSummary = (calls) => {
  const byMethod = new Map();
  for (const call of calls) {
    const entry = byMethod.get(call.method) ?? { count: 0, ms: 0, timed: 0 };
    entry.count += 1;
    if (call.ms !== null) {
      entry.ms += call.ms;
      entry.timed += 1;
    }
    byMethod.set(call.method, entry);
  }
  return [...byMethod]
    .map(
      ([method, { count, ms, timed }]) =>
        `${method} ×${count}${timed > 0 ? ` ${seconds(ms)} s` : ''}`
    )
    .join(', ');
};

const toMarkdown = (runs) => {
  const lines = ['# HI MCP benchmark', ''];
  lines.push(
    '| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |',
    '|---|---|---|---|---|---|---|---|'
  );
  const groups = groupBy(runs, (run) => `${run.model}\t${run.test}`);
  for (const group of groups.values()) {
    const chat = group.map((run) => run.chatMs ?? 0);
    lines.push(
      `| ${group[0].model} | ${group[0].test} | ${group.length} | ${seconds(mean(chat))} | ` +
        `${seconds(Math.min(...chat))} | ${seconds(Math.max(...chat))} | ` +
        `${mean(group.map((run) => run.steps)).toFixed(1)} | ` +
        `${thousands(mean(group.map((run) => run.inputTokens)))} |`
    );
  }
  lines.push(
    '',
    '## Runs',
    '',
    '| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'
  );
  runs.forEach((run, index) => {
    lines.push(
      `| ${index + 1} | ${run.model} | ${run.test} | ${seconds(run.chatMs)} | ${run.steps} | ` +
        `${seconds(run.modelMs)} | ${seconds(run.toolsMs)} | ${seconds(run.otherMs)} | ` +
        `${thousands(run.inputTokens)} | ${run.outputTokens} | ${run.reasoningTokens} | ` +
        `${run.planChanges} | ${run.corrections} | ${run.notLoaded} | ${run.errors + run.toolErrors} |`
    );
  });
  lines.push(
    '',
    '## Tools',
    '',
    '| Model | Tool | Calls | Calls per run | Total s | Mean ms |',
    '|---|---|---|---|---|---|'
  );
  for (const [model, modelRuns] of groupBy(runs, (run) => run.model)) {
    const totals = {};
    for (const [name, tool] of modelRuns.flatMap((run) =>
      Object.entries(run.tools)
    )) {
      totals[name] ??= { calls: 0, ms: 0 };
      totals[name].calls += tool.calls;
      totals[name].ms += tool.ms;
    }
    for (const [name, tool] of Object.entries(totals).sort(
      ([, a], [, b]) => b.ms - a.ms
    )) {
      lines.push(
        `| ${model} | ${name} | ${tool.calls} | ${(tool.calls / modelRuns.length).toFixed(1)} | ` +
          `${seconds(tool.ms)} | ${Math.round(tool.ms / tool.calls)} |`
      );
    }
  }
  runs.forEach((run, index) => {
    lines.push(
      '',
      `## ${index + 1} ${run.model} — ${run.test}`,
      '',
      `\`${run.dir}\``,
      '',
      '| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |',
      '|---|---|---|---|---|---|---|---|---|---|---|'
    );
    run.stepLog.forEach((step, stepIndex) => {
      const tools =
        step.tools
          .map((tool) => `${tool.name}${tool.failed ? ' (failed)' : ''}`)
          .join(', ') || `— (${step.finish})`;
      lines.push(
        `| ${stepIndex + 1} | ${step.turn} | ${tools} | ${seconds(step.ms)} | ${seconds(step.toolsMs)} | ` +
          `${seconds(step.modelMs)} | ${thousands(step.inputTokens)} | ${step.outputTokens} | ` +
          `${step.reasoningTokens} | ${step.resultTokens === null ? '–' : thousands(step.resultTokens)} | ` +
          `${plannerSummary(step.plannerCalls)} |`
      );
    });
  });
  return `${lines.join('\n')}\n`;
};

const main = async () => {
  const options = parseOptions();
  const runs = options.dirs
    .flatMap(findRunDirs)
    .map(benchmarkRun)
    .filter((run) => !options.test || options.test.includes(run.test));
  if (runs.length === 0) {
    console.error('[benchmark-hi-mcp-runs] no run with run.json found');
    process.exit(1);
  }
  for (const run of runs) {
    run.dir = relative(process.cwd(), run.dir);
  }
  const markdown = toMarkdown(runs);
  if (!options.out) {
    process.stdout.write(markdown);
    return;
  }
  await mkdir(options.out, { recursive: true });
  await writeFile(join(options.out, 'benchmark.md'), markdown);
  await writeFile(
    join(options.out, 'benchmark.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), runs }, null, 2)
  );
  console.log(
    `[benchmark-hi-mcp-runs] ${runs.length} runs: ${relative(process.cwd(), join(options.out, 'benchmark.md'))}`
  );
};

main().catch((error) => {
  console.error(`[benchmark-hi-mcp-runs] ${error.message}`);
  process.exitCode = 1;
});
