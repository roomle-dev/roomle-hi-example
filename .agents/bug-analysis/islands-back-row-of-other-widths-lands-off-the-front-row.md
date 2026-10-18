# Bug analysis — an island's back row of other widths lands off the front row

> **Type**: Bug analysis
> **Status**: Open — reproduced; served-text fix proposed, not implemented
> **Date**: 2026-10-18
> **Base**: roomle-hi-example `master` (`65c66f8`), verified on `docs/verify-mcp-74-78`;
> roomle-ui `fix/generated-part-switch-discovery` (`cf377cfd4`), descended from
> `fix/room-corners-at-openings` (`a008be42d`)
> **Backlog**: [item 74](../backlog/mcp-issues.md#74-an-islands-back-row-of-other-widths-lands-off-the-front-row)

## Affected repositories

- **roomle-hi-example** — clarify `behind` and the directions in a turned row in
  `AUTHORING_RULES` (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:30-34`); update its served-text test,
  behaviour reference, tool and authoring references. No executor change is needed.
- **roomle-ui** — only if prompt acceptance still fails after the text change: implement an
  explicit end alignment for `behind` in `pairOf`
  (`packages/web-sdk/packages/homag-intelligence/src/hi-group-layout.ts:846-860`), using docking
  endpoint modes and their reciprocal when the entry changes owner. Add geometry coverage.
  Any implementation retains `fix/room-corners-at-openings` as its required ancestry.

## Symptom and reproduction

An island has a front row of 900, 600 and 900 mm units and a back row of four 600 mm units.
Both rows total 2400 mm, but the back row stands 300 mm off at both ends, producing a step in
the generated worktop.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol 48,
`image-planning-right-wall`, the island of the second `create-or-replace-groups`; artifacts in
`.temp/result/mcp-test-2026-10-16_19-30-19/gpt-6.1-sol/48-image-planning-right-wall/`.

```text
islandleft (900)
islandhob (600) rightOf islandleft
islandright (900) rightOf islandhob
rear1 (600) behind islandright
rear2, rear3, rear4 (600) rightOf the preceding rear unit
```

Read the call from `run.json` / `planner-calls.json`, then compare the non-generated root
outlines in `plan-context.json`:

| Row | Extent along the row | Depth |
|---|---|---|
| Front | z −2940 to −540 (2400 mm) | x 1818 to 2400 |
| Back | z −3240 to −840 (2400 mm) | x 2400 to 2982 |

The successful comparison is `mcp-test-2026-10-17_13-28-41`, gpt-6-astra 52,
`kitchen-conversation`: the first rear unit stands `behind` the first front unit, and its row
continues `leftOf`. Both rows span z −2619 to −519. This is a different composition, not a
different outcome from identical input.

## Investigation trace

Code references below are in roomle-ui `packages/web-sdk/packages/homag-intelligence/src/`
unless prefixed with a repository path.

1. **The served text leaves the endpoint and viewpoint unspecified.**
   `hi-mcp/hi-mcp-server/hi-mcp-server.ts:30` says `rightOf` / `leftOf` are seen "from the front"
   without naming whose front. Line 34 describes `behind` only as back to back, turned by 180°.
   Neither sentence tells the agent which ends coincide or how to grow the turned row.
2. **The relation compiler emits no mode for `behind`.** `pairOf`
   (`hi-group-layout.ts:859-860`) emits `BackBottom → BackBottom`, offset `[0,0,0]`, with no
   `mode`. `rightOf` / `leftOf` explicitly use `StartStart` (`:848-857`). `align` is parsed at
   `:330-340`, but the `behind` branch does not use it; sending `align: "right"` has no effect.
3. **An omitted mode is not explicit `StartStart` for this vector pair.**
   `isVectorPairOnlyValidIfReverse` (`hi-root-module-arrangement.ts:505-523`) reverses the
   partner frame for two back vectors. `setModulePositionFromDocking` (`:582-614`) composes
   those frames, and applies `applyDockModeAnchor` (`:563`) only when a mode was supplied.
   With the entry on the named target, as in this reproduce, and conventional cabinet back
   vectors, the omitted-mode placement coincides with
   `StartEnd`: the target's back-vector start meets the turned unit's back-vector end. The
   turned cabinet therefore occupies the target's left end, as seen from the target's front.
   The earlier analysis's claim that omission defaults to `StartStart` is incorrect here.
4. **The side relation follows the turned neighbour's front.** After the 180° turn, `rightOf`
   grows towards the front row's left. With the front row at local x `[0,2400]`, `rear1` behind
   its last unit occupies `[1500,2100]`; the next three units grow to x −300. The back row
   occupies `[-300,2100]`. This matches the saved room-space geometry after rotation.
5. **The mirrored composition is sufficient for equal total lengths.** Put `rear1` behind
   the first front unit and continue `leftOf`: the back row occupies `[0,2400]`. A temporary
   test through the real `relationsToDocking` and `HiRootModuleArrangementOperator`
   reproduces both layouts and confirms that `align: "right"` is currently ignored.
6. **The compiler can use existing endpoint modes if an explicit end is needed.**
   `applyDockModeAnchor` selects actual endpoints in the calculated geometry, without changing
   the back-to-back rotation. For a docking entry owned by the target, `EndStart` aligns the
   turned unit with the target's right end. The reproduce then occupies `[0,2400]` for both
   rows. This works with target rotations 0°, 90°, 180° and 270°, and with a wider turned unit.

## Root cause

The omission is in the relation instructions (`hi-mcp-server.ts:30-34`): the agent must compose a
reversed row without being told its viewpoint or which end `behind` aligns. The compiler's
legitimate left-end alignment (`hi-group-layout.ts:859-860`) combines with `rightOf` in that
turned row to shift this equal-length back row by the first pair's width difference.

The library follows the supplied docking. No automatic row alignment runs after compilation,
and no result hint identifies the step: the two rows touch back to back, remain inside the room
and do not collide with other groups. Acceptance of the payload is not the cause.

## Proposed fix

### First step: explain the existing composition

Clarify the existing sentences in `AUTHORING_RULES`, in library-neutral words:

> `rightOf` and `leftOf` are seen from the named neighbour's front. `behind` turns the unit by
> 180°. For two rows of equal total length to end flush, start the group with the front row,
> put the first rear unit behind its first unit, and continue the rear row `leftOf`: the rear
> row starts at the front row's left end, seen from the front row's front.

This states both the viewpoint and the composition. It does not promise flush ends for rows
of different total lengths. Update
`it('teaches the relations for a new group instead of docking vectors')`
(`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts:1146`) and the matching documentation:
`docs/hi-mcp-behaviour.md` (D34 / relations), `docs/hi-mcp-server.md`,
`.agents/skills/hi-authoring-rules.md`, `.agents/skills/hi-mcp-tools.md`, and the implementation
reference in `.agents/context/`.

Run `image-planning-right-wall` through a model and planner after the change. The deterministic
geometry check verifies the composition, not whether the model follows the proposed sentence.

### Conditional second step: expose the end using endpoint modes

If prompt acceptance still fails, let `behind` take `align: "left"` (existing default) or
`"right"`, seen from the named neighbour's front. Preserve the omitted-mode default for existing
payloads. For `right`, compile `BackBottom → BackBottom` with `EndStart` and zero offset when
the target owns the entry. When breadth-first ordering writes the entry on the unit instead
(`hi-group-layout.ts:922-937`), mirror `EndStart` to `StartEnd`; the current compiler copies
modes unchanged because its explicit modes are symmetric `StartStart`.

The planner already supports these modes and mirrors mixed modes in reciprocal contexts
(`mirrorDockMode`, `hi-root-module-arrangement.ts:530`). Actual vector endpoints supply the
geometry, so there is no need to read catalog widths, infer a corner leg's orientation, walk
the relation chain for angles, or construct a group-space offset. The earlier width-derived
offset proposal is superseded by this simpler candidate. It still needs permanent compiler
and planner acceptance tests before implementation is declared complete.

RoomleCore, the library calculation and ligna-store require no change: the fallback uses the
existing roomle-ui endpoint machinery and both clients share the served text.

## Constraints and rejected approaches

- Do not reject different-width back-to-back units or silently align complete rows. A deliberate
  overhang or step is legitimate; the tool cannot infer otherwise.
- Do not change the default pin. Existing payloads, including the successful mirrored
  composition, keep their layout.
- Do not substitute explicit `StartStart` for an absent mode on back vectors; the numerical
  check gives different positions.
- Do not derive width offsets or add orientation tracking when actual endpoints express the
  alignment. Mixed modes must be mirrored when the entry owner changes.
- Do not change the library's worktop calculation to conceal the step or duplicate the relation
  compiler in the MCP server (D72).

## Verification and acceptance

On 2026-10-18, the saved failure and successful comparison were checked against the current
source. Local verification passed:

- 453 existing roomle-ui tests across `hi-group-layout-test.ts`,
  `hi-root-module-arrangement-test.ts`, `hi-tools-test.ts` and `glue-logic-test.ts`.
- 11 temporary geometry checks: the 300 mm step, flush mirrored composition, ignored `align`,
  right alignment with `EndStart`, four target rotations, absent mode versus `StartStart`, a
  wider turned unit, and the reciprocal `StartEnd` entry. The fixture and logs are retained
  locally in `.temp/verify-mcp-74-78/`; no production or permanent test code is changed.
- 78 MCP server registration / served-text tests.

The SDK command is `PATH=/opt/homebrew/opt/node/bin:$PATH npm run test -- --run <test paths>`
from roomle-ui `packages/web-sdk`. Homebrew Node 25.6.1 is used because the default SDK shell
selects Node 20.10.0, whose `node:util` lacks the `styleText` export required by the installed
runner. The MCP command is `npm test -- hi-mcp-server/tests/hi-mcp-server.test.ts` in `hi-mcp`.

No new live model/planner run was performed. The text change remains unimplemented. Permanent
regressions should compare both rows' endpoint extents with unequal unit widths, preserve the
default and a deliberate step, and, if the fallback is needed, cover mixed-mode entry ownership
and a target on a turned corner leg.
