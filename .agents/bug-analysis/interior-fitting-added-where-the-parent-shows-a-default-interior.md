# Bug analysis — an interior fitting added where the parent shows a default interior

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-28
> **Base**: roomle-hi-example `master` (`4f7e088`); roomle-ui `feat/hi-mcp-performance` (`697f8101d`)
> **Backlog**: item 115 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-performance`) — the fix: the descriptions of
  `get-interior-design-options` and `add-interior-fitting` in `hi-mcp/hi-mcp-server.ts`, their test
  in `__tests__/hi-mcp/hi-mcp-server-test.ts`, and the wording of D114 and the Interior Design tools
  section of `.agents/homag-intelligence/hi-tools-behaviour.md`, of `hi-tools-reference.md` and of
  `.agents/homag-intelligence.md`. No logic change: `hi-interior-design.ts` computes the right
  `defaultInteriors` and the right correction.
- **roomle-hi-example** — the `expect` of `edit-add-subarticle-look-inside` in
  `docs/test-prompts.json`, the wording in `.agents/skills/hi-mcp-tools.md`, backlog item 115 and
  this analysis.
- **embedding-lib** — no build. The tool descriptions come from the planner
  (`getExternalObjectAgentTools`); `createHiMcpTools` forwards them unchanged.

## Symptom

Prompt of `edit-add-subarticle-look-inside` (plan `three-tall-units`,
`ps_s3p5hmscmmsnshopj2tybjwmt7ijy5o`): "add one more shelf inside the middle cabinet and show me the
inside of the cabinet. Decide any open details yourself instead of asking."

The middle `HTB60` (`a7271f1b`) holds no fitting. Its door module `mf_Door` (`5b581d05`) renders
four adjustable shelves of its own. gpt-6-astra (provider default effort) makes these calls:

| # | Call | Result |
|---|---|---|
| 1–2 | `get-plan-context` (articles, attributes; rooms, groups, obstacles, installation elements) | — |
| 3 | `get-interior-design-options` `{ groupId, rootId: a7271f1b }` | `fittings: []`, `defaultInteriors: [{ parentModuleId: 5b581d05, parts: { part_ShelfadjWood: 4, part_ShelfadjFitting: 16 } }]`, twelve articles, each with one destination in parent `5b581d05` |
| 4 | `add-interior-fitting` `FixedShelf` into parent `5b581d05` | `changed`, correction: "The library replaced what parent '5b581d05-…' (mf_Door) shows by default (part_ShelfadjWood ×4, part_ShelfadjFitting ×16) with fitting '79408abd-…' (FixedShelf)." |
| 5 | `undo` | the four shelves are back |
| 6–7 | `open-or-close-article`, `get-plan-images` | — |

Answer: "The available fixed-shelf insert replaced its four existing shelves rather than adding a
fifth, so I undid that change to preserve them. The extra shelf has **not** been added."

The final plan and the answer are right. The defect is calls 4 and 5: an addition the agent could
have ruled out from call 3, and its undo: two calls of seven.

**Reproduce.** `mcp-test-2026-10-27_07-11-41` and `mcp-test-2026-10-25_18-06-08`, gpt-6-astra,
test 41: both runs make the same `FixedShelf` add and `undo`. Both ran with D114 in effect (roomle-ui
`0b681db1d`, on `release/bo-test`). The run of `mcp-test-2026-10-22_19-45-49`, before D114, added
`AdjShelves`, the set the cabinet already shows. Runs of other models of this test are not in
`.temp/result/`.

## Investigation trace

### What the agent read before the addition

The backlog item said that the agent reads `defaultInteriors` only after the addition, from its
correction. The run shows otherwise: call 3 precedes the addition. A model-free replay on bo-test
(`.temp/result/default-interior-probe-2026-10-28/probe.mjs`, `results.json`) of call 3 on the same
plan returns:

```json
"fittings": [],
"defaultInteriors": [{ "rootId": "a7271f1b-…", "parentModuleId": "5b581d05-…",
                       "parts": { "part_ShelfadjWood": 4, "part_ShelfadjFitting": 16 } }],
"articles": [{ "articleId": "AdjShelves", "destinations": [{ …, "parentModuleId": "5b581d05-…" }] },
             …, { "articleId": "FixedShelf", "destinations": [{ …, "parentModuleId": "5b581d05-…" }] }, …]
