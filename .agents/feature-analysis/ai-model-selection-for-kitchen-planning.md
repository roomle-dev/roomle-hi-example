# AI Model Selection for Kitchen Planning

> **Type**: Feature Analysis
> **Domain**: AI Integration, Model Selection, Sales Configurator
> **Trigger**: Model evaluation shared in the team: "Hier mal die Auswertung bzgl. welches AI model man verwenden soll" (here is the evaluation of which AI model to use)
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Open

---

## What was asked and why

The team needs a model for the Kitchen AI Planner in the Sales Configurator: a chat that turns natural
language into a kitchen plan. The evaluation below compares the GPT-5 family available on the HI Azure AI
Foundry resource. It is recorded here as received (reformatted; wording unchanged where possible), followed by
how it maps to this repository today and what it leaves open.

## The evaluation (as received)

### Selection criteria

For the Kitchen AI Planner use case, do not optimize for "raw intelligence", but for the combination of:

- JSON schema adherence
- Reasoning over many master data objects
- Large context windows
- Latency
- Cost
- Reliability of structured output

The generated output is not a simple text. It is a complex graph containing articles, modules, cabinets,
appliances, properties, constraints, connections/relations, technical metadata, positioning information, and
manufacturing attributes.

This is exactly the type of workload where **Structured Outputs** (JSON Schema-enforced responses) should be
used. Azure OpenAI / Foundry models support strict JSON Schema output.

### Option 1 (recommended): GPT-5 Mini

Use GPT-5 Mini as the production model.

- Very good reasoning
- Much faster than the largest models
- Excellent structured JSON generation
- Large context (400k tokens according to the internal Azure deployment documentation)
- Much cheaper than GPT-5.4
- Supports strict schema output

For a kitchen planning scenario, GPT-5 Mini is expected to be the best price/performance point.

```
User Prompt → GPT-5 Mini → JSON Schema → Kitchen JSON → Validation → Sales Configurator
```

### Option 2 (highest quality): GPT-5.4

Use when there are complex kitchen rules, many modules, lots of article alternatives, or difficult constraints.

- Advantages: best reasoning, best handling of large master datasets, highest probability of producing a valid
  kitchen configuration
- Disadvantages: slower, significantly more expensive

According to the internal Azure deployment documentation, GPT-5.4 is currently the largest available GPT model.

### Option 3 (very fast): GPT-5 Nano

Only if the schema is simple, the planner logic remains in the backend, and the AI mainly fills fields.

**Not recommended for kitchen planning** — too much semantic reasoning is required: "select a fitting sink",
"need a dishwasher", "corner situation", "water connection", "oven and fridge placement".

### What to actually build

Instead of expecting the model to generate the complete kitchen JSON in one shot:

1. **The AI generates a Kitchen Intent JSON:**

   ```json
   {
     "style": "modern",
     "shape": "L",
     "persons": 4,
     "needIsland": true,
     "appliances": ["oven", "dishwasher", "fridge"]
   }
   ```

2. **The AI calls search functions** — `SearchCatalogItems()`, `SearchModules()`, `SearchAppliances()`,
   `SearchWorktops()`. This matches the MCP concept from the AI planning meeting: article catalogs and
   contextual metadata are provided to the model rather than having it invent products.

3. **The AI generates the final JSON** from the user intent, article master data, module master data,
   constraints, and the JSON schema.

This dramatically increases reliability.

### Even better: function calling and a validation loop

```
User prompt → GPT-5 Mini → SearchArticles() → SearchModules() → ValidateKitchen() → RepairErrors() → Final JSON
```

The AI should **never invent article IDs**. It should only select from ids (`{ "articleId": "12345" }`)
returned by the catalog service.

### Final ranking

| Model | Quality | Speed | Cost | Recommendation |
|---|---|---|---|---|
| GPT-5.4 | 10/10 | 6/10 | 4/10 | Best quality |
| GPT-5 Mini | 9/10 | 9/10 | 9/10 | **Best overall choice** |
| GPT-5 | 9.5/10 | 8/10 | 7/10 | Also very good |
| GPT-5 Nano | 6/10 | 10/10 | 10/10 | Too weak for kitchen planning |

**Recommendation for the Sales Configurator AI initiative:** GPT-5 Mini + Structured Outputs + Function
Calling + Catalog Search + Validation Loop — the best balance of quality, speed, and operating cost for
generating complex kitchen JSON documents from natural language.

### Sources cited by the evaluation

- Internal Azure deployment / API key documentation (SharePoint) — context size, largest available model
- AI Status meeting — MCP concept for providing catalogs and metadata to the model
- Microsoft Learn: [How to use structured outputs with Azure OpenAI in Microsoft Foundry Models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs)

