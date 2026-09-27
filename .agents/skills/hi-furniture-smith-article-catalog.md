# HI Furniture_Smith Article Catalog Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Recreate Furniture_Smith article catalog with dimensions from Roomle HI plan context  
> **Use When:** Library changes, new backend, or data refresh needed

---

## Overview

This skill documents the complete process to extract article data from the Roomle HOMAG Intelligence (HI) system via the MCP server and generate a structured markdown catalog with images, labels, descriptions, and dimensions.

The process retrieves the plan context of the MCP `get-plan-context` tool (master data, rooms, articles, and groups, shaped for the agent) and transforms it into a human-readable markdown table suitable for documentation and reference.

---

## Prerequisites

1. **MCP Server Running** — The hi-mcp server from `roomle-hi-example` must be running with the correct parameters
   - URL: `http://localhost:3100/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`
   - The server must have a connected browser page with the Furniture_Smith library loaded

2. **Browser Page Open** — A Roomle planner page must be open at the URL above for the MCP bridge to work

3. **Node.js** — Required to start the MCP server if not already running

---

## Data Flow

```
Roomle Planner (Browser)
    ↓ roomDesignerApi.extended.getExternalObjectPlanContext()
HI Plan Context (HiPlanContext JSON)
    ↓ get-plan-context in the page: shapes the context for the agent
    ↓ MCP Bridge (SSE + fetch)
MCP Server (minimal-hi-example/hi-mcp-server.js)
    ↓ HTTP POST /mcp
Client (curl or MCP client)
    ↓ Extract and transform
Markdown Catalog (articles.md)
```

---

## Step-by-Step Process

### Step 1: Start MCP Server with Correct Parameters

The MCP server must open the browser with the Furniture_Smith library:

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
npm start
```

This automatically opens: `http://localhost:3100/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`

