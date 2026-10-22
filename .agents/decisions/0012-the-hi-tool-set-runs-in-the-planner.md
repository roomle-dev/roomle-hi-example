# ADR 0012 — The HI tool set runs in the planner, the embedding-lib forwards to it

> **Status**: Accepted
> **Date**: 2026-10-21
> **Supersedes**: the clause of [ADR 0011](0011-the-hi-tools-live-in-the-embedding-lib.md) that puts the HI tools into the roomle-ui embedding-lib

## Context

The HI tools had two halves in two bundles of roomle-ui. The tool logic of the plan-changing tools
runs in the planner ([ADR 0007](0007-hi-mcp-tool-logic-in-the-planner.md)). The tool set — the
names, descriptions and input schemas, the served text, the planning skills, the agent-facing
shaping of the results and the undo bookkeeping — ran in the host page, in the embedding-lib
(ADR 0011). It reached the planner through six planner methods, each a postMessage round trip into
the planner's iframe.

A change of the tool set reached a host only with a new embedding-lib build that every host pinned
again; a change of the tool logic reached it with the planner deployment. The undo bookkeeping took
over the host's `onHistoryChange` callback.

## Decision

- The tool set lives in the planner: roomle-ui
  `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/`, a lazy chunk of the planner.
- The planner serves it with two methods: `getExternalObjectAgentTools()` lists the tools as an MCP
  server lists them in `tools/list` — name, description, the JSON Schema of the input — and
  `callExternalObjectAgentTool(name, input)` answers as `tools/call` does. An invalid input, an
  unknown tool and a failed call are results with `isError`.
- `createHiMcpTools` of the embedding-lib keeps its signature: it builds the AI SDK tools from the
  planner's definitions and forwards every call. A planner without the two methods makes it reject
  with a message that the planner needs an update; the planning assistant then reports itself
  unavailable with that message.
- In the planner, the tools call the planner methods directly, each with its timeout as before, and
  chain the planner's own `onHistoryChange`; the host's callback is left alone.
- The example page records the tool calls the planner runs for the test scripts
  (`window.hiPlannerCalls`, `planner-calls.json`), with the result of `get-plan-images`.

The agent loop, the model and the key stay in the host
([ADR 0009](0009-the-chat-window-is-a-panel-of-the-planner.md)), and the plan-changing tool logic
stays `externalObjectGroupOperation` (ADR 0007). The planner serves a tool set, not the MCP
protocol (D94 of [hi-mcp-behaviour.md](../context/hi-mcp-behaviour.md#3-decisions)).

## Consequences

- A tool change ships with the planner deployment. The embedding-lib changes only when the
  forwarding changes, and a page pinned to an embedding-lib version gets the tools of the planner
  at its server URL.
- The forwarding needs a planner with the two methods: until the planner at the example's default
  server URL has them, the example runs only against a planner that has them (`EXAMPLE_SERVER_URL`).
  An older embedding-lib keeps working with a newer planner: the six planner methods stay public.
- A tool call is one round trip into the iframe. The tools log their `[hi-mcp]` lines in the console
  of the planner's frame, which the page console of Playwright carries.
- The runs of the prompt runner record tool calls, not planner method calls: the benchmark's
  per-method planner times come only from runs of the former chat backend.
- The tools are tested in roomle-ui `packages/web-sdk/packages/homag-intelligence/__tests__/hi-mcp/`,
  the planner methods in `planner-core/__tests__/roomle-planner.ts`, the forwarding in
  `tests/unit/embedding-lib/homag-intelligence/hi-mcp/`.

## Rejected

- **Keep the tool set in the embedding-lib**: the two halves of one tool ship apart, and a tool call
  takes several round trips.
- **A timeout per forwarded tool call in the embedding-lib**: a new timer beside the planner's
  timeouts per planner call; a planner that stops answering leaves the turn open, as every other
  planner call of the host does.
- **A history listener of its own in the planner** for the undo bookkeeping: a second notification
  path beside the planner's callbacks; chaining the planner's `onHistoryChange` keeps the behaviour
  the tools had in the host.
- **An MCP endpoint served by the planner itself**: the planner is static files and a browser tab
  accepts no request; what an endpoint at `…/hi-mcp` would take is in
  [the wiki](../wiki/hi-mcp-endpoint-for-external-clients.md).
