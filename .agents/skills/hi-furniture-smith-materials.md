# HI Furniture_Smith Materials Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Extract and document all material colors/finishes from the Furniture_Smith library  
> **Use When:** Need to reference available colors, materials, or finishes for HI planning

---

## Overview

This skill documents the process to extract material data (colors and finishes) from the Roomle HOMAG Intelligence (HI) system's master data and generate a structured markdown table.

The process reads the Furniture_Smith master data (`docs/library-information/master-data.json`) and extracts all "Text" type attributes that contain "Color" in their name or description, then compiles their selections into a deduplicated, sorted table of materials with the description (`desc`), the swatch thumbnail (`imageUrl`), and the **color code**. Materials without thumbnail (no `imageUrl` in any selection) are filtered out.

**IMPORTANT:** The color code of a material is the `#RRGGBB` code its description carries (`Cloudy blue (#506080)`): the library states the color, and the code is taken as it is. Only a material whose description has no code gets a color **calculated by analyzing the pixels of its thumbnail with Sharp** — never guessed from its name. With the Furniture_Smith data of 2026-10-07 every description carries its code, so no thumbnail is analysed.

---

## Prerequisites

1. **Master data JSON** — The file `docs/library-information/master-data.json` must exist. Generate it using the process described in [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md#step-1-fetch-the-library-data):
   ```bash
   node .agents/scripts/fetch-hi-library-data.js
   ```

2. **Node.js 18+** — Required for color extraction

3. **Dependencies** — Install in `.agents/scripts/`:
   ```bash
   cd .agents/scripts
   npm install
   ```
   This installs `sharp` and `node-fetch` for image processing.

---

## Data Flow

```
master-data.json (fetched directly from the HOMAG backend)
    ↓ Extract attributes
Filter: type == Text AND (name OR desc contains "Color")
    ↓ Extract selections from each attribute (name, value, desc, imageUrl)
Filter: selection has an imageUrl (thumbnail)
Deduplicate by value
    ↓ Sort by numeric value
    ↓ Take the color code of the description where it carries one
    ↓ Only for a material without a code:
        download its thumbnail, analyze the pixel data with Sharp,
        calculate the dominant color
    ↓ Add the color code to the description unless it has one
Markdown Table (materials.md) with Suggested Color and Suggested Description columns
```

---

## Step-by-Step Process

### Step 1: Fetch the library data (if not already done)

Use the process from [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md) to fetch the master data:

```bash
node .agents/scripts/fetch-hi-library-data.js
```

The `imageUrl`s are signed and valid for about a month (see [Thumbnails](#thumbnails)).

### Step 2: Install Dependencies

```bash
cd .agents/scripts
npm install
```

This installs:
- **sharp** - High performance image processing library
- **node-fetch** - For downloading images

### Step 3: Generate the Materials Table

Use this JavaScript script to extract the materials and their colors:

```bash
node .agents/scripts/extract-dominant-color-from-image.js --all
```

This script will:
- Take the color code of every description that carries one (`(from desc)` in its output)
- Download and analyze, with Sharp, only the thumbnails of materials without a code — none with the Furniture_Smith data of 2026-10-07
- Generate the materials.md table

**Options:**
```bash
# Regenerate materials.md
node .agents/scripts/extract-dominant-color-from-image.js --all

# List all materials with their colors
node .agents/scripts/extract-dominant-color-from-image.js --all --list-colors

# Custom input/output paths
node .agents/scripts/extract-dominant-color-from-image.js --all \
  --input custom/master-data.json \
  --output custom/materials.md

# Verify color for a single image
node .agents/scripts/extract-dominant-color-from-image.js --verify "https://.../152.jpg" "Cloudy blue"

# Dry run (show output without writing)
node .agents/scripts/extract-dominant-color-from-image.js --all --dry-run
```

### Step 4: Commit Changes

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
git add docs/library-information/master-data.json docs/library-information/materials.md
git commit -m "docs: update the Furniture_Smith materials catalog"
```

---

## Color Extraction Algorithm

The materials table includes a **Suggested Color** column with the hex color code of each material:

1. **The description's code** — a description that carries a `#RRGGBB` code (`Cloudy blue (#506080)`) gives the color, taken as it is. The library states the color of the value; nothing is downloaded. The MCP server's agent trusts the same code (D53 in [the behaviour reference](../../docs/hi-mcp-behaviour.md#3-decisions)).
2. **The thumbnail's pixels** — only a material whose description has no code gets its color calculated from its thumbnail with the Sharp library, as below.

### Why Accuracy Matters

Initial attempts to map material names to predefined colors produced **INACCURATE** results:

| Material | Name-Based Guess | Actual Image Color | Correct? |
|---|---|---|---|
| Cloudy blue | `#6989B0` | `#506080` | ❌ No |
| Denim blue | `#1E90FF` | `#102040` | ❌ No |
| Dark walnut | `#4A3728` | `#906040` | ❌ No |
| Dark marble | `#483D8B` | `#404040` | ❌ No (purple vs gray!) |

A name is no source of a color: the description's code is, and for a material without one the pixels of its thumbnail.

### Algorithm Steps (JavaScript/Sharp)

For each material whose description carries no code, the algorithm performs:

1. **Download**: Fetch the image from the TecConfig CDN URL using node-fetch
2. **Resize**: Scale to 100x100px using Sharp (maintains color distribution, faster processing)
3. **Get Raw Pixels**: Extract RGB data for all pixels
4. **Quantize**: Group similar colors by rounding RGB values to nearest 16 (reduces 16.7M colors to ~4000)
5. **Sample**: Take pixels at regular intervals (20x20 grid = 400 samples)
6. **Count**: Count occurrences of each quantized color
7. **Find Dominant**: Select the most frequent quantized color
8. **Convert to Hex**: Format as `#RRGGBB`

This approach works for:
- **Uniform color swatches** (blues, greens, whites, blacks) - exact match
- **Textured materials** (wood, marble, stone) - finds the average/dominant color that best represents the material

### Colors of the Materials

[`docs/library-information/materials.md`](../../docs/library-information/materials.md) lists every material with its thumbnail, description and color — 48 materials since the library refresh of 2026-10-07, every one with the code in its description.

### Color Preview in Markdown

The **Suggested Color** column in the generated markdown uses an inline math formula to display a color preview:

```markdown
$\color{#506080}\blacksquare$ #506080
```

This renders as a small colored square followed by the hex code, providing both visual and text representation. GitHub renders the formula as inline math; an HTML `<span style="...">` preview does not work there, because GitHub removes `style` attributes.

---

## Thumbnails

The swatches the planner shows for a color attribute (e.g. FRONT COLOR) are the `imageUrl`s of the attribute selections: the kernel copies each `selection.imageUrl` into the thumbnail of the parameter value when `uiConfiguration.showThumbnails` is on, and the master data fetch returns them unchanged.

Each `imageUrl` is a read-only SAS URL of an Azure blob on the TecConfig CDN:

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- The image GUID is random and the signature is bound to the exact blob, so the URL cannot be built from the material value; without the signature the CDN answers `409 PublicAccessNotPermitted`
- The signature is valid for about a month (`st` to `se`); within that window the image needs no authentication, e.g. `curl -o 152.png '<imageUrl>'`
- Light grey (178) is the only material with two different swatches: `mod_FrontColor`, `mod_CarcaseColor` and `mod_CarcaseOutsideColor` use one, `mod_PaneltopColor`, `mod_UprightColor` and `mod_Color` a slightly warmer one. The table shows the first, the one of `mod_PaneltopColor`

---

## Attribute Details

The materials are extracted from the following attribute types in Furniture_Smith:

- **mod_PaneltopColor** - Color of the panel top
- **mod_FrontColor** - Color of the front
- **mod_CarcaseColor** - Color of the carcase inside and outside if not visible
- **mod_CarcaseOutsideColor** - Outside color of the carcase
- **mod_UprightColor** - Color of the upright
- **mod_Color** - Generic color attribute

All these attributes have `type: "Text"` and contain "Color" in their name or description.

---

## Materials Table Structure

The generated table has 6 columns:

### 1. Name
- **Source:** `selection.name` from each attribute's selections array
- **Type:** String
- **Example:** `"Sunny white"`, `"Dark walnut"`, `"Concrete"`
- **Description:** Human-readable name of the material/color

### 2. Value
- **Source:** `selection.value` from each attribute's selections array
- **Type:** Numeric string (representing color codes)
- **Example:** `"190"`, `"214"`, `"316"`
- **Description:** Numeric code identifier for the material
- **Sorting:** Materials are sorted ascending by this numeric value

### 3. Thumbnail
- **Source:** `selection.imageUrl` from each attribute's selections array
- **Type:** Markdown image of the signed `imageUrl`
- **Description:** Swatch the planner shows for the material; valid until the signature expires (see [Thumbnails](#thumbnails))

### 4. Description
- **Source:** `selection.desc` from each attribute's selections array
- **Type:** String
- **Example:** `"Sunny white (#F0F0E0)"`, `"Concrete (#808080)"` (for Furniture_Smith every material's desc is its name followed by its color code)
- **Description:** The description the library gives the material

### 5. Suggested Color
- **Source:** the `#RRGGBB` code of `selection.desc`; for a material whose description has no code, **calculated by analyzing the pixels of its thumbnail** with the Sharp library
- **Type:** Inline math color square + hex color code
- **Example:** `$\color{#506080}\blacksquare$ #506080`
- **Description:** Hex color code of the material, with a visual color preview.
- **Format:** `#RRGGBB` hexadecimal color code
- **Preview:** Each color is displayed as a colored square before the hex code

### 6. Suggested Description (NEW)
- **Source:** `selection.desc`, with the extracted color code added when the description has none
- **Type:** String
- **Example:** `"Cloudy blue (#506080)"`, `"Dark walnut (#906040)"`
- **Description:** A combined identifier that includes both the material description and its dominant color code (hex only, without the preview). Useful for quick identification and as a compact reference.
- **Format:** `{Description}` when the description already contains a hex color code (`#RRGGBB`), as every Furniture_Smith description does; otherwise `{Description} ({ColorCode})`, or the color code alone when the description is empty

---

## Complete Attribute Example

```json
{
  "id": "mod_FrontColor",
  "name": "Front color",
  "desc": "Color of the front",
  "imageUrl": "https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/4cebd23d-e05d-485f-8726-947230d62f88_frontcolor.png?sv=...&sig=...",
  "type": "Text",
  "group": "Front | Design",
  "selections": [
    {
      "value": "316",
      "desc": "Concrete (#808080)",
      "name": "Concrete",
      "imageUrl": "https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/3e219bf4-0d63-4eb1-86c4-96a9e69c052b_316_concrete.jpg?sv=...&sig=..."
    },
    {
      "value": "326",
      "desc": "Slate (#303030)",
      "name": "Slate",
      "imageUrl": "https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/180cf5df-60d8-4179-bd00-fafd65ee74ef_326_slate.jpg?sv=...&sig=..."
    }
  ]
}
```

`mod_FrontColor` lists all 21 materials; the example shows the first two.

---

## Current Materials

[`docs/library-information/materials.md`](../../docs/library-information/materials.md) lists the current materials with their values, colors and descriptions.

---

## Usage

When planning with HI MCP, use the material values (e.g., "190" for Sunny white) when setting color attributes on articles or groups.

---

## Related Files

- `docs/library-information/master-data.json` — Source master data (generated using [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md))
- `docs/library-information/materials.md` — Generated materials table with colors and suggested descriptions
- `.agents/scripts/extract-dominant-color-from-image.js` — JavaScript color extraction script (uses Sharp)
- `.agents/scripts/package.json` — Dependencies for the color extraction script
- `.agents/skills/hi-furniture-smith-article-catalog.md` — Article catalog generation skill (describes how to create article.json and master-data.json)
- `.agents/skills/hi-furniture-smith-materials.md` — This skill document

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model
