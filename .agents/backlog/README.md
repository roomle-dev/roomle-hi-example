# Backlog

Outstanding defects, performance optimizations, and refactoring follow-ups for roomle-hi-example.
One entry per item; link the analysis that holds the findings. An entry leaves this list when the
work is done and its analysis is closed out.

| Item | Problem | Findings | Added |
|---|---|---|---|
| Make group positioning easier for the agent | Positioning a group — `posGroup`, `posRotationY`, the anchor, the wall's start/end, the unit-local Left/Right of the docking vectors and the corner article's `rootRelPos` — is too complicated for the agents that use the MCP server; results are bad or worse depending on the model, and rule wording changes did not make them reliable. Prompts affected: "plan a kitchen with an oven, a sink and a fridge in the back right corner of the room", "plan a kitchen in the back right corner of the room". | [Agent placement in a room corner: findings](../bug-analysis/agent-placement-in-a-room-corner-findings.md); planned in [RML-18007](https://roomle.atlassian.net/browse/RML-18007): [Task 1](../feature-analysis/group-placement-computed-in-the-mcp-server.md), [Task 2](../feature-analysis/reintroduce-place-group-tool-in-the-server.md) | 2026-09-30 |
