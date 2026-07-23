# Grass Blade

Grass Blade is a cozy top-down Three.js arcade game about steering a continuously spinning horizontal blade through a stylized meadow. Soft grass cuts immediately; flowers, weeds, shrubs, saplings, and trees increasingly load the blade. Cutting automatically levels the blade during the run while resource quotas guide the player toward contract completion.

The detailed gameplay and engineering contract lives in [PRD.md](PRD.md).

## Current status

Phase 0 is complete, and the first Phase 1 and Phase 2 contract systems are implemented and verified. Grass cells, flower clusters, twelve dense-weed targets, eight shrubs, five Tier-4 saplings, eight mature trees, and eight non-cuttable rocks have authoritative deterministic targets: moving the spinning blade through cuttable targets applies RPM load and persistent cut work, leaves a lasting cut trail, awards resources exactly once, and automatically levels the blade. Dense weeds remain pass-through Tier-2 Fiber targets. Shrubs, saplings, and mature trees block the protected hub until their cut completes, then become traversable and award Fiber or Wood. Rocks are solid obstacles that never accrue work, never show progress bars, and never award resources or XP. If a higher-level durable target pulls the blade below cutting RPM, the game now shows a throttled target-local `NEED LV N` label above the resisting plant while the remaining-work bar drains below it. Live contact alone bends resistant plants and throws deterministic wood chips for woody targets; released targets return to rest without losing progress. Completed grass, flowers, weeds, shrubs, saplings, and mature trees now fall from their roots, settle or leave a stump as appropriate, and retire without snapping out of existence. A fixed 64-slot collection-mote pool arcs each authoritative reward toward the matching HUD counter while the counter itself still updates on the cut tick. A fresh run starts with only two opposing cutter arms at level 1; the cutter evolves to four arms at levels 2-5 and an 18-tooth saw at levels 6-8 without changing its authoritative reach. A cyan orientation stripe keeps rotation legible across the cutter's symmetric profiles, and the former circular ground-blob shadow has been removed. A compact HUD exposes elapsed time, RPM, level, XP progress, and all four active Grass, Flower, Fiber, and Wood quotas. Escape now pauses an active contract unless it is first exiting fullscreen; the pause card freezes simulation, offers Resume and Restart, and keeps `R` as the keyboard restart path. Completing all quotas switches the authoritative state to `complete` on the same fixed tick as the final reward, freezes elapsed time, and shows a results card with elapsed time, targets cut, highest level, Restart, and Next Contract.

Phase 3 renderer hardening is implemented and verified: measurable density diagnostics, frame diagnostics, low-quality renderer-cost scaling, decorative-grass chunk culling, near/far grass distance LOD, phone viewport aspect correction, mobile browser-chrome aspect fallback, the world-aligned grass GPU cut-mask path, and the production blade GLB asset path are exposed through the debug snapshot. The grass GPU cut-mask now owns persistent completed-grass stubble state without terminal per-instance matrix rewrites after the fall lifecycle. The generated blade asset now uses a low-profile cyan orientation stripe instead of the earlier gold peg/protrusion while preserving readable rotation. Browser snapshots report WebGL adapter/vendor strings so performance evidence distinguishes hardware rendering from SwiftShader/software rendering, and the archived headed capture confirms Apple Metal hardware rendering for desktop and phone-sized scenarios. See [progress.md](progress.md) for the exact handoff state.

Phase 4 presentation/accessibility work has started. A code-native onboarding card now appears first with a focused `Start Cutting` button; movement, pause, fullscreen, and simulation time stay inactive until that explicit Start action is activated. After Start, focus moves to the canvas and the normal keyboard/touch contract flow resumes. Touch and pen drags now show a temporary cyan stick at the drag origin so mobile movement direction is visible without adding a permanent control pad. Pause and results overlays move focus to their primary visible action, active contracts automatically pause and release held input when the browser window blurs, and Space is suppressed as a browser-scroll key while the canvas owns input. High-contrast HUD and dialog styling is available through `?contrast=high` and also activates from `forced-colors: active` or `prefers-contrast: more`. Reduced-motion mode is honored from `prefers-reduced-motion` and can be forced with `?motion=reduced` or disabled for testing with `?motion=standard`. Procedural WebAudio feedback starts only after the Start gesture and includes a blade RPM hum, resource-matched cut sounds, level-up stingers, completion audio, a mute shortcut, and independent Master/Music/Effects controls. `make accessibility-check` runs the current Phase 4 browser accessibility verifier for focus/no-scroll, blur-pause freeze, reduced-motion, and 200%-equivalent grayscale readability. `make playthrough-check-headed` runs a visible-browser contract pass covering movement, fullscreen exit-before-pause behavior, pause/resume focus, durable-target reward feedback, and completion.

