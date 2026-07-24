# Grass Blade Product Requirements

Status: Active product source of truth
Owner: Paul Robello
Last updated: 2026-07-23

## Product summary

Grass Blade is a top-down, cozy arcade game built with Three.js. The player controls the center of a continuously spinning horizontal blade, sweeps through a small stylized landscape, and fulfills a delivery contract by cutting and immediately collecting specified amounts of grass, flowers, fiber, and wood.

Cutting should feel physical without becoming a simulation game. Soft targets disappear almost on contact. Dense or woody targets load the blade, visibly reduce its RPM, and take repeated or sustained contact. Cutting awards run-local XP automatically; higher blade levels add torque and RPM so targets that initially bog the blade down become satisfying to clear. There are no enemies, lives, or default time-limit failures.

## Design pillars

1. **Readable motion.** The player must understand movement, blade speed, target toughness, collection, quota progress, and level-ups without reading a manual.
2. **Lush abundance.** The playable meadow must read as continuous fields of grass and flower-rich drifts waiting to be cut, never as isolated grass and flower props scattered over mostly bare ground.
3. **Tactile resistance.** Larger targets should audibly and visually load the blade. RPM loss, vibration, chips, and persistent cut progress communicate why a target takes longer.
4. **Cozy momentum.** The default contract has no fail clock. Leaving a partially cut target does not erase progress, and returning with a stronger blade is encouraged.
5. **Immediate rewards.** A completed cut confirms its resource, XP, and quota change immediately; visual motes reinforce the event but never delay game state.
6. **Deterministic foundations.** A seed and fixed simulation step must reproduce target placement, progression, quota completion, and debug snapshots.

## Core player contract

### Approved visual and gameplay direction

The six gameplay screenshots supplied on 2026-07-20 are the current composition and feel target. They are visual and gameplay inspiration only: Grass Blade must use original or properly licensed assets and implementation, and no third-party art or code may be copied from the screenshots or the game they depict.

- Frame play like a close portrait/mobile-casual game while remaining responsive and fully usable in desktop landscape and ultrawide browser windows. The camera and responsive crop must keep the cutter, its contact edge, nearby vegetation, and top-edge HUD readable together.
- Make the player an oversized, immediately recognizable spinning cutter: a broad metal cutting silhouette around a friendly protected hub, with rotation and effective reach legible at normal play scale.
- Standing vegetation must read as a continuous layered canopy of tall, tapered grass blades, not cones, pyramids, or sparse individual props. Overlap, height and color variation should create foreground, midground and background depth.
- Use a bright, saturated but coherent palette. Distinct crop or resistance zones may shift green, yellow, orange, purple, or cool-white accents, but terrain, vegetation and targets must remain visually related rather than looking like unrelated asset packs.
- Flowers, crops and produce appear in dense authored clusters embedded in the grass. Their silhouettes and resource type must remain distinguishable above the canopy.
- A completed cut leaves a persistent, wide and sharply readable trail for the rest of the contract. Revealed ground includes low stubble, clippings or chopped marks so a cleared route does not look like an empty untextured plane.
- Arenas must avoid simple square lawns. Active contracts use authored path and corridor shapes, branching clearings, loops, islands of dense growth, or obstacle-defined routes that lead in multiple directions.
- Larger plants must visibly resist the cutter through sustained contact, RPM load and target response. When blade level or rendered cutter size is insufficient for comfortable progress, the game communicates that clearly without creating an invisible invulnerable tier.
- Keep the primary HUD compact at the top edges: a glossy blue meter/timer treatment with cream panels, warm gold trim and high-contrast white text. Timer presentation is elapsed time only and never a default countdown failure condition.
- Automatic level and tool upgrades should produce a visible cutter-power payoff. A contract may complete by satisfying its resource quotas or an authored clear-every-patch objective; both use deterministic authoritative state and a calm completion result.

### View and camera

- Use a close fixed orthographic isometric camera: 45 degrees of yaw and approximately 55 degrees down from horizontal, tuned to evoke the approved portrait composition without sacrificing responsive desktop play.
- The camera follows the blade center with light damping and a small look-ahead in the movement direction.
- Camera rotation and zoom are not player controls in the first playable build.
- Screen-relative movement means Up/W always moves toward the top of the screen, independent of world axes.
- The blade should occupy enough screen space to remain the dominant moving silhouette. The blade, contact edge, nearby targets, and compact top-edge HUD must remain visible at the same time.

### Blade

- The avatar is one clearly readable horizontal spinning blade close to the ground, with a protected center hub and a visible swept radius.
- The blade spins automatically clockwise. There is no attack button and no manual throttle in the MVP.
- Starting cut radius is `2.15` world units, matching the Phase 0 placeholder silhouette. A level-up may increase the rendered radius by 4% per level, capped at 20%, but collision radius changes must be validated separately before becoming a balance mechanic.
- The protected center hub uses a separate `0.82` world-unit solid radius. The cutting blades may overlap a solid target to apply work, but the hub cannot cross that target while it remains uncut.
- Starting movement speed is capped at `7.5` world units per second with acceleration and deceleration, not instant velocity changes.
- Collision and cutting use the blade's swept circle, not the decorative mesh's triangle shape.
- Grass and flowers remain pass-through soft targets. Shrubs, saplings, mature trees, and non-cuttable obstacles use swept solid collision so movement cannot tunnel through them; a cuttable solid stops blocking on its authoritative `cut` transition.

### Controls

| Input      | Action                                                               |
| ---------- | -------------------------------------------------------------------- |
| `W A S D`  | Move relative to the screen                                          |
| Arrow keys | Equivalent movement controls                                         |
| `F`        | Enter or leave fullscreen                                            |
| `Escape`   | Leave fullscreen natively; pause once the contract flow ships        |
| `R`        | Restart the current seeded contract from the pause or results screen |

The game must be fully playable with a keyboard. Touch and pen users drag on the canvas to move; an on-screen stick appears during an active touch drag so direction and magnitude are visible without adding a permanent HUD control. The browser page must not scroll from arrows or Space while game input is focused.

### Run loop

