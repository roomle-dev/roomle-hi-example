# MCP policy issues — library neutrality

The MCP server serves every HI library, not only Furniture_Smith. The policy is stated in
[`AGENTS.md`](../../AGENTS.md) §"Library-Neutral" and in §2.4 of
[roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#24-instructions):

> The server serves every HI library. The served text, the results and the server's logic carry no
> information about a specific library — no article, category, attribute, value or measure of one
> library, not even as an example. The only source of library information is the library data the
> plan context passes on: the master data and the article list, and in them the `desc` properties
> (D8). When the agent picks the wrong library content because it lacks information, the fix is the
> `desc` in the library data, never a served rule.

This document lists what in the implementation of the MCP server still carries library-specific
content. Scope: the served text and the logic of the HI tool set (roomle-ui `hi-mcp/`), and the
logic and the result messages of the HI tool commands in roomle-ui
(`packages/web-sdk/packages/homag-intelligence/src/`: `hi-tool-*.ts`, `hi-group-layout.ts`,
`hi-wall-placement.ts`, `hi-group-placement.ts`), which perform the plan-changing tools.

Every item is a violation of the policy above: it sits in the served text, the results or the
server's logic.

## Overview

| # | File | Issue | Priority |
|---|---|---|---|
| 1 | `hi-mcp-server.ts` | Served text (`AUTHORING_RULES`, `INSTRUCTIONS`, tool descriptions) bakes in one furniture domain's taxonomy and fixed measures, and names one library's concrete content | high |
| 2 | `tool-executors.ts`; roomle-ui HI tool commands | Spelling correction carries a fixed vocabulary in the logic; result messages name furniture kinds | medium |
| 3 | `agent-facing.ts`; HOMAG library | The attribute filter names the element type `mod_TypeElement` because the library does not mark the attributes the agent leaves to the article | low |
| 4 | `hi-group-layout.ts`, `hi-tool-docking.ts` | The layout and the docking read sizes by one library's attribute ids `mod_Width` and `mod_Height`, tell the kinds of articles by one library's category names and a 1500 mm threshold | high |

## 1. Served text in `hi-mcp-server.ts`

The description of `get-skill` names kinds of rooms by design: it is the index of the planning
skills, the domain knowledge served on demand (D75 of roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`). It is no item of
this list; the policy test exempts it from the no-kitchen check of the tool descriptions.

The served text reaches every agent of every library, so it is the strongest place to get the
policy right. The defect is not that it uses ordinary domain words — the policy bans *one library's*
content, not the domain's vocabulary. The defect is that the served text bakes in **one furniture
domain's taxonomy** (base unit, wall unit, tall unit, worktop, hood, island, kitchen) as if every
library were a kitchen, and in places names **one library's concrete content** — the `find-attributes`
description names the root module `Countertop` as if it were universal. A library of office, bathroom or shop-fitting articles does not fit that model, and
the agent is told to reason in terms its library does not have.

| Item | To do | Priority |
|---|---|---|
| `AUTHORING_RULES` encodes a kitchen taxonomy | Lines 8-9, 16-21, 23-26, 29, 31, 35, 42-58, 65: the rules are written as "tall unit", "wall unit", "base unit", "range hood", "hob unit", "island", "L-shaped kitchen", "worktop, toe kick", "a low cabinet between the high cabinets". Rewrite so the rules speak of articles, root modules, relations, docking vectors and the corner article, and derive the relation from the article's own data — not from a furniture kind the library may not have | high |
| `INSTRUCTIONS` encodes a kitchen taxonomy | Line 67: "a kitchen, a wardrobe, a sideboard, a utility room"; line 71: "a plan into a room corner starts with a corner article". Same rewrite as `AUTHORING_RULES` | high |
| Tool descriptions encode a kitchen taxonomy | `get-plan-context` (182, 185), `find-attributes` (225, 230-232: "the worktop colour"), `get-authoring-rules` (258: "wall units beside a tall unit"), `create-or-replace-groups` (313, 316: "back right corner", "an island"), `place-group` (349, 395), `delete-article-in-place` (517: "worktop, toe kick"), `delete-article-and-compact` (532, 534, 538: "a wall unit or a range hood", "a corner article between two legs"), `merge-article-into-group` (562-563, 601: "a wall unit or a range hood", "a wall unit above a floor-standing root module"), `insert-article-into-group` (615, 618: "a low cabinet between two high cabinets or wardrobes", "wall units and the range hood"), `swap-root-modules` (670: "wall units and the range hood hanging from a root module"). Rewrite every description so it names the relation, not the furniture kind | high |
| Served text names one library's concrete content | The `find-attributes` description (lines 225-226) names the root module `Countertop` ("the worktop colour is the colour of the root module Countertop") as if it were universal. It is one library's module — the clearest form of the violation. Remove it from the served text. The examples `Cloudy blue (#506080)` (lines 10 and 234), a front colour of one library, and `mod_Width 900` (line 646), one library's attribute, carry one library's content as well | high |
| `find-attributes` description carries a spelling table | Lines 230-232: "British and American spelling alike (colour and color, grey and gray, worktop …)" — a fixed vocabulary in a served description. The spelling correction belongs in the server's logic (see §2), not in the served text | medium |
| The served-text policy test is too weak | `tests/hi-mcp-server.test.ts:770-820` rejects `kitchen` in the tool descriptions and `whole kitchen` in the served text, but allows seven occurrences in the rules, so it would not catch the taxonomy regressions above. It also requires the sentence "a high or tall cabinet or a wardrobe is about 2000 mm high, a low cabinet or base cabinet about 720 mm high" (:788), which the rewrite of `AUTHORING_RULES` changes. Strengthen it as the acceptance coverage of this item | medium |

## 2. Spelling correction and result messages

| Item | To do | Priority |
|---|---|---|
| `SPELLINGS` hard-codes search normalization | `tool-executors.ts:51-55`: `[/colour/g, 'color']`, `[/grey/g, 'gray']`, `[/worktop/g, 'countertop']`. `searchable()` applies them to the query and to temporary copies of the master-data fields for matching only — no attribute value is mutated or returned changed. The fixed vocabulary in the logic is the issue: drop it or derive it from the master data's attribute values | medium |
| Result messages name library content | The results of the plan-changing tools come from the HI tool commands of roomle-ui: `hi-group-layout.ts:246-276, 338-353, 516, 718, 751`, `hi-tool-docking.ts:195, 223, 334, 754-757, 1022-1023`, `hi-tool-hints.ts:154` name furniture kinds (wall unit, range hood, worktop). Rewrite them in the neutral vocabulary. Comments are outside the policy | medium |

## 3. The attribute filter names the element type

The function `isAgentFacingAttribute` (roomle-ui `hi-mcp/agent-facing.ts`) decides which attributes
the agent sees and sets (D102 of [roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)).
It leaves out the element type `mod_TypeElement` by its id: an article sets its element type, and
another type is another article. The library's master data does not say which attributes the agent
leaves to the article, so the function names one library's attribute in the tools' logic.

| Item | To do | Priority |
|---|---|---|
| The library marks the attributes the agent leaves to the article | HOMAG library: a mark on the attribute in the master data. roomle-ui: `isAgentFacingAttribute` reads the mark instead of the id; the id `mod_TypeElement` leaves the code | low |

## 4. The layout and the docking name one library's attribute ids, categories and a measure

The logic of the HI tool commands that builds the docking from the relations and corrects the
relations of wall units (roomle-ui `hi-group-layout.ts`, `hi-tool-docking.ts`) carries one
library's content as constants. Every one of them is a violation of the policy: it is the tools'
logic, not a comment, a test or a document.

| Where | What | Used for |
|---|---|---|
| `hi-group-layout.ts:25`, `:27` | `HEIGHT = 'mod_Height'`, `WIDTH = 'mod_Width'` | `articleHeight`, `rootHeight` and `rootWidth` (`:172-199`) read the size of an article from the catalog's `dimensions` and of a root from its overrides by these ids: the hang height of a wall unit (D35, the height of the tall units minus the heights of the wall unit and the floor unit), the tall unit by height, the places of wall units along a floor row (G64) |
| `hi-tool-docking.ts:24` | `ARTICLE_WIDTH = 'mod_Width'` | `articleWidth` (`:26`), the width of an article for the docking |
| `hi-group-layout.ts:16-23` | `WALL_UNIT = /\bwall ?units?\b/i`, `TALL_UNIT = /\btall ?units?\b/i`, `BASE_UNIT = /\bbase ?units?\b/i`, `HOOD = /hood/i` | `isWallUnitArticle`, `isTallUnitArticle`, `isBaseUnitArticle`, `isHoodArticle`: the kind of an article from its category text — every relation correction of wall units, tall units, base units and the range hood (G34, G35, G40 to G45, G51, G63, G64) and `wallRootsOf` |
| `hi-group-layout.ts:160` | `TALL_HEIGHT_MM = 1500` | a tall unit by height when the category does not say so; the comment names the library and the article the threshold was chosen for |

The constants of `hi-group-layout.ts` and `hi-tool-docking.ts` came with the move of the tools
into the planner (roomle-ui `16863864f`, 2026-10-13). The layout needs the sizes and the kinds of
the articles before the load — to build the docking from the relations and to put a wall unit where
it hangs — and takes them by one library's attribute ids, category names and a measure instead of
from the library's data.

Library-neutral sources the tools already have:

- **Sizes** from the geometry of the calculated article template: the catalog's `dockingVectors`
  carry their start and end points, so the width of a root module is the distance between its left
  and right docking vectors and its height the height of its Top vectors; the parts' bounding box
  (`rootFootprintPoints`, `rootHeights` in `hi-plan-space.ts`) gives both for a loaded root. A root
  override of a size still has to be read by its id: the id is the one the catalog's `dimensions`
  name for that root module, not a constant.
- **Kinds** from the data model, not from the category text: the default insert level of a root
  module (`insertLevels` of the catalog, the height a root is inserted at) tells a hanging unit from
  a standing one; the docking vectors tell what docks on top of what. Where the data model cannot
  tell a kind the layout needs — the range hood above the hob —, the library marks it in the master
  data, as item 3 asks for the attributes the agent leaves to the article.
- **Measures**: no fixed measure in the logic. The height of the tall units of a group comes from
  the group; without one, from the articles of the catalog whose default insert level and height
  make them the tallest standing articles.

| Item | To do | Priority |
|---|---|---|
| The attribute ids `mod_Width` and `mod_Height` leave the layout and the docking | roomle-ui `hi-group-layout.ts:25-27`, `:172-199`, `hi-tool-docking.ts:24-30`: read the width and the height of an article from the geometry of its template (docking vectors, parts), and a root's size override by the dimension ids the catalog serves for its root module | high |
| The category patterns and the 1500 mm threshold leave the layout | roomle-ui `hi-group-layout.ts:16-23`, `:160`: tell a hanging unit, a standing unit and a stacked unit from the insert levels and the docking vectors of the data model; a kind the data model cannot tell is a mark of the library in the master data | high |
| A policy test over the tool logic | roomle-ui `__tests__/hi-mcp/hi-mcp-server-test.ts` guards the served text only; add a test that the sources of the tool logic (`hi-mcp/`, `hi-tool-*.ts`, `hi-group-layout.ts`, `hi-wall-placement.ts`, `hi-group-placement.ts`) contain no `mod_` literal but the exception of item 3, no library name and no category text | medium |
