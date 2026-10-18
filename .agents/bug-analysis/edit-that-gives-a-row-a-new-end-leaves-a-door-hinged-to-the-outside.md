# Bug analysis — an edit that gives a row a new end leaves a door hinged to the outside

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-17
> **Base**: roomle-hi-example `analysis/mcp-72-wall-units-two-heights-plinth` (`38a4d50`);
> roomle-ui `fix/room-corners-at-openings` (`a008be42d`) — the branch every roomle-ui change for
> this bug must be based on
> **Backlog**: item 77 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-hi-example** — the proposed fix: one library-neutral sentence in the descriptions of
  the five tools that can give a row a new end — `swap-root-modules`, `delete-article-in-place`,
  `delete-article-and-compact`, `exchange-root-module`, `merge-article-into-group`
  (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:587, 603, 631, 717, 742`); the test that pins it
  (`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, beside the D84 guard test at line 902); the
  living reference that quotes the served text — D84 and the command-tools table of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), the tool table of
  [`docs/hi-mcp-server.md`](../../docs/hi-mcp-server.md) (lines 614-619), the five rows of
  [`.agents/skills/hi-mcp-tools.md`](../skills/hi-mcp-tools.md) (lines 34-39); and the `expect` of
  the tests `edit-swap-units` and `undo-a-wrong-command` of `docs/test-prompts.json`. No change of
  the server's logic: the payload the agent sends is legitimate.
- **roomle-ui** — no change. The tool commands keep every root module's attributes through an edit
  (D42) and contain no door logic — a search for `DoorDirection` over
  `packages/web-sdk/packages/homag-intelligence/src/` finds nothing — and D84 rejected the server or
  the planner setting or correcting the side of the ends: it needs the library's door direction
  attribute and its values, library information in the logic (§2.4 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)). Any roomle-ui change for this bug
  would be based on `fix/room-corners-at-openings`.
- **RoomleCore (the planner kernel)** — no change: the kernel applies the docking and the
  attributes it is given; the door side is the library's calculation from the attribute on the root
  module.
- **The library (HOMAG Furniture_Smith, server-side calculation)** — no change proposed:
  `Automatic` is the library's intended default and the attribute's own desc already teaches the
  right-end rule; a library that passed the door direction on between neighbours (D56;
  Furniture_Smith does not) or resolved `Automatic` by the unit's place in the row would change
  every plan and every client and depends on HOMAG.
- **ligna-store** — no change: the store runs the same MCP server and holds no copy of the served
  text.

## Symptom

In a conversation of edits the agent swaps the end units of a row or deletes the end unit, and the
new end keeps the door side the library chose: at the right end of the row the door is hinged on the
left, its handle on the outside of the row. Reproduce: `mcp-test-2026-10-17_13-28-41`, gpt-6-astra 32
(`edit-swap-units`; the run directory
`.temp/result/mcp-test-2026-10-17_13-28-41/gpt-6-astra/32-edit-swap-units/`). Turn 2 calls
`swap-root-modules` on the first and the last unit of the row of three tall units (plan
`three-tall-units`); `run.json` lists the conversation's tools — `get-plan-context`,
`change-module-attribute`, `get-plan-context`, `swap-root-modules` — no `get-authoring-rules`. The
outcome (`order-data.json`): the row stands at x 0, 900 and 1500 — `8774cac2` (the 900 mm unit of
turn 1, now the left end), `a7271f1b`, `0010443c` (the former left end, now the right end) — and
every root module carries `mod_DoorDirectionSelection` `Automatic`. The library hinges a single door
on the left for `Automatic` (the desc of the attribute in the stored master data,
`docs/library-information/master-data.json`; the probe table of library issue 76 of
[`../backlog/library-issues.md`](../backlog/library-issues.md)), so the new right end's handle is on
the outside of the row (`perspective-object-image.png`); the swap's feedback was empty (`console.log`
of the run: `tool swap-root-modules feedback {}`).

The second path of the batch: gpt-6-astra 36 (`undo-a-wrong-command`, the same plan, no
`get-authoring-rules`): undo, then `delete-article-in-place` on the last unit — the new right end
`a7271f1b` keeps `Automatic` (`order-data.json`), the same handle on the outside.

The stored plan itself carries `Automatic` on all three units (run 16 of the same batch,
`edit-change-one-unit`, no edit at an end, ends the same), so in these two runs the right end was
hinged to the outside before the edit as well. What the edit conversation lacks is any instruction
that a door at an end of a row belongs to the outer side — the edit tools are the only place an agent
editing an existing plan could learn it, and they say nothing about doors.

The contrast that names the cause: the same model in the conversations that read the rules sets the
ends. gpt-6-astra 12 (`wardrobe-door-hinges`, `get-authoring-rules` in the conversation): the left
end carries `Left`, the right end `Right`, the middles `Automatic`. gpt-6-astra 33
(`wardrobe-extend-door-hinge`, `get-authoring-rules`, a merge at the end): the new right end carries
`Right`, the former end keeps `Right`. The library default and the edit mechanics are the same in all
four runs; only the rule's presence differs.