1. Start a seeded contract at blade level 1 with empty collection totals.
2. Move through organic targets while the blade spins automatically.
3. Contact loads the blade and accumulates cut work while RPM is high enough.
4. Completing a cut awards the resource and XP exactly once.
5. XP automatically raises the blade level during the run; no upgrade menu interrupts play.
6. Complete every quota to finish the contract.
7. Show a calm results card with elapsed time, targets cut, highest level, and Restart/Next Contract actions. Next Contract advances to the next authored contract template and the next deterministic seed.
8. Track each authored contract's best successful completion time locally and surface it on contract selection and results. Timed-out attempts must not overwrite best records.

Blade level, XP, cut targets, and collected resources reset at the start of each contract. Persistent currency, meta-upgrades, and account progression are not part of the MVP.

Some contracts may add an explicit time constraint, but time pressure is contract-authored and must be visible before Start. The default Meadow Delivery contract remains no-fail-clock; its timer is elapsed-time scoring only.

## RPM, torque, and cutting model

The implementation is game physics, not a claim of real mechanical engineering. Values below are authoritative starting values and must be tuned only with captured before/after playtest evidence.

### Level stats

- `targetRPM(level) = min(1000, 720 + 40 * (level - 1))`
- `torque(level) = 1 + 0.35 * (level - 1)`
- Maximum level in an MVP contract is 8.
- Cumulative XP thresholds are exact: level 2 at `20`, level 3 at `55`, level 4 at `110`, level 5 at `190`, level 6 at `300`, level 7 at `450`, and level 8 at `650` XP.
- A level-up is applied at the end of the current fixed simulation tick. One large award may cross multiple thresholds; emit one consolidated presentation sequence without losing levels.

### Load and work

The simulation runs at a fixed `1/60` second step.

For every target overlapping the blade in a tick:

```text
contactFraction = clamp(overlapDepth / bladeRadius, 0, 1)
totalLoad = sum(target.resistance * contactFraction)
loadedRPM = targetRPM * clamp(1 - totalLoad / torque, 0.08, 1)
rpm = exponentialApproach(rpm, loadedRPM, loadPresent ? 5.0 : 3.0, dt)
normalizedRPM = clamp((rpm - 180) / (targetRPM - 180), 0, 1)
workRate = 12 * torque * normalizedRPM * contactFraction
target.accumulatedWork += workRate * dt
```

- No cut work is added below `180 RPM`.
- Cut work persists for the rest of the run after contact ends.
- Multiple simultaneous contacts share the same RPM load; each receives work from its own contact fraction. This naturally discourages trying to push through several trunks at once.
- There are no invisible invulnerable tiers. A target can be attempted at any level, but resistance can pull the blade below its cutting RPM. Show `TOO TOUGH` at most once per target every 1.5 seconds, plus a low-RPM sputter and hub vibration.
- A completed target transitions atomically from `cutting` to `cut`. Collection, XP, and quota updates must be idempotent.

### Exact target tiers

Expected times assume one isolated target, full contact, and the listed recommended level. They are acceptance ranges rather than additional simulation constants.

| Tier | Target      | Recommended level | Work | Resistance | Yield     |  XP | Expected cut time |
| ---- | ----------- | ----------------: | ---: | ---------: | --------- | --: | ----------------- |
| 1    | Grass clump |                 1 |  1.5 |       0.04 | 1 Grass   |   1 | 0.10-0.20 s       |
| 1    | Wildflower  |                 1 |    4 |       0.08 | 1 Flower  |   3 | 0.25-0.45 s       |
| 1    | Soft crop   |                 1 |  5.5 |       0.10 | 2 Flowers |   5 | 0.35-0.60 s       |
| 2    | Dense weed  |                 2 |   12 |       0.25 | 1 Fiber   |   6 | 0.70-1.10 s       |
| 2    | Fiber Reed  |                 2 |   18 |       0.32 | 1 Fiber   |   8 | 1.05-1.65 s       |
| 3    | Shrub       |                 3 |   30 |       0.55 | 2 Fiber   |  14 | 1.8-3.0 s         |
| 4    | Sapling     |                 4 |   50 |       0.90 | 2 Wood    |  30 | 4.0-6.0 s         |
| 5    | Mature tree |                 6 |   60 |       1.60 | 6 Wood    |  75 | 5.5-8.0 s         |

Rocks, fences, structures, water, and terrain are non-cuttable obstacles in the MVP. They must create a distinct metal/stone deflection response and never award XP.

Fiber Reeds are a pass-through Tier-2 Fiber family used to add richer plant variety without making existing contracts easier. Their visual clumps bend on contact, display the same draining progress affordance as other durable plants after first damage, fall from their roots on completion, and award Fiber motes. Existing Fiber quota-selection paths continue to require dense weeds and shrubs unless a future reed-focused contract opts into reeds explicitly.

Soft crops are a pass-through Tier-1 Flower-resource family used to add taller, fruiting/blooming clusters inside lush fields without making flower-patch grazing complete entire drifts. Each soft crop is its own target, awards two Flowers, and falls as a small plant cluster before disappearing. Normal quota contracts still tune against classic flower targets; Clear Every Patch requires every grass, flower, and soft-crop target.

## Contracts and quotas

Authored contracts are selected by deterministic contract ID and seed. The default remains stable so onboarding and automated checks have one known target.

### Meadow Delivery

- Collect 50 Grass.
- Collect 10 Flowers.
- Collect 6 Fiber.
- Collect 6 Wood.
- Default mode has no failure timer. Elapsed time is a result metric only.
- The seeded world must contain at least 150% of each required resource yield, with required low-tier resources reachable from the start.
- Wood can be completed from saplings; a mature tree is an optional high-resistance shortcut/reward.

### Flower Sweep

- Contract ID: `flower-sweep`
- Collect 34 Grass.
- Collect every authored Flower target in the arena (`320` at the current 16 drifts by 20 targets per drift).
- Collect 4 Fiber.
- Collect 4 Wood.
- Requires deliberate passes through each flower drift; grazing one patch edge must not complete the Flower objective.

### Woodland Cleanup

- Contract ID: `woodland-cleanup`
- Collect 30 Grass.
- Collect 6 Flowers.
- Collect 8 Fiber.
- Collect 8 Wood.
- Emphasizes weeds and saplings with heavier Fiber and Wood quotas while keeping the soft-target requirements shorter than Meadow Delivery.

### Timber Trail

