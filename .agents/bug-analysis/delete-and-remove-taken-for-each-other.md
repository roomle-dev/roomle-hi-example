# Bug Analysis: "delete" and "remove" are taken for each other

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the served text of `delete-group`, `delete-root-module` and `remove-article-from-group` (`hi-mcp-server.ts`); the HI chat (`chat-config.ts`, `chat-server.ts`)
> **Trigger**: [RML-18079](https://roomle.atlassian.net/browse/RML-18079); backlog [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issue 43; related: [RML-18045](https://roomle.atlassian.net/browse/RML-18045) (the row edit tools, D40), [RML-18065](https://roomle.atlassian.net/browse/RML-18065) (D52), [RML-18041](https://roomle.atlassian.net/browse/RML-18041) (umbrella)
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — analysed and planned on `fix/delete-and-remove-tool-choice-RML-18079`

## Affected repositories

- **roomle-hi-example**: the fix. The descriptions of `delete-root-module`,
  `remove-article-from-group` and `delete-group` and one sentence of the instructions
  (`hi-mcp-server.ts`), an optional `groupId` for `remove-article-from-group`
  (`tool-executors.ts`), the tests that pin both, the D40 row and the §6 rows of
  `docs/hi-mcp-behaviour.md`, the tool references, and the removal of backlog issue 43.

Not changed:

- **roomle-ui**: the planner commands `delete-root-module` and `remove-article-from-group`
  (`HI_GROUP_OPERATION`, `hi-plan-context.ts`) do what they should. The MCP tool name is not the
  command name: the executor forwards its own command string (`tool-executors.ts:3586`, `:3617`).
- **ligna-store**: it uses the same MCP server and gets the fix with its deployment.

## Symptom

The user says "remove" and the agent deletes; the user says "delete" and the agent removes:

- "remove the middle unit" of a row of three tall units: gpt-5.4-mini calls `delete-root-module`.
  The gap stays, and the row falls apart into two groups of one tall unit each.
- "remove the base unit next to the corner unit on the right wall" of a corner kitchen with wall
  units: gpt-5.4-mini calls `delete-root-module`. The kitchen falls apart into four groups — the
  corner unit with the back leg, the rest of the right leg, the wall unit and the range hood above
  the gap, and the wall units of the back wall.
- "delete the middle unit": gpt-5-mini called `remove-article-from-group` once, and the gap closed.

The answer then says what the user asked for: "I removed the middle unit", "the run was
preserved". The user sees the other edit in the plan.

## Reproduction

**The ticket's runs**, `mcp-test-2026-10-06_08-31-06`: gpt-5-mini test 17 ("delete the middle
unit" → `remove-article-from-group`), gpt-5.4-mini tests 16 and 24 ("remove …" →
`delete-root-module`).

**The reasoning-effort matrix**, `mcp-test-2026-10-07_07-20-49` (RML-18043): gpt-5.4-mini at its
default effort calls `delete-root-module` for "remove" again in 16 and 24. At effort `low` and
`medium` it takes the right tool in 16, 17 and 24. gpt-6-astra took the right tool in every run of
2026-10-07 (`09-46-08`, `11-52-03`, `11-58-22`).

**Today, on master `afaa5ad`**, through the chat with the deployed planner
(`.temp/result/issue-RML-18079/repro-master/`, `run-hi-mcp-prompt.js`, three runs each):

| Prompt | Plan | gpt-5-mini | gpt-5.4-mini |
|---|---|---|---|
| "delete the middle unit" | three-tall-units | 3 × `delete-root-module` | 3 × `delete-root-module` |
| "remove the middle unit" | three-tall-units | 3 × `remove-article-from-group` | **3 × `delete-root-module`** |
| "remove the base unit next to the corner unit on the right wall" | corner-kitchen-wall-units | — | **3 × `delete-root-module`** |

gpt-5.4-mini takes the wrong tool for "remove" every time. It reads the plan context and calls
the tool in the next step with **0 reasoning tokens** (the chat sets no reasoning effort, and the
deployment's default for gpt-5.4-mini is none). gpt-5-mini reasons (about 200 tokens in that
step) and took the right tool in all six runs; its "delete" → remove of 2026-10-06 did not come
back in three runs.

**The isolated tool choice.** To compare sentences, a harness in the scratchpad replays the chat's
second step many times without a planner: the chat's system prompt, the user's prompt, the
`get-plan-context` call and its result as the chat hands it to the model (captured once per plan
from the live page, `.temp/result/issue-RML-18079/capture/`), and the tool list as served
(`tools/list`). It records the first tool the model calls. A variant changes one thing in the
served tool list. Ten samples per row:

