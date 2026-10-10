# Explain the door or window a placement keeps clear

> **Status:** Implemented — verified locally; not yet landed
> **Date:** 2026-10-09
> **Ticket:** [RML-18103, analysis comment 155982](https://roomle.atlassian.net/browse/RML-18103?focusedCommentId=155982), issue **63**

## Affected repositories

- **roomle-hi-example:** one shared MCP tool-description sentence, a served-text assertion, and documentation of the accepted answer behaviour.

## Request and evidence

The analysis asked whether an answer should identify a door or window that influenced the placement. The user accepted the proposed behaviour on 2026-10-09: explain the relevant opening when the final result supports the statement.

The stored `mcp-test-2026-10-09_00-59-22/gpt-6-astra/27-obstacle-window-back-wall/run.json` contains a successful creation at the back wall (`alignment: end`, `offsetMm: 2700`). Its final answer listed the cabinets but never mentioned the window. `docs/test-prompts.json`, test `obstacle-window-back-wall`, explicitly expects that mention.

The saved `plan-context.json` independently supports the geometric result: the window spans x -450 to 1650, at height 950–2170 mm; all eight non-generated cabinet roots occupy x 2025 to 4425. The row therefore clears the window horizontally. Snapshot: `ps_rb812w7saujvu41jhe537pj4sit8fqg5`. The initial investigation used stored evidence. The implementation verification below used new local-planner runs.

## Why the answer omitted it

- `hi-mcp/hi-mcp-server/hi-mcp-server.ts:25` explained how to avoid obstacles, but did not ask the model to describe a successfully avoided opening. The descriptions of `get-plan-context` (line 156), `create-or-replace-groups` (line 248) and `place-group` (line 294) also omitted that request.
- `tool-executors.ts:2495` reported detected overlaps; line 2517 returned no obstacle hint when there are none. Absence of a warning is not a positive clearance report.
- The example chat's `CHAT_SYSTEM_PROMPT` (`hi-mcp-chat/chat-config.ts:12`) asked for a short summary from the final tool results. Successful clearance was not one of its named summary topics.
- Both `hi-mcp-chat/chat-server.ts:78,119` and ligna-store `hi-mcp/chat.ts:126` provided their own system prompt and the MCP tool list. Neither forwarded the MCP initialization instructions. The saved run did call `get-authoring-rules`, but other runs may not.

## Implemented change

Added one library-neutral sentence to the shared `get-plan-context` description, next to its obstacle explanation:

> “When a door or window determines a placement, briefly name it and explain whether the final placement keeps it clear, using the returned obstacle dimensions and final tool results.”

This placed the request in the tool list received by both chats and external MCP clients, including when the model skips `get-authoring-rules`. The sentence uses **whether** rather than **how**, so a deliberate overlap can be acknowledged without implying clearance. It is a description change, not a new obstacle algorithm or a positive-clearance guarantee. The existing instruction to base the answer on final results still applies: an intended placement is not evidence of the final placement, and an overlap hint must not be described as clearance.

Do not list every opening in the room. For base units under a window, describe that relation only when their measured top is below its sill. For a row beside the window, describe the horizontal clearance. Identify the wall where that disambiguates multiple openings. Missing obstacle data must not become an unsupported assurance.

## Alternatives and verification

- **Leave answers unchanged:** defensible if the product needs only correct geometry; then remove the answer requirement from the prompt test. This is the alternative decision, not a geometry fix.
- **Initialization instructions only:** insufficient for both chat clients. Separate chat-prompt changes would duplicate a server-owned rule.
- **Positive clearance fields in every result:** larger API and geometry work than the observed omission warrants. Consider only if the sentence proves insufficient in evaluated runs.

The served-text regression used the MCP client tool list without calling `get-authoring-rules`; it failed before the change and passed afterward. Four temporary prompt cases covered the stored window prompt, a door, cabinets below a sill, and a deliberate overlap. Model answers were evaluated against the final plan context and measured root geometry.

Updated `docs/hi-mcp-behaviour.md` (instructions and obstacle information), `docs/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`. No ligna-store, roomle-ui, RoomleCore or bridge source change was needed.

Analysis baselines: roomle-hi-example `0be12cc`, ligna-store `66979ca`. The implementation changed one shared description and added one regression assertion.

## Local verification — 2026-10-09

- The new MCP tool-list assertion failed before implementation and passed afterward. All 574 HI MCP workspace tests passed; typecheck, lint, formatting and documentation links passed.
- The user explicitly approved four Azure GPT model tests. They ran with `gpt-5-mini` (high reasoning) against the local roomle-ui dev server at `http://localhost:5173/`. The same source room plan was used for every case.
- **Window clearance:** the answer named the window and said the installation did not overlap it. All eight roots occupied x 2405–4805 mm, clear of the window ending at x 1650 mm.
- **Door clearance:** the answer named the doorway and said it remained clear. Three roots ended at z 270 mm; the door began at z 280 mm.
- **Below the sill:** the answer named the window and explained the cabinets stood beneath it. Their measured tops were at 820 mm, below the 950 mm sill; the answer quoted the 720 mm carcase height.
- **Deliberate overlap:** the answer named the window and correctly acknowledged partial blockage. The final tall-unit range x -1200–0 mm overlapped the window x -450–1650 mm at height 950–2170 mm. This passed the #63 feedback check, but the row center x -600 mm differed from the window center x 600 mm: a separate model placement finding.

All four opening explanations passed. Three complete planning scenarios passed; the deliberate-overlap scenario was evaluated as **partial** because of its off-centre placement, not reported as a full pass. No production geometry code changed. Backlog #63 was removed after the original omission and its scoped feedback checks were verified.

The evaluated report and PDF are in `.temp/result/rml-63-opening-feedback/report.md` and `report.pdf`, with a saved plan snapshot, plan context, planner calls and images for every case. These local artifacts and temporary test definitions are not committed. The normal MCP server on port 3100 was restarted and its `tools/list` response checked for the instruction.
