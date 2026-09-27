# HI Furniture_Smith Materials Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Extract and document all material colors/finishes from the Furniture_Smith library  
> **Use When:** Need to reference available colors, materials, or finishes for HI planning

---

## Overview

This skill documents the process to extract material data (colors and finishes) from the Roomle HOMAG Intelligence (HI) system's master data and generate a structured markdown table.

The process retrieves the `HiPlanContext` object and extracts all "Text" type attributes that contain "Color" in their name or description, then compiles their selections into a deduplicated, sorted table of materials with the description (`desc`), the swatch thumbnail (`imageUrl`), and the **color code calculated from actual image pixels**. Materials without thumbnail (no `imageUrl` in any selection) are filtered out.

**IMPORTANT:** The color codes are **calculated by analyzing actual image pixels using Sharp**, NOT guessed from material names. This ensures accurate color representation for all materials.

---

## Prerequisites

1. **HiPlanContext JSON** — The file `docs/library-information/hi-plan-context.json` must exist. Generate it using the process described in [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md#step-1-fetch-hiplancontext-json):
   ```bash
   node .agents/scripts/fetch-hi-plan-context.js
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
HiPlanContext JSON (from getExternalObjectPlanContext)
    ↓ Extract masterData.Furniture_Smith.attributes
Filter: type == Text AND (name OR desc contains "Color")
    ↓ Extract selections from each attribute (name, value, desc, imageUrl)
Filter: selection has an imageUrl (thumbnail)
Deduplicate by value
    ↓ Sort by numeric value
    ↓ Download thumbnail images
    ↓ Analyze pixel data with Sharp
    ↓ Calculate dominant color for each
    ↓ Combine description with color code
Markdown Table (materials.md) with Suggested Color and Suggested Description columns
```

---

## Step-by-Step Process

### Step 1: Generate HiPlanContext JSON (if not already done)

Use the process from [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md) to fetch the HiPlanContext:

```bash
node .agents/scripts/fetch-hi-plan-context.js
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

### Step 3: Generate Materials Table with Accurate Colors

Use this JavaScript script to extract materials and calculate their colors from actual image pixels:

```bash
node .agents/scripts/extract-dominant-color-from-image.js --all-from-context
```

This script will:
- Download all 21 thumbnail images from the TecConfig CDN
- Analyze the actual pixel data of each image using Sharp
- Calculate the dominant color for each material
- Generate the materials.md table with the accurate colors

**First run** will take ~10-20 seconds to download and process all images.

**Options:**
```bash
# Regenerate materials.md with accurate colors
node .agents/scripts/extract-dominant-color-from-image.js --all-from-context

# List all materials with their accurately calculated colors
node .agents/scripts/extract-dominant-color-from-image.js --all-from-context --list-colors

# Custom input/output paths
node .agents/scripts/extract-dominant-color-from-image.js --all-from-context \
  --input custom/hi-plan-context.json \
  --output custom/materials.md

# Verify color for a single image
node .agents/scripts/extract-dominant-color-from-image.js --verify "https://.../152.jpg" "Cloudy blue"

# Dry run (show output without writing)
node .agents/scripts/extract-dominant-color-from-image.js --all-from-context --dry-run
```

### Step 4: Commit Changes

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
git add docs/library-information/hi-plan-context.json docs/library-information/materials.md
node .agents/scripts/extract-dominant-color-from-image.js --all-from-context
git add docs/library-information/materials.md
git commit -m "docs: update Furniture_Smith materials catalog with accurately calculated colors from image pixels"
```

---

## Color Extraction Algorithm

The materials table includes a **Suggested Color** column that contains hex color codes **calculated by analyzing actual image pixels** using Sharp library. This is NOT guessed from material names.

### Why Accuracy Matters

Initial attempts to map material names to predefined colors produced **INACCURATE** results:

| Material | Name-Based Guess | Actual Image Color | Correct? |
|---|---|---|---|
| Cloudy blue | `#6989B0` | `#506080` | ❌ No |
| Denim blue | `#1E90FF` | `#102040` | ❌ No |
| Dark walnut | `#4A3728` | `#906040` | ❌ No |
| Dark marble | `#483D8B` | `#404040` | ❌ No (purple vs gray!) |

The only accurate method is to **calculate from actual image pixels**.

### Algorithm Steps (JavaScript/Sharp)

For each material thumbnail, the algorithm performs:

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

### Calculated Colors (From Actual Images via Sharp)

The following are the **accurate** colors calculated from the actual Furniture_Smith thumbnail images:

| Material | Value | Hex Color |
|---|---|---|
| Cloudy blue | 152 | `#506080` |
| Denim blue | 155 | `#102040` |
| Olive green | 160 | `#909060` |
| Seaweed green | 165 | `#606040` |
| Light grey | 178 | `#D0C0C0` |
| Sunny white | 190 | `#F0F0E0` |
| Snow white | 192 | `#F0F0F0` |
| Jet black | 199 | `#000000` |
| Dark walnut | 214 | `#906040` |
| Walnut | 215 | `#C09070` |
| Tiepolo walnut | 216 | `#705040` |
| Oak | 222 | `#704020` |
| Bijoux oak | 224 | `#806050` |
| Dark oak | 229 | `#101010` |
| Maple | 230 | `#E0D0C0` |
| Ash grey | 240 | `#303030` |
| Ponderosa pine | 250 | `#909080` |
| Concrete | 316 | `#808080` |
| Dark marble | 324 | `#404040` |
| Slate | 326 | `#303030` |
| Marble | 380 | `#E0E0E0` |

### Color Preview in Markdown

The **Suggested Color** column in the generated markdown uses HTML inline styles to display a color preview:

```html
<span style="display:inline-block;width:20px;height:20px;background-color:#506080;border:1px solid #ccc;"></span> #506080
```

This renders as a small colored square followed by the hex code, providing both visual and text representation.

---

## Thumbnails

The swatches the planner shows for a color attribute (e.g. FRONT COLOR) are the `imageUrl`s of the attribute selections: the kernel copies each `selection.imageUrl` into the thumbnail of the parameter value when `uiConfiguration.showThumbnails` is on, and `getExternalObjectPlanContext()` returns them.

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
- **Example:** `"Sunny white"`, `"Concrete"` (for Furniture_Smith every material's desc equals its name)
- **Description:** The description the library gives the material

### 5. Suggested Color
- **Source:** **Calculated by analyzing actual image pixels** using Sharp library
- **Type:** HTML span with inline style + hex color code
- **Example:** `<span style="...background-color:#506080;..."></span> #506080`
- **Description:** Hex color code **calculated from the actual thumbnail image**, with a visual color preview. This provides accurate color representation for all materials.
- **Format:** `#RRGGBB` hexadecimal color code
- **Preview:** Each color is displayed as a 20x20px colored square before the hex code

### 6. Suggested Description (NEW)
- **Source:** Combination of `selection.desc` and the extracted color code
- **Type:** String
- **Example:** `"Cloudy blue (#506080)"`, `"Dark walnut (#906040)"`
- **Description:** A combined identifier that includes both the material description and its dominant color code (hex only, without HTML preview). Useful for quick identification and as a compact reference.
- **Format:** `{Description} ({ColorCode})`

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
      "desc": "Concrete",
      "name": "Concrete",
      "imageUrl": "https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/3e219bf4-0d63-4eb1-86c4-96a9e69c052b_316_concrete.jpg?sv=...&sig=..."
    },
    {
      "value": "326",
      "desc": "Slate",
      "name": "Slate",
      "imageUrl": "https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/180cf5df-60d8-4179-bd00-fafd65ee74ef_326_slate.jpg?sv=...&sig=..."
    }
  ]
}
```

`mod_FrontColor` lists all 21 materials; the example shows the first two.

---

## Current Materials

As of the latest HiPlanContext extraction, the Furniture_Smith library contains **21 materials** with accurately calculated colors and suggested descriptions:

| Name | Value | Accurate Color | Suggested Description |
|---|---|---|---|
| Cloudy blue | 152 | `#506080` | Cloudy blue (#506080) |
| Denim blue | 155 | `#102040` | Denim blue (#102040) |
| Olive green | 160 | `#909060` | Olive green (#909060) |
| Seaweed green | 165 | `#606040` | Seaweed green (#606040) |
| Light grey | 178 | `#D0C0C0` | Light grey (#D0C0C0) |
| Sunny white | 190 | `#F0F0E0` | Sunny white (#F0F0E0) |
| Snow white | 192 | `#F0F0F0` | Snow white (#F0F0F0) |
| Jet black | 199 | `#000000` | Jet black (#000000) |
| Dark walnut | 214 | `#906040` | Dark walnut (#906040) |
| Walnut | 215 | `#C09070` | Walnut (#C09070) |
| Tiepolo walnut | 216 | `#705040` | Tiepolo walnut (#705040) |
| Oak | 222 | `#704020` | Oak (#704020) |
| Bijoux oak | 224 | `#806050` | Bijoux oak (#806050) |
| Dark oak | 229 | `#101010` | Dark oak (#101010) |
| Maple | 230 | `#E0D0C0` | Maple (#E0D0C0) |
| Ash grey | 240 | `#303030` | Ash grey (#303030) |
| Ponderosa pine | 250 | `#909080` | Ponderosa pine (#909080) |
| Concrete | 316 | `#808080` | Concrete (#808080) |
| Dark marble | 324 | `#404040` | Dark marble (#404040) |
| Slate | 326 | `#303030` | Slate (#303030) |
| Marble | 380 | `#E0E0E0` | Marble (#E0E0E0) |

---

## Usage

When planning with HI MCP, use the material values (e.g., "190" for Sunny white) when setting color attributes on articles or groups.

---

## Related Files

- `docs/library-information/hi-plan-context.json` — Source HiPlanContext data (generated using [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md))
- `docs/library-information/materials.md` — Generated materials table with **accurately calculated** colors and suggested descriptions
- `.agents/scripts/extract-dominant-color-from-image.js` — JavaScript color extraction script (uses Sharp)
- `.agents/scripts/package.json` — Dependencies for the color extraction script
- `.agents/skills/hi-furniture-smith-article-catalog.md` — Article catalog generation skill (describes how to create hi-plan-context.json)
- `.agents/skills/hi-furniture-smith-materials.md` — This skill document

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model
