# Planning Assistant: the attribute information the agent gets

> **Type**: Feature analysis — the ticket's idea "Attribute indexing: should all the attributes,
> complete with their descriptions and information, be included in the plan context?", held
> against the code, a measurement without a model and the retained runs
> **Status**: Open — the question answered ([§5](#5-what-the-agent-needs-and-when)); the two-level
> design proposed, the same for every library, accepted only after its measurement
> ([§6](#6-the-proposed-design-two-levels), [§10](#10-decisions-to-take))
> **Date**: 2026-10-27
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-ui `feat/hi-mcp-merge` at a8fe64618 (`hi-mcp/agent-facing.ts`,
> `hi-mcp/tool-executors.ts`, `hi-plan-context.ts`, `hi-tool-attributes.ts`, `hi-mcp-server.ts`,
> the planning assistant of the embedding-lib); roomle-hi-example `master` at 8bc6329 with
> `@roomle/embedding-lib@0.0.0-dev-1b4351d`; the library Furniture_Smith as the example loads it
> **Data**: the sections of `get-plan-context` read without a model from the example page on the
> local planner, kept in `.temp/result/attribute-information-probe-2026-10-27/`
> (`probe-attributes.mjs`, `sections/*.json`); the master data in
> [docs/library-information/master-data.json](../../docs/library-information/master-data.json); the
> "test the mcp" session `.temp/result/mcp-test-2026-10-27_07-11-41` (gpt-6-astra on Azure, 79 runs,
> their `planner-calls.json` and `plan-context.json`); [the baseline](../benchmarks/baseline-iklw-az-2026-10-27.md)

## Affected repositories

- **roomle-ui** — with the proposed change: the `attributes` section and the library reference
  (`hi-mcp/agent-facing.ts`, `hi-mcp/tool-executors.ts`), `find-attributes` for several attributes
  in one call (`tool-executors.ts`), the served text (`hi-mcp-server.ts`), their tests; the rows D76
  and D100 of `.agents/homag-intelligence/hi-tools-behaviour.md` and `hi-tools-reference.md`. No
  change is proposed for the library as it is today.
- **roomle-hi-example** — this analysis; the row "Selective retrieval" of
  [the levers that do not shorten the response time](../wiki/planning-assistant-response-time-targets.md#levers-that-do-not-shorten-it); the attribute
  paragraph of [library-issues.md](../backlog/library-issues.md), corrected; the benchmark that
  would decide the design.
- **HOMAG library** — the descriptions of the attributes and their values, through
  [library-issues.md](../backlog/library-issues.md) ([§10](#10-decisions-to-take)).

## 1. What was asked

The ticket's idea "Attribute indexing", in its description now: should all the attributes, complete
with their descriptions and information, be included in the plan context? The concern is growth:
not every attribute and value has a proper description yet, and once they have one, the
information can become huge. The questions: what information does the agent get about the
attributes, how many tokens does it consume, what does the agent need and when — all of it from the
beginning, or the possibilities first (what can be changed) and the details later (how)?

The time-to-first-attempt analysis evaluated the idea for the response time only — `find-attributes`
answers in 13 ms, no kitchen creation calls it — and found nothing to save there. This analysis
answers the size question.

## 2. What the agent gets today

**The attribute vocabulary** is the `attributes` section of `get-plan-context`, a default section
(D76 of roomle-ui `hi-tools-behaviour.md`): per library every attribute of the compacted master
data (D100) — `compactAttribute` keeps `id`, `name`, `desc`, `type`, `group` and `selections`
(`hi-plan-context.ts`), `agentFacingAttributes` lists a value list several attributes share once,
the later attributes naming the lister as `sameSelectionsAs` (`agent-facing.ts:198`, `:293`); the
element type stays out (`isAgentFacingAttribute`, `:223`). A value is `value`, `name` and `desc`;
no image URL reaches the agent. The modules with their attribute ids and the group settings stay in
`masterData`, on request.

**The planning assistant sends it with every turn**: its library reference is `get-plan-context`
with `articles` and `attributes` (`hi-planning-assistant.ts:239`), one user-role message before
the history, in the shared prefix of every request of the turn (ADR 0014); the assistant reads it
afresh per turn, the provider reads it from its cache.

**The catalog names the attributes a root module carries**: each article's root modules list their
`dimensions` (the size attributes with their values) and `mainAttributes` (id, name, value) —
`agentFacingArticle` (`agent-facing.ts:305`). In Furniture_Smith the catalog's `mainAttributes`
name 11 attributes, the `dimensions` 10.

**The served text** says where the ids and values are and how to use them: the authoring rule on
attributes (`hi-mcp-server.ts:21` — the attributes section holds every attribute with its values,
`sameSelectionsAs`, the colour code in a value's desc, `find-attributes` for a question about one
attribute), the description of the section (`:344–352`) and of `find-attributes` (`:400–415`: "the
attributes section already holds every attribute with its values, so a planning needs no search").
The image skill asks to read the fronts, handles, worktop and carcase from the image and set them
as group attributes "with the values the attribute vocabulary of the plan context offers"
(`skills/image-planning/SKILL.md:42`).

**The details come back with every result.** A value the article does not take is left out and
the result names the values it takes — `takenValuesText`: "the values it takes: "152", "155"; and,
changing another attribute with them, "214"" or "it takes 300 to 600 in steps of 10"
(`hi-tool-attributes.ts:320`) —, on a create before the load (`checkRootOverrides`, `:473`, called
from `hi-tool-commands.ts:649`), on the group attributes (`applyGroupWideAttributes`, `:665`) and
on every edit; a value the library changes along is named with its desc (D59). So the agent
learns the values of an attribute it set wrong without a round of its own.

## 3. What it costs

The sections as the agent gets them, read from the example page with Furniture_Smith (111
articles, 397 attributes after the element type is left out). Tokens are estimated at 4.53 bytes
per token, the ratio of a first request without an image to its input tokens in
[benchmark 06](../benchmarks/06-az-skill-2026-10-27.md) (339,691 bytes, 74,990 tokens):

| Section | Bytes | Tokens (estimate) | Share of the library reference |
|---|---|---|---|
| `attributes` | 121,067 | about 26,700 | 51 % |
| `articles` | 116,467 | about 25,700 | 49 % |
| `articles` + `attributes`, the library reference | 237,533 | about 52,400 | 100 % |
| `articleDescriptions`, on request | 86,455 | about 19,100 | — |
| `masterData`, on request | 200,352 | about 44,200 | — |
| `rooms`, `groups`, `obstacles`, `installationElements`, the plan state (default room) | 4,822 | about 1,100 | — |

The attributes section is half of the library reference and about a third of a first request's
input (79,080 tokens in the baseline: the system prompt and the authoring rules, the library
reference, the plan state, the user message and the image; the tool definitions, 43,622 bytes, are
sent beside the input).

**What is in the 121,067 bytes:**

| Part | Bytes | Count |
|---|---|---|
| The attribute headers — id, name, desc, type, group, `sameSelectionsAs` | 60,466 | 397 attributes; 152 bytes each |
| — of it the attribute descs | 15,860 | 57 descs repeat the name |
| The value lists | 58,026 | 795 values in 153 lists; 73 bytes per value; 59 attributes share a list |
| — of it the value descs | 18,848 | 24 values without a desc |

185 attributes have no value list: 146 of them are dimensions (`Dim`), which the library checks
against a range when a value is set. The largest attributes are the value lists: a handle position
type with 22 values (2,971 bytes), colour lists with 21–26 values (1,500–1,900 bytes each), a
handle length with 46 values. The master data holds 1,495 values before the sharing; the sharing
halves them.

**Where the cost falls.** The prefix is read from the provider's cache: the first call of a fresh
conversation reads 79,077 of its 79,080 input tokens from the cache (the baseline), later calls
about 97 %. The prefill of input costs about 13 ms per 1,000 tokens
([kitchen-from-image-time.md](../benchmarks/kitchen-from-image-time.md)): the attributes would cost
about 0.35 s per call uncached, and cached much less — not measurable in the benchmarks. What the
section costs today is the context: a third of every request, in every call of every turn.

**How it grows.** The size of the section is the library's: the number of attributes and values
times the length of their names and descriptions. The server does not bound it. The descriptions
are meant to grow — the library data, and in it the `desc` properties, is the only source of
library information the tools serve (§2.4 of `hi-tools-behaviour.md`), so what the agent lacks
goes into a desc. The numbers above are one library in one state of its descriptions: 57 attribute
descs repeat the name and 24 values have none, because they have not been written yet. In the
measured library, a description of the length the width attribute has — 205 characters, with the
guidance the agent needs — on every attribute adds about 65 KB (about 14,000 tokens); value
descriptions grow the lists the same way. A second library doubles the section, since the
vocabulary is per library. 80 of the 397 measured attributes belong to module types no kitchen
article of the loaded catalog uses — mirror boards, coat boards, clothing organizers, ceiling
fillers, shelves —, 18.5 KB.

## 4. What the agent uses, and when

The 79 runs of the test session (gpt-6-astra, 99 turns, 49 creates, 39 attribute changes), from
their recorded tool calls:

| Measure | Value |
|---|---|
| Distinct attributes the agent set | 47 of 397 — 24,720 bytes of the section with their lists, 20 % |
| Distinct values it set | 154 of 795 |
| Creates with group attributes | 42 of 49 |
| Root modules with attributes | 180 of 278 |
| `find-attributes` calls | 0 — also in the test that asks which front colours there are, which the agent answered from the section, correctly |
| Attributes changed after a create | 8, in 39 calls |

**Before the first kitchen**, in the create payload, the agent sets:

- **the look of the group** — group attributes in 42 of 49 creates: the front program and colour
  (40 each), the carcase colours (41 and 37), the worktop colour (18) and thickness (6), the plinth
  height (17), the toekick colour (16), the handle design (15) and colour (12), programs of the
  panels and uprights; 28 distinct ids;
- **per root module** — the hinge side of the doors (118 roots, the rule of the authoring rules),
  the sizes width, depth and height (98, dimensions without a value list), the insertion height,
  the appliance supplier and model of hobs, ovens, hoods and sinks (hob 12, sink 6, oven 5, hood
  5), the generation flags of the toekick and the worktop; 30 distinct ids.

**After the first kitchen and in the edits**: 8 attributes in 39 calls — the hinge side, the width,
the front colour, the sink model, the backsplash flag, the height, the front program, the handle
design. **For a question**: the one test, answered from the prefix.

The look needs the value lists at the moment of the create — the colour codes in the value descs
are what the agent tells light from dark by, and the image skill asks for the closest value of the
vocabulary. The sizes need no list: the library's range comes back with a wrong value. The
appliance models need their lists in a quarter of the creations. Everything else — 350 attributes
— the agent needs when the user asks for that change, in an edit turn.

The library's own marks do not single out this set: `isMain` marks 65 attributes (24 KB with
their lists) and covers 22 of the 47; `userRight` `Simple` marks 89 (32 KB) and covers 32 — the
handle colour, the plinth design, the carcase and toekick programs, the opening type and the
generation flags are outside both. That is why D100 rejected a filter by the user right.

## 5. What the agent needs, and when

**All of it from the beginning is not needed.** At the create, the agent needs the ids and the
values of the attributes that make the look of a kitchen — about 10 to 15 attributes with their
value lists, 11 KB with the shared lists — and the ids of the sizes; the existence of every other
attribute — its id, name and desc — so that it knows what can be changed; the values of those only
when a user asks for that change, in an edit turn, where one lookup costs a round of about 3.5 s
against the 20–40 s of the final result, while before the first kitchen a round is a third of the
10 s target ([the targets](../wiki/planning-assistant-response-time-targets.md)).

**The design has to hold for every library and every state of its descriptions.** That the full
section of the measured library fits the cached prefix and costs no round is a property of one
library's present state — its descriptions not yet written —, not of the design: the server
cannot bound the section, and the descriptions are meant to grow (§3). What holds for every
library is the structure of the need: the attributes and values a planning sets at the create are
a small part of the vocabulary, and the library's structure marks them — the catalog's
`mainAttributes`, the group settings, the generated root modules; every other attribute is needed
in an edit, where a lookup round fits the targets. So the agent gets, for every library, what can
be changed from the beginning and how it can be changed when it changes it — the design of §6.

## 6. The proposed design: two levels

**Level 1, in the prefix — what can be changed.** The `attributes` section lists every attribute
with `id`, `name`, `desc`, `type`, `group`, as today, and keeps the value lists of the attributes
the library's structure marks as the ones a planning sets: the attributes the catalog's
`mainAttributes` name, the group settings and the attributes of the generated root modules (the
worktop, the toekick, the backsplash, the panel top) — a structural criterion, the same for every
library, not a choice of attributes by name (§2.4 of `hi-tools-behaviour.md`). Every attribute
that shares one of those lists keeps `sameSelectionsAs`. Every other attribute with a value list
carries the number of its values instead of the list, and a dimension its type as today. In
Furniture_Smith: 57 attributes mark the level, 26 lists stay (10,938 bytes), the headers stay
(60,864 bytes): about 72 KB instead of 121 KB, about 16,000 tokens instead of 26,700. The articles
section stays as it is.

**Level 2, on request — how it can be changed.** `find-attributes` answers several attributes in
one call — by ids as well as by text —, so that a turn that needs the values of three attributes
spends one round, not three; its description says that the values of an attribute without a list
in the section are one call away. The results of the create and the edits keep naming the values
an attribute takes when a value is wrong (§2), so a guessed value costs no round: the group is
built, the result says what to send.

**What it saves.** What every request carries is bounded by the library's structure: the level-1
part grows with the attributes and their descriptions, the value lists of the attributes a
planning does not set at the create no longer reach the prefix, however many values and value
descriptions a library has. In the measured library about 11,000 tokens of the cached prefix per
call, a fifth of the first request; with complete value descriptions or a second library, more.

**What it costs and risks.** Of the 37 list attributes the agent set in the session, 17 would have
no list in the prefix — the appliance models and suppliers, the plinth height and design, the handle
colour and position, the carcase programs, the opening type. A creation that sets them either
guesses — the result then names the values, and the group stands with the article's value until
the next call —, or looks them up first: one round before the first kitchen in a part of the
creations (a quarter of the session's creates set an appliance model). Against the 10 s target for
the first kitchen that round is the risk the measurement has to show or exclude. The change is in
the planner and the served text; the embedding-lib's reference read is unchanged.

**The measurement.** The baseline's protocol on the Azure deployment: the image kitchen and the
walnut kitchen, two repetitions each, plus the two creations of the session that set appliance
models, on the planner with the two-level section. Accepted when the kitchens keep their look —
the same values of the front, carcase, worktop and handle attributes as the baseline —, the first
kitchen stays at call 2 in every run, no run spends a round on `find-attributes` before the create,
and the input tokens of the first call drop by the section's difference; rejected when a creation
needs the lookup round before its first kitchen.

## 7. Alternatives, rejected

| Alternative | Why not |
|---|---|
| Every attribute with its values in the prefix, as today | Its size is the library's and grows with the descriptions, which the library-neutral policy makes the only source of library information; the server cannot bound it, and what fits one library's present state is no design for every library |
| Leave the section out of the prefix; the agent searches | A model that had to search spent 1.5 search-only steps and 12.5 s per run (D76); the look of a kitchen needs the values at the create |
| The raw master data in the prefix | 200 KB, the attributes with image URLs and the modules; the compact vocabulary already duplicates nothing ([the shared-reference benchmark](../benchmarks/planning-assistant-prompt-caching.md)) |
| Only the attributes the library marks `isMain` or `Simple` with values | The marks miss attributes the agent sets — the handle colour, the programs, the generation flags —, and D100 rejects a filter by the user right: the server cannot know which attribute a user asks for |
| The colour, program, handle and plinth attributes by name | A choice of library content in the server (§2.4), rejected in D76 |
| Only the attributes of the module types the loaded catalog uses | The generated root modules the library adds — the worktop, the toekick, the backsplash — are not in the catalog but carry attributes the agent sets; with them included, 80 attributes (18.5 KB) go — a smaller lever than the value lists, and a second filter to keep right |
| The value names in the prefix, the codes resolved by the server | The agent sends a name, the server maps it to the value — step 2 of the guards policy; but the colour codes in the value descs are what the agent tells colours by, and a name without its desc loses them |
| Shorter descriptions | The descriptions are the library's and authoritative; the server shortens article descriptions to two lines (D63) because the article catalog is picked from, while a value's desc is read once per set value |
| Retrieval per request (RAG) | Breaks the shared prefix and adds a step per request; rejected in the time-to-first-attempt analysis for the response time |

## 8. Code and documents the work would touch

| Repository | Code | Documents |
|---|---|---|
| roomle-ui | `hi-mcp/agent-facing.ts` (`agentFacingAttributes`: the level of an attribute from the catalog's `mainAttributes`, the group settings and the generated root modules; the count instead of the list), `hi-mcp/tool-executors.ts` (`get-plan-context`, `find-attributes` by ids and for several attributes), `hi-mcp/hi-mcp-server.ts` (the rule on attributes, the descriptions of the section and of `find-attributes`), `__tests__/hi-mcp/tool-executors-test.ts`, `hi-mcp-server-test.ts`, `test-helpers/unit/hi-mcp-fixture.json` | `.agents/homag-intelligence/hi-tools-behaviour.md` (D76 and D100 reworded, a decision row), `hi-tools-reference.md` |
| roomle-hi-example | the benchmark of §6 | this analysis; the time-to-first-attempt analysis; `.agents/skills/hi-mcp-tools.md` (`get-plan-context`, `find-attributes`); `docs/user-guide` where it names the attributes section |

## 9. Measurement gaps

- The tokens are estimated from bytes with one ratio; the provider's tokenizer counts JSON
  differently per section (ids and codes tokenize worse than prose). The order of magnitude holds.
- The session is one model, gpt-6-astra, on 79 prompts of the test suite; another model or other
  prompts set other attributes. The 47 attributes are what this suite asks for, not a bound.
- Whether the size of the section slows or misleads the model is not measured: the find-attributes
  test answered correctly from the section, and the creations set the right look in the baseline;
  a comparison of the planning quality with and without the lists is the measurement of §6.
- The growth figures are extrapolations from Furniture_Smith's shape; a library with longer lists
  or more shared lists grows differently.

## 10. Decisions to take

1. **The two-level design** — recommended. It bounds what every request carries by the library's
   structure, not by one library's present state; it keeps every attribute visible to the agent
   (D100) and chooses no attribute by its name or content (D76, §2.4). D76 and D100 are reworded:
   every attribute is in the section, the value lists of the attributes a planning sets at the
   create, the others through `find-attributes`.
2. **Its acceptance is the measurement of §6**, four to six paid runs on the baseline's protocol:
   whether a creation needs a lookup round before its first kitchen. If it does, the level-1
   criterion is what to revise — still structural —, not a return to every list in the prefix.
3. **The descriptions are the library's to complete**: in the measured library 57 attribute descs
   repeat the name and 24 values have none, so the agent reads the names there. Complete
   descriptions are wanted, and the two-level design keeps them affordable — an item for
   [library-issues.md](../backlog/library-issues.md), whose attribute paragraph this analysis
   corrects to what the vocabulary serves (every attribute, D76 and D100).
