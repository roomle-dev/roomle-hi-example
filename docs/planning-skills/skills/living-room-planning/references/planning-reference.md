# Living Room Planning Reference

Operational guidance for the living-room-planning skill. Defaults: Germany/EU context, millimetres, EUR. Source IDs identify research without requiring bibliography loading.

Load [the optional source catalog](./source-catalog.md) only for source verification, citations/provenance, disputed claims, or maintenance. Do not load it just to resolve IDs in routine planning.

## Evidence boundaries

- S1-S3 are IKEA consumer guidance on activity zones, lighting, and TV furniture. They support design reasoning, not building-code compliance or endorsement of particular products.
- S4-S5 are Sony general support guidance on TV height and distance. They are not exact product installation manuals or universal health limits.
- S6 is a secondary summary of DIN 18040-2 living/sleeping-room accessibility. Its index identifies the 2011-09 edition. Verify the current edition, project applicability, state adoption, and any contractual requirements before treating a dimension as mandatory. The full standard was not reviewed.
- S7 is German consumer advice supporting unobstructed radiator heat flow and thermostat sensing, not a numerical clearance standard.
- S8-S9 are US CPSC safety guidance on tip-over and window-covering cords. The hazard principles are relevant; US legal provisions are not German/EU requirements.
- The workflow, check catalog, and examples below are planning synthesis. A source supports only the stated claim, not every adjacent check. Project-specific manuals, structural conditions, and local requirements still need verification.

## Dimensions and measurement definitions

The heuristic rows below are deliberately provisional starting points for mock-ups. They are not sourced standards, minimum legal dimensions, accessibility specifications, or guarantees of comfort. Override them for actual users, geometry, products, and applicable requirements.

| Topic | Starting guidance | Measurement and qualification |
| --- | --- | --- |
| Main walking route | Explore 900-1200 mm clear width | Skill heuristic for initial ordinary residential layouts; measure narrowest obstacle-to-obstacle gap in the relevant occupied mode. Passing, carrying, mobility aids, turns, or applicable rules may need more. This does not certify an escape route. |
| Seat to coffee table | Try 400-500 mm | Skill heuristic between seat front and table edge for reach and leg space; trial actual posture. Not a through-route or wheelchair-transfer clearance. Side tables or no central table may be better. |
| Conversation spacing | Trial roughly 1500-2500 mm between seated head positions | Skill heuristic for a small conversational group, not between sofa backs. Hearing, room noise, furniture angles, and personal space govern the result. |
| Turning/movement area | S6 reports 1200 x 1200 mm; 1500 x 1500 mm for unrestricted wheelchair use | Secondary DIN summary for relevant living/sleeping rooms. Distinguish general barrier-free from the R category; verify applicability and full provisions. A free square alone does not prove accessible use. |
| Space along/in front of furniture | S6 reports 900 mm depth; 1500 mm for unrestricted wheelchair use | Secondary summary; not a universal route-width substitute. Verify the actual approach, transfer, furniture function, and applicable category. |
| Seat dimensions | User- and product-specific | Measure usable width/depth and compressed seat height; trial support, feet placement, standing, and transfers. No fixed ideal dimensions specified here. |
| Screen centre height | Start near seated eye level (S3, S4) | Finished floor to centre of visible screen; use actual primary viewers and posture. Reclined viewing may require a different tested arrangement. |
| Viewing distance | No mandatory multiplier (S5) | Eye position to screen; note size, resolution, content, subtitles, and preference. Distinguish this from wall-to-sofa distance. |
| TV support/mount | Exact product dimensions and limits | Check TV feet, support depth, load rating, anchors, wall construction, bracket specification, and full movement envelope. Screen diagonal alone is insufficient. |
| Sofa bed/recliner | Exact fully deployed dimensions and motion | Include mechanisms, rear travel, user operation/standing, feet, bedding access, and displaced furniture. No generic clearance is approved. |
| Cabinet/device clearances | Exact manuals and usable internal space | Include plugs, cable bend space, drawer/door travel, ventilation, load capacity, and service removal. |
| Radiators, stove/hearth, cold walls | Site and product assessment | No universal gap. Keep heat flow and controls usable (S7); obtain verified combustion clearances and investigate moisture concerns. |
| Lighting | Activity-specific placement and controls (S2) | No mandatory domestic lux or colour-temperature target is established by this research. Agree needs; use photometric data/measurement for quantified claims. |

