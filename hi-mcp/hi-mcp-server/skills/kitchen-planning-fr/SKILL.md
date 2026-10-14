---
name: kitchen-planning-fr
description: "Plan or review a residential kitchen in France, from the measured brief to a proposal for professional order review. Use for French kitchen layouts, cuisine amenagee or equipee, NF C 15-100 planning checks, VMC and hood coordination, copropriete renovation constraints, furnished-rental equipment, sink/preparation/hob placement, dishwasher unloading, and cabinet or drawer allocation. France-first, metric guidance that distinguishes applicable requirements from ergonomic recommendations and household preferences. Not installation certification or a commercial-kitchen design standard."
---

# Kitchen Planning for France

## Purpose and scope

Produce a usable, measurable residential kitchen proposal for a project in France. Default to millimetres and EUR; confirm territory, budget basis, building type, tenure, and work scope before applying requirements. Respond in the user's language; keep French trade terms when they improve coordination.

This is a self-contained specialization of the workspace kitchen-planning approach. It does not require loading the Germany/EU skill. Use [the planning reference](references/planning-reference.md) for detailed checks, evidence qualifications, and worked examples.

The [source catalog](references/source-catalog.md) is optional. Load it only to verify a claim, provide citations, or update guidance. Do not load the bibliography merely to resolve source IDs: operational qualifications are already in this skill and the planning reference.

## What is specifically French?

There is no single "normal European kitchen" or uniform French kitchen style. French-market layout guidance uses the same preparation, cleaning, cooking, and point-of-use storage principles as other European guidance (FR-S5).

| Planning topic | France-specific adaptation |
| --- | --- |
| Electrical installation | Establish the applicable NF C 15-100 edition and work scope; distinguish ordinary kitchen sockets from specialized appliance circuits. |
| Ventilation | Identify the actual natural ventilation or VMC system, collective or individual, before choosing a hood or moving a cooking zone. |
| Renovation authority | Ask about copropriete, landlord consent, common services, structure, and exterior alterations; do not treat a kitchen seller's drawing as permission. |
| Rental brief | Distinguish owner occupation, location nue, furnished principal-residence lease, and tourist accommodation; their equipment and legal scopes are not interchangeable. |
| Accessibility | Determine applicable French housing provisions and user needs. Do not relabel German DIN dimensions as French compliance. |
| Procurement | Resolve cuisine amenagee/equipee labels into an itemized equipment and works schedule, a devis, and an installed TTC budget. |
| Lifestyle | Ask about actual cooking, meals, pantry and serving needs. Gas, wine storage, an island, rustic fronts, and elaborate cooking are not national requirements. |

These topics are not all unique to France; their governing documents, terminology, and project decisions are localized here.

## Authority and evidence

- Classify constraints as `regulatory`, `manufacturer`, `site`, `user_must`, `recommendation`, or `preference`.
- The first four are hard constraints when applicable. Recommendations and preferences are soft and may be traded off explicitly.
- A published standard is not automatically a universal retroactive legal obligation. Establish the applicable regulation, standard edition, contract, project dates, and scope with the responsible professional.
- A manufacturer summary is not the full standard. A product-specific installation requirement is different from that manufacturer's general planning advice.
- Never convert an unknown to a pass. If requirements conflict, stop the affected decision and obtain clarification; do not select the convenient rule.
- Photographs, scans, inferred dimensions, catalog nominal widths, and AI drawings do not replace a site survey or exact product documentation.
- The planner's geometry, catalog, prices, and accepted design remain authoritative. Propose reversible edits and obtain acceptance before changing the design.
- Do not claim electrical, gas, structural, ventilation, accessibility, rental, or installation certification. Do not authorize purchases or works.

## Workflow

### 1. Establish the French project brief

Collect only the missing facts needed for the next decision; allow assumptions for concepts, clearly marked.

