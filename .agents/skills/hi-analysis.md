# roomle-hi-example Analysis Skill

This skill writes an analysis: the deep investigation written **before** the work and closed out
**after** it. **Triggered by "analyse the bug"** (also "analyze the bug", "bug analysis"), by
**"analyse the feature"** (also "analyze the feature", "feature analysis") and by **"analyse the
refactoring"** (also "analyze the refactoring", "refactoring analysis"): the phrase alone means
*write the analysis*, without asking for the details it defines. Load it as well when the user
asks to investigate a defect, a feature or a refactoring.

## Goal

One document per analysis, written before the work and speaking in the present tense about code
that is about to change. It is a historical record: once the work has landed,
[the cleanup skill](hi-analysis-cleanup.md) promotes its durable outcome into the living reference
and deletes it. A solved bug keeps no analysis.

## Where the document goes

| Analysis | Folder | Status values |
|---|---|---|
| Bug analysis | [`.agents/bug-analysis/`](../bug-analysis/) | Open, Fixed |
| Feature analysis | [`.agents/feature-analysis/`](../feature-analysis/) | Open, Implemented, Rejected |
| Refactoring analysis | [`.agents/refactoring-analysis/`](../refactoring-analysis/) | Open, Done |

A new file with a kebab-case slug and a row in the folder README's Current Documents table. The
header block (Type, Status, Date, Base, Backlog where the analysis comes from a backlog item) is
followed by the affected repositories.

## What every analysis names first

Every analysis names the **affected repositories** right after its header block: a short list, one
line per repository, saying what changes there — a repository the work leaves unchanged is named
only where a reader would expect a change (the rule of
[Analysis Documents](../../AGENTS.md#analysis-documents)). The list tells the reader where the
work lands before they read the trace; an analysis without it is incomplete.

## What the document must cover

**A bug analysis** (root cause, written before the fix):

- symptom and reproduction steps
- investigation trace with code references
- the exact root cause (file:line)
- why the current code produces wrong results
- the proposed clean fix

**A feature analysis** (a feature question):

- what was asked and why
- how the area works today, with code/file references
- the gap or question the analysis answers
- the proposed design or change
- the alternatives considered and why they were rejected
- the code and documents the work would touch

**A refactoring analysis** (the analysis and the report are the same document):

- what the current code does and why it is a problem
- the full scope of the change, with file references for every affected location
- the proposed target shape
- the tests covering the affected behaviour and the output changes to expect
- for a performance refactoring, the benchmark to run before and after

What does not belong: a symptom-level fix or workaround (all bug fixes address the root cause, not
hide the symptom), a description of how a feature works today (that is living reference), a general
algorithm write-up independent of any one refactoring.

## Where the fix lives — never the library's calculation (bug analyses)

A bug analysis proposes the fix in the MCP server and the tools and API of roomle-ui — never in
the calculation of the library. The MCP deals with the library as it is: it explains the library's
behaviour and capabilities to the AI agent, and where the library behaves the way it behaves, the
served rules, the tool API and the corrections carry the agent across it. Suggesting to change the
library's calculation itself is not a valid fix proposal.

Valid library fixes are narrow:

- **Update descriptions** — an article, an attribute, a value, any descriptive text the agent reads.
- **Fix a real bug in the library** — code that works against the overall intention, a calculation
  formula that computes the wrong thing.

Not valid as a bug fix:

- **A library API change.**
- **A change of process in the library.**
- **A change in the data the library calculates.**

This is not a hard rule — the library also has code, and code can have real bugs, which is the
second valid fix. What a bug analysis never proposes is asking the library to calculate differently
so the MCP stops seeing a defect.

## Lifecycle

Status `Open` while the work is not done. The close-out — status set, pre-work sections rewritten
into past tense, fix summary and validation results — and the deletion are
[the cleanup skill](hi-analysis-cleanup.md)'s job. While the analysis is open, it updates the
backlog item it came from: the item's responsible cell names the analysis and its outcome.
