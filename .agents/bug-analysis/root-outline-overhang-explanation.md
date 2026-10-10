# Explain root outlines that extend over a neighbour

> **Date**: 2026-10-10
> **Status**: Fixed locally — MCP clarification; library-description work remains in #60
> **Ticket**: [RML-18103](https://roomle.atlassian.net/browse/RML-18103)
> **Backlog**: Plan-context finding #2

## Affected repositories

- **roomle-hi-example** — clarify the outline semantics in the served authoring rules and get-plan-context description, document them and consolidate the article-description follow-up in library issue #60.

## Root cause

The plan context's root outline bounds its calculated parts, not its docking edges. Geometry that reaches beyond a root's nominal width legitimately extends over a neighbour in the same group. The served obstacles text lists the outline but does not explain that distinction, so an agent can read an intended overhang as a misplaced root.

## Reproduction

A read-only local planner probe of Open-Plan Room ps_qwm5odi6tyflyqwpdcxz1la791ho633 confirms SUBA60 root cdca7a4b-f4d7-4fd1-a56e-07157a35cdcb in group c2b9fe06-9bef-4fb3-b7bf-c44f72ce09aa has width 600 mm, rotation 270 degrees and an outline spanning 995.75 mm along the row (room z 3713.36 to 4709.11). The outline correctly includes the sink geometry. Evidence: /tmp/root-outline-overhang-probe.json.

The live full descriptions of SUBA60 and SUT60 both omit the sink/drainer overhang. The article catalog is fetched from HOMAG; docs/library-information is a generated record, not its authoring source. Library issue [#60](../backlog/library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) already asks for this information for every sink unit and is reported to the library development team. Add SUBA60's evidence there rather than duplicate that open work in the plan-context backlog.

## Implementation

Explain in both the authoring rules and the get-plan-context tool description that root outlines bound calculated parts, can extend beyond docking edges over a neighbour in the same group, and that this overlap alone is not a placement error. The sentence is library-neutral and introduces no guard or geometry correction. Article-specific widths, drainer sides and support requirements remain library data.

Update the behaviour reference, tool reference and skills with the same semantics. Remove finding #2 after verifying the served text; retain the unresolved library-description work in #60. No roomle-ui, RoomleCore, ligna-store or generated-catalog change is indicated.

## Verification

All 358 existing MCP registration/served-text and executor tests pass; workspace typechecking, lint, formatting and documentation links pass. Direct HTTP MCP checks confirm initialize, get-authoring-rules and the get-plan-context tool description deliver the outline explanation without library article ids. The geometry is unchanged; the live probe establishes why clipping the outline or treating every same-group overlap as an error would be incorrect.

Finding #2 was removed from the plan-context backlog. Library issue #60 retains the missing sink description and now explicitly includes SUBA60, the current live evidence and the requirement that the compact catalog carries the overhang information. The external HOMAG descriptions were not changed.
