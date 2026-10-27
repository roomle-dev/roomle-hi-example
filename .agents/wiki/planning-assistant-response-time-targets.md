# Planning Assistant: response time targets

How fast the Planning Assistant has to plan a kitchen. These are the targets the performance work
is measured against; the targets are reached step by step. The current baselines, on the Azure
deployment, are [baseline-fkwm-az-2026-10-27.md](../benchmarks/baseline-fkwm-az-2026-10-27.md), the
kitchen from a text prompt, and [baseline-iklw-az-2026-10-27.md](../benchmarks/baseline-iklw-az-2026-10-27.md),
the kitchen from an image; all measurements are in [the benchmarks](../benchmarks/README.md).

## The targets

All times run from the moment the user sends the prompt.

**A kitchen from a text prompt**

| Milestone | Target |
|---|---|
| First kitchen in the plan | 10 s |
| Final result | 20–40 s, depending on how complex the kitchen is |

**A kitchen from an image**

| Milestone | Target |
|---|---|
| Image interpreted | 5–10 s, depending on the image; a crowded image takes longer |
| First kitchen in the plan | 15–20 s |
| Final result | 25–50 s, depending on how complex the kitchen is |

The first kitchen from an image is the first kitchen from a text prompt plus the time the agent
needs to interpret the image.

## What the milestones mean

- **First kitchen in the plan** — the planner shows the first kitchen of the turn: the first
  successful `create-or-replace-groups` has completed. The benchmarks report it as "First
  successful kitchen create completed (turn start)"; the reports of "test the mcp" as the
  **First result**, the time until the plan first changes in the planner
  ([test-prompts.md](../../docs/test-prompts.md)).
- **Final result** — the agent's last answer is complete. The benchmarks report it as "Assistant
  turn start → answer complete"; the reports of "test the mcp" as the **Planning time**.
- **Image interpreted** — the agent knows what the image shows and starts to plan the kitchen. No
  marker measures it today: the agent reads the image inside the model calls before the create.
