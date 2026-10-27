# Kitchen AI Planner: Skill-Architektur und Context Loading

> Wie kann ich das GPT Astra Modell "trainieren" in Azure Foundry, damit ich z.B. meine Skills schon immer direkt im Model drin habe, ohne dass das LLM jedes Mal meine Skill wieder neu lesen muss und somit die Token dafür benötigt.

## Kurzfassung

**Kurz gesagt:** Ich würde deine „Skills“ nicht in GPT-6 Astra hineintrainieren. Für dein Ziel ist **Fine-Tuning wahrscheinlich die falsche Ebene**.

Microsoft führt GPT-6 Astra aktuell als GA-Modell in Microsoft Foundry mit bis zu 1,05 Mio. Context Tokens und starkem Fokus auf agentische Workflows und Tool-Nutzung. Microsoft dokumentiert Fine-Tuning zwar grundsätzlich in Foundry, aber nur für jeweils SFT-unterstützte Basismodelle. Die aktuelle Astra-Modellseite, die ich geprüft habe, weist Astra nicht als Fine-Tuning-Modell aus.

## Das eigentliche Problem

Momentan machst du vermutlich ungefähr:

```text
Request
  ↓
System Prompt
  ↓
SKILL.md / Instructions     ← z.B. 5k–30k Tokens
  ↓
User Prompt
  ↓
GPT-6 Astra
```

Bei jedem Request schickst du die Skill-Definition wieder mit.

Du möchtest stattdessen:

```text
            ┌─ Skill: Kitchen Planning
            ├─ Skill: Price Library
GPT-6 Astra ├─ Skill: Catalog
            └─ Skill: Construction
                   ↓
              User Prompt
```

Der Gedanke ist verständlich, aber ich würde das nicht als Training, sondern als **Agent-/Skill-Architektur mit selektivem Context Loading** lösen.

## Meine Empfehlung für euren Kitchen-AI-Fall

Da ihr ohnehin komplexe JSON-Strukturen, Artikel, Properties, Constraints usw. habt, würde ich Skill-Routing vor Astra setzen. Das passt auch zu eurer bisherigen Architektur. In eurem internen Teams-Austausch wurden bereits JSON Schema Adherence, viele Stammdatenobjekte und Structured Output als zentrale Anforderungen eures Kitchen AI Planner Use Cases genannt.

```text
User
 │
 ▼
┌──────────────────────────────┐
│ Agent / Orchestrator         │
│                              │
│ 1. Intent erkennen           │
│ 2. benötigte Skills wählen   │
│ 3. Skill ausführen/laden     │
└──────────────┬───────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
 Kitchen Skill      Catalog Skill
       │                │
       └───────┬────────┘
               ▼
          GPT-6 Astra
               │
               ▼
       Structured Output
  ```

  ### Der entscheidende Unterschied

  Ein Skill sollte möglichst **kein 20.000-Token-Dokument** sein, das immer mitgeschickt wird.

Ich würde einen Skill in drei Teile zerlegen:

  ```text
SKILL
│
├── 1. Metadata
│     name
│     description
│     whenToUse
│
├── 2. Instructions
│     → nur laden, wenn Skill aktiviert
│
└── 3. Resources
      → Tools
      → Search/RAG
      → Schemas
      → APIs
      → Documents
  ```

Astra sieht normalerweise zunächst nur etwas sehr Kleines:

  ```json
{
  "name": "kitchen-planning",
  "description": "Plan and modify kitchens",
  "whenToUse": [
    "create kitchen",
    "modify cabinets",
    "place appliances"
  ]
}
```

Vielleicht **100–300 Tokens statt 10.000+**.

Erst wenn Astra bzw. euer Router feststellt:

> Ich brauche `kitchen-planning`.

ladet ihr die eigentlichen Instructions.

## Noch besser: Skill als Tool statt Prompt

Für eure Architektur würde ich langfristig eher Folgendes machen:

**Tools für GPT-6 Astra:**

```text
get_skill("kitchen-planning")
get_skill("catalog")
search_articles(...)
get_article(...)
validate_kitchen(...)
calculate_price(...)
```

Dann könnte eine Anfrage wie:

> Replace the fridge with a 600mm Bosch appliance.

intern ungefähr zu folgendem Ablauf führen:

```text
Astra
 ↓
get_skill("kitchen-planning")
 ↓
search_articles(...)
 ↓
get_article(...)
 ↓
reason
 ↓
validate_kitchen(...)
 ↓
JSON
```

Das passt besonders gut zu Astra, weil Microsoft beim Modell ausdrücklich Tool Calling und agentische Workflows hervorhebt.