```

`hi-interior-design.ts` on bo-test and on `feat/hi-mcp-performance` is identical, and so are the
interior tool descriptions. The agent therefore had the entry, and every destination it could
choose was in the parent the entry names.

### Where the entry comes from — correct

- `defaultInteriors` (`hi-interior-design.ts:299`) stages one addition per parent on a copy and
  lists the parent's own visible parts the addition removes (`visibleParts`, `:233`; the hosts,
  `:272`). It is assembled into the result at `:487`, as an array of its own beside `articles`
  (`HiInteriorDesignOptions`, `:54`).
- `defaultInteriorChanges` (`:354`, called at `:984`) compares the parent's own parts before and
  after a changed edit and writes the correction of C34.

Both work: the entry and the correction name the same four shelves.

### How the library behaves — checked model-free on bo-test

`.temp/result/default-interior-probe-2026-10-28/probe-combos.mjs`, `combos.json`, on the same
plan:

| Edit into parent `5b581d05` | Result |
|---|---|
| `FixedShelf` | the four shelves are replaced; the cabinet holds one fixed shelf at the bottom (`position` `[19, 533, 19.5]`) |
| a second `FixedShelf`, into the container discovery offers after the first | "The library could not calculate the edited interior - nothing was changed." |
| `AdjShelves` | the four shelves are replaced by the same four ("the cabinet shows the same parts as before"); discovery then offers no addition |
| `JewelleryDrawer` | the four shelves are replaced |

Every addition into the parent replaces all four shelves, whatever article it is. No fitting and no
combination of fittings gives the cabinet a fifth shelf, and the number of adjustable shelves has
no input ([library issue 15](../backlog/library-issues.md#15-the-shelf-descriptor-names-no-format)).
"One more shelf" cannot be met in this cabinet. The right outcome is the answer the agent gave in
the end, without the add and the undo.

The second `FixedShelf` matches library issue 15 ("A `FixedShelf` followed by `AdjShelves` in the
container left beside it fails the calculation"): the container the library offers beside a fixed
shelf takes no fitting that calculates.

### What the served text tells the agent

`get-interior-design-options` (`hi-mcp-server.ts:228`):

> defaultInteriors lists what a parent shows of its own while no fitting fills its container; an
> addition there takes its place.

`add-interior-fitting` (`hi-mcp-server.ts:243`):

> Add a compatible Interior Design fitting inside a group, using an article and destination
> returned by get-interior-design-options. Waits for final calculation/load and returns actual
> instance IDs, placement and corrections. One undoable action when changed.

The library descs the agent weighs (from the replay):

- `AdjShelves`: "Set of height-adjustable interior shelves that fills a compartment … A cabinet
  described with adjustable shelves already shows this set; adding it there changes nothing."
- `FixedShelf`: "Adds a permanently positioned shelf level inside a cabinet. … Select to add a
  fixed shelf inside a cabinet."

The step after call 3 has 13 reasoning tokens and picks `FixedShelf`. The agent rules out
`AdjShelves` from its desc and takes the article that "adds a shelf level".

## Root cause

The served text states the replacement as an abstract property of a result field of the discovery
tool, in words that suggest it applies only to some fittings, and the tool that makes the addition
says nothing about it.

1. **"while no fitting fills its container"** (`hi-mcp-server.ts:228`). "Fills" reads as a fitting
   that takes the whole compartment — the word the `AdjShelves` desc uses for itself ("fills a
   compartment"). A single shelf level does not read as filling the container, so the clause lets
   the agent expect the default interior to stay beside a `FixedShelf`. The library replaces it on
   any addition.
2. **"an addition there takes its place"** (`hi-mcp-server.ts:228`). "There" and "its" have to be
   resolved, and "takes its place" does not say that all the listed parts go. The correction after
   the edit says the same thing as an event — "The library replaced what parent … shows by default
   (part_ShelfadjWood ×4 …) with fitting …" — and the agent understands it at once.
3. **The add has no word of it** (`hi-mcp-server.ts:243`). The agent decides at the add. Its
   description says "Add a compatible … fitting" and nothing about a parent listed in
   `defaultInteriors`. To see the replacement, the agent has to match `defaultInteriors[].parentModuleId`
   with `articles[].destinations[].parentModuleId` itself and recall a clause of another tool's
   description. D51 asks for what happens to be specified "in the tool description before the call
   and in the result after it"; the result says it, the description of the add does not.

The information is right and in time. Its wording and its place mislead the agent. This is the
first step of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): clarify the
instruction.

## Why the current code produces the wrong result

The agent wants one more shelf. It reads that the parent shows four shelves, that `AdjShelves`
changes nothing, and that `FixedShelf` adds a shelf level. The one served sentence against the
addition speaks of a fitting that fills the container and of an addition that "takes its place". It
does not say that any fitting into that parent removes all four shelves. So the agent adds and
learns from the correction. The C34 correction works as designed (step 3 of the guard rule:
correct-and-inform after the fact). It cannot spare the call and the undo.

## Proposed fix

**Served text, roomle-ui `hi-mcp-server.ts`.** Say the replacement plainly, for every fitting,
where the agent adds:

| Description | Today | Proposed |
|---|---|---|
| `get-interior-design-options` (`:228`) | "defaultInteriors lists what a parent shows of its own while no fitting fills its container; an addition there takes its place." | "defaultInteriors lists the parts a parent shows of its own while its container holds no fitting; any fitting added to that parent replaces all of them." |
| `add-interior-fitting` (`:243`) | — | append: "A fitting added to a parent listed in defaultInteriors replaces all the parts listed there; it does not add to them." |

Both sentences say what happens, not what to do or what is refused (D51, §2.4). Neither names an
article or a part of one library. The added sentence only applies to a parent listed in
`defaultInteriors`. An add into a parent discovery lists no default interior for — the wardrobe
adds of `edit-add-subarticle` are the ones to watch — reads the same as now.

**Test, roomle-ui `__tests__/hi-mcp/hi-mcp-server-test.ts:693-703`.** The existing test checks the
discovery clause. It checks the new clause and the add sentence instead:
`it('tells the agent that any fitting added to a parent replaces the interior it shows of its own')`.

**Documentation.**

- roomle-ui `hi-tools-behaviour.md`, D114: "The served text names the field in one clause of the
  `get-interior-design-options` description" becomes the two sentences above. The new rejected
  alternatives are listed below. The Interior Design tools section and `hi-tools-reference.md:676`
  replace "while no fitting fills its container" with "while its container holds no fitting", and so
  does `homag-intelligence.md:449`.
- roomle-hi-example `.agents/skills/hi-mcp-tools.md:606`: the same wording.
- roomle-hi-example `docs/test-prompts.json`, `edit-add-subarticle-look-inside`: "no
  add-interior-fitting replaces them with the same AdjShelves set" becomes "no add-interior-fitting
  into the door of the middle unit — any fitting added there replaces the four shelves". This is
  the backlog item's test, and the `FixedShelf` add then fails the test instead of passing it.

**Verification.** Unit tests, `npm run lint`. Then, on the build that carries the change (the
descriptions come from the planner: the `--dev` page on `feat/hi-mcp-performance`), the test
`edit-add-subarticle-look-inside` and its neighbours `edit-add-subarticle` and
`edit-add-move-delete-subarticle` with gpt-6-astra, gpt-5.4-mini and mistral-medium, two to three
runs each. They must show no `add-interior-fitting` and no `undo` in the tall unit, the answer
naming the four shelves, and the wardrobe adds unchanged.

### Alternatives considered

- **Mark each destination whose parent shows a default interior** (step 2, simplify the API: no
  join of the two arrays). Rejected for now: the entry is per parent, while the destinations repeat
  per article — twelve copies of the same parts in this cabinet. D114 rejected per-article staging
  for the same reason. If the runs with the clarified text still show the add, this is the next
  step.
- **Refuse or skip an addition into a parent with a default interior.** Rejected in D114: the
  server cannot tell the request from a mistake — a user may want a drawer in place of the shelves
  (§2.2).
- **A sentence in the system prompt of the chat** (`hi-agent-prompts.ts:17`). Rejected: the served
  text lives in `hi-mcp-server.ts` (§2.4, one source). The system prompt names the tools and the
  order only.
- **The `FixedShelf` desc says it replaces adjustable shelves.** Rejected: the replacement holds for
  every fitting in a parent of every library (D114). It is tool behaviour the served text carries,
  not the content of one article. The desc of `AdjShelves` already says what the cabinet shows.
- **Keep the discovery clause and only add the sentence at the add.** Rejected: "fills its
  container" stays misleading in discovery, where the agent plans the edit.
