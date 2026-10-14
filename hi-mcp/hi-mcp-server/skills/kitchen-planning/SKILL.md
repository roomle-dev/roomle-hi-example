---
name: kitchen-planning
description: 'Plan or review a residential kitchen: room survey, kitchen layout, sink and hob spacing, dishwasher placement, cabinet ordering, drawer organization, storage zones, short walking routes, ergonomics, accessibility, appliance clearances, and installation readiness. Use for kitchen planning, kitchen design, Kuechenplanung, arranging cabinets, or improving cooking and dishwasher-unloading workflows. Defaults to Germany/EU and millimetres; adapt rules to the actual jurisdiction.'
---

# Kitchen Planning

## Purpose and Scope

Produce practical, dimensioned residential kitchen proposals with short daily routes, usable storage, and explicit feasibility checks. Plan from activities and contents before choosing cabinet fronts. Here, cabinet "ordering" means arranging cabinets; procurement requires a separate approval gate.

Default to Germany/EU, dimensions in mm, and costs in EUR. Confirm country and, in Germany, Bundesland before applying regulatory requirements. There is no single EU kitchen-clearance code. Commercial kitchens require a separate specialist workflow.

Read [the planning constraints reference](./references/planning-reference.md) before applying numerical guidance or reviewing installation risks. It includes rule classifications, qualifications, and short source IDs for traceability. Recheck current local requirements and exact product manuals for each real project.

The [source catalog](./references/source-catalog.md) is optional. Load it only to verify a source-backed claim, answer a provenance/citation question, or update the guidance. Do not load it during routine planning merely to resolve source IDs; the operational guidance and its limitations are in this skill and the planning reference. This does not waive project-specific verification of regulations or product instructions.

## Non-Negotiable Planning Discipline

- Treat law, applicable technical requirements, product instructions, and verified site constraints as simultaneous constraints. If they conflict, stop and resolve the conflict; a manufacturer cannot waive the law.
- Do not turn a recommendation into a regulation. In particular, do not claim that a sink beside a hob is universally illegal. Usually the problem is missing preparation/landing space; actual installation restrictions are product- and site-specific.
- Unknown is not pass. Missing dimensions, manuals, or service information remain unresolved. Photographs and generated images cannot establish installation readiness.
- Use a planner's authoritative geometry, catalog, and prices where available. Never invent a catalog item, price, service point, clearance, or successful validation result.
- Optimize only after hard constraints pass. A short walking route cannot compensate for a blocked exit, unsafe installation, or inaccessible appliance.
- Offer concepts with explicit assumptions when facts are incomplete. Do not call them order-ready or installation-ready.
- Do not move services, alter structures, purchase items, or overwrite an accepted design without explicit authorization. Draft alternatives should remain reversible.

## 1. Collect the Brief and Survey

Ask only for missing information that changes the next decision. Start with room dimensions/openings, fixed services, users, appliances, and budget. Collect remaining details progressively.

| Input | Required information |
| --- | --- |
| Location and scope | Country, region, dwelling type, new build/remodel, ownership/landlord restrictions, required accessibility standard, retained items. |
| Room | Each wall length, ceiling/soffit heights, angles/diagonals, niches, columns, slopes, and finished floor levels. Measure irregular walls at relevant heights. |
| Openings | Door/window position, clear opening, frame/trim, sill height, opening direction and swept volume; curtains/blinds and window handles. |
| Services | Measured water/drain positions and heights, shutoffs, electrical points/circuits, gas, ventilation/exhaust routes, heating, meters, and service access. Mark relocation permission separately. |
| Structure | Wall construction/fixing capacity, floor/ceiling constraints, existing ventilation, room-air-dependent fireplace or combustion appliance, underfloor services. |
| People | Household size, number of simultaneous cooks, heights/elbow heights, handedness, reach/lifting ability, mobility aids, children, and future needs. |
| Activities | Shopping frequency, everyday meals, batch cooking, baking, coffee, entertaining, table setting, cleaning, waste sorting, and current annoyances. |
| Inventory | Counts and dimensions of dishes, pans, trays, containers, food, appliances, and waste bins; frequency and typical weight of use. |
| Products | Exact models or provisional envelopes, installation manuals, cabinet system, appliance niches, front/hinge system, handle projections, and worktop material. |
| Commercial | Total installed budget, service relocation allowance, delivery/access constraints, timing, and priorities ranked by the user. |

