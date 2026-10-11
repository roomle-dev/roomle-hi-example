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

Items 1-4 are violations of the policy above: they sit in the served text, the results or the
server's logic. Items 5-7 are neutral-language follow-ups in the same folder — a code comment, test
fixtures and README examples. They are not served text, results or logic, so they are not policy
violations; they are recorded here because they carry the same library-specific vocabulary and
belong to the same cleanup.

## Overview

| # | File | Issue | Priority |
|---|---|---|---|
| 1 | `hi-mcp-server.ts` | Served text (`AUTHORING_RULES`, `INSTRUCTIONS`, tool descriptions) bakes in one furniture domain's taxonomy and fixed measures, and names one library's concrete content | high |
| 2 | `group-layout.ts` | Relations are derived from furniture-kind names and a fixed height instead of the article's own data | high |
| 3 | `group-placement.ts` | Corner detection falls back on one library's category and module names | medium |
| 4 | `tool-executors.ts` | Spelling correction carries a fixed vocabulary in the logic | medium |
| 5 | `plan-space.ts` | A comment names a kitchen (neutral-language follow-up, not a policy violation) | low |
| 6 | `tests/` | Tests are pinned to one library's categories and modules (neutral-language follow-up, not a policy violation) | medium |
| 7 | `README.md` | Examples are written in one furniture domain's vocabulary (neutral-language follow-up, not a policy violation) | low |

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
| `find-attributes` description carries a spelling table | Line 214: "British and American spelling alike (colour and color, grey and gray, worktop …)" — a fixed vocabulary in a served description. The spelling correction belongs in the server's logic (see §4), not in the served text | medium |

## 2. Kitchen-kind logic in `group-layout.ts`

The server derives relations from article categories and heights with rules that only a kitchen
library satisfies. The defect is the classification itself: the server decides what an article *is*
from a furniture-kind name and a fixed height, instead of from the article's own data (its docking
vectors, dimensions and the catalog's flags).

| Item | To do | Priority |
|---|---|---|
| Furniture-kind regexes | Lines 15, 17, 20, 22: `WALL_UNIT = /\bwall ?units?\b/i`, `TALL_UNIT`, `BASE_UNIT`, `HOOD = /hood/i`. The server classifies articles by furniture kind, which only a kitchen library has | high |
| `isHoodArticle`, `isWallUnitArticle`, `isTallUnitArticle`, `isBaseUnitArticle` | Lines 73-74 and around: classify a root module by category name and by a fixed height (`TALL_HEIGHT_MM = 1500`). The comment names Furniture_Smith explicitly: "Furniture_Smith lists the 2100 mm modular carcases (H60M) under 'Modular', not 'Tall Units'." | high |
| `hangGapOf` | Lines 136-138: derives the gap that hangs a wall unit above a floor unit from the tall unit of the group or "the usual tall unit of the library (D35)". A kitchen-only measure | high |
| Comment "A kitchen base unit carries the worktop" | Line 19 | medium |

## 3. Corner detection in `group-placement.ts`

| Item | To do | Priority |
|---|---|---|
| `CORNER = /corner/i` and `isCornerArticle` | Lines 30, 34-35: the fallback reads the category ("… | Base Units | Corner") and the module name (`mr_CornerunitStraight`) when the catalog's `cornerArticle` flag is absent. The category and module names are library content; the fallback should use only the catalog flag and the article's own docking data | medium |

## 4. Spelling correction in `tool-executors.ts`

| Item | To do | Priority |
|---|---|---|
| `SPELLINGS` hard-codes search normalization | Lines 267-270: `[/colour/g, 'color']`, `[/grey/g, 'gray']`, `[/worktop/g, 'countertop']`. `searchable()` applies them to the query and to temporary copies of the master-data fields for matching only — no attribute value is mutated or returned changed. The fixed vocabulary in the logic is the issue: drop it or derive it from the master data's attribute values | medium |
| Library-specific comments and messages | Lines 144, 245, 694-695, 711, 739, 866, 911, 1488, 1495, 1763-1764, 1823-1826, 1907-1910, 1960, 2130-2134, 2175-2176, 2228, 2263, 2773, 2819, 3425, 3701, 4384, 4523-4524: comments and result messages that name furniture kinds, rooms or library measures. Rewrite in the neutral vocabulary | medium |

## 5. Comment in `plan-space.ts`

A neutral-language follow-up in the audited folder, not a policy violation: a comment is not served
text, a result or the server's logic.

| Item | To do | Priority |
|---|---|---|
| "corner kitchen there, for both hands of corner article" | Line 452: a comment naming a kitchen. Rewrite neutrally | low |

## 6. Tests use Furniture_Smith fixtures

The tests are in scope. They pin the server to one library's categories and modules. A
neutral-language follow-up in the audited folder, not a policy violation: test fixtures are not
served text, a result or the server's logic — except the last row, which guards the served text and
is a policy matter.

| Item | To do | Priority |
|---|---|---|
| `group-layout.test.ts` | Lines 12, 29-36: `libraryId: 'Furniture_Smith'`, categories `Kitchen | Base Units | Storage`, `Kitchen | Tall Units | Storage`, `Kitchen | Wall Units | Storage`. Use neutral fixtures that exercise the same logic without a real library's category names | medium |
| `group-placement.test.ts` | Lines 32, 39, 196-203: `Kitchen handleless | Base Units | Corner`, `Kitchen | Base Units | Storage` | medium |
| `tool-executors.test.ts` | Lines 136-149, 189, 231, 244-245, 636-642, 694, 762-866, 895: `mr_Countertop`, `mod_CountertopColor`, `Furniture_Smith` front attributes, "Living-room sideboard", "Not a kitchen or wet-area unit", "reads colour as color, grey as gray and worktop as countertop" | medium |
| `plan-space.test.ts` | Line 403: `cabinet({ id: 'worktop', isGenerated: true })` | low |
| `hi-mcp-server.test.ts` guards the served text | Lines 419-429, 601: the test asserts the served text "speaks of articles and root modules, not of kitchens" — weaker than the policy. Strengthen it to reject every furniture kind, room and library measure, so the policy is enforced by a test | high |

## 7. README examples

A neutral-language follow-up in the audited folder, not a policy violation: README examples are not
served text, a result or the server's logic.

| Item | To do | Priority |
|---|---|---|
| `README.md` kitchen examples | Lines 7, 314, 339-340, 351-352, 363-364, 419: "the whole kitchen comes from one `posGroups` JSON", "corner kitchen", "worktop `mr_Countertop`, toe kick, finger grip, backsplash", "L-shaped corner kitchen", "worktop colour … `mod_CountertopColor`", "a row of three tall units along the right wall". Rewrite the examples in the neutral vocabulary | low |
