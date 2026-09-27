> **Type**: Feature Analysis  
> **Domain**: HI MCP Server, AI Integration, Sales Configurator  
> **Trigger**: AI Kickoff Sales Configurator proposal  
> **Date**: 2026-09-25  
> **Author**: AI Assistant

---

## Executive Summary

This document analyzes a proposed feature for integrating **generative AI capabilities into the Sales Configurator** to support kitchen configuration planning, modification, and extension. The proposal outlines a comprehensive AI kickoff framework with architecture evaluation, data requirements, integration points, and success criteria.

The analysis identifies the need to extend the existing HI MCP server architecture to support **kitchen-specific operations** beyond the current room planning capabilities, with a focus on **command-based interaction patterns**, **article selection intelligence**, and **contextual memory** for conversational AI workflows.

---

## Table of Contents

1. [What Was Asked and Why](#1-what-was-asked-and-why)
2. [Current State Analysis](#2-current-state-analysis)
3. [Gap Analysis](#3-gap-analysis)
4. [Proposed Design](#4-proposed-design)
5. [Architecture Variants Evaluation](#5-architecture-variants-evaluation)
6. [Data and Metadata Requirements](#6-data-and-metadata-requirements)
7. [Article Selection Strategies](#7-article-selection-strategies)
8. [Context and Knowledge Base](#8-context-and-knowledge-base)
9. [Integration Points](#9-integration-points)
10. [Technology Stack Considerations](#10-technology-stack-considerations)
11. [Success Criteria](#11-success-criteria)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Open Questions and Decisions Needed](#13-open-questions-and-decisions-needed)

---

## 1. What Was Asked and Why

### 1.1 Objective

The Sales Configurator AI Integration aims to **evaluate and establish an architecture for integrating generative AI** to support kitchen configuration workflows. The primary goal is to enable natural language interactions for:

- Creating new kitchen configurations
- Modifying existing kitchen configurations
- Exchanging articles (cabinets, fronts, appliances)
- Extending configurations (adding islands, cabinets, etc.)
- Changing visual properties (colors, materials, styles)

### 1.2 Business Vision

The desired user experience enables conversational interactions such as:

- "Plane eine moderne L-Kuche mit Insel" (Plan a modern L-shaped kitchen with island)
- "Tausche alle Fronten gegen Eiche Natur" (Exchange all fronts with natural oak)
- "Erganze links einen Apothekerschrank" (Add a pharmacy cabinet on the left)
- "Vergroessere die Insel um 60 cm" (Enlarge the island by 60 cm)

### 1.3 Scope Definition

**In Scope:**
- New kitchen creation via natural language
- Modification of existing kitchens
- Article exchange (replace articles)
- Article supplementation (add articles)
- Front color changes
- Island support
- Cabinet configuration adjustments

**Out of Scope:**
- Room creation (Raumerzeugung)
- Room decoration (Raumdekoration)
- Image generation (Bildgenerierung)
- Price optimization (Preisoptimierung)
- Sales recommendations (Verkaufsempfehlungen)

### 1.4 Why This Feature Matters

The integration of generative AI into the Sales Configurator represents a **paradigm shift** from traditional GUI-based configuration to **conversational, intent-driven planning**. This enables:

1. **Lowered barrier to entry**: Non-expert users can create complex configurations
2. **Faster iteration**: Natural language is faster than manual configuration
3. **Reduced errors**: AI can validate and suggest compatible combinations
4. **Enhanced user experience**: More intuitive and engaging planning process
5. **Competitive advantage**: Differentiation through cutting-edge AI capabilities

---

## 2. Current State Analysis

### 2.1 Existing Capabilities in roomle-hi-example

The current **HI MCP Server** (`minimal-hi-example/hi-mcp-server.js`) provides:

**Core Tools:**
| Tool | Capability | Kitchen Relevance |
|------|------------|-------------------|
| `get-plan-context` | Get rooms, articles, groups | ✅ Foundational |
| `create-or-replace-groups` | Create/modify groups | ✅ Core |
| `place-group` | Position groups | ✅ Core |
| `get-price` | Calculate pricing | ⚠️ Limited (no optimization) |
| `get-order-data` | Order information | ✅ Useful |
| `get-plan-images` | Render plan images | ⚠️ Static only |

**Current Architecture:**
- Zero-dependency Node.js server
- Streamable HTTP MCP protocol
- Server-Sent Events (SSE) bridge to browser
- Relies on `roomDesignerApi.extended` in page context
- No AI integration layer
- No conversational memory
- No article intelligence

### 2.2 Existing Capabilities in roomle-model-exporter

The **Planner MCP Server** provides more advanced capabilities:

| Tool | Capability | Kitchen Relevance |
|------|------------|-------------------|
| `draw_walls` | Define room geometry | ⚠️ Scope excludes room creation |
| `insert_objects` | Place objects | ✅ Core |
| `edit_objects` | Modify objects | ✅ Core |
| `search_products` | Find articles | ✅ Critical |
| `preview_product` | Show article images | ✅ Useful |
| `design_guidelines` | Design rules | ✅ Inspirational |
| `plan_overview` | Get plan state | ✅ Foundational |

**Key Differences:**
- Headless Roomle SDK (full SDK access)
- Comprehensive catalog search
- Reflection tools for SDK exploration
- Multiple deployment options

### 2.3 Gap Between Current State and Proposal

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Natural language understanding | ❌ Not implemented | Need AI integration layer |
| Kitchen-specific commands | ❌ Generic only | Need domain-specific tools |
| Article selection intelligence | ❌ Manual only | Need AI-powered selection |
| Contextual memory | ❌ Stateless | Need session memory |
| Conversational workflow | ❌ Not supported | Need conversation management |
| Error handling & alternatives | ⚠️ Basic | Need intelligent suggestions |
| Validation integration | ✅ Basic | Need deep integration |

---

## 3. Gap Analysis

### 3.1 Primary Gaps

**1. No AI Integration Layer**
- Current MCP servers are **tool providers**, not AI agents
- Missing: LLM orchestration, prompt engineering, response parsing
- Required: AI service layer that consumes MCP tools

**2. No Kitchen-Specific Domain Knowledge**
- Current tools are generic (walls, objects, groups)
- Missing: Kitchen-specific concepts (cabinets, islands, worktops, appliances)
- Required: Domain-specific tool extensions

**3. No Conversational Memory**
- Each request is stateless
- Missing: User preferences, session context, conversation history
- Required: Context management layer

**4. No Article Intelligence**
- Article selection is manual
- Missing: Semantic search, compatibility matching, style coordination
- Required: AI-powered article selection engine

**5. No Command Parsing**
- Natural language not supported
- Missing: Intent recognition, command extraction, parameter parsing
- Required: NLP pipeline for kitchen commands

### 3.2 Secondary Gaps

- No few-shot examples for kitchen planning
- No error-to-alternative mapping
- No validation feedback loop
- No cost/quality optimization
- No style preference learning

---

## 4. Proposed Design

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI Service Layer (NEW)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  AI Integration Layer                                                 │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │ │
│  │  │ Intent      │  │ Context      │  │ Response                    │ │ │
│  │  │ Recognition │  │ Management   │  │ Generation & Formatting     │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    HI MCP Server (Existing + Extended)                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Kitchen-Specific Tools (NEW)                                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │ │
│  │  │ Kitchen      │  │ Article      │  │ Configuration              │  │ │
│  │  │ Commands     │  │ Selection    │  │ Validation                │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Core Tools (Existing)                                               │ │
│  │  get-plan-context, create-or-replace-groups, place-group, etc.     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Roomle Planner (Browser)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  roomDesignerApi.extended                                             │ │
│  │  - Plan management                                                   │ │
│  │  - Article catalog                                                   │ │
│  │  - Validation rules                                                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Breakdown

**1. AI Integration Layer**
- **Purpose**: Orchestrate AI interactions with the MCP server
- **Responsibilities**:
  - Intent recognition (classify user requests)
  - Parameter extraction (parse dimensions, positions, articles)
  - Command generation (translate to tool calls)
  - Response formatting (natural language responses)
  - Error handling (interpret and recover from errors)
  - Alternative suggestions (generate fallback options)

**2. Context Management**
- **Purpose**: Maintain conversational state
- **Stores**:
  - Current plan state
  - User preferences (style, materials, colors)
  - Conversation history
  - Session-specific constraints

**3. Kitchen-Specific Tools**
- **Purpose**: Extend HI MCP server with kitchen domain knowledge
- **New Tools Needed**:
  - Kitchen creation and modification
  - Cabinet-specific operations
  - Appliance placement
  - Front/material changes
  - Island configuration
  - Worktop selection

**4. Article Intelligence**
- **Purpose**: Intelligent article selection and recommendation
- **Capabilities**:
  - Semantic article search
  - Compatibility validation
  - Style matching
  - Size/dimension filtering
  - Price range consideration

### 4.3 Design Principles

1. **Separation of Concerns**: AI layer separate from tool layer
2. **Extensibility**: Modular architecture for future enhancements
3. **Backward Compatibility**: Existing tools remain functional
4. **Validation First**: All AI-generated configurations must be validated
5. **User in Control**: AI suggests, user confirms
6. **Transparency**: AI decisions should be explainable

---

## 5. Architecture Variants Evaluation

### 5.1 Variant A: JSON-based Generation

**Description**: AI generates complete kitchen configurations as JSON structures.

**Workflow:**
```
User Request → AI generates full kitchen JSON → Validate → Apply to planner
```

**Pros:**
| Aspect | Rating | Notes |
|--------|--------|-------|
| Simplicity | ⭐⭐⭐⭐⭐ | Single comprehensive output |
| Completeness | ⭐⭐⭐⭐⭐ | All aspects in one go |
| Token Efficiency | ⭐⭐⭐ | Large JSON can be expensive |
| Maintainability | ⭐⭐⭐ | Schema evolution required |
| Flexibility | ⭐⭐⭐ | Hard to make incremental changes |

**Cons:**
- High token consumption for complex kitchens
- Difficult to modify partially
- Schema must cover all kitchen aspects
- Validation of complete configurations complex
- Error recovery challenging

**Token Estimates:**
- Small kitchen (5-10 cabinets): ~2,000-5,000 tokens
- Medium kitchen (15-20 cabinets): ~5,000-10,000 tokens
- Large kitchen (25+ cabinets): 10,000+ tokens

**Recommendation**: **Not recommended** for iterative workflows. Better for initial creation only.

---

### 5.2 Variant B: Function Calling

**Description**: AI generates discrete commands that are executed sequentially.

**Workflow:**
```
User Request → AI generates commands → Execute command 1 → Validate → Execute command 2 → ... → Final state
```

**Command Types Needed:**
```typescript
// Kitchen creation
CreateKitchen(
  layout: "L-shaped" | "U-shaped" | "Galley" | "Island",
  dimensions: { width: number, depth: number, height: number },
  style: string,
  colorScheme: string
)

// Article operations
AddArticle(
  type: "base-cabinet" | "wall-cabinet" | "tall-cabinet" | "appliance",
  position: { x: number, y: number, z: number },
  dimensions: { width: number, depth: number, height: number },
  articleId?: string,  // Optional: let AI select
  color?: string,
  material?: string
)

ReplaceArticle(
  runtimeId: number,
  newArticleId?: string,
  newType?: string,
  newColor?: string,
  newMaterial?: string
)

RemoveArticle(runtimeId: number)

UpdateArticle(
  runtimeId: number,
  position?: { x: number, y: number, z: number },
  dimensions?: { width: number, depth: number, height: number },
  color?: string
)

// Kitchen modifications
AddIsland(
  dimensions: { width: number, depth: number },
  position: { x: number, y: number },
  style?: string
)

EnlargeIsland(runtimeId: number, extension: number)

ChangeFronts(
  filter?: { type?: string, color?: string, material?: string },
  articleIds?: string[]
)
```

**Pros:**
| Aspect | Rating | Notes |
|--------|--------|-------|
| Iterative | ⭐⭐⭐⭐⭐ | Supports step-by-step changes |
| Token Efficiency | ⭐⭐⭐⭐ | Small, focused commands |
| Error Recovery | ⭐⭐⭐⭐⭐ | Easy to undo/retry single commands |
| User Control | ⭐⭐⭐⭐⭐ | Transparent what's happening |
| Validation | ⭐⭐⭐⭐ | Validate each step |
| Maintainability | ⭐⭐⭐⭐ | Clear command boundaries |

**Cons:**
- More complex AI prompt engineering
- Requires command sequencing logic
- User may need to approve intermediate steps
- Higher latency for multi-step operations

**Token Estimates:**
- Single command: ~50-200 tokens
- Complex request (multiple commands): ~500-1,500 tokens

**Recommendation**: **✅ Preferred approach** for most use cases. Balances flexibility, efficiency, and control.

---

### 5.3 Variant C: Hybrid Approach

**Description**: Use JSON for initial creation, commands for modifications.

**Workflow:**
```
# Initial creation
User: "Create a modern L-shaped kitchen with island"
AI → Generate kitchen JSON → Validate → Apply

# Subsequent modifications
User: "Replace fronts with oak"
AI → Generate ReplaceFronts command → Validate → Apply

User: "Add a pharmacy cabinet"
AI → Generate AddArticle command → Validate → Apply
```

**Pros:**
| Aspect | Rating | Notes |
|--------|--------|-------|
| Initial Creation | ⭐⭐⭐⭐⭐ | Comprehensive setup |
| Modifications | ⭐⭐⭐⭐⭐ | Fine-grained changes |
| Flexibility | ⭐⭐⭐⭐⭐ | Best of both worlds |
| Token Efficiency | ⭐⭐⭐⭐ | Optimized for each use case |
| User Experience | ⭐⭐⭐⭐⭐ | Natural for both scenarios |

**Cons:**
- Most complex implementation
- Need to detect context (creation vs. modification)
- Two different AI models/prompts may be needed
- Higher development effort

**Recommendation**: **✅ Recommended** if resources allow. Provides optimal user experience.

---

### 5.4 Architecture Decision Matrix

| Criteria | Weight | JSON | Function Calling | Hybrid |
|----------|--------|------|-----------------|--------|
| Implementation Complexity | 20% | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Token Efficiency | 25% | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| User Experience | 20% | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Maintainability | 15% | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Error Recovery | 10% | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Flexibility | 10% | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Total** | **100%** | **66%** | **89%** | **94%** |

**Decision**: **Hybrid approach (Variant C)** is the optimal solution for the Sales Configurator AI integration, with **Function Calling (Variant B)** as a pragmatic fallback for initial implementation.

---

## 6. Data and Metadata Requirements

### 6.1 Article Metadata Schema

Based on the proposal, articles require comprehensive metadata for AI selection:

```typescript
interface ArticleMetadata {
  // Identification
  id: string;                    // Unique article identifier
  rapiId: string;               // Roomle API identifier
  
  // Categorization
  category: Category;            // base-cabinet, wall-cabinet, tall-cabinet, appliance, etc.
  subCategory?: SubCategory;     // sink-cabinet, corner-cabinet, etc.
  
  // Classification
  type: string;                 // Specific type (e.g., "Spulenunterschrank" = under-sink cabinet)
  purpose: Purpose[];            // Functional purpose (storage, sink, oven, etc.)
  
  // Visual Properties
  style: Style[];               // modern, classic, rustic, minimalist, etc.
  material: Material[];          // wood, metal, glass, etc.
  color: Color[];               // Available colors
  finish: Finish[];              // matte, glossy, textured, etc.
  
  // Physical Properties
  dimensions: {
    width: { min: number, max: number, step: number };   // mm
    depth: { min: number, max: number, step: number };   // mm
    height: { min: number, max: number, step: number };  // mm
  };
  
  // Compatibility
  compatibleWith: string[];      // IDs of compatible articles
  requires?: string[];           // Required companion articles
  incompatibleWith?: string[];   // Mutually exclusive articles
  
  // Descriptive
  name: { de: string; en: string };
  description: { de: string; en: string };
  keywords: { de: string[]; en: string[] };
  
  // AI Optimization
  aiDescription: string;        // Natural language description for AI
  aiTags: string[];             // Semantic tags
  
  // Business
  priceRange: { min: number; max: number; currency: string };
  brand?: string;
  collection?: string;
  
  // Technical
  weight: number;               // kg
  loadCapacity?: number;        // kg (for shelves, worktops)
  waterConnection?: boolean;    // For sinks
  electricalConnection?: boolean; // For appliances
}

type Category = 
  | 'base-cabinet'
  | 'wall-cabinet'
  | 'tall-cabinet'
  | 'appliance'
  | 'worktop'
  | 'front'
  | 'handle'
  | 'accessory';

type Style = 
  | 'modern'
  | 'classic'
  | 'rustic'
  | 'minimalist'
  | 'industrial'
  | 'scandinavian'
  | 'contemporary';

type Material = 
  | 'wood'
  | 'mdf'
  | 'metal'
  | 'glass'
  | 'stone'
  | 'laminate'
  | 'acrylic';

type Purpose = 
  | 'storage'
  | 'sink'
  | 'oven'
  | 'hob'
  | 'fridge'
  | 'dishwasher'
  | 'wine-cooler'
  | 'pantry'
  | 'corner'
  | 'island';
```

### 6.2 Metadata Quality Assessment

**Current State Analysis:**
- Most articles have basic identification (ID, name)
- Categorization exists but may be inconsistent
- Visual properties (color, material) partially available
- Physical dimensions available but not always complete
- Compatibility rules exist in Sales Configurator
- AI-optimized descriptions largely missing

**Required Enhancements:**

| Metadata Field | Current State | Required | Priority | Effort |
|---------------|---------------|----------|----------|--------|
| English descriptions | Partial | Yes | High | Medium |
| AI-optimized descriptions | Missing | Yes | High | High |
| Style classification | Partial | Yes | Medium | Medium |
| Purpose classification | Partial | Yes | Medium | Medium |
| Compatibility rules | Partial | Yes | High | Low (existing) |
| Semantic keywords | Missing | Yes | Medium | High |
| Dimension constraints | Available | Yes | Low | Low |

**Action Items:**
1. **Audit existing metadata** - Identify gaps and inconsistencies
2. **Define metadata standards** - Create schema and validation rules
3. **Translate to English** - Ensure all descriptions available in English
4. **Create AI-optimized descriptions** - Natural language descriptions for AI consumption
5. **Enhance semantic tagging** - Add comprehensive keywords for semantic search

### 6.3 Metadata Enrichment Strategy

**Phase 1: Critical Fields (Month 1)**
- English translations for all articles
- AI-optimized descriptions for top 1000 articles
- Style and purpose classification

**Phase 2: Comprehensive (Month 2-3)**
- Semantic keywords for all articles
- Compatibility metadata enhancement
- Dimension constraints validation

**Phase 3: Continuous (Ongoing)**
- Metadata quality monitoring
- Continuous enrichment for new articles
- User feedback integration

---

## 7. Article Selection Strategies

### 7.1 Selection Approach Decision

**Proposal**: The AI **should** be responsible for article selection, but with **validation by the Sales Configurator**.

**Rationale:**
1. **Existing validation**: Sales Configurator already validates rules, geometry, dependencies
2. **AI capability**: Can evaluate multiple factors (style, budget, space, preferences)
3. **User experience**: Faster than manual selection
4. **Complexity reduction**: AI can handle combinatorial complexity

**Constraints:**
- All AI selections must pass Sales Configurator validation
- AI should explain its selections (transparency)
- User must have final approval
- Fallback options should be provided

### 7.2 Selection Methods

#### Method 1: Classical Filtering

**Description**: AI applies structured filters to narrow down options.

**Example:**
```
User: "Add a 60cm wide base cabinet"

Filters applied:
- category = "base-cabinet"
- width = 600mm (+/- tolerance)
- style = user_preference ("modern")
- color = user_preference ("white")
- material = user_preference ("laminate")

Result: Top 5 matching articles
```

**Pros:**
- Fast and deterministic
- Easy to understand and debug
- Works well for explicit requirements

**Cons:**
- Limited flexibility
- Doesn't handle implicit requirements
- Requires precise user input

#### Method 2: Semantic Search

**Description**: AI uses natural language understanding to find matching articles.

**Example:**
```
User: "Add a modern sink cabinet for a family kitchen"

Embedding-based search for:
- "modern" style
- "sink" purpose
- "family kitchen" context (implies durability, storage)

Result: Articles ranked by semantic similarity
```

**Pros:**
- Handles implicit requirements
- More natural user interaction
- Can discover non-obvious matches

**Cons:**
- Requires high-quality embeddings
- More computationally expensive
- Less predictable

#### Method 3: Direct Article Selection

**Description**: AI evaluates all relevant article information and makes direct selections.

**Example:**
```
User: "Add a cabinet that matches my modern white kitchen"

AI considers:
- Current kitchen articles (styles, colors, materials)
- Available space (dimensions)
- User preferences (from context)
- Compatibility rules
- Price range preferences

AI selects: Specific article ID
```

**Pros:**
- Most flexible
- Can optimize across multiple factors
- Provides definitive answers

**Cons:**
- Highest complexity
- Requires comprehensive article knowledge
- Harder to explain decisions
- Risk of "black box" decisions

### 7.3 Recommended Approach

**Hybrid Selection Strategy:**

```
Phase 1: Filtering (Fast elimination)
├── Hard constraints (dimensions, category, etc.)
└── Reduces candidate set from N to M

Phase 2: Ranking (Intelligent ordering)
├── Semantic similarity to request
├── Style compatibility
├── Price appropriateness
└── User preference matching

Phase 3: Selection (Final choice)
├── Top K candidates presented
├── With explanations
└── User makes final choice (or auto-selects top)
```

**Implementation:**
1. Use filtering for initial candidate reduction (fast, deterministic)
2. Apply semantic search for ranking (quality results)
3. Provide top 3-5 options with explanations (user choice)
4. Auto-select if user enables "auto-accept" mode

---

## 8. Context and Knowledge Base

### 8.1 Required Context Types

**1. Current Plan State**
- All placed articles (type, position, dimensions, properties)
- Kitchen layout (walls, openings, obstacles)
- Current style and color scheme
- Valid placement areas

**2. User Preferences**
```typescript
interface UserPreferences {
  // Style
  preferredStyles: Style[];
  dislikedStyles: Style[];
  
  // Colors
  preferredColors: Color[];
  dislikedColors: Color[];
  
  // Materials
  preferredMaterials: Material[];
  
  // Budget
  budgetRange?: { min: number; max: number };
  
  // Kitchen type
  kitchenType?: 'small' | 'family' | 'premium' | 'island';
  
  // Specific preferences
  prefersIsland?: boolean;
  prefersOpenShelving?: boolean;
  prefersHandleless?: boolean;
}
```

**3. Conversation History**
- Previous requests in current session
- Applied changes and their outcomes
- Rejected options and reasons
- Clarification questions asked/answered

**4. Session-Specific Constraints**
- Room dimensions (if provided)
- Fixed articles (that shouldn't be changed)
- Design themes
- Brand preferences

### 8.2 Storage Scope Decision

**Options:**

| Scope | Description | Pros | Cons |
|-------|-------------|------|------|
| Per Chat | Context reset on new chat | Simple, isolated | No learning across chats |
| Per Project | Context shared within project | Consistent within project | Complex to manage |
| Per Customer | Context shared across all projects | Personalized experience | Privacy concerns, complex |

**Recommendation:** **Per Project** with option to persist to Per Customer

**Implementation:**
- Default: Per chat (stateless, simple)
- Optional: Persist context to project (opt-in)
- Future: Customer-level preferences (with consent)

### 8.3 Few-Shot Examples

**Purpose**: Provide AI with example kitchen configurations to guide its decisions.

**Example Types Needed:**

1. **Small Kitchen** (Compact, efficient)
   - Layout: Galley or single-wall
   - Typical articles: Space-saving cabinets, compact appliances
   - Style: Minimalist, functional

2. **Family Kitchen** (Spacious, durable)
   - Layout: L-shaped or U-shaped with island
   - Typical articles: Large storage, family-sized appliances, durable materials
   - Style: Practical, warm colors

3. **Island Kitchen** (Open concept)
   - Layout: L-shaped or U-shaped with central island
   - Typical articles: Island cabinet, bar seating, open shelving
   - Style: Modern, social

4. **Premium Kitchen** (High-end)
   - Layout: Custom design with premium features
   - Typical articles: High-end appliances, custom cabinets, premium materials
   - Style: Luxury, bespoke

**Storage:** Embed in AI prompts as context examples

**Format:**
```json
{
  "examples": [
    {
      "name": "Small Modern Kitchen",
      "description": "Compact galley kitchen for urban apartments",
      "layout": "galley",
      "dimensions": { "width": 2500, "depth": 3500 },
      "articles": [
        { "type": "base-cabinet", "width": 600, "color": "white", "material": "laminate" },
        { "type": "wall-cabinet", "width": 600, "color": "white" },
        { "type": "hob", "width": 600 },
        { "type": "sink-cabinet", "width": 800 }
      ],
      "style": "modern",
      "colorScheme": "white with wood accents"
    }
  ]
}
```

---

## 9. Integration Points

### 9.1 Responsibility Division

**AI Responsibilities:**
| Task | Description | Complexity |
|------|-------------|------------|
| Intent Recognition | Understand user request | High |
| Article Selection | Choose appropriate articles | High |
| Command Generation | Create tool commands | Medium |
| Response Formatting | Generate natural language responses | Medium |
| Alternative Suggestions | Provide fallback options | Medium |

**Sales Configurator Responsibilities:**
| Task | Description | Complexity |
|------|-------------|------------|
| Validation | Check rules, geometry, compatibility | High |
| Positioning | Calculate precise positions | High |
| Rendering | Generate visual representations | Medium |
| Error Detection | Identify configuration issues | Medium |
| Price Calculation | Compute accurate pricing | Medium |

### 9.2 Validation Feedback Loop

**Current State**: Sales Configurator validates and returns errors

**Enhanced Flow:**
```
1. AI generates command
2. Sales Configurator validates
3. If valid → Apply and confirm
4. If invalid → Return specific error
5. AI interprets error and generates alternatives
6. Present alternatives to user
7. User selects or requests modifications
```

**Error Types and AI Responses:**

| Error Type | AI Response | Example |
|------------|-------------|---------|
| Insufficient space | Suggest smaller alternatives | "This cabinet is too wide. Here are narrower options: [list]" |
| Compatibility conflict | Suggest compatible alternatives | "This hob doesn't work with that oven. Try: [list]" |
| Rule violation | Explain rule and suggest compliant options | "Fronts must match cabinet type. Here are matching fronts: [list]" |
| Placement conflict | Suggest alternative positions | "This cabinet overlaps with the sink. Try placing it here: [position]" |
| Budget exceeded | Suggest more affordable options | "This exceeds your budget. Here are alternatives in your range: [list]" |

### 9.3 Workflow Integration

**Option 1: Direct Integration**
```
User → AI Service → HI MCP Server → Roomle Planner
           ↑              ↑
           │              │
   Context        Validation
   Memory         Feedback
```

**Option 2: MCP Tool Extension**
```
User → AI Service with MCP Client → HI MCP Server (Extended)
                              ↑
                    Kitchen-specific tools
                    Article intelligence
                    Context management
```

**Recommendation**: **Option 2** - Extend HI MCP Server with kitchen-specific capabilities and AI integration layer as MCP client.

**Benefits:**
- Clean separation of concerns
- Reusable HI MCP Server
- AI service can be independent
- Easier to test and maintain

---

## 10. Technology Stack Considerations

### 10.1 AI Model Evaluation

**Models to Consider:**

| Model | Provider | Strengths | Weaknesses | JSON Stability | Function Calling | Cost |
|-------|----------|-----------|------------|----------------|------------------|------|
| GPT-4.1 | OpenAI | Best quality, reasoning | Expensive | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $$$$ |
| GPT-4.1 Mini | OpenAI | Fast, cost-effective | Less capable | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $ |
| GPT-4o | OpenAI | Good balance | Medium cost | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $$$ |
| Azure GPT-4 | Microsoft | Enterprise ready | Azure dependency | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $$$ |
| Claude 3.5 | Anthropic | Good JSON, long context | Less structured | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | $$ |
| Llama 3.1 | Meta | Open source, customizable | Less polished | ⭐⭐⭐ | ⭐⭐⭐ | $ |

**Recommendation:**
- **Primary**: GPT-4.1 for high-quality, complex requests
- **Fallback**: GPT-4.1 Mini for simple, high-volume requests
- **Alternative**: Claude 3.5 Sonnet for cost-effective JSON generation

### 10.2 Technology Stack Proposal

**AI Integration Layer:**
- **Language**: TypeScript/Node.js
- **Framework**: Express.js or Fastify
- **AI SDK**: OpenAI SDK, Anthropic SDK, or LangChain
- **MCP Client**: @modelcontextprotocol/sdk
- **State Management**: Redis (for context persistence)

**HI MCP Server Extensions:**
- **Kitchen Tools**: New TypeScript modules
- **Article Intelligence**: Vector database (Qdrant, Pinecone, or Weaviate)
- **Validation**: Enhanced validation logic

**Infrastructure:**
- **Deployment**: Container-based (Docker)
- **Orchestration**: Kubernetes or Docker Compose
- **Monitoring**: Prometheus + Grafana
- **Logging**: Structured logging with ELK stack

### 10.3 Cost Considerations

**Cost Drivers:**
1. AI model usage (tokens processed)
2. Vector database hosting
3. Infrastructure costs

**Cost Estimates (Monthly):**

| Scenario | Requests/Day | Tokens/Request | Model | Monthly Cost |
|----------|--------------|----------------|-------|--------------|
| Low Volume | 100 | 2,000 | GPT-4.1 Mini | ~$50 |
| Medium Volume | 1,000 | 2,000 | GPT-4.1 Mini | ~$500 |
| High Volume | 10,000 | 2,000 | GPT-4.1 Mini | ~$5,000 |
| Premium | 1,000 | 5,000 | GPT-4.1 | ~$20,000 |

**Cost Optimization Strategies:**
1. Use cheaper models for simple requests
2. Cache frequent requests
3. Batch similar requests
4. Implement request throttling
5. Use function calling to reduce token usage

---

## 11. Success Criteria

### 11.1 Must Have (P0)

**Functionality:**
- [ ] Create new kitchen via natural language
- [ ] Modify existing kitchen configuration
- [ ] Exchange articles (replace one article with another)
- [ ] Add articles (supplement existing configuration)
- [ ] Change front colors/materials
- [ ] Support island configurations
- [ ] Adjust cabinet configurations

**Quality:**
- [ ] 90% of valid requests successfully processed
- [ ] <5% error rate on AI-generated configurations
- [ ] All configurations pass Sales Configurator validation
- [ ] Response time <5 seconds for simple requests
- [ ] Response time <10 seconds for complex requests

**User Experience:**
- [ ] Natural language understanding for kitchen requests
- [ ] Clear, actionable error messages
- [ ] Alternative suggestions for failed requests
- [ ] Transparent AI decisions (explainable)

### 11.2 Should Have (P1)

**Enhanced Functionality:**
- [ ] Interior fittings configuration
- [ ] Automatic error correction
- [ ] Multiple alternative suggestions
- [ ] Justification for article selections

**Quality Improvements:**
- [ ] 95% success rate for valid requests
- [ ] Response time <3 seconds for simple requests
- [ ] Contextual understanding across conversation
- [ ] Learning from user corrections

### 11.3 Nice To Have (P2)

**Advanced Features:**
- [ ] Budget optimization suggestions
- [ ] Design style recommendations
- [ ] Style analysis and matching
- [ ] Learning user preferences over time
- [ ] Multi-room kitchen planning
- [ ] 3D visualization integration

---

## 12. Implementation Roadmap

### 12.1 Phase 1: Foundation (Month 1)

**Goals:** Establish core AI integration and basic kitchen commands.

**Tasks:**
- [ ] Set up AI integration layer
- [ ] Implement intent recognition for kitchen requests
- [ ] Extend HI MCP Server with basic kitchen tools
- [ ] Implement command generation for simple operations
- [ ] Set up context management (per chat)
- [ ] Create basic article selection (filtering approach)
- [ ] Integrate with Sales Configurator validation
- [ ] Implement error handling and alternative suggestions
- [ ] Set up monitoring and logging

**Deliverables:**
- Working prototype for basic kitchen operations
- API documentation
- Initial test suite

**Success Metrics:**
- 70% request success rate
- Basic kitchen creation and modification working
- Error handling implemented

### 12.2 Phase 2: Intelligence (Month 2)

**Goals:** Enhance with intelligent article selection and context management.

**Tasks:**
- [ ] Implement semantic article search
- [ ] Enhance metadata for AI consumption
- [ ] Add project-level context persistence
- [ ] Implement hybrid selection strategy
- [ ] Add few-shot examples
- [ ] Enhance error recovery
- [ ] Implement alternative generation
- [ ] Add explanation generation

**Deliverables:**
- Intelligent article selection
- Context persistence
- Enhanced error handling
- Explanation capabilities

**Success Metrics:**
- 85% request success rate
- Intelligent article suggestions
- Context-aware conversations

### 12.3 Phase 3: Optimization (Month 3)

**Goals:** Optimize performance, cost, and user experience.

**Tasks:**
- [ ] Implement cost optimization strategies
- [ ] Add performance monitoring
- [ ] Implement caching for frequent requests
- [ ] Add batch processing
- [ ] Implement user preference learning
- [ ] Add budget-aware suggestions
- [ ] Enhance style matching
- [ ] Improve response formatting

**Deliverables:**
- Optimized performance
- Reduced costs
- Enhanced user experience

**Success Metrics:**
- 90%+ request success rate
- Response time improvements
- Cost per request optimized

### 12.4 Phase 4: Advanced Features (Month 4+)

**Goals:** Add premium features and polish.

**Tasks:**
- [ ] Implement multi-alternative suggestions
- [ ] Add design recommendations
- [ ] Implement style analysis
- [ ] Add multi-room support
- [ ] Integrate 3D visualization
- [ ] Customer-level preference learning
- [ ] Advanced error correction

**Deliverables:**
- Premium feature set
- Production-ready system

**Success Metrics:**
- 95%+ request success rate
- All must-have features implemented
- Production deployment

---

## 13. Open Questions and Decisions Needed

### 13.1 Critical Decisions

**1. Architecture Variant**
- **Question**: JSON, Commands, or Hybrid?
- **Recommendation**: Hybrid (JSON for creation, Commands for modification)
- **Impact**: Fundamental to system design
- **Decision By**: End of architecture evaluation session

**2. Article Selection Responsibility**
- **Question**: Does AI select articles directly?
- **Recommendation**: Yes, with Sales Configurator validation
- **Impact**: Affects AI complexity and user experience
- **Decision By**: End of article selection discussion

**3. Metadata Quality**
- **Question**: What metadata is missing and needs enhancement?
- **Recommendation**: English descriptions, AI-optimized text, semantic tags
- **Impact**: Affects AI selection quality
- **Decision By**: End of metadata quality assessment

**4. Context Storage Scope**
- **Question**: Per chat, per project, or per customer?
- **Recommendation**: Per project with opt-in to per customer
- **Impact**: Affects user experience and privacy
- **Decision By**: End of context discussion

**5. Few-Shot Examples**
- **Question**: Do we need example kitchens for AI guidance?
- **Recommendation**: Yes, for consistent quality
- **Impact**: Affects AI response consistency
- **Decision By**: End of context and knowledge base discussion

### 13.2 Technical Decisions

**6. AI Model Selection**
- **Question**: Which model(s) to use?
- **Recommendation**: GPT-4.1 primary, GPT-4.1 Mini fallback
- **Impact**: Affects quality, cost, and performance
- **Decision By**: End of model evaluation

**7. First Technical PoC**
- **Question**: What does the first PoC look like?
- **Recommendation**: Basic kitchen creation with function calling
- **Impact**: Validates approach before full implementation
- **Decision By**: End of PoC planning

**8. Success Measurement**
- **Question**: How do we measure success?
- **Recommendation**: Must-have success criteria as defined
- **Impact**: Affects implementation priorities
- **Decision By**: End of success criteria discussion

### 13.3 Process Decisions

**9. Responsibility Division**
- **Question**: What responsibilities lie with AI vs. Sales Configurator?
- **Recommendation**: AI for selection and suggestions, SC for validation and calculation
- **Impact**: Affects integration complexity
- **Decision By**: End of integration discussion

**10. Error Handling**
- **Question**: How to handle validation errors and automatic corrections?
- **Recommendation**: AI interprets errors and suggests alternatives
- **Impact**: Affects user experience
- **Decision By**: End of integration discussion

---

## Conclusion

The **Sales Configurator AI Integration** represents a significant opportunity to revolutionize kitchen planning through conversational AI. The proposed **hybrid architecture** (JSON for creation, commands for modification) with **AI-driven article selection** and **contextual memory** provides an optimal balance of flexibility, efficiency, and user experience.

**Key Takeaways:**

1. **Architecture**: Hybrid approach recommended for optimal user experience
2. **Article Selection**: AI should select articles with Sales Configurator validation
3. **Metadata**: Comprehensive enhancement required for quality AI decisions
4. **Context**: Project-level context persistence with customer opt-in
5. **Integration**: Clear responsibility division between AI and Sales Configurator
6. **Models**: GPT-4.1 for quality, GPT-4.1 Mini for cost-effectiveness
7. **Implementation**: 4-phase roadmap with clear success criteria

**Next Steps:**

1. ✅ **This Analysis** - Document completed
2. ⏳ **Architecture Decision** - Finalize in kickoff session
3. ⏳ **Metadata Audit** - Assess current data quality
4. ⏳ **PoC Implementation** - Build first technical prototype
5. ⏳ **Testing** - Validate approach with real users

---

## Appendix A: Command Examples

### Kitchen Creation
```json
{
  "command": "CreateKitchen",
  "parameters": {
    "layout": "L-shaped",
    "dimensions": { "width": 4000, "depth": 3500 },
    "style": "modern",
    "colorScheme": "white with wood",
    "includesIsland": true
  }
}
```

### Article Addition
```json
{
  "command": "AddArticle",
  "parameters": {
    "type": "base-cabinet",
    "position": { "x": 1000, "y": 500, "z": 0 },
    "dimensions": { "width": 800, "depth": 600, "height": 850 },
    "color": "white",
    "material": "laminate",
    "autoSelect": true
  }
}
```

### Article Replacement
```json
{
  "command": "ReplaceArticle",
  "parameters": {
    "runtimeId": 42,
    "newColor": "oak",
    "newMaterial": "natural wood",
    "autoSelect": false
  }
}
```

### Front Change
```json
{
  "command": "ChangeFronts",
  "parameters": {
    "filter": {
      "color": "oak natural",
      "material": "wood",
      "style": "modern"
    },
    "scope": "all"
  }
}
```

### Island Resizing
```json
{
  "command": "ResizeIsland",
  "parameters": {
    "runtimeId": 15,
    "extension": 600
  }
}
```

---

## Appendix B: Metadata Enrichment Example

### Before Enrichment
```json
{
  "id": "cabinet-12345",
  "name": { "de": "Unterschrank 60cm" },
  "category": "base-cabinet",
  "width": 600,
  "color": "white"
}
```

### After Enrichment
```json
{
  "id": "cabinet-12345",
  "rapiId": "roomle:catalog:12345",
  "name": { 
    "de": "Unterschrank 60cm",
    "en": "60cm Base Cabinet"
  },
  "category": "base-cabinet",
  "subCategory": "standard",
  "type": "under-sink-cabinet",
  "purpose": ["storage", "sink"],
  "style": ["modern", "minimalist"],
  "material": ["laminate", "MDF"],
  "color": ["white", "grey", "wood"],
  "finish": ["matte"],
  "dimensions": {
    "width": { "min": 400, "max": 1200, "step": 100 },
    "depth": { "min": 500, "max": 600, "step": 50 },
    "height": { "min": 800, "max": 900, "step": 50 }
  },
  "aiDescription": "A modern 60cm base cabinet suitable for under-sink installation. Features adjustable shelves and durable laminate finish. Available in white, grey, and wood colors.",
  "aiTags": [
    "under-sink", "storage", "modern", "adjustable-shelves",
    "durable", "laminate", "kitchen-cabinet"
  ],
  "keywords": {
    "de": ["Unterschrank", "Spulenunterschrank", "60cm", "modern", "weiss"],
    "en": ["base cabinet", "under sink", "60cm", "modern", "white"]
  },
  "compatibleWith": ["sink-6001", "sink-6002"],
  "requires": ["plinth-100"],
  "priceRange": { "min": 150, "max": 250, "currency": "EUR" },
  "weight": 35
}
```

---

## Appendix C: Glossary

| Term (German) | Term (English) | Definition |
|--------------|----------------|------------|
| Raumerzeugung | Room Creation | Creating room geometry and layout |
| Raumdekoration | Room Decoration | Adding decorative elements to room |
| Bildgenerierung | Image Generation | Creating visual representations |
| Preisoptimierung | Price Optimization | Finding cost-effective solutions |
| Verkaufsempfehlungen | Sales Recommendations | Suggesting products for upselling |
| Apothekerschrank | Pharmacy Cabinet | Tall, narrow cabinet for pharmaceuticals or small items |
| Insel | Island | Free-standing kitchen cabinet structure |

---

## 14. Architecture Validation: MCP Server for 3D Web App Control

### Question

> **My situation is as follows:**
> 
> I have a web app containing a 3D scene. The app should be controlled by an AI chat agent. The chat should later be integrated within the app. However, a lot of decisions have to be made and a lot of research regarding the model and background services has to be done.
> 
> For now, during the PoC and research phase, a web-based chatbot such as Gemini or an app such as Claude should be used to control the app.
> 
> **Would an MCP server be the right choice for this?**

### Answer

**Yes, an MCP server is the ideal architecture for your current situation.**

Using MCP (Model Context Protocol) during your research and PoC phase gives you three huge advantages:

---

#### 1. Zero Custom Chat UI Needed

You don't need to waste time building chat inputs, streaming message UIs, or websocket logic inside your web app right now. You can use off-the-shelf desktop or web chat clients (Claude Desktop, Askimo, Cursor, or Gemini CLI) as your interface. You type to the agent in the chat app, and it controls your 3D web scene in real time.

---

#### 2. Effortless Model & Service Comparison

Because MCP is a standardized tool protocol, your server tools (e.g., `add_object`, `rotate_camera`, `change_material`, `get_scene_state`) are model-agnostic.

You can connect the **exact same MCP server** to different clients or models—switching between Claude, GPT, or Gemini mid-research—to evaluate which model understands spatial layout, follows design rules, and executes 3D tool calls most accurately without rewriting a single line of backend code.

---

#### 3. Clear Bridge to Your Web App

In this architecture, your MCP server acts as the middleman between the LLM and your 3D scene:

```
[ Off-the-shelf Chat Client ]
          │ (1. Natural language request)
          ▼
    [ AI Model ]
          │ (2. Tool call: add_chair(x: 2, y: 0, z: 1))
          ▼
   [ Your MCP Server ] 
          │ (3. Syncs scene state via WebSocket / Database)
          ▼
   [ 3D Web App Scene ] ── (Executes 3D render update live)
```

---

### Will this work when you move to an embedded chat later?

**Yes, zero work is wasted.**

When you are ready to embed the chat box directly inside your web application:

* **Option A:** Keep the MCP server running as your microservice backend and connect to it using a lightweight web MCP client SDK inside your frontend.
* **Option B:** Translate the MCP tool schemas directly into standard OpenAI/Gemini Function Calling definitions. Because MCP tool schemas use standard JSON Schema (just like OpenAI and Google), your underlying JavaScript/Python 3D execution functions remain 100% identical.

Starting with an MCP server lets you focus entirely on testing model capabilities and 3D tool logic without getting bogged down in frontend chat integration.

---

## 15. Connection Architecture: MCP Server to Web App Integration

### Question

> **I understand that the MCP server needs to be installed or recognised by the AI agent.**
> 
> But how does the MCP server connect to the app? The app has a URL and needs a protocol to communicate with the MCP server. Currently, a client-side browser bridge has been implemented. The app will always run in the client's browser. Where does the MCP server live? Let's assume that the server should be hosted in the Azure cloud. How will it connect to the app? Or is the server just another app that ultimately runs on the client?

### Answer

The MCP server **lives in the Azure Cloud**, while your 3D app runs **locally in the user's web browser**.

Because a cloud server cannot initiate a connection directly to a browser tab on its own, your web app connects to the Azure MCP server using a **two-way real-time pipe (WebSockets or Azure SignalR)**.

---

### How the Cloud MCP Server Connects to the Browser App

```
 [ AI Agent (Claude/Gemini) ]
              │ 
              │  1. Tool Call: "add_chair" (HTTP/SSE)
              ▼
   [ Azure MCP Server ]  <─── (Lives in Cloud)
              │
              │  2. Push Action: { action: "add_chair", x: 2, y: 1 }
              ▼  (Real-time WebSocket / SignalR Connection)
   [ 3D Web App Scene ]  <─── (Runs in User's Browser)
```

#### Step-by-Step Connection Flow:

1. **User opens the 3D Web App in their browser:**
   When the web app loads, your JavaScript code automatically opens a **WebSocket connection** to your Azure server address, passing the user's identifier:
   `wss://your-app.azurewebsites.net/connect?session_id=alice@company.com`

2. **User talks to the AI Agent:**
   The user asks the chat agent: *"Add a chair to the room."*

3. **Agent triggers the Azure MCP Server:**
   The agent calls your MCP server endpoint running on Azure.

4. **Azure MCP Server pushes the command to the browser:**
   The MCP server looks up the active WebSocket pipe associated with `alice@company.com` and immediately pushes the command down:
   `{ "command": "ADD_OBJECT", "model": "chair", "position": [2, 0, 1] }`

5. **Browser renders the change:**
   Your client-side 3D engine (e.g., Three.js, Babylon.js) receives the message over the WebSocket and instantly adds the chair into the live scene.

---

### Is the server just another app that runs on the client?

It can be structured either way, but for your setup:

* **Remote Cloud MCP (Recommended for your PoC):** The MCP server runs in **Azure**. This allows multiple users across different computers to connect to the same central backend, and lets web-based agents (like Gemini or web chat tools) reach your tools over the internet.
* **Local MCP Server:** Some desktop clients (like Claude Desktop) support running MCP servers locally on the user's machine as a background process. However, if your 3D app is a web URL, having the MCP server hosted in **Azure with WebSockets** is cleaner, as it requires zero local software installation on your team's computers.

---

### The simplest tech stack for this on Azure

If you want to build this bridge with minimal effort:

1. **Server:** Node.js running on Azure App Service using standard `ws` (WebSockets) or `socket.io`.
2. **Client:** 10 lines of JavaScript in your 3D Web App to open `new WebSocket("wss://...")` and listen for incoming 3D draw commands.

---

## 16. App Lifecycle: Handling Non-Running 3D Application

### Question

> **In this scenario, the web app is already running.** This is fine and covers the main use case. But what if the app is not running? Would it be possible for the AI agent, using information from the MCP server, to start the app in a defined initial state? The problem is that the MCP server needs the app to generate content. Therefore, if the app is not running, someone has to start it before the MCP server can generate meaningful output. This could be the AI agent, provided it has permission to open a tab in a browser. Alternatively, the AI agent could ask the user to do so using a prepared URL.

### Answer

This is a crucial distinction. If the 3D engine/SDK logic currently lives **only inside the frontend browser app**, the MCP server cannot compute or generate the 3D scene without a running instance of that engine.

Whether the AI agent can open the browser tab automatically or must ask the user via a URL depends entirely on **which type of AI agent you are using**:

---

### Scenario A: You are using Web-based AI Agents (Claude Web, ChatGPT, Gemini Web)

**The AI agent CANNOT open a browser tab on your computer automatically.**

Because web-based AI models run in remote cloud data centers inside a browser sandbox, security restrictions prevent them from executing local operating system commands to launch applications on your desktop.

#### Solution: The "Prepared URL / Bootstrapping" Pattern

1. **User asks the Web Agent:** *"Create a 2-bedroom floor plan."*
2. **MCP Server queues the instruction:** The MCP server running on Azure stores the pending task in Azure (Redis or Blob storage) under a temporary session ID (e.g., `session-99`).
3. **Agent responds with a Prepared URL:**
   > *"I need to launch the 3D Scene App to generate this layout. Click here to open the app: `[https://my-3d-app.com](https://my-3d-app.com)?init_session=session-99`"*

4. **User clicks the link:** The browser tab opens `my-3d-app.com`.
5. **App executes the task:** On startup, the web app reads `init_session=session-99` from the URL, fetches the queued prompt from Azure, runs its internal 3D engine to generate the room, and opens the live WebSocket connection for future chat commands.

---

### Scenario B: You are using Desktop / Local AI Agents (Claude Desktop, Cursor, Local CLI)

**YES, the AI agent CAN open the browser tab automatically.**

Because desktop agents run locally on your machine, an MCP server can expose a system execution tool (e.g., `launch_browser_app`).

#### Solution: Automated OS Launch

1. **User asks the Desktop Agent:** *"Create a 2-bedroom floor plan."*
2. **MCP Server calls `launch_browser_app`:** The MCP tool triggers a local OS command (`open "[https://my-3d-app.com?session=123](https://my-3d-app.com?session=123)"` on macOS or `start "https://..."` on Windows).
3. **Tab opens automatically:** Your default browser pops open to the app URL.
4. **App connects & renders:** As soon as the tab loads, the WebSocket connects to Azure, receives the generation payload, and renders the 3D scene live in front of the user.

---

### Scenario C: The Headless Engine Pattern (How your team's PoC solved this)

If you don't want to rely on the user having a browser tab open *at all* during generation, you do what your colleague's Room Planner PoC did:

* **Run a Headless SDK on the Server:** They extracted the core scene generator code into a **Headless Software Development Kit (SDK)** running inside the server environment.

* **Server-side Generation:** When the MCP tool is called, the headless SDK executes the 3D placement logic and exports the scene state (e.g., XML/JSON) directly on Azure.

* **Browser as a Pure Viewer:** The web app becomes a pure renderer that simply pulls the exported XML/JSON state from Azure whenever the user chooses to open the URL.

---

### Summary Recommendation for Your PoC

* If you are testing with **Claude Desktop**, implement a 5-line local system launcher tool to pop the browser tab open automatically.
* If you are testing with **Web Chat tools (Gemini/Claude Web)**, use the **Prepared URL pattern**—have the agent give the user a link that launches the app and passes the initialization payload directly into the browser.

---

## Appendix D: Azure Cloud Deployment for MCP Servers

### Overview

This appendix documents a **simple, container-free approach** for hosting MCP servers on **Azure App Service**, enabling multi-user support without Docker complexity.

### Architecture Summary

**Goal**: Support multiple team members with isolated session states in Azure Cloud

**Key Principles:**
- **No container management**: Azure handles server environment, runtime, and SSL
- **Simple UI setup**: Users connect via URL and email without configuration files
- **Concurrent execution**: Azure App Service handles parallel HTTP requests
- **State isolation**: Session state keyed by user email address

### Phase 1: Prepare Your Server Code for Parallel Users

To support multiple concurrent users without session conflicts:

#### 1. Extract User Identity from Headers

Modify the HTTP/SSE server handler to inspect incoming request headers for user identification:

```javascript
// Example: Extract user email from headers
function getUserEmail(request) {
  // Check for standard headers
  const email = request.headers['x-user-email'] ||
                request.headers['x-ms-client-principal-name'] ||
                request.headers['authorization']?.split(' ')[1];
  
  // For Azure App Service with Easy Auth
  const principal = request.headers['x-ms-client-principal'];
  if (principal) {
    try {
      const principalObj = JSON.parse(principal);
      return principalObj.email || principalObj.name;
    } catch (e) {}
  }
  
  return email || 'anonymous';
}
```

#### 2. Key State by User Identity

Store active scene/plan data in an in-memory dictionary keyed by user identifier:

```javascript
// Session store indexed by user email
const activeSessions = new Map(); // Map<string, SessionState>

function getSession(userEmail) {
  if (!activeSessions.has(userEmail)) {
    activeSessions.set(userEmail, createNewSession());
  }
  return activeSessions.get(userEmail);
}

function clearSession(userEmail) {
  activeSessions.delete(userEmail);
}

// Cleanup inactive sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, session] of activeSessions) {
    if (now - session.lastAccess > SESSION_TIMEOUT_MS) {
      activeSessions.delete(email);
    }
  }
}, SESSION_CLEANUP_INTERVAL_MS);
```

**Example Flow:**
- Request from `alice@company.com` → Modifies Alice's kitchen layout
- Concurrent request from `bob@company.com` → Modifies Bob's kitchen layout
- Each user maintains independent session state

### Phase 2: Deploy Raw Code to Azure App Service

#### Step 1: Create Azure Resource

**Via Azure Portal:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Search for and select **App Services**
3. Click **Create**
4. Select **Web App**
5. Configure:
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new or select existing
   - **Name**: Your app name (e.g., `kitchen-ai-mcp`)
   - **Runtime Stack**: Match your code (Node 20 LTS, Python 3.11, etc.)
   - **Operating System**: Linux or Windows
   - **Region**: Choose closest to your users

6. **Pricing Plan**: Select based on needs
   - **F1 (Free)**: 60 minutes/day compute, 1 GB storage (for PoC)
   - **B1 (Basic)**: ~$14/month, 100 minutes/day compute (small team)
   - **S1 (Standard)**: ~$75/month, unlimited compute (production)
   - **P1V2 (Premium)**: ~$235/month, enhanced features

**Via Azure CLI:**
```bash
az group create --name myResourceGroup --location eastus
az webapp create --resource-group myResourceGroup \
  --name kitchen-ai-mcp \
  --runtime "NODE:20-lts" \
  --startup-file "minimal-hi-example/hi-mcp-server.js" \
  --sku F1
```

#### Step 2: Enable Easy Auth (Optional)

For authentication without manual token management:

1. In Azure Portal, navigate to your App Service
2. Go to **Authentication** 
3. Click **Add identity provider**
4. Select provider (Microsoft, Google, etc.)
5. Configure and save

This automatically injects user identity into headers.

#### Step 3: Deploy Directly from VS Code

**Prerequisites:**
- Install [Azure App Service extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) in VS Code
- Sign in to Azure from VS Code (Ctrl+Shift+P → "Azure: Sign In")

**Deployment Steps:**
1. Open your MCP server repository folder in VS Code
2. Click the Azure icon in the sidebar
3. Under your subscription, find your Web App (`kitchen-ai-mcp`)
4. Right-click your Web App name
5. Select **Deploy to Web App...**
6. VS Code will:
   - Detect your runtime (Node.js from package.json)
   - Install dependencies automatically
   - Deploy your source code
   - Provide live endpoint

**Result:** Your MCP server is available at:
```
https://kitchen-ai-mcp.azurewebsites.net
```

**Endpoints:**
- MCP: `https://kitchen-ai-mcp.azurewebsites.net/mcp`
- SSE Bridge: `https://kitchen-ai-mcp.azurewebsites.net/bridge`
- Health: `https://kitchen-ai-mcp.azurewebsites.net/healthz`

### Phase 3: Connect Team Members via AI Agent UI

**No configuration file editing required!**

#### For Claude Desktop / Claude.ai:

1. Open Claude Settings → **Connectors** / **MCP Settings**
2. Click **Add Custom Connector**
3. Paste your Azure URL: `https://kitchen-ai-mcp.azurewebsites.net/mcp`
4. Under **Authentication**:
   - Select "No sign-in" (if public)
   - Or configure as needed for your auth setup
5. Click **Save** and enable the connector

#### For Team Members:

Each team member connects individually:
1. Same URL: `https://kitchen-ai-mcp.azurewebsites.net/mcp`
2. Enter their company email address when prompted
3. Set permissions to "Always allow"

**How It Works:**
- Azure App Service receives requests from multiple users
- Server code extracts email from headers
- Session state is isolated by email
- Each user sees and modifies only their own kitchen configuration

### Why This Architecture Works

**Benefits:**

| Feature | Benefit | Azure Managed |
|---------|---------|---------------|
| Zero Container Management | No Dockerfiles, builds, or image maintenance | ✅ |
| Automatic Runtime | Node.js/Python runtime pre-installed | ✅ |
| SSL Certificates | Automatic HTTPS with free certificates | ✅ |
| Scaling | Automatic horizontal scaling available | ✅ (Standard+ plans) |
| Monitoring | Built-in metrics and logs | ✅ |
| CI/CD Integration | GitHub Actions, Azure DevOps support | ✅ |

**Concurrency Model:**
- Azure App Service handles **parallel HTTP requests automatically**
- Each request is processed by a worker thread
- Node.js single-threaded: Requests queue and execute sequentially per instance
- Multiple instances: Requests distribute across instances (Standard+ plans)
- Session state: Isolated by user email in application code

**Cost Efficiency:**
- **F1 Free**: Suitable for PoC and testing (60 min/day compute)
- **B1 Basic**: ~$14/month for small team evaluation
- **No idle costs**: Only pay when requests are processed (Consumption plan option)

### Comparison with Other Deployment Options

| Deployment Option | Complexity | Cost | Scalability | Maintenance | Multi-User |
|-----------------|------------|------|-------------|------------|-----------|
| **Azure App Service** | ⭐⭐ | $0-$14/mo | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ |
| Cloud Run (GCP) | ⭐⭐⭐ | $0-$20/mo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ |
| Cloudflare Workers | ⭐⭐⭐⭐ | $0-$5/mo | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ |
| Docker + Kubernetes | ⭐⭐⭐⭐⭐ | $$$ | ⭐⭐⭐⭐⭐ | ⭐ | ✅ |
| Local Development | ⭐ | $0 | ⭐ | ⭐ | ❌ |

**Azure App Service is optimal for:**
- Teams already using Azure
- PoC and evaluation phases
- Simple deployment without DevOps expertise
- Cost-effective small-to-medium scale

### Implementation Checklist for HI MCP Server

To adapt the existing HI MCP server for Azure App Service:

1. **Extract User Identity**
   - [ ] Add header parsing for user email/session ID
   - [ ] Implement session store keyed by user identity
   - [ ] Add session timeout and cleanup

2. **Configuration**
   - [ ] Set `PORT` environment variable (Azure uses `process.env.PORT`)
   - [ ] Configure CORS for your domain
   - [ ] Set up authentication if needed

3. **Deployment**
   - [ ] Create App Service resource
   - [ ] Configure runtime stack (Node 20 LTS)
   - [ ] Deploy from VS Code or Azure CLI
   - [ ] Test endpoint connectivity

4. **Team Setup**
   - [ ] Share Azure URL with team members
   - [ ] Document connection instructions
   - [ ] Set up monitoring (optional)

### Code Example: Azure-Ready HI MCP Server

```javascript
// hi-mcp-server-azure.js
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from './minimal-hi-example/hi-mcp-server.js';

const PORT = process.env.PORT || 3100;

// Session store for multi-user support
const sessions = new Map();

// Extract user identity from Azure headers
function getUserId(request) {
  return request.headers['x-ms-client-principal-name'] ||
         request.headers['x-user-email'] ||
         'anonymous';
}

// Create or get user session
function getSession(request) {
  const userId = getUserId(request);
  if (!sessions.has(userId)) {
    sessions.set(userId, createNewSession());
  }
  return sessions.get(userId);
}

// Create HTTP server with user-specific sessions
const server = createServer((request, context) => {
  const session = getSession(request);
  // Process request with user-specific session
});

// Start server
server.listen(PORT, () => {
  console.log(`HI MCP Server listening on port ${PORT}`);
});
```

### Security Considerations

**Authentication Options:**

1. **Azure Easy Auth** (Recommended for teams)
   - Built-in authentication providers
   - Automatic user identity injection
   - Minimal code changes

2. **API Keys**
   - Simple but less secure
   - Shared key for all team members
   - Requires header configuration in client

3. **Custom Authentication**
   - Implement your own auth flow
   - Maximum flexibility
   - Higher development effort

**Recommended for PoC:**
- Start without authentication (public endpoint)
- Use Azure Easy Auth for team access
- Add custom auth for production

### Cost Optimization Tips

1. **Use F1 Free tier** for initial PoC
2. **Scale to B1 Basic** (~$14/mo) for team evaluation
3. **Enable Auto-heal** to recover from crashes
4. **Set up alerts** for cost thresholds
5. **Use Application Insights** for monitoring (free tier available)

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Server not starting | Check runtime stack matches your code |
| Dependencies not installed | Verify package.json is in root |
| Port conflicts | Azure sets PORT env var, don't hardcode |
| CORS errors | Configure CORS in server or Azure |
| Authentication failures | Check Easy Auth configuration |

**View Logs:**
1. Azure Portal → Your App Service → **Log Stream**
2. Or via Azure CLI: `az webapp log tail --name kitchen-ai-mcp --resource-group myResourceGroup`

---

## Appendix D Updated: Glossary

| Term (German) | Term (English) | Definition |
|--------------|----------------|------------|
| Raumerzeugung | Room Creation | Creating room geometry and layout |
| Raumdekoration | Room Decoration | Adding decorative elements to room |
| Bildgenerierung | Image Generation | Creating visual representations |
| Preisoptimierung | Price Optimization | Finding cost-effective solutions |
| Verkaufsempfehlungen | Sales Recommendations | Suggesting products for upselling |
| Apothekerschrank | Pharmacy Cabinet | Tall, narrow cabinet for pharmaceuticals or small items |
| Insel | Island | Free-standing kitchen cabinet structure |

---

*Analysis completed on 2026-09-25. Last updated: 2026-09-25*
