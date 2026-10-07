# roomle-hi-example Analysis Cleanup Skill

This skill cleans up `.agents/bug-analysis/`, `.agents/feature-analysis/` and
`.agents/refactoring-analysis/` as a whole. **Triggered by "cleanup analyses"** (also "cleanup
analysis", "clean up the analyses", "analysis cleanup"): the phrase alone means *execute this whole
procedure*, without asking for the details it defines. Load it as well when the user asks to review
or tidy the analysis folders.

## Goal

The analysis folders hold **only work that has not landed**. Every other document is closed out:
its durable outcome is promoted, and the document is deleted. Open work stays untouched.

An analysis is written before the work and speaks in the present tense about code that is about to
change. Once the work has landed, most of it is false while it still reads as authoritative, and the
rest — symptom, reproduction, investigation trace, run results — has done its job. Git history, the
Jira comment and the pull request description remain the archive.

## Verification standard — never guess

A document counts as done only when all of these hold:

- The fix or implementation commit is on `origin/master`: `git merge-base --is-ancestor <sha>
  origin/master`. A status such as "Implemented (locally)" or "Fixed (roomle-ui branch, not
  deployed)" names a branch; find the commit that actually landed (`git log --oneline origin/master
  --grep=<TICKET>`, `git log --oneline origin/master -S<symbol> -- hi-mcp minimal-hi-example`).
- The behaviour is still in the code at HEAD — the key condition, the function, the sentence of the
  served text.
- The guarding test exists: an `it('…')` in `hi-mcp/<package>/tests/*.test.ts`; for served text, a
  test of [`docs/test-prompts.json`](../../docs/test-prompts.json) can guard it as well.
- roomle-ui work is on roomle-ui `origin/master`, ligna-store work on ligna-store `origin/master`
  (fetch each once up front, not per agent).
- Jira: `PAGER=cat jira issue list -q "key=<KEY>" --plain --no-headers --columns status,resolution`.
  `Accepted` is the closed state in RML; `Won't Do` is abandoned. A closed ticket alone does not
  prove the code changed — tickets are closed while the work is still on a local branch.

A document whose work cannot be established as landed stays. A guarding test that does not reproduce
the original failure is an open item for the backlog, not proof of a fix; so is a deployment or a
live check still to be done for work whose code has landed.

A rejected or abandoned analysis is closed out as well: the rejected approach becomes a decision, and
the document is deleted.

## Where the outcome goes

The durable outcome is what must keep holding, or what the next person needs to know. Check whether
its home already states it; add it only where it does not.

| What | Where it goes |
|---|---|
| How the MCP server behaves towards an agent — a tool, a served rule, a result, a guard, a correction, a feedback message | [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), in the section of that tool or rule |
| A decision about that behaviour, or a rejected approach someone could plausibly re-propose | a numbered decision `D<n>` in §3 of `hi-mcp-behaviour.md`, with its date, source and state |
| An architecture decision — where the logic runs, the page bridge, the deployment | a numbered ADR in [`.agents/decisions/`](../decisions/) |
| How a feature works — the server, the tools, the chat, the pages, a deployment | the living-reference document of the area: [`hi-mcp-server.md`](../../docs/hi-mcp-server.md), [`ai-chat.md`](../../docs/ai-chat.md), [`hi-mcp/hi-mcp-server/README.md`](../../hi-mcp/hi-mcp-server/README.md), [`docs/`](../../docs/) — a new document for a new feature |
| A tool's parameters and examples | [`hi-mcp-tools.md`](hi-mcp-tools.md) |
| HI domain knowledge — rooms, walls, articles, docking, positioning | [`roomle-hi-concepts.md`](roomle-hi-concepts.md), [`hi-authoring-rules.md`](hi-authoring-rules.md) |
| The regression test | it exists; name it next to the invariant: guarded by `it('…')` in `hi-mcp/hi-mcp-server/tests/….test.ts`, or by the test `<id>` of `docs/test-prompts.json` |
| A debugging or test recipe — a run script, a headless check, a deployment step | the matching skill in `.agents/skills/` ([`hi-mcp-testing.md`](hi-mcp-testing.md), [`hi-mcp-cloudflare-deployment.md`](hi-mcp-cloudflare-deployment.md)) |
| Model comparisons and before/after numbers that later work compares against | `.agents/benchmarks/`, with a row in the benchmarks table of [`.agents/README.md`](../README.md) |
| A deferred item, a follow-up or an open finding | a todo in [`.agents/backlog/`](../backlog/README.md), written as [the backlog cleanup](hi-backlog-cleanup.md#what-the-backlog-is) defines it |
| The refactoring report (summary, changed files, before/after, test adaptations, risks) | the pull request description |

Drop the rest: symptom, reproduction, investigation trace, line-level root-cause narrative,
verification logs, the runs of past test sessions and their plan snapshot ids, alternative fixes of a
bug that nobody would re-propose.

The living reference describes how the code works **today**. Never paste history into it — no "was
fixed in", "previously", "the old code", ticket stories. The date and the state of a decision in §3
of `hi-mcp-behaviour.md` are the only history it keeps.

## Hard rules

- **Never delete before promoting.** An analysis whose invariant is not in the living reference, a
  decision or a test takes the only record of why the code is shaped that way with it — the next
  person "simplifies" the fix back into the bug.
- **Never guess.** A document whose work you cannot verify as landed stays.
- **Never merge analyses into a digest.** The outcome goes into the living reference of the area,
  structured by how the area works, not into a summary of past analyses.
- **Open work stays.** An analysis of an open bug, an undecided feature or a refactoring not carried
  out yet remains in its folder until the work lands or is abandoned.
- **No dangling links.** Point a link to a deleted document at the living-reference section that now
  carries the outcome, or replace it with plain text and the Jira ticket link
  (`[RML-18041](https://roomle.atlassian.net/browse/RML-18041)`) — the sources of the decisions in
  `hi-mcp-behaviour.md`, the `Analysis` line of an ADR and the details of a backlog item included.

## Procedure

### 1. Branch and inventory

```bash
git fetch origin master -q
git switch --no-track -c docs/<slug> origin/master
find .agents/bug-analysis .agents/feature-analysis .agents/refactoring-analysis -name '*.md' ! -name README.md
```

Collect the inbound links too: `git grep -lE "(bug|feature|refactoring)-analysis/"`.

### 2. Group by domain with disjoint file ownership

Parallel agents that edit the same file lose each other's updates. Split the documents into domain
groups so that each group **owns** a disjoint set of living-reference files, and write the
assignment to a scratch file. Check that every document is assigned exactly once (`comm` of the
assignment against the inventory). About 20 documents per group works well; a handful of documents
needs no groups.

A split along the living reference of this repository:

| Group | Owns |
|---|---|
| MCP server behaviour — tools, placement, docking, guards, plan context, undo | `docs/hi-mcp-behaviour.md`, `hi-mcp/hi-mcp-server/README.md`, `.agents/skills/hi-mcp-tools.md`, `hi-authoring-rules.md`, `roomle-hi-concepts.md` |
| Chat, models and testing | `docs/ai-chat.md`, `docs/test-prompts.md`, `.agents/skills/vercel-ai-sdk-chat.md`, `hi-mcp-testing.md` |
| Architecture, pages and deployment | `docs/hi-mcp-server.md`, the other documents of `docs/`, the READMEs, `.agents/skills/hi-mcp-server.md`, `hi-mcp-cloudflare-deployment.md` |

The coordinator keeps `.agents/README.md`, `.agents/decisions/` and the existing backlog documents.

### 3. Close out per group

One agent per group, in parallel. For every document: verify it by the
[verification standard](#verification-standard--never-guess), promote its outcome
([where the outcome goes](#where-the-outcome-goes)), and delete it. Under these rules:

- Edit only the group's analysis documents, its owned living-reference files, new files in its owned
  folders, and new backlog files.
- No git write commands; delete with plain `rm`. The coordinator stages and commits.
- A new decision gets the number `DXX`; ADR drafts go to a scratch folder with the number `XXXX`. The
  coordinator numbers both.
- Edits needed in files the group does not own go into a handoff file: target file, section and the
  exact text — a link to a deleted document included.
- A report per group: document, verdict (deleted / kept-open / kept-unresolved), evidence (commit,
  test, Jira), and where the outcome is now recorded.

While promoting, compare the living reference with the code and correct what the code contradicts.

### 4. Number the decisions and ADRs

- ADRs: take the next free number from `origin/master` (`git ls-tree --name-only origin/master
  .agents/decisions/`), not from the local tree, and add each to the Decisions table of
  [`.agents/README.md`](../README.md).
- Decisions: take the next free `D<n>` after the highest in `git show
  origin/master:docs/hi-mcp-behaviour.md`.

Number the drafts in the documents and in the handoff files, and write a map from draft to number for
the next step.

### 5. Apply the handoffs

A second parallel pass, again with disjoint ownership — for example the behaviour and tool reference;
the chat, testing and deployment documents; the backlog, the ADRs, the kept analyses and the other
skills. Give each the handoff files, the number map and the list of deleted files. Outside markdown,
only a link to a deleted document changes. Few handoffs: the coordinator applies them alone.

### 6. Rebuild the index

In [`.agents/README.md`](../README.md): remove the rows of deleted documents, update the status of
the kept analyses, and add rows for new ADRs, backlog documents, benchmarks and living-reference
documents. In [`.agents/backlog/README.md`](../backlog/README.md), no row links a deleted document.

### 7. Check

- Link check over every markdown file: `bad 0`.

  ```bash
  node .agents/scripts/check-markdown-links.js $(find . -name '*.md' -not -path '*/node_modules/*' -not -path './.temp/*' -not -path './docs/library-information/*')
  ```

  A link into `.temp/` (local, ignored by git) or out of the repository by a relative path is broken
  for everyone else: replace it with the plan snapshot id, a GitHub URL or plain text.
- No placeholder left:
  `grep -rn -E "ADR XXXX|\bDXX\b" --include='*.md' --exclude=hi-analysis-cleanup.md --exclude-dir=node_modules .`
- No plain-text mention of a deleted path: `git grep --untracked -F -f <deleted-slugs>`. A slug that
  is also another name (`hi-mcp-poc-json` is the Azure app name) or the start of a kept document's
  name is a false positive.
- `git diff --stat origin/master -- ':!*.md'` lists only files whose link to a deleted document
  changed; when it lists one, `npm run format:check` and `npm run lint` pass.

### 8. Commit

Two commits on the branch, never on `master`: `docs: promote the outcome of the landed analyses`
(the living reference, decisions, ADRs, backlog, skills and repointed links) and `docs: delete the
landed analyses` (the deletions and the index). Push and open a pull request only when the user asks.
