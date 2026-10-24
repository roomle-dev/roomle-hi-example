# Backlog

What is still to be done in and around roomle-hi-example: defects, hardening and follow-ups, one row
per item. The backlog holds open work only. An item leaves it when its fix is in the code.

## Planning by the MCP server

Details, causes, tests and how to reproduce: [mcp-issues.md](mcp-issues.md), or
the document a row links.

| Item | To do | Priority |
|---|---|---|
| 83 — Where no free stretch of the wall fits the group, it is placed over existing furniture and reported | Served text: say what to do when the wall the user names has no free stretch of the requested width | low |
| 85 — insert-article-into-group takes a between-pair whose root modules do not stand side by side | roomle-ui: the insert's result says when the named pair does not stand side by side; or the served description says what side by side means | low |
| 90 — A group placed over existing objects is not disclosed | Served text: the answer names every object a group stands over, also where the user leaves the place open | low |
| 91 — The answer describes the two legs of the L-shaped kitchen swapped | Served text: the answer describes the plan as it stands, naming the wall of each group | low |
| 96 — "One more shelf" adds the shelf set the cabinet already shows | Analyse what `get-interior-design-options` and the plan context show of the shelves a cabinet without fittings renders | low |
| 98 — A row with a worktop placed into a corner stands 10 mm off the wall | roomle-ui: replay the run's create, find the step that leaves the row off the wall and fix it | low |
| 103 — A unit on top of a follower in another group stays behind when the row below moves | roomle-ui: move the units on top of a follower with it, bottom-up, as within the edited group | low |
| 104 — A unit of another group keeps its height when its carrier changes height | roomle-ui: apply the change of the carrier's docking top to the units of other groups | low |
| 107 — A reverted exchange names the root module id of the unit it took back | roomle-ui: name the new root module of a reverted exchange by the `rootModuleId` of the call | low |
| The models in the planner's coordinate system | Run "test the mcp" with every model on the planner build that carries D105 (the agent works in plan space, z up) and compare each test with its reference session; a placement by point — an island, a group of wall units only — is where the frame shows, the placement by wall names no coordinate | medium |
| The models after a call the library cannot calculate | Run "test the mcp" with every model on the planner build that carries D106 (a tool call the library cannot calculate changes nothing) and check that a model whose call answers "nothing was changed - the library could not calculate …" sends it again with other values or another article, and that the resent create keeps the groups the library could calculate | medium |
| Test prompts for replacing, transferring and batch-deleting interior fittings | `docs/test-prompts.json` has no test that needs `replace-interior-fitting`, a `move-interior-fitting` into another root module of the group or a `delete-interior-fittings` of several fittings. Add tests on a plan with an installed fitting that has `replacementArticles`: replace it by one of them, move a shelf into the neighbouring carcass, delete two shelves in one request | low |
| [Attribute values checked before an edit](attribute-values-checked-before-an-edit.md) | Decide what an edit does with a value the module does not take; roomle-ui: check the agent's attribute values against the library's verified options (`getVerifiedAttributeOptions`) before they are set | medium |
| [The gaps of the library calculation guarantee](library-calculation-gaps.md) | roomle-ui: price and order name the root modules the library could not calculate, the plan context marks them, a create runs the library's conflict resolution and root module checks, an exception of the calculation is reported, every plan-changing tool reports failed root modules; report the library's open calculation errors | high |
| [A relation for a unit under a tabletop](under-relation-for-tabletops.md) | Live-check the inner vectors of a DeMaat tabletop, then compile `under` with the vector index | low |
| [Where Mistral Large falls short of the prompts](mistral-large-prompt-issues.md) | Improvement candidates from the `mistral-large-latest` test run: declare the payload fields in the input schema, merge groups that name each other's roots, act on obstacle hints, describe the walls, open the edit tools with the user's words | medium |
| [Analyse how Spec Kit can help with the prompting](speckit-for-the-prompting.md) | Compare the prompt sections of Spec Kit (user input, pre-execution checks, guidelines, success criteria, done when) with the served text and the chat prompt; propose what improves the plannings | medium |

## Libraries

What the library data lacks for the agent to plan right, and the calculation errors of values the
library accepts (D99); the fix is in the library. Details:
[library-issues.md](library-issues.md).

