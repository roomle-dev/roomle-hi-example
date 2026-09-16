# HI Orchestrator MCP — Innovations Day 2026-09-01

Migrated from the Confluence page
[2026-09-01 Innovations day](https://roomle.atlassian.net/wiki/spaces/DT/pages/3987406850/2026-09-01+Innovations+day#HI-orchestrator-MCP),
chapter *HI orchestrator MCP*. It presents the proof of concept that was shown
on the innovations day; the setup described there is the roomle-ui PoC this
repository's standalone variant is derived from. The examples below are current
results of that proof of concept, not the ones shown on the day.

This is a proof of concept for creating HI object groups in a scene using an
MCP server.

These results were generated using the Claude app and the Opus 5 model.

## Example 1

> **Use the current Hi-Orchestrator session to create a kitchen with an oven,
> hob, cooker hood, fridge, sink and cabinet with drawers, as well as wall
> cabinets in the back right corner of the room. Arrange the kitchen around the
> corner. The front of the kitchen should be made of walnut and the worktop
> should be made of dark marble.**

`ps_p804rz7o2flaq4kdlvs7ubgjrmmm7c6`

<https://rubens.alpha.roomle.com/examples/index.html?example=hi-presets-example&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&plan_id=ps_p804rz7o2flaq4kdlvs7ubgjrmmm7c6>

![L-shaped kitchen around the back right corner, walnut fronts and a dark stone worktop](./images/example-1-result.png)

## Example 2

> **Use the current Hi-Orchestrator session to create a kitchen like the one in
> the back right corner of the room, as shown in the image.**
>
> ![Reference kitchen image given to the agent](./images/example-2-reference-kitchen.jpg)

`ps_p90kkxti16e1z9mpxayzll76mogt62z`

<https://rubens.alpha.roomle.com/examples/index.html?example=hi-presets-example&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&plan_id=ps_p90kkxti16e1z9mpxayzll76mogt62z>

![L-shaped kitchen recreated from the reference image, white fronts and a wooden worktop](./images/example-2-result.png)

## Summary

The HI orchestrator MCP is a proof of concept that lets an AI agent plan with
HOMAG Intelligence object groups. The agent connects to a local MCP server
and drives a live planning session: it reads the plan context and creates,
changes and positions HI object groups. The whole setup runs locally and is
based on the existing hi-presets example of the embedding library; nothing of
it is deployed anywhere.

### How it is implemented

The MCP server is a small standalone Node process, and it is deliberately
thin: it contains no planning logic of its own. Since a browser page cannot
accept incoming connections, the demo page connects outward to the server
over a WebSocket. Every tool call from the agent is relayed through this
bridge into the open browser tab and executed there against the public
web-sdk API — the same API embedding customers use. All real work (article
calculation, docking arrangement, pricing) happens where it always happens:
in the web-sdk glue logic and the HI calculation.

AI agent → MCP server (localhost:3100) → WebSocket bridge → demo page
(localhost:3000) → web-sdk API

The agent gets a small set of tools:

- get-plan-context — one consistent snapshot: the rooms (including a prepared
  list of walls), the article catalog (with descriptions, dimensions, docking
  vector names and sub-modules per article), the groups currently in the
  plan, and on request the master data reduced to the root modules and the
  customer-facing attributes
- find-attributes — looks an attribute up by text in the full master data,
  e.g. the attribute behind "front colour" with its allowed values
- create-or-replace-groups — creates or replaces groups; a root module is
  just an article pick plus its docking relation to a neighbouring module
- place-group — stands a group against a wall ("right", "left", …) with
  alignment and offset
- update-attribute, get-price, get-order-data, get-plan-images — changing
  attributes, verifying prices/order data, and inspecting the result visually

The central design principle: the agent declares what, the system computes
where. The agent never calculates coordinates or root-module positions. It
picks articles, states how the units dock to each other (the same
PosDockedContextRoot structure the HI calculation already uses), and names
the target wall. The server completes each root module from the article
template, and the existing arrangement logic computes all positions — exactly
as it does for interactively planned groups. Inputs that would bypass this
(hand-written positions, undocked units) are rejected with error messages
that explain the correct way, so the agent can self-correct within the
session.

The server is agent-agnostic: any MCP client with Streamable HTTP support can
connect (Claude Code, VS Code Copilot agent mode, Cursor, custom clients).
Two small web-sdk extensions were added as productive code (a plan-context
snapshot API and a new layout type for loading pos groups); the MCP server
itself is demonstration code inside the embedding examples.