- Contract ID: `timber-trail`
- Time limit: 90 seconds.
- Collect 250 Grass.
- Collect 260 Flowers.
- Collect 28 Fiber.
- Collect 28 Wood.
- Uses a grove-to-grove route that requires sustained soft-target clearing, all twelve dense weeds, all eight shrubs, all five saplings, and three mature trees in deterministic balance.
- The quota intentionally verifies late-route progression into repeated mature-tree cutting after enough lower-tier XP is earned.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Rock Garden

- Contract ID: `rock-garden`
- Time limit: 70 seconds.
- Collect 190 Grass.
- Collect 220 Flowers.
- Collect 16 Fiber.
- Collect 10 Wood.
- Uses an obstacle-defined slalom route with visible non-cuttable rocks carving gaps in the growth silhouette.
- Rocks remain blockers only; they never award resources or XP, and route gaps must correspond to visible rock obstacles rather than invisible collision.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Hedge Maze

- Contract ID: `hedge-maze`
- Time limit: 80 seconds.
- Collect 183 Grass.
- Collect 300 Flowers.
- Collect 28 Fiber.
- No Wood quota.
- Uses a shrub-maze route that turns durable hedge cutting into the Fiber objective.
- The deterministic quota path requires every grass target, all twelve dense weeds, all eight shrubs, and most flower pockets, so progress bars and durable-target blocking are part of the intended route.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Timed Harvest

- Contract ID: `timed-harvest`
- Time limit: 60 seconds.
- Collect 170 Grass.
- Collect 300 Flowers.
- Collect 18 Fiber.
- No Wood quota; the timed contract intentionally avoids level-gating on saplings.
- Uses a loop-shaped endurance route challenge with nearly full grass coverage, most flower pockets, dense weeds, and shrub-level Fiber work plus a countdown HUD.
- If the timer reaches zero before every quota is complete, the contract ends with a `timed-out` result. The result card shows `Time Up`, final partial inventory, targets cut, highest level, Restart, and Next Contract.

### Field Sprint

- Contract ID: `field-sprint`
- Time limit: 45 seconds.
- Collect 175 Grass.
- Collect 230 Flowers.
- No Fiber or Wood quota; this is a soft-target speed contract.
- Uses narrow connected lanes with flower-heavy pockets, most of the available lane grass, and a countdown HUD.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Weed Rush

- Contract ID: `weed-rush`
- Time limit: 55 seconds.
- Collect 150 Grass.
- Collect 220 Flowers.
- Collect 18 Fiber.
- No Wood quota; this timed route emphasizes dense weeds without forcing sapling level-gating.
- Uses a switchback route with dense Fiber weed clusters, flower pockets, and internal soft-growth gaps.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Reed Run

- Contract ID: `reed-run`
- Time limit: 60 seconds.
- Collect 205 Grass.
- Collect 270 Flowers.
- Collect 10 Fiber.
- No Wood quota; this route deliberately exercises the pass-through Fiber Reed target family without forcing sapling level-gating.
- Uses a golden-reed loop that bends through the seeded Fiber Reed anchors, with internal no-growth pockets so it reads as a route instead of a square field.
- Deterministic balance selects all ten Fiber Reeds before falling back to dense weeds or shrubs, while existing contracts keep their dense-weed/shrub Fiber selection.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Clover Circuit

- Contract ID: `clover-circuit`
- Time limit: 75 seconds.
- Collect 240 Grass.
- Collect 320 Flowers.
- Collect 28 Fiber.
- No Wood quota; this route tests flower-pocket commitment and every Fiber target without forcing sapling level-gating.
- Uses a figure-eight circuit with two loop lobes, a central crossing, inner no-growth pockets, and dense flower/Fiber clusters spread around the loop.
- Deterministic balance requires all authored flower targets, every dense weed, and every shrub while leaving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Orchard Loop

- Contract ID: `orchard-loop`
- Time limit: 85 seconds.
- Collect 240 Grass.
- Collect 260 Flowers.
- Collect 20 Fiber.
- Collect 22 Wood.
- Uses a looping wood route through the existing sapling and mature-tree placements, with inner orchard paths and no-growth pockets so it reads as a circuit instead of a broad square field.
- Deterministic balance requires all five saplings, two mature trees, every dense weed, and four shrubs while preserving a visible execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Brook Bend

- Contract ID: `brook-bend`
- Time limit: 60 seconds.
- Collect 200 Grass.
- Collect 250 Flowers.
- Collect 24 Fiber.
- No Wood quota; this route emphasizes soft sweeping and hedge-level Fiber without forcing sapling level-gating.
- Uses an S-bend brook-bank route with alternating flower banks, Fiber weed pockets, and no-growth bends so it reads as a winding path instead of a broad square field.
- Deterministic balance requires all dense weeds and six shrubs while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Harvest Spiral

- Contract ID: `harvest-spiral`
- Time limit: 80 seconds.
- Collect 240 Grass.
- Collect 260 Flowers.
- Collect 24 Fiber.
- Collect 22 Wood.
- Uses a tightening spiral route with outer soft-target sweeps, inner Fiber pockets, and late timber cuts so the route changes direction repeatedly instead of reading as a square field.
- Deterministic balance requires six shrubs, all five saplings, and two mature trees while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Crescent Grove

- Contract ID: `crescent-grove`
- Time limit: 75 seconds.
- Collect 220 Grass.
- Collect 240 Flowers.
- Collect 20 Fiber.
- Collect 16 Wood.
- Uses a crescent-shaped grove route with flower banks around the outer curve, open inner no-growth pockets, Fiber shrubs, and a timber finish.
- Deterministic balance requires all dense weeds, four shrubs, all five saplings, and one mature tree while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Forked Thicket

- Contract ID: `forked-thicket`
- Time limit: 85 seconds.
- Collect 260 Grass.
- Collect 280 Flowers.
- Collect 24 Fiber.
- Collect 22 Wood.
- Uses a three-way branching thicket route with a central trunk, left/right timber forks, a north branch, and carved no-growth pockets between the forks.
- Deterministic balance requires all dense weeds, six shrubs, all five saplings, and two mature trees while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Switchback Orchard

- Contract ID: `switchback-orchard`
- Time limit: 90 seconds.
- Collect 270 Grass.
- Collect 300 Flowers.
- Collect 28 Fiber.
- Collect 28 Wood.
- Uses a zig-zag orchard route that doubles back through broad flower lanes, Fiber shrubs, saplings, and repeated mature-tree cuts.
- Deterministic balance requires all dense weeds, all eight shrubs, all five saplings, and three mature trees while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Braided Meadow

