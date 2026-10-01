# Feature Analysis: Article Size and Trusted Descriptions

**Status**: Implemented

**Date**: 2026-10-01 · **Branch**: `feat/article-size-from-description`

Implemented as proposed (points 1–4 of [Proposed change](#proposed-change)). Verified: a new unit
test pins the statements in `get-authoring-rules` and in the `get-plan-context` and
`get-plan-images` descriptions; all 209 hi-mcp unit tests and the typecheck pass
(`cf/tests/worker.test.ts` fails to load on `master` as well — `@cloudflare/containers` is missing
from the local `node_modules`). Not verified: a live model run — whether a model now resizes with
`mod_Width` and prefers `desc` over a rendering needs test 10 and the image prompts of the "test the
mcp" suite. The living reference is the `articles` section and [Authoring pos
groups](../../minimal-hi-example/docs/hi-mcp-server.md#authoring-pos-groups) of
`hi-mcp-server.md` and the `get-plan-context` entry of [hi-mcp-tools.md](../skills/hi-mcp-tools.md).
Open: `DU` and `SM_TV` still have no size (gap 3), and the swapped hand in the `desc` of
`UELTB90`/`UERTB90` is library data.

## What was asked and why

Two notes on what the HI MCP gives the agent about an article:

1. *Make sure the MCP knows how to get the size of articles.* Evaluate whether the HI MCP provides
   enough information for the agent to know an article's size.
2. *The agent should trust the description of an article rather than evaluate the catalog
   images.* Tell the agent that every description (the `desc` property) is to be trusted, and that
   an image is evaluated only when there is no other information.

## How it works today

### What the agent receives about an article

- roomle-ui `compactArticle`
  (`packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts:526`) builds the `articles`
  section of `get-plan-context`: `articleId`, `articleName`, `desc`, `imageUrl`, `category`, and per
  root module the master-data `module` (id, name, desc, imageUrl), `dimensions`, `mainAttributes`,
  `dockingVectors`, `insertLevels`, `subModules` (id, name, desc, imageUrl).
- `dimensions` (`hi-plan-context.ts:554`) are the template root's attributes whose master-data type
  is `Dim`, each as `{ id, name, value }`. For Furniture_Smith these are `mod_Width` (name
  "Width"), `mod_Depth` ("Depth") and `mod_Height` ("Height"), values in millimetres as strings.
- `shapeRoot` (`hi-plan-context.ts:618`) gives every root of a placed group its `desc` and its input
  `attributes` — the same ids, e.g. `mod_Width=600, mod_Depth=561, mod_Height=2100`
  (`.temp/result/mcp-test-2026-10-01_12-08-07/01-three-tall-units-right-wall/plan-context.json`).
- `shapeGroup` gives every group `position.footprint` with `widthMm` and `depthMm`.
- The MCP server serializes every tool result with `withoutImageUrls`
  ([`hi-mcp-server.ts:76`](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L76), since `1ec4e16`):
  no `imageUrl` of an article, module or attribute value reaches the agent. The only images an
  agent sees are the renderings of `get-plan-images` and images the user attaches to a prompt.

### Coverage of the catalog (Furniture_Smith, `docs/library-information/article.json`)

Rebuilt offline with the `compactArticle` filter from `article.json` and `master-data.json`:

| Articles | Size in `dimensions` |
|---|---|
| 106 of 111 | Width, Depth and Height |
| 3 — the panels `W35O`, `W60H`, `W60U` | Depth and Height (`mod_UprightDepth`, `mod_UprightHeight`); no thickness |
| 2 — the range hood `DU`, the decoration TV `SM_TV` | none: their template has no `Dim` attribute and no docking vector |

Every root has 0 to 5 `dimensions` (median 3): the list is not noisy. No article `desc` names a size
(0 of 111): the size is in `dimensions` only. The article ids encode the width by convention
(`EUTB60` is 600 wide), but nothing states that convention, and the agent need not rely on it.

### What the agent is told

- `get-plan-context` description: "articles (compact catalog: articleId, name, desc, category, and
  per root module its master-data module, dimensions, …)" — no unit, no hint which entries are the
  width, depth and height.
- `AUTHORING_RULES`: "desc and category say what an article is and what it is for, dimensions give
  its size" — no unit, nothing on how a unit's size is changed. The only image rule is "Do not judge
  a position from a rendering alone."
- `get-plan-images` description: "so the plan can be inspected visually" — nothing on what an image
  must not be used for.
- The chat backend sends the model only its own three-sentence system prompt
  ([`chat-server.ts:15`](../../hi-mcp/hi-mcp-chat/chat-server.ts#L15)); the MCP server's
  `instructions` never reach the model. What the model reads are the tool descriptions and the text
  of `get-authoring-rules`.

### Evidence from the MCP tests

Test 10 of both suites on 2026-10-01 ("make the first unit 900 mm wide",
`.temp/result/mcp-test-2026-10-01_12-08-07/10-change-one-unit/planner-calls.json`): the model called
`change-module-attribute` with `attributeId: "Breite"` before and again after reading the plan
context, which lists `mod_Width` on every root. `Breite` occurs nowhere in the data — the model
invented an attribute name. The deployed planner reported success for the missing attribute (the
known roomle-ui defect of
[change-module-attribute-accepts-a-missing-attribute.md](../bug-analysis/change-module-attribute-accepts-a-missing-attribute.md)),
so the unit stayed 600 wide.

## The gap

**The data is sufficient, the instructions are not.** For 106 of 111 articles, the catalog and the
placed roots carry width, depth and height in millimetres, and every group carries its footprint.
What is missing:

1. **The meaning of `dimensions`**: no text says the values are millimetres, that the entries named
   Width, Depth and Height are the size, that a placed root carries the same attribute ids, and that
   a size is changed through that attribute id — the test 10 failure.
2. **Trust in `desc`**: nothing says that `desc` and `dimensions` are authoritative and that an
   image is consulted only for what they do not state. Catalog images do not reach the agent through
   this server (`withoutImageUrls`), but `get-plan-images` renderings and user images do, and the
   model may read an article's kind or size from them.
3. **Articles without a size** (`DU`, `SM_TV`; the panels' thickness): the library template carries
   no size attribute. The agent cannot know the width of the range hood from any MCP data. This
   needs library data or the template geometry of the deferred backlog item
   [roomle-ui-article-template-geometry.md](../backlog/roomle-ui-article-template-geometry.md); it
   is out of scope here.

## Proposed change

Text only, in [`hi-mcp-server.ts`](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts), in the places the
model actually reads (tool descriptions and `AUTHORING_RULES`):

1. **`AUTHORING_RULES`, article choice**: `dimensions` give the size — per size attribute its id,
   name (Width, Depth, Height) and value in millimetres; a root in `groups` carries the same
   attribute ids among its attributes; `change-module-attribute` with that **id, never a name**,
   changes a unit's size.
2. **`AUTHORING_RULES`, new rule**: every `desc` — of an article, a root, a module, an attribute and
   an attribute value — is authoritative: trust it for what a thing is, and `dimensions` for how big
   an article is. Evaluate an image (a rendering of `get-plan-images` or any other picture) only for
   what no `desc` and no dimension states; never take an article's kind or size from an image.
3. **`get-plan-context` description**: `dimensions` named as the size attributes in millimetres;
   the `desc` and `dimensions` are authoritative over any image.
4. **`get-plan-images` description**: the images show how the plan looks; what an article is and its
   size come from `desc` and `dimensions` — the images only for what those do not state.

Unit tests in [`tests/hi-mcp-server.test.ts`](../../hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts)
pin the new statements in the served texts.

The attribute names are not hard-coded as ids (`mod_Width`): the server stays library-agnostic, and
the id is always in front of the agent next to its name.

### Known risk: a wrong `desc` in the library

Trusting `desc` also trusts its errors. The descriptions of `UELTB90` ("direction right") and
`UERTB90` ("direction left") name the opposite hand of their ids (also noted in
[hi-furniture-smith-article-catalog.md](../skills/hi-furniture-smith-article-catalog.md)). Placement
is unaffected — the corner rules hold for both hands and the server turns a right-handed corner
article itself — but an agent asked for a specific hand would pick the wrong article. The fix belongs
in the library data, not in the agent's instructions.

## Alternatives considered

- **Pass the catalog images to the agent** so it can compare them: rejected — the signed CDN URLs
  were three quarters of the plan context's tokens and filled Mistral's context
  ([tool-results-exceed-mistral-context.md](../bug-analysis/tool-results-exceed-mistral-context.md)),
  and the note asks for the opposite.
- **Put the size into `desc`** (e.g. "Base cabinet 600 × 561 × 720"): rejected — `desc` comes from
  the library, and `dimensions` already carries the size as data.
- **A top-level `sizeMm: { width, depth, height }` per article in roomle-ui**: easier to read, but
  library-specific (which `Dim` attribute is the width) and a roomle-ui change; the instructions
  close the observed gap without it. Worth reconsidering together with the template geometry
  backlog item, which would also give `DU` and `SM_TV` a size.
- **Put the rules into the chat system prompt**: rejected — only the built-in chat reads it;
  Claude Code, Claude Desktop and the ligna-store chat read the tool descriptions and
  `get-authoring-rules`.

## Code and documents the work touches

- [`hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts`](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts) —
  `AUTHORING_RULES`, the `get-plan-context` and `get-plan-images` descriptions
- [`hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts`](../../hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts)
- [`minimal-hi-example/docs/hi-mcp-server.md`](../../minimal-hi-example/docs/hi-mcp-server.md) —
  `articles` section, `get-plan-images`, authoring pos groups
- [`.agents/skills/hi-mcp-tools.md`](../skills/hi-mcp-tools.md) — `get-plan-context`,
  `get-plan-images`
- The indexes [`.agents/README.md`](../README.md) and [`README.md`](README.md)
