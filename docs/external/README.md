# External documents

Documents received from outside the development of this repository, kept as they were received: in
their language, with their wording and their claims, which this repository does not verify. They
are records, not living reference — nothing here changes when the code changes. What the
development makes of a document is in `.agents/`: an analysis while the work is open, the living
reference and the decisions once it has landed.

| Document | Language | What it says | Where it is evaluated |
|---|---|---|---|
| [planning-improvements.md](planning-improvements.md) — Kitchen AI Planner: Skill-Architektur und Context Loading | German | Whether the planning skills can be trained into the gpt-6-astra model on Azure Foundry, so that the model stops reading them on every request. It advises against fine-tuning and for lazy-loaded skills and tools: small permanent system instructions, a skill registry of names and descriptions, the instructions of a skill loaded only when it is activated, domain knowledge through tools and retrieval, a small router model in front of the planning model, and JSON schema for the output | [Response time: where the time goes and the levers that do not shorten it](../../.agents/wiki/planning-assistant-response-time-targets.md#where-the-time-of-a-kitchen-goes); the router: [the skill selector](../../.agents/backlog/planning-assistant-skill-selector.md) |