- Contract ID: `braided-meadow`
- Time limit: 65 seconds.
- Collect 230 Grass.
- Collect 300 Flowers.
- Collect 20 Fiber.
- No Wood quota; this route emphasizes interwoven soft-target lanes and hedge-level Fiber pressure without forcing timber cuts.
- Uses two braided flower lanes with crossover links, carved interior gaps, and alternating left/right sweeps so the route reads as a woven meadow instead of a square lawn.
- Deterministic balance requires all dense weeds and four shrubs while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Ring Grove

- Contract ID: `ring-grove`
- Time limit: 75 seconds.
- Collect 245 Grass.
- Collect 260 Flowers.
- Collect 24 Fiber.
- Collect 16 Wood.
- Uses a looped grove route around a bare center clearing, with inner timber pockets and four cardinal route bends so the level reads as a ring instead of a square lawn.
- Deterministic balance requires all dense weeds, six shrubs, all five saplings, and one mature tree while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Twin Glade

- Contract ID: `twin-glade`
- Time limit: 70 seconds.
- Collect 230 Grass.
- Collect 260 Flowers.
- Collect 20 Fiber.
- Collect 10 Wood.
- Uses two mirrored flower-heavy glades joined by narrow lanes, with carved center pockets that make the route read as connected clearings instead of a square lawn.
- Deterministic balance requires all dense weeds, four shrubs, and all five saplings while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Frost Ribbons

- Contract ID: `frost-ribbons`
- Time limit: 65 seconds.
- Collect 220 Grass.
- Collect 280 Flowers.
- Collect 18 Fiber.
- No Wood quota; this route emphasizes visual variety, soft-target sweeping, and moderate Fiber pressure without forcing sapling level-gating.
- Uses cool-white grass bands embedded in a green ribbon route, with switchback lanes and carved pockets so the field reads closer to the approved reference screenshots while remaining an original implementation.
- Deterministic balance requires all dense weeds and three shrubs while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Prism Prairie

- Contract ID: `prism-prairie`
- Time limit: 70 seconds.
- Collect 235 Grass.
- Collect 320 Flowers.
- Collect 24 Fiber.
- No Wood quota; this route emphasizes full flower-pocket sweeping and Fiber shrub commitment without forcing timber cuts.
- Uses crossing diagonal meadow facets, vertical connector lanes, dense flower anchors, and carved prism-shaped pockets so the route reads as multiple intersecting paths rather than a square field.
- Deterministic balance requires every flower target, all dense weeds, and six shrubs while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Stone Bloom

- Contract ID: `stone-bloom`
- Time limit: 68 seconds.
- Collect 240 Grass.
- Collect 300 Flowers.
- Collect 24 Fiber.
- No Wood quota; this route emphasizes visible rock chicanes, flower-pocket sweeping, and shrub-level Fiber pressure without forcing timber cuts.
- Uses the existing visible rock placements as obstacle-defined cuts through a winding bloom route, so carved gaps correspond to visible stone blockers rather than invisible walls.
- Deterministic balance requires most flower targets, all dense weeds, and six shrubs while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Willow Weave

- Contract ID: `willow-weave`
- Time limit: 80 seconds.
- Collect 250 Grass.
- Collect 300 Flowers.
- Collect 24 Fiber.
- Collect 22 Wood.
- Uses a woven grove route that braids flower lanes through saplings, shrubs, and mature-tree pockets, so the player alternates soft clearing with larger blocked targets.
- Deterministic balance requires all dense weeds, six shrubs, all five saplings, and two mature trees while preserving a very small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Petal Gate

- Contract ID: `petal-gate`
- Time limit: 88 seconds.
- Collect 250 Grass.
- Collect 320 Flowers.
- Collect 28 Fiber.
- No Wood quota; this route emphasizes flower-pocket coverage plus full dense-weed and shrub Fiber commitment without forcing timber cuts.
- Uses a flower-gate lattice of cross-lanes, compact clearings, and small internal no-growth pockets so the route reads as deliberate gates instead of a square field.
- Deterministic balance requires every flower target, all dense weeds, and all shrubs while preserving a small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Sunset Switchback

- Contract ID: `sunset-switchback`
- Time limit: 120 seconds.
- Collect 260 Grass.
- Collect 300 Flowers.
- Collect 28 Fiber.
- No Wood quota; this route keeps pressure on full dense-weed and shrub Fiber commitment while avoiding another timber gate.
- Uses a diagonal switchback route with sunset-toned flower anchors, alternating open lanes, and compact internal no-growth pockets so the player sweeps back and forth instead of clearing a square field.
- Deterministic balance requires all dense weeds and all shrubs while preserving a moderate execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Cedar Crossroads

- Contract ID: `cedar-crossroads`
- Time limit: 86 seconds.
- Collect 260 Grass.
- Collect 260 Flowers.
- Collect 24 Fiber.
- Collect 22 Wood.
- Uses a four-way timber route with crossing cedar lanes, diagonal cut-throughs, flower pockets, and compact no-growth pockets so the player alternates direction instead of sweeping a square field.
- Deterministic balance requires all dense weeds, six shrubs, all five saplings, and two mature trees while preserving a moderate execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Lagoon Braid

- Contract ID: `lagoon-braid`
- Time limit: 70 seconds.
- Collect 240 Grass.
- Collect 300 Flowers.
- Collect 24 Fiber.
- No Wood quota; this route keeps the focus on dense flower banks and Fiber hedges without forcing timber cuts.
- Uses two braided lagoon-bank routes with diagonal connectors, alternating flower pockets, and internal no-growth pools so the player traces a weaving route instead of clearing a square field.
- Deterministic balance requires all dense weeds and six shrubs while preserving a modest execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Wildflower Narrows

- Contract ID: `wildflower-narrows`
- Time limit: 66 seconds.
- Collect 230 Grass.
- Collect 320 Flowers.
- Collect 24 Fiber.
- No Wood quota; this route emphasizes precise soft-target sweeps through tight flower corridors and Fiber hedges.
- Uses narrow linked bloom corridors with diagonal connectors, compact internal gaps, and one grid-aligned decorative clearing so the route reads as constrained paths instead of a square lawn.
- Deterministic balance requires all dense weeds and six shrubs while preserving a very small execution buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Berry Bloom

