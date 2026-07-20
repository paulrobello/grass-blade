Original prompt: "i want create a threejs based game where you are a spinning blade that cuts down whatever its passes over, you need to collect a certain amount of various things by cutting it, like grass, flowers, tree's etc, the larger items take longer to cut unless your blade is a high enough level, the blade levels up as you cut things, grass being the easyest, this repo as a nice grass system check it out /Users/probello/Repos/stylized-components its not required to use it, just a refrence, lets brainstorm"

# Grass Blade Progress

Last updated: 2026-07-20
Active milestone: Phase 1 — Fine grass and solid mature-tree slice verified; remaining target tiers and contract completion next

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
- [x] Mapped a deterministic 104 by 104 visual lattice onto a 26 by 26 logical grass grid without per-rendered-blade gameplay objects or raycasts.
- [x] Added a finer persistent 104 by 104 grass visual cut mask so swept contact flattens only intersected tufts instead of an entire 4 by 4 reward patch.
- [x] Implemented swept-circle contact, aggregate RPM load, torque, recovery, and persistent cut work through a fixed 60 Hz accumulator.
- [x] Added swept hub-versus-solid collision: unfinished mature trees stop inward motion without preventing backing away, and stop blocking on the exact authoritative cut tick.
- [x] Implemented grass clumps and wildflowers with the exact PRD work, resistance, yield, and XP values.
- [x] Awarded resources and XP atomically and exactly once on the cut tick.
- [x] Implemented all cumulative XP thresholds and automatic levels 1-8, including multi-threshold awards.
- [x] Added live grass/flower quota, level, RPM, elapsed-time, and XP HUD state without introducing a failure countdown.
- [x] Replaced broad polygon clumps with 10,816 instanced fourteen-blade tufts, totaling 151,424 narrow tapered grass blades, and connected fine cut state to persistent stubble/clipping trails.
- [x] Replaced the placeholder bar with a large four-arm silver/cyan cutter and tightened responsive portrait/desktop framing.
- [x] Expanded `render_game_to_text` with inventory, XP, loaded RPM, target counts, cut revision, and persistent partial-work diagnostics.
- [x] Added deterministic tests for layout mapping, fine grass masks, grass/flower/tree cuts, solid blocking and release, persistent work, exact-once rewards, level thresholds, replay, movement, and boundaries.

## Phase 1 verification evidence

- `make checkall` passes formatting verification, ESLint, strict TypeScript, 15 deterministic Vitest tests, and the Vite production build.
- A headed Chrome landscape route at `?seed=12345` ran for 7.333 simulated seconds without console errors and confirmed 95 exact-once cuts, 17 persistent partial cuts, 92 Grass, 3 Flowers, and blade level 3.
- A headed Chrome portrait route at 430 by 860 ran for 4.917 simulated seconds without console or page errors and confirmed 63 exact-once cuts, 10 persistent partial cuts, 61 Grass, 2 Flowers, and blade level 3.
- The visually inspected portrait captures are `output/playwright/phase1-portrait/initial.png` and `cut-path.png`; they show continuous standing coverage, clustered flowers, a large readable cutter, a persistent cut route, a compact top HUD, and no camera-visible void at the world edge. These local artifacts remain ignored.
- A headed Chrome shadow/cut-sync regression route ran for 1.883 simulated seconds without console errors. Its inspected capture shows the blob shadow above ground patches and cut stubble, while all 16 partially worked `cutting` targets are visually flattened before the 25 completed targets award resources. The local artifact is `output/playwright/fix-shadow-cut-sync/shot-0.png`.
- A headed Chrome fine-grass capture at `?seed=12345` verified 151,424 narrow blades and a rounded 95-tuft opening cut footprint while no logical target had completed. The inspected local artifact is `output/playwright/fine-grass-final/shot-0.png`.
- A headed Chrome tree-contact replay ran for 4.6 simulated seconds without console errors. Holding forward stopped the hub at `(-14.691, -14.691)` with zero velocity, 158 RPM, and the first mature tree still present at `1.607/60` work with zero Wood awarded. The inspected local artifact is `output/playwright/tree-block/shot-0.png`.

## Remaining Phase 1 TODOs

- [ ] Add dense weeds, shrubs, and saplings with their exact PRD work/resistance/yield/XP values, then finish distinct feedback across the full resistance ladder.
- [ ] Activate fiber and wood objectives/HUD, complete Meadow Delivery accounting, deterministic contract completion, results, and restart flow.
- [ ] Add pooled collapse/burst/HUD-flight collection feedback, level-up presentation, low-RPM/too-tough feedback, and reduced-motion behavior.
- [ ] Add deterministic coverage for all tier timing ranges, RPM recovery, simultaneous aggregate load, too-tough contact, final quotas, and completion replay snapshots.
- [ ] Replace the linear target scan with the planned spatial query before discrete target counts grow beyond this bounded first slice.

## Handoff rules

- `PRD.md` is the gameplay and architecture source of truth. Update it in the same change whenever a locked formula, tier, quota, non-goal, or exit criterion changes.
- Keep this file factual: completed means implemented and verified, not merely planned.
- Keep `README.md` explicit about which target tiers and contract systems are verified versus still planned.
- Record upstream notices before copying or substantially deriving code from `stylized-components`.
