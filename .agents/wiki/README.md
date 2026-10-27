# Wiki

Living-reference pages that answer a recurring question once: an API map, a data-flow summary, a contract between repositories, a decision record that is not an ADR.

A wiki page is **not** an analysis — it has no lifecycle. It says what holds today and is updated when the behaviour it describes changes. Present tense. No ticket numbers.

## Current Pages

| Page | Covers |
|---|---|
| [Planning Assistant: response time targets](planning-assistant-response-time-targets.md) | How fast the assistant has to plan a kitchen from a text prompt and from an image: the first kitchen, the image interpreted and the final result, and how each milestone is measured; where the time of a kitchen goes, and the levers that do not shorten it |
| [Group splitting in the UI and agent tools](group-splitting-in-the-ui-and-agent-tools.md) | Intentional splits when dragging out or deleting a middle module; UI behavior and agent tool contracts |
| [An MCP endpoint for the HI tools at `…/hi-mcp`](hi-mcp-endpoint-for-external-clients.md) | Why the planner cannot serve an MCP endpoint itself; the relay and the page bridge in the planner, what needs to be done and the concerns: access to the plan, one agent per planner, the open tab, long calls, discovery, operations |
| [Why the agent cannot plan what the library cannot build](why-the-agent-cannot-plan-what-the-library-cannot-build.md) | The agent only picks articles, values, relations and a place; the library calculates the rest. What happens to wrong input, and where the guarantee ends: failed calculations kept, values not checked before an edit, the create path, library bugs, room fit |

## Adding a Wiki Page

1. Write the page in this folder with a descriptive kebab-case name.
2. Include current `file:line` references, checked against the code.
3. Add a row to the table above.
4. Add a row to the Wiki table in `.agents/README.md`.
