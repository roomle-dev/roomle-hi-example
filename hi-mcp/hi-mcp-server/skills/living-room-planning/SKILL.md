---
name: living-room-planning
description: "Plan or review a living room, lounge, sitting room, or Wohnzimmer using household activities, verified geometry, and practical furniture constraints. Use when arranging sofas, armchairs, recliners, sofa beds, coffee tables, TV/media units, bookshelves, or storage; comparing conversation and TV layouts; checking circulation, accessibility, lighting, glare, child safety, or open-plan living zones. Defaults to Germany/EU context and metric units; separates requirements from ergonomic recommendations and preferences. Includes operational checks and an optional research source catalog."
---

# Living Room Planning

## Purpose and loading policy

Create practical, explainable living-room proposals that work for the household's real activities. Optimize comfort, access, storage, and ease of changing activities before decorative composition or maximum furniture count.

Default to Germany/EU context, dimensions in millimetres, and costs in EUR unless the user specifies otherwise. Confirm the actual country and, where relevant, German federal state. There is no single set of EU living-room layout rules.

- Read [the planning reference](./references/planning-reference.md) before applying numerical guidance, assessing accessibility or installation risks, or declaring a layout dimensionally checked.
- Read [the optional source catalog](./references/source-catalog.md) only to verify a source, answer provenance/citation questions, resolve disputed claims, or update guidance.
- Do not load the source catalog merely to resolve source IDs during routine planning. The operational reference contains the qualifications needed for normal use.
- This skill supports planning, not structural design, electrical installation, fire-safety approval, clinical assessment, or permission to purchase.

## Non-negotiable discipline

1. Distinguish measured facts, assumptions, user preferences, recommendations, and mandatory requirements.
2. Never infer exact room dimensions, wall construction, load capacity, or safe clearances from a photograph alone.
3. Preserve the existing planner's authoritative geometry, product catalog, and accepted design. Proposals are reversible drafts until explicitly accepted.
4. Check occupied, moving, and fully deployed furniture, not just closed footprints. A sofa bed's sleeping surface is not its overall deployed size.
5. Do not treat a reachable-looking gap, generic furniture dimension, or aesthetic rule as proof of accessibility or safety.
6. Keep required exits and escape openings usable in every relevant mode. A blocked exit is not acceptable because guest use is infrequent.
7. Unknown is not pass. Missing critical dimensions or installation evidence must remain visible.
8. Do not prescribe a TV, fireplace, large sectional sofa, rug, or symmetry unless it serves the brief.

## 1. Establish the brief and survey

Ask only questions that can change the next decision; group missing information instead of sending a long questionnaire. Start with daily occupants, activities, existing furniture to retain, room geometry, and budget. If measurements are missing, offer a labelled concept and a concise measurement list.

Capture:

| Subject | Required information |
| --- | --- |
| Household | Daily and visiting occupants; children; mobility aids; reach, vision, hearing, balance, transfer, and sensory needs; foreseeable changes |
| Activities | Conversation, TV/gaming, reading, music, play, exercise, hobbies, occasional work/dining/sleeping; priorities, frequency, duration, and simultaneous use |
| Geometry | Room outline, ceiling/slopes, columns, niches, skirtings, changes in level, actual door and window positions, sill heights, handles, opening arcs, thresholds |
| Connections | Entrance, adjacent rooms, kitchen/dining area, balcony/terrace, required exits and escape openings; routes used while carrying items |
| Services | Radiators, thermostats, ventilation openings, fireplace/stove and hearth, sockets, switches, data/TV points, ceiling outlets, fixed lighting |
| Daylight and sound | Window orientation, glare at typical viewing times, shading, street/neighbour noise, adjacent bedrooms, reflective surfaces |
| Products | Retained pieces and exact candidate models; external and usable internal dimensions, weight/load limits, open/deployed sizes, anchoring and ventilation instructions |
| Inventory | Books, games, toys, blankets, media devices, controllers, chargers, hobby/work items, guest bedding; quantities, sizes, weights, access frequency |
| Delivery and work | Building entrance, stairs, lift, door turns, package dimensions, assembly space, wall permissions, access for installers and later servicing |
| Preferences and cost | Must-keep items, comfort trials, style/materials, cleaning needs, budget including delivery/assembly, wiring, mounting, shading, lighting, and disposal |

For each critical fact record `value`, `unit`, `source`, `verification_state`, and uncertainty/tolerance. Use `unknown`, `inferred`, `user_verified`, or `professionally_verified`. A product's nominal width does not prove the available room width.

Create an activity table with `mode`, `users`, `frequency`, `simultaneous_activities`, `required_items`, `deployed_state`, and `reset_steps`. Distinguish daily seats from occasional guest seats. Do not count the same floor area twice for simultaneous activities.

## 2. Build a constraint register

Use these classes:

- `regulatory`: verified, applicable local requirements; record jurisdiction and edition.
- `manufacturer`: exact product instructions, clearances, loads, mounting, and intended use.
- `site`: verified fixed geometry, services, structural limits, and permissions.
- `user_must`: explicit non-negotiable household requirements.
- `recommendation`: ergonomic or functional advice, including labelled planning heuristics.
- `preference`: negotiable visual or lifestyle choices.

The first four classes are hard constraints. The latter two are soft unless explicitly adopted as a project requirement. Identify safety hazards even when their legal classification is unverified; do not bury them in an aesthetic score. A user preference cannot waive a mandatory requirement.

Record `id`, `class`, `applicability`, `requirement`, `measurement_definition`, `source`, `status`, `affected_items`, and `remedy_or_next_action`. Status is `pass`, `fail`, `unknown`, or `not_applicable` with a reason. Include the room mode in each state-dependent check.

Resolve conflicting requirements explicitly. Reject hard failures from viable options; separate options needing missing evidence from checked options. Escalate wall loading, fixed electrics, combustion/hearth conditions, or accessibility compliance to the appropriate professional.

## 3. Reserve routes and activity zones

1. Mark fixed features, required access, opening arcs, and no-go areas before placing furniture.
2. Connect the entrance to used seats, storage, adjacent rooms, windows, and balcony along genuinely walkable paths.
3. Prefer through-routes outside the conversation group and TV sightline where geometry permits. Show the compromise when a through-room makes this impossible.
4. Size the main zone for daily activities; reserve secondary zones only where the brief requires them.
5. Test daylight and noisy/quiet activities together. A shelf or curtain can separate views without providing acoustic privacy.
6. Locate movable furniture's parking positions. A coffee table moved for a sofa bed must not be parked in a doorway or another required activity zone.

Possible strategies include facing/angled seating for conversation, sofa plus movable chairs for mixed use, a media-oriented group, or distinct quiet/active zones. These are alternatives, not mandatory room types.

## 4. Fit the seating to the users

- Select usable seat width, seat depth, compressed seat height, support, armrests, and ease of standing through user trials, not a universal ideal sofa size.
- Count seats that people can actually use together. A chaise, corner junction, ottoman, or armless end is not automatically an equivalent full-time seat.
- For conversation, arrange faces so users can hear and see each other without sustained twisting. Try angled chairs or more than one small group before enlarging a distant perimeter arrangement.
- Check entry to each seat, knees/feet, standing, transfers, walking-aid parking, swivel arcs, recliner mechanisms, and access to controls.
- Position drinks, a book, glasses, and remotes within comfortable reach. A side table can serve a seat better than a large central table.
- Treat coffee-table reach space and through-circulation as different things. An easy-to-reach table gap is not a corridor.
- Verify sofa-bed deployment, bed-making, access to bedding, night-time routes, and the effort/strength needed to operate it. Do not assume an occasional sofa bed is suitable for regular sleep.

## 5. Locate TV, media, and listening equipment

Only apply this step when relevant to the brief.

1. Identify primary and secondary viewing seats and measure actual seated eye positions.
2. Start with the screen centre near seated eye level, then trial the real posture, screen size, subtitles, and viewing comfort. Do not choose a fixed mounting height from the floor alone (S3, S4).
3. Choose viewing distance with screen size, resolution, content, eyesight, and preference. There is no universal distance multiplier suitable for every user (S5).
4. Check horizontal viewing positions, head turning, and sightline obstruction from every claimed TV seat. The panel's specified viewing angle is not a comfort guarantee.
5. Check reflections from windows and luminaires at typical times. Side-on placement to windows is a candidate, not an automatic glare solution; verify with the actual room and shading.
6. Check exact TV foot spacing/depth, furniture load capacity, anti-tip measures, bracket compatibility, wall substrate, and cable strain through mount movement. A wider cabinet alone does not prevent tipping (S3, S8).
7. Allow actual device ventilation, connector depth, plug removal, service access, and remote/signal operation behind doors. An opening for cables does not establish adequate cooling.
8. Position speakers using product guidance, listening trials, and neighbour considerations. Do not promise acoustic isolation from rugs, curtains, or decorative panels.

Do not default to a TV above a fireplace: both viewing posture and verified heat/installation limits must work. An unknown heat condition blocks mounting approval.

## 6. Assign contents before choosing storage

| Contents | Preferred relationship | Operational check |
| --- | --- | --- |
| Remotes, glasses, current book | At the relevant seat | Reach while seated; no risky leaning or trailing charger |
| Games and controllers | Near play/media area | Access and return without disconnecting equipment or clearing occupied seats |
| Toys | Near the agreed play area | Child access where appropriate; anchoring, lid/pinch risks, tidy-up route |
| Books and records | Near reading/listening area | Real shelf depth, load limits, adjustable spacing, safe retrieval |
| Throws and cushions | Near relaxation seats | Storage opens while people are seated; no need to empty the tabletop |
| Guest bedding | Near sofa bed | Retrieve before/during deployment; dry storage and manageable lifting |
| Work or hobby equipment | Near its use zone | Fast setup/reset, suitable work surface, secure storage where needed |
| Hazardous or fragile items | Controlled location | Access restrictions appropriate to household; height alone is not a lock |