Phase 5 expansion has authored contract variants and a Start-screen contract chooser. The default `meadow-delivery` contract remains the balanced `50/10/6/6` quota set, but now uses a broad non-square starter meadow with a main route, side routes, rounded clearings, and carved gaps instead of a full square lawn. Choose Flower Sweep on the Start screen, or add `?contract=flower-sweep`, to play a flower-drift contract with lighter Grass, Fiber, and Wood quotas plus every authored Flower target (`34/320/4/4`) in an asymmetric branching corridor-shaped growth arena. Choose Woodland Cleanup, or add `?contract=woodland-cleanup`, to emphasize weeds and saplings with heavier Fiber and Wood quotas (`30/6/8/8`) in connected woodland clearings. Choose Timber Trail, or add `?contract=timber-trail`, to play a 90-second grove route with `60 Grass / 16 Flowers / 8 Fiber / 16 Wood` quotas that require all five saplings plus one mature tree in deterministic balance. Choose Rock Garden, or add `?contract=rock-garden`, to play a 70-second obstacle slalom with visible rock cutouts and `100 Grass / 80 Flowers / 8 Fiber / 4 Wood` quotas. Choose Hedge Maze, or add `?contract=hedge-maze`, to play an 80-second shrub route with `183 Grass / 300 Flowers / 28 Fiber` quotas that require all dense weeds and shrubs. Choose Timed Harvest, or add `?contract=timed-harvest`, to play a 60-second loop-route challenge with nearly full `170 Grass / 300 Flowers / 18 Fiber` quotas and no Wood requirement. Choose Field Sprint, or add `?contract=field-sprint`, to play a 45-second flower-lane sprint with much heavier `120 Grass / 120 Flowers` quotas and no durable-target requirements. Choose Weed Rush, or add `?contract=weed-rush`, to play a 55-second switchback route with `150 Grass / 220 Flowers / 18 Fiber` quotas and no Wood requirement. Choose Clear Every Patch, or add `?contract=clear-every-patch`, to play a split-clearings full-clean objective that requires every generated Grass and Flower patch to be cut before completion. Timed contracts show a visible pre-start time badge, a countdown HUD, and a `Time Up` result if the timer expires before every quota is complete. Successful completions update a local best time per authored contract, shown on the chooser and result card; timed-out attempts do not overwrite records. Zero-quota resources are omitted from the chooser quota copy and active HUD row. Flower drifts are now split into twenty smaller authoritative flower pockets with tighter cut radii, so touching the edge of a patch no longer cuts, topples, or completes the entire patch. Authored growth silhouettes also place subtle deterministic low stones/moss scallops along route edges so paths and clearings read as intentional spaces instead of invisible square masks, while actual movement blocking comes only from visible solid targets and the outer world bounds. Unknown contract IDs safely fall back to Meadow Delivery.

## Play online

The public GitHub Pages deployment is configured to publish the production Vite build from `main`:

```text
https://grass-blade.pardev.net/
```

The GitHub Pages fallback URL is `https://paulrobello.github.io/grass-blade/`.
The custom domain is served through Cloudflare proxying with a valid `*.pardev.net` certificate; GitHub Pages native HTTPS enforcement can be retried later once GitHub provisions its own custom-domain certificate.

The production site is installable as a mobile PWA. It ships a fullscreen web manifest, Apple mobile-web-app metadata, app icons, and a production-only service worker for the app shell so adding it to the home screen opens the play area without browser chrome.

## Requirements

