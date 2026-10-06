# Bug Analysis: "insert a low cabinet between the high cabinets" does not reach `insert-article-into-group`

> **Type**: Bug Analysis
> **Domain**: the instructions the agent sees — `hi-mcp/hi-mcp-chat/chat-config.ts` (`CHAT_SYSTEM_PROMPT`), `hi-mcp/hi-mcp-server/hi-mcp-server.ts` (the tool descriptions and the served rules); the same system prompt in the ligna-store (`hi-mcp/chat.ts`)
> **Trigger**: [RML-18045](https://roomle.atlassian.net/browse/RML-18045) — the user tried the row edit tools in the example page with gpt-6-astra: the agent put the "low cabinet" beside the "high cabinets" as a new group, then merged it at the end of the row, and called `insert-article-into-group` only after the user named the two roots. The issue report: `.temp/issues/insert-article-into-group/Iissue-insert-article-into-group.md`
> **Date**: 2026-10-06
> **Author**: AI Assistant
> **Status**: Fixed 2026-10-06 — see the [close-out](#close-out-2026-10-06)
> **Branch**: `feat/hi-row-edit-tools-RML-18045` (roomle-hi-example `576c248`), roomle-ui `feat/hi-row-edit-commands-RML-18045` on the local dev server (localhost:5173)
> **Evidence**: the runs under `.temp/result/issue-insert-between-2026-10-06_07-43-52/` (per run `run.json` with the model's answer and tool calls, `plan-context.json`, the images)

---

## Symptom

Plan `ps_r22qpwv9ks87lz1gnrcz1ewv7q8uq3v`: the default room with one group of two wardrobe cabinets
against the right wall. The user's conversation with gpt-6-astra in the example page:

| Turn | User | Agent |
|---|---|---|
| 1 | insert a low cabinet between the high cabinets | a **new group** of two base units beside the wardrobes (the server corrected its relation to `leftOf`); "there is still no single group in the plan that represents that whole high-cabinet arrangement, so I could only add the low cabinet as a separate group" — plan `ps_r235ayyrv89fv0lxlgjc96u6vp851qn` |
| 2 | try again, this is not what I wanted | `merge-article-into-group`: a base unit at the end of the wardrobe group; "the plan still doesn't contain a proper 'high cabinet run' to insert between" |
| 3 | no revert that. Why didn't you use the insert-article-into-group tool? | `undo`; "insert-article-into-group is the right tool only when the target group already contains two neighboring roots and the new unit must go between them; otherwise the planner needs a merge/append action" |
| 4 | The target group consists of 2 roots, so insert a cabinet between the 2 roots | `insert-article-into-group` with the two roots — correct, no corrections — plan `ps_r2292hyjwwcpxeqfvmxe6439oitbffg` |

The group had two roots docked side by side the whole time, visible to the user and listed in the
plan context. The fault is in the server's served text: nothing in it told the agent that the two
root modules of a wardrobe group are the two articles the tool inserts between, so the agent never
reached the tool, and the server never saw a call it could have corrected.

## Reproduction

Headless, against the local planner (`--dev`), the user's plan and the user's words, one turn per
run:

```bash
EXAMPLE_PORT=3001 HI_CHAT_PORT=3201 node .agents/scripts/run-hi-mcp-prompt.js <model> <key> \
  "insert a low cabinet between the high cabinets" --plan ps_r22qpwv9ks87lz1gnrcz1ewv7q8uq3v --dev --out <dir>
```

With the committed instructions (`576c248`):

| Model | Run | Tools called | Plan change | What the model said |
|---|---|---|---|---|
| gpt-6-astra | 1–5 | `get-plan-context`, `insert-article-into-group` | correct in all five runs: a lowboard base `LB_UB600` (twice with the wardrobes' colours) between the two wardrobes, `pos` unchanged, the row grew to the front | "Inserted a 60 cm-wide low cabinet with one hinged door between the two tall cabinets, matching their front and cabinet colours. The row is now 180 cm wide." |
| gpt-5.4-mini | 1 | `get-plan-context` | none | "I found two existing high cabinets in the plan, but no low cabinet has been added yet … If you want, I can add a suitable low cabinet between the two high cabinets next." |
| gpt-5.4-mini | 2 | `get-plan-context`, `get-plan-images` | none | "it's a tall wardrobe/closet block, not a kitchen row with multiple high cabinets. So I couldn't insert a low cabinet between two high cabinets because that 'between' setup isn't present" |
| mistral-medium | 1 | `get-plan-context`, `get-authoring-rules`, `create-or-replace-groups` | the group rebuilt: **both wardrobes replaced by `HTB60` kitchen pantry units**, a `UTB60` between them | "the current group consists of tall units (wardrobe cabinets), which are not part of a kitchen setup … base units and tall units are typically not mixed in the same row … Replace the wardrobe units with kitchen tall units" |
| mistral-medium | 2 | `get-plan-context`, `get-authoring-rules`, `create-or-replace-groups` ×2, `delete-group` | a second group on top of the first, then the first replaced with wardrobe–`UTB60`–wardrobe, then the duplicate deleted; the group moved 600 mm towards the back wall (`pos` z −2563 → −3163) | "inserting a base unit between them is not feasible due to their height mismatch. Instead, I will replace the existing group" |
| gpt-5-mini | 1 | `get-plan-context`, `insert-article-into-group` | correct: `UTB60` between the two wardrobes, `pos` unchanged, the row grew to the front | "I inserted a low (base) cabinet between the two tall cabinets … in the existing closet group" |

**The user's failure with gpt-6-astra did not reproduce**: five fresh single-turn runs all called
the tool at once. What did reproduce, in every run, are the readings behind the user's transcript —
"no proper high-cabinet run", "the right tool only when the group already contains two neighbouring
roots", merge at the end instead — with the two other models the user starts the chat with
(gpt-5.4-mini and mistral-medium, `.temp/notes.md` and the shell history). gpt-6-astra with the
same instructions evidently reads the plan right most of the time and misread it in the user's
session; once it had, "try again" kept it in that frame. The instruction gaps below are the same
for every model, and gpt-5-mini, the model the MCP test runs with by default, is as unaffected as
gpt-6-astra.

## Investigation

### What the agent sees

`get-plan-context` of the plan (`run.json`, operation result of the gpt-5.4-mini run 1):

- one group `7964fd01-200f-44d1-b4f6-38d792d73c56`, `libraryId Furniture_Smith`, group attribute
  `mod_GroupGenerationLogic: Closet`, `position.pos [4815, 0, −2563.1]`, `rotationY 270`
  (against the right wall, 1200 mm from the back right corner), footprint 1200 × 617 mm;
- two roots `KS_HT600` — `articleName CL-TD600`, `desc` "Closed wardrobe cabinet, 60 cm wide, with
  1 door … RESTRICTIONS: Not a kitchen or wet-area unit", `category Closet | Closed`,
  `mod_TypeElement TallUnit`, `mod_Height 2100` —, root `65866076…` (towards the back wall) docked
  `RightBottom -> LeftBottom` and `RightTop -> LeftTop` to root `3b4bdb6f…` (towards the door);
  `freeDockingVectors` of the first: `LeftBottom, LeftTop, Back…`, of the second:
  `RightBottom, RightTop, Back…`;
- a generated toe kick;
- the catalog of 111 articles: 14 kitchen base units (`UTB60` "Base cabinet, 60 cm wide, with 1
  door … SEARCH_KEYWORDS: … lower cabinet"), 8 kitchen tall units ("Tall cabinet …"), 8 closet
  articles, 18 living room articles (lowboards, sideboards, tall units, wall units), 12 utility
  room articles.

The words of the prompt — "high cabinet", "low cabinet" — occur nowhere: not in the catalog (it says
"tall cabinet", "wardrobe", "lower cabinet", "lowboard"), not in the rules, not in a tool
description (`hi-mcp-server.ts`, checked with grep). The group is a closet, not a kitchen.

### What the instructions say

The HI chat gives the model its four-sentence system prompt and the tool descriptions; the server's
instructions and the rules reach it only when it calls `get-authoring-rules`
([behaviour §4](../../hi-mcp/docs/hi-mcp-behaviour.md#4-how-a-tool-call-runs)). gpt-5.4-mini
never called it in any run; mistral-medium did in every run.

1. **The system prompt** (`hi-mcp/hi-mcp-chat/chat-config.ts:13`, and the ligna-store's copy
   `hi-mcp/chat.ts:12`): *"You are a planning assistant for a HOMAG Intelligence (HI) **kitchen** in
   a Roomle planner."* The HI library plans kitchens, closets, living room and utility furniture
   (the catalog's categories), and the plan at hand is a closet.
2. **The insert tool** (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:485-489`): *"Inserts one unit from
   the catalog between two units of **a row** of an existing group. between names the two
   **neighbouring** root modules, in either order. … To add a unit at the end of a row, use
   merge-article-into-group."* Nothing says that the group can be anything (a wardrobe), that the
   unit can be of another kind and height than its neighbours, that the user decides what stands
   between what, or that a group of two units has exactly one place to insert.
3. **The other descriptions and the rules** speak of kitchens, units and rows throughout
   (`create-or-replace-groups`: "Author one kitchen as ONE group"; the rules: "One kitchen is one
   group", "Extending a kitchen …", `hi-mcp-server.ts:9, 23, 25, 66`).
4. **Nothing tells the model to decide the article itself** when the user names a kind, not an
   article ("a low cabinet"). The system prompt says "Call tools instead of describing what you
   would do", and the RML-18041 and RML-18045 test runs already met the ask-back for "a 900 mm
   cabinet with drawers" (fixed in the rules, which gpt-5.4-mini does not read).

### What the models made of it

Each failure is a different reading of the same gap:

- *The group is not a kitchen, so it is not the "high cabinets".* gpt-5.4-mini: "a tall
  wardrobe/closet block, not a kitchen row"; mistral-medium 1: "not part of a kitchen setup" — and
  it **replaced the wardrobes by kitchen tall units** to make the request fit the kitchen it was
  told to plan. The user's gpt-6-astra: "no single group in the plan that represents that whole
  high-cabinet arrangement", "no proper 'high cabinet run'".
- *A base unit does not go between tall units.* mistral-medium 1: "base units and tall units are
  typically not mixed in the same row"; mistral-medium 2: "not feasible due to their height
  mismatch" — both rebuilt the group with `create-or-replace-groups` instead. The user's
  gpt-6-astra chose `merge-article-into-group`, "adding a cabinet onto the end of an existing run".
- *"Between the high cabinets" is between groups.* gpt-5.4-mini (E1 run 2): "there isn't a second
  high-cabinet group in the plan to insert between".
- *Which low cabinet?* gpt-5.4-mini (baseline 1, E1 run 3, E2 run 1): "If you want, I can add …",
  "which exact 'low cabinet' should I insert?", "not enough instruction to choose the exact cabinet
  type".

The server's corrections never got a chance: no model sent a wrong `insert-article-into-group`
call, they sent other tools or nothing. Every model that reached the tool (gpt-5-mini, the user's
turn 4, mistral-medium under E1) sent the right two roots and got the right result without a
correction — the gap is before the call, in what the served text says.

## Root cause

**The instructions describe a kitchen row, and the user's words name neither a kitchen nor a row.**
Per [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), wrong content from an
agent is an instruction problem, and the instructions at fault are:

| # | Instruction | File | Why it misleads |
|---|---|---|---|
| 1 | "a HOMAG Intelligence (HI) kitchen" | `hi-mcp/hi-mcp-chat/chat-config.ts:13`; ligna-store `hi-mcp/chat.ts:12` | A closet group reads as "not a kitchen": the model looks for a kitchen run of high cabinets, finds none, and either stops or converts the wardrobes into kitchen units |
| 2 | "between two units of a row … the two neighbouring root modules" | `hi-mcp/hi-mcp-server/hi-mcp-server.ts:485-489` | "Row" and "neighbouring" are read as a kitchen row of like units; nothing says the unit may differ in kind and height, that a two-unit group has one between, or that the user decides what stands between what — so the models invent a feasibility rule (height mismatch) and take another path (merge at the end, rebuild, exchange) |
| 3 | kitchen vocabulary everywhere, no mapping of the user's words | `hi-mcp-server.ts:9, 23, 25, 66-67` | "high cabinet" (Hochschrank) and "low cabinet" (Unterschrank) are the words users use; the catalog and the instructions say tall unit, wardrobe, base unit — the models that do not call `get-authoring-rules` get no help, and the rules give none either |
| 4 | no instruction to choose the article | `chat-config.ts:12-17` | "a low cabinet" names a kind; gpt-5.4-mini asks which one instead of taking the closest article of the catalog |

Not a root cause: the tool's code, the planner command, the plan context (the two roots are docked
side by side and the context shows it), the user's plan (built in the planner, loads and edits
correctly). The served text is part of the server, and that is where the fault is.

The evidence for the four instructions comes from gpt-5.4-mini and mistral-medium, which fail on
them in every run and say so in their answers, and from the wording of the user's gpt-6-astra
transcript, which matches those answers; gpt-6-astra itself did not fail in the reproduction (five
of five). The experiments below show which change moves which model.

## Experiments: which instruction change makes the models act

Each experiment runs the same prompt on the same plan, several runs per model, with a temporary
change of the committed instructions (reverted after the analysis; the diffs are the proposed fix
below). "insert" = one `insert-article-into-group` call with the two wardrobe roots and a base unit,
nothing else changed.

| Experiment | Change | gpt-6-astra | gpt-5.4-mini | mistral-medium |
|---|---|---|---|---|
| baseline | — | **5 of 5 insert**, correct (`LB_UB600`) | 0 of 2 insert (no edit, no edit) | 0 of 2 insert (rebuild ×2, one with the wardrobes replaced) |
| E1 | system prompt: "HOMAG Intelligence (HI) furniture …: kitchens, closets, living room and utility furniture" | not run | 0 of 3 insert (no edit ×3: "no clearly identified 'high cabinets' kitchen run"; "there isn't a second high-cabinet group … to insert between"; "which exact 'low cabinet'?") | **2 of 2 insert**, correct, one call each |
| E2 | E1 + the insert tool description: "between two units of an existing group that stand side by side - whatever the group is (a kitchen, a wardrobe, a sideboard) and whatever the unit is: a base unit between two tall units or wardrobes too; the user decides what stands between what. between names the two root modules, in either order; a group of two units has one place to insert: between them" | **2 of 2 insert**, correct — with a sideboard base `SB_UB600` instead of the lowboard base: the description's example "a sideboard" steered the article choice | 0 of 3 insert (no edit: "not enough instruction to choose the exact cabinet type"; `exchange-root-module` of one wardrobe by a drawer base unit — "not fully in the plan yet, because there is still only one high cabinet left"; no edit after `find-attributes` ×3: "I still need the exact low-cabinet article") | **2 of 2 insert**, correct, one call each |

gpt-5.4-mini never calls `get-authoring-rules` and runs without reasoning effort (0 reasoning
tokens in every step, as in the user's `npm start`); it recognises the two docked tall cabinets in
every run and still does not act, or acts with another tool. Its remaining failure is the choice of
the article and of the tool, not the kitchen framing — the system prompt sentence of fix 4 is
aimed at it.

## Proposed fix

Instruction changes only — step 1 of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort);
no guard, no correction: the server does not see the user's words, and every call that reached the
tool was right.

1. **The system prompt names what HI plans** (`chat-config.ts:13`, and the ligna-store copy):
   "You are a planning assistant for HOMAG Intelligence (HI) furniture in a Roomle planner:
   kitchens, closets, living room and utility furniture." — the E1 change. It turned
   mistral-medium's rebuilds into one correct insert.
2. **The insert tool says what it inserts where** (`hi-mcp-server.ts:485-489`): the E2 text above,
   without the list of group kinds, because an example article kind in a description steers the
   article choice (gpt-6-astra took a sideboard base under E2): "Inserts one unit from the catalog
   between two units of an existing group that stand side by side, whatever kind the group and the
   unit are — a base unit between two tall units too; the user decides what stands between what.
   between names the two root modules, in either order; a group of two units has one place to
   insert: between them. …" The served-text unit tests pass with the E2 text
   (`hi-mcp-server.test.ts`, 40 tests); the final wording is run through the same prompt again
   before it is committed.
3. **The rules take the user's words** (`hi-mcp-server.ts:25`, beside "Take the user's word: to
   remove …"): "a high or tall cabinet or a wardrobe is a tall unit (mod_TypeElement TallUnit), a
   low cabinet a base unit; a group is edited the same way whether it is a kitchen, a closet or
   living room furniture, and any unit goes between or beside any units — the user decides".
4. **The chat tells the model to choose** (`chat-config.ts`, one sentence): "When the request
   names a kind of unit, not an article, take the closest article of the catalog and say which one
   you chose instead of asking." — gpt-5.4-mini asked back in five of its eight runs, under every
   variant.
5. **A test for the case** in `docs/test-prompts.json` (see below), run with the models the user
   uses, not only gpt-5-mini.

Documentation in the same change: [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md) §4
(the chat's system prompt) and §6 (the insert tool), `.agents/skills/hi-mcp-tools.md`,
`minimal-hi-example/docs/hi-mcp-server.md`, `docs/test-prompts.md`; the ligna-store's `hi-mcp/chat.ts`
and its README line about the chat.

### Considered and rejected

- **A server correction** — impossible: the server sees tool calls, not the prompt; a merge at the
  end of the row or a rebuilt group is valid input that another user may want.
- **Passing the server instructions to the chat model** — would put the rules in front of
  gpt-5.4-mini, but the chat deliberately leaves them to `get-authoring-rules` (behaviour §4), and
  the gap is in the tool description and the system prompt, which every model sees.
- **Reasoning effort for the GPT deployments** (`HI_CHAT_REASONING_EFFORT`) — gpt-5.4-mini ran with
  none in every run, as in the user's `npm start`; a model setting is not an instruction fix and
  does not reach mistral.

## Is a case like this tested in `docs/test-prompts.json`?

**No.** The two insert tests name both neighbours, run on kitchen plans and are evaluated with
gpt-5-mini, the model that passes here too:

| Test | Plan | Prompt | What it does not cover |
|---|---|---|---|
| `edit-insert-unit` | Three Tall Units (three `HTB60` kitchen tall units) | "insert a cabinet with drawers between the first and the second unit" | the pair named collectively ("between the high cabinets"), a unit of another height, a non-kitchen group |
| `edit-insert-below-wall-units` | Corner Kitchen with Wall Units | "insert a base unit with drawers between the hob unit and the sink unit" | the same — both neighbours are named, and the base unit goes between base units |

No test plan holds a closet, living room or utility group: the Closets plan's image shows a bedroom
without an HI group, and every edit test starts from the Three Tall Units or the Corner Kitchen.
No test uses the words "high cabinet" or "low cabinet". The models of the file are gpt-5-mini,
gpt-5.4-mini and gpt-6-astra, but the row edit tests of 2026-10-05 ran with gpt-5-mini only.

**Proposed test** — a new plan and one test:

- plan `two-wardrobes-right-wall`: `ps_r22qpwv9ks87lz1gnrcz1ewv7q8uq3v` — the Default Room with
  one closet group of two `KS_HT600` wardrobes against the right wall, group
  `7964fd01-200f-44d1-b4f6-38d792d73c56`, roots `65866076-3967-40a1-a9c1-217a13bc21a0` (towards
  the back wall) and `3b4bdb6f-36b1-4324-9c79-1509dee9ec36` (towards the door); it loads and edits
  as it is (the runs above);
- test `edit-insert-low-between-high`: prompt "insert a low cabinet between the high cabinets",
  expect "one insert-article-into-group call between the two wardrobes with a base unit (e.g.
  UTB60): one group of three, the wardrobes keep their article, no new group, no replace, no
  exchange; the group's pos stays [4815, 0, -2563.1]".

Run it with gpt-6-astra and mistral-medium as well as gpt-5-mini: the failure is model-dependent,
and gpt-5-mini alone would have passed it before the fix.

## Close-out (2026-10-06)

**Status: Fixed** on `feat/hi-row-edit-tools-RML-18045`. The review of the analysis set the
direction: the served text is the server, and it spoke of kitchens, units and rows where the user
speaks of articles and cabinets. Everything consists of articles; an article in a group is a root
module; a group is any piece of furniture; insert works between two articles, not on a row (D44 in
the [behaviour reference](../../hi-mcp/docs/hi-mcp-behaviour.md)).

### What changed

- **The served rules** (`hi-mcp-server.ts`): a first bullet with the words — the catalog offers
  articles; a group is one piece of furniture made of articles (a kitchen, a wardrobe, a sideboard,
  a utility room); an article placed in a group is a root module; the kinds by the catalog's
  category and dimensions (a high or tall cabinet or a wardrobe about 2000 mm, a low cabinet or
  base cabinet 720 mm); the user decides which articles stand next to each other. "One piece of
  furniture is one group", "Extending a group", the command tools in root modules, "a desc says
  what an article is, not where the user may put it", "two root modules that name each other with
  RightBottom -> LeftBottom stand side by side", and Example 6 in the user's words: "insert a low
  cabinet between the high cabinets". "kitchen" is left in the list of kinds, the corner rules and
  Example 3 (5 occurrences, 16 before); "unit" only as a kind (tall, base, wall, floor unit).
- **The instructions** open with what everything is made of.
- **The tool descriptions** speak of articles and root modules, none of a kitchen. The insert
  tool: "between two root modules of an existing group that stand side by side - whatever the group
  is and whatever the article is: a low cabinet between two high cabinets or wardrobes too; the
  user decides what stands between what. … a group of two root modules has one place to insert:
  between them. No gap is needed - the tool makes room"; `merge-article-into-group` points to it.
- **The chat's system prompt** (`chat-config.ts`): "HOMAG Intelligence (HI) furniture in a Roomle
  planner: kitchens, wardrobes, living room and utility furniture, all made of articles", and a
  fifth sentence: take the closest article of the catalog when the request names a kind, and say
  which one, instead of asking.
- **Tests**: the served-text expectations follow the wording; a new test pins the words, the insert
  description and that no tool description says "kitchen"; the chat prompt test pins the first
  and the fifth sentence.
- **The MCP test**: plan `two-wardrobes-right-wall` (the user's plan) and the test
  `edit-insert-low-between-high` with the user's prompt, in `docs/test-prompts.json` and
  [test-prompts.md](../../docs/test-prompts.md).
- **Docs**: the behaviour reference (D44, D14, D36, §4, §5.1, §5.2, §6), the skills
  (`hi-mcp-tools.md`, `hi-authoring-rules.md`, `roomle-hi-concepts.md`), the tool references in
  `hi-mcp-server.md` and the server README.
- **Not changed**: the ligna-store's copy of the system prompt (`hi-mcp/chat.ts:12`, "a HOMAG
  Intelligence (HI) kitchen") — the same one-line change in that repository.

### Validation

Unit tests: 438 pass (`hi-mcp`), typecheck, prettier and oxlint clean.

Live, the user's plan and the user's prompt against the local planner
(`.temp/result/verify-insert-wording-2026-10-06_08-13-19/`), every run one
`insert-article-into-group` call with the two wardrobe roots and a base cabinet, the group's `pos`
unchanged at [4815, 0, −2563.1], no correction:

| Model | Runs with the new wording | Result |
|---|---|---|
| gpt-6-astra | 4 | insert, `LB_UB600` (a lowboard base) |
| mistral-medium | 4 | insert, `UTB60` |
| gpt-5.4-mini | 5 with the sentence "No gap is needed - the tool makes room" | insert, `US2A60`, `U2TB90` — it reached the tool in none of 3 runs without that sentence (a rebuild with the group moved 600 mm, a stray group, a `change-module-attribute`; "I'd need a valid 'between' target formed by two side-by-side root modules … with a gap") |

Regression, the existing tests with gpt-5-mini: `kitchen-back-right-corner`, `edit-add-one-unit`,
`edit-insert-unit`, `edit-remove-unit`, `edit-insert-below-wall-units` — 5 of 5 pass as before. One
side effect was caught and fixed in the same change: with the kitchen framing gone, "a cabinet
with drawers" between kitchen tall units became a wardrobe with drawers (`KS_HT600S4`) from the
closet category; the rules and the chat prompt now say that an article named by its kind comes
from the category of its neighbours where that category has one, and the test picked the kitchen
tall drawer cabinet `HTS2AB60` again in 2 of 2 runs.

### What remains

- The ligna-store's system prompt line (`hi-mcp/chat.ts:12`, "a HOMAG Intelligence (HI)
  kitchen"), in that repository.
- The new test `edit-insert-low-between-high` has not run through the test runner yet; the
  runs above are the same prompt on the same plan through `run-hi-mcp-prompt.js`.
