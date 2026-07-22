Original prompt: "i want create a threejs based game where you are a spinning blade that cuts down whatever its passes over, you need to collect a certain amount of various things by cutting it, like grass, flowers, tree's etc, the larger items take longer to cut unless your blade is a high enough level, the blade levels up as you cut things, grass being the easyest, this repo as a nice grass system check it out /Users/probello/Repos/stylized-components its not required to use it, just a refrence, lets brainstorm"

# Grass Blade Progress

Last updated: 2026-07-21
Active milestone: Phase 2 — deterministic coverage and non-cuttable rocks hardened; seed-validation slice next

## Completed foundation intent

- [x] Defined the top-down cozy-arcade product contract in `PRD.md`.
- [x] Locked a continuously spinning horizontal blade with screen-relative WASD/arrow movement and no attack button.
- [x] Locked the fixed orthographic isometric camera direction for the first playable.
- [x] Defined the deterministic RPM, torque, resistance, cut-work, run-local XP, and automatic-level formulas.
- [x] Defined exact target tiers for grass, flowers, weeds, shrubs, saplings, and mature trees.
- [x] Defined the first fixed Meadow Delivery quotas and no-fail-clock contract rules.
- [x] Defined immediate collection feedback, exact-once rewards, and persistent cut progress.
- [x] Chosen an authoritative CPU logical grid plus chunked GPU instancing/cut-mask architecture.
- [x] Audited `/Users/probello/Repos/stylized-components` at `b182d81bff64531e584f50d71f046ae05fab3c87`, including reuse opportunities, gameplay limitations, and MIT attribution obligations.
- [x] Defined Phase 0 through Phase 5 with explicit exit criteria.
- [x] Defined Bun/Make commands, port `4209`, keyboard controls, and deterministic browser debug hooks.
- [x] Defined a graybox-first Blender/Fusion blade pipeline and an image-generation pipeline for approved UI, background, texture, and decorative raster assets.
- [x] Locked continuous, lush grass coverage and clustered flower drifts as visual acceptance requirements; sparse prop scatter is not acceptable.

## Phase 0 implementation status

- [x] Confirmed Bun/Vite/strict-TypeScript/Three.js dependencies and lockfile are present.
- [x] Confirmed the standard Make targets exist: `build`, `test`, `lint`, `fmt`, `typecheck`, `checkall`, and `pre-commit`.
- [x] Confirmed pre-commit includes gitleaks, private-key detection, and local project gates.
- [x] Confirmed the Vite server binds to `127.0.0.1:4209`.
- [x] Confirmed the fixed isometric camera, lush graybox meadow, spinning horizontal blade, and screen-relative movement render in a headed browser.
- [x] Confirmed 10,816 instanced five-blade grass clumps and 420 five-petal flowers form continuous coverage and seeded flower drifts in opening and moved-camera captures.
- [x] Confirmed WASD, arrow keys, input release on blur, `F` fullscreen entry, and `Escape` fullscreen exit.
- [x] Confirmed seeded reloads, fixed-step updates, `render_game_to_text`, `advanceTime`, and the ready flag.
- [x] Ran and recorded `make checkall`.
- [x] Captured and visually inspected a headed-browser screenshot and deterministic state snapshot.

## Phase 0 verification evidence

- `make checkall` passes formatting verification, ESLint, strict TypeScript, 5 deterministic Vitest tests, and the Vite production build.
- The staged tree passes both required secret scans: gitleaks and `detect-private-key`.
- Headed Chrome rendered the built production preview at `?seed=12345` without console errors. The visually inspected lush-field captures are `output/playwright/final-lush/shot-0.png` and `shot-1.png` (ignored local verification artifacts).
- Two isolated production-preview `?seed=12345` input replays produced byte-identical first snapshots, including the reported 10,816 grass and 420 flower instances, with SHA-256 `4fc627c751b1a90e605658780e2b0b02a16f71d966826c0aa96da35f3f36ed0a`.
- A headed Chrome sample of 180 animation frames averaged 8.33 ms per frame (120 FPS on the test display), with 9.2 ms p95 and 9.4 ms maximum frame intervals. This is a local smoke measurement, not a cross-device benchmark.
- The headed input matrix produced matching screen-relative velocity vectors for each WASD/arrow pair. A separate held-input test confirmed blur zeroed velocity after normal deceleration.
- `F` entered fullscreen on `#app`, `Escape` exited fullscreen, and the final browser sessions reported zero errors and zero warnings.

