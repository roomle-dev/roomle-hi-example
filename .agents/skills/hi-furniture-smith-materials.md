# HI Furniture_Smith Materials Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Extract and document all material colors/finishes from the Furniture_Smith library  
> **Use When:** Need to reference available colors, materials, or finishes for HI planning

---

## Overview

This skill documents the process to extract material data (colors and finishes) from the Roomle HOMAG Intelligence (HI) system's master data and generate a structured markdown table.

The process retrieves the `HiPlanContext` object and extracts all "Text" type attributes that contain "Color" in their name or description, then compiles their selections into a deduplicated, sorted table of materials. The swatch thumbnails of the materials are downloaded from the raw HI master data into `docs/library-information/images/materials/`.

---

## Prerequisites

1. **HiPlanContext JSON** — The file `docs/library-information/hi-plan-context.json` must exist (generated via the `get-plan-context` MCP tool)

2. **Node.js** — Required only if regenerating the HiPlanContext JSON

3. **HI test credential** — Required only for downloading thumbnails: the `user:password` that `HI_AUTH_DATA` in `minimal-hi-example/index.html` encodes

---

## Data Flow

```
HiPlanContext JSON (from get-plan-context tool)
    ↓ Extract masterData.Furniture_Smith.attributes
Filter: type == Text AND (name OR desc contains "Color")
    ↓ Extract selections from each attribute
Deduplicate by value
    ↓ Sort by numeric value
Markdown Table (materials.md)
    ↑ Thumbnail column links the downloaded images
Raw master data (HI proxy) → mod_FrontColor selections → imageUrl → images/materials/{value}.png
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

### Step 2: Download Thumbnails

The swatches the planner shows for a color attribute (e.g. FRONT COLOR) are the `imageUrl`s of the attribute selections: the kernel copies each `selection.imageUrl` into the thumbnail of the parameter value when `uiConfiguration.showThumbnails` is on. `get-plan-context` drops these `imageUrl`s from its compact masterData, so they are read from the raw master data, which the page loads through the HI test proxy.

Each `imageUrl` is a read-only SAS URL of an Azure blob on the TecConfig CDN:

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- The image GUID is random and the signature is bound to the exact blob, so the URL cannot be built from the material value; without the signature the CDN answers `409 PublicAccessNotPermitted`
- The signature is valid for about a month (`st` to `se`); within that window the image needs no authentication, e.g. `curl -o 152.png '<imageUrl>'`
- Some blobs are PNG data under a `.jpg` name (served as `image/jpeg`), so the file extension is taken from the image data
- `mod_FrontColor` carries all 21 materials. Light grey (178) is the only material with two different swatches: `mod_FrontColor`, `mod_CarcaseColor` and `mod_ToekickColor` use one, `mod_PaneltopColor`, `mod_UprightColor` and `mod_Color` a slightly warmer one

```bash
export HI_TEST_AUTH="$(grep -oE "btoa\('[^']+'\)" minimal-hi-example/index.html | head -1 | sed -E "s/btoa\('([^']+)'\)/\1/")"
python3 << 'PYEOF'
import base64, json, os, urllib.parse, urllib.request

BACKEND_ID = 'HI_PRE_Roomle_Milestone_2'
LIBRARY_ID = 'Furniture_Smith'
PROXY_URL = 'https://dfscfgtest01-app.azurewebsites.net/proxy_request'
OUT_DIR = 'docs/library-information/images/materials'

auth = 'Basic ' + base64.b64encode(os.environ['HI_TEST_AUTH'].encode()).decode()
query = urllib.parse.urlencode({'backendId': BACKEND_ID, 'url': f'api/pos/libraries/{LIBRARY_ID}/masterData'})
request = urllib.request.Request(f'{PROXY_URL}?{query}', headers={'Authorization': auth, 'Accept-Language': 'en-US,en'})
with urllib.request.urlopen(request) as response:
    master_data = json.load(response)

front_color = next(a for a in master_data['attributes'] if a['id'] == 'mod_FrontColor')
os.makedirs(OUT_DIR, exist_ok=True)
for selection in front_color['selections']:
    with urllib.request.urlopen(selection['imageUrl']) as response:
        image = response.read()
    extension = '.png' if image.startswith(b'\x89PNG') else '.jpg'
    target = os.path.join(OUT_DIR, selection['value'] + extension)
    with open(target, 'wb') as file:
        file.write(image)
    print(f"{selection['value']} {selection['name']} -> {target}")
PYEOF
```

**Explanation:**
- Reads the HI test credential from `HI_AUTH_DATA` in `minimal-hi-example/index.html`
- Loads the raw `Furniture_Smith` master data through the HI test proxy (`backendId` selects the HI backend, `url` is the TecConfig API path)
- Downloads the `imageUrl` of every `mod_FrontColor` selection to `docs/library-information/images/materials/{value}.png`

### Step 3: Generate Materials Table

Use this Python script to extract materials from the HiPlanContext and link the thumbnails downloaded in Step 2:

````bash
python3 << 'PYEOF'
import json
import os

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
            # Use value as key to deduplicate
            if value not in materials:
                materials[value] = name

# Sort by numeric value
sorted_values = sorted(materials.keys(), key=lambda x: float(x) if str(x).replace('.', '').replace('-', '').isdigit() else 9999)

# Thumbnails downloaded in Step 2, keyed by value
thumbnail_dir = 'docs/library-information/images/materials'
thumbnails = {os.path.splitext(file_name)[0]: file_name for file_name in os.listdir(thumbnail_dir)}

header = '''# Materials

This document lists all materials (colors) from the Furniture_Smith library.

## Source

Data extracted from `HiPlanContext.masterData.Furniture_Smith.attributes` where type is Text and name/desc contains "Color".

## Thumbnails

The thumbnails are the swatches the planner shows for a color attribute (e.g. FRONT COLOR). They are stored in [`images/materials/`](./images/materials/), downloaded from the `mod_FrontColor` selections of the Furniture_Smith master data.

In the HI master data every attribute selection carries an `imageUrl`, a read-only SAS URL of a blob on the HOMAG TecConfig CDN:

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- `{subscription_id}` = `e2fe8b3d-da31-4a20-92ab-ab6e3839300e`
- `{image_guid}` is random per image, so the URL cannot be built from the material value
- The signature is bound to the exact blob; without it the CDN answers `409 PublicAccessNotPermitted`
- The signature is valid for about a month (`st` to `se`), so a download needs a fresh master data response

`get-plan-context` leaves the selection `imageUrl`s out of its compact masterData, so `hi-plan-context.json` does not contain them. The download process is described in [hi-furniture-smith-materials.md](../../.agents/skills/hi-furniture-smith-materials.md).

## Materials

| Name | Value | Thumbnail |
|---|---|---|
'''

# Write markdown file
with open('docs/library-information/materials.md', 'w') as f:
    f.write(header)
    for value in sorted_values:
        name = materials[value]
        thumbnail = f'![{name}](images/materials/{thumbnails[value]})' if value in thumbnails else ''
        f.write(f'| {name} | {value} | {thumbnail} |\n')

print(f'Generated materials.md with {len(materials)} materials')
PYEOF
````

**Explanation:**
- Loads `hi-plan-context.json`
- Extracts `masterData.Furniture_Smith.attributes`
- Filters for attributes where `type == Text` AND (`name` OR `desc` contains "Color")
- Collects all `selections` from matching attributes
- Deduplicates by `value` (same color code used across multiple attributes)
- Sorts by numeric value
- Links each value to its thumbnail in `docs/library-information/images/materials/`
- Writes markdown table to `docs/library-information/materials.md`

### Step 4: Commit Changes

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
git add docs/library-information/materials.md docs/library-information/images/materials
git commit -m "docs: update Furniture_Smith materials catalog"
```

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

The generated table has 3 columns:

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
- **Source:** The image downloaded in Step 2 for the value
- **Type:** Markdown image of `images/materials/{value}.png`
- **Description:** Swatch the planner shows for the material; empty when no image was downloaded for the value

---

## Complete Attribute Example

```json
{
  "id": "mod_FrontColor",
  "name": "Front color",
  "desc": "Color of the front",
  "type": "Text",
  "group": "Front | Design",
  "selections": [
    {"value": "152", "name": "Cloudy blue"},
    {"value": "155", "name": "Denim blue"},
    {"value": "160", "name": "Olive green"},
    {"value": "165", "name": "Seaweed green"},
    {"value": "178", "name": "Light grey"},
    {"value": "190", "name": "Sunny white"},
    {"value": "192", "name": "Snow white"},
    {"value": "199", "name": "Jet black"},
    {"value": "214", "name": "Dark walnut"},
    {"value": "215", "name": "Walnut"},
    {"value": "216", "name": "Tiepolo walnut"},
    {"value": "222", "name": "Oak"},
    {"value": "224", "name": "Bijoux oak"},
    {"value": "229", "name": "Dark oak"},
    {"value": "230", "name": "Maple"},
    {"value": "240", "name": "Ash grey"},
    {"value": "250", "name": "Ponderosa pine"},
    {"value": "316", "name": "Concrete"},
    {"value": "324", "name": "Dark marble"},
    {"value": "326", "name": "Slate"},
    {"value": "380", "name": "Marble"}
  ]
}
```

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
- `docs/library-information/images/materials/` — Downloaded material thumbnails
- `.agents/skills/hi-furniture-smith-article-catalog.md` — Article catalog generation skill
- `.agents/skills/hi-furniture-smith-materials.md` — This skill document

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model
