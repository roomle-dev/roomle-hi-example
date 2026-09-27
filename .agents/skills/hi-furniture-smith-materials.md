# HI Furniture_Smith Materials Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Extract and document all material colors/finishes from the Furniture_Smith library  
> **Use When:** Need to reference available colors, materials, or finishes for HI planning

---

## Overview

This skill documents the process to extract material data (colors and finishes) from the Roomle HOMAG Intelligence (HI) system's master data and generate a structured markdown table.

The process retrieves the `HiPlanContext` object and extracts all "Text" type attributes that contain "Color" in their name or description, then compiles their selections into a deduplicated, sorted table of materials with the description (`desc`) and the swatch thumbnail (`imageUrl`) of each material.

---

## Prerequisites

1. **HiPlanContext JSON** — The file `docs/library-information/hi-plan-context.json` must exist (generated via the `get-plan-context` MCP tool, which keeps the `desc` and `imageUrl` of the selections)

2. **Node.js** — Required only if regenerating the HiPlanContext JSON

---

## Data Flow

```
HiPlanContext JSON (from get-plan-context tool)
    ↓ Extract masterData.Furniture_Smith.attributes
Filter: type == Text AND (name OR desc contains "Color")
    ↓ Extract selections from each attribute (name, value, desc, imageUrl)
Deduplicate by value
    ↓ Sort by numeric value
Markdown Table (materials.md)
```

---

## Step-by-Step Process

### Step 1: Generate HiPlanContext JSON (if not already done)

Use the process from [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md) to fetch the HiPlanContext:

```bash
curl -s -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{
      "name":"get-plan-context",
      "arguments":{
        "include":["masterData","rooms","articles","groups"]
      }
    }
  }' | jq -r '.result.content[0].text' > docs/library-information/hi-plan-context.json
```

The `imageUrl`s are signed and valid for about a month (see [Thumbnails](#thumbnails)): when the thumbnails stop showing, run Step 1 and Step 2 again.

### Step 2: Generate Materials Table

Use this Python script to extract materials from the HiPlanContext:

````bash
python3 << 'PYEOF'
import json
from urllib.parse import parse_qs, urlsplit

with open('docs/library-information/hi-plan-context.json', 'r') as f:
    data = json.load(f)

# Get master data
master_data = data.get('masterData', {})
fs = master_data.get('Furniture_Smith', {})
attributes = fs.get('attributes', [])

# Find all Text type attributes with Color in name or desc
color_attrs = []
for attr in attributes:
    if attr.get('type') == 'Text':
        name_lower = attr.get('name', '').lower()
        desc_lower = attr.get('desc', '').lower()
        if 'color' in name_lower or 'color' in desc_lower:
            color_attrs.append(attr)

# Extract all selections (materials) and deduplicate by value
materials = {}
for attr in color_attrs:
    for selection in attr.get('selections', []):
        value = selection.get('value')
        name = selection.get('name')
        if value and name:
            # Use value as key to deduplicate; the first selection provides name, desc and imageUrl
            if value not in materials:
                materials[value] = selection

# Sort by numeric value
sorted_values = sorted(materials.keys(), key=lambda x: float(x) if str(x).replace('.', '').replace('-', '').isdigit() else 9999)

# The thumbnails are signed URLs; the earliest signature expiry dates the document
thumbnail_urls = [selection['imageUrl'] for selection in materials.values() if selection.get('imageUrl')]
if not thumbnail_urls:
    raise SystemExit('hi-plan-context.json has no selection imageUrls - regenerate it (Step 1)')
expiry = min(parse_qs(urlsplit(url).query)['se'][0][:10] for url in thumbnail_urls)

header = '''# Materials

This document lists all materials (colors) from the Furniture_Smith library.

## Source

Data extracted from `HiPlanContext.masterData.Furniture_Smith.attributes` where type is Text and name/desc contains "Color".

## Thumbnails

The thumbnails are the swatches the planner shows for a color attribute (e.g. FRONT COLOR): the `imageUrl` of each selection in `hi-plan-context.json`, a read-only SAS URL of a blob on the HOMAG TecConfig CDN:

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- `{subscription_id}` = `e2fe8b3d-da31-4a20-92ab-ab6e3839300e`
- `{image_guid}` is random per image, so the URL cannot be built from the material value
- The signature is bound to the exact blob; without it the CDN answers `409 PublicAccessNotPermitted`
- The signatures in this document are valid until EXPIRY_DATE; after that the thumbnails stop showing until `hi-plan-context.json` and this document are regenerated

The generation process is described in [hi-furniture-smith-materials.md](../../.agents/skills/hi-furniture-smith-materials.md).

## Materials

| Name | Value | Thumbnail | Description |
|---|---|---|---|
'''.replace('EXPIRY_DATE', expiry)

# Write markdown file
with open('docs/library-information/materials.md', 'w') as f:
    f.write(header)
    for value in sorted_values:
        selection = materials[value]
        name = selection['name']
        thumbnail = f"![{name}]({selection['imageUrl']})" if selection.get('imageUrl') else ''
        f.write(f"| {name} | {value} | {thumbnail} | {selection.get('desc', '')} |\n")

print(f'Generated materials.md with {len(materials)} materials')
PYEOF
````

**Explanation:**
- Loads `hi-plan-context.json`
- Extracts `masterData.Furniture_Smith.attributes`
- Filters for attributes where `type == Text` AND (`name` OR `desc` contains "Color")
- Collects all `selections` from matching attributes
- Deduplicates by `value` (same color code used across multiple attributes); name, desc and imageUrl come from the first selection of a value
- Sorts by numeric value
- Writes markdown table to `docs/library-information/materials.md`, with the signature expiry of the thumbnails in its header

### Step 3: Commit Changes

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
git add docs/library-information/hi-plan-context.json docs/library-information/materials.md
git commit -m "docs: update Furniture_Smith materials catalog"
```

---

## Thumbnails

The swatches the planner shows for a color attribute (e.g. FRONT COLOR) are the `imageUrl`s of the attribute selections: the kernel copies each `selection.imageUrl` into the thumbnail of the parameter value when `uiConfiguration.showThumbnails` is on, and `get-plan-context` keeps them.

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

The generated table has 4 columns:

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

As of the latest HiPlanContext extraction, the Furniture_Smith library contains **21 materials**:

| Name | Value |
|---|---|
| Cloudy blue | 152 |
| Denim blue | 155 |
| Olive green | 160 |
| Seaweed green | 165 |
| Light grey | 178 |
| Sunny white | 190 |
| Snow white | 192 |
| Jet black | 199 |
| Dark walnut | 214 |
| Walnut | 215 |
| Tiepolo walnut | 216 |
| Oak | 222 |
| Bijoux oak | 224 |
| Dark oak | 229 |
| Maple | 230 |
| Ash grey | 240 |
| Ponderosa pine | 250 |
| Concrete | 316 |
| Dark marble | 324 |
| Slate | 326 |
| Marble | 380 |

---

## Usage

When planning with HI MCP, use the material values (e.g., "190" for Sunny white) when setting color attributes on articles or groups.

---

## Related Files

- `docs/library-information/hi-plan-context.json` — Source HiPlanContext data
- `docs/library-information/materials.md` — Generated materials table
- `.agents/skills/hi-furniture-smith-article-catalog.md` — Article catalog generation skill
- `.agents/skills/hi-furniture-smith-materials.md` — This skill document

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model