- Contract ID: `berry-bloom`
- Time limit: 88 seconds.
- Collect 240 Grass.
- Collect 340 Flowers.
- Collect 28 Fiber.
- No Wood quota; this route makes the newer soft-crop flower targets required by pushing the Flower quota beyond the classic flower target count.
- Uses a connected berry-bloom route aligned to the soft-crop anchor chain with compact internal no-growth pockets so the route reads as a deliberate zig-zag through plant clusters instead of a square field.
- Deterministic balance requires every classic flower target, ten soft-crop clusters, all dense weeds, and all shrubs while preserving a human-play buffer inside the timer.
- If the timer reaches zero before every quota is complete, the contract ends with the same `timed-out` result semantics as Timed Harvest.

### Clear Every Patch

- Contract ID: `clear-every-patch`
- No time limit.
- Clear every generated Grass and Flower target in a split-clearings meadow.
- Fiber and Wood are not required and are hidden from the active HUD.
- This contract uses `clear-patches` completion mode: Grass and Flower counters are generated from the seeded world counts, and completion requires every matching authoritative target to reach `cut`, not merely matching counter totals.

Later contracts may choose quota delivery or authored clear-patch goals from deterministic templates. Over-collection is allowed and still grants XP. Contract completion occurs in the same simulation tick that the final quota is awarded or the final clear-patch target is cut.

Successful completions update the local best time for that specific authored contract only when faster than the previous record. The intro contract chooser and results card show each available record; failed timed-out runs preserve the previous best. Each contract stores a deterministic balance benchmark from `output/balance/contracts/summary.json`; chooser cards show the Gold target time, saved bests display their earned Gold/Silver/Bronze medal, the chooser summarizes aggregate medal progress across all authored contracts, and completed results show the medal reached by that run. Timed contracts use the visible time limit as Bronze and derive tighter Silver/Gold thresholds from the benchmark; no-time-limit contracts derive all three thresholds from the benchmark. Each chooser card also shows compact derived tags for pace, focus resource, difficulty, and route shape so the expanding contract list remains scannable on mobile.

Flower drifts are visual patches made from twenty smaller authoritative flower targets per drift. Cutting one edge pocket must not collect or visually topple the whole patch; fully clearing a patch requires sweeping through all of its flower sub-targets.

## Collection and feedback

- On cut confirmation, update inventory, XP, and quota state immediately.
- In the next presentation frame, play a 100-160 ms collapse, slice, or flatten animation appropriate to the target.
- Spawn a pooled resource-colored burst and one icon/mote that arcs toward the matching HUD counter over 280-450 ms.
- The HUD counter should pulse when state changes. The flying icon is explanatory feedback, not the trigger for the count.
- Pool and aggregate effects. Cap active collection motes at 64 and particle fragments at 256; combine excess grass cuts into one larger burst.
- Level-up feedback uses a brief hub ring, pitch rise, and `LEVEL N` label. It must not stop movement or open a selection menu.
- RPM feedback includes visible blade cadence, a compact RPM/torque meter, audio pitch, and contact sparks/chips. Avoid strong camera shake in the default cozy presentation.

## World and target lifecycle

- The first arena is a bounded authored meadow approximately 48 by 48 world units, populated deterministically from a seed.
- Additional arenas must introduce authored silhouettes rather than resizing a square: branching paths, bends, clearings, dense islands, loops, and obstacle corridors should change the route through the meadow while preserving readable boundaries.
- The selected contract's authored arena silhouette controls vegetation and target placement, not invisible collision. The blade center is constrained by the world bounds and by visible solid targets: rocks, shrubs, saplings, and mature trees while they remain uncut.
- Soft arena edges should read as path edges and vegetation silhouettes, not invisible walls. Decorative low stones and mossy scallops may clarify authored growth-mask edges, but they must not block movement unless they correspond to an authoritative visible solid target.
- Logical target state is authoritative on the CPU:

```text
standing -> cutting -> cut -> hidden/recycled
```

- Each target has a stable ID, tier, position, collision radius, accumulated work, resource yield, XP, and presentation state.
- Grass is represented logically in cuttable cells/clumps rather than tens of thousands of JavaScript blade objects.
- A cut target remains visibly cut for the rest of the run. It does not respawn during a contract.

### Lush-field visual acceptance

- At the start of Meadow Delivery, standing grass cells cover at least 85% of traversable terrain after authored paths, deliberate dirt clearings, rocks, and other obstacles are excluded.
- On the default quality preset, standing grass zones render at least 90 decorative blades per world unit squared. Lower quality may use wider or simpler blades and a minimum of 45 blades per world unit squared, but it must preserve the appearance of a continuous canopy.
- Flower-rich drifts cover 20-30% of the initial grass-covered area. Inside a drift, render 2-4 decorative blossoms per world unit squared, using clustered variation rather than evenly spaced single props.
- A logical wildflower target may own several decorative blossoms that share one authoritative target ID and cut state. Decorative children never award resources independently.
- Decorative grass uses a finer persistent visual cut mask than the reward grid. Only visual tufts intersected by the blade's swept capsule flatten; entering one logical grass target must not collapse its whole rectangular patch.
- From the opening camera and during normal traversal, uncleared vegetation must form overlapping foreground, midground, and background coverage. Bare terrain may appear only where the world intentionally authors a path, clearing, obstacle footprint, or already-cut swath.
- Cutting must reveal a continuous, readable swath through the canopy and flower drifts so the player's route is visible from the fixed camera.

The direction above is authoritative for every playable phase; sparse cone or pyramid props are not an acceptable interim visual target. The exact density, chunking and performance thresholds remain Phase 3 exit gates and do not assert that the current runtime has already been verified against them.

## Technical architecture

### Foundation

- Bun manages packages and runs scripts.
- Vite serves and builds strict TypeScript.
- Three.js owns rendering directly; React Three Fiber is not required for the game runtime.
- Simulation code must not depend on DOM, Three.js scene objects, wall-clock time, or `Math.random()`.
- Rendering consumes read-only simulation snapshots and presentation events.

### Suggested module boundaries

