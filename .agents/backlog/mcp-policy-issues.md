# MCP policy issues — library neutrality

The MCP server serves every HI library, not only Furniture_Smith. The policy is stated in
[`AGENTS.md`](../../AGENTS.md) §"Library-Neutral" and in §2.4 of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#24-instructions):

> The server serves every HI library. The served text, the results and the server's logic carry no
> information about a specific library — no article, category, attribute, value or measure of one
> library, not even as an example. The only source of library information is the library data the
> plan context passes on: the master data and the article list, and in them the `desc` properties
> (D8). When the agent picks the wrong library content because it lacks information, the fix is the
> `desc` in the library data, never a served rule.

This document lists what in the implementation of the MCP server (`hi-mcp/hi-mcp-server/`) still
carries library-specific content. Scope: files under `hi-mcp/hi-mcp-server/` only.

Both items are violations of the policy above: they sit in the served text, the results or the
server's logic.

## Overview

| # | File | Issue | Priority |
|---|---|---|---|
| 1 | `hi-mcp-server.ts` | Served text (`AUTHORING_RULES`, `INSTRUCTIONS`, tool descriptions) bakes in one furniture domain's taxonomy and fixed measures, and names one library's concrete content | high |
| 2 | `tool-executors.ts` | Spelling correction carries a fixed vocabulary in the logic | medium |

## 1. Served text in `hi-mcp-server.ts`

The served text reaches every agent of every library, so it is the strongest place to get the
policy right. The defect is not that it uses ordinary domain words — the policy bans *one library's*
content, not the domain's vocabulary. The defect is that the served text bakes in **one furniture
domain's taxonomy** (base unit, wall unit, tall unit, worktop, hood, island, kitchen) as if every
library were a kitchen, and in places names **one library's concrete content** — the `find-attributes`
description names the root module `Countertop` and the fixed 1500 mm tall-unit height as if they
were universal. A library of office, bathroom or shop-fitting articles does not fit that model, and
the agent is told to reason in terms its library does not have.

| Item | To do | Priority |
|---|---|---|
| `AUTHORING_RULES` encodes a kitchen taxonomy | Lines 7, 15-20, 22-25, 28, 30, 34, 41-57, 64: the rules are written as "tall unit", "wall unit", "base unit", "range hood", "hob unit", "island", "L-shaped kitchen", "worktop, toe kick", "a low cabinet between the high cabinets". Rewrite so the rules speak of articles, root modules, relations, docking vectors and the corner article, and derive the relation from the article's own data — not from a furniture kind the library may not have | high |
| `INSTRUCTIONS` encodes a kitchen taxonomy | Line 66: "a kitchen, a wardrobe, a sideboard, a utility room"; line 70: "a plan into a room corner starts with a corner article". Same rewrite as `AUTHORING_RULES` | high |
| Tool descriptions encode a kitchen taxonomy | `get-plan-context` (168, 171), `find-attributes` (209, 214: "the worktop colour"), `get-authoring-rules` (242: "wall units beside a tall unit"), `place-group` (267, 270: "back right corner", "an island"), `delete-article-in-place` (472, 493: "worktop, toe kick"), `delete-article-and-compact` (487, 489: "a wall unit or a range hood", "a corner article between two legs"), `insert-article-into-group` (517-518, 556: "a wall unit or a range hood", "a wall unit above a floor-standing root module"), `merge-article-into-group` (570, 573: "a low cabinet between two high cabinets or wardrobes", "wall units and the range hood"). Rewrite every description so it names the relation, not the furniture kind | high |
| Served text names one library's concrete content | The `find-attributes` description (line 210) names the root module `Countertop` ("the worktop colour is the colour of the root module Countertop"), and the text carries the fixed 1500 mm tall-unit height as if both were universal. These are one library's module and measure — the clearest form of the violation. Remove them from the served text | high |
| `find-attributes` description carries a spelling table | Line 214: "British and American spelling alike (colour and color, grey and gray, worktop …)" — a fixed vocabulary in a served description. The spelling correction belongs in the server's logic (see §2), not in the served text | medium |
| The served-text policy test is too weak | `tests/hi-mcp-server.test.ts:601-645` rejects `kitchen` in the tool descriptions and `whole kitchen` in the served text, but allows seven occurrences in the rules, so it would not catch the taxonomy and fixed-measure regressions above. Strengthen it as the acceptance coverage of this item | medium |

## 2. Spelling correction in `tool-executors.ts`

| Item | To do | Priority |
|---|---|---|
| `SPELLINGS` hard-codes search normalization | Lines 267-270: `[/colour/g, 'color']`, `[/grey/g, 'gray']`, `[/worktop/g, 'countertop']`. `searchable()` applies them to the query and to temporary copies of the master-data fields for matching only — no attribute value is mutated or returned changed. The fixed vocabulary in the logic is the issue: drop it or derive it from the master data's attribute values | medium |
| Result messages name library content | Lines 144, 245, 694-695, 711, 739, 866, 911, 1488, 1495, 1763-1764, 1823-1826, 1907-1910, 1960, 2130-2134, 2175-2176, 2228, 2263, 2773, 2819, 3425, 3701, 4384, 4523-4524: result messages that name furniture kinds, rooms or library measures. Rewrite in the neutral vocabulary. The comments on those lines are outside the policy | medium |
