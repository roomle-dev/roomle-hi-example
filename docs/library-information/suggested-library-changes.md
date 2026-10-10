# Suggested library changes

> **Type**: Living reference — the changes the library data needs so the agent plans right
> **Domain**: the library data the plan context passes on — the article list and the master data,
> and in them the `desc` properties
> **Source**: the open issues of [`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md)

The MCP server is library-neutral ([§2.4](../hi-mcp-behaviour.md#24-instructions)): what the agent
knows of a library comes only from the library data. When the agent plans wrong because that data
lacks information, the fix is in the library. This document collects the concrete changes to propose
to the library development team — the exact text to add to or change in the `desc` of the affected
articles.

Each change names the library, the affected articles, the problem, the proposed `desc` change and
the ticket. A change leaves this document when the library carries it.

## Overview

| # | Change | Library | Articles | Status | Ticket |
|---|---|---|---|---|---|
| 1 | [The sink unit descriptions do not say that a sink unit needs an article on its right](#1-the-sink-unit-descriptions-do-not-say-that-a-sink-unit-needs-an-article-on-its-right) | HOMAG Furniture_Smith | `SUB2A90`, `SUBA60`, `SUT60`, `ESUB2A90`, `ESUT60` | reported to the library development team | RML-18124 |

## 1. The sink unit descriptions do not say that a sink unit needs an article on its right

**Library.** HOMAG Furniture_Smith.

**Articles.** `SUB2A90` (SBF2P90), `SUBA60` (SBFP60), `SUT60` (SBD60), and their handleless
variants `ESUB2A90` (FSBF2P90) and `ESUT60` (FSBD60).

**Ticket.** RML-18124. Backlog item 60 of
[`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md).

**Problem.** A sink unit needs another article on its right. The agent does not know this and places
the sink unit without a neighbour, so the sink top with its drainer reaches past the end of the row,
into the air, or over the hob unit beside it.

The reason is the geometry: the sink of `SUT60` carries its drainer and is 980 mm wide on the
600 mm unit. Placed as the last unit of a row, the drainer reaches 396 mm past the end of the row.
`SUBA60` has the same geometry — its 600 mm unit spans 995.75 mm along the row in the Open-Plan
Room, including its sink geometry.

Nothing in the library data tells the agent this. The fix belongs in the `desc` of the sink units,
never in a served rule.

The handleless variants `ESUB2A90` and `ESUT60` carry the same sink geometry and the same missing
statement: their descriptions name a handleless sink base unit and its fronts, and say nothing about
the sink width, the drainer side or the article that belongs on their right.

**What the descriptions say today.** None of the articles states that another article belongs on the
sink unit's right, and none states the sink/drainer width or the side the drainer reaches over. The
three handled units share the same `REQUIREMENTS`, `RECOMMENDED_NEIGHBOURS` and `RESTRICTIONS`
sections; the two handleless units share their own.

| Article | Label | `FUNCTION` | `AI_SELECTION_HINT` |
|---|---|---|---|
| `SUB2A90` | SBF2P90 | Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. | Select for a wide sink cabinet with additional pull-out storage. |
| `SUBA60` | SBFP60 | Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. | Select for a sink cabinet that also offers a storage pull-out. |
| `SUT60` | SBD60 | Sink base unit, 60 cm wide, with 1 hinged door. | Select when the user requests a sink or washing area. |
| `ESUB2A90` | FSBF2P90 | Handleless sink base unit, 90 cm wide, with 1 fixed front and 2 drawers (fingergrip). | Select for a wide handleless sink cabinet with drawers. |
| `ESUT60` | FSBD60 | Handleless sink base unit, 60 cm wide, with 1 door (fingergrip). | Select for a sink in a handleless kitchen with a single door. |

Shared sections of the three handled units:

- `REQUIREMENTS`: Requires a compatible sink, water supply and waste-water connection. base unit:
  carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
- `RECOMMENDED_NEIGHBOURS`: Dishwasher unit, drawer base units, worktop elements.
- `RESTRICTIONS`: Cannot house an oven; not suitable for islands without plumbing.

Shared sections of the two handleless units:

- `REQUIREMENTS`: Requires a compatible sink, water supply and waste-water connection. base unit:
  carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
- `RECOMMENDED_NEIGHBOURS`: Handleless dishwasher unit, handleless drawer base units.
- `RESTRICTIONS`: Cannot house an oven; not for islands without plumbing.

`RECOMMENDED_NEIGHBOURS` names neighbours as *recommendations*, not as a requirement, and it does
not say the neighbour belongs on the right.

**Where the change belongs.** The agent sees a shortened description by default: `get-plan-context`
serves only the `FUNCTION` and `AI_SELECTION_HINT` lines of a sectioned description (D63 of
[`docs/hi-mcp-behaviour.md`](../hi-mcp-behaviour.md)). The other sections are served only when the
agent explicitly requests the `articleDescriptions` section.

So the right-neighbour requirement must go into `FUNCTION` or `AI_SELECTION_HINT` to reach the
agent at the moment it picks the article. Any fuller detail — the sink width, the drainer side —
belongs in the other sections.

**Proposed `desc` changes.** The changed lines are `FUNCTION` and `AI_SELECTION_HINT`; the other
sections are unchanged and shown for completeness. Each description stays below the 1000-character
limit.

`SUB2A90` (SBF2P90):

```
FUNCTION: Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Wide sink cabinet combining plumbing access with two storage pull-outs.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, wide sink base unit, sink pull-out cabinet, plumbing cabinet.
AI_SELECTION_HINT: Select for a wide sink cabinet with additional pull-out storage. Place a base unit on its right.
```

`SUBA60` (SBFP60):

```
FUNCTION: Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Supports a sink while offering a lower pull-out for storage.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, pull-out sink unit, plumbing cabinet.
AI_SELECTION_HINT: Select for a sink cabinet that also offers a storage pull-out. Place a base unit on its right.
```

`SUT60` (SBD60):

```
FUNCTION: Sink base unit, 60 cm wide, with 1 hinged door. A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Supports a kitchen sink and gives access to the plumbing below.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, wash basin cabinet, plumbing cabinet.
AI_SELECTION_HINT: Select when the user requests a sink or washing area. Place a base unit on its right.
```

`ESUB2A90` (FSBF2P90):

```
FUNCTION: Handleless sink base unit, 90 cm wide, with 1 fixed front and 2 drawers (fingergrip). A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Wide handleless sink cabinet with plumbing access and drawer storage.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip) kitchen. Minimalist and premium designs.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit, sink drawer base.
AI_SELECTION_HINT: Select for a wide handleless sink cabinet with drawers. Place a base unit on its right.
```

`ESUT60` (FSBD60):

```
FUNCTION: Handleless sink base unit, 60 cm wide, with 1 door (fingergrip). A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Supports a kitchen sink in a handleless kitchen, with plumbing access.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip) kitchen. Minimalist and premium designs.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit, grip-less sink base.
AI_SELECTION_HINT: Select for a sink in a handleless kitchen with a single door. Place a base unit on its right.
```

**Acceptance criteria.**

- The descriptions of `SUB2A90`, `SUBA60`, `SUT60`, `ESUB2A90` and `ESUT60` say that another article
  belongs on their right.
- At the first attempt, the agent places a sink unit with an article on its right.
