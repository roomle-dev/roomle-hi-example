# Readable article and wall names in row-edit feedback

> **Status:** Fixed — verified locally; not yet landed
> **Date:** 2026-10-09
> **Ticket:** [RML-18103, comment 155978](https://roomle.atlassian.net/browse/RML-18103?focusedCommentId=155978), issue **62**

## Affected repositories

- **roomle-hi-example:** enrich the row-edit hints with article labels and the affected wall; add regression coverage and update the behaviour reference.
- **roomle-ui:** on `fix/hi-mcp-api-and-tools`, label the roots named by `removeArticleFromGroup` with their article data and update its tests.

## Symptom and evidence

The stored run `.temp/result/mcp-test-2026-10-09_00-59-22/gpt-6-astra/16-edit-remove-corner-unit/run.json` records a successful corner removal. The correction identified the rotated leg by UUID only, and the answer said “One leg and its upper units rotated 90°”, without identifying its original wall. The run saved snapshot `ps_rb7etm5pn8ocbm5a7guxt3k0bfht2su`.

This was a feedback defect. The recorded command succeeded; the missing wall name does not establish a geometry defect. The initial evidence was the saved run and a source trace; the local verification below replayed the command against the source plan.

## Root cause

1. `roomle-ui/packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:1832` built the corner-removal correction from `rootModuleId`, `turned.id` and `other.id`. It knew the corresponding roots but omitted their article labels. Other corrections in that operation also use IDs alone.
2. `roomle-ui/.../src/hi-plan-context.ts:1441` passed those corrections through the operation result. The MCP server preserved them; the missing description originated in the producer.
3. `roomle-hi-example/hi-mcp/hi-mcp-server/tool-executors.ts:869` detected the upper units that moved using before/after room positions, then reduced each to its ID at line 901. `withRowHints` (line 910) already had the catalog, room walls and calculated groups before and after the edit.
4. The exact-string expectations in `roomle-ui/.../__tests__/glue-logic-test.ts:10997` and `roomle-hi-example/hi-mcp/hi-mcp-server/tests/tool-executors.test.ts:7928` preserved that omission. The API made the model reconstruct the meaning of an ID instead of supplying it beside the event.

## Implemented change

The implementation kept the existing division of responsibility. The planner captured labels for the roots in its own correction as `'<root id>' (<article id>)`, falling back to article names when an article id was absent. The server supplied room wording from its named-wall geometry. The planner captured the removed root's label from the original group, before deleting it.

The implementation extended the existing row-edit hint calculation to identify a turned leg by its **pre-edit** wall and describe the resulting orientation/location separately. It used before/after roots in room coordinates, including group rotation, and the existing `rootVolumesInRoom` and `wallOfRoot` functions (`plan-space.ts:820,910`). Changed roots of the leg were grouped into one sentence. The upper-unit hint gained article labels from the same source data, preserving the machine IDs for subsequent calls. The server already used ID-plus-article labels in obstacle and library-change feedback (`tool-executors.ts:2348,2668`).

Unknown walls were omitted, preserving the article label and ID. The geometry matched the root's actual room. The comparison included room rotation as well as position, so a root rotating in place was included and a changed group frame alone produced no movement hint.

No ligna-store source change or new bridge method was needed: it receives these tool results from the same MCP server. No RoomleCore or library change was needed.

## Alternatives and scope

- A generic “translate IDs” instruction leaves the model without an explicit source-wall association; it is weaker than correcting the feedback where the event is known.
- Parsing the planner's English correction in the server would couple logic to prose. Derive wall wording from the existing snapshots instead.
- Do not add room queries or duplicate the server's named-wall geometry in the planner just to format this message. No new validation guard is required.

## Regression coverage

- Planner tests: corner, rotated neighbour and receiving neighbour carry the correct article labels; missing article metadata still produces a usable ID.
- MCP tests: source and destination wall labels are distinguished; moved upper units carry article labels; repeated articles retain distinct IDs; a group-origin shift produces no false movement; rotation in place, missing walls and a group in a second room are covered.
- Direct local tool replays covered `edit-remove-corner-unit` and `edit-insert-below-wall-units`. They assert the feedback the model receives; final model wording was not evaluated.
- Updated `docs/hi-mcp-behaviour.md` D42/D43/D52 and row-edit feedback, `docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`, and roomle-ui `.agents/homag-intelligence.md`.

Analysis baseline: roomle-hi-example `0be12cc`; roomle-ui `fda00538f`.

## Local verification — 2026-10-09

- The MCP executor regressions failed before implementation and passed afterward. All 573 HI MCP workspace tests passed; typecheck passed.
- All 281 planner glue-logic tests passed, including the corner-removal and upper-carrier label assertions. SDK typecheck and code lint passed (one existing unused-variable warning outside HI).
- The local planner ran with `npm run dev` at `http://localhost:5173/`, and the example loaded that URL through `server_url`. No shared planner release was used.
- Replayed the source plan `ps_r081k1nfl8nmtzget0sug199vhudbtd` through the local MCP server. Corner removal reported **the leg on the back wall turned by 90° and now runs along the right wall**, and preserved all root ids with article labels. Insertion between the hob and sink named the moved sink wall cabinet with its article id; the hood stayed above the unmoved hob.
- Local artifacts are in `.temp/result/rml-62-local-tools/`: before/after plan context, each tool result and screenshots. The verification script was temporary and is not committed.
- Automatic approval review rejected a model-driven replay because it would send plan context to an external GPT provider. Direct local tool calls verified the feedback instead; the model's final answer remains untested.

The fix changes feedback only. No library data, planner layout operation, guard, bridge method or ligna-store source changed. The record remains until the fixes land upstream.
