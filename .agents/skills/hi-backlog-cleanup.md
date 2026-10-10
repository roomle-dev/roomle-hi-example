# roomle-hi-example Backlog Cleanup Skill

This skill cleans up `.agents/backlog/`. **Triggered by "cleanup backlog"** (also "clean up the
backlog", "backlog cleanup"): the phrase alone means *execute this whole procedure*, without asking
for the details it defines. Load it as well when the user asks to review or update the backlog, or
when work that a backlog item describes has landed. Step 7 of
[the testing skill](hi-mcp-testing.md#7-open-issues) adds the issues of a test run by the same rules.

## What the backlog is

**Open todos only.** A backlog document says what is still to do, never what was done.
A solved issue is removed entirely as soon as its implementation is verified, including on the
working branch. Pending merges, releases or deployments do not keep it in the backlog; record
that status and the release verification in its analysis until the fix lands.
[`README.md`](../backlog/README.md) lists every item by area, one row each; the items themselves are
the numbered issues of [`mcp-issues.md`](../backlog/mcp-issues.md),
[`library-issues.md`](../backlog/library-issues.md) and
[`mcp-test-infrastructure-issues.md`](../backlog/mcp-test-infrastructure-issues.md), a README row, or
a document of their own. Each item carries:

- the problem as the code is **today**, with `file:line` references that match HEAD, and its cause
  where it is known;
- the proposed change;
- the test that guards the change — a unit test or a test of
  [`docs/test-prompts.json`](../../docs/test-prompts.json) — and the constraints, including what a
  naive change breaks, stated as a constraint, not as the story of the attempt that broke it;
- one **Reproduce** line naming the run whose payload reproduces it, replaced — never appended — when
  a newer run shows it;
- references: Jira ticket, decision `D<n>` of
  [`hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), ADR, living-reference section — an
  analysis only while that analysis is open work.

It never carries: status history, "found while …", "found by …", "since RML-…", "latest run"
paragraphs or lists of runs, measurement history, "already implemented" tables, "Added" dates, Jira
status snapshots, notes about tickets to close, investigation narratives, "tried" or "reverted", or
the record of a failed attempt.

## Procedure

### 1. Branch

```bash
git fetch origin master -q
git switch --no-track -c docs/<slug> origin/master
```

### 2. Verify every item against the code — never trust the document's status

- Grep the symbols and `file:line` references the item names at HEAD.
- `git log --oneline origin/master --grep=<TICKET>` and `git log --oneline origin/master -S<symbol>
  -- hi-mcp minimal-hi-example .agents/scripts` for landed work.
- Verify a local fix on the working branch against the planner or client used in its check.
  A verified fix leaves the backlog without waiting for merge or deployment. To check an already
  released fix, roomle-ui uses `origin/release/bo-test` (the planner the example loads) or
  `origin/master`; ligna-store uses `origin/master`. Use `git branch -r --contains <sha>` and fetch
  each affected repository once when checking those remote branches. Release status belongs
  in the analysis, never in a replacement "land the branch" backlog item.
- An item about the served text — a rule, a tool description, a result message — is done when the
  text in `hi-mcp/hi-mcp-server/` says it. A test run that happens not to show the issue is no fix.
- Jira: `Accepted` is the closed state in RML. A closed ticket does not prove the code changed — check
  the code.

For a large backlog, run the verification in parallel read-only agents, one per document or
repository, each answering OPEN / DONE / PARTIAL per item with `file:line` evidence.

### 3. Act per item

| Verdict | Action |
|---|---|
| DONE | Remove the item: its section, its row in the document's overview and its row in the README. A solved bug leaves at once. If its outcome is not yet in the living reference or a decision, promote it first ([where the outcome goes](hi-analysis-cleanup.md#where-the-outcome-goes)). Delete a document that has no item left. |
| PARTIAL | Shrink the item to the part that is still open. |
| OPEN | Keep it. Strip the history, refresh the `file:line` references, correct every claim the code contradicts, and keep one **Reproduce** line. |
| Not a todo | Reference material belongs in the living reference (`docs/hi-mcp-behaviour.md`, `.agents/skills/`, `docs/`), written as today's behaviour — no past defect, no date of when it was solved, no ticket number; history already covered elsewhere is deleted. |

Keep the file names and the issue numbers of open items stable: the README, the skills and other
documents link to them. An issue's anchor is made from its number and title — when a title changes,
repoint its links.

### 4. Links and index

- Repoint every link to a removed item or document: `git grep -n "<file name>"`, and for a removed
  issue `git grep -n "<file name>#<number>-"`.
- Update the overview tables of the documents, the rows of [`README.md`](../backlog/README.md) and
  the Backlog table in [`.agents/README.md`](../README.md).

### 5. Check

- Link check over the touched files —
  [`check-markdown-links.js`](../scripts/check-markdown-links.js), as in
  [the analysis cleanup](hi-analysis-cleanup.md#7-check): `bad 0`.
- History wording left in the backlog:

  ```bash
  grep -n -i -E "landed|already implemented|implemented on|marked|found while|found by|found in|scoped out|failed attempt|originally|previous(ly)?|before the fix|after the fix|housekeeping|first proposed|latest run|tried|reverted|mitigated|was fixed|since RML" .agents/backlog/*.md
  ```

  A remaining hit is acceptable only as a description of today's behaviour or as measurement evidence
  behind a todo's expected effect.

### 6. Commit

On the branch, never on `master` (`docs: …`): the removed items with their promotion in one commit,
the rewritten open items in another. Push and open a pull request only when the user asks.
