# Planning Assistant: one skill round — the mandatory reference served with the skill

> **Type**: Feature analysis — proposal A of
> [the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md), its design
> and its measurement, benchmark 06
> **Status**: Open
> **Date**: 2026-10-27
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-ui `feat/hi-mcp-performance` at 389b2b879 (the skills of `hi-mcp/skills.ts`
> and the registration of `get-skill` in `hi-mcp-server.ts`); roomle-hi-example
> `docs/proposal-a-one-skill-round` from `master` at 1ed86cf, the example with
> `@roomle/embedding-lib@0.0.0-dev-5e54d0f`
> **Data**: the "test the mcp" session `.temp/result/mcp-test-2026-10-27_07-11-41` (gpt-6-astra on
> Azure, 79 runs), [benchmark 05](../benchmarks/05-iklw-oa-rc-status-2026-10-27.md) and
> [§4 of the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md#4-where-the-time-to-the-first-attempt-goes)

## Affected repositories

- **roomle-ui** — the skill reading of the HI tools (`hi-mcp/skills.ts`), the description of
  `get-skill` (`hi-mcp/hi-mcp-server.ts`), their tests and the served-text fixture; the living
  reference of the skills (`.agents/homag-intelligence/hi-tools-behaviour.md` §5.6 and §8, a
  decision row, `hi-tools-reference.md`, `prompt-caching.md`, the sequence of
  `agent-architecture.md`). Planner code: no embedding-lib build.
- **roomle-hi-example** — this analysis, benchmark 06 and its report, the `get-skill` row of the
  tool skill, the provider rule of the benchmarks in the timing skill and the benchmarks index.
- **ligna-store** — no change; it gets the tool with the planner's deployment to bo-test.

## 1. What was asked

Proposal A of the time-to-first-attempt analysis: `get-skill` answers a skill together with the
reference its `SKILL.md` asks to read before planning, so that a kitchen or living-room creation
spends one model round on its skill instead of two. This analysis holds the design against the
code and the retained runs and defines its measurement, benchmark 06.

**The provider of benchmark 06 and of every further benchmark.** Unlike benchmarks 01–05, which
ran on direct OpenAI (`openai:gpt-6-astra` with `$OPENAI_ASSISTANT_API_KEY`), benchmark 06 and all
benchmarks after it run on the Azure deployment: `"provider": "gpt-6-astra", "apiKey":
"$AZURE_GPT_KEY"` in the runner's tests file, `gpt-6-astra "$AZURE_GPT_KEY"` on the command line
— the `gpt-6-astra` deployment of the HI Azure AI Foundry resource (`FOUNDRY_DEPLOYMENTS` of
`minimal-hi-example/start.mjs`: Responses API, reference cache breakpoint on, provider-default
reasoning effort). The seconds of the OpenAI series are not compared with the Azure series; the
shape of a turn — the calls and what each one does — is. The rule is recorded in
[the timing benchmark skill](../skills/hi-mcp-timing-benchmark.md#1-define-the-run-and-its-clocks)
and [the benchmarks index](../benchmarks/README.md).

## 2. How the skills are served today

The skills are files of the planner's tool set in the Agent Skills format, served as their
authors deliver them (D75 of roomle-ui
[hi-tools-behaviour.md](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)):

| Skill | `SKILL.md` | `references/planning-reference.md` | `references/source-catalog.md` |
|---|---|---|---|
| `image-planning` | 4,830 bytes | — | — |
| `kitchen-planning` | 19,280 bytes | 15,247 bytes | 5,112 bytes |
| `kitchen-planning-fr` | 14,217 bytes | 16,977 bytes | 8,427 bytes |
| `living-room-planning` | 17,596 bytes | 13,189 bytes | 8,575 bytes |

- **The reading** (roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills.ts`):
  `loadSkills` bundles the files of `skills/` at build time and reads the frontmatter of every
  `SKILL.md`; `readSkillFile(skills, name, file = 'SKILL.md')` returns one file of one skill as
  text, with LF line endings, and fails for an unknown skill or a path outside the skill's list
  (G66); `skillIndex` is the line per skill in the description of `get-skill`.
- **The tool** (`hi-mcp-server.ts`, `registerTool('get-skill', …)`): the input is `{ name, file? }`;
  the executor (`tool-executors.ts`, `'get-skill'`) is `readSkillFile`; the registration puts the
  session preamble `SKILL_IN_SESSION` (about 1 KB) in front of a `SKILL.md` and nothing in front of
  a supporting file. The description says: before planning a room of a kind listed, or from an
  image, follow its skill; use supplied files and fetch missing files with `file`.
- **What the skills ask.** The kitchen skill, line 14: "Read the planning constraints
  reference" (linked as `./references/planning-reference.md`) "before applying numerical guidance or
  reviewing installation risks"; the living-room skill, line 14, the same sentence; the France kitchen skill,
  line 12: "Use the planning reference" (linked as `references/planning-reference.md`) "for detailed
  checks, evidence qualifications, and worked examples". All three call the source catalog optional and say
  not to load it during routine planning. The image skill has no supporting file.
- **The system prompt** (roomle-ui `hi-agent-prompts.ts`): "Before planning, follow the skill for
  the request … Use supplied skill files; fetch missing skills and references with get-skill."
- **The host.** `createHiMcpTools` of the embedding-lib forwards the call to the planner
  (`callExternalObjectAgentTool`); the planning assistant does not look into the result.

What the agent does with it, in the session of 2026-10-27:

| Runs | Count |
|---|---|
| Runs that fetched a `SKILL.md` | 40 of 79 (`kitchen-planning` 32, `living-room-planning` 7, `image-planning` 7) |
| … and then the planning reference, in a round of its own | 22 — every kitchen and living-room creation, two obstacle plannings, the sink at the water connection, the hob swap |
| … and not the reference | 18: edits of an existing kitchen (runs 01, 14, 18, 19, 20, 22, 23, 24, 34, 35, 42, 74), small creations (54 three tall units, 57 a base row, 48 four cabinets, 55) and the image-only tall units (67) |
| Runs that fetched the source catalog | 0 |
| A reference fetched twice in a turn | 0 |

The reference comes in a round of its own because the agent learns of it from the `SKILL.md` it
has just read: round 1 fetches the skill (with the live plan sections, and the image skill for an
image), round 2 the reference, round 3 creates
([§3 of the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md#3-how-a-kitchen-comes-about-today)).
Benchmark 05 shows the round on OpenAI: call 2 takes 10.6 / 13.0 s with 295 / 324 output tokens, of
which 192 / 226 are reasoning, for one tool call of 15,393 result bytes. On Azure the round costs
2.8–3.9 s in the four text kitchens of §4 (30–62 output tokens, no reasoning) and 11.7–28.1 s in
the image kitchens, where the model reasons about the image and the reference (192–491 reasoning
tokens). The three small creations that skipped the reference — runs 48, 54 and 57 — created at
call 2, after 11.7–14.8 s: that is the shape of a creation with one skill round.

## 3. The gap

The create needs the reference: the dimensions, the clearances and the installation checks the
`SKILL.md` defers to it. The round that fetches it cannot be skipped, but it can be merged into
the round that fetches the skill, because the tool knows which file the skill asks for. The
saving per creation is the fixed price of a round — about 3.5 s of model time and one request —
in a text creation; in an image creation the round's reasoning on the image and the reference does
not disappear, it moves into the create call. The reasoning of the create itself (7–23 s before
its first output) is untouched: A takes one of the three rounds, C is for the reasoning.

## 4. The proposed change

**`get-skill name` answers the skill with its planning reference.** For a `SKILL.md`, the result
is the session preamble, the `SKILL.md` as delivered, and then each supporting file the skill asks
to read before planning, introduced by a line that names it as included — for the kitchen skill:

```
<the session preamble>

<SKILL.md>

---

The file references/planning-reference.md of this skill, which SKILL.md asks to read before planning, included:

<references/planning-reference.md>
```

- **Which files.** The planning reference of the three room skills; the image skill has none. The
  files are named per skill in `skills.ts`, beside the skill loading — three entries —, and
  `readSkill(skills, name)` assembles the result from `readSkillFile`. A supporting file on its own
  (`file`) stays what it is: the file as delivered, without the preamble, the source catalog among
  them. The skill files do not change (D75).
- **The description of `get-skill`** says what the result holds, shorter than today: "Returns a
  planning skill with the reference it asks to read before planning, in one result: how to plan a
  room of one kind, or from an image the user sends, well … Before planning a room of a kind listed
  here, or from an image, follow its skill; use supplied files; `file` fetches one file of a skill,
  e.g. its optional source catalog." The `file` schema says: "A file of the skill by its path,
  e.g. references/source-catalog.md; SKILL.md with its planning reference by default".
- **The system prompt** stays: "Use supplied skill files; fetch missing skills and references
  with get-skill" is still true, and the reference is no longer missing.
- **Where it runs.** `get-skill` is answered by the tool set in the planner without a planner
  method, so the change is planner code (web-sdk): the example and the ligna-store get it with the
  planner's deployment to bo-test, benchmark 06 runs it on the local planner, and no embedding-lib
  build is needed.

**What it costs.** Every fetch of a room skill carries its reference: 15–17 KB, about 3,800–4,200
input tokens, read once per conversation and then from the cache (the result stays in the
history, as today's two results do). In the session, 18 of the 40 skill fetches would carry a
reference the agent did not go on to fetch — the edits of an existing kitchen and the small
creations above —, about 4,000 input tokens each, roughly 50 ms of prefill per call that follows.
The largest result is the France kitchen skill with its reference, about 32 KB, far below what a
`get-plan-context` of the articles answers (270,617 bytes).

**The risk.** A model that has read "Read the planning constraints reference before applying
numerical guidance" may still call `get-skill` for the file it already holds. The included-file
line and the description say that it is included; if benchmark 06 shows a reference fetch after
the bundle, the text is clarified, not guarded. A reference fetched twice costs what it costs
today — one round — and nothing more.

## 5. Alternatives, rejected

| Alternative | Why not |
|---|---|
| The skill index names the required files, so the model requests `SKILL.md` and the reference in one round | Depends on the model doing so on every creation; the bundle is deterministic and costs the model nothing |
| The reference merged into `SKILL.md` by the authors | Changes the delivered files (D75); the two files stay separately fetchable for any host that loads skills itself |
| The skills in the shared prefix of the planning assistant | Variant C of [the shared-reference benchmark](../benchmarks/planning-assistant-prompt-caching.md#content-variant-results-and-decision): fewer calls in the creations, a larger input on every edit turn, no overall gain (ADR 0014) |
| The reference supplied by the assistant with the user message | That is [proposal G](planning-assistant-time-to-first-attempt.md#g-the-skills-of-the-turn-selected-before-the-first-call): a selection per turn in the host, decided on the build of A |
| Every supporting file bundled, the source catalog included | 5–8.5 KB per fetch that no run reads; the skills themselves call it optional and say not to load it in routine planning |
| The required files parsed from the prose of `SKILL.md` ("read … before", "optional") | Three sentences in three wordings today; a list of three entries in the tool, guarded by a test, says the same without parsing |
| A frontmatter field of the skill that names its required references | Changes the delivered files; possible later, when the authors adopt it, with the tool reading the field instead of its list |

## 6. Benchmark 06

The measurement of A, run on request with [the timing benchmark skill](../skills/hi-mcp-timing-benchmark.md):

| Setting | Value |
|---|---|
| Provider | `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` — the Azure deployment, as for every benchmark from 06 on ([§1](#1-what-was-asked)); provider-default reasoning effort, no request pacing |
| Tests | `image-kitchen-left-wall` (the fixture of the series, the prompt and `docs/images/kitchen-1.png` on the default room) and `full-kitchen-walnut-marble-corner` (the text kitchen of the ticket's case), from `docs/test-prompts.json`, no suite suffix, no random cases |
| Repetitions | two per test, fresh conversations; about six minutes and 2.5–3.5 million input tokens |
| Planner | the local dev server on :5173 of the roomle-ui branch that carries A, the example with `--dev`; the pinned embedding-lib `0.0.0-dev-5e54d0f`, which A does not change |
| Collector | the collector of benchmark 05 (`.temp/result/benchmark-05-iklw-oa-2026-10-27/make-timing-runner.mjs`): the model requests, the tools, the planner calls and the output parts of the window |
| Report | `.agents/benchmarks/06-…` with the tables of the timing skill, the per-call table showing which tool each call makes; a new unnumbered comparison for the Azure series, since the seconds of 01–05 are not comparable |

**Accepted when**, in all four runs:

1. the create comes at call 2 — call 1 fetches the live plan sections and the skill (with the
   image skill for the image kitchen), call 2 creates —, and no call fetches
   `references/planning-reference.md`;
2. the first kitchen is not later than the same tests on the same deployment in the session of
   2026-10-27 — run 52, 31.7 s, and run 68, 36.4 s — beyond the spread of two repetitions, and the
   kitchen is the kitchen of benchmarks 04 and 05 (the nine articles in the order of the image, on
   the left wall; the walnut kitchen around the back right corner with its materials);
3. the create's reasoning tokens show where the reference round's reasoning went: more in the
   create call of the image kitchen than in benchmark 05 (195 / 90), not lost.

A text creation should gain the round's 3–4 s, an image creation less, because its reasoning
moves. A fetch of the reference after the bundle, or a kitchen that gets worse, sends the design
back to its text ([§4](#4-the-proposed-change)); A stays out only if the first kitchen is later.

## 7. Code and documents the work would touch

| Repository | Code and tests | Documents |
|---|---|---|
| roomle-ui | `hi-mcp/skills.ts` (the required files per skill, `readSkill`); the registration of `get-skill` in `hi-mcp/hi-mcp-server.ts` (the result, the description, the `file` schema); `__tests__/hi-mcp/skills-test.ts` (`readSkill` assembles the preamble-free bundle in order, with the included-file line; a skill without required files answers its `SKILL.md` alone; every required file is a file of its skill and the source catalog is never required); `__tests__/hi-mcp/hi-mcp-server-test.ts` (the `SKILL.md` result holds the preamble, the skill and its reference under the included-file line; a supporting file alone comes as delivered; the description names the reference and the optional file); `test-helpers/unit/hi-mcp-fixture.json` rewritten for the description | `.agents/homag-intelligence/hi-tools-behaviour.md`: §5.6 (what a `SKILL.md` result holds), the `get-skill` paragraph of §8, a decision row (the reference served with the skill; rejected: the index naming the files, the files merged by the authors, every file bundled, the prose parsed); `hi-tools-reference.md` (`get-skill`); `prompt-caching.md` (the on-demand skill paragraphs); `agent-architecture.md` (the sequence of a kitchen turn: two skill calls become one) |
| roomle-hi-example | the benchmark session and `06-…` report, the Azure comparison | this analysis; [the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md) (A's state, §7, §10); `.agents/skills/hi-mcp-tools.md` (the `get-skill` row); `.agents/skills/hi-mcp-timing-benchmark.md` and `.agents/benchmarks/README.md` (the provider rule, in this change) |
| ligna-store | — | — |

## 8. Measurement gaps

- The session's reference rounds were measured on Azure with the planner of bo-test and the
  embedding-lib `0.0.0-dev-130245d`; benchmark 06 runs the local planner of the branch with the
  pinned `0.0.0-dev-5e54d0f`. The shape of a turn is comparable, the seconds carry that difference.
- Two repetitions per test give the shape and a range, not a p95: the expected gain of a text
  creation, 3–4 s, is of the order of the run-to-run spread of benchmark 05 (29.9 / 27.0 s), so
  criterion 1 decides and criterion 2 guards.
- Whether the moved reasoning lengthens the create call by the same amount is what criterion 3
  observes; the wait before a call's first output does not separate reasoning from queueing.
