# Bug analysis — the agent's undos and the element type attribute it is offered

> **Type**: Bug analysis (change request from user feedback)
> **Status**: Open
> **Date**: 2026-10-22
> **Base**: roomle-hi-example `master` (`cf91661`); roomle-ui `feat/hi-mcp` (`d8b29ecbb`), the same
> lines on `release/bo-test` (`2edb30d49`)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`): the fix. The HI tools no longer show `mod_TypeElement` to the
  agent: not in the attribute vocabulary, the catalog, the roots and sub modules of `groups`, the
  `masterData` section or `find-attributes`. The tool commands ignore it in the agent's input and
  say so in `corrections`. The attribute ids live in one constant. Unit tests are in
  `__tests__/hi-mcp/` and `__tests__/hi-tool-commands/`.
- **roomle-hi-example**: the documentation of the exception:
  - D102 in `.agents/context/hi-mcp-behaviour.md`, which narrows D100, with §2.4, §5.4, §5.5 and
    §8 updated;
  - `.agents/context/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`;
  - the Library-Neutral section of `AGENTS.md`;
  - the policy record `.agents/backlog/mcp-policy-issues.md`.
- **ligna-store, embedding-lib**: unchanged. Both chats get the tools from the planner at their server
  URL, so they see the fix once roomle-ui is deployed to bo-test. No embedding-lib build is needed.
- **HOMAG library (Furniture_Smith)**: unchanged by this fix. A desc for `mod_TypeElement` is an
  optional complement (see [Alternatives](#alternatives-considered)).

## The feedback

From a user of the planning assistant (German, translated):

> Can we tell the AI assistant that it must NEVER touch the attribute `mod_TypeElement`, AND that
> it may only change attributes that are POS-relevant? Then we would not have so much trial and
> error when it builds the planning. It aborts very often and does undo.

**POS-relevant** means *point of sale relevant*. In the master data, every attribute carries the
POS fields `userRight` and `posView`:

- `userRight` is the POS user right an attribute needs: `Simple` (the salesperson), `Advanced`, or
  `Master` (the library maintainer). roomle-ui models it as `PosUserRight`
  (`homag-intelligence/src/model/oc-scripts-domain.model.ts:5`).
- `posView` is the control the POS shows for the attribute (`Dropdown`, `ImageList`, …).

The POS shows a user the attributes their right allows. Both chats run the POS as `Simple`:

- the example page, `minimal-hi-example/index.html:252`;
- the ligna-store, `ext-objects/api-options.ts:7`.

So "only POS-relevant attributes" means only the attributes the user of the session can change in
the POS, which in both chats are the `Simple` ones.

The feedback names two causes: `mod_TypeElement`, and the attributes that are not POS-relevant.

## Symptom and reproduction

**From the reporter:** the agent tries, fails, undoes and tries again while it builds a planning.
The reporter's session is not available: no plan id, model, chat or user right.

**In the stored test runs:** 216 run directories with gpt-6.1-sol, gpt-6-astra and
mistral-large-4 (sessions `mcp-test-2026-10-18_08-45-09` to `mcp-test-2026-10-22_09-29-56`,
`.temp/result/`). They hold 205 runs and 11 earlier attempts. The runs contain 20 undos that no
prompt asks for (trace step 4). The table of undos is the reproduction: run
`08-image-kitchen-back-right-corner` or `09-image-planning-right-wall` with gpt-6-astra.

## Investigation trace

### 1. What `mod_TypeElement` is

The Furniture_Smith master data (`docs/library-information/master-data.json`) has these entries:

```json
{ "id": "mod_TypeElement", "name": "Type Element", "desc": "Defines the element type",
  "isMain": true, "group": "Global", "type": "Text", "userRight": "Master",
  "implicitRelevant": false, "posView": "Dropdown",
  "selections": [ "BaseUnit", "BaseUnitSink", "BaseUnitAppliance", "WallUnit", "TallUnit",
                  "TallUnitAppliance", "EasyMode", "CornerUnitStraight", "Filler", "Filler01",
                  "WashdisherPanel", "CornerFiller", "Upright" ] }
