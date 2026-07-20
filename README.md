# Grass Blade

Grass Blade is a cozy top-down Three.js arcade game about steering a continuously spinning horizontal blade through a stylized meadow. Soft grass cuts immediately; flowers, weeds, shrubs, saplings, and trees increasingly load the blade. Cutting automatically levels the blade during the run while resource quotas guide the player toward contract completion.

The detailed gameplay and engineering contract lives in [PRD.md](PRD.md).

## Current status

Phase 0 is complete and verified: the Bun/Vite/TypeScript foundation, fixed isometric scene, lush graybox meadow, placeholder blade movement, deterministic simulation seam, and agent-operable debug surface are in place.

**Cutting, collection, quotas, XP progression, level-ups, and authoritative flower/tree targets are planned; they are not shipped gameplay yet.** Dense decorative grass, flower drifts, and boundary trees are visible now, but they do not become cuttable until Phase 1. See [progress.md](progress.md) for the exact handoff state.

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

Phase 0 defines a browser-facing automation contract so the game can be observed and driven without synthetic mouse gestures:

- `?seed=<uint32>` selects a deterministic world seed.
- `window.__grassBladeReady` becomes `true` when the scene is controllable.
- `window.render_game_to_text()` returns a concise JSON snapshot of visible game state.
- `window.advanceTime(milliseconds)` switches automation to manual time, advances exact 60 Hz ticks, and renders.

These hooks are implemented and verified as part of the Phase 0 exit criteria. See [progress.md](progress.md) for the recorded evidence.

Example URL:

```text
http://127.0.0.1:4209/?seed=12345
```

## Rendering direction

The project will use an authoritative CPU target grid plus chunked GPU instancing and a world-aligned cut mask. This keeps collection, XP, quotas, tests, and debug snapshots deterministic without creating a JavaScript object or raycast for every visible blade.

The Phase 0 visual foundation renders a deterministic 104 by 104 jittered grass lattice (10,816 instances) plus 420 low-poly flowers arranged in seeded drifts. These are presentation-only instances for now; Phase 1 will connect dense visuals to authoritative cuttable targets.

`/Users/probello/Repos/stylized-components` is a local visual reference, not a required dependency. Its seeded area-weighted scattering, opaque instanced blades, wind shaders, shared ground mask, and flower treatment are useful techniques. Its current R3F component is not a drop-in gameplay system because it is GLB-name coupled, builds static instances, has no cut/reward state, limits rock trampling to 24 shader uniforms, and disables frustum culling for the field. The full audit and MIT reuse requirements are recorded in [PRD.md](PRD.md#local-grass-reference-audit).

## License

Grass Blade is licensed under the [MIT License](LICENSE). Any future code copied or substantially derived from the local `stylized-components` reference must also retain that project's upstream MIT copyright and permission notice.