| Item | To do | Priority |
|---|---|---|
| [61 — Handleless fronts done with a handle attribute](library-issues.md#61-handleless-fronts-done-with-a-handle-attribute) | HOMAG library: distinguish choosing a handleless article from setting the handle design to "No handle" on a handled article | medium |
| [64 — Flip-lift wall cabinets with sizes the library cannot calculate](library-issues.md#64-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) | HOMAG library: the flip-lift wall cabinets' descs name the heights and depths their flap fitting supports | low |
| [69 — End panels with a plain upright colour the library cannot calculate](library-issues.md#69-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate) | HOMAG library: switch the upright program with a plain upright colour as the front program is switched, or say in the desc that a plain colour needs `mod_UprightProgram` Classic | low |
| [70 — Carcase side panels with a plain outside colour the library cannot calculate](library-issues.md#70-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate) | HOMAG library: switch the program of the visible sides with their colour, or say in the descs that the visible sides take the outside colour and a plain one needs the program Classic | low |
| [71 — Folding-flap wall cabinets with glass fronts the library cannot calculate](library-issues.md#71-folding-flap-wall-cabinets-with-glass-fronts-the-library-cannot-calculate) | HOMAG library: the flap wall cabinets' descs name the front programs their flap takes | low |
| [76 — Articles with two doors that do not say how their doors stand](library-issues.md#76-articles-with-two-doors-that-do-not-say-how-their-doors-stand) | HOMAG library: the articles with two doors say one above the other or side by side; `LeftLeft`, `RightRight` and the desc of `14` | low |
| [78 — Tall-unit descriptions omit width-dependent door arrangements](library-issues.md#78-tall-unit-descriptions-omit-width-dependent-door-arrangements) | HOMAG library: apply the width-dependent tall-unit door and resize descriptions so retained single-door settings are corrected for a paired unit | medium |
| [79 — Base units narrowed to 150 mm with a 150 mm plinth the library cannot calculate](library-issues.md#79-base-units-narrowed-to-150-mm-with-a-150-mm-plinth-the-library-cannot-calculate) | HOMAG library: the desc of `mod_Width` names the widths the plinth takes; under 300 mm, a filler panel or pull-out fills the gap | low |
| [80 — Wall units at 900 mm with a single door the library cannot calculate](library-issues.md#80-wall-units-at-900-mm-with-a-single-door-the-library-cannot-calculate) | HOMAG library bug: calculate a single door at every width `mod_Width` accepts, or declare the widths it takes as the verified range of `mod_Width`; then the descs name them | low |
| [93 — Backsplashes the library cannot calculate](library-issues.md#93-backsplashes-the-library-cannot-calculate) | HOMAG library or roomle-ui (not established): replay the check that built the backsplash on 2026-10-18; then the backsplash's grain-direction lookup in the library, or the planner fix | low |
| [99 — A handle strip the library cannot calculate](library-issues.md#99-a-handle-strip-the-library-cannot-calculate) | HOMAG library: the handle position a handle strip takes in the desc of the handle design, or set with the strip; which front programs, handle colours and lengths each handle design takes; report the JSON parse error of the base units | low |
| [100 — A worktop on the tall units from the group's countertop switch](library-issues.md#100-a-worktop-on-the-tall-units-from-the-groups-countertop-switch) | HOMAG library: the desc of `mod_CreateCountertop` says that set on the group it reaches the tall units too | low |
| [106 — A drawer sideboard lowered to 720 mm the library cannot calculate](library-issues.md#106-a-drawer-sideboard-lowered-to-720-mm-the-library-cannot-calculate) | HOMAG library bug: calculate the drawer sideboard at every height `mod_Height` accepts, or declare the heights it takes as its verified range | low |

## Library neutrality of the MCP server

The server serves every HI library; its served text, results and logic must carry no information
about a specific library. Details: [mcp-policy-issues.md](mcp-policy-issues.md).

| Item | To do | Priority |
|---|---|---|
| Served text encodes a kitchen taxonomy | `hi-mcp-server.ts`: `AUTHORING_RULES`, `INSTRUCTIONS` and the tool descriptions reason in base/wall/tall units, worktop, hood and island as if every library were a kitchen, and carry one library's concrete content and fixed measures. Rewrite so the rules speak of articles, root modules, relations and docking vectors | high |
| Spelling correction and result messages map library vocabulary | `tool-executors.ts`: `SPELLINGS` hard-codes search normalization for `colour`/`grey`/`worktop`; drop it or derive it from the master data. The result messages of the roomle-ui HI tool commands name furniture kinds; rewrite them neutrally | medium |
| [The attribute filter names the element type](mcp-policy-issues.md#3-the-attribute-filter-names-the-element-type) | HOMAG library: mark the attributes the agent leaves to the article in the master data; roomle-ui: `isAgentFacingAttribute` reads the mark instead of the id `mod_TypeElement` | low |

## Planner (roomle-ui, RoomleCore)

Defects of the planner outside the HI tool commands. Details: [roomle-ui-issues.md](roomle-ui-issues.md).

| Item | To do | Details |
|---|---|---|
| 63 — A dark worktop renders white under the top light | roomle-ui renderer: the top light overexposes the tabletop depending on the line of sight, so black appears white; render it in its material colour from every line of sight | [roomle-ui-issues.md, 63](roomle-ui-issues.md#63-a-dark-worktop-renders-white-under-the-top-light) |
| 94 — The water connection is an installation element only through a planner override | Rubens Admin: set level 28 on the wall water connection items; then remove the `water_connections` level override in roomle-ui `planner-kernel-access.ts` | [roomle-ui-issues.md, 94](roomle-ui-issues.md#94-the-water-connection-is-an-installation-element-only-through-a-planner-override) |
| 105 — Dragging a unit out of a group splits off the units hanging above the rest | roomle-ui glue logic: `splitRootModuleFromGroup` keeps the split-off parts the docking still links to the group, as a delete in place does (D103) | [roomle-ui-issues.md, 105](roomle-ui-issues.md#105-dragging-a-unit-out-of-a-group-splits-off-the-units-hanging-above-the-rest) |
| Caching the library context | roomle-ui planner: keep the compacted library context (`createLibraryContext`, `hi-library-context.ts`) from `addLibrary` / `loadPosData` until the next catalog load — only when a measurement shows that compacting the catalog on every call costs | not measured; ADR 0013 of roomle-ui |

## Chat

| Item | To do | Details |
|---|---|---|
| Strict tool schemas for the GPT models | Measure how often a GPT model's tool call fails the schema ("Input validation error") in a "test the mcp" session; only if it costs runs, try strict function calling: set `strict` per tool in the tool set of the embedding-lib (the Azure provider sends `strict: false` otherwise). The Azure strict subset needs every field required, `additionalProperties: false` on every object, at most five nesting levels and 100 properties, and no parallel tool calls: the MCP tool schemas with optional fields do not meet it, and a change there reaches every client | [Structured outputs on Azure](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) |
| Paste and pick an image in the chat window | An image reaches the chat only by drop, which the keyboard cannot reach. Add paste from the clipboard and a file picker button to the AI Planning Assistant window, both through `prepareImage` (roomle-ui `PlanningAssistantChat.vue`, `src/common/utils/planning-assistant-image.ts`) | [Images in the chat](../../docs/ai-chat.md#images-in-the-chat) |
| Per-tool status in the chat window | The planning assistant of the embedding-lib passes only the tool name of a call to the window, as an `activity` part. Pass each tool call's input and result as well (roomle-ui `hi-planning-assistant.ts`), and give the window a part that shows them | [The chat window](../../docs/ai-chat.md#the-chat-window) |
| Images of a tool result for Mistral | `@ai-sdk/mistral` writes the images of `get-plan-images` into the tool result as JSON text, which overflows the context, so a Mistral model fails on such a turn in the example. Move them into a user message for Mistral models in the planning assistant of the embedding-lib (roomle-ui `hi-planning-assistant.ts`, a `wrapLanguageModel` middleware) | [Images in tool results](../../docs/ai-chat.md#images-in-tool-results) |
| A step log for the benchmark | The planning assistant of the embedding-lib logs no steps, so the runs of the example carry no tokens and durations per step, and `benchmark-hi-mcp-runs.js` reads only runs made with the former chat backend. Log every step to the page console (tokens in, out and reasoning, tool calls, duration) in the format the benchmark reads | [hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md#1-the-runs) |

## Test infrastructure

Details: [mcp-test-infrastructure-issues.md](mcp-test-infrastructure-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — The object-only perspective render draws an empty frame under software GL](mcp-test-infrastructure-issues.md#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | roomle-ui: find why the frame is dropped under SwiftShader | low |