- Commune and territory: metropolitan France or the relevant overseas territory; do not silently apply metropolitan rules overseas.
- Apartment or house, approximate construction date, new build or existing dwelling, occupied or vacant during works.
- Owner or tenant; copropriete and syndic contact where relevant; private versus shared walls, ducts and service risers.
- Cosmetic replacement, partial technical renovation, complete electrical renovation, kitchen relocation, or structural alteration; project and permit/contract dates if relevant.
- Owner occupation, location nue, location meublee as a principal residence, bail mobilite, or tourist/secondary-residence use.
- Household size, simultaneous cooks, children, reach and mobility needs, wheelchair or seated work, and any applicable accessibility brief.
- Cooking frequency, appliance inventory, shopping/storage quantities, dining location, entertaining, and cleaning habits.
- Total installed budget in EUR TTC, retained items, time constraints, and responsibility for each trade.

Ask whether the household needs a table/coin repas, separate dining area, cellier, baking area, coffee station, large serving dishes, or bottle storage. Derive dimensions from their inventory and routines, not nationality.

### 2. Survey the room and services

Record wall lengths at relevant heights, diagonals, finished floor levels, ceiling height, wall build-ups, out-of-square corners, windows and opening arcs, doors, radiators, obstructions, and structural uncertainty.

Locate water, waste, isolation valves, electrical outlets and known circuit identities, gas if present, ventilation terminals, air inlets, ducts, and service access. Record delivery access, stairs, lift restrictions, and worktop handling constraints.

For each fact capture `value`, `unit`, `source`, `verification_state`, and measurement uncertainty. Use `unknown`, `inferred`, `user_verified`, or `professionally_verified`. Measure service positions from a declared datum and finished floor; do not infer concealed routes from visible endpoints.

### 3. Build the constraint register

Each record needs:

```text
id
class
applicability
requirement
measurement_definition
source
status: pass | fail | unknown | not_applicable
affected_items
remedy_or_next_action
```

Run the French context checks in the reference before freezing a layout. Identify the person responsible for resolving each technical unknown.

- Electrical: confirm applicable edition and renovation scope with an electrician; reserve ordinary outlets separately from appliance connections. Socket count alone cannot establish compliance.
- Ventilation: a hood does not replace general dwelling ventilation (FR-S3). Preserve air inlets, transfer paths and extraction terminals. A visible communal shaft is not an approved powered-hood connection.
- Permissions: flag changes affecting shared services, structure, exterior outlets, or rented premises for the relevant professional, landlord, syndic, and authority checks before works.
- Rental: for a furnished principal-residence lease, check the scoped equipment list in the reference (FR-S4). Do not apply it to every kitchen or treat it as a complete rental-compliance assessment.
- Accessibility: establish applicable French requirements separately from ergonomic targets; unresolved legal applicability blocks a compliance claim, not an explicitly provisional concept.

### 4. Arrange five functional zones

Map food storage, preparation, cooking, cleaning, and clean storage/serving to real tasks. Prefer sink -> clear preparation surface -> hob, or its mirror, where the room allows it.

Provide a continuous useful preparation area, not a nominal length occupied by a drainer, appliance, corner, or landing zone. As an ergonomic starting point, aim for about 900 mm clear width; around 800 mm is a lower recommendation from manufacturer planning guidance, not a French statutory minimum (FR-S6). Check actual tasks and product cutout/edge requirements separately.

Do not invent a universal French 600 mm sink-to-hob prohibition. Assess splashing, heat, pan handles, worktop bridges, adjacent materials, and exact product requirements. A compact compliant layout can still have poor preparation space.

Keep grocery-to-fridge, washing-to-preparation, cooking-to-serving, and dirty-dish routes short and unobstructed. A triangle is an optional analytical aid, not a rule; a linear kitchen can work well. Separate through-traffic from hot work where feasible.

### 5. Design dishwasher unloading and storage together

Start with the dishwasher near the sink, subject to verified connection limits and usable access. Decide which side by actual unloading and loading tests, not handedness alone.

