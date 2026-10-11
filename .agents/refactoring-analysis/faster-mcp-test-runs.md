# Refactoring Analysis: Faster MCP test runs

> **Type**: Refactoring Analysis
> **Domain**: roomle-hi-example — the test runner `.agents/scripts/run-hi-mcp-tests.js` and its child `.agents/scripts/run-hi-mcp-prompt.js`; the launcher `minimal-hi-example/start.mjs` (read only)
> **Trigger**: "the mcp test take very long to run / I know this is partially caused by the fact that the process of planning a kitchen in the mcp takes its time - however this is out of scope now, improving the performance of the mcp is a separate task / but is there anything in the test script `.agents/scripts/run-hi-mcp-tests.js`, that could be improved to make the tests run faster? / the tests run almost stale, this should not be put in danger / analyse if there is something that can be improved"
> **Date**: 2026-10-11
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `test/test-suite-improvements` (from `master`)

## Repositories

- **roomle-hi-example** — the test runner and its child change; the launcher gains a flag to skip its build gate. No other repository changes.
- **roomle-ui**, **RoomleCore**, **ligna-store**, **roomle-model-exporter** — unchanged. The MCP planning time itself is explicitly out of scope.

## Verdict

The runs are slow for two reasons, and only one of them is the model:

- **The model and the planner** — the chat phase, ~28 s per run on average, ~20.5 min of the 32.5 min
  of a 44-run session. **Out of scope** (the user's own words).
- **The per-run cold start** — every run launches a fresh launcher (which typechecks the whole
  `hi-mcp` workspace) and a fresh Playwright Chromium, then tears both down. This is the fixed
  overhead the request asks about, and it is **reducible without touching the sequential nature of
  the runs**.

Measured on the last session (`.temp/result/mcp-test-2026-10-11_09-24-39`, 44 runs, `gpt-6-astra`):

| Phase | Sum | Average per run | Share |
|---|---|---|---|
| `ready` (launcher boot + page load + plan groups) | 473 s | 10.8 s | 24 % |
| `chat` (model + planner) | 20.5 min | 27.9 s | 63 % |
| `snapshot` (read + save the plan) | 251 s | 5.7 s | 13 % |
| **total** | **32.5 min** | **45.0 s** | 100 % |

The `ready` phase is the target. It is pure fixed cost — it does not depend on the prompt — and it
is paid 44 times. The three changes below cut it, keep the runs strictly sequential, and change no
test result.

## 1. What the runner does today

### The orchestrator

`.agents/scripts/run-hi-mcp-tests.js` runs every test of a test file for every model, one run of
`run-hi-mcp-prompt.js` after another:

- [`run-hi-mcp-tests.js:main`](../../.agents/scripts/run-hi-mcp-tests.js) — nested loops
  `for model` / `for [index, test]`, each iteration a `runOnce(args, logFile)` that spawns
  `process.execPath [RUN_SCRIPT, ...args]` and waits for it to exit.
- The child is spawned with `stdio: ['ignore', log, log]`, so the orchestrator never reads the
  child's output; it only waits.

### The child, per run

`.agents/scripts/run-hi-mcp-prompt.js` does the whole lifecycle for one run:

- [`run-hi-mcp-prompt.js:656-664`](../../.agents/scripts/run-hi-mcp-prompt.js#L656-L664) —
  `loadChromium()` then `chromium.launch(...)`, **a fresh browser per run**.
- [`run-hi-mcp-prompt.js:191-199`](../../.agents/scripts/run-hi-mcp-prompt.js#L191-L199) —
  `startLauncher(...)` spawns `minimal-hi-example/start.mjs`, **a fresh launcher per run**, with
  `HI_MCP_PORT=3110` and `HI_CHAT_PORT=3200`.
- [`run-hi-mcp-prompt.js:43-46`](../../.agents/scripts/run-hi-mcp-prompt.js#L43-L46) — the fixed
  ports are why the runs are sequential: two children cannot share 3110/3200.
- [`run-hi-mcp-prompt.js:main`](../../.agents/scripts/run-hi-mcp-prompt.js) — `finally` closes the
  browser and stops the launcher, so nothing survives into the next run.

### The launcher's build gate

`minimal-hi-example/start.mjs` runs a build gate on **every** start:

- [`start.mjs:buildHiMcp`](../../minimal-hi-example/start.mjs#L137-L143) — installs the workspace
  only on the first run, but **typechecks it every time**:
  `runNpm(['run', 'typecheck'])`.
- [`hi-mcp/package.json`](../../hi-mcp/package.json) — `typecheck` is three sequential `tsc --noEmit`
  invocations (`hi-mcp-server`, `hi-mcp-client`, `hi-mcp-chat`).

So every one of the 44 runs pays: `npm run typecheck` (three `tsc` processes) → start the static
server → start the MCP server (`vite-node server.ts`) → start the chat server
(`vite-node chat-server.ts`) → Playwright launches Chromium → the page loads → the plan's groups
load. Only then does the chat phase begin.

## 2. Where the `ready` time goes

The `ready` phase is `readyAt - startedAt` in
[`run-hi-mcp-prompt.js:runSession`](../../.agents/scripts/run-hi-mcp-prompt.js#L560-L575), i.e. from
the child's start to the moment the page reports the plan's groups loaded. It contains, in order:

1. **`npm run typecheck`** — three `tsc` processes over the whole `hi-mcp` workspace. This is the
   single largest fixed cost and it is **identical on every run** — the source does not change
   between runs of one session.
2. **Launcher boot** — static server, MCP server and chat server, each a `vite-node` process that
   has to compile and load its TypeScript entrypoint.
3. **Playwright Chromium launch** — a fresh browser process per run.
4. **Page load and plan-group load** — the example page, the HI library, the plan snapshot.

The slowest `ready` values in the session (27.7 s, 26.3 s, 16.3 s, 14.5 s) are the first runs of the
session, where the OS file cache is cold; the later runs settle around 8-11 s. Both the typecheck and
the browser launch are in that number every time.

## 3. Proposed changes

Three changes, in order of payoff. Each is independent; each keeps the runs sequential and changes
no test result.

### A. Skip the launcher's typecheck during test runs

The typecheck is a developer convenience for `npm start`; it is pointless inside a test session
where the same workspace is typechecked 44 times unchanged. Add a flag to the launcher that skips
`buildHiMcp`'s typecheck, and pass it from the child.

- `minimal-hi-example/start.mjs` — `buildHiMcp()` skips `runNpm(['run', 'typecheck'])` when a
  `--no-typecheck` argument is present (the install-on-first-run stays).
- `run-hi-mcp-prompt.js:startLauncher` — add `--no-typecheck` to the launcher arguments.

Expected saving: the three `tsc` processes, roughly 3-6 s per run (to be measured). This is the
change with the best ratio of saving to risk: it removes work that is provably redundant within a
session and touches nothing the tests observe.

### B. Reuse one Chromium across the runs

`chromium.launch()` per run pays the browser start-up 44 times. Playwright can launch once and open
a fresh **context** per run (`browser.newContext()`), which is the isolation boundary that matters
(cookies, storage, cache) — a new context is as clean as a new browser for this page.

- `run-hi-mcp-prompt.js:main` — launch the browser once; per run open a context, use it, close it.
- The orchestrator would have to keep the browser alive across children, which it cannot (each run
  is a separate process). Two options:
  - **B1 (small):** keep the per-run child, but let the child reuse a browser the orchestrator
    started and passed in via a CDP endpoint (`chromium.launchServer` in the orchestrator,
    `chromium.connect` in the child). The orchestrator owns the browser for the whole session.
  - **B2 (larger):** fold the per-run child into the orchestrator so one process runs the whole
    session and holds one browser. This is the bigger refactor and is **not** proposed here — it
    changes the process model the retry/resume logic depends on.

Expected saving: the Chromium start-up per run, roughly 1-3 s. B1 is the smaller, safer form.

### C. Reuse one launcher across the runs

The launcher (static server + MCP server + chat server) is torn down and rebuilt per run. The MCP
server and the chat server are stateless between runs — the plan is loaded fresh from the snapshot
each time — so one launcher could serve the whole session.

This is the largest change and the one with the most risk, because the child currently owns the
launcher's lifetime and the `aborted()` path depends on the launcher exiting to end a run early.
It is listed for completeness; **A and B are the recommended scope**, and C should only be taken up
if A and B leave the runs still too slow.

## 4. What must not change

- **The runs stay sequential.** The fixed ports (3110/3200) and the one-child-at-a-time model are
  what make a run reproducible; parallelising would let two runs share a planner and corrupt both.
  The user's "the tests run almost stale, this should not be put in danger" is exactly this.
- **The retry/resume logic.** A missing `run.json` or a navigation-interrupted capture still gets
  one retry, the first attempt is still kept in `<NN>-<id>.attempt-1/`, and an exhausted retry is
  still skipped on resume.
- **The stored result.** `run.json`, `plan-context.json`, `planner-calls.json`, the snapshot files
  and the plan snapshot id are unchanged, so `report.md` and the benchmark stay comparable.
- **The chat phase.** The model and the planner are untouched; the saving is entirely in the fixed
  overhead around them.

## 5. Tests covering the affected behaviour

- `.agents/scripts/tests/*.test.js` (Node's built-in `node --test`, run with
  `node --test .agents/scripts/tests/*.test.js`) — the runner's option parsing, validation and
  result handling. Any change to `run-hi-mcp-tests.js` or `run-hi-mcp-prompt.js` must keep these
  green.
- The end-to-end check is a real session: run a small subset (a few tests, one model) before and
  after and compare the `ready` phase in each `run.json` and the total wall time.

## 6. Benchmark to run before and after

The `ready` phase is already recorded per run in `run.json` (`durationsMs.ready`), so the before/after
comparison needs no new instrumentation:

- **Before** — the last session's `ready` sum and average (473 s / 10.8 s over 44 runs).
- **After** — the same numbers from a session of the same size and model.

The `hi-mcp-benchmarking` skill's `benchmark-hi-mcp-runs.js` reads these fields and can produce the
comparison; the durable numbers go to `.agents/benchmarks/` at close-out.

## 7. Open questions

- How much of the `ready` phase is the typecheck versus the launcher boot versus Chromium? A single
  instrumented run (log a timestamp after `buildHiMcp`, after the launcher prints its URL, after
  `chromium.launch`) answers it and sizes A and B precisely. Recommended before implementing.
- Does the example page tolerate a reused browser context as well as a fresh browser? B1 assumes it
  does; a quick check with two runs on one context confirms it.
