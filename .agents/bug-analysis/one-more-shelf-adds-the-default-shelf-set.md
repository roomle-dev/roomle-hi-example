# "One more shelf" adds the shelf set the cabinet already shows

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` (`011ebc3`); roomle-ui `feat/hi-mcp` (`4b1460c0c`)
> **Backlog**: [mcp-issues.md #96](../backlog/mcp-issues.md#96-one-more-shelf-adds-the-shelf-set-the-cabinet-already-shows)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`) — `hi-interior-design.ts`:
  - Discovery (`interiorOptions`) names the interior a parent module shows of its own while no
    fitting fills its container.
  - The interior commands (`stageInteriorEdit`) name that interior in their corrections when an
    edit replaces it or brings it back.
  - The `get-interior-design-options` description (`hi-mcp-server.ts`) names the new field in one
    clause.
  - Unit tests are in `__tests__/hi-interior-design-test.ts` and `__tests__/hi-mcp/hi-mcp-server-test.ts`.
  - A decision beside D96 and a correction beside C26–C28 go into
    `.agents/homag-intelligence/hi-tools-behaviour.md`, the field into `hi-tools-reference.md`.
  - `glue-logic.ts` stays unchanged: its `getInteriorDesignOptions` and `editInterior` delegate to
    `hi-interior-design.ts`.
- **roomle-hi-example** — this analysis, backlog item 96, the discovery fields in
  `.agents/skills/hi-mcp-tools.md`, the `expect` of `edit-add-subarticle-look-inside` in
  `docs/test-prompts.json`, and two library issues in `.agents/backlog/library-issues.md` with their
  texts in `docs/library-information/suggested-library-changes.md`.
