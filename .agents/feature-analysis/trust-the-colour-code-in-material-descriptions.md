# Feature Analysis: trust the colour code in material descriptions

> **Type**: Feature Analysis
> **Domain**: the served text of `hi-mcp/hi-mcp-server/hi-mcp-server.ts` (`AUTHORING_RULES`, the descriptions of `get-plan-context` and `find-attributes`); the library tooling `.agents/skills/hi-furniture-smith-materials.md` and `.agents/scripts/extract-dominant-color-from-image.js`; `docs/library-information/materials.md`
> **Trigger**: [RML-18063](https://roomle.atlassian.net/browse/RML-18063) "HI agent: trust the #rrggbb colour code in material descriptions instead of analysing thumbnails"
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open
> **Plan**: [trust-the-colour-code-in-material-descriptions-implementation-plan.md](trust-the-colour-code-in-material-descriptions-implementation-plan.md)

## Affected repositories

- **roomle-hi-example** — everything: one sentence of the authoring rules and two tool
  descriptions with one unit test; a decision in the behaviour reference; the trusted-descriptions
  paragraphs of the server doc and the tools skill; the materials skill and the colour script; the
  regenerated `materials.md`.

Not changed: **roomle-ui** — the plan context passes the attribute selections through as the
backend delivers them (`compactAttribute`, `hi-plan-context.ts`), so the coded desc already reaches
the server. **ligna-store** — no code; it gets the served text with the server deployment. **The
HOMAG library** — the Furniture_Smith descs already carry the codes (see [2.2](#22-the-library-data-already-carries-the-codes)).

## Summary

The ticket asks that an agent takes the `#rrggbb` code in the desc of a material value as the
colour of that value, and analyses the thumbnail only when the desc carries no code.

Two findings change the picture the ticket paints:

1. **The data is already there.** The ticket says the Furniture_Smith descs carry no code yet. They
   do since the library refresh of today 09:12 (`e4a4646`, one hour after the ticket): every one of
   the 48 colour values with a thumbnail has a desc of the form `Cloudy blue (#506080)`, and every
   code equals the colour the script had computed from the thumbnail's pixels — the library adopted
   the "Suggested Description" column. The eleven values without a thumbnail are, with one
   exception, also the ones without a code, so there is nothing to analyse for them either.
2. **The MCP agent has no thumbnail.** The server strips every `imageUrl` (D7). The only place
   where thumbnails are still downloaded and analysed is the library tooling of this repository: the
   materials skill and the colour script.

So the work is instruction text and tooling, no server logic: one sentence in the served rule and
in two tool descriptions (step 1 of the guard ladder: clarify the instruction), the script takes
the code from the desc and analyses pixels only for a value without one, and the documentation
says so. The fallback to the thumbnail belongs to the tooling only — the served text never tells
the agent to look at a catalog image (D8, guarded by a unit test).

## 1. What was asked

The desc of a material (colour) attribute value can carry its colour code: `Cloudy blue (#506080)`.
When the code is present, the agent trusts it as the colour of that value and does not analyse the
thumbnail (`imageUrl`); it analyses a thumbnail only when that is absolutely necessary, e.g.
because the desc carries no code.

Scope of the ticket:

1. Extend the trusted-desc rule to colours — in `AUTHORING_RULES` and the descriptions of
   `get-plan-context` and `find-attributes`.
2. The materials skill and `extract-dominant-color-from-image.js` take the colour from the desc
   when it carries a code and download a thumbnail only for values without one.
3. Documentation: the "Trusted descriptions" paragraph of `.agents/skills/hi-mcp-tools.md`, the
   matching bullet of `docs/hi-mcp-server.md`, D8 or a new decision in `docs/hi-mcp-behaviour.md`,
   the "Color Extraction" section of `docs/library-information/materials.md`.

Acceptance: the rules and the tool descriptions state that a `#rrggbb` code in a value's desc is its
colour, taken as granted; with a code the agent takes the colour from the desc and does not analyse
the thumbnail; a unit test next to `it('limits the desc-over-image rule to the catalog images')`
guards the colour rule.

Two corrections to the ticket text: the documents moved today — `hi-mcp/docs/hi-mcp-behaviour.md`
is `docs/hi-mcp-behaviour.md` and `minimal-hi-example/docs/hi-mcp-server.md` is
`docs/hi-mcp-server.md` — and the "Today" section is behind the data (2.2).

## 2. How it works today

### 2.1 Where the desc of a value comes from, and what the agent sees

| Step | Where | What happens |
|---|---|---|
| The library | HOMAG backend (`tecconfig-preview`) | Every colour attribute (`mod_FrontColor`, `mod_CountertopColor`, …) lists its values as `selections` with `value`, `name`, `desc` and a signed `imageUrl` (the swatch the planner shows) |
| The plan context | roomle-ui `hi-plan-context.ts:242` `compactAttribute` | Keeps `selections` as they are; the master data is reduced to the root modules and their customer-facing attributes (D48) |
| `get-plan-context` with `masterData` | `tool-executors.ts`, `hi-mcp-server.ts:76` `withoutImageUrls` | Passes the section through and strips every `imageUrl` from the JSON result (D7) |
| `find-attributes` | `tool-executors.ts:2899` | Matches attribute id, name, desc, group and per selection name, desc and value (`attributeMatches`, `tool-executors.ts:150`), returns the whole attribute — selections with their desc included — and the root modules that carry it; `imageUrl` stripped as above |
| The chat | `hi-mcp-chat/chat-config.ts:12` `CHAT_SYSTEM_PROMPT` | Says nothing about colours or images; the model sees images only as user attachments and as the renderings of `get-plan-images` |

An MCP agent asked for "a blue front" therefore reads, from `find-attributes { text: 'front colour' }`:

```json
{ "value": "152", "name": "Cloudy blue", "desc": "Cloudy blue (#506080)" }
```

and never a thumbnail. The ligna-store chat reads the same results; it has no colour code of its
own (checked: no thumbnail or swatch handling in its chat code).

### 2.2 The library data already carries the codes

`docs/library-information/master-data.json` is fetched directly from the HOMAG backend
(`fetch-hi-library-data.js`), the same source the planner loads the library from. The refresh of
today (`e4a4646`, 2026-10-07 09:12) brought the codes: the diff of `materials.md` shows the
Description column going from `Cloudy blue` to `Cloudy blue (#506080)` for every row.

The 59 distinct colour values of the master data (deduplicated by value, as the script does):

| Values | Thumbnail | Code in the desc | Examples |
|---|---|---|---|
| 48 | yes | yes, every one | `Cloudy blue (#506080)`, `Oak (#704020)`, `Stainless steel (#C0C0C0)`, `Transparent (#0090C0)` (FloatGlass), `Just one color available (#F0F0F0)` (Fixed) |
| 1 | no | yes | `CloudyBlue` of `mod_ClothingOrganizerBoardColor`: `Cloudy blue (#506080)` |
| 7 | no | no — the desc is a bare name | `DarkColor`, `LightColor`, `WhiteColor`, `BlackColor` (`mod_HardwareColor`), `Anthrazit`, `SilverGrey` (`mod_PantryPulloutColor`), `Like hardware color` |
| 3 | no | no — no desc at all | `white`, `silver`, `anthrazit` of `mod_PulloutElementColor` |

Every code in a desc equals the "Suggested Color" the script computed from the pixels of that
thumbnail (e.g. `Light grey (#D0C0C0)` and `#D0C0C0`): the library took over the script's suggested
descriptions. The values without a code are the values without a thumbnail, bar one — for them
there is no image to analyse either; their name is all there is.

### 2.3 The served rule covers kind and size, not colour

`AUTHORING_RULES`, `hi-mcp-server.ts:9`:

> Every desc - of an article, a root, a module, an attribute and an attribute value - is
> authoritative: trust it for what that article, module or value is, and trust dimensions for how
> big an article is. Both are authoritative over the catalog images of the master data (imageUrl):
> never take the kind or the size of an article from a catalog image. A desc says what an article
> is, not where the user may put it.

The description of `get-plan-context` (`hi-mcp-server.ts:175`) repeats it in one sentence ("Every
desc is authoritative and dimensions give the size - trust them over the catalog images
(imageUrl)"); the description of `find-attributes` (`hi-mcp-server.ts:193`) names "the front
colour" as the typical search and says nothing about the desc of a value. The user guide points the
user at the materials list with its swatches (`docs/user-guide/README.md:158`).

Guarded by two tests in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`: `it('tells the agent
where the size of an article is and to trust every desc over a catalog image')` (line 353, expects
the substrings `Every desc`, `is authoritative`, `authoritative over the catalog images of the
master data (imageUrl)` and, in `get-plan-context`, `trust them over the catalog images
(imageUrl)`) and `it('limits the desc-over-image rule to the catalog images')` (line 382: no served
text says `any other picture` or `any image`).

### 2.4 The tooling analyses every thumbnail

`.agents/scripts/extract-dominant-color-from-image.js`:

- `extractMaterials` keeps the selections of every `Text` attribute with "Color" in its name or
  desc that have an `imageUrl`, deduplicated by value.
- `extractAllColors` downloads **every** thumbnail and computes the dominant quantised colour with
  Sharp (`getColorFromUrl`, `extractDominantColor`) — the desc is not looked at.
- `generateMarkdown` is the only place that reads a code from the desc: `hasColorCode` decides
  whether the "Suggested Description" column is the desc as it is or the desc plus the computed
  colour (changed today in `e4a4646`). The "Suggested Color" column and the "Color Extraction"
  header text claim a pixel calculation for every value.

`.agents/skills/hi-furniture-smith-materials.md` describes that flow: "Download all 21 thumbnail
images", "the only accurate method is to calculate from actual image pixels", a 21-row table of
calculated colours (the library has 48 thumbnails since the refresh). Its "Description" column
section already notes that every Furniture_Smith desc ends with its code.

The script runs on demand (`.agents/scripts/package.json`: `extract-colors`); Sharp and node-fetch
are installed there.

### 2.5 The documents that state the rule

| Document | Where | Says |
|---|---|---|
| `docs/hi-mcp-behaviour.md` | D7 (line 128), D8 (129), §5.2 "Trusted descriptions" (308), §5.4 `masterData` row (353), §5.5 (363), `find-attributes` (392) | `imageUrl` stripped; every desc authoritative over the catalog images only; selections carry value, name and desc |
| `docs/hi-mcp-server.md` | "Every `desc` is authoritative" bullet (619–630), `find-attributes` (365), result format (288) | the same, plus: catalog images do not reach the agent |
| `.agents/skills/hi-mcp-tools.md` | "Trusted descriptions" (87–91), `find-attributes` section, result format (62) | the same |
| `docs/library-information/materials.md` | "Color Extraction" (generated by the script) | the colour is calculated from pixels, "NOT guessed from material names" |

## 3. The gap

**Nothing tells the agent that the code in a value's desc is its colour.** D8 covers what a thing is
and how big an article is. An agent asked for "dark colours" (test `kitchen-conversation`, turn
5), "a blue front", "a light, warm wood" or "the darkest grey" has to decide by the names — and the
names mislead where the codes do not:

| By name | By code |
|---|---|
| "Dark walnut" sounds dark | `Dark walnut (#906040)` is a mid brown; `Oak (#704020)` is darker, `Dark oak (#101010)` is black |
| "Ash grey" and "Slate" sound like two greys | both are `#303030`, nearly black |
| "Light grey" sounds neutral | `Light grey (#D0C0C0)` has a warm, pinkish tint |
| "Transparent" (FloatGlass) sounds colourless | `Transparent (#0090C0)` is a blue |
| "Olive green" and "Seaweed green" | `#909060` is the light one, `#606040` the dark one |

The code makes such a choice a lookup; the rule has to say that the agent may rely on it.

**The tooling spends a download and a pixel analysis on every value whose desc already states the
colour**, and its text claims the opposite of what the ticket wants ("NOT guessed from material
names" — true, but the desc is neither a guess nor a name).

Two things that are **not** a gap:

- The server has nothing to derive or verify: the desc reaches the agent as it is (2.1). No
  executor changes.
- The MCP agent has no thumbnail to fall back to (D7), and the ten values without a code have no
  thumbnail either (2.2). The fallback "analyse the thumbnail only when the desc carries no code"
  is a rule for the tooling, not for the served text — there it would contradict D8 and fail
  `it('limits the desc-over-image rule to the catalog images')`.

## 4. Proposed change

### 4.1 The served text (guard ladder step 1: clarify the instruction)

One sentence more in the rule of `hi-mcp-server.ts:9`, keeping the substrings the existing test
expects:

> Every desc - of an article, a root, a module, an attribute and an attribute value - is
> authoritative: trust it for what that article, module or value is, and trust dimensions for how
> big an article is. **A colour code in the desc of an attribute value - Cloudy blue (#506080) - is
> the colour of that value: take it as it is, and tell light from dark and one hue from another by
> it, not by the name.** All of them are authoritative over the catalog images of the master data
> (imageUrl): never take the kind or the size of an article, or the colour of a value, from a
> catalog image. A desc says what an article is, not where the user may put it.

`get-plan-context` (`hi-mcp-server.ts:175`): "Every desc is authoritative and dimensions give the
size - trust them over the catalog images (imageUrl); **a colour code in the desc of an attribute
value (#rrggbb) is the colour of that value**."

`find-attributes` (`hi-mcp-server.ts:193`): "… Use it to find the attribute for a requested
property, e.g. the front colour, and the value to set. **The desc of a value carries its colour code
where the library gives one - Cloudy blue (#506080) -, the colour of that value: pick a dark, a
light or a blue value by its code.**"

Test, next to `it('limits the desc-over-image rule to the catalog images')`:
`it('tells the agent that a colour code in a desc is the colour of the value')` — the rules contain
the new sentence, the descriptions of `get-plan-context` and `find-attributes` contain their
sentence; the limits test stays as it is and keeps passing (the new text names no image but the
catalog images).

### 4.2 The tooling (scope 2)

`extract-dominant-color-from-image.js`:

- `colorCodeOf(desc)`: the first `#rrggbb` match of the desc, upper-cased — the one regular
  expression `generateMarkdown` already uses.
- `extractAllColors`: a value whose desc carries a code takes that code and downloads nothing; only
  a value without a code is downloaded and analysed with Sharp as today. The progress line says
  which (`from desc` / the computed colour).
- The "Color Extraction" header text of the generated `materials.md`: the "Suggested Color" is the
  code of the desc where the desc carries one; only a value without a code is calculated from the
  thumbnail's pixels, with the five steps as today.

`hi-furniture-smith-materials.md`: the "Data Flow", "Step 3", "Color Extraction Algorithm" and
"Suggested Color" column sections say the same — desc first, pixels only for a value without a
code —, without the "all 21" count. The "Why Accuracy Matters" table stays: it explains why a name
is no source. The 21-row "Calculated Colors" table is replaced by a pointer to `materials.md`
(48 rows today; the skill table is already stale).

Re-running the script (`npm run extract-colors` in `.agents/scripts`) regenerates `materials.md`:
the table stays identical (every code equals the computed colour), the header changes, and no
thumbnail is downloaded.

### 4.3 The documentation (scope 3)

- `docs/hi-mcp-behaviour.md`: a new decision **D53** under "Information for the agent" — *A
  `#rrggbb` code in the desc of an attribute value is the colour of that value, taken as it is. The
  served text says so (rule, `get-plan-context`, `find-attributes`); the agent never sees a
  thumbnail (D7). The library tooling takes the code from the desc and analyses a thumbnail only
  for a value without one* — state: in effect, guarded by the new test; §5.2 "Trusted descriptions
  (D8, D53)"; the `masterData` row of §5.4 notes the code in a selection's desc. §8 is unchanged:
  no guard, no correction, no feedback.
- `docs/hi-mcp-server.md`: the "Every `desc` is authoritative" bullet and the `find-attributes`
  section.
- `.agents/skills/hi-mcp-tools.md`: the "Trusted descriptions" paragraph and the `find-attributes`
  section.
- `docs/library-information/materials.md`: regenerated (4.2).

D53 rather than an extended D8: today's decisions are numbered on (D51, D52), and D8's test
reference and date stay true as they are. The ticket allows either.

## 5. Alternatives considered

| Alternative | Why not |
|---|---|
| A `colour` field the server derives from the desc of every selection (guard ladder step 2: simplify the API) | The desc is already the agent's source and reaches it unchanged; a derived field duplicates it on every selection of every attribute match, costs tokens, and the ticket wants the desc trusted as it is |
| Serve the thumbnails to a vision model (undo D7) | Three quarters of the plan context's tokens, signed URLs that expire monthly, and a pixel guess is a quantised estimate where the code is exact |
| A fallback sentence in the served text: "analyse the thumbnail when the desc carries no code" | The agent has no thumbnail (D7); the values without a code have none either; the sentence would contradict D8 and fail the limits test |
| List the coded values without a thumbnail in `materials.md` (the one `CloudyBlue` of `mod_ClothingOrganizerBoardColor`) | Not asked; the table is the list of swatches. Noted, not done |
| A prompt test, e.g. "give the fronts the darkest blue" expecting Denim blue (155, `#102040`) over Cloudy blue (`#506080`) | Would show the agent using the code (ADR 0006: the prompt tests assess the agent). Not in the ticket's scope; proposed as an option for the plan |

## 6. Code and documents the work touches

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | the rule sentence (line 9), the descriptions of `get-plan-context` (175) and `find-attributes` (193) |
| `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` | one test next to line 382 |
| `.agents/scripts/extract-dominant-color-from-image.js` | `colorCodeOf`, `extractAllColors`, the header template |
| `.agents/skills/hi-furniture-smith-materials.md` | data flow, step 3, algorithm, column 5, the calculated-colours table |
| `docs/library-information/materials.md` | regenerated by the script |
| `docs/hi-mcp-behaviour.md` | D53, §5.2, §5.4 |
| `docs/hi-mcp-server.md` | the trusted-desc bullet, `find-attributes` |
| `.agents/skills/hi-mcp-tools.md` | "Trusted descriptions", `find-attributes` |
| `docs/test-prompts.json` | only if the optional prompt test is wanted |

Verification: `npm test` and `npm run typecheck` at the `hi-mcp` root; `npm run extract-colors` in
`.agents/scripts` produces an unchanged table and downloads nothing; `npm run lint` and
`npm run format:check` at the repository root.