Use internal clear dimensions, hinges, drawer travel, shelf loads, and actual object sizes. Locate frequent items for easy retrieval; avoid heavy overhead storage. Compare closed storage for clutter control with open storage for access/display, without sacrificing equipment cooling.

Storage should reduce repeated interruptions: getting up, asking someone to move, reaching across a screen, unloading a tabletop to lift a lid, or shifting furniture. Shorter walking distance is useful only when access remains safe and convenient.

## 7. Integrate light, environment, and safety

- Combine general, task, and ambient/accent lighting with independently usable controls (S2). Reading needs suitable light on the page, not just a bright room.
- Check source glare, reflected screen glare, contrast, shadows, and seated/standing sightlines. Place switches where users can reach them on entry and at key seats; retain usable non-app control.
- Plan cables and outlets before accepting floating furniture. Do not hide extension leads under rugs or use cable routing that creates trip, pinch, or heat hazards. Fixed electrical alterations require qualified work.
- Keep radiator heat flow, thermostat sensing, and ventilation unobstructed (S7). Check exact installation instructions and any cold/damp wall concern; do not invent a universal furniture-to-wall gap.
- Treat required furniture/TV anchoring as part of the layout. Verify suitable wall/floor construction and fixings; an unknown wall is not a passed mounting check (S8).
- Address climbing access to windows, accessible blind cords, unstable tall furniture, loose rugs, sharp/glass edges, hot surfaces, and moving mechanisms. Prefer cordless window coverings around young children; moving furniture alone does not eliminate cord hazards (S9).
- For echo, consider appropriate absorptive furnishings subject to cleaning, trip, and fire constraints. Speech privacy, bass transmission, and sound isolation require different assessment; do not invent decibel improvements.
- If sustained work or dining is required, check a suitable table/chair/task-light setup. A sofa with a laptop tray is not evidence of an ergonomic full-time workstation.

## 8. Generate and test alternatives

Offer two or three meaningfully different layouts when useful, not multiple cosmetic versions. Preserve existing furniture when it meets the brief. Explain when only one credible option fits.

For each option test the required states:

- Normal day with the usual seats occupied.
- Conversation/guests with occasional seats placed and used.
- TV/gaming with sightlines, glare, and controller/device access.
- Reading/work/play occurring simultaneously where requested.
- Recliners, drawers, doors, swivel chairs, and sofa bed through their full motion and deployed states.
- Night-time access, window operation, cleaning, servicing, and eventual furniture removal.

Measure the narrowest clear route between actual obstacles, including occupied feet/knees and deployed parts. Check turning and approach geometry as well as width. Use tolerance-aware dimensions; marginal clearance with unverified geometry remains unknown.

Use scaled geometry checks where available and full-size tape/cardboard mock-ups with user trials where practical. Describe exactly what was checked; a language-model review alone is not deterministic collision validation.

Compare options by hard failures/unknowns first, then daily comfort, circulation, conversation/media suitability, storage access, reset effort, light/glare, maintenance, cost, and preferences. Let the user set priorities; do not invent authoritative scoring weights.

Count furniture moves, lifting, setup time, interruptions, and actual walkable trips for repeated routines. State assumptions and frequency. Do not optimize walking distance at the expense of comfort, inclusion, or required access.

## 9. Deliver the proposal

Provide:

1. Brief, priority activities, assumptions, and missing evidence.
2. Recommended layout and alternatives, using labelled walls or a defined coordinate origin; include external furniture dimensions and critical clearances.
3. Seating and storage assignments, TV/light relationships, services, and required anchors.
4. Mode-by-mode checks, worst pinch points, and the destination of every displaced item.
5. Constraint register with failures, unknowns, source type, and next action/owner.
6. Budget range, retained/new items, installation/delivery dependencies, and next measurements or trials.
7. An explicit readiness level.

Use `concept` when dimensions or products are provisional. Use `dimensionally_checked` only for the listed modes and checks supported by verified geometry/product envelopes. Use `ready_for_professional_order_review` only when critical unknowns and hard failures are resolved and delivery/installation evidence is assembled. None of these labels authorizes purchase or certifies regulatory compliance; professional review and user acceptance remain separate.

## Counterexample quality checks

Before concluding, reject these false passes:

- The closed recliner leaves a wide route, but its footrest blocks the balcony when used.
- Six nominal sofa places exist, but two require twisting and one blocks access to another.
- A nearby storage ottoman is convenient only when nobody uses it and everything is removed from its lid.
- A sofa bed opens only after the coffee table is moved, with no safe parking place for that table.
- A low TV cabinet fits, but the television feet overhang or its anti-tip provision is unresolved.
- A 1500 mm square is shown somewhere in the room, but the wheelchair user cannot reach a seat, storage, or exit.
- A room divider hides a desk but does not make concurrent calls and television acoustically private.
- A layout photographs well but covers a radiator, blocks a window handle, or requires a cable across a walking route.
