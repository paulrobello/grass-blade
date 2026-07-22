# Grass Blade

Grass Blade is a cozy top-down Three.js arcade game about steering a continuously spinning horizontal blade through a stylized meadow. Soft grass cuts immediately; flowers, weeds, shrubs, saplings, and trees increasingly load the blade. Cutting automatically levels the blade during the run while resource quotas guide the player toward contract completion.

The detailed gameplay and engineering contract lives in [PRD.md](PRD.md).

## Current status

Phase 0 is complete, and the first Phase 1 and Phase 2 contract systems are implemented and verified. Grass cells, flower clusters, twelve dense-weed targets, eight shrubs, five Tier-4 saplings, eight mature trees, and eight non-cuttable rocks have authoritative deterministic targets: moving the spinning blade through cuttable targets applies RPM load and persistent cut work, leaves a lasting cut trail, awards resources exactly once, and automatically levels the blade. Dense weeds remain pass-through Tier-2 Fiber targets. Shrubs, saplings, and mature trees block the protected hub until their cut completes, then become traversable and award Fiber or Wood. Rocks are solid obstacles that never accrue work, never show progress bars, and never award resources or XP. If a higher-level durable target pulls the blade below cutting RPM, the game now shows a throttled target-local `NEED LV N` label above the resisting plant while the remaining-work bar drains below it. Live contact alone bends resistant plants and throws deterministic wood chips for woody targets; released targets return to rest without losing progress. Completed grass, flowers, weeds, shrubs, saplings, and mature trees now fall from their roots, settle or leave a stump as appropriate, and retire without snapping out of existence. A fixed 64-slot collection-mote pool arcs each authoritative reward toward the matching HUD counter while the counter itself still updates on the cut tick. A fresh run starts with only two opposing cutter arms at level 1; the cutter evolves to four arms at levels 2-5 and an 18-tooth saw at levels 6-8 without changing its authoritative reach. A gold orientation cue keeps rotation legible across the cutter's symmetric profiles, and the former circular ground-blob shadow has been removed. A compact HUD exposes elapsed time, RPM, level, XP progress, and all four active Grass, Flower, Fiber, and Wood quotas. Escape now pauses an active contract unless it is first exiting fullscreen; the pause card freezes simulation, offers Resume and Restart, and keeps `R` as the keyboard restart path. Completing all quotas switches the authoritative state to `complete` on the same fixed tick as the final reward, freezes elapsed time, and shows a results card with elapsed time, targets cut, highest level, Restart, and Next Contract.

Current Phase 3 work is focused on renderer hardening: measurable density diagnostics are now in place, frame diagnostics and a first pixel-ratio quality preset are exposed through the debug snapshot, and the next renderer slices are chunk culling, broader quality scaling, and the production blade-asset path. See [progress.md](progress.md) for the exact handoff state.

## Play online

The public GitHub Pages deployment is configured to publish the production Vite build from `main`:

```text
https://paulrobello.github.io/grass-blade/
```

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

| Target            | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `make dev`        | Start the Vite development server on `127.0.0.1:4209`          |
| `make build`      | Produce the production bundle                                  |
| `make test`       | Run deterministic unit tests                                   |
| `make lint`       | Run ESLint                                                     |
| `make fmt`        | Format source and project files                                |
| `make typecheck`  | Run TypeScript without emitting files                          |
| `make checkall`   | Run formatting verification, lint, typecheck, tests, and build |
| `make pre-commit` | Run all configured pre-commit hooks, including secret scans    |

## Controls

| Input      | Action                                                   |
| ---------- | -------------------------------------------------------- |
| `W A S D`  | Move relative to the screen                              |
| Arrow keys | Equivalent movement controls                             |
| `F`        | Toggle fullscreen                                        |
| `Escape`   | Leave fullscreen if active; otherwise pause/resume       |
| `R`        | Restart the current seed from pause or results           |
| `N`        | Open the next deterministic seed from the results screen |

The blade spins automatically; there is no attack button.

## Deterministic debug hooks

The browser-facing automation contract lets the game be observed and driven without synthetic mouse gestures:

- `?seed=<uint32>` selects a deterministic world seed.
- `window.__grassBladeReady` becomes `true` when the scene is controllable.
- `window.render_game_to_text()` returns a concise JSON snapshot of visible game state.
- `window.advanceTime(milliseconds)` switches automation to manual time, advances exact 60 Hz ticks, and renders.
- `?quality=low` selects the low preset and caps renderer pixel ratio at 1.0; the default preset caps pixel ratio at 1.5.
- `?debug=1` exposes `window.completeContractForDebug()` for deterministic browser verification of the results flow; the hook completes the final quota through the normal fixed-step award path.
- `?debug=1` also exposes `window.cutTargetForDebug(kind)` for visual verification of a specific authored target kind through the same fixed-step cut and reward path. Non-cuttable targets such as rocks are ignored.

These hooks include the current mode, pause/result state, inventory, objectives, XP, RPM, target counts, live blade-contact target IDs, too-tough notice diagnostics, partially cut target work, recent authoritative cut events, blade presentation tier and orientation cue, pooled-fragment diagnostics, meadow density diagnostics, and recent frame timing/pixel-ratio/quality diagnostics. See [progress.md](progress.md) for the recorded evidence.

Example URL:

```text
http://127.0.0.1:4209/?seed=12345
```

## Rendering direction

The project uses an authoritative CPU target grid plus GPU instancing. This keeps collection, XP, quotas, tests, and debug snapshots deterministic without creating a JavaScript object or raycast for every visible blade. A chunked world-aligned GPU cut mask remains the Phase 3 scaling target.

The current visual field renders a deterministic 104 by 104 lattice of 10,816 instanced fourteen-blade grass tufts—151,424 narrow blades—plus 880 low-poly flowers arranged across 16 seeded drifts, 108 broad-leaf weed instances mapped nine-to-one onto twelve targets, five layered-foliage saplings, and eight mature trees. Each 4 by 4 group of grass visuals maps to one of 676 logical reward targets, but a finer persistent visual mask flattens only the individual tufts intersected by the blade's swept path. Flowers and weeds map to stable logical targets, while sapling and tree visuals and collision share the same authoritative world targets. Grass and flower source silhouettes use renderer-owned, root-anchored fall lifecycles before resolving to persistent stubble or short stems. Cut vegetation then remains as stubble, clippings, stems, petals, leaf litter, or a stump for the rest of the run. A fixed 240-slot instanced fragment pool renders short-lived secondary cut bursts without allocating per frame, and reduced-motion mode keeps the causal fall while shortening both vegetation and fragment lifetimes. `window.render_game_to_text()` exposes a deterministic meadow density report so the grass coverage, grass-blade density, flower-drift coverage, and blossom density can be checked against the Phase 3 lush-field thresholds.

`/Users/probello/Repos/stylized-components` is a local visual reference, not a required dependency. Its seeded area-weighted scattering, opaque instanced blades, wind shaders, shared ground mask, and flower treatment are useful techniques. Its current R3F component is not a drop-in gameplay system because it is GLB-name coupled, builds static instances, has no cut/reward state, limits rock trampling to 24 shader uniforms, and disables frustum culling for the field. The full audit and MIT reuse requirements are recorded in [PRD.md](PRD.md#local-grass-reference-audit).

## License

Grass Blade is licensed under the [MIT License](LICENSE). Any future code copied or substantially derived from the local `stylized-components` reference must also retain that project's upstream MIT copyright and permission notice.