For each critical fact record `value`, `unit`, `source`, `verification_state`, and measurement uncertainty where known. Use `unknown`, `inferred`, `user_verified`, or `professionally_verified`. Preserve raw measurements and identify the finished reference surfaces.

If only a photo is supplied, request a measured plan or verified reference dimensions. Hidden pipe routes, wall strength, electrical capacity, and regulatory compliance cannot be inferred from appearance.

## 2. Build the Constraint Register

Give each rule a stable ID and classify it:

| Class | Meaning | Handling |
| --- | --- | --- |
| `regulatory` | Verified applicable legal/code requirement, with jurisdiction and edition. | Hard; no user override. |
| `manufacturer` | Exact installation/compatibility requirement for the selected product. | Hard; change the product or design if necessary. |
| `site` | Verified room, structural, service, or geometric limitation. | Hard unless an approved change creates a new verified condition. |
| `user_must` | Explicit user requirement, including a fixed budget if stated. | Hard for this brief; ask before relaxing. |
| `recommendation` | Sourced ergonomic/design recommendation or labeled planning heuristic. | Soft; document the consequence of departures. |
| `preference` | Style, symmetry, convenience, or other discretionary choice. | Soft; trade off transparently. |

Each record needs `id`, `class`, `applicability`, `requirement`, `measurement_definition`, `source`, `status`, `affected_items`, and `remedy_or_next_action`. Status is `pass`, `fail`, `unknown`, or `not_applicable`; explain exclusions. Preserve recommendation deviations rather than silently deleting them.

Complete every category in the reference's installation checklist. Record applicability separately from compliance: an unconfirmed rule is not automatically irrelevant.

## 3. Arrange Functional Zones

Use five zones as an adjacency model, not a compulsory left-to-right sequence [S1, S2]:

1. Food storage: refrigerator/freezer and dry provisions.
2. Preparation: the principal clear work surface and preparation tools.
3. Cooking: hob, oven, heat-safe landing surfaces, and cookware.
4. Cleaning: sink, dishwasher, waste sorting, and cleaning supplies.
5. Clean storage/serving: dishes, dining cutlery, glasses, and serving items.

Trace these distinct workflows:

- Shopping arrival -> grocery landing -> refrigerator/pantry.
- Food storage -> sink when needed -> preparation -> cooking -> serving.
- Table return -> scrape/sort -> sink as needed -> dishwasher. Do not prescribe routine pre-rinsing; follow appliance guidance.
- Dishwasher -> clean storage -> table/serving.
- Hob -> sink for draining hot cookware, without avoidable traffic crossings.
- Coffee/breakfast and snack access without walking through active cooking.

Keep through-traffic outside the principal work area. The refrigerator-sink-hob triangle is a diagnostic, not a mandatory geometry or a substitute for these workflows. A one-wall kitchen can work without a triangle. Mixed-handed or multi-cook households need task trials, not automatic mirroring.

### Sink, Preparation Surface, and Hob

Prefer `sink -> continuous preparation surface -> hob`, or the mirror image. Blum recommends approximately 900 mm of preparation width, with 800 mm as its lower ergonomic recommendation [S3]. These are not German legal minimums. More space may be needed for two cooks or extensive baking.

Measure usable clear surface between fixture edges, excluding an occupied drainer, permanent appliances, or other obstructions. Record actual usable depth too. Separately verify cut-out-to-cut-out webs, edge distances, and supports from the worktop fabricator; a visible surface gap does not prove structural suitability.

Avoid placing a tall cabinet across this continuous workflow. Keep the preparation surface genuinely available after locating the kettle, coffee machine, knife storage, and drying area. Where the room cannot accommodate the recommendation, disclose the compromise and test an adjacent alternative preparation surface.

### Dishwasher and Clean Storage