Overlap of movement areas may be permissible in an applicable accessibility design, but do not overlap fixed obstacles or simultaneous occupied/deployed functions. Record exactly which states can share space and validate the applicable provisions.

## Practical check catalog

These are check categories, not a claim that all checks apply or are legally required. Instantiate the relevant checks with the constraint class, measurement, mode, evidence, status, and next action. Preserve `unknown` where evidence is missing.

| ID | Check | Failure or unresolved condition to expose |
| --- | --- | --- |
| GEO-01 | Survey and tolerances | Furniture accepted against estimated wall dimensions, unmeasured skirtings, slopes, or out-of-square corners |
| GEO-02 | Openings | Door/window arcs, handles, curtains, thresholds, or escape openings obstructed |
| GEO-03 | Route continuity | A nominal clear width exists locally but the full entrance-seat-storage-exit route fails |
| GEO-04 | Required access | Balcony, services, ventilation, cleaning, or emergency access sacrificed to furniture |
| USE-01 | Activity brief | Maximum seating or TV dominance chosen without household priorities |
| USE-02 | Simultaneous use | Work, play, conversation, or dining claim the same space at the same time |
| USE-03 | Real seating capacity | Corner/chaise/occasional places counted as equivalent comfortable daily seats |
| USE-04 | Seated comfort | Unsupported feet, excessive seat depth, difficult standing, or inaccessible controls |
| USE-05 | Conversation | Sustained twisting, blocked faces, distance/noise incompatible with hearing needs |
| USE-06 | Reach and standing | Table placement forces leaning or removes space for feet, standing, or transfers |
| FIT-01 | Actual external envelope | Product footprint excludes arms, legs, handles, overhang, or cables |
| FIT-02 | Motion and deployment | Recliner, swivel chair, drawer, or sofa-bed travel collides with people or objects |
| FIT-03 | Reset and parking | Displaced tables, cushions, bedding, or guest seats have no safe destination |
| FIT-04 | Delivery and assembly | Package or assembled piece cannot negotiate entry, stairs, lift, or room turns |
| STO-01 | Contents and loads | Object sizes/weights exceed usable shelf/drawer dimensions or ratings |
| STO-02 | Retrieval | Frequent items require moving occupants, unloading a lid, or crossing active viewing |
| STO-03 | Safe reach | Heavy overhead items, climbing, insecure hazardous contents, or inaccessible essentials |
| MED-01 | TV eye geometry | Screen height/distance/angle chosen without the primary viewers and actual screen |
| MED-02 | All claimed viewing seats | Obstructed picture, neck turning, subtitle difficulty, or unsuitable off-axis image |
| MED-03 | Glare | Window or luminaire reflections untested at relevant times |
| MED-04 | TV support and mounting | Feet overhang, inadequate loads, incompatible bracket, unknown substrate or fixing |
| MED-05 | Device operation | Cooling, cable/plug space, service removal, or remote/signal access missing |
| LGT-01 | General/task/ambient light | One source cannot serve agreed activities or leaves routes inadequately visible |
| LGT-02 | Control and glare | Unreachable controls, app-only dependency, glare or harsh contrast at a used seat |
| ENV-01 | Heating and ventilation | Sofa, cabinetry, or curtains obstruct radiator flow, thermostat sensing, or vents |
| ENV-02 | Moisture and finishes | Cold/damp wall concern ignored; finishes/rugs unsuitable for actual conditions |
| ENV-03 | Acoustic compatibility | Visual screen treated as sound isolation; no plan for concurrent noisy/quiet use |
| ACC-01 | Accessible movement | Applicable clear areas, approaches, turning, and route continuity not verified |
| ACC-02 | Inclusive use | Seat transfer, aid parking, reach, contrast, hearing, or control needs not met |
| SAFE-01 | Stability and anchoring | Furniture, TV, or room divider lacks required stability/anchors and verified substrate |
| SAFE-02 | Child/window safety | Climbing route, accessible blind cord, pinch/lid risk, or hazardous contents unresolved |
| SAFE-03 | Trips and impact | Loose rug edges, trailing leads, low unseen obstacles, sharp/glass edges on routes |
| SAFE-04 | Heat and combustion | Unverified stove/hearth/TV relationship, combustible furnishings, or obstructed provisions |
| SRV-01 | Power and data | Unsafe extension routing, pinched leads, insufficient outlets, or unapproved fixed work |
| ORD-01 | Ordering evidence | Product variants, prices, measurements, permissions, or installation checks unresolved |
| ORD-02 | Readiness claim | Concept labelled installation-ready, unverified checks passed, or approval implied |

