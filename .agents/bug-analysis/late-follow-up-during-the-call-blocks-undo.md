# Bug Analysis: A follow-up reload that lands while its call still runs blocks the undo

> **Type**: Bug Analysis
> **Domain**: hi-mcp `tool-executors.ts` (`countingPlannerApi`, `recorded`), `plan-history.ts`
> **Trigger**: the live check of the row edit tools ([RML-18045](https://roomle.atlassian.net/browse/RML-18045), [plan](../feature-analysis/insert-remove-replace-swap-units-implementation-plan.md)) against the local roomle-ui dev server
> **Date**: 2026-10-05
> **Author**: AI Assistant
> **Status**: Fixed 2026-10-05 — see the [close-out](#close-out-2026-10-05)
> **Branch**: `feat/hi-row-edit-tools-RML-18045`

---

## Symptom

`undo` right after `insert-article-into-group` or `exchange-root-module` answers "The planner has
not finished the last change yet - its follow-up reload is still outstanding. Nothing was undone;
call undo again in a moment." It answers the same 8 s later, and on every further try, although the
follow-up reload arrived long before.

Measured in the page (headless, local planner, Three Tall Units plan), the times of the two history
events of a call after the call started:

| Call | First event | Follow-up | Undo |
|---|---|---|---|
| `insert-article-into-group` | 260 ms | 398 ms | reverts |
| the same insert again | 511 ms | 3596 ms | refused |
| `exchange-root-module` | 643 ms | 3696 ms | refused |

The call itself ended 3629 ms and 3742 ms after it started. The follow-up arrived **after** the
server's wait of 2 s gave up and **before** the call ended.

## Root cause

`countingPlannerApi` waits up to `FOLLOW_UP_WAIT_MS` (2 s) for the command's second history event.
When the wait times out, it marks the call unsettled and calls `planHistory.expectLateFollowUp()` at
once. `historyChanged()` takes an expected late follow-up only for an event that arrives while no
call runs (`!_inFlight`). An event that arrives after the timeout but while the call is still
running — it reads the plan for the hint, the placement frame and its record — is counted as the
call's own, but never matched to the expectation. So:

1. the record is written with `settled: false`, and `undo` waits for a follow-up that already came;
2. `_lateFollowUps` stays at 1, so the next real change in the planner is swallowed as the "late
   follow-up" instead of making the server forget its records.

The bug is in RML-18044's recording, not in the row edits; they made it visible because their
follow-up takes longer on the dev server. The cause of the slow follow-up there (about 3 s after the
first event in every slow case) is not known; the deployed planner answered within the result in 14
of 15 measured exchanges (RML-18044).

## Fix

Decide at the end of the call, synchronously, whether the follow-up has arrived: the counting API
keeps the event count the follow-up brings instead of expecting a late follow-up at once; `recorded`
reads the plan after the call, then — with no await between the check and `planHistory.end()`, so
no event can come in between — marks the call settled when that count is reached, and expects a late
follow-up only when it is not.

Regression test (`tool-executors.test.ts`, "undo and redo"): a follow-up that lands 100 ms after the
wait gave up, while the call still reads the plan, makes a settled record and leaves no late
follow-up expected; `undo` reverts the call.

## Close-out (2026-10-05)

Fixed as proposed in `countingPlannerApi` and `recorded` (`tool-executors.ts`); `plan-history.ts`
is unchanged. The regression test failed before the fix (`settled` false) and passes after it; all
434 unit tests pass.

Live, against the local planner, the same probe as above: every `undo` reverts its call now, also
when the follow-up lands about 3 s after the command.

| Call | First event | Follow-up | Call ends | Undo |
|---|---|---|---|---|
| `insert-article-into-group` | 679 ms | 3747 ms | 3874 ms | reverts |
| the same insert again | 515 ms | 3597 ms | 3636 ms | reverts |
| `exchange-root-module` | 624 ms | 3686 ms | 3719 ms | reverts |
| a third insert | 511 ms | 3591 ms | 3629 ms | reverts |

Still open: why the follow-up of the local planner lands about 3 s after the command — close to the
end of the call in every case. It does not affect the result any more; on the deployed planner it
landed within the result (RML-18044).
