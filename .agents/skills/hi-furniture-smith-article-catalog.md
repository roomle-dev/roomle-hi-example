# HI Furniture_Smith Article Catalog Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Recreate Furniture_Smith article catalog with dimensions from Roomle HI plan context  
> **Use When:** Library changes, new backend, or data refresh needed

---

## Overview

This skill documents the complete process to extract article data from the Roomle HOMAG Intelligence (HI) system and generate a structured markdown catalog with images, labels, descriptions, and dimensions.

The process stores the original result of `roomDesignerApi.extended.getExternalObjectPlanContext()` (master data, rooms, articles, and groups) in `docs/library-information/hi-plan-context.json` and transforms it into a human-readable markdown table suitable for documentation and reference. No MCP server is involved.

---

## Prerequisites

1. **Node.js 18+** — Runs the fetch and generator scripts; they have no dependencies, no `npm install` needed
2. **A browser** — The plan context only exists in a loaded scene, so the script opens a page that loads one

---

## Data Flow

```
node .agents/scripts/fetch-hi-plan-context.js
    ↓ serves fetch-hi-plan-context.html on http://localhost:3101/ and opens it
Roomle Planner (Browser): HI_PRE_Roomle_Milestone_2, Furniture_Smith, language en
    ↓ roomDesignerApi.extended.callbacks.onCompletelyLoaded
    ↓ roomDesignerApi.extended.getExternalObjectPlanContext()
    ↓ POST /hi-plan-context
HI Plan Context (HiPlanContext JSON, unchanged) → docs/library-information/hi-plan-context.json
    ↓ node .agents/scripts/generate-article-catalog.js
Markdown Catalog (articles.md)
```

---

## Step-by-Step Process

### Step 1: Fetch HiPlanContext JSON

```bash
node .agents/scripts/fetch-hi-plan-context.js
```

- The script serves [`fetch-hi-plan-context.html`](../scripts/fetch-hi-plan-context.html) on `http://localhost:3101/` and opens it in the default browser
- The page loads the scene the way `minimal-hi-example/index.html` does: backend `HI_PRE_Roomle_Milestone_2` (plan, additional catalogs and `configureInRoom` from its preset in the HI backend list), library `Furniture_Smith`, language `en` (the `Accept-Language` of the HI requests, the planner locale and `tecConfigInfo.language`), user right `Master` (`uiConfiguration.userRight`)
- Once `roomDesignerApi.extended.callbacks.onCompletelyLoaded` fires, the page calls `roomDesignerApi.extended.getExternalObjectPlanContext()` without arguments, which returns all four sections, and posts the result back
- The script writes the result unchanged (pretty-printed) to `docs/library-information/hi-plan-context.json`, prints `Saved docs/library-information/hi-plan-context.json` and exits

A run takes about 15 seconds. The status bar of the page shows the progress; close the tab when it reports the file as saved. Backend, library, language and user right are the constants `BACKEND_ID`, `LIBRARY_ID`, `LANGUAGE` and `USER_RIGHT` at the top of the page script.

With `--no-open` the script only prints the URL, e.g. for a headless browser:

```bash
node .agents/scripts/fetch-hi-plan-context.js --no-open & FETCH_PID=$!
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --user-data-dir="$(mktemp -d)" --enable-unsafe-swiftshader http://localhost:3101/ & CHROME_PID=$!
wait $FETCH_PID; kill $CHROME_PID
```

### Step 2: Generate Markdown Catalog

```bash
node .agents/scripts/generate-article-catalog.js
```

