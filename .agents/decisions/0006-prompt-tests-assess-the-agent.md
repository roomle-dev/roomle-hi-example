# ADR 0006 — The prompt tests assess the agent, the unit tests the tools

> **Status**: Accepted
> **Date**: 2026-10-07
> **Ticket**: RML-18027; format [test-prompts.md](../../docs/test-prompts.md#test-cases), run [hi-mcp-testing.md](../skills/hi-mcp-testing.md)

## Context

A test of [test-prompts.json](../../docs/test-prompts.json) could start with `operations`: MCP tool
calls with fixed arguments, made before the prompt — `delete-root-module` of the middle unit before
"join the two groups on the right wall", `delete-root-module` and `undo` before "redo that". Such a
test called the tools itself, so it no longer only measured the agent. It also could not express a
conversation of several user messages.

## Decision

- The tests of `docs/test-prompts.json` assess how well the agent understands a prompt and picks the
  right tools. A test holds only what a user sends: prompts and images. **No test calls a tool
  itself.**
- A test that needs a changed plan asks for the change in an earlier turn: `prompt` is a text or a
  list of texts, sent as consecutive turns of one chat. `expect` says per turn what to check, and
  every turn is evaluated.
- The tools are tested by unit tests in `hi-mcp/hi-mcp-server/tests` (`npm test` in `hi-mcp`). A
  tool behaviour that needs checking gets a unit test there, not a prompt test.
- `operations` is gone from the test file, `run-hi-mcp-tests.js` and `run-hi-mcp-prompt.js`
  (`--operations`).

## Consequences

- A setup turn can go wrong — the agent removes the unit instead of deleting it, and the later turns
  start from another plan. The evaluation reports that turn; it is part of what the test assesses.
- Setup turns cost chat time.
- The undo tests undo the agent's own change. The run still waits until the planner has loaded the
  plan's groups (`window.hiPosGroupsCompletelyLoaded`) before the first turn, because the planner
  clears its undo history then.
- A planner state for a hand run comes from a prompt or a saved plan snapshot (`--plan`), not from
  tool calls.

## Rejected

- `operations` as a list of setup prompts beside `prompt`: two fields for one thing, and every turn
  is assessed anyway.
- Keeping `--operations` in `run-hi-mcp-prompt.js` for hand runs: it keeps a path on which a test
  calls the tools itself.