| Model | Prompt | Served text | `delete-root-module` | `remove-article-from-group` | other |
|---|---|---|---|---|---|
| gpt-5.4-mini | "remove the middle unit" | master | **7** | 3 | |
| gpt-5.4-mini | "remove the base unit next to the corner unit …" | master | **8** | 2 | |
| gpt-5.4-mini | "delete the middle unit" | master | 10 | | |
| gpt-5-mini | "remove the middle unit" | master | 1 | 8 | 1 text |
| gpt-5.4-mini | "remove the middle unit" | `remove-article-from-group` renamed `remove-root-module` | **9** | | 1 text |

The harness reproduces the chat. Its replay leaves out the reasoning of the chat's first step,
so gpt-5-mini errs a little more often there than in the chat.

## What the chat model reads

The HI chat hands the model its own system prompt (`CHAT_SYSTEM_PROMPT`, `chat-config.ts:12`,
`chat-server.ts:118`) and the tool list, **not** the server's instructions (§4 of
`docs/hi-mcp-behaviour.md`). The model learns the rules only when it calls `get-authoring-rules`,
and none of the failing runs did. The only served text that decides between the two tools is
therefore the tool list — names, descriptions and input schemas:

| Tool | Description as served (`hi-mcp-server.ts`) | Input |
|---|---|---|
| `delete-group` (`:391`) | "**Removes** a group with all its root modules from the plan. Returns the id of the **removed** group." | `groupId` |
| `delete-root-module` (`:405`) | "Deletes one root module from its group **and leaves the gap** - the tool when the user asks to delete an article: root modules that are no longer docked together afterwards become separate groups where they stand; … **To close the gap, use remove-article-from-group.** …" | `rootModuleId` |
| `remove-article-from-group` (`:421`) | "Removes one root module from its group **and closes the gap** - the tool when the user asks to remove an article: the root modules beside it are docked together, … one leg turns by 90 degrees … **Removing the only root module removes the group. To delete an article and leave the gap, use delete-root-module.** …" (nine sentences) | `groupId`, `rootModuleId` |

The sentence that binds the user's word to the tool — "Take the user's word: to "remove" an
article is remove-article-from-group, to "delete" an article is delete-root-module"
(`hi-mcp-server.ts:27`) — is in `AUTHORING_RULES`. It reaches Claude Desktop, VS Code and other
clients that pass the instructions on, but not the HI chat.

## Cause

The served text that the chat model reads does not bind the user's word to the tool; it defines
each tool by what happens to the gap, and it uses "remove" for a deletion:

1. **The binding sentence is served where the chat model does not read it.**
   `hi-mcp-server.ts:27` says plainly which word is which tool, but only in `AUTHORING_RULES`.
   D40 states that "the rules and the two tool descriptions tell the agent to take the user's
   word"; in the HI chat only the descriptions do.
2. **The descriptions lead with the gap and give the user's word as an aside.** Both open with the
   effect — "leaves the gap", "closes the gap" — and name the word only after the dash, as "the
   tool when the user asks to delete an article". Both close by sending the reader to the other
   tool by the gap: "To close the gap, use remove-article-from-group", "To delete an article and
   leave the gap, use delete-root-module". "Remove the middle unit" says nothing about a gap. A
   model that decides without reasoning (gpt-5.4-mini at its default effort, 0 reasoning tokens)
   decides by the effect, and the tool that takes the unit out and moves nothing else reads like
   the plain answer to "remove". The remove description adds to it: nine sentences about docking,
   wall units that move and a leg that turns by 90 degrees make it read like a rearrangement, not
   like taking a unit out.
3. **The served text calls a deletion "remove".** `delete-group` "Removes a group" and returns
   "the removed group"; the instructions say "delete-group removes a group" (`:27`); and the remove
   description says "Removing the only root module removes the group". In the tool list the model
   reads, "remove" is a general verb for taking something out of the plan, and a delete tool
   answers it.

The **tool names are not the cause**: with `remove-article-from-group` renamed to
`remove-root-module`, so that the two names differ only in the verb, gpt-5.4-mini still took
`delete-root-module` 9 of 10 times.

A fourth difference may add weight: `remove-article-from-group` asks for a `groupId` beside the
`rootModuleId` (`hi-mcp-server.ts:431`), `delete-root-module` for the `rootModuleId` only. The
server does not need it: `delete-root-module` already finds the root module in every group
(`tool-executors.ts:3578`).

Which of points 2 and 3 weighs most for gpt-5.4-mini is not measured one by one. The fix changes
both, and the test below checks the result with the models of the ticket.

gpt-5-mini's "delete" → `remove-article-from-group` of 2026-10-06 did not come back in three chat
runs today. The same served text leads there: the description of `delete-root-module` names its
effect — the row falls apart into separate groups — and recommends the other tool in the same
breath, and a model that reasons about the result picks the tool whose effect looks better.

## Fix

The fix follows the order of
[AGENTS.md — Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): clarify the
served text, then simplify the tool API. No check, no correction: the server cannot tell from the
call which word the user said.