Test all of these together: dishwasher door open, racks extended, receiving drawer or cupboard open, and a person standing and turning. Do not make the user step over the door or balance dishes while opening storage.

Put everyday plates, bowls and dining cutlery close to a safe unloading position and the serving route. Put cooking utensils, pans and preparation tools near their use. Check that the shortest storage route remains accessible with doors open. A slightly longer unobstructed route can be better than blocked adjacent storage.

### 6. Allocate cabinets and drawers by contents

Create a schedule with cabinet ID, location, contents, quantities, largest item size, usable internal dimensions, load limit, opening mechanism, access frequency, and service conflicts.

- Use accessible drawers or pull-outs for frequently handled base storage where appropriate; check heavy dish stacks and hardware loads (FR-S7).
- Separate dining cutlery from cooking utensils. Give pans, lids, boards and trays usable storage near preparation/cooking.
- Size pantry storage to shopping habits; a cellier supplements but does not automatically replace daily point-of-use storage.
- Provide safe storage for knives and cleaning products, and a waste-sorting arrangement matching local collection and the household's carrying route.
- Keep shutoffs, traps, filters and appliance removal paths accessible. Under-sink space is not an empty rectangular cabinet volume.
- Use exact cabinet/appliance combinations: nominal 600 mm widths do not prove integration, ventilation, hinge, front, plinth or worktop compatibility.

### 7. Compare feasible alternatives

Normally compare two plausible layouts, such as a service-preserving option and a user-priority option. Include an island only if occupied circulation, services, budget and work surfaces support it.

Test grocery unloading, preparing a meal, draining a hot pan, dishwasher loading/unloading, serving, waste removal, and two people sharing the room. Include chairs pulled out, doors and drawers open, and a person at the oven. Test task lighting, glare, extraction noise and sightlines for an open kitchen.

Use 1000-1200 mm single-cook and 1200-1500 mm shared working aisles only as concept heuristics between the nearest closed projections, not French legal or wheelchair clearances. Then test actual open-state and occupied clearances; apply verified project requirements instead where stricter.

For repeated tasks, estimate:

```text
daily_travel_m = sum(task_cycles_per_day *
                    sum(trip_count_per_leg * walkable_leg_length_m))
```

Count return trips explicitly. State assumptions; compare bending, awkward reaches, handling and collision risks separately. Do not present this proxy as a validated human-performance score.

### 8. Resolve the devis and installation boundaries

Translate cuisine amenagee/equipee into explicit inclusions, never assumed legal definitions. List meubles, facades, fileurs, joues, plinthes, plan de travail, credence, evier, robinetterie, electromenager, and fittings as applicable.

Separate supply, delivery, carrying, removal/disposal, preparation works, plumbing, electrical/gas work, ventilation, fitting, worktop templating/cutouts, finishing, testing and handover. Record exclusions, tax basis, quote validity, allowances and who owns final measurements. Do not promise a reduced VAT rate or a fixed total without a verified quote.

Ask the cuisiniste and trades to resolve interfaces before final ordering: sockets behind drawers, sink/trap versus bin, dishwasher front versus plinth, duct versus wall unit, and opening clearances versus fileurs are common coordination risks.

### 9. Deliver and gate readiness

Provide the brief and assumptions, dimensioned plan with opening envelopes, zone/task rationale, cabinet contents schedule, appliance/service schedule, constraint register, alternatives and trade-offs, installed-cost scope, and professional questions/next actions.

Use one readiness status:

- `concept`: assumptions or unresolved geometry/services remain; no order-ready implication.
- `dimensionally_checked`: stated geometry and operating envelopes checked against identified measurements and product data; list unresolved regulatory/technical matters separately.
- `ready_for_professional_order_review`: required survey, exact product compatibility, service feasibility, applicable permissions, and hard constraints have supporting evidence with no unresolved failures or unknowns. This still requires professional order review and is not installation approval or purchasing authorization.

Never call a proposal "French-compliant" solely because it follows this skill.
