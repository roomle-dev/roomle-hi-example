# Bug analysis — the sink unit descriptions do not say that a sink unit needs an article on its right

> **Type**: Bug analysis
> **Status**: Open
> **Ticket**: RML-18124
> **Date**: 2026-10-10

## Affected repositories

- **HOMAG library (Furniture_Smith)** — the `desc` of the sink units `SUB2A90`, `SUBA60` and
  `SUT60`. This is where the fix belongs.
- **roomle-hi-example** — documentation only: this analysis. No productive code changes. The MCP
  server is library-neutral ([§2.4](../../docs/hi-mcp-behaviour.md#24-instructions)); the agent
  learns how to use an article only from its description. The issue and the proposed library
  changes are tracked as item 60 of
  [`.agents/backlog/library-issues.md`](../backlog/library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob).

## Symptom

The agent does not use a sink unit correctly at the first attempt: a sink unit needs another
article on its right, and the agent places it without one. The final kitchen is right only after
further prompts.

- First attempt: `ps_rc6g4m7jk164lhekfrp8jrm8k1bsp8z`
- Final kitchen: `ps_rc6krpjgmlseivlr81b970w6ws5fv4u`

The sink articles: `SUB2A90` (SBF2P90), `SUBA60` (SBFP60), `SUT60` (SBD60).

## Investigation trace

### What the agent sees

`get-plan-context` serves the article catalog. For a description written in sections, the server
shortens it to its `FUNCTION` and `AI_SELECTION_HINT` lines — what the article is and when to pick
it (D63, [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md) §3). The full descriptions are
in the section `articleDescriptions`, returned only on request.

- `shortDescription` — `hi-mcp/hi-mcp-server/tool-executors.ts:1116`
- `SHORT_DESCRIPTION_SECTIONS = ['FUNCTION', 'AI_SELECTION_HINT']` —
  `hi-mcp/hi-mcp-server/tool-executors.ts:1113`
- `agentFacingArticle` — `hi-mcp/hi-mcp-server/tool-executors.ts:1131`
- `get-plan-context` builds the compact list and the optional `articleDescriptions` section —
  `hi-mcp/hi-mcp-server/tool-executors.ts:4460`

So the agent's default view of a sink unit is its `FUNCTION` and `AI_SELECTION_HINT` lines only.

### What the descriptions say today

Checked in `docs/library-information/article.json` on 2026-10-10. None of the three descriptions
states that another article belongs on the sink unit's right:

| Article | `FUNCTION` | `AI_SELECTION_HINT` |
|---|---|---|
| `SUB2A90` | Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. | Select for a wide sink cabinet with additional pull-out storage. |
| `SUBA60` | Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. | Select for a sink cabinet that also offers a storage pull-out. |
| `SUT60` | Sink base unit, 60 cm wide, with 1 hinged door. | Select when the user requests a sink or washing area. |

The other sections do not carry it either. All three share the same `REQUIREMENTS`
("Requires a compatible sink, water supply and waste-water connection. base unit: carcase height
720 mm, depth 561 mm, plinth height 20-200 mm."), the same `RECOMMENDED_NEIGHBOURS` ("Dishwasher
unit, drawer base units, worktop elements.") and the same `RESTRICTIONS` ("Cannot house an oven;
not suitable for islands without plumbing."). `RECOMMENDED_NEIGHBOURS` names neighbours as
*recommendations*, not as a requirement, and it does not say the neighbour belongs on the right.

### Why the right neighbour is needed

The sink of `SUT60` carries its drainer and is 980 mm wide on the 600 mm unit. Placed as the last
unit of a row, the drainer reaches 396 mm past the end of the row, into the air; swapped beside the
hob unit, it covers part of the hob. `SUBA60` has the same geometry: its 600 mm unit spans
995.75 mm along the row in the Open-Plan Room, including its sink geometry. The geometry is
intended — the library builds the sink that way — but the description does not give the
article-specific meaning. This is the same missing information as item 60 of the backlog.

## Root cause

The library data lacks the information. The `desc` of `SUB2A90`, `SUBA60` and `SUT60` does not say
that another article belongs on the sink unit's right, and it does not say why (the sink with its
drainer is wider than the unit). The agent has no other source: the MCP server is library-neutral
and serves only what the library data carries.

The information is missing from the sections the agent sees by default (`FUNCTION`,
`AI_SELECTION_HINT`) and from the sections it sees on request (`REQUIREMENTS`,
`RECOMMENDED_NEIGHBOURS`, `RESTRICTIONS`). So the fix cannot be a change to which sections the
server serves — the text is not there at all.

## Proposed fix

The library: the description of every sink unit says that another article belongs on its right, and
why — the sink with its drainer is wider than the unit. Put it in `FUNCTION` or `AI_SELECTION_HINT`
so the compact article catalog carries it (D63), with any fuller detail in the other sections. This
is the same to-do as item 60 of the backlog, which asks for the sink/drainer width and the side the
drainer reaches over; the right-neighbour requirement is the same information stated as a rule.

No change to roomle-hi-example. The MCP server is library-neutral; the fix belongs in the library
`desc`, never in a served rule.

## Acceptance criteria (from the ticket)

- The descriptions of `SUB2A90`, `SUBA60` and `SUT60` say that another article belongs on their
  right.
- At the first attempt, the agent places a sink unit with an article on its right.