## Investigation trace

1. **The edit keeps every root module's door side.** The description of `swap-root-modules` says
   "Each keeps its attributes" (`hi-mcp-server.ts:742-745`), and the library passes no door
   direction on between neighbours (D56; Furniture_Smith does not — the probe table of library issue
   76). The moved root `0010443c` carries `Automatic` from the stored plan into the right end
   (`order-data.json` of run 32). The library resolves `Automatic` to a fixed side per article — left
   for a single door (the attribute's desc in `docs/library-information/master-data.json`; issue 76's
   table) — so the new end is hinged left, the handle right: on the outside of the row.
2. **The rule that covers exactly this exists — D84.**
   [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), line 335: "The doors at the two
   ends of a row are hinged at its outer sides … and again on the root module at an end after an edit
   that gives the row a new end: an article added, deleted, exchanged or swapped at an end, because
   a library need not pass the door direction on between neighbours (D56; Furniture_Smith does
   not)." The rule names no attribute and no value; the library data says which (§2.4).
3. **The rule reaches the model only through `get-authoring-rules`.** It is the "Doors:" sentence of
   `AUTHORING_RULES` (`hi-mcp-server.ts:20`), which `INSTRUCTIONS` appends (`hi-mcp-server.ts:84`,
   `${AUTHORING_RULES}`) and the server sends as `instructions` at initialize
   (`hi-mcp-server.ts:150`), and which `get-authoring-rules` returns (`hi-mcp-server.ts:274-286`).
   The chats pass the planner's system prompt as the model's instructions and not the server's —
   `chat-stream.ts:128` (`instructions: systemPrompt`); nothing in `hi-mcp-chat` forwards the MCP
   initialize instructions — so §4 of the behaviour doc records: "the model learns the rules only
   when it calls `get-authoring-rules`". A conversation of edits fetches no rules (`run.json` of runs
   32 and 36).
4. **The five descriptions that can give a row a new end do not name the rule.**
   `delete-article-in-place` (`hi-mcp-server.ts:587`), `delete-article-and-compact` (`:603`),
   `merge-article-into-group` (`:631`), `exchange-root-module` (`:717`), `swap-root-modules` (`:742`)
   describe the geometry of the edit — the gap, the docking, the place — and never the door at the new
   end. These are exactly the five tools that can give a row a new end: an article added at a free
   end, deleted at an end, exchanged at an end or swapped with an end. `insert-article-into-group`
   inserts between two root modules and never creates an end; the other command tools
   (`change-module-attribute`, `change-group-attribute`, `place-group`, `delete-group`,
   `merge-groups`) do not change the ends. The tool list with the descriptions is sent with every chat
   request, so a sentence there reaches the agent in the very conversation that edits.
