import { describe, expect, it } from "vitest";

import {
  FIXED_TIME_STEP_SECONDS,
  MAX_MOVE_SPEED,
  MEADOW_SEED,
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
  createMeadowLayout,
} from "../src/game/world";

const idleInput: MovementInput = {
  left: false,
  right: false,
  forward: false,
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
      GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS + FLOWER_CLUSTER_COUNT,
    );
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

function isolateTarget(state: GameState, kind: "grass" | "flower"): TargetState {
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

function cutCurrentTarget(state: GameState, target: TargetState): void {
  for (let frame = 0; frame < 120 && target.status !== "cut"; frame += 1) {
    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
  }
  expect(target.status).toBe("cut");
}

function hasGrassTierValues(target: {
  kind: "grass" | "flower";
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "grass" &&
    target.requiredWork === 1.5 &&
    target.resistance === 0.04 &&
    target.yield === 1 &&
    target.xp === 1
  );
}

function hasFlowerTierValues(target: {
  kind: "grass" | "flower";
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "flower" &&
    target.requiredWork === 4 &&
    target.resistance === 0.08 &&
    target.yield === 1 &&
    target.xp === 3
  );
}