1. **Open each description with the user's word.** The word is the selector; the gap is what
   follows from it. In the user's words — a unit, a cabinet, an article:
   - `delete-root-module`: "The tool for "delete": when the user asks to delete a unit, a cabinet
     or an article, it deletes that root module from its group and leaves the gap - …"
   - `remove-article-from-group`: "The tool for "remove": when the user asks to remove a unit, a
     cabinet or an article, it removes that root module from its group and closes the gap - …"

   The closing cross-references name the word, not the gap: "When the user says remove, use
   remove-article-from-group." / "When the user says delete, use delete-root-module."
2. **"Remove" only for `remove-article-from-group`.** `delete-group` "Deletes a group with all its
   root modules from the plan. Returns the id of the deleted group."; the instructions say
   "delete-group deletes a group"; the remove description says "Removing the only root module
   deletes the group".
3. **One input for both tools.** `groupId` of `remove-article-from-group` becomes optional: the
   server finds the group of the root module, as `delete-root-module` does. The two tools then
   differ in the verb and the gap only. A `groupId` that is sent keeps working as today.

The sentence of `hi-mcp-server.ts:27` stays, for the clients that read the instructions. D40 gets
the reason: the descriptions carry the binding, because the HI chat does not read the rules. The
remove description keeps what D51 and D52 require it to say (the corner article, the leg that
turns); the opening sentence carries the word.

The reasoning effort is not the fix: gpt-5.4-mini takes the right tool at effort `low` and
`medium`, but the served text has to work at the effort the user runs.

## Tests

- **Unit** (`hi-mcp-server.test.ts`): the descriptions of `delete-root-module` and
  `remove-article-from-group` open with "The tool for "delete"" and "The tool for "remove"";
  `delete-group` and the instructions no longer say "removes a group"; `remove-article-from-group`
  without `groupId` resolves the group of the root module (`tool-executors.test.ts`).
- **Chat**, as the ticket asks: "delete the middle unit" and "remove the middle unit" on
  three-tall-units, and "remove the base unit next to the corner unit on the right wall" on
  corner-kitchen-wall-units, with gpt-5-mini and gpt-5.4-mini, three runs each, take the matching
  tool (`run-hi-mcp-prompt.js`, about 15 minutes).
- The test prompts `edit-remove-unit`, `edit-delete-unit` and `edit-remove-next-to-corner` of
  `docs/test-prompts.json` already cover it in "test the mcp".

## Implementation plan

Only roomle-hi-example changes. Five steps, each verified:

1. The served text (`hi-mcp-server.ts`) → verify: the new tests of `hi-mcp-server.test.ts` pass.
2. The optional `groupId` (`hi-mcp-server.ts`, `tool-executors.ts`) → verify: the new tests of
   `tool-executors.test.ts` pass, the existing tests of `remove-article-from-group` with a
   `groupId` pass unchanged.
3. `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check` → all green.
4. The documentation → verify: `check-markdown-links.js` reports no bad link.
5. The chat check of the ticket → verify: every run takes the matching tool.

### The served text: `hi-mcp-server.ts`

**`delete-root-module`** (`:405`) — the word first, the cross-reference by the word:

> The tool for "delete": when the user asks to delete a unit, a cabinet, a module or an article,
> it deletes that root module from its group and leaves the gap - root modules that are no longer
> docked together afterwards become separate groups where they stand; deleting the only root
> module deletes the group. When the user says remove, use remove-article-from-group. Generated
> roots (worktop, toe kick) cannot be deleted - the library regenerates them. Returns the
> remaining groups.

**`remove-article-from-group`** (`:421`) — the same opening; the middle stays as it is (D51, D52);
the only root module "deletes the group"; the cross-reference by the word:

> The tool for "remove": when the user asks to remove a unit, a cabinet, a module or an article,
> it removes that root module from its group and closes the gap - the root modules beside it are
> docked together, and the root modules at a wall or in a corner keep their place. A wall unit or
> a range hood that hung from the removed root module hangs from the one that moves into the gap.
> A root module with a neighbour on one side only is removed and nothing else moves. Removing a
> corner article between two legs closes the gap as well: one leg turns by 90 degrees, with the
> units above it, and is docked to the other, so the legs form one straight row - the result
> names the leg that turned. Removing the only root module deletes the group. When the user says
> delete, use delete-root-module. Generated roots (worktop, toe kick) cannot be removed - the
> library regenerates them. Returns the changed group.

Its `groupId` (`:431`) becomes optional: "The id of the group, optional - left out, the server
takes the group of the root module. A unique id prefix is accepted."

**`delete-group`** (`:391`): "Deletes a group with all its root modules from the plan. Returns the
id of the deleted group."