- [Bun](https://bun.sh/) 1.3.12
- A WebGL2-capable current browser
- GNU Make for the convenience targets

## Run locally

```sh
bun install
make dev
```

Open [http://127.0.0.1:4209](http://127.0.0.1:4209).

The package scripts remain available directly:

```sh
bun run dev
bun run build
bun run test
bun run lint
bun run fmt
bun run typecheck
```

## Make targets

| Target                          | Purpose                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `make dev`                      | Start the Vite development server on `127.0.0.1:4209`                         |
| `make build`                    | Produce the production bundle                                                 |
| `make test`                     | Run deterministic unit tests                                                  |
| `make lint`                     | Run ESLint                                                                    |
| `make fmt`                      | Format source and project files                                               |
| `make typecheck`                | Run TypeScript without emitting files                                         |
| `make accessibility-check`      | Run the browser Phase 4 accessibility verifier; requires `make dev` first     |
| `make mobile-check`             | Run the phone layout, pause-HUD, and touch-drag verifier; requires dev server |
| `make playthrough-check`        | Run deterministic browser playthrough smoke; requires `make dev` first        |
| `make playthrough-check-headed` | Run the playthrough in a visible browser with fullscreen coverage             |
| `make contract-balance-capture` | Capture multi-seed cut-budget evidence for every authored contract            |
| `make perf-capture`             | Capture default headless performance screenshots and JSON summaries           |
| `make perf-capture-headed`      | Capture the same scenarios in a visible browser for hardware-adapter evidence |
| `make checkall`                 | Run formatting verification, lint, typecheck, tests, and build                |
| `make pre-commit`               | Run all configured pre-commit hooks, including secret scans                   |

## Controls

| Input            | Action                                                 |
| ---------------- | ------------------------------------------------------ |
| Start button     | Begin the contract before movement keys are captured   |
| Contract card    | Choose an authored contract before starting            |
| Touch / pen drag | Move with a temporary on-screen stick affordance       |
| `W A S D`        | Move relative to the screen                            |
| Arrow keys       | Equivalent movement controls                           |
| `F`              | Toggle fullscreen                                      |
| `M`              | Toggle mute                                            |
| `Escape`         | Leave fullscreen if active; otherwise pause/resume     |
| `R`              | Restart the current seed from pause or results         |
| `N`              | Open the next authored contract and deterministic seed |

The blade spins automatically; there is no attack button.

## Accessibility

Grass Blade starts with a keyboard-focusable `Start Cutting` button before gameplay captures movement keys. It also exposes a dedicated off-screen polite live region for assistive technology. The live region announces contract start, pause/resume, level-ups, quota completion, and final contract completion while avoiding noisy per-grass-cut chatter. The same latest announcement is included in `window.render_game_to_text()` under `accessibility.liveRegionText` for automated verification. Add `?contrast=high` to force a high-contrast treatment for the HUD, dialogs, target progress bars, buttons, and control hint; users with `forced-colors: active` or `prefers-contrast: more` receive the same treatment automatically unless `?contrast=standard` is supplied for testing. Reduced-motion users receive shortened vegetation falls, calmer particles, destination-fade collection feedback, and reduced HUD animations. Use `?motion=reduced` or `?motion=standard` to force either mode for deterministic checks. With the local dev server running, `make accessibility-check` verifies the keyboard focus path, canvas Space/no-scroll behavior, active-contract blur pause with held-input release and frozen elapsed time, reduced-motion state cues, and 200%-equivalent grayscale HUD/results readability.

## Deterministic debug hooks

The browser-facing automation contract lets the game be observed and driven without synthetic mouse gestures:

- `?seed=<uint32>` selects a deterministic world seed.
- `?contract=meadow-delivery`, `?contract=flower-sweep`, `?contract=woodland-cleanup`, `?contract=timber-trail`, `?contract=rock-garden`, `?contract=hedge-maze`, `?contract=timed-harvest`, `?contract=field-sprint`, `?contract=weed-rush`, or `?contract=clear-every-patch` selects the authored contract template; unknown IDs fall back to `meadow-delivery`.
- `window.__grassBladeReady` becomes `true` when the scene is controllable.
- `window.render_game_to_text()` returns a concise JSON snapshot of visible game state.
- `window.advanceTime(milliseconds)` switches automation to manual time, advances exact 60 Hz ticks, and renders.
- `?quality=low` selects the low preset, disables antialiasing and shadow rendering, caps renderer pixel ratio at 1.0, and renders eight grass blades per visual tuft. The default preset keeps antialiasing and 1024px shadows, caps pixel ratio at 1.5, and renders fourteen grass blades per tuft.
- `?contrast=high` forces high-contrast interface styling; `?contrast=standard` forces the standard interface during contrast-regression testing.
- `?motion=reduced` forces reduced-motion presentation; `?motion=standard` forces standard presentation during motion-regression testing.
- `?muted=1`, `?masterVolume=<0-100>`, `?musicVolume=<0-100>`, and `?effectsVolume=<0-100>` set initial audio state for deterministic audio-control checks.
- `?debug=1` exposes `window.completeContractForDebug()` for deterministic browser verification of the results flow; the hook completes the final quota through the normal fixed-step award path.
- `?debug=1` also exposes `window.cutTargetForDebug(kind)` for visual verification of a specific authored target kind through the same fixed-step cut and reward path. Non-cuttable targets such as rocks are ignored.

These hooks include the current mode, start-flow state, pause/result state, local best-time records, accessibility live-region text, high-contrast state, reduced-motion state, audio diagnostics, keyboard/pointer input, touch-stick visibility diagnostics, inventory, objectives, XP, RPM, target counts, live blade-contact target IDs, too-tough notice diagnostics, partially cut target work, recent authoritative cut events, blade presentation tier, blade asset load state, orientation cue, pooled-fragment diagnostics, meadow density diagnostics, grass chunk/distance-LOD diagnostics, GPU cut-mask diagnostics including GPU-settled grass and completed-grass CPU matrix updates, playable-root layout diagnostics, canvas/backing aspect diagnostics, WebGL adapter diagnostics, and recent frame timing/pixel-ratio/quality diagnostics. See [progress.md](progress.md) for the recorded evidence.

Example URL:

```text
http://127.0.0.1:4209/?seed=12345
```

## Performance capture

Start the dev server first:

```sh
make dev
```

Then capture automated screenshots, JSON snapshots, frame timing, quality settings, canvas/backing ratios, and WebGL adapter strings:

```sh
make perf-capture
```

Use a visible browser when the goal is real hardware evidence rather than CI/headless smoke evidence:

```sh
make perf-capture-headed
```

The capture output defaults to `output/playwright/performance-capture/`. A `summary.json` entry is only hardware evidence when `hardwareEvidence` is `true`; SwiftShader, software, or llvmpipe renderers are useful automation checks but do not satisfy the Phase 3 integrated-GPU/mobile performance exit criterion. The latest tracked hardware summary is [docs/evidence/performance/2026-07-22-headed-summary.json](docs/evidence/performance/2026-07-22-headed-summary.json).

## Rendering direction

The project uses an authoritative CPU target grid plus GPU instancing. This keeps collection, XP, quotas, tests, and debug snapshots deterministic without creating a JavaScript object or raycast for every visible blade. Decorative grass now renders in 64 deterministic world chunks with conservative camera-footprint visibility plus near/far distance LOD. Completed grass cuts are projected into a world-aligned 104 by 104 GPU cut-mask texture that the instanced grass shader samples by world position; after the authored fall animation completes, persistent grass stubble is driven by that GPU mask instead of a terminal per-instance matrix rewrite. CPU target state remains authoritative for resources, XP, quotas, and debug snapshots. The cutter now has a generated GLB asset at `public/assets/blades/cutter-v1.glb`, produced by `tools/build_blade_asset.py`, with stable tier nodes loaded at runtime and the procedural cutter kept as a fallback if the asset fails to load. The rotating blade tiers use a cyan inlaid orientation stripe, not a gold protruding peg, so the blade cadence remains readable without looking like an accidental bolt.

The current default visual field keeps a deterministic 104 by 104 grass-tuft index space for masks and chunks, with 7,520 visible instanced fourteen-blade grass tufts—105,280 narrow blades before distance LOD—inside the authored starter-meadow silhouette. It is split across 8 by 8 frustum-cullable render chunks, plus 880 low-poly flowers arranged across 16 seeded drifts, 108 broad-leaf weed instances mapped nine-to-one onto twelve targets, five layered-foliage saplings, eight mature trees, and 83-130 low-profile arena-edge marker instances depending on the selected contract shape. Default near grass keeps fourteen blades per tuft, while far visible chunks switch to eight blades per tuft; low quality keeps the same authored coverage and target layout but disables antialiasing and shadow rendering, renders eight blades per visible tuft—60,160 narrow blades before distance LOD—and remains above the PRD's lower-quality 45 blades per world unit squared threshold. Each visible 4 by 4 group of grass visuals maps to one of 486 logical reward targets, but a finer persistent visual mask flattens only the individual tufts intersected by the blade's swept path. Flowers and weeds map to stable logical targets, while sapling and tree visuals and collision share the same authoritative world targets. Grass and flower source silhouettes use renderer-owned, root-anchored fall lifecycles before resolving to persistent stubble or short stems. Cut vegetation then remains as stubble, clippings, stems, petals, leaf litter, or a stump for the rest of the run. A fixed 240-slot instanced fragment pool renders short-lived secondary cut bursts without allocating per frame, and reduced-motion mode keeps the causal fall while shortening both vegetation and fragment lifetimes. `window.render_game_to_text()` exposes a deterministic meadow density report, quality settings, grass chunk visibility/distance-LOD diagnostics, GPU cut-mask diagnostics, arena boundary marker counts, and recent frame timing so the grass coverage, grass-blade density, flower-drift coverage, blossom density, active decorative-grass chunk count, current visible grass blade budget, cut-mask alignment, active boundary-marker count, and active render-cost preset can be checked against the Phase 3 renderer thresholds.

`/Users/probello/Repos/stylized-components` is a local visual reference, not a required dependency. Its seeded area-weighted scattering, opaque instanced blades, wind shaders, shared ground mask, and flower treatment are useful techniques. Its current R3F component is not a drop-in gameplay system because it is GLB-name coupled, builds static instances, has no cut/reward state, limits rock trampling to 24 shader uniforms, and disables frustum culling for the field. The full audit and MIT reuse requirements are recorded in [PRD.md](PRD.md#local-grass-reference-audit).

## License

Grass Blade is licensed under the [MIT License](LICENSE). Any future code copied or substantially derived from the local `stylized-components` reference must also retain that project's upstream MIT copyright and permission notice.