5. **The vocabulary already carries everything the agent needs to act.** `mod_DoorDirectionSelection`
   is `isMain` true and `userRight` "Simple" (`docs/library-information/master-data.json`) — served
   in the attributes section of `get-plan-context` (D76) and searchable by `find-attributes` — with
   value descs that name the hinge side ("Hinged on the left, as seen from the front: the handle on
   the right, the door opens to the left." / "Hinged on the right, as seen from the front: …"), and
   the attribute's own desc says: "Automatic hinges a single door on the left wherever the cabinet
   stands: in a row, set the door at the right end to Right, so no handle is on the outside of the
   row." The gap is the trigger — the agent is never told that an edit at an end needs the door set
   — not the data.
6. **The result does not fill the gap.** The swap's feedback was empty (`console.log` of run 32); the
   result returns the changed groups (the command-tools table of
   [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)), and the next `get-plan-context`
   shows `Automatic` on the new end — the agent can see the value but is told nowhere that it must
   change it at a new end.

## Root cause

The rule of D84 — after an edit that gives a row a new end, the door at that end is hinged at the
outer side of the row — lives only in `AUTHORING_RULES` and the server's initialize instructions,
and the chats forward neither to the model: they pass the planner's system prompt
(`chat-stream.ts:128`), so the rule reaches the model only through `get-authoring-rules`, which a
conversation of edits never calls. The descriptions of the five tools that can give a row a new end
do not name it. The library's default is intended — `Automatic` hinges a single door on the left
wherever the cabinet stands — and the edit tools keep every root module's attributes, so the new end
keeps the library's choice: at the right end of a row, the handle lands on the outside.

## Why the current code produces this

The served text teaches the door rule on demand (`get-authoring-rules`) and in the initialize
instructions the chats drop; the tool descriptions — the text the agent reads in the very
conversation that edits — describe the geometry of the edit and never the door at the new end; the
result names nothing about the new end's door. The vocabulary carries the attribute and its value
descs, so once the agent is told the rule it can act without a second source. The wrong door is not
a planner defect and not a library error: it is the library's default applied to a position the edit
made an end, in a conversation that was never told the ends' rule.

## Proposed fix

One library-neutral sentence in the descriptions of the five tools, at the end of each, before
"Returns …":

> After an edit that gives a row a new end, hinge the door at that end at the outer side of the row
> - set it with the attribute whose values say on which side a door is hinged, the value for single
> doors or for a pair of doors, as the article has.

The sentence is a rule statement, not a mechanism claim: a delete names the new end (the former
second-to-last root keeps its own door side), a swap moves a root with its attributes, an exchange
and a merge give the new root the library's default — in every case the door at the new end is not
hinged for its new place, and the sentence says to hinge it at the outer side. It names no attribute
and no value (the D84 neutrality assertions extend to the five descriptions), and the agent finds
the attribute and its value descs in the attributes section of the plan context it already fetches
(trace 5). The rule in `AUTHORING_RULES` stays as it is; the unit test pins the sentence in the five
descriptions, and the tests `edit-swap-units` and `undo-a-wrong-command` hold the outcome: the new
ends hinged at the outer sides.

## What the fix does not do

- It does not change `AUTHORING_RULES` or `INSTRUCTIONS`: the rule stays as it is (D84), and the
  guard test `it('tells the agent to hinge the doors at the two ends of a row at its outer sides')`
  (`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts:902`) keeps passing unchanged.
- It does not name the library's attribute or any value in the served text: the sentence speaks of
  "the attribute whose values say on which side a door is hinged" — the D84 neutrality assertions
  (`not.toContain('mod_DoorDirection')`) extend to the five descriptions.
- It does not set or correct the door side in the server or the planner: the agent sets it (D84's
  rejected alternative stays rejected).
- It does not change the chat's instruction handling: D80 stands — the chats pass the planner's
  system prompt; the sentence reaches the agent through the tool list, which every request carries.
- It does not change the result shape: no new feedback field; the result still returns the changed
  groups. The sentence teaches, the vocabulary enables.
- It does not touch the library: `Automatic` stays the library's intended default; no library issue
  is opened.

## Rejected approaches

- **The planner or the server sets or corrects the new end's door side** (a correction in the tool
  command, reported like the library's changes, D59). D84 rejected it: "the server setting or
  correcting the side of the ends by `rowIndex` — it needs the library's door direction attribute and
  its values, library information in the server's logic". roomle-ui's HI code names no door attribute
  today (a search for `DoorDirection` over `homag-intelligence/src` finds nothing); adding one would
  be the first library attribute in the logic, against §2.4. It would also build a correction the
  agent never asked for instead of teaching the rule. Any such change would be based on
  `fix/room-corners-at-openings`.
- **The chat forwards the server's instructions** (`chat-stream.ts:128` appends the MCP initialize
  instructions to the system prompt). D80 decided the chat prompts come from the planner and recorded
  that the model learns the rules only through `get-authoring-rules`; the instructions are the size
  of the authoring rules — several thousand tokens in every step of every turn — while the targeted
  sentence costs a few dozen tokens in a tool list every request already sends, and it reaches the
  agent in the conversation that edits, where the general text is not read.
- **A hint in the result that names the new end's door side** (roomle-ui `hi-tool-hints.ts`). Naming
  the side means reading the library's door direction attribute and knowing what its values mean —
  the same library information in the logic; the result already returns the changed groups and the
  vocabulary carries the attribute with its descs. The gap is the rule, not the data.
- **A library change** — pass the door direction on between neighbours, or resolve `Automatic` by
  the unit's place in the row. The default is intended (D84 keeps the rule agent-side; the
  attribute's desc already teaches the right-end rule); the change would alter every plan and every
  client of the library and depends on HOMAG. The served text serves every library.
- **A guard that refuses an edit at an end without a door direction in the payload.** A guard fights
  the symptom: the door direction is optional input the library defaults, the agent's payload is
  legitimate, and the refusal would cost a step of the turn and tell the agent nothing it can act on
  ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).

## Implementation plan (sketch)

1. roomle-hi-example `hi-mcp/hi-mcp-server/hi-mcp-server.ts:587, 603, 631, 717, 742` — the sentence
   in the five descriptions, before "Returns …".
2. roomle-hi-example `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` — a test beside the D84
   guard test (line 902): the five descriptions carry the sentence, and none carries
   `mod_DoorDirection`.
3. roomle-hi-example `docs/hi-mcp-behaviour.md` — D84's "in effect" cell (line 335) names the five
   descriptions beside `AUTHORING_RULES`; the command-tools table names the sentence in the five
   rows.
4. roomle-hi-example `docs/hi-mcp-server.md` — the tool table (lines 614-619) carries the sentence
   in the five rows.
5. roomle-hi-example `.agents/skills/hi-mcp-tools.md` — the five rows (lines 34-39) name the rule.
6. roomle-hi-example `docs/test-prompts.json` — the `expect` of `edit-swap-units` and
   `undo-a-wrong-command` names the new ends hinged at the outer sides; the two tests hold the
   outcome.