## Worked examples

All dimensions, timings, and counts in these examples are invented teaching inputs, not recommended product clearances or measured performance.

### 1. Closed-state route that fails when used

A straight passage between a closed recliner front and a cabinet front is 1250 mm. In the same cross-section, the footrest extends 550 mm into the passage and an opposing drawer extends 400 mm.

```text
remaining_gap_mm = 1250 - 550 - 400 = 300
```

The positive gap does not imply a usable route. Feet, the person retrieving contents, and approach/turning space have not even been included. It fails an agreed 900 mm project route target. If this is the only access to an exit, rejecting the simultaneous state alone is not a sufficient remedy; relocate or resize furniture so required access remains usable in intended operation.

This subtraction is valid only for aligned projections at that cross-section. Offset furniture, curves, swing arcs, and room turns require actual geometry checks.

### 2. Sofa-bed mode includes its displaced furniture

A room has 3500 mm clear depth on the deployment axis. The bed's verified overall deployed depth is 2200 mm and the opposite cabinet is 400 mm deep.

```text
nominal_foot_gap_mm = 3500 - 2200 - 400 = 900
```

This is not yet a pass: check doors, drawer access, operator standing, side approach, night-time route, and tolerances. A 600 mm deep coffee table parked in that gap leaves only 300 mm on the assumed aligned section. Find a separate safe parking position or change the furniture plan. Do not claim the mattress length is the deployed furniture depth.

### 3. Viewing geometry, not a prescribed distance

For a centred, perpendicular viewer and a 16:9 screen:

```text
diagonal_mm = diagonal_inches * 25.4
screen_width_mm = diagonal_mm * 16 / sqrt(16^2 + 9^2)
horizontal_angle_degrees = 2 * atan(screen_width_mm / (2 * eye_distance_mm)) * 180 / pi
```

A 65-inch screen is about 1439 mm wide. At a 2500 mm perpendicular eye-to-screen distance it spans about 32.1 degrees horizontally. This describes the geometry; it is not a recommended angle, a safety threshold, a panel off-axis specification, or a comfort guarantee. Trial content, subtitle readability, eyesight, and actual seated posture (S4, S5).

### 4. Storage reduces reset effort, not just distance

Suppose daily hobby setup/reset requires moving a table twice and clearing an ottoman lid twice, each assumed to take 20 seconds. A nearby accessible drawer avoids those four actions without creating another obstruction.

```text
avoided_actions_per_day = 2 + 2 = 4
illustrative_time_saved_seconds_per_day = 4 * 20 = 80
```

These are user-supplied or trial assumptions to verify, not a product claim. Also compare lifting effort, comfort, actual walkable trips, and whether anyone must move. Do not choose unsafe reachable storage to save time.

## Maintenance and limits

Keep numerical heuristics labelled whenever repeated in a proposal. If a source changes, update the affected operational claim as well as the optional catalog. Record exact manual editions and project evidence separately from this generic research.

No exact project product manuals, structural calculations, full accessibility standard, local fire/escape provisions, quantitative acoustic assessment, or photometric design were reviewed to produce this generic skill. Obtain them when the project requires them. A checklist review does not replace installation approval.
