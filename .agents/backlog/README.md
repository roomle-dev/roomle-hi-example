# Backlog

What is still to be done in and around roomle-hi-example: defects, hardening and follow-ups, one row
per item. The backlog holds open work only. An item leaves it when its fix is in the code.

## Planning by the MCP server

Details, causes, tests and how to reproduce: [mcp-issues.md](mcp-issues.md), or
the document a row links.

| Item | To do | Priority |
|---|---|---|
| [115 — An interior fitting added where the parent shows a default interior](mcp-issues.md#115-an-interior-fitting-added-where-the-parent-shows-a-default-interior) | roomle-ui served text: the description of `add-interior-fitting` sends the agent to `defaultInteriors` before it adds | low |
| [116 — A conflict a row edit leaves is not resolved](mcp-issues.md#116-a-conflict-a-row-edit-leaves-is-not-resolved) | roomle-ui served text: resolve a conflict a correction reports, or say why not; the turned-leg correction names an opening the row reaches | low |
| The models in the planner's coordinate system | Run "test the mcp" with every model on the planner build that carries D105 (the agent works in plan space, z up) and compare each test with its reference session; a placement by point — an island, a group of wall units only — is where the frame shows, the placement by wall names no coordinate | medium |
| The models after a call the library cannot calculate | Run "test the mcp" with every model on the planner build that discards a change the library cannot calculate before the load (D106, D109) and check that a model whose create answers `notLoaded` with "nothing was changed - …", or whose edit answers that error, repairs the group in place or sends the group again with other values or another article, that the planning never leaves the scene between the attempts, and that a part the library generates is enabled after the group is built | medium |
| Test prompts for replacing, transferring and batch-deleting interior fittings | `docs/test-prompts.json` has no test that needs `replace-interior-fitting`, a `move-interior-fitting` into another root module of the group or a `delete-interior-fittings` of several fittings. Add tests on a plan with an installed fitting that has `replacementArticles`: replace it by one of them, move a shelf into the neighbouring carcass, delete two shelves in one request | low |
| [A relation for a unit under a tabletop](under-relation-for-tabletops.md) | Live-check the inner vectors of a DeMaat tabletop, then compile `under` with the vector index | low |
| [Where Mistral Large falls short of the prompts](mistral-large-prompt-issues.md) | Improvement candidates from the `mistral-large-latest` test run: declare the payload fields in the input schema, merge groups that name each other's roots, act on obstacle hints, describe the walls, open the edit tools with the user's words | medium |
| [Analyse how Spec Kit can help with the prompting](speckit-for-the-prompting.md) | Compare the prompt sections of Spec Kit (user input, pre-execution checks, guidelines, success criteria, done when) with the served text and the chat prompt; propose what improves the plannings | medium |

## Libraries

What the library data lacks for the agent to plan right, and the calculation errors of values the
library accepts (D99); the fix is in the library. Details:
[library-issues.md](library-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — Handleless fronts done with a handle attribute](library-issues.md#1-handleless-fronts-done-with-a-handle-attribute) | HOMAG library: distinguish choosing a handleless article from setting the handle design to "No handle" on a handled article | medium |
| [2 — Flip-lift wall cabinets with sizes the library cannot calculate](library-issues.md#2-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) | HOMAG library: the flip-lift wall cabinets' descs name supported sizes and opening combinations after their verified ranges are established | low |
| [3 — End panels with a plain upright colour the library cannot calculate](library-issues.md#3-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate) | HOMAG library: switch the upright program with a plain upright colour as the front program is switched, or say in the desc that a plain colour needs `mod_UprightProgram` Classic | low |
| [4 — Carcase side panels with a plain outside colour the library cannot calculate](library-issues.md#4-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate) | HOMAG library: switch the program of the visible sides with their colour, or say in the descs that the visible sides take the outside colour and a plain one needs the program Classic | low |
| [5 — Folding-flap wall cabinets with glass fronts the library cannot calculate](library-issues.md#5-folding-flap-wall-cabinets-with-glass-fronts-the-library-cannot-calculate) | HOMAG library: the flap wall cabinets' descs name the front programs their flap takes | low |
| [6 — Articles with two doors that do not say how their doors stand](library-issues.md#6-articles-with-two-doors-that-do-not-say-how-their-doors-stand) | HOMAG library: the articles with two doors say one above the other or side by side; `LeftLeft`, `RightRight` and the desc of `14` | low |
| [7 — Tall-unit descriptions omit width-dependent door arrangements](library-issues.md#7-tall-unit-descriptions-omit-width-dependent-door-arrangements) | HOMAG library: add the shared Door direction resize guidance; resolve the library bug of issue 9 on a tall unit | medium |
| [8 — Base units narrowed to 150 mm the library cannot calculate](library-issues.md#8-base-units-narrowed-to-150-mm-the-library-cannot-calculate) | HOMAG library bug: calculate the base units at every width `mod_Width` accepts, or declare their widths as its verified range; then the desc of `mod_Width` names them | low |
| [9 — Wall units resized with a fixed door direction the library cannot calculate](library-issues.md#9-wall-units-resized-with-a-fixed-door-direction-the-library-cannot-calculate) | HOMAG library bug: change the door direction with a width that changes the door arrangement, or rule the direction of the other arrangement out in the verified options; then the descs name the widths | low |
| [10 — Backsplashes the library cannot calculate](library-issues.md#10-backsplashes-the-library-cannot-calculate) | HOMAG library or roomle-ui (not established): replay the check that built the backsplash on 2026-10-18; then the backsplash's grain-direction lookup in the library, or the planner fix | low |
| [11 — A handle strip the library cannot calculate](library-issues.md#11-a-handle-strip-the-library-cannot-calculate) | HOMAG library: the handle position a handle strip takes in the desc of the handle design, or set with the strip; which front programs, handle colours and lengths each handle design takes; report the JSON parse error of the base units | low |
| [12 — A worktop on the tall units from the group's countertop switch](library-issues.md#12-a-worktop-on-the-tall-units-from-the-groups-countertop-switch) | HOMAG library: the desc of `mod_CreateCountertop` says that set on the group it reaches the tall units too | low |
| [13 — A drawer sideboard lowered to 720 mm the library cannot calculate](library-issues.md#13-a-drawer-sideboard-lowered-to-720-mm-the-library-cannot-calculate) | HOMAG library bug: calculate the drawer sideboard at every height `mod_Height` accepts, or declare the heights it takes as its verified range | low |
| [15 — The shelf descriptor names no format](library-issues.md#15-the-shelf-descriptor-names-no-format) | HOMAG library: the desc of `mod_ShelfadjDescriptor` names the format of the position and quantity of the adjustable shelves, with an example | low |
| [16 — A built-in microwave selected on the tall oven housing is not built](library-issues.md#16-a-built-in-microwave-selected-on-the-tall-oven-housing-is-not-built) | HOMAG library: build the second appliance in the equipment niche of `HOTS2AB60`, or rule the microwave out of `mod_OvenId2` on the single-niche units | medium |
| [17 — A Bora hob on the base hob cabinet UKS2A90 the library cannot calculate](library-issues.md#17-a-bora-hob-on-the-base-hob-cabinet-uks2a90-the-library-cannot-calculate) | HOMAG library bug: an entry in `tab_DrawerBoxDimensionMapping` for the drawer boxes of `UKS2A90` under a Bora hob, or the hob ruled out for the unit | low |
| [18 — A wide paired-door wall cabinet with a push opening the library cannot calculate](library-issues.md#18-a-wide-paired-door-wall-cabinet-with-a-push-opening-the-library-cannot-calculate) | HOMAG library: calculate accepted width/height/opening combinations or expose the supported combinations through verified options before the hinge lookup | low |
| [19 — A traditional front program with a retained plain colour the library cannot calculate](library-issues.md#19-a-traditional-front-program-with-a-retained-plain-colour-the-library-cannot-calculate) | HOMAG library: resolve the colour conflict when selecting Tradition; apply the program/colour sequencing desc in suggested library changes 2.2 | medium |
| [20 — A push-to-open sink unit without the front gap it needs the library cannot calculate](library-issues.md#20-a-push-to-open-sink-unit-without-the-front-gap-it-needs-the-library-cannot-calculate) | HOMAG library bug: set the front gap a push opening needs with `mod_OpeningType`, or rule the opening out in the verified options of the units whose gap is too small | low |

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
| 1 — A dark worktop renders white under the top light | roomle-ui renderer: the top light overexposes the tabletop depending on the line of sight, so black appears white; render it in its material colour from every line of sight | [roomle-ui-issues.md, 1](roomle-ui-issues.md#1-a-dark-worktop-renders-white-under-the-top-light) |
| 2 — The water connection is an installation element only through a planner override | Rubens Admin: set level 28 on the wall water connection items; then remove the `water_connections` level override in roomle-ui `planner-kernel-access.ts` | [roomle-ui-issues.md, 2](roomle-ui-issues.md#2-the-water-connection-is-an-installation-element-only-through-a-planner-override) |
| Caching the library context | roomle-ui planner: keep the compacted library context (`createLibraryContext`, `hi-library-context.ts`) from `addLibrary` / `loadPosData` until the next catalog load — only when a measurement shows that compacting the catalog on every call costs | not measured; ADR 0013 of roomle-ui |

## Chat

| Item | To do | Details |
|---|---|---|
| Strict tool schemas for the GPT models | Measure how often a GPT model's tool call fails the schema ("Input validation error") in a "test the mcp" session; only if it costs runs, try strict function calling: set `strict` per tool in the tool set of the embedding-lib (the Azure provider sends `strict: false` otherwise). The Azure strict subset needs every field required, `additionalProperties: false` on every object, at most five nesting levels and 100 properties, and no parallel tool calls: the MCP tool schemas with optional fields do not meet it, and a change there reaches every client | [Structured outputs on Azure](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) |
| Paste and pick an image in the chat window | An image reaches the chat only by drop, which the keyboard cannot reach. Add paste from the clipboard and a file picker button to the AI Planning Assistant window, both through `prepareImage` (roomle-ui `PlanningAssistantChat.vue`, `src/common/utils/planning-assistant-image.ts`) | [Images in the chat](../../docs/ai-chat.md#images-in-the-chat) |
| Per-tool status in the chat window | The planning assistant of the embedding-lib passes only the tool name of a call to the window, as an `activity` part. Pass each tool call's input and result as well (roomle-ui `hi-planning-assistant.ts`), and give the window a part that shows them | [The chat window](../../docs/ai-chat.md#the-chat-window) |
| Images of a tool result for Mistral | `@ai-sdk/mistral` writes the images of `get-plan-images` into the tool result as JSON text: a Mistral model gets about 0.2 MB of base64 text instead of two images, a large part of its context. Move them into a user message for Mistral models in the planning assistant of the embedding-lib (roomle-ui `hi-planning-assistant.ts`, a `wrapLanguageModel` middleware) | [Images in tool results](../../docs/ai-chat.md#images-in-tool-results) |
| [The skills of a turn selected by a small model before the first call](planning-assistant-skill-selector.md) | Later, with the choice of the models: a small model names the skills of a request before the first model call and the planning assistant supplies them, so the create comes at call 1 — 1–3 s of a creation on the evidence of the session of 2026-10-27 and benchmark 06, for a second model with its config in every host; needs the plan state supplied per turn, which is a step of its own | [the analysis of G](../feature-analysis/planning-assistant-skill-selector.md) while it is open |
| A step log for the benchmark | The planning assistant of the embedding-lib logs no steps, so the runs of the example carry no tokens and durations per step, and `benchmark-hi-mcp-runs.js` reads only runs made with the former chat backend. Log every step to the page console (tokens in, out and reasoning, tool calls, duration) in the format the benchmark reads | [hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md#1-the-runs) |

## Test infrastructure

Details: [mcp-test-infrastructure-issues.md](mcp-test-infrastructure-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — The object-only perspective render draws an empty frame under software GL](mcp-test-infrastructure-issues.md#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | roomle-ui: find why the frame is dropped under SwiftShader | low |

