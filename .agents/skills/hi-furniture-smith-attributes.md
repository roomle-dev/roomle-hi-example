# HI Furniture_Smith Attributes Documentation

> **Skill Type:** Process Documentation  
> **Purpose:** Extract and document all attributes from the Furniture_Smith library master data  
> **Use When:** Need to reference available attributes for HI planning, understanding attribute groups, or attribute metadata

---

## Overview

This skill documents the process to extract attribute data from the Roomle HOMAG Intelligence (HI) system's master data and generate a structured markdown table.

The process reads the Furniture_Smith master data (`docs/library-information/master-data.json`) and extracts all attributes with their metadata (id, name, group, imageUrl, description) into a comprehensive reference table.

---

## Prerequisites

1. **Master data JSON** — The file `docs/library-information/master-data.json` must exist. Generate it using the process described in [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md#step-1-fetch-the-library-data):
   ```bash
   node .agents/scripts/fetch-hi-library-data.js
   ```

2. **Node.js 18+** — Required for running the generation script

---

## Data Flow

```
master-data.json (fetched directly from the HOMAG backend)
    ↓ Extract attributes array
    ↓ Extract: id, name, group, imageUrl, desc from each attribute
Sort by attribute id
    ↓ Generate markdown table
Markdown Table (attributes.md) with id, name, group, image, description columns
```

---

## Step-by-Step Process

### Step 1: Fetch the library data (if not already done)

Use the process from [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md) to fetch the master data:

```bash
node .agents/scripts/fetch-hi-library-data.js
```

### Step 2: Generate Attributes Table

Use this JavaScript script to extract all attributes and generate the markdown table:

```bash
node .agents/scripts/generate-attributes-table.js
```

This script will:
- Read all 398 attributes from `docs/library-information/master-data.json`
- Extract the fields: id, name, group, imageUrl (as markdown link), description
- Sort attributes alphabetically by id
- Generate the attributes.md table

**Options:**
```bash
# Regenerate attributes.md
node .agents/scripts/generate-attributes-table.js

# Custom input/output paths (modify script if needed)
# The script currently uses hardcoded paths relative to repo root
```

### Step 3: Commit Changes

```bash
cd /Users/gernotsteinegger/source/roomle/roomle-hi-example
git add docs/library-information/attributes.md
git commit -m "docs: add Furniture_Smith attributes reference table"
```

---

## Attributes Table Structure

The generated table has 5 columns:

### 1. id
- **Source:** `attribute.id` from each attribute object
- **Type:** String
- **Example:** `"mod_PaneltopColor"`, `"mod_FrontColor"`, `"mod_CarcaseColor"`
- **Description:** Unique identifier for the attribute
- **Sorting:** Attributes are sorted ascending by this id

### 2. name
- **Source:** `attribute.name` from each attribute object
- **Type:** String
- **Example:** `"Color"`, `"Edge color back"`, `"Front design"`
- **Description:** Human-readable name of the attribute

### 3. group
- **Source:** `attribute.group` from each attribute object
- **Type:** String
- **Example:** `"Panel"`, `"Front | Design"`, `"Carcase | Construction"`
- **Description:** The attribute group/path in the library. Note that group names may contain pipes (|) which are escaped as `\|` in the markdown table for proper rendering.

### 4. image
- **Source:** `attribute.imageUrl` from each attribute object
- **Type:** Markdown image (or empty string)
- **Example:** `![Color](https://.../paneltop.jpg?sv=...)` or empty
- **Description:** Markdown image that displays the attribute's thumbnail/preview inline. The imageUrl is a signed Azure blob URL valid for about a month. Empty if no image is available. The alt text for the image is the attribute name.

### 5. description
- **Source:** `attribute.desc` from each attribute object
- **Type:** String
- **Example:** `"Color of the panel top"`, `"Edge visible back"`
- **Description:** The description the library gives the attribute

---

## Complete Attribute Example

```json
{
  "id": "mod_PaneltopColor",
  "name": "Color",
  "desc": "Color of the panel top",
  "isMain": true,
  "group": "Paneltop",
  "imageUrl": "https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/36d87182-b6a8-4809-9a30-016b47045b92_paneltop.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=GUq6Rn9anb8rQDgMHbjggWbrGW1YyP3g5qKHVVtDLsM%3D",
  "type": "Text",
  "userRight": "Simple",
  "implicitRelevant": false,
  "posView": "ImageList",
  "sorting": 2,
  "selections": [...]
}
```

---

## Current Attributes Count

As of the latest master data fetch, the Furniture_Smith library contains **398 attributes** organized into various groups.

---

## Attribute Groups

Attributes are organized into the following high-level groups:

- **Baseboard** — Baseboard-related attributes
- **BoardShelf** — Board shelf attributes
- **Carcase** — Carcase construction, dimensions, and connections
- **Countertop** — Countertop attributes
- **Door** — Door-related attributes
- **Drawer** — Drawer box and configuration
- **Filler** — Filler module attributes
- **Fingergrip** — Finger grip attributes
- **Front** — Front panel and design attributes
- **FrontModule** — Front module configurations
- **GenerationMethod** — Generation and positioning logic
- **Handle** — Handle design and positioning
- **Hood** — Hood appliance attributes
- **Hob** — Hob appliance attributes
- **Light** — Lighting attributes
- **Model** — Module model types
- **OpeningType** — Opening configurations
- **Panel** — Panel edge and color attributes
- **Plinth** — Plinth area attributes
- **Pullout** — Pullout element attributes
- **RackArea** — Rack area configurations
- **Room Integration** — Room-related attributes
- **Root** — Root module attributes
- **Shelf** — Shelf configurations (fixed and adjustable)
- **Sink** — Sink appliance attributes
- **TypeElement** — Element type configurations
- **Upright** — Upright module attributes
- **VertDivider** — Vertical divider attributes
- **Wall** — Wall-related attributes

And many more specialized groups.

---

## Usage

When planning with HI MCP, use the attribute ids (e.g., "mod_PaneltopColor", "mod_FrontColor") when referencing or configuring attributes on articles or groups.

---

## Related Files

- `docs/library-information/master-data.json` — Source master data (generated using [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md))
- `docs/library-information/attributes.md` — Generated attributes reference table
- `.agents/scripts/generate-attributes-table.js` — JavaScript attribute extraction script
- `.agents/skills/hi-furniture-smith-attributes.md` — This skill document
- `.agents/skills/hi-furniture-smith-article-catalog.md` — Article catalog generation skill

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model
- `.agents/skills/hi-furniture-smith-materials.md` — Materials/colors extraction skill
