# HI Furniture_Smith Article Catalog Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Recreate Furniture_Smith article catalog with dimensions from the HOMAG backend library data  
> **Use When:** Library changes, new backend, or data refresh needed

---

## Overview

This skill documents the complete process to fetch article and master data for the Furniture_Smith library from the HOMAG backend and generate a structured markdown catalog with images, labels, descriptions, and dimensions.

The fetch script requests the article catalog and the master data directly from the HOMAG backend via its proxy server — no Roomle planner, no browser, no local HTTP server. It stores the articles (sub-articles filtered out) in `docs/library-information/article.json` and the master data in `docs/library-information/master-data.json`, and the generator script transforms the articles into a human-readable markdown table suitable for documentation and reference. No MCP server is involved.

---

## Prerequisites

1. **Node.js 18+** — Runs the fetch and generator scripts; they have no dependencies, no `npm install` needed

---

## Data Flow

```
node .agents/scripts/fetch-hi-library-data.js
    ↓ GET proxy_request?backendId=HI_PRE_Roomle_Milestone_2&url=api/pos/libraries/Furniture_Smith/articles
    ↓ GET proxy_request?backendId=HI_PRE_Roomle_Milestone_2&url=api/pos/libraries/Furniture_Smith/masterData
    ↓ https://dfscfgtest01-app.azurewebsites.net, Basic auth, Accept-Language: en
Articles ({ articles: [...] }, sub-articles with isConfigDummy filtered out)
    → docs/library-information/article.json
Master data ({ modules, attributes }) → docs/library-information/master-data.json
    ↓ node .agents/scripts/generate-article-catalog.js
Markdown Catalog (articles.md)
```

---

## Step-by-Step Process

### Step 1: Fetch the library data

```bash
node .agents/scripts/fetch-hi-library-data.js
```

- The script sends the two requests that `libLoadArticleCatalog` and `libLoadMasterData` of the roomle-ui embedding-lib send (`packages/embedding-lib/src/homag-intelligence/hi-requests.ts`): the URL-encoded relative path `api/pos/libraries/{libraryId}/{type}` after the proxy's `url=` parameter, with `Authorization` (Basic), `Accept-Language: en` and `Content-Type: application/json` headers
- Constants at the top of the script: `BACKEND_ID` (`HI_PRE_Roomle_Milestone_2`), `LIBRARY_ID` (`Furniture_Smith`), `LANGUAGE` (`en`), `PROXY_BASE_URL` (`https://dfscfgtest01-app.azurewebsites.net`), `AUTH_DATA`
- Articles are prepared the way `loadPosData` of the planner kernel does (`packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts`): the response is wrapped in `{ articles: [...] }` and every article with `isConfigDummy` is a sub-article and is filtered out (16 of 127 for Furniture_Smith, leaving 111 articles)
- `materialProviders` is dropped from the master data; no consumer needs it and the planner's plan context never contained it
- The script writes `docs/library-information/article.json` and `docs/library-information/master-data.json` (pretty-printed), prints both paths and the article count, and exits

A run takes a few seconds. `userRight` needs no handling: it is a planner UI setting, not a backend request parameter — the backend returns all attributes with their per-attribute `userRight` fields.

### Step 2: Generate Markdown Catalog

```bash
node .agents/scripts/generate-article-catalog.js
```

[`generate-article-catalog.js`](../scripts/generate-article-catalog.js) has no dependencies. It:
- Loads `docs/library-information/article.json`
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

The markdown table has 7 columns. Here is the exact source of each column from the `article.json` structure:

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

## JSON Structure


`article.json` contains the article catalog (111 articles, sub-articles filtered out), unchanged from the backend response:

```json
{
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

`master-data.json` contains the library master data (2026-09-28: 47 modules, 398 attributes, ~330 KB):

- `modules` — all modules with every field of the library: `assignedAttributes`, `moduleType`, `isRoot`, `allowedChildModules`, …
- `attributes` — all attributes with `type`, `isMain`, `userRight`, `group`, `selections`, `desc`, `imageUrl` (the material swatches), …
- `materialProviders` is stripped by the fetch script

The attribute and module names of an article are in the master data: `article.roots[0].name` is a module id, `attributes[].id` an attribute id.

---

## Automating the Process

```bash
node .agents/scripts/fetch-hi-library-data.js && node .agents/scripts/generate-article-catalog.js
```

---

## Troubleshooting

### The Script Fails with an HTTP Error
**Cause:** The proxy or the backend rejected the request  
**Solution:** The script prints the failing type (`articles` or `masterData`) with status and status text; check the constants `BACKEND_ID`, `LIBRARY_ID`, `LANGUAGE` and `AUTH_DATA` in `.agents/scripts/fetch-hi-library-data.js`

### Wrong Library Data or Empty Articles Array
**Cause:** Wrong backend, library or language in the script  
**Solution:** Check `BACKEND_ID` (`HI_PRE_Roomle_Milestone_2`), `LIBRARY_ID` (`Furniture_Smith`) and `LANGUAGE` (`en`) in `.agents/scripts/fetch-hi-library-data.js`

### Missing Dimensions
**Cause:** Some articles don't define all dimension attributes  
**Solution:** This is expected for certain article types. The script uses `?` as fallback.

---

## Related Files

- `.agents/scripts/fetch-hi-library-data.js` — Fetch script: requests articles and master data from the HOMAG backend proxy, writes `article.json` and `master-data.json`
- `.agents/scripts/generate-article-catalog.js` — Generator: writes `articles.md` from `article.json`
- `docs/library-information/article.json` — Article catalog data (sub-articles filtered out)
- `docs/library-information/master-data.json` — Library master data
- `docs/library-information/articles.md` — Generated markdown catalog
- `.agents/skills/hi-furniture-smith-article-catalog.md` — This skill document

---

## See Also

- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model

---

## Materials Catalog Generation

`docs/library-information/materials.md` is generated from the same `master-data.json` by the [materials skill](./hi-furniture-smith-materials.md); its thumbnails are the selection `imageUrl`s of that file.

---

## Material Thumbnail Source

**Question**: Where do the material/color thumbnails come from in the Roomle HI Planner UI?

**Answer**: Each thumbnail is the `imageUrl` of an attribute selection in the HI master data. The kernel copies every `selection.imageUrl` into the thumbnail of the parameter value when `uiConfiguration.showThumbnails` is on. The master data fetched from the backend contains these `imageUrl`s unchanged, so `master-data.json` contains them, e.g. in the selections of `mod_FrontColor`.

### URL Pattern

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- A read-only SAS URL of one Azure blob: the image GUID is random and the signature is bound to that blob, so the URL cannot be built from the material value
- Without the signature the CDN answers `409 PublicAccessNotPermitted`
- The signature is valid for about a month (`st` to `se`); after that, regenerate `master-data.json`, `articles.md` and `materials.md` (see the [materials skill](./hi-furniture-smith-materials.md))

### Material Values

The material values are defined in the `attributes` of `master-data.json` where:
- `type` = "Text"
- `name` or `desc` contains "Color"
- Each selection has a `value` (a numeric code for the 21 finishes, a name like `Inox` for hardware and glass) and a `name`
