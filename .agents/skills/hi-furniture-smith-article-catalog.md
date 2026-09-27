# HI Furniture_Smith Article Catalog Generation

> **Skill Type:** Process Documentation  
> **Purpose:** Recreate Furniture_Smith article catalog with dimensions from Roomle HI plan context  
> **Use When:** Library changes, new backend, or data refresh needed

---

## Overview

This skill documents the complete process to extract article data from the Roomle HOMAG Intelligence (HI) system via the MCP server and generate a structured markdown catalog with images, labels, descriptions, and dimensions.

The process retrieves the `HiPlanContext` object (which contains master data, rooms, articles, and groups) and transforms it into a human-readable markdown table suitable for documentation and reference.

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
    ↓ MCP Bridge (WebSocket)
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

**Note:** The URL parameters are hardcoded in `minimal-hi-example/hi-mcp-server.js` (line 604):
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
No HI page connected. Have the user open the ligna-store in their browser...
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
  }' | jq -r '.result.content[0].text' > docs/article-information/hi-plan-context.json
```

**Explanation:**
- `get-plan-context` is the MCP tool that calls `roomDesignerApi.extended.getExternalObjectPlanContext()`
- The `include` parameter specifies which sections to fetch (all four sections for completeness)
- `jq -r '.result.content[0].text'` extracts the raw JSON from the MCP response wrapper
- Output is saved to `docs/article-information/hi-plan-context.json`

### Step 4: Create Directory Structure

```bash
mkdir -p docs/article-information
```

### Step 5: Generate Markdown Catalog

Use the Python script below to transform the JSON into a markdown table:

```bash
python3 << 'PYEOF'
import json

with open('docs/article-information/hi-plan-context.json', 'r') as f:
    data = json.load(f)

header = """# Furniture_Smith Article Catalog

This document lists all articles from the Furniture_Smith library as displayed in the Roomle planner catalog with images, labels, descriptions, and dimensions.

## Source

Data extracted from `HiPlanContext` via MCP server's `get-plan-context` tool.

Image URLs are hosted on: `https://tecconfig-preview.homag.cloud/cdn/`

---

## Articles

| ID | Category | Label | Dimensions | Image | Description |
|---|---|---|---|---|---|
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
    
    row = f"| {article['articleId']} | {category} | {article['articleName']} | {dims_text} | ![]({article.get('imageUrl', '')}) | {desc} |"
    rows.append(row)

with open('docs/article-information/articles.md', 'w') as f:
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
- Saves to `docs/article-information/articles.md`

### Step 6: Commit Changes

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
git add docs/article-information/
git commit -m "docs: update Furniture_Smith article catalog"
```

---

## Column Data Sources

The markdown table has 6 columns. Here is the exact source of each column from the `HiPlanContext` JSON structure:

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
- **Description:** Human-readable description of the article

---

## Complete JSON Structure

The `HiPlanContext` object returned by `getExternalObjectPlanContext()` has this structure:

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
          "module": {"id": "mr_StorageunitSingle", "name": "Storage unit", "desc": "Module for storage unit"},
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

The `getExternalObjectPlanContext()` method accepts an optional `include` parameter:

```typescript
type HiPlanContextSection = 'masterData' | 'rooms' | 'articles' | 'groups';

interface HiPlanContext {
  masterData?: Record<string, MasterData>;
  rooms?: ExternalRoomInformation;
  articles?: PosArticle[];
  groups?: PosGroup[];
}
```

For the article catalog, you need at least `['articles']`. Including `['masterData', 'rooms', 'articles', 'groups']` gives you the complete picture.

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
  jq -r '.result.content[0].text' > docs/article-information/hi-plan-context.json

# Generate markdown
python3 << 'PYEOF'
import json
with open('docs/article-information/hi-plan-context.json', 'r') as f:
    data = json.load(f)

header = """# Furniture_Smith Article Catalog

This document lists all articles from the Furniture_Smith library.

## Source
Data extracted from `HiPlanContext` via MCP server.

---

## Articles

| ID | Category | Label | Dimensions | Image | Description |
|---|---|---|---|---|---|
"""

rows = []
for article in data['articles']:
    dims = {}
    if article.get('rootModules'):
        for d in article['rootModules'][0].get('dimensions', []):
            dims[d['id']] = d['value']
    dims_text = f"L {dims.get('mod_Depth', '?')} mm W {dims.get('mod_Width', '?')} mm H {dims.get('mod_Height', '?')} mm"
    category = article.get('category', '').replace('|', '/')
    row = f"| {article['articleId']} | {category} | {article['articleName']} | {dims_text} | ![]({article.get('imageUrl', '')}) | {article.get('desc', '')} |"
    rows.append(row)

with open('docs/article-information/articles.md', 'w') as f:
    f.write(header + '\n'.join(rows) + '\n')
PYEOF

echo "Catalog generated: $(wc -l < docs/article-information/articles.md) lines"
```

---

## Troubleshooting

### "No HI page connected" Error
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

- `minimal-hi-example/hi-mcp-server.js` — MCP server (line 604: URL with library parameters)
- `docs/article-information/hi-plan-context.json` — Raw HiPlanContext data
- `docs/article-information/articles.md` — Generated markdown catalog
- `.agents/skills/hi-furniture-smith-article-catalog.md` — This skill document

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model