**Note:** The URL parameters are hardcoded as `exampleUrl` in `minimal-hi-example/hi-mcp-server.js`:
```javascript
const exampleUrl = `http://localhost:${PORT}/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`;
```

If the library changes, update this line and restart the server.

### Step 2: Verify Page Connection

The MCP server logs will show:
```
[hi-mcp] page connected: http://localhost:3100/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith
```

If no page is connected, the `get-plan-context` call will fail with:
```
No HI example page connected. Open the example with the mcp=true query parameter (http://localhost:3100/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith) and keep the tab open.
```

### Step 3: Fetch HiPlanContext JSON

Use curl to call the MCP endpoint:

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

**Explanation:**
- `get-plan-context` is the MCP tool that calls `roomDesignerApi.extended.getExternalObjectPlanContext()` in the page and shapes the result for the agent (see [HiPlanContext Section Details](#hiplancontext-section-details))
- The `include` parameter specifies which sections to fetch (all four sections for completeness)
- `jq -r '.result.content[0].text'` extracts the raw JSON from the MCP response wrapper
- Output is saved to `docs/library-information/hi-plan-context.json`

### Step 4: Create Directory Structure

```bash
mkdir -p docs/library-information
```

### Step 5: Generate Markdown Catalog

Use the Python script below to transform the JSON into a markdown table:

```bash
python3 << 'PYEOF'
import json
import re
import os

def generate_suggested_description(article_id, category, label, dimensions, desc, image_url):
    """
    Generate a technically accurate suggested description.
    Rules: use attributes like corner/low/high/wall for cabinets, name visible items,
    count drawers/doors/double doors, trust description but not blindly.
    """
    desc_lower = desc.lower()
    image_url_lower = image_url.lower()
    
    # Extract filename from image URL
    image_filename = os.path.basename(image_url.split('?')[0]).lower()
    article_id_upper = article_id.upper()
    
    # Parse dimensions
    depth = width = height = None
    dim_match = re.search(r'L\s+(\d+)\s*mm\s+W\s+(\d+)\s*mm\s+H\s+(\d+)\s*mm', dimensions)
    if dim_match:
        depth, width, height = [int(x) for x in dim_match.groups()]
    
    # Parse category hierarchy
    category_parts = [c.strip() for c in category.split('/') if c.strip()]
    main_category = category_parts[0] if category_parts else ""
    
    # Count components
    door_count = sum(int(m) for m in re.findall(r'(\d+)\s+door[s]?', desc_lower)) if re.findall(r'(\d+)\s+door[s]?', desc_lower) else 0
    drawer_count = sum(int(m) for m in re.findall(r'(\d+)\s+drawer[s]?', desc_lower)) if re.findall(r'(\d+)\s+drawer[s]?', desc_lower) else 0
    pullout_count = sum(int(m) for m in re.findall(r'(\d+)\s+pullout[s]?', desc_lower)) if re.findall(r'(\d+)\s+pullout[s]?', desc_lower) else 0
    fixed_front_count = sum(int(m) for m in re.findall(r'(\d+)\s+fixed\s+front[s]?', desc_lower)) if re.findall(r'(\d+)\s+fixed\s+front[s]?', desc_lower) else 0
    fridge_door_count = sum(int(m) for m in re.findall(r'(\d+)\s+fridge\s+door[s]?', desc_lower)) if re.findall(r'(\d+)\s+fridge\s+door[s]?', desc_lower) else 0
    
    # Boolean flags
    has_corner = 'corner' in desc_lower or 'corner' in category.lower()
    has_adjustable_shelves = 'adjustable shelves' in desc_lower
    has_heat_insulation = 'heat insulation' in desc_lower
    has_niche = 'niche' in desc_lower
    has_fixed_front = fixed_front_count > 0 or 'fixed front' in desc_lower
    has_sink = 'sink' in desc_lower
    has_oven = 'oven' in desc_lower
    has_fridge = 'fridge' in desc_lower or 'tf' in image_filename or 'fridge' in image_url_lower or article_id_upper.startswith('HK')
    has_range_hood = 'range hood' in desc_lower or 'dunstabzug' in desc_lower or 'du' in image_filename or article_id_upper == 'DU'
    has_dishwasher = 'dishwasher' in desc_lower or 'dwp' in image_filename or 'gsp' in image_filename
    has_hob = 'hob' in desc_lower
    has_tv = 'tv' in desc_lower or 'tv' in image_filename or article_id_upper == 'SM_TV'
    is_filler = 'filler' in desc_lower
    is_panel = 'panel' in desc_lower or 'Panel' in desc
    is_shelf = 'shelf' in desc_lower
    is_modular = 'modular' in desc_lower
    is_walk_in = 'walk in' in category.lower() or 'walkin' in category.lower()
    is_endless = 'endless' in category.lower()
    
    # Build description parts
    parts = []
    
    # Special cases
    if is_filler:
        if 'tall' in desc_lower:
            parts.append("Tall unit filler")
        elif 'wall' in desc_lower:
            parts.append("Wall unit filler")
        elif 'base' in desc_lower:
            parts.append("Base unit filler")
        else:
            parts.append("Filler")
        if 'direction left' in desc_lower:
            parts.append("direction left")
        elif 'direction right' in desc_lower:
            parts.append("direction right")
    elif is_panel:
        if 'side' in desc_lower:
            parts.append("Side panel")
        elif 'end' in desc_lower:
            parts.append("End panel")
        elif 'back' in desc_lower:
            parts.append("Back panel")
        elif 'wall' in desc_lower and 'unit' in desc_lower:
            parts.append("Wall unit side panel")
        elif 'tall' in desc_lower:
            parts.append("Kitchen end panel for tall units")
        elif 'base' in desc_lower:
            parts.append("Kitchen end panel for base units")
        else:
            parts.append("Panel")
    elif has_tv:
        parts.append("TV unit for decoration")
    elif is_modular:
        parts.append("Modular tall cabinet")
        if 'fronts' in desc_lower:
            parts.append("to add fronts")
    elif is_walk_in:
        parts.append("Walk-in closet cabinet")
        if '4 drawers' in desc_lower and 'shelves' in desc_lower:
            parts.append("4 drawers and shelves")
        elif 'shelves' in desc_lower:
            parts.append("with shelves")
        if has_niche:
            niche_count = 1
            niche_match = re.search(r'(\d+)\s+niche', desc_lower)
            if niche_match:
                niche_count = int(niche_match.group(1))
            parts.append(f"with {niche_count} niche{'s' if niche_count > 1 else ''}")
        if 'hanger' in desc_lower:
            if 'full height' in desc_lower:
                parts.append("for full height hanger")
            elif '2 small' in desc_lower:
                parts.append("with 2 small hangers")
            else:
                parts.append("with hanger")
    elif is_endless:
        if 'end' in category.lower():
            parts.append("Endless closet end cabinet")
        elif 'middle' in category.lower():
            parts.append("Endless closet middle cabinet")
        elif 'start' in category.lower():
            parts.append("Endless closet start cabinet")
        else:
            parts.append("Endless closet cabinet")
    else:
        # Standard cabinet descriptions
        if main_category == "Kitchen":
            if "Appliances" in category:
                if has_range_hood:
                    parts.append("Range hood")
                elif has_fridge:
                    fridge_count = fridge_door_count if fridge_door_count > 0 else 1
                    parts.append(f"Tall cabinet with {fridge_count} fridge door{'s' if fridge_count > 1 else ''}")
                elif has_oven:
                    parts.append("Tall cabinet with oven")
                elif has_dishwasher:
                    parts.append("Dishwasher unit")
                else:
                    parts.append("Appliance")
            elif "Wall Units" in category:
                parts.append("Wall cabinet")
            elif "Tall Units" in category:
                parts.append("Tall cabinet")
            elif "Base Units" in category:
                parts.append("Base cabinet")
            else:
                parts.append("Kitchen cabinet")
        elif main_category == "Living":
            if "Sideboard" in category:
                parts.append("Sideboard")
            elif "Wallunits" in category or "Tallunits" in category:
                parts.append("Wall unit")
            else:
                parts.append("Furniture")
        elif main_category == "Closet":
            parts.append("Closet cabinet")
        elif main_category == "Utility":
            if 'shelf' in desc_lower:
                parts.append("Wall unit")
            else:
                parts.append("Utility unit")
        else:
            parts.append("Cabinet")
        
        # Add corner attribute
        if has_corner and parts:
            parts[0] = f"Corner {parts[0].lower()}"
    
    # Add appliance/special features (avoid duplicates)
    existing_lower = " ".join(parts).lower()
    appliance_parts = []
    
    if has_sink and 'sink' not in existing_lower:
        appliance_parts.append("sink")
    if has_oven and 'oven' not in existing_lower:
        appliance_parts.append("oven")
    if has_range_hood and 'range hood' not in existing_lower:
        appliance_parts.append("range hood")
    if has_dishwasher and 'dishwasher' not in existing_lower:
        appliance_parts.append("dishwasher")
    if has_hob and 'hob' not in existing_lower:
        appliance_parts.append("hob")
    if has_heat_insulation and 'heat insulation' not in existing_lower:
        appliance_parts.append("heat insulation")
    if has_fixed_front and 'fixed front' not in existing_lower:
        front_count = fixed_front_count if fixed_front_count > 0 else 1
        appliance_parts.append(f"{front_count} fixed front{'s' if front_count > 1 else ''}")
    if has_adjustable_shelves and 'shelves' not in existing_lower:
        appliance_parts.append("adjustable shelves")
    if has_niche and 'niche' not in existing_lower:
        niche_count = 1
        niche_match = re.search(r'(\d+)\s+niche', desc_lower)
        if niche_match:
            niche_count = int(niche_match.group(1))
        appliance_parts.append(f"{niche_count} niche{'s' if niche_count > 1 else ''}")
    
    if appliance_parts:
        parts.extend(appliance_parts)
    
    # Add door/drawer/pullout counts
    component_parts = []
    if fridge_door_count > 0:
        component_parts.append(f"{fridge_door_count} fridge door{'s' if fridge_door_count > 1 else ''}")
    if door_count > 0:
        component_parts.append(f"{door_count} door{'s' if door_count > 1 else ''}")
    if drawer_count > 0:
        component_parts.append(f"{drawer_count} drawer{'s' if drawer_count > 1 else ''}")
    if pullout_count > 0:
        component_parts.append(f"{pullout_count} pullout{'s' if pullout_count > 1 else ''}")
    
    if component_parts:
        parts.extend(component_parts)
    
    # Join and capitalize
    result = ", ".join(parts)
    if result:
        result = result[0].upper() + result[1:]
    
    return result

with open('docs/library-information/hi-plan-context.json', 'r') as f:
    data = json.load(f)

header = """# Furniture_Smith Article Catalog

This document lists all articles from the Furniture_Smith library as displayed in the Roomle planner catalog with images, labels, descriptions, dimensions, and suggested descriptions.

## Source

Data extracted from `HiPlanContext` via MCP server's `get-plan-context` tool.

Image URLs are hosted on: `https://tecconfig-preview.homag.cloud/cdn/`

---

## Articles

| ID | Category | Label | Dimensions | Image | Description | Suggested Description |
|---|---|---|---|---|---|---|
"""

rows = []
for article in data['articles']:
    # Extract dimensions from rootModules[0].dimensions
    dims = {}
    if article.get('rootModules'):
        for d in article['rootModules'][0].get('dimensions', []):
            dims[d['id']] = d['value']
    
    depth = dims.get('mod_Depth', '?')
    width = dims.get('mod_Width', '?')
    height = dims.get('mod_Height', '?')
    dims_text = f"L {depth} mm W {width} mm H {height} mm"
    
    # Replace pipes in category with slashes (for markdown table compatibility)
    category = article.get('category', '').replace('|', '/')
    
    desc = article.get('desc', '')
    
    # Generate suggested description
    suggested_desc = generate_suggested_description(
        article['articleId'], category, article['articleName'],
        dims_text, desc, article.get('imageUrl', '')
    )
    row = f"| {article['articleId']} | {category} | {article['articleName']} | {dims_text} | ![]({article.get('imageUrl', '')}) | {desc} | {suggested_desc} |"
    rows.append(row)

with open('docs/library-information/articles.md', 'w') as f:
    f.write(header)
    f.write('\n'.join(rows) + '\n')

print(f'Generated catalog with {len(rows)} articles')
PYEOF
```

**Explanation of Python Script:**
- Loads `hi-plan-context.json`
- Creates header with metadata
- Iterates through each article
- Extracts dimensions from `rootModules[0].dimensions` array
- Formats dimensions as `L {Depth} mm W {Width} mm H {Height} mm`
- Replaces pipes in category with slashes (to avoid breaking markdown tables)
- Generates table rows in the specified column order
- Saves to `docs/library-information/articles.md`

### Step 6: Commit Changes

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
- **Source:** `article.rootModules[0].dimensions` array
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
- **Source:** Generated from `article.desc`, `article.category`, `article.articleName`, `article.rootModules[0].dimensions`, and `article.imageUrl`
- **Type:** String (technically enhanced)
- **Generation Logic:**
  - Parses and enhances the original description with technically accurate details
  - Identifies article type from category (cabinet, sideboard, wall unit, tall cabinet, etc.)
  - Detects special attributes like "corner", "wall", "tall", "low" from category and description
  - Identifies appliances from description and article ID (sink, oven, fridge, range hood, dishwasher, hob, TV)
  - Counts and includes door, drawer, pullout, and fixed front counts
  - Preserves height classification (tall, base-height, low, high)
  - Handles special cases: fillers, panels, modular cabinets, endless closets, walk-in closets
  - Removes duplicates and ensures technical accuracy
- **Purpose:** Provides agents with complete article understanding without needing to analyze images
- **Example:** `"Corner cabinet, adjustable shelves, 1 door"` (derived from `"Fingergrip corner base cabinet direction left with 1 door, adjustable shelves"`)
- **Benefits:** 
  - Enables faster planning with HI MCP
  - Eliminates need for image analysis
  - Provides consistent, technically accurate descriptions
  - Includes all relevant details in a structured format

---

## Suggested Description Generation Rules

The Suggested Description column is automatically generated using the following rules:

### Base Type Detection
1. **Kitchen Appliances** → "Range hood", "Dishwasher unit", "Tall cabinet with X fridge door(s)"
2. **Kitchen Wall Units** → "Wall cabinet"
3. **Kitchen Tall Units** → "Tall cabinet"
4. **Kitchen Base Units** → "Base cabinet"
5. **Living Sideboard** → "Sideboard"
6. **Living Wallunits/Tallunits** → "Wall unit"
7. **Closet** → "Closet cabinet" or "Endless closet [position] cabinet"
8. **Utility** → "Utility unit" or "Wall unit"

### Attribute Detection
- **Corner**: Detected from category or description containing "corner"
- **Height**: Classified as tall (≥1800mm), base-height (700-1800mm), low (≤400mm)
- **Direction**: "left" or "right" for corner cabinets and fillers

### Appliance Detection
- **Sink**: From description containing "sink"
- **Oven**: From description containing "oven"
- **Fridge**: From description containing "fridge", article ID starting with "HK", or image filename containing "tf"
- **Range hood**: From description containing "range hood" or "dunstabzug", or article ID "DU"
- **Dishwasher**: From description containing "dishwasher" or image filename containing "dwp"/"gsp"
- **Hob**: From description containing "hob"
- **TV**: From description containing "tv" or image filename containing "tv"

### Component Counting
- Doors, drawers, pullouts, and fixed fronts are counted from the description
- Fridge doors are separately counted and prefixed with "fridge"
- Regular doors and fridge doors can coexist in the same description

### Special Cases
1. **Fillers**: Classified by height (tall, wall, base) with direction
2. **Panels**: Side, end, back, or kitchen end panels
3. **Modular cabinets**: "Modular tall cabinet to add fronts"
4. **Walk-in closets**: With shelves, hangers, drawers, or niches
5. **Endless closets**: Position-specific (end, middle, start) cabinet
6. **Shelf units**: Open or with specific shelf counts

### Quality Assurance
- Avoids duplicate information
- Capitalizes first letter
- Uses singular/plural correctly
- Trusts original description but enhances it technically
- Discards obviously wrong information

---

## Complete JSON Structure


The JSON returned by the `get-plan-context` tool has this structure:

```json
{
  "masterData": {
    "Furniture_Smith": {
      "modules": [...],
      "attributes": [...]
    }
  },
  "rooms": {
    "rooms": [...]
  },
  "articles": [
    {
      "articleId": "SB_UB600S",
      "articleName": "SB_BD600DR",
      "desc": "Sideboard with 1 door, 1 drawer",
      "category": "Living | Sideboard",
      "imageUrl": "https://.../SB_UB600S.png",
      "libraryId": "Furniture_Smith",
      "catalog": "Furniture_Smith",
      "cornerArticle": false,
      "rootModules": [
        {
          "module": {"id": "mr_StorageunitSingle", "name": "Storage unit", "desc": "Module for storage unit", "imageUrl": "https://.../storageunit.png?..."},
          "dimensions": [
            {"id": "mod_Depth", "name": "Depth", "value": "350"},
            {"id": "mod_Height", "name": "Height", "value": "900"},
            {"id": "mod_Width", "name": "Width", "value": "600"}
          ],
          "mainAttributes": [...],
          "dockingVectors": [],
          "subModules": [...]
        }
      ]
    }
  ],
  "groups": []
}
```

---

## HiPlanContext Section Details

`get-plan-context` accepts an optional `include` parameter (`'masterData' | 'rooms' | 'articles' | 'groups'`). It does not return the raw `getExternalObjectPlanContext()` result: the page shapes every section for the agent.

- `masterData` — per library the root modules and the attributes a customer sees (`isMain` or `userRight` `Simple`); modules, attributes and selections keep their `desc` and `imageUrl` (the material swatches). For Furniture_Smith these are 13 of 47 modules and 49 of 398 attributes (2026-09-27); the other attributes are found with `find-attributes`
- `rooms` — wall contours plus a derived `walls` array
- `articles` — compact catalog: per article `desc`, `imageUrl` and category, per root module the master-data module, dimensions, main attributes, docking vectors and sub-modules
- `groups` — the groups currently in the plan

The full field list is in the [tool reference](../../minimal-hi-example/docs/hi-mcp-server.md#get-plan-context). For the article catalog, you need at least `['articles']`; the four sections together are the snapshot stored in `hi-plan-context.json`.

---

## Automating the Process

Create a shell script `scripts/generate-article-catalog.sh`:

```bash
#!/bin/bash
set -e

# Fetch HiPlanContext
curl -s -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get-plan-context","arguments":{"include":["masterData","rooms","articles","groups"]}}}' | \
  jq -r '.result.content[0].text' > docs/library-information/hi-plan-context.json

# Generate markdown
python3 << 'PYEOF'
import json
import re
import os

def generate_suggested_description(article_id, category, label, dimensions, desc, image_url):
    """Generate technically accurate suggested description from article data."""
    desc_lower = desc.lower()
    image_filename = os.path.basename(image_url.split('?')[0]).lower()
    article_id_upper = article_id.upper()
    
    category_parts = [c.strip() for c in category.split('/') if c.strip()]
    main_category = category_parts[0] if category_parts else ""
    
    door_count = sum(int(m) for m in re.findall(r'(\d+)\s+door[s]?', desc_lower)) if re.findall(r'(\d+)\s+door[s]?', desc_lower) else 0
    drawer_count = sum(int(m) for m in re.findall(r'(\d+)\s+drawer[s]?', desc_lower)) if re.findall(r'(\d+)\s+drawer[s]?', desc_lower) else 0
    pullout_count = sum(int(m) for m in re.findall(r'(\d+)\s+pullout[s]?', desc_lower)) if re.findall(r'(\d+)\s+pullout[s]?', desc_lower) else 0
    fixed_front_count = sum(int(m) for m in re.findall(r'(\d+)\s+fixed\s+front[s]?', desc_lower)) if re.findall(r'(\d+)\s+fixed\s+front[s]?', desc_lower) else 0
    fridge_door_count = sum(int(m) for m in re.findall(r'(\d+)\s+fridge\s+door[s]?', desc_lower)) if re.findall(r'(\d+)\s+fridge\s+door[s]?', desc_lower) else 0
    
    has_corner = 'corner' in desc_lower or 'corner' in category.lower()
    has_adjustable_shelves = 'adjustable shelves' in desc_lower
    has_heat_insulation = 'heat insulation' in desc_lower
    has_niche = 'niche' in desc_lower
    has_fixed_front = fixed_front_count > 0 or 'fixed front' in desc_lower
    has_sink = 'sink' in desc_lower
    has_oven = 'oven' in desc_lower
    has_fridge = 'fridge' in desc_lower or 'tf' in image_filename or article_id_upper.startswith('HK')
    has_range_hood = 'range hood' in desc_lower or 'dunstabzug' in desc_lower or 'du' in image_filename or article_id_upper == 'DU'
    has_dishwasher = 'dishwasher' in desc_lower or 'dwp' in image_filename or 'gsp' in image_filename
    has_hob = 'hob' in desc_lower
    has_tv = 'tv' in desc_lower or 'tv' in image_filename or article_id_upper == 'SM_TV'
    is_filler = 'filler' in desc_lower
    is_panel = 'panel' in desc_lower or 'Panel' in desc
    is_modular = 'modular' in desc_lower
    is_walk_in = 'walk in' in category.lower() or 'walkin' in category.lower()
    is_endless = 'endless' in category.lower()
    
    parts = []
    
    if is_filler:
        if 'tall' in desc_lower: parts.append("Tall unit filler")
        elif 'wall' in desc_lower: parts.append("Wall unit filler")
        elif 'base' in desc_lower: parts.append("Base unit filler")
        else: parts.append("Filler")
        if 'direction left' in desc_lower: parts.append("direction left")
        elif 'direction right' in desc_lower: parts.append("direction right")
    elif is_panel:
        if 'side' in desc_lower: parts.append("Side panel")
        elif 'end' in desc_lower: parts.append("End panel")
        elif 'back' in desc_lower: parts.append("Back panel")
        elif 'tall' in desc_lower: parts.append("Kitchen end panel for tall units")
        elif 'base' in desc_lower: parts.append("Kitchen end panel for base units")
        else: parts.append("Panel")
    elif has_tv:
        parts.append("TV unit for decoration")
    elif is_modular:
        parts.append("Modular tall cabinet")
        if 'fronts' in desc_lower: parts.append("to add fronts")
    elif is_walk_in:
        parts.append("Walk-in closet cabinet")
        if '4 drawers' in desc_lower and 'shelves' in desc_lower: parts.append("4 drawers and shelves")
        elif 'shelves' in desc_lower: parts.append("with shelves")
        if has_niche:
            nc = 1
            nm = re.search(r'(\d+)\s+niche', desc_lower)
            if nm: nc = int(nm.group(1))
            parts.append(f"with {nc} niche{'s' if nc > 1 else ''}")
        if 'hanger' in desc_lower:
            if 'full height' in desc_lower: parts.append("for full height hanger")
            elif '2 small' in desc_lower: parts.append("with 2 small hangers")
            else: parts.append("with hanger")
    elif is_endless:
        if 'end' in category.lower(): parts.append("Endless closet end cabinet")
        elif 'middle' in category.lower(): parts.append("Endless closet middle cabinet")
        elif 'start' in category.lower(): parts.append("Endless closet start cabinet")
        else: parts.append("Endless closet cabinet")
    else:
        if main_category == "Kitchen":
            if "Appliances" in category:
                if has_range_hood: parts.append("Range hood")
                elif has_fridge:
                    fc = fridge_door_count if fridge_door_count > 0 else 1
                    parts.append(f"Tall cabinet with {fc} fridge door{'s' if fc > 1 else ''}")
                elif has_oven: parts.append("Tall cabinet with oven")
                elif has_dishwasher: parts.append("Dishwasher unit")
                else: parts.append("Appliance")
            elif "Wall Units" in category: parts.append("Wall cabinet")
            elif "Tall Units" in category: parts.append("Tall cabinet")
            elif "Base Units" in category: parts.append("Base cabinet")
            else: parts.append("Kitchen cabinet")
        elif main_category == "Living":
            if "Sideboard" in category: parts.append("Sideboard")
            elif "Wallunits" in category or "Tallunits" in category: parts.append("Wall unit")
            else: parts.append("Furniture")
        elif main_category == "Closet": parts.append("Closet cabinet")
        elif main_category == "Utility":
            if 'shelf' in desc_lower: parts.append("Wall unit")
            else: parts.append("Utility unit")
        else: parts.append("Cabinet")
        if has_corner and parts: parts[0] = f"Corner {parts[0].lower()}"
    
    existing_lower = " ".join(parts).lower()
    appliance_parts = []
    if has_sink and 'sink' not in existing_lower: appliance_parts.append("sink")
    if has_oven and 'oven' not in existing_lower: appliance_parts.append("oven")
    if has_range_hood and 'range hood' not in existing_lower: appliance_parts.append("range hood")
    if has_dishwasher and 'dishwasher' not in existing_lower: appliance_parts.append("dishwasher")
    if has_hob and 'hob' not in existing_lower: appliance_parts.append("hob")
    if has_heat_insulation and 'heat insulation' not in existing_lower: appliance_parts.append("heat insulation")
    if has_fixed_front and 'fixed front' not in existing_lower:
        fc = fixed_front_count if fixed_front_count > 0 else 1
        appliance_parts.append(f"{fc} fixed front{'s' if fc > 1 else ''}")
    if has_adjustable_shelves and 'shelves' not in existing_lower: appliance_parts.append("adjustable shelves")
    if has_niche and 'niche' not in existing_lower:
        nc = 1
        nm = re.search(r'(\d+)\s+niche', desc_lower)
        if nm: nc = int(nm.group(1))
        appliance_parts.append(f"{nc} niche{'s' if nc > 1 else ''}")
    if appliance_parts: parts.extend(appliance_parts)
    
    component_parts = []
    if fridge_door_count > 0: component_parts.append(f"{fridge_door_count} fridge door{'s' if fridge_door_count > 1 else ''}")
    if door_count > 0: component_parts.append(f"{door_count} door{'s' if door_count > 1 else ''}")
    if drawer_count > 0: component_parts.append(f"{drawer_count} drawer{'s' if drawer_count > 1 else ''}")
    if pullout_count > 0: component_parts.append(f"{pullout_count} pullout{'s' if pullout_count > 1 else ''}")
    if component_parts: parts.extend(component_parts)
    
    result = ", ".join(parts)
    if result: result = result[0].upper() + result[1:]
    return result

with open('docs/library-information/hi-plan-context.json', 'r') as f:
    data = json.load(f)

header = """# Furniture_Smith Article Catalog

This document lists all articles from the Furniture_Smith library.

## Source
Data extracted from `HiPlanContext` via MCP server.

---

## Articles

| ID | Category | Label | Dimensions | Image | Description | Suggested Description |
|---|---|---|---|---|---|---|
"""

rows = []
for article in data['articles']:
    dims = {}
    if article.get('rootModules'):
        for d in article['rootModules'][0].get('dimensions', []):
            dims[d['id']] = d['value']
    dims_text = f"L {dims.get('mod_Depth', '?')} mm W {dims.get('mod_Width', '?')} mm H {dims.get('mod_Height', '?')} mm"
    category = article.get('category', '').replace('|', '/')
    desc = article.get('desc', '')
    suggested = generate_suggested_description(
        article['articleId'], category, article['articleName'],
        dims_text, desc, article.get('imageUrl', '')
    )
    row = f"| {article['articleId']} | {category} | {article['articleName']} | {dims_text} | ![]({article.get('imageUrl', '')}) | {desc} | {suggested} |"
    rows.append(row)

with open('docs/library-information/articles.md', 'w') as f:
    f.write(header + '\n'.join(rows) + '\n')
PYEOF

echo "Catalog generated: $(wc -l < docs/library-information/articles.md) lines"
```

---

## Troubleshooting

### "No HI example page connected" Error
**Cause:** Browser page not connected to MCP server  
**Solution:** Open `http://localhost:3100/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith` in your browser

### Wrong Library Data
**Cause:** Page opened with different library parameters  
**Solution:** Ensure URL has `library_id=Furniture_Smith` and `backendId=HI_PRE_Roomle_Milestone_2`

### Empty Articles Array
**Cause:** Library not loaded or wrong backend  
**Solution:** Check the page is fully loaded and the Furniture_Smith library is selected

### Missing Dimensions
**Cause:** Some articles don't define all dimension attributes  
**Solution:** This is expected for certain article types. The script uses `?` as fallback.

---

## Related Files

- `minimal-hi-example/hi-mcp-server.js` — MCP server (`exampleUrl`: URL with library parameters)
- `docs/library-information/hi-plan-context.json` — Raw HiPlanContext data
- `docs/library-information/articles.md` — Generated markdown catalog
- `.agents/skills/hi-furniture-smith-article-catalog.md` — This skill document

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model

---

## Materials Catalog Generation

`docs/library-information/materials.md` is generated from the same `hi-plan-context.json` by the [materials skill](./hi-furniture-smith-materials.md); its thumbnails are the selection `imageUrl`s of that file.

---

## Simplified Suggested Description Generation

The Suggested Description column provides agents with technically accurate, complete descriptions without needing to analyze images. Based on practical experience, a simpler approach works better than complex type detection:

### Approach

1. **Clean the original description**: Remove redundant prefixes like "Fingergrip"
2. **Translate German terms**: Convert German words to English (Oberschrank → Wall cabinet, Tür → door, etc.)
3. **Add furniture type**: Ensure the description starts with the furniture type (Sideboard, Lowboard, Base cabinet, etc.)
4. **Add height category**: Add "low" for < 500mm, "high" for ≥ 2000mm
5. **Add corner designation**: Add "corner" if applicable
6. **Format consistently**: Use comma-separated lists, capitalize first letter

### Implementation

```python
def clean_and_enhance_description(desc, category, article_id, dimensions):
    """Clean and enhance description to create suggested description"""
    if not desc or desc.strip() == '':
        return desc
    
    # Manual overrides
    overrides = {
        'DU': 'Range hood',
        'GSP': 'Dishwasher unit',
        'SM_TV': 'Wall unit, TV decoration',
    }
    if article_id in overrides:
        return overrides[article_id]
    
    # Handle pure German
    if desc.lower() == 'dunstabzug':
        return 'Range hood'
    
    # Remove unwanted prefixes
    enhanced = re.sub(r'^Fingergrip\s+', '', desc, flags=re.IGNORECASE)
    
    # Translate German terms
    translations = {
        'Oberschrank': 'Wall cabinet',
        'Oberschrankregal': 'Wall cabinet shelf',
        'Einlegeböden': 'adjustable shelves',
        'feste Zwischenböden': 'fixed shelves',
        'Tür': 'door',
        'Türen': 'doors',
        'Schublade': 'drawer',
        'Schubladen': 'drawers',
        'Auszug': 'pullout',
        'Auszüge': 'pullouts',
        'Dunstabzug': 'range hood',
        'Kochfeld': 'hob',
        'Herd': 'stove',
        'Spüle': 'sink',
        'Faltklappe': 'folding flap',
        'Schwenkklappe': 'hinged flap',
        'mit': 'with',
    }
    
    for german, english in translations.items():
        enhanced = re.sub(r'\b' + re.escape(german) + r'\b', english, enhanced, flags=re.IGNORECASE)
    
    # Clean up "with" → ", "
    enhanced = re.sub(r'\bwith\s+', ', ', enhanced, flags=re.IGNORECASE)
    
    # Clean up spaces and commas
    enhanced = re.sub(r'\s+', ' ', enhanced)
    enhanced = re.sub(r'\s*,\s*', ', ', enhanced)
    enhanced = enhanced.strip().strip(',')
    
    # Fix plural issues
    enhanced = re.sub(r'\b1 doors\b', '1 door', enhanced, flags=re.IGNORECASE)
    enhanced = re.sub(r'\b1 drawers\b', '1 drawer', enhanced, flags=re.IGNORECASE)
    enhanced = re.sub(r'\b1 pullouts\b', '1 pullout', enhanced, flags=re.IGNORECASE)
    
    # Capitalize
    if enhanced:
        enhanced = enhanced[0].upper() + enhanced[1:]
    
    # Add furniture type prefix if missing
    category_lower = category.lower()
    enhanced_lower = enhanced.lower()
    type_markers = ['sideboard', 'lowboard', 'tall cabinet', 'wall cabinet', 
                   'base cabinet', 'filler', 'panel', 'closet']
    has_type = any(marker in enhanced_lower for marker in type_markers)
    
    if not has_type:
        if 'sideboard' in category_lower:
            enhanced = f"Sideboard, {enhanced}"
        elif 'lowboard' in category_lower:
            enhanced = f"Lowboard, {enhanced}"
        elif 'tall unit' in category_lower:
            enhanced = f"Tall cabinet, {enhanced}"
        elif 'wall unit' in category_lower:
            enhanced = f"Wall cabinet, {enhanced}"
        elif 'base unit' in category_lower:
            enhanced = f"Base cabinet, {enhanced}"
        elif 'filler' in category_lower:
            enhanced = f"Filler, {enhanced}"
        elif 'panel' in category_lower:
            enhanced = f"Panel, {enhanced}"
        elif 'closet' in category_lower:
            enhanced = f"Closet cabinet, {enhanced}"
    
    # Update enhanced_lower after type was potentially added
    enhanced_lower = enhanced.lower()
    
    # Add height category
    has_low = bool(re.search(r'\blow\b', enhanced_lower))
    has_high = bool(re.search(r'\bhigh\b', enhanced_lower))
    
    height = dimensions.get('mod_Height')
    if height:
        try:
            h = int(height)
            if h < 500 and not has_low:
                enhanced = f"{enhanced}, low"
            elif h >= 2000 and not has_high:
                enhanced = f"{enhanced}, high"
        except ValueError:
            pass
    
    # Add corner designation
    if ('corner' in category_lower or 'corner' in desc.lower()) and 'corner' not in enhanced_lower:
        enhanced = f"{enhanced}, corner"
    
    # Final cleanup
    enhanced = re.sub(r'\s*,\s*', ', ', enhanced)
    enhanced = re.sub(r'\s+', ' ', enhanced)
    enhanced = enhanced.strip().strip(',')
    
    return enhanced
```

### Rules Summary

1. **Trust but verify**: Use the original description as the primary source
2. **Translate**: Convert all German terms to English
3. **Identify type**: Ensure furniture type is present (Sideboard, Lowboard, Cabinet, etc.)
4. **Height classification**: Add "low" (< 500mm) or "high" (≥ 2000mm)
5. **Corner detection**: Add "corner" if applicable
6. **Be concise**: Remove redundant words and prefixes
7. **Be accurate**: Ensure door/drawer counts are correct (1 door, not 1 doors)

### Benefits

- **Speed**: Agents don't need to analyze images
- **Completeness**: All relevant information is in the description
- **Consistency**: Technical terms are standardized
- **Accuracy**: German terms are translated, counts are corrected

---

## Material Thumbnail Source

**Question**: Where do the material/color thumbnails come from in the Roomle HI Planner UI?

**Answer**: Each thumbnail is the `imageUrl` of an attribute selection in the HI master data. The kernel copies every `selection.imageUrl` into the thumbnail of the parameter value when `uiConfiguration.showThumbnails` is on. `get-plan-context` keeps these `imageUrl`s, so `hi-plan-context.json` contains them, e.g. in the selections of `mod_FrontColor`.

### URL Pattern

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- A read-only SAS URL of one Azure blob: the image GUID is random and the signature is bound to that blob, so the URL cannot be built from the material value
- Without the signature the CDN answers `409 PublicAccessNotPermitted`
- The signature is valid for about a month (`st` to `se`); after that, regenerate `hi-plan-context.json` and `materials.md` (see the [materials skill](./hi-furniture-smith-materials.md))

### Material Values

The material values (numeric codes) are defined in the `masterData.Furniture_Smith.attributes` where:
- `type` = "Text"
- `name` or `desc` contains "Color"
- Each selection has a `value` (numeric code) and `name` (color name)