## Phase 1 verified slice

- [x] Added 676 stable grass targets and 16 stable flower-drift targets with authoritative `standing -> cutting -> cut` state; later recycling remains deferred.
- [x] Promoted all eight meadow trees from decorative props to stable mature-tree targets with exact PRD work, resistance, six-Wood yield, and 75 XP.
- [x] Added twelve deterministic pass-through dense-weed targets with exact Tier 2 work, resistance, one-Fiber yield, six XP, and recommended-level timing.
- [x] Added five deterministic solid sapling targets with exact Tier 4 work, resistance, two-Wood yield, 30 XP, and recommended-level timing; their ten available Wood provide 166.7% of the fixed quota without mature-tree shortcuts.
- [x] Mapped 108 broad-leaf weed instances nine-to-one onto those authoritative targets; partial work stays upright away from the blade, live contact bends the plant, and completion tips and settles it continuously into a low terminal state.
- [x] Mapped a deterministic 104 by 104 visual lattice onto a 26 by 26 logical grass grid without per-rendered-blade gameplay objects or raycasts.
- [x] Added a finer persistent 104 by 104 grass visual cut mask so swept contact flattens only intersected tufts instead of an entire 4 by 4 reward patch.
- [x] Implemented swept-circle contact, aggregate RPM load, torque, recovery, and persistent cut work through a fixed 60 Hz accumulator.
- [x] Added swept hub-versus-solid collision: unfinished saplings and mature trees stop inward motion without preventing backing away, and stop blocking on the exact authoritative cut tick.
- [x] Implemented grass clumps and wildflowers with the exact PRD work, resistance, yield, and XP values.
- [x] Awarded resources and XP atomically and exactly once on the cut tick.
- [x] Added an append-only deterministic cut-completion event stream with stable revisions, target positions, rewards, XP, and before/after level bounds.
- [x] Implemented all cumulative XP thresholds and automatic levels 1-8, including multi-threshold awards.
- [x] Added live Grass, Flower, Fiber, and Wood quota, level, RPM, elapsed-time, and XP HUD state without introducing a failure countdown.
- [x] Added resource-matched HUD counter pulses and a consolidated `LEVEL N` notification, with reduced-motion fallbacks that do not gate accounting or movement.
- [x] Added target-local progress bars for damaged durable targets so weeds, saplings, and mature trees show persistent remaining work after first contact until they are cut.
- [x] Added target-local too-tough feedback for higher-level durable targets that pull the blade below cutting RPM; the label is throttled per target, reads `NEED LV N`, and stays anchored above the resisting plant while contact remains.
- [x] Rendered the five saplings with slim trunks and layered rounded foliage; exact live contact produces a deterministic lean/shudder, while completion reveals a stump and topples the severed top around the cut plane without ground clipping.
- [x] Separated transient blade-contact authority from persistent partial cut work, so released saplings immediately stop shuddering while retaining their accumulated work.
- [x] Replaced broad polygon clumps with 10,816 instanced fourteen-blade tufts, totaling 151,424 narrow tapered grass blades, and connected fine cut state to persistent stubble/clipping trails.
- [x] Replaced the placeholder bar with a large silver/cyan cutter that evolves from two arms at level 1, to four arms at levels 2-5, to an 18-tooth saw at levels 6-8 while preserving the same authoritative reach.
- [x] Added one asymmetric gold orientation cue to every cutter tier so fixed-step rotation remains visually legible even when symmetric blades or saw teeth would otherwise alias between frames.
- [x] Decoupled the visible cutter pivot from the physical RPM angle, then reduced the level-1 visual spin twice more so it reads as continuous rotation without a fast strobe.
- [x] Removed the circular blade ground-blob shadow at user direction.
- [x] Added a fixed 240-slot instanced fragment pool for deterministic grass clippings, petals, broad leaves, wood chips, and sapling/tree leaves without per-frame allocation.
- [x] Raised, enlarged, and brightened the pooled fragments with unlit double-sided materials so completions read as visible cut bursts rather than silent disappearance.
- [x] Added immediate live-damage wood-chip bursts for saplings and mature trees, followed by deterministic work-interval bursts; normal motion emits 18 or 24 chips respectively, reduced motion emits four, and the existing 240-slot pool remains the hard bound.
- [x] Added a fixed 64-slot DOM collection-mote pool that consumes authoritative cut events independently, arcs resource-matched `+N` rewards toward the correct HUD row over 280-450 ms, aggregates overflow, and uses a short destination fade under reduced motion.
- [x] Replaced immediate grass removal with a renderer-owned `fall -> settle -> shrink -> stubble` lifecycle that tips each tuft around its ground root and mats nearby cuts instead of producing a radial spoke halo.
- [x] Kept flower clusters fully standing during partial work, then animated each coherent stem, blossom, and center from the authoritative completion frame through a staggered fall, grounded hold, shrink, and short-stem state while petals remain secondary accents.
- [x] Added rooted weed, sapling, and mature-tree collapse lifecycles with separate stumps for woody targets, conservative crown clearance, continuous terminal transforms, and exact cut-tick presentation starts.
- [x] Added reduced-motion vegetation timing and live fall diagnostics without per-frame allocation or new gameplay authority.
- [x] Verified the fresh level-1 presentation as exactly two opposing blades with no saw teeth; four blades still begin only at level 2.
- [x] Expanded `render_game_to_text` with inventory, XP, loaded RPM, target counts, live blade contacts, cut revision, persistent partial-work diagnostics, recent cut events, blade tier, orientation-cue count, and fragment-pool state.
- [x] Expanded `render_game_to_text` with the current too-tough notice and overlay diagnostics so browser automation can verify target ID, kind, required level, current level, and visibility.
- [x] Added authoritative same-tick Meadow Delivery completion when the final quota is awarded, including a stable result snapshot with elapsed time, targets cut, highest level, final inventory, and completion revision.
- [x] Added a calm results card with elapsed time, targets cut, highest level, Restart, and Next Contract actions; `R` restarts the current seed and `N` opens the next deterministic seed from results.
- [x] Added a query-gated `?debug=1` browser hook, `window.completeContractForDebug()`, that completes the final quota through the normal fixed-step award path for deterministic results-flow verification.
- [x] Added pause mode and a pause card: Escape pauses an active contract unless fullscreen is being exited, simulation time and cutting freeze while paused, movement input is ignored, Resume returns to active play, and `R` restarts the current seed from pause.
- [x] Added deterministic tests for layout mapping, fine grass masks, available contract resources, repeated completion snapshots, grass/flower/weed/tree cuts, RPM recovery, aggregate RPM load, Tier 2 timing, solid blocking and release, persistent work, exact-once rewards, level thresholds, replay, movement, pause, and boundaries.
- [x] Added eight deterministic non-cuttable rock obstacles with rendered boulder visuals; rocks are solid blockers, never accrue cut work, never show progress bars, never award resources or XP, and allow the blade hub to back away after contact.

