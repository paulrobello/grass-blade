import { describe, expect, it } from "vitest";

import {
  CONTRACT_DEFINITIONS,
  PLAYER_RADIUS,
  PLAYER_HUB_RADIUS,
  WORLD_HALF_EXTENT,
  createInitialState,
} from "../src/game/state";
import { createMeadowLayout, isPointInArenaGrowth, type TargetSeed } from "../src/game/world";

const IDS = ["pocket-garden", "long-orchard", "crescent-wetland"] as const;

describe("authored level variation", () => {
  it("generates each new contract deterministically with distinct footprints", () => {
    const first = IDS.map((id) => createMeadowLayout(0x12345678, id));
    const replay = IDS.map((id) => createMeadowLayout(0x12345678, id));
    expect(first).toEqual(replay);

    const extents = first.map((layout) => {
      const points = layout.grassCells;
      const xs = points.map((point) => point.x);
      const zs = points.map((point) => point.z);
      return {
        width: Math.max(...xs) - Math.min(...xs),
        depth: Math.max(...zs) - Math.min(...zs),
        area: points.length,
      };
    });
    expect(
      new Set(extents.map((extent) => `${extent.width}:${extent.depth}:${extent.area}`)).size,
    ).toBe(3);
    expect(extents[0]?.area).toBeLessThan(extents[1]?.area ?? 0);
    expect((extents[1]?.width ?? 0) / (extents[1]?.depth ?? 1)).toBeGreaterThan(1.5);
  });

  it("keeps visual indices aligned and quotas obtainable", () => {
    for (const id of IDS) {
      const layout = createMeadowLayout(0x55aa, id);
      for (const visual of layout.flowerVisuals)
        expect(layout.flowerTargets[visual.targetIndex]).toBeDefined();
      for (const visual of layout.softCropVisuals)
        expect(layout.softCropTargets[visual.targetIndex]).toBeDefined();
      for (const visual of layout.denseWeedVisuals)
        expect(layout.denseWeedTargets[visual.targetIndex]).toBeDefined();
      for (const visual of layout.fiberReedVisuals)
        expect(layout.fiberReedTargets[visual.targetIndex]).toBeDefined();
      for (const visual of layout.shrubVisuals)
        expect(layout.shrubTargets[visual.targetIndex]).toBeDefined();
      for (const visual of layout.saplingVisuals)
        expect(layout.saplingTargets[visual.targetIndex]).toBeDefined();
      for (const visual of layout.matureTreeVisuals)
        expect(layout.matureTreeTargets[visual.targetIndex]).toBeDefined();

      const contract = CONTRACT_DEFINITIONS.find((definition) => definition.id === id);
      expect(contract).toBeDefined();
      const yields = {
        grass: layout.grassCells.reduce((sum, target) => sum + target.yield, 0),
        flowers: [...layout.flowerTargets, ...layout.softCropTargets].reduce(
          (sum, target) => sum + target.yield,
          0,
        ),
        fiber: [
          ...layout.denseWeedTargets,
          ...layout.fiberReedTargets,
          ...layout.shrubTargets,
        ].reduce((sum, target) => sum + target.yield, 0),
        wood: [...layout.saplingTargets, ...layout.matureTreeTargets].reduce(
          (sum, target) => sum + target.yield,
          0,
        ),
      };
      expect(yields.grass).toBeGreaterThanOrEqual(contract?.objectives.grass ?? 0);
      expect(yields.flowers).toBeGreaterThanOrEqual(contract?.objectives.flowers ?? 0);
      expect(yields.fiber).toBeGreaterThanOrEqual(contract?.objectives.fiber ?? 0);
      expect(yields.wood).toBeGreaterThanOrEqual(contract?.objectives.wood ?? 0);
    }
  });

  it("provides collision-free approaches to every harvest target across seeds", () => {
    for (const id of IDS) {
      for (const seed of [1, 42, 12345, 0x4242, 0xffffffff]) {
        const state = createInitialState(seed, id);
        const solids = state.targets.filter((target) => target.solidRadius > 0);
        expect(isPointInArenaGrowth(id, 0, 0)).toBe(true);
        expect(
          solids.every(
            (target) => Math.hypot(target.x, target.z) > PLAYER_HUB_RADIUS + target.solidRadius,
          ),
        ).toBe(true);
        const reachable = reachablePositions(solids);
        const plants = state.targets.filter(
          (target) => target.kind !== "grass" && target.kind !== "rock",
        );
        expect(
          new Set(plants.map((target) => `${target.x.toFixed(3)},${target.z.toFixed(3)}`)).size,
        ).toBe(plants.length);
        for (const plant of plants) {
          for (const solid of solids) {
            if (plant.id === solid.id) continue;
            expect(
              Math.hypot(plant.x - solid.x, plant.z - solid.z),
              `${id}: ${plant.id} avoids ${solid.id}`,
            ).toBeGreaterThan(solid.solidRadius + (plant.solidRadius || plant.radius));
          }
        }
        for (const target of state.targets.filter((target) => target.kind !== "rock")) {
          expect(
            isPointInArenaGrowth(id, target.x, target.z),
            `${id}: ${target.id} stays on its field`,
          ).toBe(true);
          const reach = PLAYER_RADIUS + target.radius - 0.1;
          expect(
            reachable.some(([x, z]) => (x - target.x) ** 2 + (z - target.z) ** 2 < reach ** 2),
            `${id}, seed ${seed}, ${target.id} must be reachable without crossing a solid`,
          ).toBe(true);
        }
      }
    }
  }, 20000);
});

function reachablePositions(solids: TargetSeed[]): Array<readonly [number, number]> {
  const step = 0.5;
  const half = Math.floor((WORLD_HALF_EXTENT - PLAYER_HUB_RADIUS) / step);
  const width = half * 2 + 1;
  const visited = new Uint8Array(width * width);
  const start = half * width + half;
  const queue = [start];
  const positions: Array<readonly [number, number]> = [];
  visited[start] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    if (index === undefined) continue;
    const column = index % width;
    const row = Math.floor(index / width);
    const x = (column - half) * step;
    const z = (row - half) * step;
    positions.push([x, z]);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nextColumn = column + dx;
      const nextRow = row + dz;
      if (nextColumn < 0 || nextColumn >= width || nextRow < 0 || nextRow >= width) continue;
      const nextIndex = nextRow * width + nextColumn;
      if (visited[nextIndex]) continue;
      visited[nextIndex] = 1;
      const nextX = (nextColumn - half) * step;
      const nextZ = (nextRow - half) * step;
      // The extra half-step clearance also keeps edges between grid points outside solids.
      if (
        solids.some(
          (solid) =>
            Math.hypot(nextX - solid.x, nextZ - solid.z) <=
            solid.solidRadius + PLAYER_HUB_RADIUS + step / 2,
        )
      )
        continue;
      queue.push(nextIndex);
    }
  }
  return positions;
}