```text
src/
  main.ts                     browser bootstrap
  game/Game.ts                lifecycle and frame orchestration
  simulation/FixedStep.ts     accumulator and deterministic 60 Hz stepping
  simulation/Rng.ts           seeded PRNG
  game/BladeSystem.ts         input, movement, RPM, torque
  game/CutSystem.ts           spatial query, load, work, cut events
  game/ProgressionSystem.ts   XP and automatic levels
  game/ContractSystem.ts      quotas and completion
  world/TargetGrid.ts         authoritative logical grid/spatial hash
  render/WorldRenderer.ts     scene graph and snapshot application
  render/GrassRenderer.ts     chunked instancing and wind/cut shader
  render/CutMask.ts           partial GPU texture updates
  ui/Hud.ts                   DOM HUD and accessible announcements
  debug/AgentApi.ts           deterministic control and state snapshots
tests/
  *.test.ts
```

Names may evolve, but the boundaries between deterministic game state, rendering, UI, and debug control are required.

### CPU logical grid plus GPU cut-mask hybrid

The grass system should not perform a CPU raycast against every rendered blade.

1. Divide the meadow into render chunks, initially 8 by 8 world units.
2. Keep a CPU logical grid/spatial hash authoritative for standing coverage, target IDs, rewards, cut work, and collision queries.
3. Render a continuous canopy of decorative grass blades and clustered flower visuals per chunk with instancing; logical cell/target density remains independent of decorative instance density.
4. Give the grass shader a small world-aligned cut-state texture. When a logical grass cell is cut, update only the dirty texels; vertices inside cut cells shrink/fold and then stay down.
5. Track flowers, shrubs, saplings, and trees as discrete CPU targets, rendered with instances where appropriate and a per-instance cut state or removal/swap operation.
6. Never infer rewards by reading GPU state. The CPU confirms every cut exactly once and tells the renderer what changed.

This hybrid preserves a dense field while keeping gameplay queries, quotas, save/debug snapshots, and tests tractable.

## Local grass reference audit

Audit target: `/Users/probello/Repos/stylized-components` on clean `main` at Git HEAD `b182d81bff64531e584f50d71f046ae05fab3c87`.

### Exact reference files

- System guide: `/Users/probello/Repos/stylized-components/src/components/grassField/README.md`
- Public R3F component and GLB rewiring: `/Users/probello/Repos/stylized-components/src/components/grassField/index.tsx`
- Deterministic area-weighted placement: `/Users/probello/Repos/stylized-components/src/components/grassField/utils/scatter.ts`
- Blade wind, dirt shortening, rock trampling, and shadow GLSL: `/Users/probello/Repos/stylized-components/src/components/grassField/shaders/grassBlade.ts`
- Shared procedural ground mask: `/Users/probello/Repos/stylized-components/src/components/grassField/shaders/groundMask.ts`
- Flower wind, dirt culling, and palette GLSL: `/Users/probello/Repos/stylized-components/src/components/grassField/shaders/flower.ts`
- Pine foliage shader: `/Users/probello/Repos/stylized-components/src/components/grassField/shaders/pineLeaf.ts`
- Shader injection and unit blade geometry: `/Users/probello/Repos/stylized-components/src/components/grassField/materials/bladeMaterial.ts`
- Flower visible/depth materials: `/Users/probello/Repos/stylized-components/src/components/grassField/materials/flowerMaterial.ts`
- Dependency declaration: `/Users/probello/Repos/stylized-components/package.json`
- Upstream license: `/Users/probello/Repos/stylized-components/LICENSE`

### Techniques worth adapting

- Area-weighted, seeded triangle sampling makes density predictable and reloads deterministic.
- A single shared world-space dirt function lets ground, grass, and flowers agree on coverage.
- Opaque instanced blades with depth writes avoid the transparent-overdraw penalty.
- A low-segment tapered blade plus vertex-shader wind is a strong visual/performance baseline.
- Cross-billboard flowers, alpha cutouts, and matching visible/depth wind shaders are reusable presentation ideas.
- GPU shortening/bending is a useful rendering response for cut masks and transient contact.
- Blades deliberately do not cast shadows, while the demo freezes static shadow maps; both are useful performance lessons.

### Limits that prevent drop-in gameplay use

- It is a React Three Fiber component coupled to Drei loaders and Leva controls, not a standalone Three.js gameplay system.
- Integration rewires a GLB by exact mesh and material names (`groundMesh`, rock, trunk, and leaf material names).
- Blade and flower instance matrices are built once. There is no target ID, cut-health state, removal API, collection event, or CPU gameplay representation.
- Rock trampling is a shader-only fixed uniform array with `MAX_ROCKS = 24`; it is unsuitable as an unbounded dynamic cutter/contact system.
- The instanced meshes use `frustumCulled = false`, acceptable for the compact demo but wasteful for a larger traversable game world.
- Grass can be visually shortened by shaders, but shader-only state cannot authoritatively award resources or XP.
- Trees are dressed GLB meshes, not independently damageable gameplay entities.

Recommendation: adapt the geometry, placement math, opaque instancing, and selected GLSL ideas into chunked renderers owned by Grass Blade. Keep cutting, rewards, and target state in the CPU logical grid, and project the result into a GPU cut mask. Do not copy the entire `GrassField` component.

### License and attribution

The reference repo is MIT licensed and grants use, modification, distribution, sublicensing, and sale. Its copyright and permission notice must be included in all copies or substantial portions. Its README additionally asks users to retain attribution to Christian Ortiz (Cortiz) and link to the source repository.

If Grass Blade copies or substantially derives upstream code, add a third-party notices file before that code lands, include the upstream MIT text and copyright, and credit Christian Ortiz with the repository link. The Grass Blade MIT license does not replace the upstream notice. Reimplementing an unprotectable general technique from first principles should still receive a design-reference credit when the implementation was materially informed by this repo.

## Blade asset pipeline

- The Phase 0 primitive may remain only as a tuning scaffold while camera scale, swept radius and movement speed are validated. It is not the approved visual target; even an interim cutter should move toward the oversized hub-and-metal-blade readability established by the supplied references before production-asset detail work begins.
- A custom production blade may be authored in Blender or Fusion 360. Prefer Blender for the final game asset because it supports deliberate low-poly topology, UVs, baked materials, LODs, and direct GLB export.
- Use Fusion 360 when the design benefits from believable manufactured parts or a CAD-derived industrial silhouette. Any Fusion result must pass through Blender for mesh cleanup, simplification, material consolidation, and GLB export before entering the game.
- Every replacement blade uses meters/world units consistently, keeps the hub at local origin, uses local `+Y` as its spin axis, and places its cutting plane parallel to local `XZ`.
- The exported GLB must separate the stationary hub from the rotating cutter, declare its swept radius in asset metadata or a colocated manifest, and avoid making triangle-level geometry authoritative for collision.
- The first production model should test disc, two-arm, and four-arm silhouettes before detail work. Readability from the fixed game camera is the acceptance criterion, not close-up CAD detail.

