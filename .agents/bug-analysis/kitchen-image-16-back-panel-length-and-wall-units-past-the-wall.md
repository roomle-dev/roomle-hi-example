# Kitchen Image 16: the Back Panel at Its Own Length, the Wall Units Past the Window Wall

> **Type**: Bug Analysis  
> **Status**: Open  
> **Date**: 2026-10-31  
> **Ticket**: [RML-18346](https://roomle.atlassian.net/browse/RML-18346)  
> **Base**: roomle-ui `release/bo-test` (`cbf9b7b01`, the head of `feat/hi-mcp-performance`), the
> planner the example page loads; roomle-hi-example `master` (`bb460ac`); embedding-lib
> `0.0.0-dev-4c2797a`

## Affected Repositories

- **roomle-ui** (`packages/web-sdk/packages/homag-intelligence`) — the article catalog of
  `get-plan-context` (`compactArticle` in `src/hi-plan-context.ts`), the root override check of
  `create-or-replace-groups` (`checkRootOverrides` in `src/hi-tool-attributes.ts`) and the
  image-planning skill (`src/hi-mcp/skills/image-planning/SKILL.md`), with unit tests, the served-text
  fixture and the rows of `.agents/homag-intelligence/hi-tools-behaviour.md`. The tools run in the
  planner: the example page and the ligna-store get the fix with the bo-test deployment. No
  embedding-lib build is needed.
- **HOMAG library** (Furniture_Smith) — the desc of the island back panel `RWV` names no peninsula
  and no length attribute (library issue 23). Nothing new to change there.
- **roomle-hi-example** — this analysis; library issue 23 names it.
- ligna-store — unchanged. It loads the planner from bo-test.

## 1. Symptom

[Kitchen image 16](../../docs/images/kitchen-16.png) planned with the Planning Assistant of the
example page, the image alone, on the default room, after the fix of the earlier analysis of this
ticket (roomle-ui `5c48680b9` and `cbf9b7b01`, deployed on bo-test). The first attempt is wrong in
two places, and the agent needs a long time to correct it. Both plan snapshots hold one group
(`943fe12e…`), the second the same group changed in place. Loaded without a model on the example page
([the snapshots](#7-evidence)):

| Snapshot | What the user sees | What the group holds |
|---|---|---|
| First attempt `ps_te9oafs8ndawti6379315zpwhf1slpx` | The back panel of the peninsula covers one unit; the other two peninsula units show their legs. The wall units run over the corner into the window wall | `RWV` with `mod_Color`, `mod_Depth` 200, `mod_Height` 870, `mod_PaneltopColor` and **no length attribute**: its outline is 1030 mm long (x 61 to 1091) while the peninsula's back runs 1800 mm (x −424 to 1376). Four `OTB60` wall units of 600 mm along the left wall, the first `above` the front `UTB60` of the leg (y 1904 to 2504), the next ones toward the back wall: the fourth hangs at y 3704 to 4304 — the inner face of the back wall is y 3765, so it reaches **539 mm past the wall**, through the window (x −450 to 1650, 950 to 2170 mm) |
| Final `ps_te9s5i2rbyj8y577e4kmsils9p4u7j5` | The kitchen of the image; the wall units stand clear of the back wall and reach over the peninsula's corner | `RWV` with `mod_IslandBackwallWidth` 2031 and `mod_Depth` 250: 2061 mm long (x −670 to 1391), the whole back closed. Four `OTB45` wall units of 450 mm, two with an `ORFB60` open shelf unit under them, hung `above` the back `UTB60` of the leg at its front edge and chained toward the front: y 1154 to 2954. The 811 mm from there to the back wall, above the corner article, are empty, and the front unit hangs 89 mm past the peninsula's corner unit (y 1243). In the image the row ends at the back wall |

The user's question: is the back panel's length a matter of the article's description, and is it
hard for the agent to set or change the size? The answer of this analysis: the agent sets the
length with the attribute the tools' own catalog names for the panel, and that attribute is the wrong
one; changing the size is one call once the agent knows the right attribute. The wall units are an
error of the agent's count that neither the instructions nor the result name.

## 2. Reproduction

No new model run was made: the six runs of 2026-10-30 on this build (`repro-kitchen-16-2026-10-30`,
`final-dev-1` to `final-dev-3` and `after-dev-1` to `after-dev-3`, gpt-6-astra, kitchen image 16 on
the default room, [the evidence](#7-evidence)) show the back panel in every first create, and the
user's first attempt was replayed model-free.

**The back panel, six of six runs.** Every first create sends the panel `behind` a unit of the
peninsula with `mod_Width` as its length — 2250, 1800, 900, 1850, 1800 and 1500 mm —; `after-dev-1`
sends `mod_IslandBackwallWidth` beside it. The panel is built at its own 1000 mm. Five of the six runs
then send the whole group again with `mod_IslandBackwallWidth` 1851 to 2331 (`after-dev-1` has it
from the start):

```text
first create:  { "id": "backPanel", "articleId": "RWV", "behind": "hob",
                 "attributes": [{ "id": "mod_Width", "value": 2250 }, { "id": "mod_Height", "value": 870 }, ...] }
second create: { "id": "f5c0a96a-…", "articleId": "RWV", "behind": "42a37997-…",
                 "attributes": [{ "id": "mod_IslandBackwallWidth", "value": 2331 }, ...] }
```

The corrections of the first create name four library changes (the carcase program of the open
shelf units, the insertion heights) and nothing about `mod_Width` on the panel.

**The first attempt, model-free.** The structure of the first snapshot — the articles, their
relations and attributes, read from the snapshot — sent through `callExternalObjectAgentTool` on the
example page (`replay-first-attempt.mjs`, [the evidence](#7-evidence)) builds the same group: the
same outlines to the millimetre, the panel 1030 mm long at x 61 to 1091, the fourth wall unit at
y 3704 to 4304. The result:

- `corrections`: the four library changes; nothing about `mod_Width` on `RWV`.
- the returned `RWV` root: `mod_Color`, `mod_Depth`, `mod_Height`, `mod_PaneltopColor` — `mod_Width`
  is gone without a word.
- `hint`: "Root module '…' (SUT60) … stands in front of the window in the back wall (wall 5,
  fromEndMm 235 to 2335, 950 to 2170 mm) …" — the sink unit under the window, correct — and the same
  sentence for the open shelf unit above the corner article and for the two `OTB60` at y 3104 to
  3704 and 3704 to 4304, each with "free stretches of the left wall (wall 0) at its height:
  fromEndMm 0 to 4400". The window's strip reaches the corner, so the three wall units at the corner
  are in it by their depth. That a wall unit reaches past the wall is not said.

## 3. Where the Time Goes

The user's runs keep no log. In the three runs of 2026-10-30 that end with the kitchen of the image
(`final-dev-1` to `final-dev-3`, 93, 116 and 105 s of chat), the model steps take:

| Run | Steps of the model, in seconds | Tools of the steps |
|---|---|---|
| final-dev-1 | 4, **31**, 7, **30**, 4, 5, 6 | context and skills, the create, context + `find-attributes`, the second create, images, one attribute, the answer |
| final-dev-2 | 4, **22**, 8, **48**, 7, 5, 5, 3, 7 | the same, then two attributes |
| final-dev-3 | 5, **29**, 7, **36**, 8, 7, 7 | the same |

The second create — the whole group once more, for the length of one panel — and the lookup before
it cost 38 to 56 s of 93 to 116 s, a third to a half of the run; the tools take 2 to 4 s per create.
The user's first attempt kept the short panel until the agent saw the images, and the wall units had
to be rebuilt as well, so the user's run was longer than these.

## 4. Investigation and Root Causes

### 4.1 The Catalog Names `mod_Width` as the Panel's Dimension

The article catalog of `get-plan-context` serves `RWV` with these dimensions (`served-rwv.json`,
[the evidence](#7-evidence)):

```text
"rootModules": [{ "module": { "id": "mr_IslandBackwall", "name": "Island backwall" },
  "dimensions": [{ "id": "mod_Depth", "value": "250" }, { "id": "mod_Height", "value": "1000" },
                 { "id": "mod_Width", "name": "Width     ", "value": "1000" }], ... }]
```

The module `mr_IslandBackwall` does not take `mod_Width`. The master data lists its attributes:
`mod_Color`, `mod_Depth`, `mod_Height`, `mod_IslandBackwallOverdimension`,
`mod_IslandBackwallOverhangFront`, `mod_IslandBackwallWidth`, `mod_PaneltopColor`, `mod_PaneltopThk`,
`mod_Program`, `mod_Thk`. Its length is `mod_IslandBackwallWidth` — type `Dim`, name "Width", desc
"Width of the island backwall", a range of 150 to 5000 mm — which the `attributes` section of
`get-plan-context` lists with `valueCount` 1 and the catalog's dimensions do not name at all.

The served rules tell the agent to size an article by exactly the id the dimensions name
(roomle-ui `src/hi-mcp/hi-mcp-server.ts:21`):

> dimensions give its size (per size attribute its id, its name - e.g. Width, Depth, Height - and
> its value in millimetres; a root in groups carries the same attribute ids among its attributes, and
> change-module-attribute with that attribute id, never its name, changes the size of a root module;
> an article of another size - "a 900 mm cabinet" - is the same article with that attribute set …)

So `mod_Width` on the panel is the agent following the catalog. Six of six runs and the user's first
attempt send it.

**Why the catalog names it.** `compactArticle` (roomle-ui `src/hi-plan-context.ts:625`) takes the
dimensions of a root module from the attributes of the article template — the article as the glue
logic calculates it once per article (`calculateArticleTemplate`, `src/hi-library-context.ts:58-66`) —
and keeps every attribute whose master data type is `Dim` (`src/hi-plan-context.ts:653-656`):

```ts
const dimensions = attributes.filter(
  (attribute) => attributeInfos.get(attribute.id)?.type === MDType.Dim,
);
```

The calculated panel carries `mod_Width` 1000 as a result of its calculation — the width the library
gives every module —, not as an input of its module. The filter does not ask whether the module takes
the attribute, as `hasAttribute` (`src/hi-plan-context.ts:315`) asks it from the master data's
`modules[].attributes`. The input the module takes, `mod_IslandBackwallWidth`, is not among the
template's attributes, so it is not served.

A scan over the 111 articles of the library (`dimension-scan.json`, [the evidence](#7-evidence)):
`RWV` is the only article whose served dimensions name an attribute its module does not take. For
every other article the dimensions are the module's own `mod_Width`, `mod_Depth` and `mod_Height`.

### 4.2 The Useless Override Passes Without a Word

The create accepts `mod_Width` on the panel and tells the agent nothing:

1. `checkRootOverrides` (`src/hi-tool-attributes.ts:480`) asks the planner for the library's verdict
   on every root override (D107, C32). The verdict comes from the module's drop-down options
   (`verdictOf`, `src/hi-attribute-check.ts`): "without options every value is taken". A module has
   no options for an attribute it does not carry, so the value passes as taken.
2. `moveGeneratedRootOverrides` (`src/hi-tool-attributes.ts:37`) moves an override off the root only
   when no module of a catalog article carries it (G47); `mod_Width` is the width of every other
   article, so it stays with the panel — the behaviour reference names this very case: "an attribute
   the modules of catalog articles carry (`mod_Width` on a back panel) stays with its root".
3. The load sets it on the root module as the last resort of `_overrideTargetsOf` (`src/hi-tools.ts`,
   "the root module when it carries the attribute, else its sub modules that carry it, else the root
   module"). The library calculates the panel without it, and the reloaded root does not list it.

The result carries no correction, no `notLoaded`, no hint for it. The agent finds out from the images
or from a `get-plan-context`, looks the attribute up with `find-attributes`, and sends the whole group
again — against the served rule that a size of a root module is a change made with
`change-module-attribute` (`hi-mcp-server.ts:45`), because at that point it has lost trust in the
group as built.

### 4.3 The Desc of the Panel

The desc of `RWV` — "Decorative back panel for a kitchen island … island use only" — names no
peninsula and no length attribute (library issue 23, the proposed desc in
[suggested-library-changes.md 1.8](../../docs/library-information/suggested-library-changes.md#18-island-back-panel)).
The earlier analysis made the skill ask for the panel, so it is planned; the desc still gives the
agent no way to the length. It adds to 4.1; it is not the cause: an agent that reads
`mod_IslandBackwallWidth` in the desc still sees `mod_Width` in the dimensions.

### 4.4 The Wall Units Past the Window Wall

The leg along the left wall: the corner article `UERTB90` in the back left corner (y 3107 to 3765),
two `UTB60` (y 2504 to 3104 and 1904 to 2504), then the peninsula's corner article `UELTB90`
(y 1243 to 1901). From the front `UTB60` to the back wall are 1861 mm. The agent read four wall units
in the image, took `OTB60` for all four — 2400 mm — and hung the first `above` the front `UTB60`, the
next ones `rightOf` toward the back wall, as the image shows the row ending at the wall. The tools
built it as sent (D51): the row runs over the corner article, which is right, and 539 mm past the
wall.

What the agent had to go on:

- **The instructions say nothing about the length of a row of wall units.** The image-planning
  skill fits the floor row to the wall ("Fit the length to the wall … when the wall is shorter than
  the furniture in the image, leave out or narrow the cabinets", section 4) and says nothing about
  the wall units of a leg. The served `above` rule (`hi-mcp-server.ts:30`) says where a wall unit
  hangs, not that a row of them has to fit the floor units it hangs over. The catalog has wall units
  of 300, 450, 600 and 900 mm: four of 450 mm fit the 1861 mm.
- **The result does not name the overshoot.** The hint names the three wall units at the corner
  for the window's strip — true by their depth, but not the problem — and `wall` of the fourth unit
  is `null` in the returned group (`wall None` in the snapshot), which the agent has to notice among
  18 root modules. A hint that a root module reaches past a wall of the room exists for row edits
  only (`rowReachHints`, `src/hi-tool-hints.ts:60`, D43). For a create, D22 rules it out: a group
  outside the room is never refused, removed or warned about — the user may ask for it —, and an
  out-of-room hint of a create was rejected twice. The fix stays with the instructions.

### 4.5 The Wall Units of the Final Result

After the failure the agent took `OTB45`, 1800 mm, and moved the anchor: `above` the back `UTB60` at
its front edge, chained toward the front. That leaves the 811 mm to the back wall empty and hangs the
front unit 89 mm past the peninsula's corner unit — the "off" of the final result. The row of the
image hangs from the corner: `above` the front `UTB60`, chained toward the back wall, four units of
450 mm end 61 mm before the wall, as the first attempt's third unit did. This is the agent's choice
after the failure, and the same instruction covers it: fit the row to the leg, keep its place.

## 5. Proposed Fix

All in roomle-ui, library-neutral, no guard. The ladder of
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): the catalog is the API the
agent reads (step 2), the correction tells it what was not set (step 4), the skill sentence is the
instruction (step 1).

1. **The catalog names the dimensions the module takes** (`compactArticle`,
   `src/hi-plan-context.ts:653`). A `Dim` attribute of the template that the root's module does not
   carry (master data `modules[].attributes`) is replaced by the module's `Dim` attribute of the same
   name — "Width" for "Width     ", names trimmed — with the template's value, so `RWV` serves
   `{ id: "mod_IslandBackwallWidth", name: "Width", value: "1000" }`; without such an attribute it is
   left out. The agent then sends the right id in the first create, and `rootWidth`
   (`src/hi-group-layout.ts:188`), which reads the catalog's `mod_Width` for the places of wall
   units, keeps it for every article whose module takes it. Test in `__tests__/hi-plan-context-test.ts`
   beside "should compact the article with module info, dimensions and attributes": a template
   dimension the module does not carry is replaced by the module's dimension of the same name; one
   without a namesake is left out; the module's own dimensions stay.
2. **A root override no module of the root carries is left out and named.** In `checkRootOverrides`
   (`src/hi-tool-attributes.ts:480`), before the library's verdict: an override whose attribute
   neither the root's module nor a sub module of its article carries (the master data, as
   `_overrideTargetsOf` reads it) is removed from the root, with the correction
   "posGroups[0] root 'backPanel': a 'RWV' has no attribute mod_Width - the root was built without
   it; the dimensions it takes: mod_Depth, mod_Height, mod_IslandBackwallWidth (Width)" — the
   module's `Dim` attributes when the override is a `Dim`, else its attributes of the override's
   type. The agent learns in the result what did not happen and which id to send, with
   `change-module-attribute`, without losing a step. A new row in §8.3 of
   `hi-tools-behaviour.md` and the decision in §3; tests in
   `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`: the override is not set, the
   correction names the module's dimensions; an override a sub module carries stays (D100). The
   command tools that take attributes (`merge-article-into-group`, `insert-article-into-group`,
   `exchange-root-module`) are checked for the same path in the implementation.
3. **The image-planning skill fits the wall units to the leg** (`src/hi-mcp/skills/image-planning/SKILL.md`,
   section 3, one sentence): "A row of wall units is as long as the widths of its units: fit it to
   the floor units it hangs over — on a leg, to the stretch from the first floor unit it hangs over
   to the wall or the corner at the end of the leg — and keep its place in the image." The served-text
   fixture `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` is rewritten for it;
   §5.6 of `hi-tools-behaviour.md` where it quotes the skill.
4. **The library** keeps issue 23: the desc of `RWV` with the peninsula and the length attribute.
   With fix 1 the agent sizes the panel right without it; the desc remains the reason to plan the
   panel for a peninsula at all.

Considered and not proposed:

- **Correcting `mod_Width` into `mod_IslandBackwallWidth` by name** (step 3 of the ladder). With fix 1
  the agent has the right id in the catalog; a name match in the tool is a guess the result would
  have to explain, and the id the agent sent would differ from the id in the group it gets back.
- **A hint or guard for a root module past a wall of the room.** D22: a group outside the room is
  the user's choice; the hint for a create was rejected twice.
- **A rule in the general served text.** The length of a row is a planning matter of the skills,
  not of the tool API; the served rules stay short.

## 6. Verification

- roomle-ui: the new and existing tests of `homag-intelligence`, typecheck, lint and format.
- Model-free, on a dev server of the branch, the payload of the first attempt
  (`replay-first-attempt.mjs`): the catalog serves `mod_IslandBackwallWidth` for `RWV`; the create's
  corrections name `mod_Width` as not taken and the dimensions the panel takes; the same payload with
  `mod_IslandBackwallWidth` 1800 closes the back in one create.
- The model check, when asked for: gpt-6-astra, the model of the issue, kitchen image 16 on the
  default room, three runs on the dev server: the panel at the row's length in the first create, no
  wall unit past the wall, the chat time against the 93 to 116 s of 2026-10-30.

## 7. Evidence

Under `.temp/result/` of roomle-hi-example (git-ignored):

- `repro-kitchen-16-2026-10-31/snapshots/` — the user's two snapshots loaded without a model:
  `<ps id>-context.json` (rooms, groups, obstacles), `<ps id>-raw-groups.json`, `<ps id>-1.jpg`
  (the groups alone), `<ps id>-2.jpg` (the top view); `load-snapshot.mjs`.
- `repro-kitchen-16-2026-10-31/replay/` — the first attempt replayed model-free: `create-result.json`
  (corrections, hint, the groups), `image-1.jpg`, `image-2.jpg`; `replay-first-attempt.mjs`.
- `repro-kitchen-16-2026-10-31/served-rwv.json` — `RWV` as the catalog serves it, its module in the
  master data, the two width attributes; `served-attributes.json` — the attributes section;
  `dimension-scan.json` — every article's served dimensions against its module's attributes;
  `scan-dimensions.mjs`, `served-article.mjs`, `served-attributes.mjs`, `page-ready.mjs`.
- `repro-kitchen-16-2026-10-30/final-dev-1` to `final-dev-3`, `after-dev-1` to `after-dev-3` with
  their `.log` files — the six runs of the earlier analysis on this build: the payloads of both
  creates and the model times.