[`generate-article-catalog.js`](../scripts/generate-article-catalog.js) has no dependencies. It:
- Loads `docs/library-information/hi-plan-context.json`
- Writes one table row per article with the columns described in [Column Data Sources](#column-data-sources)
- Takes the dimensions from the `roots[0].attributes` array and formats them as `L {Depth} mm W {Width} mm H {Height} mm`
- Replaces pipes in the category with slashes (to avoid breaking markdown tables)
- Derives the suggested description by the [Suggested Description Generation Rules](#suggested-description-generation-rules)
- Saves to `docs/library-information/articles.md` and prints `Generated docs/library-information/articles.md with 111 articles`

### Step 3: Commit Changes

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
git add docs/library-information/
git commit -m "docs: update Furniture_Smith article catalog"
```

---

## Column Data Sources

The markdown table has 7 columns. Here is the exact source of each column from the `HiPlanContext` JSON structure:

### 1. ID
- **Source:** `article.articleId`
- **Type:** String
- **Example:** `"SB_UB600S"`
- **Description:** Unique identifier for the article in the library

### 2. Category
- **Source:** `article.category`
- **Type:** String
- **Example:** `"Living | Sideboard"`
- **Processing:** Pipes (`|`) are replaced with slashes (`/`) for markdown compatibility
- **Description:** Article classification hierarchy (e.g., room type and furniture type)

### 3. Label
- **Source:** `article.articleName`
- **Type:** String
- **Example:** `"SB_BD600DR"`
- **Description:** Short display name used in the UI catalog

### 4. Dimensions
- **Source:** `article.roots[0].attributes` array
- **Type:** Formatted string
- **Extraction Logic:**
  - `mod_Depth` → Depth (L)
  - `mod_Width` → Width (W)
  - `mod_Height` → Height (H)
- **Format:** `"L {Depth} mm W {Width} mm H {Height} mm"`
- **Example:** `"L 350 mm W 600 mm H 900 mm"`
- **Fallback:** `"L ? mm W ? mm H ? mm"` (when dimension attributes are missing)
- **Description:** Physical dimensions of the article in millimeters

### 5. Image
- **Source:** `article.imageUrl`
- **Type:** String (URL)
- **Format:** Markdown image syntax: `![]({url})`
- **Example:** `"![](https://tecconfig-preview.homag.cloud/cdn/.../SB_UB600S.png)"`
- **Host:** `https://tecconfig-preview.homag.cloud/cdn/` (HOMAG CDN)
- **Description:** Article thumbnail image for visual identification

### 6. Description
- **Source:** `article.desc`
- **Type:** String
- **Example:** `"Sideboard with 1 door, 1 drawer"`
- **Description:** Human-readable description of the article from the source data

### 7. Suggested Description
- **Source:** Generated from `article.desc`, `article.category`, `article.articleId` and the `mod_Height` of `article.roots[0].attributes`
- **Type:** String (technically enhanced)
- **Generation Logic:** See [Suggested Description Generation Rules](#suggested-description-generation-rules)
- **Purpose:** Provides agents with complete article understanding without needing to analyze images
- **Example:** `"Corner base cabinet, 1 door, adjustable shelves"` (derived from `"Fingergrip corner base cabinet direction left with 1 door, adjustable shelves"`)
- **Benefits:** 
  - Enables faster planning
  - Eliminates need for image analysis
  - Provides consistent, technically accurate descriptions
  - Includes all relevant details in a structured format

---

## Suggested Description Generation Rules

The Suggested Description gives agents a technically accurate, complete description without analyzing images. `generate-article-catalog.js` derives it from the original description, in this order:

1. **Overrides**: `DU` → "Range hood", `GSP` → "Dishwasher unit", `SM_TV` → "Wall unit, TV decoration"; a description that is just "Dunstabzug" → "Range hood"; an empty description stays empty
2. **Remove prefixes**: A leading "Fingergrip" is dropped
3. **Translate German terms** (whole words): Oberschrank → Wall cabinet, Oberschrankregal → Wall cabinet shelf, Einlegeböden → adjustable shelves, feste Zwischenböden → fixed shelves, Tür/Türen → door/doors, Schublade/Schubladen → drawer/drawers, Auszug/Auszüge → pullout/pullouts, Dunstabzug → range hood, Kochfeld → hob, Herd → stove, Spüle → sink, Faltklappe → folding flap, Schwenkklappe → hinged flap, mit → with
4. **Comma lists**: "with" becomes a comma; spaces and commas are normalized
5. **Drop the direction**: "direction left/right" is removed; the article id carries it (`…L…`/`…R…`), and the descriptions of `UELTB90` and `UERTB90` even name the opposite side
6. **Hob cabinets**: "hob cabinet" → "cabinet, hob", e.g. "Base hob cabinet" → "Base cabinet, hob"
7. **Singular**: "1 doors/drawers/pullouts" → "1 door/drawer/pullout"
8. **Capitalize** the first letter
9. **Furniture type**: Unless the text names sideboard, lowboard, tall/wall/base cabinet, filler, panel or closet, the type from the category goes in front: Sideboard, Lowboard, Tall cabinet (tall unit), Wall cabinet (wall unit), Base cabinet (base unit), Filler, Panel, Closet cabinet
10. **Height**: ", low" for a `mod_Height` below 500 mm, ", high" from 2000 mm, unless the text says so already
11. **Corner**: ", corner" when the category or the description names a corner and the text does not yet

Example: `"Fingergrip corner base cabinet direction left with 1 door, adjustable shelves"` → `"Corner base cabinet, 1 door, adjustable shelves"`

---

## Complete JSON Structure


`hi-plan-context.json` is the unchanged `HiPlanContext` returned by `getExternalObjectPlanContext()`:

```json
{
  "rooms": {
    "rooms": [{ "levels": [...] }]
  },
  "groups": [],
  "masterData": {
    "Furniture_Smith": {
      "modules": [...],
      "attributes": [...]
    }
  },
  "articles": [
    {
      "libraryId": "Furniture_Smith",
      "catalog": "Furniture_Smith",
      "articleId": "SB_UB600S",
      "articleName": "SB_BD600DR",
      "desc": "Sideboard with 1 door, 1 drawer",
      "imageUrl": "https://.../SB_UB600S.png?sv=...",
      "category": "Living | Sideboard",
      "isConfigDummy": false,
      "roots": [
        {
          "articlePos": [0, 0, 0],
          "quantity": 1,
          "posData": [],
          "id": "4cf70f7d-6b72-4d15-88de-1679db1a8fe9",
          "name": "mr_StorageunitSingle",
          "modules": [...],
          "attributes": [
            {"id": "mod_Depth", "value": "350", "isInput": true, "isHidden": false},
            {"id": "mod_Height", "value": "900", "isInput": true, "isHidden": false},
            {"id": "mod_Width", "value": "600", "isInput": true},
            ...
          ]
        }
      ]
    }
  ]
}
```

---

## HiPlanContext Section Details

`getExternalObjectPlanContext(include?)` takes an optional list of sections (`'masterData' | 'rooms' | 'articles' | 'groups'`) and returns all of them when the list is omitted or empty. The fetch script calls it without arguments. For Furniture_Smith (2026-09-27) the file has 26,562 lines (1.2 MB):

- `masterData` — per library all modules (47) and all attributes (398), with every field of the library: modules with `assignedAttributes`, `moduleType`, `isRoot`, `allowedChildModules`, …; attributes with `type`, `isMain`, `userRight`, `group`, `selections`, `desc`, `imageUrl` (the material swatches), …
- `rooms` — the room information of the plan: per room its `levels` with the contour segments
- `articles` — the article catalog (111 articles): per article `articleId`, `articleName`, `desc`, `imageUrl`, `category` and the article template in `roots` (root module `name`, sub-`modules` and the attribute values in `attributes`)
- `groups` — the groups currently loaded in the plan (none in the preset plan)

The attribute and module names of an article are in the master data: `article.roots[0].name` is a module id, `attributes[].id` an attribute id.

---

## Automating the Process

```bash
node .agents/scripts/fetch-hi-plan-context.js && node .agents/scripts/generate-article-catalog.js
```

---

## Troubleshooting

### "Port 3101 is already in use"
**Cause:** A previous run is still waiting for the page  
**Solution:** Stop it (`lsof -ti tcp:3101 | xargs kill`) and run the script again

### The Script Keeps Waiting
**Cause:** The page could not load the scene or fetch the plan context  
**Solution:** The status bar of the page shows `Fetching the plan context failed: …`; the browser console has the details

### Wrong Library Data or Empty Articles Array
**Cause:** Wrong backend, library or language in the page  
**Solution:** Check `BACKEND_ID` (`HI_PRE_Roomle_Milestone_2`), `LIBRARY_ID` (`Furniture_Smith`) and `LANGUAGE` (`en`) in `.agents/scripts/fetch-hi-plan-context.html`

### Missing Dimensions
**Cause:** Some articles don't define all dimension attributes  
**Solution:** This is expected for certain article types. The script uses `?` as fallback.

---

## Related Files

- `.agents/scripts/fetch-hi-plan-context.js` — Fetch script: serves the page, writes `hi-plan-context.json`
- `.agents/scripts/fetch-hi-plan-context.html` — Page that loads the scene and calls `getExternalObjectPlanContext()` (backend, library and language constants)
- `.agents/scripts/generate-article-catalog.js` — Generator: writes `articles.md` from `hi-plan-context.json`
- `minimal-hi-example/index.html` — The example the page is derived from
- `docs/library-information/hi-plan-context.json` — Raw HiPlanContext data
- `docs/library-information/articles.md` — Generated markdown catalog
- `.agents/skills/hi-furniture-smith-article-catalog.md` — This skill document

---

## See Also

- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model

---

## Materials Catalog Generation

`docs/library-information/materials.md` is generated from the same `hi-plan-context.json` by the [materials skill](./hi-furniture-smith-materials.md); its thumbnails are the selection `imageUrl`s of that file.

---

## Material Thumbnail Source

**Question**: Where do the material/color thumbnails come from in the Roomle HI Planner UI?

**Answer**: Each thumbnail is the `imageUrl` of an attribute selection in the HI master data. The kernel copies every `selection.imageUrl` into the thumbnail of the parameter value when `uiConfiguration.showThumbnails` is on. `getExternalObjectPlanContext()` returns these `imageUrl`s, so `hi-plan-context.json` contains them, e.g. in the selections of `mod_FrontColor`.

### URL Pattern

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- A read-only SAS URL of one Azure blob: the image GUID is random and the signature is bound to that blob, so the URL cannot be built from the material value
- Without the signature the CDN answers `409 PublicAccessNotPermitted`
- The signature is valid for about a month (`st` to `se`); after that, regenerate `hi-plan-context.json`, `articles.md` and `materials.md` (see the [materials skill](./hi-furniture-smith-materials.md))

### Material Values

The material values are defined in the `masterData.Furniture_Smith.attributes` where:
- `type` = "Text"
- `name` or `desc` contains "Color"
- Each selection has a `value` (a numeric code for the 21 finishes, a name like `Inox` for hardware and glass) and a `name`

