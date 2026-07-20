import { describe, expect, it } from "vitest";

import {
  FIXED_TIME_STEP_SECONDS,
  MAX_MOVE_SPEED,
  MEADOW_SEED,
  PLAYER_HUB_RADIUS,
  PLAYER_RADIUS,
  WORLD_HALF_EXTENT,
  createInitialState,
  stepState,
  type GameState,
  type MovementInput,
  type TargetState,
} from "../src/game/state";
import {
  FLOWER_CLUSTER_COUNT,
  FLOWER_VISUAL_COUNT,
  GRASS_LOGICAL_COLUMNS,
  GRASS_VISUAL_COLUMNS,
  MATURE_TREE_COUNT,
  createMeadowLayout,
  type TargetKind,
} from "../src/game/world";

const idleInput: MovementInput = {
  left: false,
  right: false,
  forward: false,
  backward: false,
};

const positiveXInput: MovementInput = {
  left: false,
  right: true,
  forward: false,
  backward: true,
};

const negativeXInput: MovementInput = {
  left: true,
  right: false,
  forward: true,
  backward: false,
};

describe("active game state", () => {
  it("creates the same active contract state every time", () => {
    const first = createInitialState();
    const second = createInitialState();

    expect(first).toEqual(second);
    expect(first.mode).toBe("active");
    expect(first.seed).toBe(MEADOW_SEED);
    expect(first.player).toMatchObject({
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      level: 1,
      rpm: 720,
      targetRpm: 720,
    });
    expect(first.inventory).toEqual({ grass: 0, flowers: 0, fiber: 0, wood: 0 });
    expect(first.objectives).toEqual({
      status: "active",
      grass: { status: "active", collected: 0, target: 50 },
      flowers: { status: "active", collected: 0, target: 10 },
      fiber: { status: "planned", collected: 0, target: 6 },
      wood: { status: "planned", collected: 0, target: 6 },
    });
    expect(first.xp).toBe(0);
    expect(first.cutRevision).toBe(0);
    expect(first.targets).toHaveLength(
      GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS + FLOWER_CLUSTER_COUNT + MATURE_TREE_COUNT,
    );
    expect(first.grassVisualPositions).toBeInstanceOf(Float32Array);
    expect(first.grassVisualCutMask).toBeInstanceOf(Uint8Array);
    expect(first.cutGrassVisualIndices).toEqual([]);
  });

  it("uses an explicit seed without changing the active contract", () => {
    const state = createInitialState(12345);

    expect(state.seed).toBe(12345);
    expect(state.mode).toBe("active");
    expect(state.player.level).toBe(1);
    expect(state.targets.every((target) => target.status === "standing")).toBe(true);
  });

  it("builds deterministic logical targets and visual mappings", () => {
    const first = createMeadowLayout(12345);
    createMeadowLayout(98765);
    const replay = createMeadowLayout(12345);

    expect(replay).toEqual(first);
    expect(first.grassCells).toHaveLength(GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS);
    expect(first.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(first.flowerTargets).toHaveLength(FLOWER_CLUSTER_COUNT);
    expect(first.flowerVisuals).toHaveLength(FLOWER_VISUAL_COUNT);
    expect(first.matureTreeTargets).toHaveLength(MATURE_TREE_COUNT);
    expect(first.matureTreeVisuals).toEqual([
      { x: -16, z: -15, size: 1.05, targetIndex: 0 },
      { x: -8, z: -18, size: 0.85, targetIndex: 1 },
      { x: 8, z: -17, size: 1.15, targetIndex: 2 },
      { x: 17, z: -10, size: 0.95, targetIndex: 3 },
      { x: 17, z: 13, size: 1.1, targetIndex: 4 },
      { x: 7, z: 18, size: 0.9, targetIndex: 5 },
      { x: -10, z: 17, size: 1.18, targetIndex: 6 },
      { x: -18, z: 8, size: 0.92, targetIndex: 7 },
    ]);

    const grassVisualCounts = Array<number>(first.grassCells.length).fill(0);
    for (const visual of first.grassVisuals) {
      grassVisualCounts[visual.cellIndex] = (grassVisualCounts[visual.cellIndex] ?? 0) + 1;
    }
    expect(grassVisualCounts.every((count) => count === 16)).toBe(true);

    const flowerVisualCounts = Array<number>(first.flowerTargets.length).fill(0);
    for (const visual of first.flowerVisuals) {
      flowerVisualCounts[visual.targetIndex] = (flowerVisualCounts[visual.targetIndex] ?? 0) + 1;
    }
    expect(flowerVisualCounts.every((count) => count === 26 || count === 27)).toBe(true);

    expect(first.grassCells.every(hasGrassTierValues)).toBe(true);
    expect(first.flowerTargets.every(hasFlowerTierValues)).toBe(true);
    expect(first.matureTreeTargets.every(hasMatureTreeTierValues)).toBe(true);
    for (const visual of first.matureTreeVisuals) {
      const target = first.matureTreeTargets[visual.targetIndex];
      expect(target).toMatchObject({
        x: visual.x,
        z: visual.z,
        radius: visual.size * 0.5,
        solidRadius: visual.size * 0.5,
      });
    }
  });

  it("marks deterministic grass visuals individually inside the swept blade capsule", () => {
    const seed = 707;
    const first = createInitialState(seed);
    const replay = createInitialState(seed);

    stepState(first, idleInput, FIXED_TIME_STEP_SECONDS);
    stepState(replay, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(first.cutGrassVisualIndices).toEqual(replay.cutGrassVisualIndices);
    expect(Array.from(first.grassVisualCutMask)).toEqual(Array.from(replay.grassVisualCutMask));
    expect(first.cutGrassVisualIndices.length).toBeGreaterThan(0);
    expect(new Set(first.cutGrassVisualIndices).size).toBe(first.cutGrassVisualIndices.length);

    for (const visualIndex of first.cutGrassVisualIndices) {
      const positionIndex = visualIndex * 2;
      const x = first.grassVisualPositions[positionIndex];
      const z = first.grassVisualPositions[positionIndex + 1];
      expect(x).toBeDefined();
      expect(z).toBeDefined();
      expect(Math.hypot(x ?? 0, z ?? 0)).toBeLessThanOrEqual(PLAYER_RADIUS + 1e-6);
    }

    const layout = createMeadowLayout(seed);
    const cutVisualCounts = Array<number>(layout.grassCells.length).fill(0);
    for (const visualIndex of first.cutGrassVisualIndices) {
      const cellIndex = layout.grassVisuals[visualIndex]?.cellIndex;
      if (cellIndex !== undefined) {
        cutVisualCounts[cellIndex] = (cutVisualCounts[cellIndex] ?? 0) + 1;
      }
    }
    expect(cutVisualCounts.some((count) => count > 0 && count < 16)).toBe(true);

    const appendOnlySnapshot = [...first.cutGrassVisualIndices];
    stepState(first, idleInput, FIXED_TIME_STEP_SECONDS);
    expect(first.cutGrassVisualIndices).toEqual(appendOnlySnapshot);
  });

  it("cuts a grass cell and awards grass plus XP on the cut tick", () => {
    const state = createInitialState(101);
    const target = isolateTarget(state, "grass");

    cutCurrentTarget(state, target);

    expect(target.status).toBe("cut");
    expect(target.accumulatedWork).toBe(target.requiredWork);
    expect(state.inventory.grass).toBe(1);
    expect(state.objectives.grass.collected).toBe(1);
    expect(state.xp).toBe(1);
    expect(state.cutRevision).toBe(1);
  });

  it("cuts a flower cluster as one authoritative target", () => {
    const state = createInitialState(202);
    const target = isolateTarget(state, "flower");

    cutCurrentTarget(state, target);

    expect(target.status).toBe("cut");
    expect(state.inventory.flowers).toBe(1);
    expect(state.objectives.flowers.collected).toBe(1);
    expect(state.inventory.grass).toBe(0);
    expect(state.xp).toBe(3);
    expect(state.cutRevision).toBe(1);
  });

  it("persists partial work after contact ends", () => {
    const state = createInitialState(303);
    const target = isolateTarget(state, "flower");

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    const partialWork = target.accumulatedWork;
    expect(target.status).toBe("cutting");
    expect(partialWork).toBeGreaterThan(0);
    expect(partialWork).toBeLessThan(target.requiredWork);

    state.player.x = WORLD_HALF_EXTENT - state.player.radius;
    state.player.z = WORLD_HALF_EXTENT - state.player.radius;
    state.player.vx = 0;
    state.player.vz = 0;
    for (let frame = 0; frame < 30; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(target.status).toBe("cutting");
    expect(target.accumulatedWork).toBe(partialWork);
    expect(state.inventory.flowers).toBe(0);
  });

  it("blocks on a mature tree while a level-one blade stalls", () => {
    const state = createInitialState(313);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);

    for (let frame = 0; frame < 240; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.player.x).toBeCloseTo(0, 8);
    expect(state.player.z).toBeCloseTo(0, 8);
    expect(target.status).toBe("cutting");
    expect(target.accumulatedWork).toBeGreaterThan(0);
    expect(target.accumulatedWork).toBeLessThan(target.requiredWork);
    expect(state.player.rpm).toBeLessThan(180);
    expect(state.inventory.wood).toBe(0);
    expect(state.objectives.wood.collected).toBe(0);
  });

  it("allows the blade hub to back away from a solid target", () => {
    const state = createInitialState(323);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);

    stepState(state, negativeXInput, FIXED_TIME_STEP_SECONDS);

    expect(state.player.x).toBeLessThan(0);
    expect(state.player.z).toBeCloseTo(0, 8);
  });

  it("releases movement and awards a mature tree exactly once on the cut tick", () => {
    const state = createInitialState(333);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    const unblockedControl = createInitialState(333);
    unblockedControl.targets = [];

    stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    stepState(unblockedControl, positiveXInput, FIXED_TIME_STEP_SECONDS);

    expect(target.status).toBe("cut");
    expect(state.player.x).toBeCloseTo(unblockedControl.player.x, 10);
    expect(state.player.z).toBeCloseTo(unblockedControl.player.z, 10);
    expect(state.inventory.wood).toBe(6);
    expect(state.objectives.wood.collected).toBe(6);
    expect(state.xp).toBe(75);
    expect(state.cutRevision).toBe(1);

    for (let frame = 0; frame < 60; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.inventory.wood).toBe(6);
    expect(state.objectives.wood.collected).toBe(6);
    expect(state.xp).toBe(75);
    expect(state.cutRevision).toBe(1);
  });

  it("does not reward an already-cut target again", () => {
    const state = createInitialState(404);
    const target = isolateTarget(state, "grass");
    cutCurrentTarget(state, target);
    const rewardedSnapshot = {
      grass: state.inventory.grass,
      xp: state.xp,
      cutRevision: state.cutRevision,
    };

    for (let frame = 0; frame < 120; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect({
      grass: state.inventory.grass,
      xp: state.xp,
      cutRevision: state.cutRevision,
    }).toEqual(rewardedSnapshot);
  });

  it("auto-levels at exact cumulative XP thresholds and updates target RPM", () => {
    const levelTwoState = createInitialState(505);
    levelTwoState.xp = 19;
    const levelTwoTarget = isolateTarget(levelTwoState, "grass");
    cutCurrentTarget(levelTwoState, levelTwoTarget);

    expect(levelTwoState.xp).toBe(20);
    expect(levelTwoState.player.level).toBe(2);
    expect(levelTwoState.player.targetRpm).toBe(760);

    const multiLevelState = createInitialState(606);
    multiLevelState.xp = 109;
    const multiLevelTarget = isolateTarget(multiLevelState, "grass");
    cutCurrentTarget(multiLevelState, multiLevelTarget);

    expect(multiLevelState.xp).toBe(110);
    expect(multiLevelState.player.level).toBe(4);
    expect(multiLevelState.player.targetRpm).toBe(840);
  });

  it("accelerates forward while respecting the speed cap", () => {
    const state = createInitialState();
    const input: MovementInput = { ...idleInput, forward: true };

    for (let frame = 0; frame < 60; frame += 1) {
      stepState(state, input, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.player.x).toBeLessThan(-1);
    expect(state.player.z).toBeLessThan(-1);
    expect(state.player.x).toBeCloseTo(state.player.z, 5);
    expect(state.player.vx).toBeLessThan(0);
    expect(state.player.vz).toBeLessThan(0);
    expect(Math.hypot(state.player.vx, state.player.vz)).toBeLessThanOrEqual(MAX_MOVE_SPEED);
  });

  it("cancels opposing movement input", () => {
    const state = createInitialState();
    const input: MovementInput = {
      left: true,
      right: true,
      forward: true,
      backward: true,
    };

    for (let frame = 0; frame < 30; frame += 1) {
      stepState(state, input, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.player).toMatchObject({ x: 0, z: 0, vx: 0, vz: 0 });
  });

  it("clamps movement to the world bounds and stops outward velocity", () => {
    const state = createInitialState();
    const limit = WORLD_HALF_EXTENT - state.player.radius;

    state.player.x = limit - 0.01;
    state.player.vx = MAX_MOVE_SPEED;
    stepState(state, { ...idleInput, right: true }, FIXED_TIME_STEP_SECONDS);
    expect(state.player.x).toBe(limit);
    expect(state.player.vx).toBe(0);

    state.player.z = -limit + 0.01;
    state.player.vz = -MAX_MOVE_SPEED;
    stepState(state, { ...idleInput, forward: true }, FIXED_TIME_STEP_SECONDS);
    expect(state.player.z).toBe(-limit);
    expect(state.player.vz).toBe(0);
  });
});

function isolateTarget(state: GameState, kind: TargetKind): TargetState {
  const source = state.targets.find((target) => target.kind === kind);
  if (source === undefined) {
    throw new Error(`Missing ${kind} target`);
  }

  const target: TargetState = {
    ...source,
    id: `test-${kind}`,
    x: state.player.x,
    z: state.player.z,
    status: "standing",
    accumulatedWork: 0,
  };
  state.targets = [target];
  return target;
}

function placeTargetAtPositiveXContact(state: GameState, target: TargetState): void {
  state.player.x = 0;
  state.player.z = 0;
  state.player.vx = 0;
  state.player.vz = 0;
  target.x = PLAYER_HUB_RADIUS + target.solidRadius;
  target.z = 0;
}

function cutCurrentTarget(state: GameState, target: TargetState): void {
  for (let frame = 0; frame < 120 && target.status !== "cut"; frame += 1) {
    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
  }
  expect(target.status).toBe("cut");
}

function hasGrassTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "grass" &&
    target.solidRadius === 0 &&
    target.requiredWork === 1.5 &&
    target.resistance === 0.04 &&
    target.yield === 1 &&
    target.xp === 1
  );
}

function hasFlowerTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "flower" &&
    target.solidRadius === 0 &&
    target.requiredWork === 4 &&
    target.resistance === 0.08 &&
    target.yield === 1 &&
    target.xp === 3
  );
}

function hasMatureTreeTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "matureTree" &&
    target.solidRadius > 0 &&
    target.requiredWork === 60 &&
    target.resistance === 1.6 &&
    target.yield === 6 &&
    target.xp === 75
  );
}
