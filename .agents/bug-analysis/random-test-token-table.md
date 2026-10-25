# Token counts in the random-test table

- **Type:** Bug analysis
- **Status:** Fixed
- **Date:** 2026-10-25
- **Base:** `docs/mcp-test-gpt-6-astra-2026-10-25`

## Affected repositories

- **roomle-hi-example** — render measured usage in the random-test overview, test it, and document the report format.

## Symptom and reproduction

Before the fix, building a session report with measured random-test usage showed counts in the main summary and run sections, but the Random tests table showed only verdicts and retention recommendations. Session `mcp-test-2026-10-25_18-06-08` provided complete measured usage for all five random cases and reproduced the omission.

## Investigation and cause

- `.agents/scripts/extract-run-facts.js:133` derives selected-test totals from submitted turns for fixed and random cases alike.
- `.agents/scripts/build-test-report.js:191` formats counts and coverage through `usageCells`.
- `.agents/scripts/build-test-report.js:323` rendered separate single- and multi-model random-test tables without calling that formatter. Both layouts omitted all usage columns.
- The report template in `.agents/skills/hi-mcp-testing.md` also omitted those columns, so the missing display followed its specification. Measurement itself was present.

## Correction

The random-test table renders input, output and total tokens and coverage using the same selected-attempt usage as the main summary. Multiple models receive separate tables. Retention recommendations remain advisory; partial and unavailable measurements retain their coverage, and a missing run is marked not run.

Regression coverage exercises single- and multi-model random conversations with measured totals, legacy records without usage, and partial counts. The testing skill and implementation reference define the same format.

## Verification

- All 15 report-script tests pass, including measured multi-turn random totals for one and multiple models, unavailable/partial usage and a model with no random run.
- Formatting, lint, diff and documentation-link checks pass.
- The saved 79-case report rebuilds without model calls; all five random overview rows display their complete measured totals and all internal links resolve.
- The reporting invariant lives in `.agents/context/deployment-and-testing.md` and the testing skill. The fix remains on its purpose branch pending merge.
