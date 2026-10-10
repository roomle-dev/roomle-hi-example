# Generate standard MCP prompt tests per session

> **Date**: 2026-10-09
> **Status**: Implemented — verified locally
> **Scope**: MCP test infrastructure, former backlog item 4
> **Ticket**: [RML-18027](https://roomle.atlassian.net/browse/RML-18027)

## Affected repositories

- **roomle-hi-example** — define agent-generated standard cases in the testing skill, prepare and report them in the session test file, and update the testing reference and regression coverage where needed.

## Repository scope

| Repository | Required work |
|---|---|
| roomle-hi-example | Test infrastructure and documentation only. The main gap is `.agents/skills/hi-mcp-testing.md`; related references are `docs/test-prompts.md` and `docs/implementation/deployment-and-testing.md`. The existing runner already accepts the prepared cases. |
| roomle-ui | None. Generated prompts use the existing planner APIs and saved plans. |
| ligna-store | None. The prompt runner opens the minimal HI example, not the store. |
| RoomleCore | None. Test generation does not require kernel changes. |

Productive MCP, chat, planner and library code is outside this issue's scope.

## What exists

- [docs/test-prompts.json](../../docs/test-prompts.json) contains 35 fixed tests, nine saved plans
  and `randomTests: 3`. The source file contains no cases marked `random: true`: those belong to
  the session's prepared `tests.json`.
- [The testing skill](../skills/hi-mcp-testing.md#random-tests) already tells the agent to draw plans
  at random, write the requested number of new prompts and expectations, mark them `random: true`,
  and append them to the session file. It defines their reporting too.
- [The runner's validation](../scripts/run-hi-mcp-tests.js#L76) accepts arbitrary tests with unique
  ids, valid plan references, prompts/images and an optional boolean `random`. It validates
  `randomTests` as a non-negative integer; it neither generates cases nor checks how many marked
  random cases were supplied.
- [The execution loop](../scripts/run-hi-mcp-tests.js#L185) executes every test present in the
  supplied file for every model. It does not restrict execution to cases from the fixed source file.
  Results preserve each case's id, title and random flag.
- [ADR 0006](../decisions/0006-prompt-tests-assess-the-agent.md) requires user prompts and images,
  rather than scripted MCP calls. Setup for an edit is an earlier conversation turn or a saved plan.

The current split is deliberate: the agent prepares the cases through the skill; the script runs
that prepared file. Running the CLI directly on `docs/test-prompts.json` runs its fixed cases only,
even though its configuration requests three random cases for the skill's preparation step.

## Evidence

Four retained sessions from 2026-10-08 and 2026-10-09 contain 38 cases: the same 35 fixed ids and
three additional cases marked random, all with valid plan references. Their `results.json` files
record three random executions per model; the three-model session records nine. None has an
additional non-random case outside the fixed source ids.

A temporary probe ran the actual suite CLI against a prepared file containing one generated standard
conversation and one marked random test. Local fake prompt processes completed both cases; the
suite recorded both and retained the random distinction. No model or Roomle service was called.
This confirms that generated-case execution does not need another repository or a new MCP API.

## Gap identified

The backlog's claim that only hand-written tests run, and that random-test generation is not built,
is too broad. Random preparation and reporting are already defined and have been used.

What was missing was a defined preparation/reporting step for **agent-generated standard cases**:
which coverage they must provide, how they are distinguished from fixed and random tests, and when
an agent adds them to the session. The runner can already execute them as ordinary tests.

## Implementation

1. The [testing skill](../skills/hi-mcp-testing.md#generated-standard-tests) defines six generated
   standard cases for a full session: `create`, `place`, `attributes`, `edit`, `history` and
   `conversation`. The agent selects variants distinct from fixed cases using saved plans and
   library information, and writes every prompt and expectation before execution.
2. Cases use `standard-<coverage>-<slug>` ids and `Standard:` titles, without a random flag. They
   are stored in the session's `standard-tests.json`; the committed source suite is unchanged.
   The existing results retain these ids/titles, so no runner metadata or model client is added.
3. The skill's executable `jq` composition command appends standard and random cases once, after
   fixed cases. It checks requested counts, all six coverage areas for a full session, generated
   expectations, valid plans, markings and unique ids. Failure leaves the session file intact.
   The existing `randomTests` policy remains, including zero.
4. A run limited to named tests generates no extra cases unless requested. Its standard count
   is zero, or the requested count, in a preparation shell variable. Resuming skips preparation
   and reuses the existing `tests.json`; composing into a prepared file is rejected.
5. One report counts fixed, standard and random tests separately, retains title prefixes in its
   summary and run sections, and includes generated case JSON and standard coverage keys.

The living references are [test-prompts.md](../../docs/test-prompts.md#prepared-test-sessions)
and [deployment-and-testing.md](../../docs/implementation/deployment-and-testing.md#the-suite--run-hi-mcp-testsjs).
The test runner and all productive code stay unchanged.

## Verification and close-out

- [generated-tests.test.js](../scripts/tests/generated-tests.test.js) executes the actual `jq`
  filter extracted from the skill and the existing suite CLI with local fake prompt processes.
  Its eight regressions failed before the preparation command was added and pass with it.
- The full infrastructure suite passes: 18 tests. It covers fixed/standard/random execution,
  zero random cases, focused runs, resume without duplicate execution, invalid generated counts,
  missing standard coverage, invalid metadata and duplicate ids, alongside navigation recovery.
- Lint, format and Markdown-link checks pass. No real model, planner or Roomle service was called
  for this verification; generated planning outcomes remain evaluated by the agent during a real
  test session.
- Former backlog item 4 and its overview/index entries are removed. The implementation is local
  on the current feature branch; this analysis remains until the work lands on `master`.