## How it maps to this repository today

Checked against the code on 2026-09-30:

- **Models wired into the chat.** `gpt-5-mini` and `gpt-5.4-mini` are the deployments the chat backend calls
  on the HI Azure AI Foundry resource (`FOUNDRY_DEPLOYMENTS` in
  [`hi-mcp/hi-mcp-chat/chat-config.ts:18`](../../hi-mcp/hi-mcp-chat/chat-config.ts#L18), added by
  [gpt-5-mini-chat-models.md](gpt-5-mini-chat-models.md)). GPT-5, GPT-5.4 (full), and GPT-5 Nano are not wired.
  The default chat provider is still Mistral (`resolveChatModel`,
  [`chat-config.ts:42`](../../hi-mcp/hi-mcp-chat/chat-config.ts#L42)).
- **Function calling instead of one-shot JSON.** The HI MCP chat does not have the model write a kitchen
  document; it edits the live planner scene through MCP tool calls (see the purpose in
  [`../README.md`](../README.md)). The recommended function-calling loop is the shape the chat already has:
  - *Catalog search:* `get-plan-context` returns the article catalog the model picks from.
  - *Never invent article IDs:* `create-or-replace-groups` rejects an `articleId` that is not in the catalog
    and answers with the valid ids
    ([`hi-mcp/hi-mcp-poc-json/tool-executors.ts:84-99`](../../hi-mcp/hi-mcp-poc-json/tool-executors.ts#L84-L99)).
  - *Validate and repair:* the tool returns errors and hints, and `streamText` feeds them back to the model for
    up to 8 steps (`stopWhen: stepCountIs(8)`,
    [`hi-mcp/hi-mcp-chat/chat-server.ts:109`](../../hi-mcp/hi-mcp-chat/chat-server.ts#L109)).
  - There is no separate Kitchen Intent step: the model goes from the prompt straight to tool calls.
- **Structured outputs.** The tool parameters are zod schemas, but the chat backend does not request strict
  schema mode (no `strict` setting in `hi-mcp/hi-mcp-chat`). According to the Microsoft Learn page, strict mode
  on Azure requires every field to be listed as required, `additionalProperties: false` on every object, at most
  five nesting levels and 100 object properties, and no parallel tool calls. The page's supported-model list
  (updated 2026-08-24) names `gpt-5`, `gpt-5-mini`, and `gpt-5-nano`, but no `gpt-5.4` variant.

## Open questions

1. **Measure, don't assume.** The ratings are the evaluator's estimates, not measurements. Run the same prompts
   against `gpt-5-mini` and `gpt-5.4-mini` (for example, an L-shaped kitchen in a room corner, see
   [agent-placement-in-a-room-corner-findings.md](../bug-analysis/agent-placement-in-a-room-corner-findings.md))
   and compare tool-call errors, steps used, latency, and cost.
2. **Is GPT-5.4 (full) deployed** on `dfhifoundrysweden`? Option 2 names GPT-5.4; this repository only calls
   `gpt-5.4-mini`.
3. **Context window.** The 400k-token figure comes from internal documentation and is not verified here.
4. **Default model.** Should the chat default change from Mistral to `gpt-5-mini`?
5. **Strict tool schemas.** Would the current zod tool schemas (with optional fields) fit the Azure strict
   subset, and would strict mode measurably reduce invalid tool calls?

## Alternatives considered

The evaluation weighed GPT-5.4, GPT-5, and GPT-5 Nano against GPT-5 Mini (see the ranking above). Nano is
rejected for kitchen planning; GPT-5.4 is kept as the quality fallback for complex plans. An earlier,
broader model comparison (GPT-4.1, GPT-4o, Claude 3.5, Llama 3.1) is in
[sales-configurator-ai-integration.md §10.1](sales-configurator-ai-integration.md#101-ai-model-evaluation).

## Code and documents a follow-up would touch

- [`hi-mcp/hi-mcp-chat/chat-config.ts`](../../hi-mcp/hi-mcp-chat/chat-config.ts) — `FOUNDRY_DEPLOYMENTS`, the
  default provider
- [`minimal-hi-example/start.mjs`](../../minimal-hi-example/start.mjs) — `CHAT_PROVIDERS`
- [`hi-mcp/hi-mcp-chat/chat-server.ts`](../../hi-mcp/hi-mcp-chat/chat-server.ts) — strict tool schemas, if adopted
- [`minimal-hi-example/docs/ai-chat.md`](../../minimal-hi-example/docs/ai-chat.md) and the root
  [`README.md`](../../README.md) — provider tables
