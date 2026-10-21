# Planning skills

The two PDFs document the planning skills HOMAG delivered: the kitchen skill, the kitchen skill for
France and the living-room skill.

The skills themselves live in roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/skills/`,
in the Agent Skills format. The MCP server serves them to every client with the tool `get-skill`,
and to a host that loads skills itself with the Skills extension of MCP — see
[hi-mcp-behaviour.md §5.6](../hi-mcp-behaviour.md#56-planning-skills-get-skill).