- Start with the dishwasher beside the sink, subject to plumbing, appliance instructions, and usable access. Prefer a side outside the main preparation stance when feasible.
- Compare both sides of the sink. Do not prescribe left/right solely from handedness.
- Locate everyday dining cutlery, plates, and bowls in an adjacent or nearby accessible drawer bank. Locate daily glasses and cups within comfortable reach nearby [S4].
- Aim for a comfortable turn or short step during unloading. This is a qualitative target, not a universal distance limit.
- Check dishwasher fully open, racks extended, destination drawer open, and a person standing in the unloading position. Neither nominal adjacency nor cabinet-centre distance establishes usability.
- Across an aisle can work only if the actual door/drawer projections, standing space, reach, and circulation work together. Never require stepping over a dishwasher door.
- At an inside corner, check perpendicular drawer collisions and access to the sink/waste. Move the dishwasher or storage bank if fillers alone cannot solve the conflict.
- Keep dining/table access convenient without routing other people through the hot zone. Do not put every item beside the dishwasher: cooking tools still belong at their principal point of use.
- Consider a raised dishwasher for users who benefit, but validate approved support, niche, front mechanism, rack heights, and adjacent unloading space.

## 4. Assign Contents Before Cabinet Sizes

Create the storage schedule first. Then fit catalog modules around the fixed zones.

| Contents | Preferred home | Checks |
| --- | --- | --- |
| Dining cutlery | Shallow upper drawer near dishwasher and dish storage. | Organizer fits internally; accessible with dishwasher open. |
| Everyday plates/bowls | Full-extension drawer in the same or nearby bank. | Plate diameter, stack height, restraint, loaded runner capacity, comfortable lifting height. |
| Glasses/cups | Reachable nearby shelf, lift-front cabinet, or suitable drawer. | Safe reach, glass height, retention, opening clearance; not forced overhead. |
| Preparation knives/tools | Upper drawer at principal preparation surface. | Blade protection, child security, separation from dining cutlery. |
| Boards/trays | Vertical divider storage near preparation/oven. | Actual tray dimensions and removal path. |
| Pans/pots/lids | Full-extension storage beside or below hob where permitted. | Heat separation, hob underside, ventilation and extractor/oven volume. |
| Spices/oils | Near preparation/cooking, protected from heat/light/moisture. | Not directly exposed to hob heat or steam. |
| Mixing bowls, scales, baking tools | Preparation/baking zone. | Nesting, appliance weight, lifting distance, and usable drawer height. |
| Dry food | Pantry/pull-outs near grocery landing and preparation. | Stock volume, visibility, shelf adjustment, runner loads. |
| Waste/recycling | Accessible from preparation and sink. | Local sorting streams, bin removal, odours, and access while dishwasher is open. |
| Cleaning chemicals | Separate secure storage, often near sink. | No food/clean-utensil mixing; child access, plumbing and leak clearance. |
| Food containers/lids | Near preparation, leftovers packing, and dishwasher. | Paired or divided organization; capacity for actual inventory. |
| Small appliances | At use location or reachable storage. | Operating footprint, lid opening, steam, power, ventilation, weight. |
| Rarely used items | Less accessible but safe locations. | Do not put heavy objects overhead simply because they are infrequent. |

Prefer full-extension drawers for frequently used base storage [S4, S5]. Upper shallow drawers suit small tools; deeper drawers suit bulky items, but choose heights from actual contents, not a fixed three-drawer formula. Prioritize heavy frequently used items at a comfortable lifting height rather than automatically on the lowest level.

Compare wide drawer banks with multiple narrow cabinets using usable capacity, load, cost, and multi-user access. A wide open drawer can block another cook. Compare corner mechanisms with a deliberately unused corner plus accessible straight drawers; maximum gross volume is not necessarily best value.

For each cabinet record: `id`, `zone`, `catalog_id_or_provisional`, external dimensions, usable internal dimensions, contents, load, opening direction/extension, fittings, and reason for location. Include fillers, end panels, scribes, plinths, supports, and tolerances in each run. Never assume nominal width equals usable storage or appliance niche width.

## 5. Generate and Check Alternatives

Develop two or three genuinely different feasible options when geometry permits, for example retained services versus improved workflow. Do not force an island or a U-layout into a room that cannot support it.

For each option:

1. Place immovable constraints and reserve circulation/accessibility envelopes.
2. Locate sink, principal preparation area, hob/extraction, and refrigerator landing.
3. Fit dishwasher, waste, and nearby clean storage as a working group.
4. Allocate remaining storage and secondary tasks from the inventory.
5. Fit actual modules, fillers, worktops, panels, and service voids.
6. Check 3D fit, closed projections, full swept openings, service access, ventilation, and installation tolerances.
7. Run the task trials below. Repair hard failures before comparing soft preferences.

Required trials: unload a full dishwasher; prepare/cook a typical meal; drain a heavy pot; set/clear the table; put away groceries; remove waste; and let a second person reach drinks while cooking continues. Include the actual accessibility/child-use scenarios in the brief.

Check necessary simultaneous openings, especially dishwasher plus receiving drawer, refrigerator door plus internal drawer, sink/waste plus dishwasher, and perpendicular corner units. Not every door must open simultaneously, but the normal task combinations must work. Record remaining conflicts and their consequences.

Measure travel along collision-free walkable paths between usable standing positions, with task-specific openings represented. Do not measure straight through an island or across an open door. Without a geometry/path tool, use a clearly labeled manual estimate or `unknown`; do not fabricate precision.

### Compare Everyday Effort

Use lexicographic priorities: hard feasibility first, essential usability/storage second, daily effort third, then cost/style trade-offs within the agreed brief.

For a transparent optional distance estimate, calculate:

`daily_travel_m = sum(task_cycles_per_day * sum(trip_count_per_leg * walkable_leg_length_m))`

Define each leg as a one-way movement. Include return legs explicitly where they occur. For unloading, use realistic batches carried per trip, not one trip per plate and not an implausibly heavy stack. Use the same inventory, carry capacity, and task frequencies for every option. Label assumed frequencies and distances.

Report bending/high reaching, awkward lifts, door conflicts, and traffic crossings separately; do not add metres, counts, and money without explicit normalization and user-agreed weights. Never label a heuristic score a certified optimum or claim percentage savings without a baseline calculation.

## 6. Deliver the Plan

Return a concise recommendation followed by:

1. Brief, assumptions, missing measurements, and readiness status.
2. Dimensioned layout, orientation, appliance locations, and clear work surfaces. If no drawing tool exists, supply wall-by-wall cabinet sequences with dimensions, not an invented rendered plan.
3. Cabinet/drawer schedule specifying exactly what goes where.
4. Dishwasher-unloading explanation: standing position, receiving drawers/cup storage, openings, paths, and compromises.
5. Alternatives table: hard failures/unknowns, preparation space, usable storage, travel estimate, ergonomics, installed cost confidence, and trade-offs.
6. Constraint report with rule IDs, measurement definitions, evidence, pass/fail/unknown, and remedies.
7. Action list assigning survey, electrical, plumbing, ventilation, structural, accessibility, and installation checks to the appropriate reviewer.

Use the status `concept`, `dimensionally_checked`, or `ready_for_professional_order_review`. The last status requires verified survey, exact product compatibility, complete parts/cost scope, and no unresolved hard constraint. It is not professional installation approval. When required reviewers approve, record who approved what and against which plan/manual revisions before any separate order authorization.

If no feasible layout exists, identify the conflicting constraints and smallest changes to consider, such as reducing an island, changing an appliance, or obtaining approval to relocate services. Never silently shrink a required clearance or alter a user must-have.

## Quality Checks for This Skill

Before delivering a plan, verify these counterexamples are handled correctly:

- Sink beside hob: report preparation-space and installation checks, not an invented EU prohibition.
- Dish drawer close to dishwasher but behind its open door: reject the unloading arrangement despite the short nominal distance.
- Short route through an island: replace it with a walkable route or mark distance unknown.
- Attractive layout with unknown hood clearance: keep installation readiness blocked.
- Single-wall or mixed-handed kitchen: use task-based zoning without forcing a triangle or handedness rule.
- Wheelchair brief: invoke applicable accessibility checks and user trials; a generic aisle recommendation is insufficient.
- Best geometric score but insufficient plate storage or overloaded drawers: do not recommend until capacity/load are resolved.