## AI-assisted visual asset pipeline

- Use the built-in image-generation workflow for raster concept art, menu/background exploration, material and texture studies, decorative illustrations, and approved UI art variants after the graybox establishes the real composition and information hierarchy.
- Keep interactive HUD structure, text, focus states, meters, and controls in accessible HTML/CSS or other code-native forms. Do not bake essential labels or interaction states into generated bitmaps.
- The interactive meadow remains a Three.js scene. Generated backgrounds may support menus, loading/results presentation, sky or distant-environment studies, and art-direction reference; they must not replace gameplay-relevant world geometry or target readability.
- Generate reference-first: lock an approved style frame and palette before producing a family of related assets. Review each output in its actual game composition before generating further variants.
- Every project-bound generated asset must be copied into the repository and accompanied by provenance: intended use, final prompt, generation tool/model path, generation date, reference-image roles, edits/post-processing, approval state, and final optimized derivative.
- Preserve editable/source-resolution generations separately from runtime derivatives. Optimize runtime raster assets to an appropriate PNG, WebP, or AVIF size and verify color, alpha, compression artifacts, memory cost, and loading behavior in a real browser.
- Prefer code-native SVG/CSS for simple icons and shapes. For transparent raster cutouts, use the image-generation skill's built-in chroma-key-removal workflow and validate the alpha edge before the asset is referenced by the game.
- Use the sprite-sheet and game-asset pipeline skills only when a genuinely 2D animated element needs them, such as a stylized HUD flourish or pre-rendered effect. The 3D blade, grass, flowers, shrubs, and trees remain model/shader assets rather than sprite sheets unless profiling proves a billboard representation is preferable.
- Do not batch-generate production art before the visual direction and one representative asset have been approved. Discarded explorations are not shipped assets.

## Performance targets

- Maintain 60 FPS at 1920x1080 on a current desktop browser at device pixel ratio up to 1.5 in the first meadow.
- Maintain at least 30 FPS on a representative mid-range integrated-GPU laptop; mobile support is a later phase.
- Keep average fixed-step simulation under 2 ms and p95 under 4 ms with the full Meadow Delivery population.
- Keep render draw calls below 120 and visible grass geometry below 250,000 triangles in the first arena.
- Meet the lush-field density contract with chunking, instancing, blade-width/segment LOD, and distance LOD; reducing vegetation to sparse props is not an acceptable performance fallback.
- Use chunk frustum culling; never disable culling for the entire field.
- Avoid per-rendered-blade JavaScript objects, raycasts, or allocations during the frame loop.
- Pool particles, collection motes, temporary labels, and severed-target presentation objects.
- Clamp renderer pixel ratio and expose quality presets. Presets may reduce shadow cost, shader detail, blade segments, effects, and distant instance density, but must retain continuous grass coverage and recognizable flower drifts. Touch/coarse-pointer and narrow mobile browser contexts default to the low-cost preset unless an explicit quality URL override is supplied.
- The build and tests must report accidental frame-loop allocations or unbounded collections when practical.

## Accessibility and comfort targets

- All gameplay, pause, restart, and results actions are keyboard operable.
- Show a visible focus indicator and an explicit `Start` action before capturing movement keys.
- Pause on window blur and release held input to prevent drift.
- Honor `prefers-reduced-motion`: remove camera shake, shorten/replace flying collection arcs with fades, and reduce particles without hiding state changes.
- Never rely on color alone for target toughness or quota completion; pair colors with icons, labels, and meter shape/state.
- Provide high-contrast HUD text at WCAG AA contrast and scalable text that remains usable at 200% browser zoom.
- Announce level-ups, quota completion, pause, and contract completion through a polite live region. Do not announce every grass cut.
- Provide independent master/music/effects volume controls and a mute shortcut once audio ships.
- Avoid flashes above three per second.

## Determinism and testability

- One explicit seed controls world generation and all simulation randomness.
- `Math.random()`, render time, and audio time must not affect authoritative state.
- Use a fixed 60 Hz update with a capped frame accumulator. Rendering may interpolate but cannot advance game rules.
- Sort or otherwise stabilize target processing so collection order does not vary by object/map iteration behavior.
- A JSON snapshot includes seed, tick, blade position/velocity/RPM/level/XP, contract quotas, collected totals, and every non-standing target ID with accumulated work/state.
- Phase 0 debug contract:
  - `?seed=<uint32>` selects the run seed.
  - `window.__grassBladeReady` becomes `true` when the scene is controllable.
  - `window.render_game_to_text()` returns a concise JSON snapshot of visible, player-relevant state.
  - `window.advanceTime(milliseconds)` switches automation to manual time, advances exact 60 Hz ticks, and renders the result.
  - Playwright supplies keyboard input in short bursts and reads the same state exposed by `render_game_to_text()`.
- Tests must cover target timing ranges, RPM recovery, too-tough behavior, idempotent awards, multi-level XP jumps, quota completion, seed replay, and snapshot stability.

## Non-goals

- Enemies, weapons combat, health, death, gore, or player damage.
- Default timer failure, energy depletion, hunger, or punishment for experimentation.
- Endless procedural terrain in the MVP.
- Persistent currencies, shops, equipment inventories, crafting, or meta-progression.
- Bulk production art generation before the graybox camera, HUD layout, and representative style frame are approved.
- Manual upgrade choices during a run; leveling is automatic.
- Online multiplayer, accounts, leaderboards, cloud saves, or monetization.
- Fully simulated tree-fall physics, deformable terrain, or per-blade rigid bodies.
- Native mobile app packaging, stores, and platform-specific persistence.
- Copying the reference GrassField wholesale.

## Risks and open questions