## Warum Fine-Tuning hier nicht das Richtige ist

Fine-Tuning würde ich eher einsetzen für:

> **Wie soll das Modell reagieren?**

und weniger für:

> Welche Regeln/Dokumentation soll das Modell kennen?

Microsoft beschreibt SFT als Training mit Beispielen aus **Prompt → gewünschte Assistant Response**, typischerweise als JSONL-Konversationen.

Beispielsweise (ein Datensatz, zur Lesbarkeit als JSON formatiert):

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Replace cabinet..."
    },
    {
      "role": "assistant",
      "content": "{ ...desired JSON... }"
    }
  ]
}
```

Das eignet sich gut, um dem Modell ein wiederkehrendes Verhalten bzw. Ausgabe-Verhalten beizubringen.

Aber wenn dein Skill enthält:

```text
Rule 4711:
TallCabinet darf nur neben WallPanel stehen wenn...

Rule 4712:
Bosch Oven Series X benötigt...

Rule 4713:
Wenn article.type == ...
```

würde ich diese Informationen nicht in die Model Weights einbacken.

Denn beim nächsten Update deiner Business Rules müsstest du sonst Training/Dataset/Validierung erneut betrachten.

## Architektur mit vier Ebenen

### 1. Sehr kleine permanente System Instructions

Nur wirklich universelle Regeln.

```text
You are the Kitchen Planning Agent.

Always produce schema compliant output.
Never invent catalog articles.
Use tools to retrieve product information.
Validate plans before returning them.
```

Vielleicht **500–1500 Tokens**.

### 2. Skill Registry

Extrem kompakt:

```json
[
  {
    "name": "catalog",
    "description": "Search and interpret product catalog data"
  },
  {
    "name": "construction",
    "description": "Apply construction and placement rules"
  },
  {
    "name": "pricing",
    "description": "Calculate and explain prices"
  },
  {
    "name": "kitchen-planner",
    "description": "Create and modify kitchen layouts"
  }
]
```

Das kann immer im Context sein.

### 3. Dynamic Skill Loading

Nur bei Bedarf:

```text
get_skill("pricing")
```

liefert dann beispielsweise:

```markdown
## Pricing Skill

1. Determine price hierarchy
2. Resolve customer price
3. Apply article options
4. ...
```

Damit bezahlst du diese Tokens **nur bei Pricing-Anfragen**.

### 4. Domain Knowledge über Tools/RAG

Noch wichtiger:

```text
SKILL.md
     ↓
Verhalten / Workflow

Catalog API / Search
     ↓
Produktwissen

Construction API
     ↓
technische Regeln

Price API
     ↓
Preise
```

Also:

- **Skill** beschreibt, **wie** Astra arbeiten soll.
- **Tools** liefern, **was** Astra wissen muss.

Das ist meines Erachtens für eure Sales-Configurator/Kitchen-AI-Architektur die entscheidende Trennung.

## Token sparen mit einem vorgeschalteten Router

Ich würde sogar einen **kleinen Router vor Astra** setzen.

Microsoft positioniert aktuell GPT-6 Luna für effiziente High-Volume-Aufgaben wie Extraction und Request Routing und Astra für die anspruchsvolleren Schritte.

Also beispielsweise:

```text
                   User Request
                        │
                        ▼
                  GPT-6 Luna
                 Skill Router
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       catalog        pricing      kitchen
          │             │             │
          └─────────────┴─────────────┘
                        │
                        ▼
                   GPT-6 Astra
                 + selected skill
                 + selected data
                        │
                        ▼
                  Kitchen JSON
```

Das fände ich für euren Anwendungsfall sogar deutlich besser als Fine-Tuning von Astra.

## Mein Zielbild

**Nicht:**

```text
Fine-tuned Astra
+ alles Wissen im Modell
```

**Sondern:**

```text
Luna
  → Intent / Skill Selection

Astra
  → komplexes Reasoning

Skills
  → Workflow Instructions

Tools / MCP / APIs
  → Catalog
  → Construction
  → Pricing
  → Materials

JSON Schema
  → garantiert/validiert Struktur
```

Damit reduziert ihr nicht nur Context-Tokens. Ihr bekommt vor allem versionierbare Skills, könnt Kitchen/Price/Catalog unabhängig deployen und eure Business-Regeln ändern, ohne Modelltraining anzufassen.

**Fazit:** Für eure aktuelle tecConfig/Sales-Configurator/Kitchen-AI-Architektur würde ich daher klar auf **„lazy-loaded Skills + Tools“ statt auf Fine-Tuning** setzen.
