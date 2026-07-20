# Grass Blade

Grass Blade is a cozy top-down Three.js arcade game about steering a continuously spinning horizontal blade through a stylized meadow. Soft grass cuts immediately; flowers, weeds, shrubs, saplings, and trees increasingly load the blade. Cutting automatically levels the blade during the run while resource quotas guide the player toward contract completion.

The detailed gameplay and engineering contract lives in [PRD.md](PRD.md).

## Current status

Phase 0 is complete, and the first Phase 1 gameplay slices are implemented and verified. Grass cells, flower clusters, twelve dense-weed targets, and eight mature trees now have authoritative deterministic targets: moving the spinning blade through them applies RPM load and persistent cut work, leaves a lasting cut trail, awards resources exactly once, and automatically levels the blade. Dense weeds remain pass-through Tier 2 targets and award Fiber, while mature trees block the protected hub until their cut completes, then collapse to a traversable stump and award Wood. A compact HUD exposes elapsed time, RPM, level, XP progress, and the active Grass, Flower, and Fiber quotas.

**The full Meadow Delivery contract is not complete yet.** The Wood objective/HUD, immediate collection effects, and remaining Phase 1 accounting are still planned. Shrubs, saplings, rocks, too-tough presentation, and the completion/results flow remain Phase 2 work under the PRD. See [progress.md](progress.md) for the exact handoff state.

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

| Input      | Action                                                       |
| ---------- | ------------------------------------------------------------ |
| `W A S D`  | Move relative to the screen                                  |
| Arrow keys | Equivalent movement controls                                 |
| `F`        | Toggle fullscreen                                            |
| `Escape`   | Leave fullscreen; pause is planned with contracts            |
| `R`        | Restart from the pause or results screen once contracts ship |

The blade spins automatically; there is no attack button.

## Deterministic debug hooks

The browser-facing automation contract lets the game be observed and driven without synthetic mouse gestures:

- `?seed=<uint32>` selects a deterministic world seed.
- `window.__grassBladeReady` becomes `true` when the scene is controllable.
- `window.render_game_to_text()` returns a concise JSON snapshot of visible game state.
- `window.advanceTime(milliseconds)` switches automation to manual time, advances exact 60 Hz ticks, and renders.

These hooks include the current inventory, objectives, XP, RPM, target counts, and partially cut target work. See [progress.md](progress.md) for the recorded evidence.

Example URL:

```text
http://127.0.0.1:4209/?seed=12345
```

## Rendering direction

The project uses an authoritative CPU target grid plus GPU instancing. This keeps collection, XP, quotas, tests, and debug snapshots deterministic without creating a JavaScript object or raycast for every visible blade. A chunked world-aligned GPU cut mask remains the Phase 3 scaling target.

The current visual field renders a deterministic 104 by 104 lattice of 10,816 instanced fourteen-blade grass tufts—151,424 narrow blades—plus 420 low-poly flowers arranged across 16 seeded drifts, 108 broad-leaf weed instances mapped nine-to-one onto twelve targets, and eight mature trees. Each 4 by 4 group of grass visuals maps to one of 676 logical reward targets, but a finer persistent visual mask flattens only the individual tufts intersected by the blade's swept path. Flowers and weeds map to stable logical targets, while tree visuals and collision share the same authoritative world targets. Cut vegetation remains as stubble, clippings, stems, petals, leaf litter, or a stump for the rest of the run.

`/Users/probello/Repos/stylized-components` is a local visual reference, not a required dependency. Its seeded area-weighted scattering, opaque instanced blades, wind shaders, shared ground mask, and flower treatment are useful techniques. Its current R3F component is not a drop-in gameplay system because it is GLB-name coupled, builds static instances, has no cut/reward state, limits rock trampling to 24 shader uniforms, and disables frustum culling for the field. The full audit and MIT reuse requirements are recorded in [PRD.md](PRD.md#local-grass-reference-audit).

## License

Grass Blade is licensed under the [MIT License](LICENSE). Any future code copied or substantially derived from the local `stylized-components` reference must also retain that project's upstream MIT copyright and permission notice.