**`AUTHORING_RULES`** (`:27`): "delete-group removes a group" → "delete-group deletes a group". The
sentence "Take the user's word: …" stays. `INSTRUCTIONS` (`:69`) already lists the two tools with
their own verbs and stays.

### The optional `groupId`: `tool-executors.ts`

`remove-article-from-group` (`:3599`) takes the group from the root module when `groupId` is left
out:

- The root id is resolved against the roots of every group (`resolveRootId` over
  `rootsOfGroups`, C17 as for `delete-root-module`), and the group is the one whose roots hold the
  resolved id.
- When no group holds it — the id matches no root, or more than one —, the executor throws before
  any planner call: "Root module '…' not found. Roots in the plan: …" — the message the planner
  gives `delete-root-module` for the same id (P11 with the roots appended, C17). New guard **G54**.
  Steps 1–4 of the guard rule do not apply: without a group the server cannot run the remove, and
  an id that matches no root has no intent to read.
- With a `groupId`, nothing changes: `findGroup` (G18) and the root within that group (C17, P5).

A small helper, `groupOfRoot(groups, rootId, label, corrections)`, returns the group and the
resolved root id; the executor calls it only without `groupId`.

### Unit tests

`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`:

- New: **"binds the user's word to delete-root-module and remove-article-from-group in their
  opening sentence"** — `delete-root-module` starts with 'The tool for "delete": when the user asks
  to delete a unit, a cabinet, a module or an article, it deletes that root module from its group
  and leaves the gap'; `remove-article-from-group` with the same words for "remove" and "closes
  the gap"; each contains its cross-reference 'When the user says remove, use
  remove-article-from-group' / 'When the user says delete, use delete-root-module'; neither
  contains 'To close the gap, use' or 'To delete an article and leave the gap'. The input schema of
  both requires `rootModuleId` only.
- New: **"says remove only for remove-article-from-group"** — the `delete-group` description starts
  with 'Deletes a group' and does not match /remov/i; the `delete-root-module` description matches
  /remov/i only in its cross-reference; the remove description says 'Removing the only root module
  deletes the group'.
- Changed: "teaches the row edits and which end of a row keeps its place" (`:422`) adds
  'delete-group deletes a group' to the sentences of the rules.
- Unchanged: "rejects remove-article-from-group without a required argument" (`:98`) — its case
  `{ groupId: 'g1' }` lacks `rootModuleId`, which stays required.

`hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, beside the row-edit tests (`rowGroup`,
`:4985`), with a plan of two groups:

- New: **"remove-article-from-group without a group id removes the root module from the group that
  holds it"** — the planner gets `{ groupId: <that group>, rootModuleId }`, and the row hint runs
  for that group.
- New: **"remove-article-from-group without a group id reads a root id prefix in every group"** —
  the correction "remove-article-from-group: root id '…' was read as '…'" and the group of the
  resolved root.
- New: **"remove-article-from-group without a group id names the roots of the plan for a root id
  that matches no root"** — the error "Root module 'x' not found. Roots in the plan: …", no planner
  call (G54); also for an id that is a prefix of two roots.
- Unchanged and still passing: "forwards its command to the planner" (`:4334`) and "rejects an
  unknown or ambiguous group id" (`:4377`) — a `groupId` that is sent works as today.

### The documentation

- `docs/hi-mcp-behaviour.md`: D40 — the descriptions open with the user's word, because the HI
  chat does not read the rules; "remove" is used for `remove-article-from-group` only; found with
  gpt-5.4-mini (RML-18079). §6: the input of `remove-article-from-group` is `rootModuleId`, `groupId`
  optional (`:497`), `delete-group` "deletes the group" (`:495`). §8.5: C17 names
  `remove-article-from-group` without `groupId` across all groups, new row G54.
- `docs/hi-mcp-server.md` (`:535`, `:537`), `hi-mcp/hi-mcp-server/README.md` (`:519`, `:521`),
  `docs/implementation/mcp-server.md` (`:93`, `:95`), `docs/implementation/tool-executors.md`
  (`:155`, `:157`), `.agents/skills/hi-mcp-tools.md` (`:28`, `:30`, `:194`),
  `.agents/skills/hi-authoring-rules.md` (`:240`): `groupId` optional, `delete-group` deletes.
- `.agents/backlog/mcp-test-open-issues.md`: issue 43 and its row are removed.

### Verification

- Unit tests, typecheck, lint and format as in step 3.
- The chat check of the ticket, through `run-hi-mcp-prompt.js` with the deployed planner (ports
  3001/3201): "delete the middle unit" and "remove the middle unit" on three-tall-units, "remove the
  base unit next to the corner unit on the right wall" on corner-kitchen-wall-units, with
  gpt-5-mini and gpt-5.4-mini, three runs each — 15 runs, about 15 minutes. Expected: every run
  takes the tool of its word.