```

- 16 of 47 modules carry it: 7 root modules and 9 sub modules (front, appliance, waste and
  equipment).
- The article templates set it as an input attribute. It appears 70 times in the article list
  (`docs/library-information/article.json`), for example `WallUnit` on the wall units and
  `TallUnit` on the tall units.
- The article's `category` already says the same thing (`Kitchen | Wall Units | Storage`,
  `Kitchen | Tall Units | Storage`, …).
- The library's door and grain lookups use it as the first part of their key (step 4).

A `Master` user can change it in the POS. For a salesperson it is part of the article: to get
another element type, you pick another article.

### 2. What the agent is given

D100 (user, 2026-10-21) shows the agent every attribute of the library. It explicitly rejects "a
filter by the user right or by the carrying module". Because `mod_TypeElement` is a `Master`
attribute with `isMain`, it reaches the agent in five places:

| Where | Code (roomle-ui `homag-intelligence/src/`) |
|---|---|
| The attribute vocabulary of `get-plan-context`: the full entry with its 13 values | `compactMasterData`, `hi-plan-context.ts:278`; `agentFacingAttributes`, `hi-mcp/agent-facing.ts:223` |
| The catalog: every article's `mainAttributes` (`isMain`) with its value | `hi-plan-context.ts:651`; passed through by `agentFacingArticle`, `hi-mcp/agent-facing.ts:235` |
| The groups: every root's and sub module's input `attributes` | `inputAttributes`, `hi-plan-context.ts:696`; `shapeRoot`, `:705` |
| The `masterData` section, on request | `compactMasterData` via `hi-library-context.ts:42` |
| `find-attributes` | `hi-mcp/tool-executors.ts:504` |

The tools set every attribute a module carries (D100): the overrides of a create, merge, insert or
exchange (`_applyRootAttributeOverrides`, `glue-logic.ts:922`), `change-module-attribute` and
`change-group-attribute` (`hi-tool-commands.ts:929`, `:1037`).

The agent therefore has more rights than the user it plans for. The user's POS (`Simple`) does not
show `mod_TypeElement`, but the agent can set it.

In each `get-plan-context`, the attribute costs about 5,800 characters: about 1,100 for the
vocabulary entry and about 4,700 for the 70 catalog entries.

### 3. What the agent does with `mod_TypeElement`

`planner-calls.json` records every argument the model sent. In all 216 run directories:

- One call sends `mod_TypeElement`: a root of a `create-or-replace-groups`, with the value its
  article already has.
- No call changes it, either through a root override, a group attribute or an attribute edit.

So in the stored runs the agent does not touch the element type, and `mod_TypeElement` causes none
of their undos.

### 4. Where the undos come from

The 205 runs contain 31 undos. Eleven are asked for by the prompt ("undo the last change", "undo
that", "that was the wrong unit"), which leaves 20 spontaneous undos. Each one is classified by the result of the call before
it:

| Cause | Undos | Library error before the undo |
|---|---|---|
| A door table entry the library does not have for the width, height and door direction | 7 | `Error 14019: Could not find entry in tab_DoorSettings for input value: WallUnit - … - 600 - … - LeftRight` |
| Another calculation error | 9 | `14034` grain direction (4), `22025` handle strip with a handle position (6), `13003` handle mapping (2), `13008` drawer box dimension (2), `14011` plinth area (1); several in one call |
| No error: the agent redoes a detail (corner article of the wrong hand, a filler, a door direction) by undoing and creating the group again | 3 | — |
| A group not built | 1 | — |

Sixteen of the 20 undos follow a calculation error. Each error comes from a combination of values
that the library cannot calculate:

- `mod_Width` and `mod_DoorDirectionSelection` (14019);
- the upright or carcase colour with its program (14034);
- `mod_HandleDesign` with `mod_HandlePosType` (22025).

These are `Simple` attributes, the POS-relevant ones, apart from `mod_UprightProgram`. The backlog
already tracks them:

- [attribute values checked before an edit](../backlog/attribute-values-checked-before-an-edit.md)
  (D99);
- library issues [69](../backlog/library-issues.md#69-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate),
  [70](../backlog/library-issues.md#70-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate),
  [80](../backlog/library-issues.md#80-wall-units-at-900-mm-with-a-single-door-the-library-cannot-calculate)
  and [99](../backlog/library-issues.md#99-a-handle-strip-the-library-cannot-calculate).

`13008` has no item.

The door table error begins its key with the element type ("for input value: **WallUnit** - All -
Standard - 240 - mr_StorageunitSingle - 600 - …"). The key holds the article's own type, unchanged.
Someone reading the chat or the log sees the element type at the start of the error that comes
before most undos. That may be why the feedback blames `mod_TypeElement`; without the reporter's
session this is a hypothesis.

### 5. What "only POS-relevant attributes" would take away

Across the 216 run directories, the agent sets these attributes with a value other than the
article's own:

| `userRight` | Attribute | Runs | What for |
|---|---|---|---|
| Simple | `mod_DoorDirectionSelection`, `mod_Width`, `mod_FrontColor`, `mod_FrontProgram`, … (32 attributes) | 1–106 each | the planning |
| Advanced | `mod_CreateToekick` | 15 | toe kick on or off |
| Advanced | `mod_CreateBacksplash` | 3 | backsplash |
| Advanced | `mod_HandleColor` | 1 | handle colour |
| Master | `mod_UprightProgram` | 12 | end panels with a plain colour; library issue 69 asks the agent, through the desc, to set it |
| Master | `mod_HeightPosInsertion` | 4 | wall unit height |

A filter to `Simple` would take away the toe kick, the backsplash and the handle colour. It would
also take away `mod_UprightProgram`, so the end panels of library issue 69 fail again, which means
one more calculation error and one more retry. A filter that keeps `Simple` and `Advanced` would
still take away `mod_UprightProgram` and the corner widths `mod_WidthLeft` and `mod_WidthRight`
(`Master`, `isMain`).

The undos of step 4 come from `Simple` attributes, which such a filter keeps. So the filter would
not remove the cause of the undos, and it would add new failures.

## Root cause

**The undos.** The agent sets combinations of POS-relevant values that the library cannot calculate,
and it learns this only from the calculation error after the call (step 4). The HI tools apply the
values without checking them against what the library accepts for the module. Under D99 that is an
MCP bug where the library rules the value out, and a library bug where it accepts the value but does
not calculate it. Both are open in the backlog. `mod_TypeElement` and the attributes that are not
POS-relevant are not the cause in the stored runs.

**`mod_TypeElement`.** The agent is offered an attribute it must never change. D100 offers every
attribute (step 2), and the attribute's desc, "Defines the element type", does not say that the
article sets it. The exposure is real, even though no stored run uses it. It costs about 5,800
characters in every `get-plan-context`, and an agent that sets it rebuilds an article as another
element type.

## Proposed fix

### 1. Hide `mod_TypeElement` from the agent: a documented exception

As decided by the user (2026-10-22), the HI tools do not show the agent `mod_TypeElement`. This is
an exception to the library-neutral policy (§2.4), because the tools' logic names one attribute of
one library family. It is recorded as **D102**, which narrows D100.

In roomle-ui, `homag-intelligence/src/`:

- **One constant** of the attribute ids the agent leaves to the article, with `mod_TypeElement` as
  its only entry, in `hi-plan-context.ts` beside the other HI tool constants.
- **The agent-facing layer** (`hi-mcp/`) drops these ids. The planner's public plan context and
  library context (`getExternalObjectPlanContext`, `getExternalObjectLibraryContext`) stay complete
  for other integrators, so `compactMasterData` and `shapeRoot` do not change.
  - The vocabulary: `agentFacingAttributes`, `agent-facing.ts:223`.
  - The catalog's `mainAttributes`: `agentFacingArticle`, `agent-facing.ts:235`.
  - The `masterData` section: the modules' attribute lists and `attributes`, in the
    `get-plan-context` executor (`tool-executors.ts:415`, the shaping at `:465-501`).
  - The input `attributes` of the roots and their sub modules in `groups`: the same executor, and
    the `groups` of the plan-changing results, which use the plan-context shape.
  - `find-attributes`: `tool-executors.ts:504`.
- **The tool commands** (`hi-tool-commands.ts`) ignore these ids wherever the agent sends them. That
  covers root overrides and group attributes of `create-or-replace-groups`, the `attributes` of
  merge, insert and exchange, `change-module-attribute`, `change-group-attribute` and
  `change-attributes`. Each ignored value gets one line in `corrections`, for example: "the element
  type is set by the article — `mod_TypeElement` was not changed; choose an article of the element
  type you want".

  This is step 3 of the guard guideline: correct the input and inform the agent. A call that sends
  nothing but such a value has nothing to build, so it answers as an error with the same sentence.
- **A replace keeps the value.** A root the agent sends back without `mod_TypeElement` keeps its
  article's value. A unit test checks this. Today the agent sends back what `groups` shows, so the
  value is not part of the round trip.

**Expected effect:** about 5,800 characters less in every `get-plan-context`. The agent can no longer
change the element type, which is what the reporter asks for. No measurable change in the undos of
the stored runs, because none of them comes from this attribute.

### 2. No filter by POS relevance: D100 stays

The agent keeps every other attribute. A filter by the user right takes away attributes the agent
needs, such as `mod_UprightProgram`, `mod_CreateToekick` and the corner widths. It brings back
library issue 69, and it does not touch the cause of the undos (step 5). This is the rejection that
D100 records.

### 3. The undos: the open items

The trial and error the reporter sees has its fix in existing items:

- **[Attribute values checked before an edit](../backlog/attribute-values-checked-before-an-edit.md)**
  (D99, medium): check the agent's values against `getVerifiedAttributeOptions` before they are set.
  This catches a colour, program or design a module does not take. The library does not verify
  `mod_Width`, `mod_Height` or `mod_DoorDirectionSelection`.
- **Library issues 69, 70, 80 and 99:** the combinations the library accepts but cannot calculate,
  and the descs that would let the agent avoid them.

The analysis proposes no new code for them. The `13008` drawer box error gets a library issue once
it has been reproduced.

## Unit tests

roomle-ui, `packages/web-sdk/packages/homag-intelligence/__tests__/`:

- `hi-mcp/`, the `get-plan-context` and `find-attributes` executors: with a master data and a plan
  that carry `mod_TypeElement`,
  - the vocabulary, the catalog's `mainAttributes`, the `masterData` section and the roots' and sub
    modules' input `attributes` do not contain it;
  - `find-attributes` for "element type" finds no match;
  - the public `getExternalObjectPlanContext` still contains it (`hi-plan-context-test.ts`).
- `hi-tool-commands/`:
  - a create whose root sends `mod_TypeElement` builds the root with its article's value and lists
    the correction;
  - `change-module-attribute` with `mod_TypeElement` answers as an error with the sentence and
    changes nothing;
  - `change-attributes` with `mod_TypeElement` beside another value sets the other value and lists
    the correction;
  - a replace of a root sent without `mod_TypeElement` keeps the article's value.

The existing guards of D100 (`it('keeps every attribute of the library and the root and sub modules
that carry them')`, …) stay as they are, because they test the planner's public context.

## Alternatives considered

- **Filter by the session's POS user right (the "POS-relevant" rule).** The agent would get the
  rights of the user it plans for, and the rule is library-neutral, because every HI library
  carries `userRight`. Rejected: both chats run as `Simple`, which takes away
  `mod_UprightProgram`, `mod_CreateToekick`, the backsplash and the handle colour (step 5). It does
  not touch the undos, and D100 rejects it.
- **Hide every `Master` attribute.** Rejected: it takes away `mod_UprightProgram` (library issue
  69), `mod_HeightPosInsertion` and the corner widths `mod_WidthLeft` and `mod_WidthRight`.
- **Only the desc of `mod_TypeElement`** ("Set by the article; to get another element type, choose
  another article"), through `suggested-library-changes.md`. This follows the policy (D8, §2.4) and
  serves every agent of the library. Rejected as the only fix: the reporter asks for "never", and a
  desc does not guarantee it. It remains a useful complement for the library team.
- **A list of hidden attributes the integration configures** (the example page and the ligna-store
  know their library). This keeps the tools library-neutral. Rejected: it adds a planner option and
  configuration in two chats for one attribute, which is configurability nobody asked for.
- **Hide it in `compactMasterData` and `shapeRoot`.** Rejected: these feed the planner's public
  `getExternalObjectPlanContext` and `getExternalObjectLibraryContext`, which other integrators read
  in full.
- **A guard that rejects `mod_TypeElement` but still shows it.** Rejected: the agent would still
  see the attribute and could send it. Hiding it removes the wrong payload (step 2 of the guard
  guideline), and the correction handles the rest.

## Open questions

- **The reporter's session:** plan id, model, chat (example page or ligna-store) and the POS user
  right. It would confirm whether the agent changed `mod_TypeElement` there or whether the element
  type in the door table error led to the impression. With a `Master` user right, the POS also shows
  the attribute to the user.
