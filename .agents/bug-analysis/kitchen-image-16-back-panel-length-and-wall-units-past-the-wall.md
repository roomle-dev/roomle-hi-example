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
hard for the agent to set or change the size? Yes, it is the library's information: which attribute
sets the panel's length is library content, and the tools serve every library without such knowledge
(D8 and §2.4 of the behaviour reference). The desc of `RWV` and the desc of `mod_IslandBackwallWidth`
have to say it; today neither does. Changing the size is one call once the agent knows the attribute.
The wall units are an error of the agent's count that the instructions do not tell it to check.

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

The agent follows the catalog: six of six runs and the user's first attempt send `mod_Width`.

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

The catalog serves the library's data as the template carries it. Which attribute sets the panel's
length is library information, and the tools hold no knowledge of one library (§2.4 of the behaviour
reference): the place for it is the desc of the article and of the attribute (4.3). Whether the
catalog should leave out a template dimension the module does not take by the master data — a filter
over the library's own module definition, no library knowledge — is an open decision of the plan.

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

The library accepts the input without an error. The library's verdict is the measure of the tools
(D107), so the tools do not judge an input the library accepts, and no feedback for it is proposed.

### 4.3 The Descs of the Panel and of Its Length Attribute — the Root Cause

The desc of `RWV` — "Decorative back panel for a kitchen island … island use only" — names no
peninsula and no length attribute (library issue 23, the proposed desc in
[suggested-library-changes.md 1.8](../../docs/library-information/suggested-library-changes.md#18-island-back-panel)).
The desc of `mod_IslandBackwallWidth`, "Width of the island backwall", says neither that it is the
panel's length along the row nor that the panel's length is not `mod_Width`. The earlier analysis
made the skill ask for the panel, so it is planned; nothing the library says leads the agent to the
attribute that sizes it. Every desc is authoritative for the agent (D8): the descs of the article and
of the attribute are where the library tells the agent which attribute is the length, and they are
the fix.

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

The length of the panel is the library's information: the descs. The wall units are an instruction:
the image-planning skill. No tool change, no guard.

1. **The library names the length attribute** (`docs/library-information/suggested-library-changes.md`,
   library issue 23): the desc of `RWV` (1.8, rewritten) says that its length along the row is
   `mod_IslandBackwallWidth`, not `mod_Width`, set to the length of the row it covers; a new section
   for `mod_IslandBackwallWidth` and `mod_IslandBackwallOverdimension` gives the attributes the same
   information.
2. **The image-planning skill fits the wall units to the leg** (`src/hi-mcp/skills/image-planning/SKILL.md`,
   section 3, one sentence): "A row of wall units is as long as the widths of its units: fit it to
   the floor units it hangs over — on a leg, to the stretch from the first floor unit it hangs over
   to the wall or the corner at the end of the leg — and keep its place in the image." The served-text
   fixture `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` is rewritten for it;
   §5.6 of `hi-tools-behaviour.md` where it describes the skill.
3. **The test** `image-kitchen-16-peninsula` of `docs/test-prompts.json` expects the wall units above
   the floor units of their leg, none past a wall.

Open decision: **the catalog's dimensions.** `compactArticle` could leave out a dimension of the
template that the root's module does not take by the master data (`assignedAttributes`) — a filter
over the library's own module definition, no knowledge of one library; `RWV` then serves depth and
height, and the length comes from the descs. Without it the catalog keeps naming `mod_Width` 1000
beside a desc that names `mod_IslandBackwallWidth`, and the agent has to weigh the desc over the
dimension. The plan carries it as a step that waits for a go.

Considered and not proposed:

- **A correction or feedback for a root override the module does not carry.** The library accepts
  the input without an error; the library's verdict is the measure (D107).
- **Correcting `mod_Width` into `mod_IslandBackwallWidth` by name.** Library knowledge in the tool.
- **A hint or guard for a root module past a wall of the room.** D22: a group outside the room is
  the user's choice; the hint for a create was rejected twice.
- **A rule in the general served text.** The length of a row is a planning matter of the skills,
  not of the tool API; the served rules stay short.

## 6. Verification

- roomle-ui: the new and existing tests of `homag-intelligence`, typecheck, lint and format.
- Model-free, the payload of the first attempt (`replay-first-attempt.mjs`) with
  `mod_IslandBackwallWidth` 1800 in place of `mod_Width`: the back closed in one create — the final
  snapshot shows the same.
- The model check, when asked for: gpt-6-astra, the model of the issue, kitchen image 16 on the
  default room, three runs on a dev server of the branch: no wall unit past the wall; the panel at
  the row's length in the first create once the library carries the descs; the chat time against the
  93 to 116 s of 2026-10-30.

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
