# Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

Triggered by **"analyse the feature"** / **"analyze the feature"** / **"feature analysis"** — see
**Analysis Triggers** in [`../../AGENTS.md`](../../AGENTS.md).

## What belongs here

Point-in-time, decision-driving write-ups. The document must cover:

- what was asked and why
- how the area works today, with code/file references
- the gap or question the analysis answers
- the proposed design or change
- the alternatives considered and why they were rejected
- the code and documents the work would touch

## What does not belong here

**A description of how a feature works today.** That is living reference and belongs in
domain-specific documentation. Everything in this folder is historical/point-in-time records.

For roomle-hi-example, living-reference feature descriptions should be in:
- The main [`../../minimal-hi-example/docs/hi-mcp-server.md`](../../minimal-hi-example/docs/hi-mcp-server.md) document
- Tool-specific documentation in the skill files under `.agents/`

## Close-out

When the feature is implemented, the description of how it works is promoted into the
appropriate living-reference document, and this document is set to `Implemented`.
When the approach is rejected, the reasoning is documented here and the document is set to `Rejected`.

Mechanics: Update the relevant documentation, then close out this analysis.
Never delete an analysis document.

## Current Documents

| Document | Status | Description |
|---|---|---|
| [planner-mcp-server-analysis.md](planner-mcp-server-analysis.md) | Implemented | Comprehensive analysis of Planner MCP server from roomle-model-exporter |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open | Feature analysis for Sales Configurator AI integration kickoff proposal |
| [hi-mcp-poc-json.md](hi-mcp-poc-json.md) | Open | Feature analysis for the hi-mcp TypeScript project and the hi-mcp-server MCP server with the INT-stage ligna-store as client |
| [mcp-azure-deployment-and-session-bootstrapping.md](mcp-azure-deployment-and-session-bootstrapping.md) | Open | The three PoC setups (local/deployed store, local/Azure MCP server): one bridge URL rule plus env-driven server config, all implemented; Azure App Service deployment mechanics and roadmap |
| [mcp-cloudflare-containers-deployment.md](mcp-cloudflare-containers-deployment.md) | Open | Hosting the hi-mcp server on Cloudflare Containers following the roomle-model-exporter cf/ pattern: unchanged server in a container, Worker front, per-session containers for company-wide try-out; WebSocket passthrough as the core unknown |
| [add-ai-chat-to-hi-example.md](add-ai-chat-to-hi-example.md) | Implemented | Built-in AI chat (Mistral, Vercel AI SDK) in the HI example, started with `npm start mistral <api-key>`; chat backend as MCP client of the hi-mcp server |
| [gpt-5-mini-chat-models.md](gpt-5-mini-chat-models.md) | Implemented | `npm start gpt-5-mini`/`gpt-5.4-mini <api-key>`: chat with the deployments on the HI Azure AI Foundry resource via its OpenAI v1 endpoint; `azure`/`openai` stay on `gpt-4o` |
| [ai-model-selection-for-kitchen-planning.md](ai-model-selection-for-kitchen-planning.md) | Open | Team evaluation recommending GPT-5 Mini with function calling, catalog search, and a validation loop for kitchen planning; mapped to the current chat and open questions |
| [group-placement-computed-in-the-mcp-server.md](group-placement-computed-in-the-mcp-server.md) | Open | RML-18007 Task 1: the agent sets `placement { posGroup, posRotationY, rootId? }` only; the server finds the anchor by following the docking, applies the corner article's corner point offset and builds `repositioningData` itself; no `repositioningData`/`cornerPoint` in the agent-facing text |
| [reintroduce-place-group-tool-in-the-server.md](reintroduce-place-group-tool-in-the-server.md) | Open | RML-18007 Task 2: `place-group { groupId, wall, alignment?, offsetMm?, roomIndex? }` returns, ported from the removed page-side tool into the server: it works on the calculated group from `getExternalObjectGroups` (exposed to the server and added to the page allow-lists by Task 1, together with `removeExternalObject`) with the recovered `plan-space.ts`; returns `placedIn`, the wall and the group; documentation recovered |
| [hi-mcp-command-api.md](hi-mcp-command-api.md) | Implemented | RML-18004: one planner API `externalObjectGroupOperation(command, payload)` in roomle-ui, the command vocabulary and dispatcher in `hi-plan-context.ts` over an operations interface the glue logic implements, one MCP tool per command (change module/group attribute, delete group/root module, merge article into group, exchange root module, merge groups); one allow-list entry for all commands |
| [hi-mcp-prompt-run-script.md](hi-mcp-prompt-run-script.md) | Implemented | First piece of the HI MCP testing skill: `.agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>"` starts the launcher, opens the example in headless Chromium (Playwright), sends the prompt to the chat backend, waits for the stream end and stores `getExternalObjectSnapshot()` in `.temp/result/<run>/`; no page change |
| [hi-mcp-test-the-mcp-skill.md](hi-mcp-test-the-mcp-skill.md) | Implemented | "test the mcp": the skill runs every prompt of `docs/test-prompts.md` without an image (group edits with their setup turns) through the script into `.temp/result/mcp-test-<date>/` and writes `report.md` with plan snapshot ids, images, evaluation and bug verdicts; the script gains several turns, `--out`, the plan snapshot id, `plan-context.json` and `planner-calls.json` |
| [article-size-and-trusted-descriptions.md](article-size-and-trusted-descriptions.md) | Implemented | Does the agent know an article's size? The data is there (`dimensions` in mm for 106 of 111 articles, the same ids on placed roots, group footprints), the instructions were not; the server texts now name the size attributes, resizing by attribute id, and make every `desc` authoritative over images. `DU`/`SM_TV` stay without a size |
| [chat-image-input.md](chat-image-input.md) | Implemented | Images in the example chat: the backend decides from the resolved model whether it reads images (`GET /capabilities`), the chat overlay catches drops, the agent gets the image as a JPEG with a long side of at most 1568 px, sent as `images` on the user message; an image without text becomes "Plan a kitchen like the one in the image."; the server's desc-over-image rule counts only for the master-data `imageUrl` |
| [hi-mcp-test-image-prompts.md](hi-mcp-test-image-prompts.md) | Implemented | RML-18027: "test the mcp" runs the image prompts — `run-hi-mcp-prompt.js --image <file>` sends the image with the last prompt, prepared as the chat window does (JPEG, long side ≤ 1568 px), stored as `prompt-image.jpg`; two new image prompts (one without text); `docs/testing-prompts.md` renamed to `docs/test-prompts.md` |
| [hi-mcp-test-suite-script.md](hi-mcp-test-suite-script.md) | Implemented | RML-18027: the test suite as a script — `docs/test-prompts.json` (models with key variables, plans, tests with a plan, a prompt and/or an image and operations run before it), the runner `run-hi-mcp-tests.js` over every model into `.temp/result/<session>/<model>/`, `--plan`/`--operations` for the run script (a saved plan snapshot loads with its HI groups; operations retry "not found" while the library recalculates them), the Three Tall Units plan, no `object.glb`/`snapshot.json`; the skill writes `$SESSION/tests.json` and runs the runner, default `gpt-5-mini` |
| [start-example-with-cloudflare-mcp.md](start-example-with-cloudflare-mcp.md) | Implemented | `npm run start:cf`: the example page and its chat use the deployed Cloudflare MCP server instead of a local one; the page gains the store's `mcp_server`/`mcp_session` parameters, the launcher uses the OS user name as session, skips the local server and refuses ports other than 3000 (the deployed origin allow-list) |
| [obstacle-map-in-the-plan-context.md](obstacle-map-in-the-plan-context.md) | Implemented (locally) | RML-18036: a new default section `obstacles` of `get-plan-context`, shaped by roomle-ui from the kernel's obstacle map (`getObstacleMap`): doors, windows and objects with their floor outline and vertical range in pos space, the HI groups set apart with their id, outline and the outlines of their root modules; walls left out; the server passes it through and points the placement rules to it; no page change |
| [obstacle-map-in-the-plan-context-implementation-plan.md](obstacle-map-in-the-plan-context-implementation-plan.md) | Implemented (locally) | RML-18036 plan: two roomle-ui commits (the obstacle map read by the planner, the `obstacles` section shaped in the glue logic with group outlines from the parts), three roomle-hi-example commits (this plan, the section with the wall of every door and window and the served rules, three MCP test prompts); no ligna-store change |
| [undo-and-redo-tools.md](undo-and-redo-tools.md) | Implemented | RML-18044: `undo` and `redo` tools that revert and restore the last tool call that changed the plan; buildable in roomle-hi-example alone — the planner's `undo`, `redo` and `onHistoryChange` reach the page through the embedding lib — with the history callback relayed over the bridge, the server counting the planner steps of its own calls (the probe undone, the follow-up reloads awaited, user edits reported, not undone); one step per tool call as a roomle-ui follow-up |
| [undo-and-redo-tools-implementation-plan.md](undo-and-redo-tools-implementation-plan.md) | Implemented | RML-18044 plan: four commits (bridge event and planner methods, the tools with the server's record and the probe undo, the undo rule, three MCP test prompts) plus the ligna-store copy; 20 unit tests named; rests on the live check of 2026-10-05 — one planner step per load, command and removal, the probe's two steps under the agent's (a ghost on today's undo button), the follow-up as the command's second history event |
| [insert-remove-replace-swap-units-in-a-row.md](insert-remove-replace-swap-units-in-a-row.md) | Implemented (locally) | RML-18045: insert a unit between two units, remove a unit with the gap closed, replace with another width, swap two units — as roomle-ui commands that rewrite the docking, arrange against the original group and keep the wall distance (the `swapRootModule` path); the walled side of the row stays, else the end at the group origin; remove and delete are two edits after the review: a new `remove-article-from-group` closes the gap, `delete-root-module` keeps the split; `insert-article-into-group` with `between`, `swap-root-modules`, `exchange-root-module` with `attributes`; the stale docking after a deletion confirmed live and traced to the kernel callback without `contextData`, fixed in the glue logic; close-out: units above follow by position, a row end is removed in one reload, the row loads with its group position |
| [insert-remove-replace-swap-units-implementation-plan.md](insert-remove-replace-swap-units-implementation-plan.md) | Implemented (locally) | RML-18045 plan: six roomle-ui commits (the stale-docking fix, the shared rearranged load, the insert, the remove, the swap, attributes and reported dockings for the exchange) and five roomle-hi-example commits (the insert and swap tools, the remove tool, exchange attributes, the rules and two hints, eight MCP tests with a new corner kitchen plan); no ligna-store code change, a verification on INT; the top side links dropped and restored by the kernel, the inserted root never the seed, a corner article no gap to close, a new load reason `rearrange`; close-out: 9 roomle-ui and 12 roomle-hi-example code and test commits, 516 and 436 unit tests, MCP test 15 of 17 then 4 of 4 after two clarified instructions, the local store needs no change |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
