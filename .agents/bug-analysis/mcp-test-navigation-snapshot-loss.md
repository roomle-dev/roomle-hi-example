# Snapshot loss after a prompt test page navigates

> **Date**: 2026-10-09
> **Status**: Fixed locally — navigation diagnostics and bounded retry verified
> **Former backlog item**: MCP test infrastructure, item 3

## Affected repositories

- **roomle-hi-example** — navigation diagnostics, bounded retries and regression tests in `.agents/scripts/`, with testing documentation and backlog close-out.

## Scope constraint

The user restricted this issue to test infrastructure. The work changes the runner scripts, their
regression coverage and testing documentation. Productive code in the MCP server, chat backend,
example page, launcher, roomle-ui, ligna-store and RoomleCore remains untouched.

## Symptom and confirmed cause

The reported browser error was “Execution context was destroyed, most likely because of a navigation”
after the chat. Snapshot collection could fail even though the model had already changed the plan.
The prompt runner caught those collection errors and wrote `run.json` with the chat turns, errors
and planner calls, but without the snapshot.

The suite treated any parsed `run.json` as a completed run. It retried only when that file was absent,
and skipped an incomplete result on resume. Its attempts also reused the same output directory and
opened `console.log` with mode `w`, so extending the retry condition alone would discard evidence.
The prompt runner had no frame-navigation listener to identify what navigated.

The suite's actual `main` function was evaluated with simulated run results before implementation:
a navigation failure with `run.json` got one launch without a retry, resuming it got zero launches,
and a failure without `run.json` got two launches. Five of the seven new suite regression checks
failed before the fix; the navigation retry and incomplete-run resume reproduced the defect.

The cause of navigation in the original planner session was not identified. The 232 locally retained
`run.json` files examined during analysis had saved snapshot ids and no navigation error. Recovery
belongs in the test infrastructure; this work does not adapt productive code to the test.

## Implementation

- [mcp-test-navigation.js](../scripts/mcp-test-navigation.js) records every frame navigation with a
  timestamp, phase, URL, main-frame flag and `fragmentOnly` flag. It classifies interrupted capture
  from stored result data, including the reported error text in older results.
- [run-hi-mcp-prompt.js](../scripts/run-hi-mcp-prompt.js#L557) attaches recording before `goto`, marks
  loading/chat/snapshot/complete phases, writes `navigations` and `snapshotCaptured` in `run.json`,
  and emits navigation events to `console.log`.
- [run-hi-mcp-tests.js](../scripts/run-hi-mcp-tests.js#L207) retries missing `run.json` or a
  navigation-interrupted capture once. It moves the entire first directory to
  `<NN>-<test id>.attempt-1/`, then runs the original plan and prompts in a fresh browser at the
  normal output path. `results.json` selects that path in `dir` and lists both paths in `attempts`.
- The preserved first directory records that the retry was consumed. Resuming an incomplete first
  run, or a stop between archiving and retry, starts the second attempt. Once both directories
  exist, resuming keeps the second result without a third launch, even if it failed or has no
  `run.json`. Logs and artifacts from the first attempt are retained separately.

An interrupted capture is a missing saved snapshot id with a destroyed-context/navigation error,
or `snapshotCaptured: false` with non-fragment navigation during chat or snapshot collection.
A missing snapshot id alone, an ordinary API save failure, initial loading or a fragment-only
URL change does not trigger the latter condition. A complete capture is retained.

## Verification

```bash
node --test .agents/scripts/tests/*.test.js
npm run lint
npm run format
npm run format:check
```

Ten regression checks passed:

- Seven [suite tests](../scripts/tests/suite-runner.test.js) execute the actual CLI runner with
  local fake prompt processes: retry success, planner-frame navigation followed by a render
  timeout, two failures and resume, an existing incomplete first result, resume between archive
  and retry, missing `run.json`, preserved first-attempt logs/artifacts, and API save failure
  without navigation.
- Three [browser tests](../scripts/tests/navigation.test.js) use real headless Chromium with
  intercepted fixture pages. Main-page and planner-frame navigation destroy a pending evaluation
  context; the logger records the right frame and phase. Initial loading, fragment-only navigation
  and complete capture are checked separately.

The tests use no real model, Roomle service or external planner. Production behaviour was not changed.
The testing skill and implementation reference describe the result fields, attempt paths, resume
policy and test command. The solved item and its overview/index rows were removed from the backlog.
