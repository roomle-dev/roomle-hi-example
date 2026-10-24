# Price and order of root modules the library could not calculate

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` (`f5c0b04`); roomle-ui `feat/hi-mcp` (`42d17c4f3`)
> **Backlog**: [library-calculation-gaps.md #1](../backlog/library-calculation-gaps.md#1-price-and-order-include-root-modules-the-library-could-not-calculate-without-a-note)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`) — the HI tool set: `get-price` and `get-order-data` name every root
  module and group of the plan that the library could not calculate, in a `hint` beside the
  planner's answer (`hi-mcp/tool-executors.ts`). Their descriptions say what the hint means
  (`hi-mcp/hi-mcp-server.ts`). Also the unit tests and `.agents/homag-intelligence/`: D108, §8,
  `library-errors.md`, `hi-tools-reference.md` and `tool-executors.md`.
- **roomle-hi-example** — this analysis, [`hi-mcp-tools.md`](../skills/hi-mcp-tools.md),
  [the wiki page](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md) and the
  backlog item.
- **ligna-store** — unchanged. It gets the tools with the planner. The forwarding of
  `createHiMcpTools` does not change, so no new embedding-lib version is needed.
- **The HOMAG library** — unchanged. Its `getOrderData` already marks the root module (see
  [What the library and the Order Manager do](#what-the-library-and-the-order-manager-do)).

The roomle-ui paths are relative to `packages/web-sdk/packages/`. The D-numbers are the decisions in
§3 of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions).

## Symptom

A root module can stay in the plan after the library fails to calculate it. The library ends its
calculation with an `Error` or `Fatal` message, and the root module has no docking vectors, no
dimensions and no front parts (D95). Such a root module comes from:

- an edit in the planner's attribute panel;
- a loaded plan;
- an undo;
- `delete-article-in-place` or `merge-groups`, which change the plan before the library calculates;
- a follow-up calculation after a load.

`get-price` and `get-order-data` answer for such a plan as for any other. Neither answer says at its
top level that a unit in it is not built. The agent reports a price for a planning that cannot be
produced as planned. `get-plan-context` marks the root module with `calculationError` (D108), but an
agent asked "what does it cost?" calls `get-price` alone.

### Reproduction

The order path is the same code on the deployed `release/bo-test` planner (`1d9adf51e`) and on
`feat/hi-mcp`: `git diff origin/release/bo-test HEAD` is empty for `orders.ts`,
`roomle-planner.ts`, `api.ts` and `getGroupDataForOrder`, and has no line for the two executors.
bo-test does not carry D106. Its `change-module-attribute` keeps a failed calculation as the
planner's attribute panel does. That makes the bug reproducible without a model there:

1. The example page on bo-test: `EXAMPLE_PORT=3002 HI_CHAT_PORT=3202 node minimal-hi-example/start.mjs --no-open`.
2. `create-or-replace-groups` through `instance.extended.callExternalObjectAgentTool`: `UTB60` `a`,
   `UTB60` `b` `rightOf` `a`, `OTB60` `c` `above` `a`, `OTB60` `d` `above` `b`, at wall 1.
3. `get-price` and `get-order-data`.
4. `change-module-attribute` on `c`: `mod_DoorDirectionSelection` `Left`, then `mod_Width` 900
   ([library issue 80](../backlog/library-issues.md#80-wall-units-resized-with-a-fixed-door-direction-the-library-cannot-calculate)).
   The library cannot calculate `c`: "Error 14019: Could not find entry in tab_DoorSettings for
   input value: WallUnit - All - Standard - 240 - mr_StorageunitSingle - 900 - Automatic - Left -
   Automatic", then four script exceptions.
5. `get-price` and `get-order-data` again. Neither result is an error, and neither names `c` at its
   top level.

On `feat/hi-mcp` step 4 is the planner's attribute panel: the agent's `change-module-attribute` is
discarded before the load there (D106).

The probe scripts and their output are local, under
`.temp/result/probe-price-and-order-of-failed-root-modules-2026-10-24/` (`probe.mjs`,
`probe-widths.mjs`).

## What the library and the Order Manager do

The backlog item leaves open what the library's `getOrderData` does with such a root module. The
probe answers it for Furniture_Smith on `HI_PRE_Roomle_Milestone_2`:

| State | `OTB60` `c` in the order data | Its price | Price answer `errors`, `warnings` | Size of the answers |
|---|---|---|---|---|
| Calculated, 600 mm | `width` 600, `height` 720, `depth` 350; one `Configuration` item (`mf_Door`) | 214 | `[]`, `[]` | price 78 490, order 76 889 characters |
| Failed, `mod_Width` 900 with `Left` | no `width`, `height`, `depth`; the input attributes with `mod_Width` 900; the `mf_Door` item and **five `ErrorInfo` items** (`category` `Error`, `text` the full message with its stack) | **214** | `[]`, `[]` | price 81 601, order 79 945 characters |
| `d` widened to 900 mm with `Automatic` (calculated) | `width` 900 | 214 | `[]`, `[]` | — |
| `c` repaired with `Automatic` | `width` 900, no `ErrorInfo` | 214 | `[]`, `[]` | — |

- **The library keeps the root module in the order.** Its order line has the article number, the
  input attributes with the value that fails, and the sub modules. The calculated dimensions are
  missing. The library adds one `ErrorInfo` item for every `Error` message of the root module, with
  the full text and the JavaScript stack. The other order lines are unchanged.
- **The Order Manager prices the order line like any other.** The price service of the host
  (`onFetchPrice`, `/api/price/calculate`, `minimal-hi-example/index.html:721`) prices it at 214,
  the price of the article. The same backend prices an `OTB60` the library calculates at 900 mm at
  214 as well, so on this backend the amount is not what is wrong. The `ErrorInfo` items go back
  in the priced order. The answer's own `errors` and `warnings` stay empty.
- **Not known:** whether the library writes an `ErrorInfo` for a `Fatal` message or for a group
  whose calculation threw, and whether another HI library writes `ErrorInfo` at all. The format is
  the library's: `PosErrorMsg` and its categories are the interface roomle-ui documents
  (`library-errors.md`), `ErrorInfo` is not.

So the order data carries a note, but the agent cannot read it. The note is four levels deep, in an
answer of 80 000 characters with 170 attributes per order line, and its text is a stack trace. The
price answer carries the same items, with the error fields of the Order Manager empty. Nothing
tells the agent to look for them.

## Investigation trace

1. **`get-price`** (`homag-intelligence/src/hi-mcp/tool-executors.ts:658`) returns
   `roomDesignerApi.extended.fetchPrice()` as it is.
   - `fetchPrice` (`planner-core/src/roomle-planner.ts:3694`) → `Orders.fetchPrice`
     (`homag-intelligence/src/orders.ts:165`) → `getGroupDataForOrder`, then
     `_fetchOrderDataWithPrice` (`orders.ts:240`), which hands the order to the host's
     `onFetchPrice`.
2. **`get-order-data`** (`tool-executors.ts:662`) returns `orderData` of
   `getExternalObjectSnapshot({ orderData: true })` as it is.
   - `getExternalObjectSnapshot` (`roomle-planner.ts:1746`) → `getOrderManagerGroupData`
     (`roomle-planner.ts:3698`) → `getGroupDataForOrder`.
3. **`getGroupDataForOrder`** (`homag-intelligence/src/glue-logic.ts:1970`) reads the groups of the
   scene, `getPosDataOfAllGroups` (`api.ts:124`, the planner's `getExternalObjectGroups`), and hands
   them to the library's `getOrderData` (`glue-logic.ts:1993`, `homag-intelligence.ts:193`). The
   groups carry the `logMessages` of every root module. A library exception gives `null`.
4. **The agent frame passes both answers through** (`RESULTS_WITHOUT_PLAN`,
   `hi-mcp/agent-frame.ts:137`): they are the order's, not the plan's.
5. **The served text** (`hi-mcp/hi-mcp-server.ts:923-941`): "Calculates and returns the price/order
   data of the current planning situation." and "Returns the order data of the current planning
   situation without placing an order." Neither mentions a unit that is not built.
6. **Where the verdict is read today (D108).**
   - `calculationErrorOf` (`homag-intelligence/src/hi-plan-context.ts:338`) reads the first `Error`
     or `Fatal` message of a root module or a group.
   - `shapeRoot` and `shapeGroup` (`hi-plan-context.ts:730`, `:754`) put its first line into
     `calculationError`, in the plan context and in every group a tool result returns.
   - The tools that answer without groups — `change-module-attribute` and `change-group-attribute` —
     name it in a `hint` instead: `stillNotBuilt` and `compactAttributeResult`
     (`tool-executors.ts:198`, `:214`).
   - `get-price` and `get-order-data` also answer without groups and have no such hint.
   - The tool set already reads the shaped groups with one of its seven planner methods: `planGroups`
     (`tool-executors.ts:98`) is `getExternalObjectPlanContext(['groups'])`.

## Root cause

`get-price` and `get-order-data` do not read the library's verdict on the plan
(`hi-mcp/tool-executors.ts:658-669`), and their descriptions do not say that a price or an order can
include a unit that is not built (`hi-mcp/hi-mcp-server.ts:923-941`).

D108 carries the verdict on the groups. Results without groups need the `hint` that the attribute
tools got. The two tools that answer with the order instead of the plan got no hint. Their answers
contain only the library's own `ErrorInfo` items, in a format that is specific to the library and
that nothing points the agent to.

## Why the current code produces wrong results

The served text tells the agent to say that a root module with `calculationError` is not built and
never to describe it as planned (D108). Through `get-price` the agent never sees that field. The
agent answers "the kitchen costs € 1 415" for a kitchen with a wall unit that has no geometry and
no front, and the price includes that unit at the price of its article. Through `get-order-data`
the agent reads 80 000 characters in which the only mark is a nested `ErrorInfo` with a JavaScript
stack. The model may miss it, or may quote the stack to the user.

This is a gap of the tool set, not of the library. The library marks the root module in its order
data and, per D99, is responsible only for whether the value calculates.

## Proposed fix

### Decision needed (to-do 2 of the backlog item)

What `get-price` and `get-order-data` say about a root module the library could not calculate.
**Recommended:** both answers keep the planner's answer as it is and add a `hint` beside it. The
hint names every root module and group of the plan that carries `calculationError`, with the first
line of its message, and says that the price or the order includes it although it is not built.
The agent tells the user. This builds on D108 and D95 and refuses nothing (Guards Are a Last
Resort).

The decision could extend D108 ("The agent sees what the library could not calculate") or become a
decision of its own. Extending D108 keeps one rule for every result that answers without groups.

A second candidate stays out of the tools: the planner's order flow (`placeOrder`, the host's
`onPlaceOrder`) warns before it places an order that holds such a root module. That is a decision
about the planner's order, outside the HI tools. This fix does not need it.

### roomle-ui (`feat/hi-mcp`)

1. **`hi-mcp/tool-executors.ts`**
   - `get-price` and `get-order-data` read `planGroups(roomDesignerApi)` in the same `oneAtATime`
     run as the price or the snapshot. That is the plan the order was built from, and no new
     planner method is needed (D71).
   - Every group and root module with `calculationError` is named in a `hint` beside the planner's
     answer. The answer stays as it is: the price result as the host returns it, the order data as
     the library writes it.
   - The wording reuses `stillNotBuilt` with the verb as a parameter: "root module 'c1' (OTB60) of
     group 'g1' is not built - Error 14019: …". The hint ends with what the agent does: the price
     (the order) includes it without its calculated dimensions and parts, so tell the user that it
     is not built as planned, or change the value that fails.
   - A plan without such a root module gets the answer exactly as before.
   - Edge case: `getGroupDataForOrder` answers `null` when the library's `getOrderData` throws, and
     `get-price` answers `null` as well. If root modules failed in that case, the answer is
     `{ hint }`, so the agent learns why there is no price.
2. **`hi-mcp/hi-mcp-server.ts`** — the two descriptions say: when the plan holds a root module or a
   group the library could not calculate, `hint` names it; the price or the order includes it,
   but it is not built, and the answer says so.
3. **Tests**
   - `homag-intelligence/__tests__/hi-mcp/tool-executors-test.ts`: on a plan context whose group
     has a root module, and a group, with `calculationError`, `get-price` and `get-order-data` name
     both in `hint` beside the unchanged answer.
   - The same file: on a plan without one, both answer exactly as before (the existing
     `returns the fetched price` and `returns the order data of the external object snapshot`).
     A `null` answer with a failed root module gives `{ hint }`.
   - The ordering test (`tool-executors-test.ts:1525-1545`) still holds with the extra plan
     context read.
   - `__tests__/hi-mcp/hi-mcp-server-test.ts`: both descriptions name the hint.
4. **Documentation** (`.agents/homag-intelligence/`)
   - The decision (D108 extended, or its own) in §3 of `hi-tools-behaviour.md`, and the hint in §8
     beside the D108 row of the attribute tools.
   - The `get-price` section of `hi-tools-behaviour.md`, `hi-tools-reference.md`
     (`### get-price`, `### get-order-data`) and `tool-executors.md`.
   - `library-errors.md`: what the library's `getOrderData` does with a root module that carries an
     `Error` (the probe above).

### roomle-hi-example

- [`hi-mcp-tools.md`](../skills/hi-mcp-tools.md), section `get-price, get-order-data,
  get-plan-images`: the hint.
- [The wiki page](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md): the
  paragraph "roomle-ui does not take such a root module out of the price or the order …" states what
  the library and the Order Manager do and that the two tools name the root module.
- The backlog item leaves [library-calculation-gaps.md](../backlog/library-calculation-gaps.md),
  and with it the last item of the file.
- The open question of to-do 1 for [library-issues.md](../backlog/library-issues.md): the Order
  Manager prices an order line the library marks with `ErrorInfo`, and its `errors` and
  `warnings` stay empty. The price comes from the Order Manager, not from the library's
  calculation, so this is a question for the HOMAG side, not a calculation bug (D99). The decision
  is whether to record it.

## Alternatives rejected

- **Reading the `ErrorInfo` items of the order data.** They belong to the library's order format:
  another HI library may not write them, `Fatal` is not known to produce one, and their text carries
  the stack. `calculationError` is the tools' one verdict for every library (D108).
- **Leaving the root module out of the price and the order.** That changes `getGroupDataForOrder` in
  the glue logic, which the planner's own order flow uses (the Hard Rule: the Planning Assistant
  stays out of the glue logic). A price without the unit misstates the planning as well, and the
  order would lose the unit without a note.
- **An error result, or no price, while a root module is not built.** That is a guard against what
  the user may legitimately ask for: the price of the plan as it stands.
- **Writing the note into the Order Manager's `errors` or `warnings`.** Those fields are the Order
  Manager's answer. A note of the tools there would be attributed to the price service.
- **Stripping the `ErrorInfo` stacks or compacting the answers.** The answers keep their format.
  Their size, 80 000 characters for six order lines, is a separate topic and not part of this fix.

## Out of scope

- The size of the two answers: 170 attributes, `posData` and an image link per order line. The
  agent reads 80 000 characters for one price. A compact price answer would be its own analysis.
- The page's price display (`updatePriceDisplay`, `minimal-hi-example/index.html:588`) and the
  planner's order flow (`placeOrder`), which do not go through the HI tools.