- **Furniture_Smith library data** — two desc texts, see [Library data](#library-data).
- **embedding-lib, ligna-store** — unchanged. `createHiMcpTools` forwards the results as they are,
  so no new embedding-lib version is needed.

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/` unless they
start with `__tests__/` or `.agents/`. The D- and C-numbers are those of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## Result

The cabinet is not empty. While no fitting fills its container, its door module renders four
adjustable shelves of its own: the library's default interior. The tools show the agent only the
fittings, the sub-article modules. Discovery and the plan context therefore present the cabinet as
empty and offer `AdjShelves` as an addition.

Every fitting added into the container takes the place of the default interior:

- `AdjShelves` renders the same four shelves.
- `FixedShelf` leaves one shelf where there were four.
- An inner drawer removes all four.

The add's result names only the added fitting. The agent reports a shelf the user does not see.
Deleting the last fitting brings the four shelves back, again without a word.

## Symptom (as recorded)

`mcp-test-2026-10-22_19-45-49`, gpt-6-astra 41 (`edit-add-subarticle-look-inside`, bo-test
`205cc9bc8`, plan `three-tall-units`, `ps_s3p5hmscmmsnshopj2tybjwmt7ijy5o`):

- **Prompt:** "add one more shelf inside the middle cabinet and show me the inside of the cabinet".
- **Tool calls:** `get-plan-context` → `get-interior-design-options` (`groupId`, `rootId` of the
  middle unit `a7271f1b`) → `add-interior-fitting` of `AdjShelves` into the door module `5b581d05`
  → `open-or-close-article` → `get-plan-images`.
- **Answer:** "Added the catalog's Adjustable Shelves fitting inside the middle cabinet at its default
  position."
- **Plan:** `plan.xml` holds 12 `part_ShelfadjWood`, four per cabinet — as many as in the unedited
  plan of run 08. In 08 the four shelves of the middle cabinet are parts of the door module
  `mf_Door`. In 41 the door module has none, and the new fitting `me_ShelfadjMultiple01` carries the
  same four.

The runs do not record what `get-interior-design-options` returned.

## Reproduction

Model-free replay on the deployed bo-test planner (`release/bo-test` `1d9adf51e`), which runs the
same `hi-interior-design.ts` as `feat/hi-mcp` apart from one error message. The scripts and their
output are in `.temp/result/repro-one-more-shelf-2026-10-24/`:

- `replay.mjs` — discovery, then every offered article added and undone.
- `sequence.mjs` — `FixedShelf`, then `AdjShelves`.
- `delete.mjs` — `FixedShelf` added, then deleted.
- `descriptor.mjs` — `mod_ShelfadjDescriptor` on the door module.

Each script loads the run's plan. "Door renders" counts the door module's own visible parts.

| Step | Door renders | Fitting renders | The tool says |
|---|---|---|---|
| Start | 4 `part_ShelfadjWood`, 16 `part_ShelfadjFitting`; its container holds the placeholder | — | discovery: `status: available`, `fittings: []`, 12 `articles`, each with the door's container as its one destination |
| Add `AdjShelves` | no shelves; no container left | 4 `part_ShelfadjWood`, 16 `part_ShelfadjFitting` | `changed: true`, one `addedInstanceIds`, `removedInstanceIds: []`, no correction; discovery after it: the fitting with 12 `replacementArticles`, `articles: []` |
| Add `FixedShelf` | no shelves; a new placeholder | 1 `part_Shelffixed` | as above |
| Add `InnerDrawer` | no shelves | two inner drawers | as above |
| Add any of the other nine (`Hanger`, `JewelleryDrawer`, `PulloutMirror_l`, `PulloutMirror_r`, `TieRack_l`, `TieRack_r`, `TrouserRack`, `VertDivider`, `WardrobeLift`) | no shelves | its own parts | as above |
| `FixedShelf`, then `AdjShelves` into the new placeholder | — | — | error "The library could not calculate the edited interior." |
| `FixedShelf`, then `delete-interior-fittings` of it | 4 `part_ShelfadjWood`, 16 `part_ShelfadjFitting` again | — | `changed: true`, the fitting in `removedInstanceIds`, nothing about the shelves |
| `change-module-attribute` `mod_ShelfadjDescriptor` on `mf_Door`: `5`, `5x`, `5*`, `1;2;3;4;5` | no shelves | — | `changed`, no correction |

Each edit was undone before the next. After the last undo the cabinet renders its four shelves
again.

## Investigation

### What the library builds

The middle unit `HTB60` is `mr_StorageunitSingle` with the door module `mf_Door`. The door module
holds one container, `md_EquipmentPlaceholder`, the drop container of the fittings. While the
container holds no fitting, the door module renders four adjustable shelves of its own. A fitting in
the container takes their place. Deleting the last fitting brings them back. `AdjShelves` fills the
whole compartment: after it, the door module has no container, and discovery offers no addition.
The library spaces its shelves over the free height. The fitting carries no input attribute, so
nothing sets their number.

This is how the library is built, and the MCP deals with it as it is. The cabinet does not carry
`mod_RackAreaType`, which the backlog item names.

### What the agent reads

1. **`get-plan-context` groups.** The middle root carries `interiorFittings: []`. Its `subModules`
   list `mf_Door` with `mod_FrontHeightSelection` only. Its desc reads "Tall cabinet, 60 cm wide,
   with 1 door and adjustable shelves." That sentence is the agent's only hint that shelves exist,
   and it does not say how many there are or that they are the `AdjShelves` set.
2. **`get-interior-design-options`.** It returns `fittings: []` and 12 additions into the door's
   container. The desc of `AdjShelves` reads "Adjustable interior shelves." / "Add height-adjustable
   shelf levels inside a cabinet." / "Select to add adjustable shelves inside a cabinet."
3. **`add-interior-fitting`.** It returns `changed: true`, the new instance, `removedInstanceIds: []`
   and no correction.

The answer repeats what the result says. The turn's image shows the open cabinet with four shelves,
but the model had no earlier view to compare it with.

### Where the tools lose the default interior

- **`interiorFittings` (`hi-interior-design.ts:185-188`)** lists the modules below a parent that
  carry `articleInfo.articleId`: the sub-articles. Parts that a parent module renders itself are no
  fitting. Both the plan context (`hi-plan-context.ts:756`) and discovery build on this list.
- **`interiorOptions` (`hi-interior-design.ts:224-311`)** asks the library for the compatible
  articles and their destinations (`compatibleArticles`, `:313`). It stages a calculation for the
  replacement candidates of an installed fitting (`:267-277`), but never for an addition. It
  therefore never learns what an addition does to the parent.
- **`stageInteriorEdit` (`hi-interior-design.ts:435`)** measures an edit by fittings:
  `addedInstanceIds` and `removedInstanceIds` (`:740-746`) compare `interiorFittings` before and
  after the edit. The four shelves that the door module stops rendering are no fitting, so
  `removedInstanceIds` stays empty and no correction names them. The same holds when a delete brings
  them back.
- **The served text.** The `get-interior-design-options` description (`hi-mcp-server.ts:223`) speaks
  of installed fittings, additions and replacements. The rule of the system prompt
  (`hi-agent-prompts.ts:15`) says "report only confirmed changes", and the result confirmed one.
  Neither mentions an interior that a parent shows of its own.

## Root cause

The interior the tools show the agent is the tree of sub-article modules: `interiorFittings`
(`hi-interior-design.ts:185-188`). The interior the library renders also includes the parts that a
parent module generates itself while no fitting fills its container. Discovery (`interiorOptions`,
`:224`) and the plan context (`hi-plan-context.ts:756`) therefore present a cabinet with four
adjustable shelves as empty and offer `AdjShelves` as an addition.

The interior commands measure an edit by the same fittings (`stageInteriorEdit`, `:740-746`). So
none of these edits is reported:

- an addition that replaces the default interior with the same shelves;
- an addition that replaces it with one shelf instead of four;
- a delete that brings it back.

The agent picked the article whose desc says "add adjustable shelves" for a cabinet the tools showed
as empty. It then reported the result the tool returned. The tool API hides what the agent needs.

## Proposed fix

The fix takes step 2 and step 3 of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
the server derives what the agent cannot see, and it names what an edit did. It adds no guard. Adding
a fitting that replaces the default interior is legitimate, and the server cannot tell such a
request from a mistake.

1. **Discovery names the default interior.**
   - For each parent that a scoped destination names, `interiorOptions` stages one addition on a
     copy, with the first article that lists the destination: `applySubArticleChange` and
     `library.calculateGroup`, the staging the replacement candidates use (`:267-277`).
   - It then compares the parent's own visible parts before and after: the `parts` of the parent
     module, not those of its fittings or containers. The parts the addition removes are the
     parent's default interior.
   - The result gets `defaultInteriors`, one entry per parent that has one:
     `{ rootId, parentModuleId, parts }`. `parts` maps each part name to its count. For the middle
     cabinet that is `{ "part_ShelfadjWood": 4, "part_ShelfadjFitting": 16 }`.
   - Part names are library data, like article and attribute ids. The tools name none of their own,
     so the field is library-neutral (§2.4).
2. **The interior commands name what they replace and what they bring back.**
   - `stageInteriorEdit` compares the own visible parts of every module of the edited group that is
     not a fitting, between `original` and the calculated `working` group.
   - It adds one correction per module that lost parts or got them back. Lost parts: "The library
     replaced what parent '5b581d05' shows by default (part_ShelfadjWood ×4, part_ShelfadjFitting
     ×16) with fitting '533c0545' (AdjShelves)."
   - When the root renders the same visible parts as before the edit, that sentence ends with
     " - the cabinet shows the same parts as before."
   - Parts brought back: "Parent '5b581d05' shows its default interior again (part_ShelfadjWood ×4,
     part_ShelfadjFitting ×16)."
3. **The served text names the field in one clause.** The `get-interior-design-options` description
   adds: "defaultInteriors lists what a parent shows while no fitting fills its container; an
   addition there takes its place." The corrections need no announcement.

The cost is one staged addition and one calculation per parent in the scope, the same as one
replacement candidate. The run's discovery took 14 ms; the implementation measures it on the
`three-tall-units` plan.

### What the agent can do for "one more shelf"

With the fix, the agent sees four adjustable shelves and that any addition replaces them. Through the
tools, the library offers no fifth adjustable shelf:

- The library calculates the number of shelves in the set.
- A fixed shelf beside the set fails the calculation.
- The descriptor has no documented format.

Two honest outcomes remain:

- The agent tells the user that the cabinet already holds four adjustable shelves, which the library
  spaces itself.
- The agent replaces them with five `FixedShelf` fittings. This is not verified for this cabinet.
  Several fixed shelves in one parent work in the wardrobe of `edit-add-subarticle`.

The test's `expect` changes accordingly — see [Open question](#open-question).

### Library data

What the agent lacks about the articles goes into the library data. Two library issues with
suggested texts:

- **`AdjShelves`** — the desc does not say three things: that this set is the shelving a cabinet
  described "with adjustable shelves" already shows, that the set fills its compartment, and that
  the library spaces its shelves over the height. A suggested `AI_SELECTION_HINT`: "Cabinets
  described with adjustable shelves already show this set; select it for a compartment that shows
  no shelves."
- **`mod_ShelfadjDescriptor`** — the desc "Position and quantity of the adjustable shelf via
  descriptor" names no format. Four plausible values removed every shelf, without an error or a log
  message. The desc should give the format, so that the number of adjustable shelves can be set.

### Alternatives considered

- **A served rule that a cabinet with adjustable shelves already shows them** — rejected. It is
  library content (§2.4), and the agent would still not see the count.
- **The default interior as an entry of `fittings` or `interiorFittings`** — rejected. It has no
  instance id, so the fitting tools cannot address it. The plan context would also need a staged
  calculation per container, but it stays compact and calculates no choices (D96).
- **Naming the article that renders the default interior** — rejected for now. It needs a staged
  calculation per article and parent (12 for this cabinet). The part names already say what the
  parent shows, and the correction says when an addition renders the same parts.
- **A guard that refuses an addition rendering the same parts** — rejected. It is a guard
  ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)), and the server cannot tell
  that request from a mistake.
- **A library method that returns the default interior** — rejected. A library API change is no
  valid fix ([the analysis skill](../skills/hi-analysis.md)).

## Tests

- `__tests__/hi-interior-design-test.ts`. The fixture gets a parent that renders parts of its own
  while its container holds no fitting. The mock's `addSubArticle` removes those parts, and its
  `deleteSubArticle` of the last fitting restores them. The tests:
  - Discovery lists that parent in `defaultInteriors` with the part counts.
  - A parent without own interior parts gets no entry, and a scoped discovery lists the scoped
    root's parents only.
  - Discovery leaves the group unchanged.
  - An addition that replaces the default interior names it in a correction. An addition that renders
    the same parts ends with "the cabinet shows the same parts as before".
  - A delete of the last fitting names the default interior that came back.
  - The existing tests keep their corrections.
- `__tests__/hi-mcp/hi-mcp-server-test.ts`: the `get-interior-design-options` description names
  `defaultInteriors`.
- Model acceptance: `edit-add-subarticle-look-inside`. It runs only on request, on a planner that
  carries the change (bo-test after deployment, or the local roomle-ui with `--dev`).

## Open question

The `expect` of `edit-add-subarticle-look-inside` asks for "one add-interior-fitting of a compatible
shelf article" and "the added shelf". The library offers no fifth adjustable shelf, so that
expectation cannot be met as written. Which outcome passes?

1. The answer says that the cabinet already holds four adjustable shelves, which the library
   spaces itself, and no fitting is added. This is the proposal.
2. Also the four adjustable shelves replaced by five fixed shelves, said in the answer.
