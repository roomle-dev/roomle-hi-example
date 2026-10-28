# The description of the sink unit names the wrong side for its drainer

> **Type**: Bug analysis — the sink of an image kitchen reaches over the hob; whether the
> descriptions of the sink articles can prevent it
> **Status**: Open — the cause is in the library data; the descriptions of [§6](#6-the-fix-the-descriptions)
> are in the library (checked 2026-10-28), one value desc pasted with its table row; the test of
> the agent is open ([§9](#9-verification-of-the-library))
> **Date**: 2026-10-27
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-ui `feat/hi-mcp-merge` at 4415cdffd (the two-level attribute section, D122);
> the Furniture_Smith library of `HI_PRE_Roomle_Milestone_2` as the backend serves it on 2026-10-27
> **Data**: benchmark 09 and its baselines
> ([09 image kitchen](../benchmarks/09-iklw-az-attrs-2026-10-27.md),
> [baseline](../benchmarks/baseline-iklw-az-2026-10-27.md)); the live article list and master data
> and a model-free probe of every sink unit and sink value, kept in
> `.temp/result/sink-analysis-2026-10-27/` (`live/`, `probe-sinks.mjs`, `sinks.json`,
> `draft-descs.mjs`, `draft-descs.json`)

## Affected repositories

- **HOMAG library (Furniture_Smith)** — the descriptions of the five sink units and of `mod_SinkId`
  and its values; the fix ([§6](#6-the-fix-the-descriptions)), through
  [library issue 21](../backlog/library-issues.md#21-the-description-of-sut60-names-the-drainer-on-the-right-its-sink-reaches-over-the-unit-on-its-left)
  and [the suggested library changes](../../docs/library-information/suggested-library-changes.md#11-sink-base-units).
- **roomle-hi-example** — this analysis, the library issue and the suggested texts; the test that
  checks the fix once the library carries it.
- **roomle-ui** — nothing for the fix. A structural option that brings the sink values back into
  the prefix is named in [§7](#7-alternatives).

## 1. Symptom and reproduction

In benchmark 09, image-kitchen-left-wall, run 2 ends with the sink over the hob: the row is
`HK260`, `USTB60`, `UHS60`, `SUT60`, `UTB60`, and the sink of `SUT60` reaches 410 mm over `UHS60`,
the oven-and-hob unit on its left. Run 1 built the same row, saw the overlap in its render and swapped
`SUT60` with `UTB60` — 40.742 s of rounds. Both baselines put `SUT60` at the end of the row, with
`UTB60` or the dishwasher `GSP` on its left, and set `mod_SinkId` `Axis_R`; their sinks reach over that
unit, which is harmless.

Reproduce: `.temp/result/benchmark-09-az-attrs-2026-10-27/iklw-rep-2` (plan
`ps_t26104gn9m11h4qy8df24p5pfeh4sx2e`), the obstacles of its plan context: the outline of `SUT60`
spans y 1150–2160, its neighbour `UHS60` 960–1560.

## 2. What the agent reads about the sink

At the create the agent reads the catalog's description of `SUT60` — all of it: its sections stand on
one line each, and the catalog's shortening to `FUNCTION` and `AI_SELECTION_HINT` (D63) takes a
section's text from the line after its name. Among its lines:

```text
FUNCTION: Sink base unit, 60 cm wide, with 1 hinged door. Its sink with the drainer is 980 mm wide and reaches 396 mm past its right side, over the unit on its right.
AI_SELECTION_HINT: Select when the user requests a sink or washing area. Place a base unit on its right, not a hob unit.
```

and the header of `mod_SinkId` in the attributes section: "Article code of the sink". The values of
`mod_SinkId` — "Blanco Metra sink: basin on the right, drainer on the left" — are not in the prefix
since D122 (`valueCount` 12, an attribute of the sink sub module `mf_Sink`); in the baselines they
were. Run 2 followed the hint word for word: a base unit on the right of the sink unit, the hob unit
on its left.

## 3. How the library builds the sink

Measured without a model on the local planner: a row `UTB60` | sink unit | `UTB60` at the back wall,
the sink unit's outline beyond its neighbours (`sinks.json`).

| Sink unit | The sink it comes with | Reaches past |
|---|---|---|
| `SUT60` | `Metra_R`, basin right | **its left side, 410 mm** |
| `SUBA60`, `ESUT60` | `Axia_Grey_L`, basin left | its right side, 395.8 mm |
| `SUB2A90`, `ESUB2A90` | `Axia_Grey_L`, basin left | its right side, 245.8 mm |

Every value of `mod_SinkId` on `SUT60` (60 cm) and `SUB2A90` (90 cm):

| Value | Reaches past a 60 cm unit | Reaches past a 90 cm unit |
|---|---|---|
| `Axia_Grey_L`, `Axia_White_L`, `Axia_Anthrazit_L` | right, 395.8 mm | right, 245.8 mm |
| `Axia_Grey_R`, `Axia_White_R`, `Axia_Anthrazit_R` | left, 395.8 mm | left, 245.8 mm |
| `Axis_L` / `Axis_R` | right / left, 400.8 mm | right / left, 250.8 mm |
| `Dinas_L` / `Dinas_R` | right / left, 340 mm | right / left, 190 mm |
| `Metra_R` | left, 410 mm | left, 260 mm |
| `None` | right, 400.8 mm | right, 250.8 mm |

The side follows the sink: the drainer lies opposite the basin, so a basin-left sink (`_L`) reaches
over the unit on the right, a basin-right sink (`_R`) over the unit on the left. How far depends on
the sink and the width of the unit. `None` still has an outline like a basin-left sink — whether the
library builds a sink there is open (§8).

## 4. Root cause

**The library delivers `SUT60` with another sink than its description names.** The description
of the five sink units was written for `Axia_Grey_L`, the sink all five came with on 2026-10-17
(suggested change 1.1; the stored [`article.json`](../../docs/library-information/article.json)
still shows it). In the live article list `SUT60` comes with `Metra_R`; the four other units still
come with `Axia_Grey_L`. The description of `SUT60` was not changed with it: it names the right side,
and its sink reaches over the left one.

**No description says that the side follows the sink.** The article descriptions name one fixed
side and do not say which sink they are measured for; the desc of `mod_SinkId` says nothing about
the drainer; only the value descs name basin and drainer, and they do not connect it with the
neighbour. A changed default — or a sink the agent sets itself — therefore leaves the hint wrong,
and the agent has no sentence that tells it so. Since D122 the value descs are one call away, so the
wrong article line is the only sink information the create sees.

The served text is not the cause: it holds no library content (§2.4), and the article line is the
library's authoritative description (the rule of the authoring rules: every desc is authoritative).

## 5. Why it produces the overlap

The image kitchen puts the sink beside the cooking area. Run 2 kept the hint's condition — no hob
unit on the right — and put the hob unit on the left, where the `Metra_R` drainer reaches. The
baselines got it right without the description: with the value descs in the prefix they chose
`Axis_R` and put the sink unit at the end of the row, a base unit on its left. That outcome was the
model's choice, not something a text asked for.

## 6. The fix: the descriptions

Three descriptions carry it. The first two reach the agent at the create, also with D122: the
catalog serves the description of every article — `FUNCTION` and `AI_SELECTION_HINT` at least —,
and the attributes section serves the desc of every attribute.

1. **The article descriptions** name the sink the unit comes with and the side and reach that
   follow from it (`FUNCTION`), and the rule for every other sink (`AI_SELECTION_HINT`). `SUT60`, 969
   characters:

   ```text
   FUNCTION: Sink base unit, 60 cm wide, with 1 hinged door. Its sink, Blanco Metra with the basin on the right, reaches 410 mm over the unit on its left with its drainer.
   AI_SELECTION_HINT: Select when the user requests a sink or washing area. The drainer is opposite the basin: an _L sink reaches over the unit on its right, an _R sink over the unit on its left; put a base unit there, not a hob unit.
   ```

   The four other units alike with "Blanco Axia with the basin on the left, reaches 396 / 246 mm over
   the unit on its right". To stay within 1000 characters, `REQUIREMENTS`, `STYLE_COMPATIBILITY`,
   `RESTRICTIONS`, `PURPOSE` and `SEARCH_KEYWORDS` are shortened (989–997 characters); the complete
   texts are in
   [the suggested library changes, 1.1](../../docs/library-information/suggested-library-changes.md#11-sink-base-units).
2. **The desc of `mod_SinkId`** states the rule for every sink unit:

   ```text
   Article code of the sink. The drainer lies opposite the basin and reaches past the sink unit on that side: a value ending in _L (basin left) over the unit on its right, _R (basin right) over the unit on its left - about 400 mm past a 60 cm unit and 250 mm past a 90 cm unit (Dinas 340 / 190 mm, Metra 410 / 260 mm). Put a base unit on that side, not a hob unit.
   ```

3. **The value descs of `mod_SinkId`** add the reach of each sink, e.g. `Metra_R`: "Blanco Metra sink:
   basin on the right, drainer on the left; it reaches 410 mm past a 60 cm sink unit and 260 mm past
   a 90 cm unit, over the unit on its left." They answer the agent that looks a sink up
   ([2.8](../../docs/library-information/suggested-library-changes.md#28-sink)).

With 1 and 2 the description says that changing the sink changes the side, and the agent reads it
before the create. The fix is the library team's; the texts are ready to paste.

## 7. Alternatives

| Alternative | Why not, or not alone |
|---|---|
| Fix only the side of `SUT60`'s `FUNCTION` line | Right today, wrong again with the next changed default or a sink the agent sets; the rule is what is missing |
| A rule in the served text: the drainer side of a sink | Library content in the served text (§2.4); the library's descs are the place |
| A server check: a sink outline over a hob | The server cannot tell a sink or a hob without library content; an outline over a neighbour is no error by itself |
| Level 1 of D122 with the `isMain` attributes of the catalog's sub modules | Brings the values of `mod_SinkId` back into the prefix — and the hob, oven, fridge, dishwasher and mixer models and the handle position: 15 lists, a section of 95 KB instead of 88 KB (121 KB before D122), structural. It restores what the baselines saw, but the article line still names the wrong side; it does not replace the descriptions. A decision on D122, apart from this fix |
| Revert D122 | The same as the row above, and the article line still names the wrong side |

## 8. Open

- **`None`.** The value `None` of `mod_SinkId` leaves an outline that reaches 400.8 / 250.8 mm past
  the right side, as a basin-left sink does; whether the library builds a sink or only keeps its
  space is a question for the library team.
- **The test once the library carries the texts:** image-kitchen-left-wall, two runs on the build of
  D122: no run puts the hob unit on the drainer side of the sink unit; and `edit-swap-hob-unit` of
  `docs/test-prompts.json`.
- **The default sink of the other units** may change like that of `SUT60`; the rule in the
  `AI_SELECTION_HINT` and in the desc of `mod_SinkId` keeps the agent right when it does, the reach
  in `FUNCTION` has to follow it.

## 9. Verification of the library

Checked on 2026-10-28 against the article list and the master data the backend serves
(`docs/library-information`, refreshed):

- **The five sink unit descriptions** are the proposed texts, character for character, and the
  sinks the units come with are unchanged: `SUT60` `Metra_R`, the four others `Axia_Grey_L`.
- **The desc of `mod_SinkId`** is the proposed text.
- **Ten of the eleven value descs** are the proposed texts. `Axia_Anthrazit_R` carries the pasted
  table row — "Axia color anthrazit basin right | see 2.8 | Blanco Axia sink in anthracite: …" —,
  without its final full stop; it stays open in
  [library issue 21](../backlog/library-issues.md#21-the-description-of-sut60-names-the-drainer-on-the-right-its-sink-reaches-over-the-unit-on-its-left).
- **What the agent reads**, read without a model through the planner of bo-test, which loads the
  library from the same backend: the catalog serves the new descriptions of the five units, the
  attributes section the new desc of `mod_SinkId`, its values the new descs.
- **The catalog serves 19 of the 111 descriptions in full**, the five sink units among them: their
  sections stand on one line each (`FUNCTION: …`), while the shortening of D63 takes a section's
  text from the line after its name (`shortDescription`, roomle-ui `hi-mcp/agent-facing.ts`). The
  19 are the descriptions written in the format of the suggested library changes. For this fix it
  makes no difference — the agent reads both lines of the rule —; for the size of the catalog it does.

