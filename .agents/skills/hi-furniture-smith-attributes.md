# HI Furniture_Smith Attributes Documentation

> **Skill Type:** Process Documentation  
> **Purpose:** Extract and document all attributes from the Furniture_Smith library master data with trusted descriptions  
> **Use When:** Need to reference available attributes for HI planning, understanding attribute groups, or attribute metadata

---

## Overview

This skill documents the process to extract attribute data from the Roomle HOMAG Intelligence (HI) system's master data and generate a structured markdown table.

The process reads the Furniture_Smith master data (`docs/library-information/master-data.json`) and extracts all attributes with their metadata (id, name, group, imageUrl, description) into a comprehensive reference table. **Important principle:** The original descriptions from the master data are trusted and preserved exactly. The suggested description column only extends or creates descriptions when the original is missing or inadequate, never changing the meaning.

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
    ↓ Generate suggested description for each attribute
    ↓ Generate markdown table
Markdown Table (attributes.md) with id, name, group, image, description, suggested description columns
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
- Extract the fields: id, name, group, imageUrl (as markdown image), description
- Generate a **technically accurate suggested description** for each attribute (see [Suggested Description Generation Rules](#suggested-description-generation-rules))
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

### 6. suggested description
- **Source:** **Generated** from `attribute.desc`, `attribute.name`, `attribute.group`
- **Type:** String (technically enhanced)
- **Purpose:** Provides agents with a technically accurate, complete description without needing to analyze images or parse the raw description
- **Example:** `"Panel top color"` (from `"Color of the panel top"`), `"Carcase back height"` (from `"Back height of the carcase"`), `"Baseboard color"` (from `"Baseboard Color"`)
- **Benefits:**
  - Enables faster planning by providing concise, technically accurate descriptions
  - Eliminates need for image analysis
  - Provides consistent descriptions in a structured format
  - Generation rules detailed in [Suggested Description Generation Rules](#suggested-description-generation-rules)

---

## Suggested Description Generation Rules

The Suggested Description gives agents a technically accurate description for each attribute. The **core principle** is: **trust the original description**. `generate-attributes-table.js` follows these rules:

1. **If description exists and is meaningful** — Use it **as-is** with only minor formatting cleanup (normalize spaces, remove trailing periods, capitalize first letter)
2. **If description is missing or equals the name** — Build a new description from available parts:
   - Add group context first if it provides additional meaning
   - Add the name or clean id (with camelCase converted to spaces)
   - Example: `mod_BaseboardProgram` with group "Baseboard" and name "Baseboard Program" → "Baseboard Program"

**Key principles:**
- **Trust the description** — Existing descriptions from the master data are considered authoritative and are preserved exactly
- **Never change the meaning** — Transformations only clean up formatting, they do NOT rephrase or reinterpret
- **Only extend when necessary** — New descriptions are only created when the original is missing or redundant
- **Ensure technical accuracy** — All descriptions remain technically correct for HI planning
- **Keep it simple** — Descriptions should be clear and concise without being verbose

**Example transformations:**
- "Defines the total height of the group" → "Defines the total height of the group" (preserved exactly)
- "Color of the panel top" → "Color of the panel top" (preserved exactly)
- "Back height of the carcase" → "Back height of the carcase" (preserved exactly)
- `mod_BaseboardProgram` with no description → "Baseboard Program" (built from name)

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

When planning with HI MCP, use the attribute ids (e.g., "mod_PaneltopColor", "mod_FrontColor") when referencing or configuring attributes on articles or groups. The **suggested description** column provides a quick, technically accurate reference for understanding what each attribute controls.

---

## Related Files

- `docs/library-information/master-data.json` — Source master data (generated using [hi-furniture-smith-article-catalog.md](./hi-furniture-smith-article-catalog.md))
- `docs/library-information/attributes.md` — Generated attributes reference table with **suggested descriptions**
- `.agents/scripts/generate-attributes-table.js` — JavaScript attribute extraction and description generation script
- `.agents/skills/hi-furniture-smith-attributes.md` — This skill document
- `.agents/skills/hi-furniture-smith-article-catalog.md` — Article catalog generation skill (reference for suggested description generation pattern)

---

## See Also

- `.agents/skills/hi-mcp-server.md` — MCP server architecture
- `.agents/skills/hi-mcp-tools.md` — MCP tool reference
- `.agents/skills/roomle-hi-concepts.md` — HI concepts and data model
- `.agents/skills/hi-furniture-smith-materials.md` — Materials/colors extraction skill
