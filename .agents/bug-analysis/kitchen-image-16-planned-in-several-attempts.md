# Kitchen Image 16 Is Planned in Several Attempts

> **Type**: Bug Analysis  
> **Status**: Open  
> **Date**: 2026-10-30  
> **Ticket**: [RML-18346](https://roomle.atlassian.net/browse/RML-18346)  
> **Base**: roomle-ui `feat/hi-mcp-performance` (`fc296821f`, the same commit as `release/bo-test`);
> roomle-hi-example `master` (`621646d`); embedding-lib `0.0.0-dev-1b4351d`

## Affected Repositories

- **roomle-ui** (`feat/hi-mcp-performance`, `packages/web-sdk/packages/homag-intelligence`) — the
  served rules in `src/hi-mcp/hi-mcp-server.ts` (wall units beside each other, sending a group
  again), the image-planning skill (`src/hi-mcp/skills/image-planning/SKILL.md`, the back of a row
  that stands free in the room), the mode `merge-article-into-group` docks a back panel with, and the
  group-attribute stage of `create-or-replace-groups` (`applyGroupWideAttributes` in
  `src/hi-tool-attributes.ts`), with unit tests and the rows of `.agents/homag-intelligence/hi-tools-behaviour.md`.
  The tools run in the planner: the example page and the ligna-store get the fix with the bo-test
  deployment. No embedding-lib build is needed.
- **HOMAG library** (Furniture_Smith) — the desc of the island back panel `RWV` names no peninsula;
  two calculation errors of values the library accepts (library issues 11 and 22) end the first
  kitchen of both reproduction runs.
- **roomle-hi-example** — this analysis, the new evidence for library issues 11 and 22, a library
  issue and a suggested desc for `RWV`, and a test for kitchen image 16 in `docs/test-prompts.json`.
- ligna-store — unchanged. It loads the planner from bo-test.

## 1. Symptom

The ticket plans [kitchen image 16](../../docs/images/kitchen-16.png) with the HI Planning Assistant
in the ligna-store test stage (gpt-6-astra, the store's default model). The image shows a U-shaped
kitchen: a peninsula with the hob and a stool, a base row with the sink under the window, a block of
tall units with the built-in oven, and four wall units with two open, wood-lined compartments under
the middle two. Fronts and carcases are dark green-grey, the worktop is light oak.

The three plan snapshots of the ticket hold one group (`a27c73be…`), changed in place. Loaded
without a model on the example page, they show:

| Snapshot | What the user sees | What the group holds |
|---|---|---|
| Attempt 1 `ps_tad12jblqu4z859xrsoo98cr0r8ejd40` | Wall units of uneven height, no open compartments; the peninsula on legs | Four `OTB60` wall units 900, 600, 600 and 900 mm high, all at `mod_HeightPosInsertion` 1720 — bottoms flush, tops not. No open shelf unit. No back panel: the backs of the three peninsula units (`UTB60`, `UKS2A60`, `UELTB90`) face the room with their legs. Every root module carries its finishes (front 152, carcase 152, worktop 230 at 25 mm). |
| Attempt 2 `ps_taeqtys9q57nxwyheklkh011rt4tig6` | Mixed materials; the peninsula not one closed block | No root module carries a finish. The worktop and the toe kick carry no attribute (the worktop renders white marble), three articles carry their own front program (`mod_FrontProgram` Nature on `UERTB90`, `UELTB90`, `GSP`). The wall units are now `OTB45` with two open shelf units `ORFB60`, all with the carcase in wood (230, `ModernNature`). A back panel `RWV` without `mod_IslandBackwallWidth` covers one unit. |
| Final `ps_tad132rvnbjnipysy83fi1r5ig8xvvia` | The kitchen of the image | The finishes on every root module, `ORFB60` 300 mm high with an `OTB45` 600 mm on top of each, `OTB45` 900 mm at both ends (tops flush), only the back wall of the open shelves in wood (`mod_CarcaseBackwallColor` 230), `RWV` 2331 mm wide. |

The store keeps no log of the tool calls. The payloads that built the attempts are not known; the
reproduction below records them.

## 2. Reproduction

The example page loads the same embedding-lib and the same bo-test planner as the ligna-store test
stage, and bo-test is the commit of `feat/hi-mcp-performance`. Two runs, the image alone, on the
default room of the tests:

```bash
EXAMPLE_PORT=3001 HI_CHAT_PORT=3201 node .agents/scripts/run-hi-mcp-prompt.js gpt-6-astra "$AZURE_GPT_KEY" "" \
  --plan ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv --image docs/images/kitchen-16.png \
  --out .temp/result/repro-kitchen-16-2026-10-30/gpt-6-astra-<n>
```

| Run | Chat | First plan change | Model steps | Model / tools | Plan-changing calls | Plan snapshot |
|---|---|---|---|---|---|---|
| 1 | 227 s | 80 s | 16 | 214 s / 13 s | 9 | `ps_takx0c36gii6uj7w5oyg2oj443qfmk5` |
| 2 | 288 s | 66 s | 12 | 279 s / 10 s | 6, two of them failed | `ps_tak11nzyzeireovyjxoy0a39aqwyr79s` |

The other image tests of gpt-6-astra on bo-test take 21 to 104 s (`mcp-test-2026-10-28_19-47-49`,
tests 67 to 73).

Both runs plan the layout of the image at once: the U with the peninsula, the sink, the tall units
and the open compartments under the middle wall units, built as open shelf units with a wall unit
`onTop` of each. Both pass through wrong kitchens on the way:

- **Run 1.** The create builds the kitchen in the articles' own finishes — the state of attempt 2 —
  until the agent sets the materials again; the peninsula stands on legs — the state of attempt 1 —
  until the agent sees it in the plan images and adds the back panel.
- **Run 2.** The create builds wall units 600 mm wide, the agent sends the whole group again to
  narrow them, the library cannot calculate the resend twice, the third resend is built. The
  peninsula stays on legs in the final kitchen; the answer says the rear cladding is not reproduced.

The uneven wall units of attempt 1 do not reproduce: both runs stack the wall units on the open
shelf units in their first create.

## 3. Where the Time Goes

The model takes 94 % of run 1 and 97 % of run 2. Every tool together takes 13 s and 10 s. The time
is the number of model steps and the long ones: a step that writes a whole group (1,200 to 2,700
output tokens) or reasons over the image or the plan (900 reasoning tokens) takes 22 to 66 s.

**Run 1**, 227 s:

| Step | Model s | Call | |
|---|---|---|---|
| 1 | 6.8 | `get-skill` ×2 | |
| 2 | 40.4 | `find-attributes` | reads the image |
| 3 | 29.4 | `create-or-replace-groups` | the kitchen; no finish set (§4.2) |
| 4–8 | 37.9 | `change-group-attribute`, `change-module-attribute` ×4 | the finishes again, then the open shelves' wood and the wall units' handles again — 44 s with the tools |
| 9–10 | 41.2 | `get-plan-context`, `get-plan-images` | the check |
| 11–15 | 41.1 | `find-attributes`, `merge-article-into-group`, `undo`, `get-plan-context`, `merge-article-into-group` | the peninsula's back panel, docked at the wrong end first (§4.1) — 44 s with the tools |
| 16 | 17.8 | answer | |

**Run 2**, 288 s:

| Step | Model s | Call | |
|---|---|---|---|
| 1–2 | 25.2 | `get-skill` ×2, `find-attributes` | |
| 3 | 37.2 | `create-or-replace-groups` | the kitchen, wall units 600 mm wide |
| 4 | 14.9 | `change-group-attribute` | the server set the end unit's 250 mm overhang on the whole worktop; the agent sets it back |
| 5 | 6.5 | `get-plan-context` | |
| 6 | 66.0 | `create-or-replace-groups` | the whole group again, 2,682 output tokens, for narrower wall units (§4.4) — Error 13003, nothing changed |
| 7–10 | 80.0 | `create-or-replace-groups`, `find-attributes`, `change-group-attribute`, `create-or-replace-groups` | the handle the library chose itself, resent until it calculates (§4.2) |
| 11 | 19.6 | `get-plan-images`, `get-plan-context` | |
| 12 | 29.4 | answer | |

Avoidable: up to 88 s of run 1 (39 %) and about 150 s of run 2 (52 %). Without them, both runs end
in about 140 s, near the other image tests.

## 4. Investigation and Root Causes

### 4.1 The Peninsula on Legs — Attempt 1, Both Runs

**What happens.** A peninsula is a row of base units that stands free in the room: its back faces
the room. The library builds the backs of base units open, on legs; the image shows them closed
by a panel down to the floor. The catalog has the panel (`RWV`, category Kitchen Island, width
`mod_IslandBackwallWidth`). No run puts it into the create. Run 1 notices the legs in the plan images
(step 10) and adds the panel with `merge-article-into-group`; run 2 never adds it; the ticket's agent
adds it after attempt 1, first 600 mm wide (attempt 2), then over the whole row (final).

**What led the agent there.**

- **The image-planning skill** (`skills/image-planning/SKILL.md`, §1 and §5) has the agent choose
  "each article by what the cabinet does in the image" and leave out "what is no furniture of the
  catalog". The closed back of a peninsula is no cabinet; nothing in the skill says that a row
  standing free in the room shows its back and that the catalog finishes it.
- **The authoring rules** (`hi-mcp-server.ts:31`) name `behind` for "back to back … (an island)"
  only.
- **The library data**: the desc of `RWV` says "Decorative back panel for a kitchen island … covering
  the visible back of the island cabinets". A peninsula is not an island; the desc gives the agent
  no reason to take the panel for it.

**Why the merge goes wrong first.** `merge-article-into-group` leaves the docking to the agent:
vectors and mode, the mode `StartStart` by default (`hi-mcp-server.ts:755–800`). Run 1 docks the
panel `BackBottom -> BackBottom` with `StartStart`, reads the result, undoes it and docks it again
with `StartEnd`. The create derives this mode itself: `behind` docks `BackBottom -> BackBottom` with
`StartEnd`, `EndStart` when the row continues to the right only (`hi-group-layout.ts:886–899`).

### 4.2 The Kitchen in the Articles' Own Finishes — Attempt 2, Both Runs

**What happens.** `create-or-replace-groups` builds the group from the root modules first, then sets
the group attributes — the fronts, the carcase, the handles, the worktop, the toe kick — on every
module in one `change-attributes` operation (`applyGroupWideAttributes`,
`hi-tool-attributes.ts:665–792`). When the library cannot calculate one root module with one of the
values, the operation is discarded as a whole (D106) and the result says so
(`hi-tool-attributes.ts:782–790`): "the group attributes … were not set … nothing was changed". The
group stays in the articles' own finishes — white marble worktop, grey and wooden carcases, the
front program of each article. That is the state of attempt 2: no root module carries a finish, the
worktop and the toe kick carry none, three articles show their own front program.

**Run 1** sends a worktop of maple (230) at 40 mm. The library cannot calculate the generated worktop
(`mr_Countertop`): "Error 13002: Could not find entry in tab_EdgeMapping for input values: Program:
All, Color: 230, EdgeClass: FrontClass1, BoardThickness: 40". The other ten group attributes, which
the library calculates, are not set either. The agent sends them again with
`change-group-attribute` at 25 mm. That call sets the carcase colour and the handle design on every
module, so it also overwrites the wood of the open shelves and the handleless wall units the create
had kept per root module — four more calls to set them again.

**Run 2** sends the whole group again (§4.4) with the curved bow handle (100) in black. The library
chose that handle itself in the first create ("the library changed mod_HandleDesign of 13 root
modules from 20 to 100"); in the resend it cannot calculate ten root modules with it: "Error 13003:
Could not find entry in tab_HandleMapping for HandleDesign: 100, HandleLength: 128, HandleColor:
Black". The resend changes nothing; so does the next one with the rail handle (20), which the
library replaces by 100 again. The agent finds `mod_HandleLength`, sets it to 160 and resends a third
time.

**Classification.** Both values pass the check of the verified options (D107) and fail in the
calculation: library bugs by D99, the cases of
[library issue 22](../backlog/library-issues.md#22-a-marble-worktop-at-40-mm-the-library-cannot-calculate)
(now with maple, not only marble) and
[library issue 11](../backlog/library-issues.md#11-a-handle-strip-the-library-cannot-calculate)
(now the curved bow in black at 128 mm). They are the trigger. What turns one failing value of the
generated worktop into a kitchen in all-default finishes is the tools' handling: one discarded
operation takes the fronts, carcases and handles of every other root module with it, and the agent
has to repair them in further calls.

The ticket's run cannot be traced to its failing value — the store logs no tool call. Its attempt 2
is the state this stage leaves after a resend (the same group id, the root modules without their
finishes).

### 4.3 The Wall Units of Uneven Height — Attempt 1

**What happens.** Attempt 1 hangs four wall units 900, 600, 600 and 900 mm high at one bottom line
(`mod_HeightPosInsertion` 1720): the two 600 mm units end 300 mm lower at the top. A wall unit
`rightOf` or `leftOf` another wall unit docks `RightBottom -> LeftBottom`, bottom to bottom
(`pairOf`, `hi-group-layout.ts:872–884`). In attempt 1 the first one hangs `above` with a `gapMm`,
and the others take its bottom.

**What led the agent there.** The authoring rules describe `above` as "a wall unit hanging above that
floor-standing root module, its top flush with the tall units, as every wall unit of the group"
(`hi-mcp-server.ts:30`). The sentence promises a top line for every wall unit. It holds for a unit
hung with `above` without `gapMm`, not for a unit continued with `rightOf` or `leftOf` — that one
takes the bottom of its neighbour. An agent that plans the middle units shorter so that the open
compartments show below them, trusting the top line, gets the tops of attempt 1. This is inferred
from the snapshot: neither run reproduces it, and the store's payload is not known.

### 4.4 Sending the Whole Group Again — Run 2, Attempt 1 to Attempt 2

**What happens.** To narrow four wall units and two open shelf units from 600 to 450 mm, run 2 sends
all 17 root modules again with `create-or-replace-groups` — 66 s for one step, 2,682 output tokens —
where one `change-module-attribute` with `mod_Width` 450 on the six root modules does it. Each resend
runs the group-attribute stage again (§4.2) and fails twice here. The ticket's run did the same: the
wall units of attempt 1 are 600 mm wide, those of the final kitchen 450 mm, and attempt 2 is a group
resent with its id.

**What led the agent there.** The rule "Undo a wrong result" (`hi-mcp-server.ts:45`): "when a result
is not what was asked … send the corrected call instead of correcting the wrong plan piece by piece:
a group of the plan is sent again with its id". The sentence after it, "A group that only needs a
change is edited with the command tools", does not say what "only a change" is; an agent that judges
its first kitchen wrong in its sizes takes the resend.

## 5. Proposed Fix

All in roomle-ui on `feat/hi-mcp-performance`, by the steps of "Guards Are a Last Resort" in
[AGENTS.md](../../AGENTS.md#guards-are-a-last-resort). No guard.

1. **The back of a free-standing row (§4.1).**
   - *Clarify* — the image-planning skill, §5, one sentence: a row that stands free in the room — an
     island, a peninsula — shows its back; plan the panel the catalog has for it in the same create,
     `behind` a root module of that row. Library-neutral, no article named.
   - *Simplify the tool API* — `merge-article-into-group` derives the mode of a
     `BackBottom -> BackBottom` docking as `behind` does, when the agent gives none, so a back panel
     added later docks at the right end.
   - *Library desc* — the desc of `RWV` names the peninsula and the free end of a row beside the
     island: a new library issue and a proposal in
     [suggested-library-changes.md](../../docs/library-information/suggested-library-changes.md).
2. **Group attributes the library can calculate are set (§4.2).** *Correct the input and inform the
   agent:* when the library cannot calculate the group-attribute stage, `applyGroupWideAttributes`
   leaves out the values of the root modules that failed — the attributes among the sent ones that
   those root modules carry — and sends the rest once more. `corrections` name the values left out,
   the root modules and the library's message. One failing worktop value then leaves the fronts,
   carcases and handles set, and the agent changes the one value with one call. This narrows D106 for
   this stage and needs a decision row in `hi-tools-behaviour.md` §3. It handles the aftermath of
   library bugs; the bugs themselves stay library issues 11 and 22, extended with the evidence above
   and reported to the library development team.
3. **The top line of the wall units (§4.3).** *Clarify* the `above` rule at `hi-mcp-server.ts:30`: a
   wall unit `rightOf` or `leftOf` another wall unit hangs at its bottom; a shorter unit whose top
   lines up with its neighbours stands `onTop` of the unit below it, as an open shelf unit under it.
4. **Sizes and materials with the command tools (§4.4).** *Clarify* the rule "Undo a wrong result" at
   `hi-mcp-server.ts:45`: a group is sent again for a wrong layout — the wall, the corner, articles
   missing or wrong; the sizes and materials of root modules change with `change-module-attribute`,
   all root modules that take the same value in one call.

The overhang of run 2 (step 4) is no defect of the ticket; it is listed for the time only.

## 6. Verification

- **Unit tests** (roomle-ui `__tests__/hi-tool-commands/`): a create whose group attributes fail on
  the generated worktop sets the other group attributes and names the value left out; a merge
  `BackBottom -> BackBottom` without a mode docks as `behind` does.
- **Model-free** on the dev planner: the create and the merge of run 1 replayed with
  `callExternalObjectAgentTool`, before and after.
- **With the model of the issue**, gpt-6-astra, kitchen image 16 on the default room, on the dev
  planner of `feat/hi-mcp-performance`: no wrong intermediate kitchen, and the planning time against
  the two runs above (227 s and 288 s). The model runs wait for the user's go.
- **Test prompt**: kitchen image 16 in the category "planning from images" of
  `docs/test-prompts.json`, with the peninsula's closed back, the top line of the wall units and one
  consistent finish as expectations.

## 7. Evidence

- `.temp/result/repro-kitchen-16-2026-10-30/gpt-6-astra-1/` and `gpt-6-astra-2/` — `run.json` (tool
  calls, corrections, model steps), `planner-calls.json`, the plan images the agent saw, the final
  snapshot; `run-1-calls.txt` and `run-2-calls.txt` beside them.
- `.temp/result/repro-kitchen-16-2026-10-30/ticket-snapshots/` — the groups and images of the three
  ticket snapshots.
- `node .agents/scripts/benchmark-hi-mcp-runs.js .temp/result/repro-kitchen-16-2026-10-30/gpt-6-astra-1`
  (and `-2`) — the step table.