| Topic            | Current decision                                                                                      | Open question / validation                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Blade silhouette | Generated GLB cutter asset ships with two-arm, four-arm, and saw tiers plus a cyan orientation stripe | Continue testing silhouettes for readability and friendliness on physical mobile devices |
| Tree finish      | Authored sever/fall presentation, not rigid-body simulation                                           | Pick fall direction rule that cannot obscure the player or block quotas                  |
| Grass cut mask   | CPU grid projected into per-chunk GPU texture                                                         | Validate texel density so edges look organic without large texture updates               |
| Camera           | Fixed orthographic isometric follow camera                                                            | Validate pitch and zoom on laptop and ultrawide displays                                 |
| Contract length  | Meadow Delivery targets a 6-10 minute first run                                                       | Tune only after measuring novice completion and stall moments                            |
| Timed contracts  | Allowed only as explicit authored contracts, not the default mode                                     | Tune time limits and quotas only with before/after playtest evidence                     |
| Audio            | RPM pitch and material contact are important feedback                                                 | Select generation/licensing pipeline and reduced-sensory defaults later                  |
| Art scope        | One meadow with six target types                                                                      | Decide whether shrubs/saplings use authored models or procedural primitives              |
| Mobile           | Browser touch controls, responsive HUD, and mobile viewport sizing are implemented                    | Validate on more physical devices and tune mobile performance if needed                  |

## Phased delivery plan

### Phase 0 — Foundation

Deliver:

- Bun, Vite, strict TypeScript, Three.js, standard Make targets, lint/format/typecheck/test/build, and pre-commit secret scanning.
- Dev server fixed at `http://127.0.0.1:4209`.
- A bounded placeholder meadow, fixed isometric camera, visible spinning horizontal blade, keyboard movement, input release on blur, and fullscreen.
- Fixed-step simulation shell, seeded RNG, text-state diagnostics, and deterministic manual time advancement.
- Browser smoke test and deterministic unit-test seam.

Exit criteria:

- `make checkall` passes from a clean install.
- The headed browser shows the blade moving with WASD/arrows under the fixed camera; `F` toggles fullscreen.
- Two reloads with the same seed produce identical JSON snapshots after the same scripted inputs.
- `window.advanceTime()` works without wall-clock animation.
- Cutting, quotas, collection, and progression are visibly labeled as not yet shipped.

### Phase 1 — First cuttable contract

Deliver:

- CPU target grid/spatial query, grass, flowers, and dense weeds.
- Blade RPM/load/work model, persistent cut progress, exact-once resources and XP.
- Automatic levels 1-4, Meadow Delivery quotas with temporary sapling placeholders, quota HUD, and immediate collection feedback.
- A representative dense tapered-grass canopy, clustered flowers, an oversized readable cutter, and persistent wide cut swaths with stubble/clippings; the fully chunked shader renderer remains Phase 3 work.
- Deterministic tests for cutting, RPM recovery, progression, and quota accounting.

Exit criteria:

- Grass, flowers, and weeds fall within the timing ranges in the target table.
- A scripted seeded run awards every target once, crosses known level thresholds, and completes its available quotas identically on repeat.
- The HUD updates on the cut tick, not when its collection mote arrives.
- `make checkall` and the browser smoke test pass.

### Phase 2 — Resistance ladder and full Meadow Delivery

Deliver:

- Shrubs, saplings, mature trees, non-cuttable rocks, and material-specific feedback.
- Full levels 1-8, too-tough feedback, multi-contact RPM load, wood quota, completion/results flow.
- Authored sever/fall/flatten presentations without rigid-body authority.

Exit criteria:

- Every target matches its recommended-level timing range within 15% in deterministic tests.
- A level-1 tree contact stalls below cutting RPM while an isolated level-6 tree completes in range.
- Meadow Delivery is completable from at least ten validated seeds without relying on mature trees.
- Completion, restart, and next-contract state transitions are idempotent.

### Phase 3 — Stylized field renderer

Deliver:

- Chunked instanced blade rendering, wind, terrain/grass color agreement, GPU cut mask, continuous grass canopy, dense flower drifts, and target art.
- A game-ready authored blade GLB following the hub-origin, `+Y` spin-axis, swept-radius, and optimization contract.
- An approved generated-art style frame plus provenance manifests and browser-verified runtime derivatives for any AI-assisted raster assets introduced in this phase.
- Adapted reference techniques with upstream notices where required.
- Quality presets, chunk culling, effect pools, and frame diagnostics.

Exit criteria:

- Cut cells remain down and align with authoritative CPU snapshots after camera travel and reset.
- A deterministic Meadow Delivery density report confirms at least 85% eligible-terrain grass coverage, at least 90 decorative grass blades per world unit squared on default quality, and 2-4 blossoms per world unit squared across flower drifts covering 20-30% of the starting grass area.
- Opening-view and traversal screenshots show continuous uncleared grass and flower fields with no sparse-prop presentation or unintended bare gaps; a cut pass leaves a coherent visible swath.
- No whole-field `frustumCulled = false` path exists.
- The first arena meets desktop and integrated-GPU frame targets with a captured diagnostic report.
- Visual inspection confirms no obvious transparent overdraw, shader/CPU cut disagreement, or static-instance reward bugs.

### Phase 4 — Cozy presentation and accessibility

Deliver:

- Final HUD, onboarding, pause/results screens, audio, RPM pitch, collection/level-up polish, reduced-motion mode, high-contrast treatment, and live-region announcements.
- Approved image-generated menu/background/decorative assets where they improve the presentation without replacing accessible code-native UI.
- Playwright input/fullscreen/smoke coverage and visual baselines.

Exit criteria:

- The full contract is keyboard playable with visible focus and no browser-scroll conflicts.
- Reduced motion preserves every state cue without collection arcs, camera shake, or excessive particles.
- Quota, toughness, and completion remain understandable in grayscale and at 200% zoom.
- Accessibility checks, `make checkall`, and a headed playthrough pass.

### Phase 5 — Expansion after first-playable evidence

Candidate work:

- Additional authored contracts and meadow variants.
- Non-square arena variants with branching paths and direction changes.
- Additional timed contracts with visible pre-start limits and deterministic timeout semantics.
- New organic target families and biome-specific resources.
- Balance/quality presets informed by telemetry-free local playtest captures.
- Touch controls and mobile optimization only after desktop contracts remain intact.

Exit criteria:

- Expansion work does not change the deterministic core rules without a PRD update and migration tests.
- Every new target declares work, resistance, yield, XP, feedback, and population guarantees.
- Every new contract is completable across its supported seed set and meets its stated duration target.
