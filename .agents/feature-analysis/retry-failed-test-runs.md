# Retry a failed test run two or three times

> **Status:** Implemented locally — not landed
> **Date:** 2026-10-11
> **Evidence:** `.temp/result/mcp-test-2026-10-11_09-24-39/gpt-6-astra/31-image-planning-right-wall/`

## Affected repositories

- **roomle-hi-example** — the test runner `.agents/scripts/run-hi-mcp-tests.js` and the navigation
  predicate `.agents/scripts/mcp-test-navigation.js`; the testing skill
  `.agents/skills/hi-mcp-testing.md`. No MCP server, chat backend, page or launcher change.
- **roomle-ui**, **RoomleCore**, **ligna-store** — unchanged.

## What was asked and why

A run of the test suite can fail for a reason that has nothing to do with the planning: the
provider drops the connection mid-stream, the browser loses the page, the snapshot render times
out. Test 31 of the last session
([`image-planning-right-wall-connection-reset.md`](../bug-analysis/image-planning-right-wall-connection-reset.md))
is the example: the Azure `responses` endpoint returned HTTP 200 and then reset the socket after
63 s, the AI SDK surfaced `AI_APICallError: Failed to process successful response`, and the run
produced no planning. The failure is flaky infrastructure, not a defect.

The question: **can such a run simply be repeated — not forever, but a second or third attempt —
so a flaky failure does not cost the test its result?**

## How the runner works today

The orchestrator `.agents/scripts/run-hi-mcp-tests.js` runs every test of a test file for every
model, one `run-hi-mcp-prompt.js` child after another (the ports 3110/3200 are fixed, so the runs
are sequential). For each run it decides whether to run, skip or retry in `main()`
(`run-hi-mcp-tests.js:205-250`):

```js
let run = await readRun(dir);
const firstAttemptDir = `${dir}.attempt-1`;
let hasFirstAttempt = existsSync(firstAttemptDir);
if ((!run || isNavigationInterrupted(run)) && !stopped) {
  if (existsSync(dir) && !hasFirstAttempt) {
    await rename(dir, firstAttemptDir);
    hasFirstAttempt = true;
    run = undefined;
  }
  if (!existsSync(dir)) {
    for (let attempt = hasFirstAttempt ? 1 : 0; attempt < 2 && !stopped; attempt++) {
      await mkdir(dir, { recursive: true });
      exitCode = await runOnce(args, join(dir, 'console.log'));
      run = await readRun(dir);
      if ((run && !isNavigationInterrupted(run)) || attempt === 1 || stopped) break;
      await rename(dir, firstAttemptDir);
      hasFirstAttempt = true;
      run = undefined;
    }
  }
}
```

Three properties follow from this block:

1. **A retry happens only when `!run` or `isNavigationInterrupted(run)`.** A run that produced a
   `run.json` and is not navigation-interrupted is skipped on resume — that is the resume
   behaviour, and it is what makes a re-run of the same `--out` cheap.
2. **The cap is two attempts.** The loop runs `attempt` from `0` (or `1` when a first attempt was
   already preserved) while `attempt < 2`, so at most two child runs happen per test.
3. **The first attempt is preserved** by renaming its directory to `<NN>-<id>.attempt-1/` before
   the second attempt writes `<NN>-<id>/`. `results.runs[].attempts` lists both directories.

The predicate `isNavigationInterrupted(run)` lives in `.agents/scripts/mcp-test-navigation.js`:

```js
Boolean(
  run &&
    ((!run.planSnapshotId &&
      run.errors?.some((error) =>
        /Execution context was destroyed|because of a navigation|Frame was detached/i.test(error)
      )) ||
      (run.snapshotCaptured === false &&
        run.navigations?.some(
          ({ phase, fragmentOnly }) =>
            (phase === 'chat' || phase === 'snapshot') && !fragmentOnly
        )))
);
```

It matches exactly two situations: a run that lost its snapshot **and** whose errors name a
destroyed execution context / navigation / detached frame, or a run that captured no snapshot
**and** recorded a real (non-fragment) navigation during the chat or snapshot phase. Both are the
page navigating away under the runner — the failure the retry was built for.

## The gap

Test 31's failure does not match the predicate. Its `run.json` carries a `planSnapshotId`
(`ps_rj2124399ndn7q9g3bxyxoz09i5g21yr`) and its error is
`Failed to process successful response` — not the navigation regex, and `snapshotCaptured` is
true. So `isNavigationInterrupted` returns false, the run is treated as a completed result, and it
is **not** retried. The retry mechanism exists but its predicate is narrower than the class of
flaky failures the suite actually meets.

The failure classes a run can meet, and whether the current predicate covers them:

| Failure class | Example | `run.json` | Retried today |
|---|---|---|---|
| Page navigated away | lost snapshot, `Execution context was destroyed` | no snapshot id, navigation error | **yes** |
| Provider transport reset | test 31, `Failed to process successful response` ← `ECONNRESET` | snapshot id present, error present | no |
| Provider timeout / 5xx | `AI_APICallError` with a status | snapshot id present, error present | no |
| Snapshot render failed | `snapshot failed: …` | snapshot id may be present | no |
| No `run.json` at all | child crashed before writing | absent | **yes** |
| Real planning defect | wrong group, bad docking | snapshot id present, no error | no (correct) |

The last row is the one that must stay un-retried: a run that completed and produced a wrong plan
is a finding, not a flake, and repeating it only wastes time and risks masking the finding behind a
lucky second attempt.

