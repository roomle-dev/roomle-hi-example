# PR review: random test counts and prompt expectations

> **Status:** Fixed locally — PR review fixes
> **Date:** 2026-10-11
> **PR:** roomle-hi-example #98

## Affected repositories

- **roomle-hi-example** — validate random-case counts, clarify the multi-group expectation and
  align the retry analyses with their implemented scope.

## Verified findings

- The skill sampled plans without repetition, but `names.slice(0, randomTests)` silently returned
  fewer names when the count exceeded the plan count. `problemsOf` in
  `.agents/scripts/run-hi-mcp-tests.js:81` accepted any non-negative integer, and the composition
  filter reported only a generated-count mismatch.
- `living-room-sideboard-and-tv` required two create calls although `create-or-replace-groups`
  accepts multiple independent groups in one call. A call-count requirement rejects a correct
  outcome. Requiring exactly one call would also exclude a valid separate-call implementation.
- The retry feature analysis proposed arbitrary snapshot/context error retries, but the
  implemented predicate matched only the documented provider/transport signatures, alongside
  the separate navigation predicate.
- The performance analysis described a one-retry invariant although the runner permitted
  three attempts and preserved the final selected result on resume.

## Resolution

Keep distinct sampled plans. Define the count as a whole number from zero to the number of
available plans, with the existing default of five for full-session preparation. Validate it
before sampling, during composition and before executing the runner. A custom suite with fewer
than five plans must set a count within its range; the count is not silently clamped.

Evaluate the two requested furniture groups and their placements whether they are authored in
one batched call or separate calls. Keep both tool-selection and resulting-plan requirements.

Describe the exact implemented retry signatures and retain the three-attempt limit, archived
superseded attempts, final selected directory and sequential execution in the performance
refactoring's constraints.

## Verification

The two new regression tests failed before the fixes. After them, all 21 tests in
`node --test .agents/scripts/tests/*.test.js` pass, including the skill's actual sampler and
composition commands for valid, zero and excessive counts. An excessive count leaves the session
unchanged and spawns no prompt process. Lint, formatting and changed Markdown links (`bad 0`)
pass. The suite JSON check confirms that only the multi-group expectation changed; the retry
prose matches the tool API and predicates.