## Phase 1 verification evidence

- `make checkall` passes formatting verification, ESLint, strict TypeScript, 19 deterministic Vitest tests, and the Vite production build.
- A headed Chrome landscape route at `?seed=12345` ran for 7.333 simulated seconds without console errors and confirmed 95 exact-once cuts, 17 persistent partial cuts, 92 Grass, 3 Flowers, and blade level 3.
- A headed Chrome portrait route at 430 by 860 ran for 4.917 simulated seconds without console or page errors and confirmed 63 exact-once cuts, 10 persistent partial cuts, 61 Grass, 2 Flowers, and blade level 3.
- The visually inspected portrait captures are `output/playwright/phase1-portrait/initial.png` and `cut-path.png`; they show continuous standing coverage, clustered flowers, a large readable cutter, a persistent cut route, a compact top HUD, and no camera-visible void at the world edge. These local artifacts remain ignored.
- A prior headed Chrome shadow/cut-sync regression route verified cut-state timing, but its inspected blob-shadow presentation is superseded by the later shadow-removal regression below.
- A headed Chrome fine-grass capture at `?seed=12345` verified 151,424 narrow blades and a rounded 95-tuft opening cut footprint while no logical target had completed. The inspected local artifact is `output/playwright/fine-grass-final/shot-0.png`.
- A headed Chrome tree-contact replay ran for 4.6 simulated seconds without console errors. Holding forward stopped the hub at `(-14.691, -14.691)` with zero velocity, 158 RPM, and the first mature tree still present at `1.607/60` work with zero Wood awarded. The inspected local artifact is `output/playwright/tree-block/shot-0.png`.
- A headed Chrome standing-field capture at `?seed=12345` verified all 108 broad-leaf weed instances read above the fine grass canopy, the three-row objective tray showed Fiber `0/6`, and no console/page-error artifact was produced. The inspected local artifact is `output/playwright/weed-standing/shot-0.png`.
- A deterministic headed Chrome revisit route ran for 5.05 simulated seconds, reached level 2, cut two weeds, and showed Fiber `2/6` in the same authoritative snapshot with 34 Grass, one Flower, 49 XP, and no console/page errors. The inspected local artifact is `output/playwright/weed-fiber-award/shot-0.png`.
- A headed 430 by 860 Chrome viewport reported `errors: []`; its inspected capture shows all three objective counters, the XP track, and the broad-leaf weeds fitting the portrait composition. The local artifact is `output/playwright/weed-fiber-portrait/shot.png`.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 24 deterministic Vitest tests, and the Vite production build after the sapling/Wood slice.
- A deterministic headed Chrome landscape route at `?seed=12345` reached level 4 through normal mowing, stopped against `sapling-3` at `8.131/50` work with zero Wood, then cut it at 22.5 simulated seconds. The same authoritative frame removed the solid/visual target and updated Wood to `2/6`; browser errors remained empty. The inspected local artifacts are `output/playwright/sapling-wood-landscape/sapling-cutting.png` and `sapling-cut.png`.
- The same route at 430 by 860 preserved the compact four-counter HUD and readable blade/contact composition. Its snapshots changed Wood from `0/6` to `2/6`, removed only `sapling-3`, and reported no console or page errors. The inspected local artifacts are `output/playwright/sapling-wood-portrait/sapling-cutting.png` and `sapling-cut.png`.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 28 deterministic Vitest tests, and the Vite production build after the cut-event and presentation slices.
- A headed landscape route at `?seed=12345` progressed through normal cutting from the level-1 two-arm cutter, to the level-2 four-arm cutter, and to the level-6 18-tooth saw. Its level-6 snapshot reported 340 XP, 18 visible teeth, cut revision 301, 4,392 consumed fine-grass visual cuts, 70 active pooled fragments, and no console or page errors. The inspected local artifacts are `output/playwright/cutting-feedback-landscape/level-1.png`, `level-2.png`, and `level-6-saw.png`.
- The same landscape route stopped on `sapling-3`, showed its deterministic sustained-contact shudder, then removed it and updated Wood to `2/6` on cut revision 146. The inspected `sapling-cut-burst.png` shows the Wood counter pulse and resource-specific chips beside the blade; `errors.json` is empty.
- A headed 430 by 860 route preserved the complete HUD and readable cutter profiles. Its level-2 capture visibly shows the consolidated `LEVEL 2` notification; the sapling cut snapshot reports Wood `2/6`, four visible blades, 18 active fragments, consumed cut revision 145, and an empty browser error log. The inspected local artifacts are `output/playwright/cutting-feedback-portrait/level-2.png` and `sapling-cut-burst.png`.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 29 deterministic Vitest tests, and the Vite production build after the motion and cut-feedback regression fixes.
- Deterministic headed Chrome routes at 1280 by 720 and 430 by 860 showed a partially worked sapling leave live contact, remain at exactly the same work across 60 idle fixed steps, and render upright in both inspected resting frames. The snapshots report an empty `bladeContacts` array and `inBladeContact: false` while preserving `status: cutting`; both browser error logs are empty.
- The same two routes finished the sapling on cut revision 162, updated Wood to `2/6`, removed its solid and visual on that frame, and rendered 18 active leaf/wood fragments. The inspected local artifacts are `output/playwright/motion-regression/sapling-cut-burst.png` and `output/playwright/motion-regression-portrait/sapling-cut-burst.png`.
- Both level-8 regressions reported 18 visible saw teeth and one orientation cue. Consecutive fixed-step landscape snapshots advanced the angle from `2.706` to `4.447` radians, and the inspected gold cue visibly changed position without reintroducing the circular blade shadow. The local artifacts are `output/playwright/motion-regression/level-8-cue-a.png` and `level-8-cue-b.png` plus their portrait equivalents.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 33 deterministic Vitest tests, and the Vite production build after the vegetation-collapse slice.
- Exact headed Chrome regressions at 1280 by 720 and 430 by 860 verify a fresh level-1 run exposes `bladeTier: "two-arm"`, exactly two visible blades, and zero saw teeth. Grass remains present through tipping, settling, and shrinking before stubble replaces it; the inspected local artifacts are `output/playwright/vegetation-fall-landscape-tuned/grass-tipping.png`, `grass-grounded.png`, and `grass-disappearing.png` plus their portrait equivalents.
- The same routes verify `flower-10` remains fully standing on its first partial-contact frame with no cut event, then starts coherent plant fall on the exact completion frame alongside the petal burst and cleans up after the grounded hold. The inspected local artifacts are `output/playwright/vegetation-fall-landscape-tuned/flower-partial-contact-standing.png`, `flower-fall-and-particles-start.png`, `flower-grounded.png`, and `flower-cleaned-up.png` plus their portrait equivalents; both browser error logs are empty.
- Headed Chrome regressions at 1280 by 720 verified that Fiber and Wood collection motes consume the same authoritative cut events as the HUD, weed and sapling fall starts on the cut tick, a finished sapling leaves a stump, partial woody work persists after retreat, and the 64-slot mote and 240-slot fragment pools remain bounded. The inspected local artifacts include `output/playwright/cut-feedback-20260721/landscape-weed-cut-mote.png`, `landscape-sapling-contact-chips.png`, `landscape-sapling-falling.png`, and `landscape-sapling-stump.png`.
- A frame-accurate mature-tree route verified that the first positive live-damage tick emits a 24-chip burst even when the Level-2 blade later stalls at `1.437/60` work, the tree remains solid, backing away clears contact, and no Wood is awarded early. The inspected local artifact is `output/playwright/cut-feedback-20260721/tree-contact-chips.png`.
- Separate 430 by 860 portrait and reduced-motion routes verified aligned Fiber collection feedback, the complete four-row HUD, shortened destination-fade motes, and bounded reduced particle feedback. All final browser scenarios reported no console or page errors.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 53 deterministic Vitest tests across four files, and the Vite production build after the collection-mote, rooted-reaction, and live wood-chip slice.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 54 deterministic Vitest tests across four files, and the Vite production build after the blade visual-spin readability fix.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 55 deterministic Vitest tests across four files, and the Vite production build after durable target progress bars.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 59 deterministic Vitest tests across four files, and the Vite production build after the blade visual-spin continuity fix. A Playwright idle-spin capture at `output/playwright/blade-spin-continuity/` showed the level-1 two-arm cutter progressing horizontal → diagonal → vertical, with no browser error artifacts; diagnostics confirmed the raw angle wrapped from `4.004` to `0.588` while the readable visual angle continued forward from `1.771` to `2.480`.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 61 deterministic Vitest tests across four files, and the Vite production build after the completion/results slice.
- The required web-game Playwright client ran against `?seed=12345` and wrote `output/playwright/results-flow-smoke/shot-0.png` without browser error artifacts.
- A debug-gated browser verification at `?seed=12345&debug=1` called `window.completeContractForDebug()`, confirmed `mode: "complete"`, all four objectives `status: "complete"`, final inventory `50/10/6/6`, a stable result snapshot, visible Restart and Next Contract buttons, and no console/page errors. The inspected screenshot is `output/playwright/results-flow-smoke/results-card.png`.
- Result-card button checks verified Next Contract navigates to `?seed=2654448114` and Restart returns to `?seed=12345`, with no browser errors.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 64 deterministic Vitest tests across four files, and the Vite production build after the too-tough presentation slice.
- The required web-game Playwright client ran against `?seed=12345`, drove the level-1 cutter into a higher-level shrub, and wrote `output/playwright/too-tough-smoke/shot-0.png` plus `state-0.json` without browser error artifacts. The inspected screenshot shows a red `NEED LV 3` label above the resisting shrub with its draining work bar below it; the snapshot reports `tooToughVisible: true`, `targetId: "shrub-1"`, `recommendedLevel: 3`, `currentLevel: 1`, player RPM `57.6`, and zero Wood/Fiber awarded early.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 66 deterministic Vitest tests across four files, and the Vite production build after the pause-flow slice.
- The required web-game Playwright client ran against `?seed=12345` after the pause build and wrote `output/playwright/pause-smoke-client/shot-0.png` without browser error artifacts.
- A focused Playwright pause route pressed Escape, inspected `output/playwright/pause-flow/paused.png`, and verified `mode: "paused"`, elapsed time frozen from `1.283` to `1.283` across 2 simulated seconds, inventory frozen at `12/0/0/0`, Resume returning to `active`, and `R` from pause reloading a fresh active run with lower elapsed time and reset inventory. The final summary is `output/playwright/pause-flow/result.json`, with `errors: []`.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 70 deterministic Vitest tests across four files, and the Vite production build after the deterministic coverage slice.
- New deterministic coverage verifies at least 150% available resources for all four Meadow Delivery quotas, sapling-only Wood availability, stable repeated contract-completion snapshots, RPM recovery after leaving a mature tree, and lower per-target work/RPM under simultaneous aggregate load.
- The required web-game Playwright client ran against `?seed=12345` after the coverage slice and wrote `output/playwright/coverage-smoke/shot-0.png` plus `state-0.json` without browser error artifacts; the inspected screenshot shows the HUD, lush field, and opening cut patch still rendering normally.
- `make checkall` passes formatting verification, ESLint, strict TypeScript, 72 deterministic Vitest tests across four files, and the Vite production build after the non-cuttable rocks slice.
- The required web-game Playwright client ran against `?seed=12345` after the rocks slice and wrote `output/playwright/rocks-smoke-client/shot-0.png` plus `state-0.json` without browser error artifacts. The snapshot reports `rockInstances: 8`, eight `rock-*` solid entries with `requiredWork: 0`, and no rock progress bars.
- Focused headed input routes against the same production preview confirmed solid-object blocking remains active in the runtime while route A, route B, and route C were intercepted by authored tree/shrub blockers before reaching a rock. Rock-specific browser contact is therefore covered by deterministic reducer tests in this slice, while visual/runtime smoke covers rendered rock population and browser health.

## Remaining Phase 1 TODOs

- [ ] Replace the linear target scan with the planned spatial query before discrete target counts grow beyond this bounded first slice.
- [ ] In Phase 2, add final sapling art/material feedback and ten-seed completion validation.

## Handoff rules

- `PRD.md` is the gameplay and architecture source of truth. Update it in the same change whenever a locked formula, tier, quota, non-goal, or exit criterion changes.
- Keep this file factual: completed means implemented and verified, not merely planned.
- Keep `README.md` explicit about which target tiers and contract systems are verified versus still planned.
- Record upstream notices before copying or substantially deriving code from `stylized-components`.