## Proposed design

Broaden the retry predicate from "navigation-interrupted" to "navigation-interrupted **or a
transport failure**", and raise the cap from two attempts to three. Concretely:

1. **A new predicate `isTransportFailure(run)`** beside `isNavigationInterrupted` in
   `mcp-test-navigation.js`, matching the provider/transport error signatures in `run.errors`:
   `Failed to process successful response`, `ECONNRESET`, `terminated`, `AI_APICallError`,
   `fetch failed`, `socket hang up`, and a snapshot-phase `snapshot failed:` / `plan context
   failed:` that is not a navigation. The orchestrator retries when
   `isNavigationInterrupted(run) || isTransportFailure(run)`.
2. **A cap of three attempts.** The loop bound becomes `attempt < 3`; the preserved directories
   become `<NN>-<id>.attempt-1/` and `<NN>-<id>.attempt-2/`, and `results.runs[].attempts` lists
   all three. The existing "preserve the first attempt" rename generalises to "preserve each
   superseded attempt".
3. **A run that completed without errors is never retried**, whatever the predicate says — the
   predicate already requires an error or a missing snapshot, so this holds, but it should be
   stated in the code and the skill so a later change cannot break it.
4. **The retry stays inside the sequential loop.** No parallel attempts, no second child at once —
   the fixed ports forbid it and the "almost serial" property must be preserved.

The change is small and local: one predicate function, one loop bound, one rename that already
exists in a single-attempt form, and the `attempts` bookkeeping. The stored result shape does not
change, so `report.md`, the PDF and the benchmark stay comparable.

## Alternatives considered and rejected

- **Retry every failed run.** Rejected: a run that completed and produced a wrong plan is a
  finding. Retrying it wastes a full run and can hide the finding behind a lucky second attempt.
  The predicate must stay narrow enough to exclude a completed, error-free run.
- **Retry only the provider transport reset (test 31's exact signature).** Rejected as too narrow:
  the same class includes provider timeouts, 5xx and socket resets with other messages. A
  signature list is the right granularity, not one message.
- **Retry inside the chat backend instead of the runner.** Rejected: the backend cannot re-run the
  whole test (launcher, page, snapshot); it only sees one turn. The runner owns the run and the
  result directory, so the retry belongs there. The backend's own recovery
  ([`chat-provider-failure-recovery.md`](../bug-analysis/chat-provider-failure-recovery.md)) keeps
  the interrupted turn truthful; it does not repeat the run.
- **Unlimited retries until success.** Rejected by the user's own constraint ("should not be tried
  to repeat it for ever") and by the time cost below: a run is ~40 s of fixed cost plus the model
  chat, and the runs are sequential, so an unbounded retry can stall a session.
- **A retry that discards the failed attempt.** Rejected: the failed attempt's `console.log` and
  `run.json` are the evidence for the flaky-failure analysis (test 31's cause chain came from
  exactly that log). Every attempt must be preserved beside the selected result, as the current
  mechanism already does for the first attempt.

## Time cost and the risk of masking

Each retry is a **full sequential run**: the launcher boot, a fresh Chromium, the page, the MCP
server, the chat backend, the model chat and the snapshot — the same ~40 s fixed cost plus the
model time the backlog item
([`mcp-test-infrastructure-issues.md`](../backlog/mcp-test-infrastructure-issues.md) #2) measures.
A session of 44 runs that retries a handful of flaky runs three times adds a few minutes; a
session where many runs are flaky adds proportionally more, and the runs cannot overlap.

The risk is masking: a retry that succeeds hides the first failure. Two things keep that honest —
every attempt is preserved in its own directory and listed in `attempts`, and the report can name
the attempts so a reader sees that a result came from a retry. The predicate's narrowness is the
second guard: a completed, error-free run is never retried, so a real planning defect is never
retried away.

## Code and documents the work would touch

- `.agents/scripts/mcp-test-navigation.js` — add `isTransportFailure(run)` beside
  `isNavigationInterrupted(run)`.
- `.agents/scripts/run-hi-mcp-tests.js` — use the combined predicate in `main()`, raise the loop
  bound to three, generalise the attempt-preserving rename, keep `attempts` complete.
- `.agents/scripts/tests/suite-runner.test.js` — a case for a transport failure that is retried
  and preserved, and a case for a completed error-free run that is **not** retried.
- `.agents/skills/hi-mcp-testing.md` — the runner section: the retry now covers transport failures
  and runs up to three attempts.
- `.agents/backlog/mcp-test-infrastructure-issues.md` — a new item for the change, or a note on the
  existing #2, since both touch the runner's per-run behaviour.

## Recommendation

Feasible and small. Broaden the predicate to transport failures, raise the cap to three attempts,
preserve every attempt, and never retry a completed error-free run. The change is local to the
runner and the navigation module, keeps the runs sequential, and does not change the stored result
shape.

## Implementation

The runner implements a three-attempt limit for missing results, navigation interruptions and
the provider/transport signatures in `isTransportFailure`. Arbitrary snapshot/render errors do
not trigger a retry. Every superseded attempt is archived and listed in `results.json`; the third
attempt remains selected even on resume. Completed error-free runs are retained without retry.

The actual-runner tests cover recovery from a transport failure, three failed attempts, preserved
logs and results on resume, missing-result failures and successful runs. The living reference is
[deployment-and-testing.md](../../docs/implementation/deployment-and-testing.md).
