# Preserve the final failed MCP test attempt when resuming

> **Status:** Fixed locally — not landed
> **Date:** 2026-10-11
> **Branch:** `test/test-suite-improvements`

## Affected repositories

- **roomle-hi-example** — retain the third attempt in the selected run directory on resume; extend
  runner regression coverage and document the retry limit.

## Problem

After three retryable failures, resuming the session moved the third attempt to `.attempt-3/`
without launching another attempt. The selected directory disappeared, and `results.json` reported
`no run.json` instead of the saved transport or navigation failure. Its snapshot id and errors are
lost from the selected result even though the third attempt's files remained in the archive.

## Cause

The preservation branch in `.agents/scripts/run-hi-mcp-tests.js:233` unconditionally archived an
existing retryable result after discovering `.attempt-1/` and `.attempt-2/`, before checking the
attempt limit. The subsequent loop started at three and had no iterations. Tests verified that
resume launched no fourth child but did not verify that
the final selected directory, snapshot id, errors and attempt list remain intact.

## Fix

The runner archives an existing result only while fewer than two superseded attempts exist. If the normal
directory is absent after the second attempt was archived, the third attempt must still run.
It keeps the third attempt in the normal directory when the limit is exhausted, including when it
has no `run.json`; its console log remains the evidence for that failure.

## Verification

The added assertions for three transport failures and three missing-result failures failed before
the fix. After it, all 19 tests in `node --test .agents/scripts/tests/*.test.js` pass: resume keeps
the selected result and attempt list, leaves its console log in place, creates no `.attempt-3/`,
and launches no fourth child. Lint, formatting and the changed Markdown links also pass. The
retry invariant is documented in `docs/implementation/deployment-and-testing.md`.
