Original prompt: "i want create a threejs based game where you are a spinning blade that cuts down whatever its passes over, you need to collect a certain amount of various things by cutting it, like grass, flowers, tree's etc, the larger items take longer to cut unless your blade is a high enough level, the blade levels up as you cut things, grass being the easyest, this repo as a nice grass system check it out /Users/probello/Repos/stylized-components its not required to use it, just a refrence, lets brainstorm"

# Grass Blade Progress

Last updated: 2026-07-19
Active milestone: Phase 0 — Foundation complete; Phase 1 is next

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
- [x] Confirmed 10,816 instanced grass blades and 420 five-petal flowers form continuous coverage and seeded flower drifts in opening and moved-camera captures.
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

## Next: Phase 1 TODOs

- [ ] Add an authoritative target model with stable IDs and the `standing -> cutting -> cut -> hidden/recycled` lifecycle.
- [ ] Add the CPU logical grid/spatial query without per-rendered-blade objects or raycasts.
- [ ] Implement blade RPM, aggregate contact load, torque, recovery, and persistent cut work at a fixed 60 Hz.
- [ ] Implement grass clumps, wildflowers, and dense weeds with the exact PRD work/resistance/yield/XP values.
- [ ] Award resources and XP once, on the cut tick, before presentation animations complete.
- [ ] Implement cumulative XP thresholds and automatic levels 1-4, including multi-threshold awards.
- [ ] Add the Meadow Delivery quota state and HUD, initially using a deterministic temporary wood-target fixture if needed.
- [ ] Add pooled collapse/burst/HUD-flight collection feedback with reduced-motion behavior.
- [ ] Add deterministic tests for timing ranges, RPM recovery, too-tough contact, idempotent rewards, level thresholds, quotas, replay, and snapshots.
- [ ] Verify the first cut loop in a headed browser and run `make checkall`.

## Handoff rules

- `PRD.md` is the gameplay and architecture source of truth. Update it in the same change whenever a locked formula, tier, quota, non-goal, or exit criterion changes.
- Keep this file factual: completed means implemented and verified, not merely planned.
- Cutting, progression, and quotas must remain described as planned in `README.md` until their Phase 1 browser and test gates pass.
- Record upstream notices before copying or substantially deriving code from `stylized-components`.
