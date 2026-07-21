import { describe, expect, it } from "vitest";

import { deriveReadableBladeAngle } from "../src/game/createScene";
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
  collectTargetProgressEntries,
  shouldShowTargetProgress,
  targetProgressFraction,
} from "../src/game/targetProgress";
import {
  DENSE_WEED_COUNT,
  DENSE_WEED_VISUAL_COUNT,
  DENSE_WEED_VISUALS_PER_TARGET,
  FLOWER_CLUSTER_COUNT,
  FLOWER_VISUAL_COUNT,
  GRASS_LOGICAL_COLUMNS,
  GRASS_VISUAL_COLUMNS,
  MATURE_TREE_COUNT,
  SAPLING_COUNT,
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
  it("derives a slower visible blade angle to avoid high-rpm strobing", () => {
    const rawFrameAdvance = (720 / 60) * Math.PI * 2 * FIXED_TIME_STEP_SECONDS;
    const visualFrameAdvance = deriveReadableBladeAngle(rawFrameAdvance);

    expect(visualFrameAdvance).toBeGreaterThan(0.07);
    expect(visualFrameAdvance).toBeLessThan(0.13);
    expect(visualFrameAdvance).toBeLessThan(rawFrameAdvance / 8);
  });

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
      fiber: { status: "active", collected: 0, target: 6 },
      wood: { status: "active", collected: 0, target: 6 },
    });
    expect(first.xp).toBe(0);
    expect(first.cutRevision).toBe(0);
    expect(first.bladeContactTargetIds).toEqual([]);
    expect(first.targets).toHaveLength(
      GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS +
        FLOWER_CLUSTER_COUNT +
        DENSE_WEED_COUNT +
        SAPLING_COUNT +
        MATURE_TREE_COUNT,
    );
    const grassEnd = GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS;
    const flowersEnd = grassEnd + FLOWER_CLUSTER_COUNT;
    const denseWeedsEnd = flowersEnd + DENSE_WEED_COUNT;
    const saplingsEnd = denseWeedsEnd + SAPLING_COUNT;
    expect(first.targets.slice(0, grassEnd).every((target) => target.kind === "grass")).toBe(true);
    expect(
      first.targets.slice(grassEnd, flowersEnd).every((target) => target.kind === "flower"),
    ).toBe(true);
    expect(
      first.targets.slice(flowersEnd, denseWeedsEnd).every((target) => target.kind === "denseWeed"),
    ).toBe(true);
    expect(
      first.targets.slice(denseWeedsEnd, saplingsEnd).every((target) => target.kind === "sapling"),
    ).toBe(true);
    expect(first.targets.slice(saplingsEnd).every((target) => target.kind === "matureTree")).toBe(
      true,
    );
    expect(first.grassVisualPositions).toBeInstanceOf(Float32Array);
    expect(first.grassVisualCutMask).toBeInstanceOf(Uint8Array);
    expect(first.cutGrassVisualIndices).toEqual([]);
    expect(first.cutEvents).toEqual([]);
  });

  it("shows progress only after durable targets take initial damage", () => {
    const state = createInitialState();
    const grass = requireTarget(state, "grass");
    const flower = requireTarget(state, "flower");
    const weed = requireTarget(state, "denseWeed");
    const sapling = requireTarget(state, "sapling");
    const matureTree = requireTarget(state, "matureTree");

    expect(shouldShowTargetProgress(grass)).toBe(false);
    expect(shouldShowTargetProgress(flower)).toBe(false);
    expect(shouldShowTargetProgress(weed)).toBe(false);
    expect(shouldShowTargetProgress(sapling)).toBe(false);
    expect(shouldShowTargetProgress(matureTree)).toBe(false);

    grass.status = "cutting";
    grass.accumulatedWork = 0.75;
    flower.status = "cutting";
    flower.accumulatedWork = 2;
    weed.status = "cutting";
    weed.accumulatedWork = 3;
    sapling.status = "cutting";
    sapling.accumulatedWork = 12.5;
    matureTree.status = "cutting";
    matureTree.accumulatedWork = 30;

    const entries = collectTargetProgressEntries(state.targets);

    expect(entries.map((entry) => entry.id)).toEqual([weed.id, sapling.id, matureTree.id]);
    expect(entries.map((entry) => entry.kind)).toEqual(["denseWeed", "sapling", "matureTree"]);
    expect(targetProgressFraction(sapling)).toBe(0.75);
    expect(targetProgressFraction(matureTree)).toBe(0.5);

    sapling.status = "cut";
    expect(shouldShowTargetProgress(sapling)).toBe(false);
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
    const interleaved = createMeadowLayout(98765);
    const replay = createMeadowLayout(12345);

    expect(replay).toEqual(first);
    expect(first.grassCells).toHaveLength(GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS);
    expect(first.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(first.flowerTargets).toHaveLength(FLOWER_CLUSTER_COUNT);
    expect(first.flowerVisuals).toHaveLength(FLOWER_VISUAL_COUNT);
    expect(first.denseWeedTargets).toHaveLength(DENSE_WEED_COUNT);
    expect(first.denseWeedVisuals).toHaveLength(DENSE_WEED_VISUAL_COUNT);
    expect(first.saplingTargets).toHaveLength(SAPLING_COUNT);
    expect(first.saplingVisuals).toHaveLength(SAPLING_COUNT);
    expect(first.matureTreeTargets).toHaveLength(MATURE_TREE_COUNT);
    expect(first.denseWeedTargets.map((target) => target.id)).toEqual(
      interleaved.denseWeedTargets.map((target) => target.id),
    );
    expect(first.denseWeedTargets).not.toEqual(interleaved.denseWeedTargets);
    expect(first.saplingTargets.map((target) => target.id)).toEqual(
      interleaved.saplingTargets.map((target) => target.id),
    );
    expect(first.saplingTargets).not.toEqual(interleaved.saplingTargets);
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

    const denseWeedVisualCounts = Array<number>(first.denseWeedTargets.length).fill(0);
    for (const visual of first.denseWeedVisuals) {
      denseWeedVisualCounts[visual.targetIndex] =
        (denseWeedVisualCounts[visual.targetIndex] ?? 0) + 1;
      const target = first.denseWeedTargets[visual.targetIndex];
      expect(target).toBeDefined();
      expect(Math.hypot(visual.x - (target?.x ?? 0), visual.z - (target?.z ?? 0))).toBeLessThan(
        target?.radius ?? 0,
      );
    }
    expect(denseWeedVisualCounts.every((count) => count === DENSE_WEED_VISUALS_PER_TARGET)).toBe(
      true,
    );

    expect(first.grassCells.every(hasGrassTierValues)).toBe(true);
    expect(first.flowerTargets.every(hasFlowerTierValues)).toBe(true);
    expect(first.denseWeedTargets.every(hasDenseWeedTierValues)).toBe(true);
    expect(first.denseWeedTargets.some((target) => Math.hypot(target.x, target.z) < 6)).toBe(true);
    expect(first.saplingTargets.every(hasSaplingTierValues)).toBe(true);
    expect(
      first.saplingTargets.reduce((sum, target) => sum + target.yield, 0),
    ).toBeGreaterThanOrEqual(9);
    for (const visual of first.saplingVisuals) {
      const target = first.saplingTargets[visual.targetIndex];
      expect(target).toMatchObject({
        x: visual.x,
        z: visual.z,
        radius: visual.size * 0.34,
        solidRadius: visual.size * 0.34,
      });
    }
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

  it("records complete cut-event fields for every authoritative target kind", () => {
    const cases: Array<{
      kind: TargetKind;
      yield: number;
      xp: number;
      levelAfter: number;
    }> = [
      { kind: "grass", yield: 1, xp: 1, levelAfter: 1 },
      { kind: "flower", yield: 1, xp: 3, levelAfter: 1 },
      { kind: "denseWeed", yield: 1, xp: 6, levelAfter: 1 },
      { kind: "sapling", yield: 2, xp: 30, levelAfter: 2 },
      { kind: "matureTree", yield: 6, xp: 75, levelAfter: 3 },
    ];

    for (const expected of cases) {
      const state = createInitialState(90);
      const target = isolateTarget(state, expected.kind);
      target.id = `event-${expected.kind}`;
      target.x = 0.25;
      target.z = -0.5;
      target.status = "cutting";
      target.accumulatedWork = target.requiredWork - 0.001;
      state.player.x = target.x;
      state.player.z = target.z;

      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

      expect(state.cutEvents).toEqual([
        {
          revision: 1,
          targetId: target.id,
          kind: expected.kind,
          x: target.x,
          z: target.z,
          yield: expected.yield,
          xp: expected.xp,
          levelBefore: 1,
          levelAfter: expected.levelAfter,
        },
      ]);
      expect(state.cutRevision).toBe(state.cutEvents[0]?.revision);
    }
  });

  it("records simultaneous completions in stable target order with sequential revisions", () => {
    const state = createInitialState(91);
    const flower = requireTarget(state, "flower");
    const grass = requireTarget(state, "grass");
    flower.id = "z-first-by-iteration";
    grass.id = "a-second-by-iteration";

    for (const target of [flower, grass]) {
      target.x = state.player.x;
      target.z = state.player.z;
      target.status = "cutting";
      target.accumulatedWork = target.requiredWork - 0.001;
    }
    state.targets = [flower, grass];

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(state.cutEvents.map((event) => event.targetId)).toEqual([
      "z-first-by-iteration",
      "a-second-by-iteration",
    ]);
    expect(state.cutEvents.map((event) => event.revision)).toEqual([1, 2]);
    expect(state.cutRevision).toBe(2);
    expect(state.cutRevision).toBe(state.cutEvents.at(-1)?.revision);
  });

  it("records XP-derived level boundaries when a cut crosses a threshold", () => {
    const state = createInitialState(92);
    state.xp = 19;
    const target = isolateTarget(state, "grass");
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(state.cutEvents).toHaveLength(1);
    expect(state.cutEvents[0]).toMatchObject({
      xp: 1,
      levelBefore: 1,
      levelAfter: 2,
    });
    expect(state.xp).toBe(20);
    expect(state.player.level).toBe(2);
  });

  it("replays cut-completion events deterministically", () => {
    const first = createInitialState(93);
    const replay = createInitialState(93);
    const firstTarget = isolateTarget(first, "flower");
    const replayTarget = isolateTarget(replay, "flower");
    firstTarget.status = "cutting";
    replayTarget.status = "cutting";
    firstTarget.accumulatedWork = firstTarget.requiredWork - 0.001;
    replayTarget.accumulatedWork = replayTarget.requiredWork - 0.001;

    stepState(first, idleInput, FIXED_TIME_STEP_SECONDS);
    stepState(replay, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(replay.cutEvents).toEqual(first.cutEvents);
    expect(replay).toEqual(first);
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

  it("cuts an isolated dense weed within its recommended-level timing range", () => {
    const state = createInitialState(212);
    const target = isolateTarget(state, "denseWeed");
    prepareLevelTwoBlade(state);

    const cutTicks = cutCurrentTarget(state, target);
    const cutSeconds = cutTicks * FIXED_TIME_STEP_SECONDS;

    expect(cutSeconds).toBeGreaterThanOrEqual(0.7);
    expect(cutSeconds).toBeLessThanOrEqual(1.1);
  });

  it("persists partial dense-weed work after the blade leaves contact", () => {
    const state = createInitialState(222);
    const target = isolateTarget(state, "denseWeed");
    prepareLevelTwoBlade(state);

    for (let frame = 0; frame < 12; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }
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
    expect(state.inventory.fiber).toBe(0);
  });

  it("awards one Fiber and six XP exactly once on the dense-weed cut tick", () => {
    const state = createInitialState(232);
    const target = isolateTarget(state, "denseWeed");
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(target.status).toBe("cut");
    expect(state.inventory.fiber).toBe(1);
    expect(state.objectives.fiber.collected).toBe(1);
    expect(state.xp).toBe(6);
    expect(state.cutRevision).toBe(1);

    for (let frame = 0; frame < 120; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.inventory.fiber).toBe(1);
    expect(state.objectives.fiber.collected).toBe(1);
    expect(state.xp).toBe(6);
    expect(state.cutRevision).toBe(1);
  });

  it("replays seeded dense-weed contact identically", () => {
    const first = createInitialState(242);
    const replay = createInitialState(242);
    const firstTarget = first.targets.find((target) => target.kind === "denseWeed");
    const replayTarget = replay.targets.find((target) => target.kind === "denseWeed");
    if (firstTarget === undefined || replayTarget === undefined) {
      throw new Error("Missing seeded dense weed");
    }

    first.player.x = firstTarget.x;
    first.player.z = firstTarget.z;
    replay.player.x = replayTarget.x;
    replay.player.z = replayTarget.z;
    prepareLevelTwoBlade(first);
    prepareLevelTwoBlade(replay);

    for (let frame = 0; frame < 45; frame += 1) {
      stepState(first, idleInput, FIXED_TIME_STEP_SECONDS);
      stepState(replay, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(replay).toEqual(first);
  });

  it("cuts an isolated sapling within its recommended-level timing range", () => {
    const state = createInitialState(252);
    const target = isolateTarget(state, "sapling");
    prepareLevelFourBlade(state);

    const cutTicks = cutCurrentTarget(state, target);
    const cutSeconds = cutTicks * FIXED_TIME_STEP_SECONDS;

    expect(cutSeconds).toBeGreaterThanOrEqual(4);
    expect(cutSeconds).toBeLessThanOrEqual(6);
  });

  it("blocks movement while an authoritative sapling is standing", () => {
    const state = createInitialState(262);
    const target = isolateTarget(state, "sapling");
    placeTargetAtPositiveXContact(state, target);

    stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);

    expect(state.player.x).toBeCloseTo(0, 8);
    expect(state.player.z).toBeCloseTo(0, 8);
    expect(target.status).toBe("cutting");
    expect(target.accumulatedWork).toBeGreaterThan(0);
    expect(state.inventory.wood).toBe(0);
  });

  it("clears live sapling contact while preserving partial cut work", () => {
    const state = createInitialState(263);
    const target = isolateTarget(state, "sapling");
    prepareLevelFourBlade(state);

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    const partialWork = target.accumulatedWork;

    expect(state.bladeContactTargetIds).toEqual([target.id]);
    expect(target.status).toBe("cutting");
    expect(partialWork).toBeGreaterThan(0);
    expect(partialWork).toBeLessThan(target.requiredWork);

    state.player.x = WORLD_HALF_EXTENT - state.player.radius;
    state.player.z = WORLD_HALF_EXTENT - state.player.radius;
    state.player.vx = 0;
    state.player.vz = 0;
    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(state.bladeContactTargetIds).toEqual([]);
    expect(target.status).toBe("cutting");
    expect(target.accumulatedWork).toBe(partialWork);
  });

  it("releases a cut sapling and awards Wood plus XP exactly once on the cut tick", () => {
    const state = createInitialState(272);
    const target = isolateTarget(state, "sapling");
    prepareLevelFourBlade(state);
    placeTargetAtPositiveXContact(state, target);
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    const unblockedControl = createInitialState(272);
    prepareLevelFourBlade(unblockedControl);
    unblockedControl.targets = [];

    stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    stepState(unblockedControl, positiveXInput, FIXED_TIME_STEP_SECONDS);

    expect(target.status).toBe("cut");
    expect(state.player.x).toBeCloseTo(unblockedControl.player.x, 10);
    expect(state.player.z).toBeCloseTo(unblockedControl.player.z, 10);
    expect(state.inventory.wood).toBe(2);
    expect(state.objectives.wood.collected).toBe(2);
    expect(state.xp).toBe(140);
    expect(state.cutRevision).toBe(1);

    for (let frame = 0; frame < 120; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.inventory.wood).toBe(2);
    expect(state.objectives.wood.collected).toBe(2);
    expect(state.xp).toBe(140);
    expect(state.cutRevision).toBe(1);
  });

  it("allows sapling Wood to overcollect beyond the contract quota", () => {
    const state = createInitialState(282);
    const saplings = state.targets
      .filter((target) => target.kind === "sapling")
      .slice(0, 4)
      .map((target) => ({ ...target }));
    prepareLevelFourBlade(state);

    for (const source of saplings) {
      const target: TargetState = {
        ...source,
        x: state.player.x,
        z: state.player.z,
        status: "cutting",
        accumulatedWork: source.requiredWork - 0.001,
      };
      state.targets = [target];
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
      expect(target.status).toBe("cut");
    }

    expect(state.inventory.wood).toBe(8);
    expect(state.objectives.wood.collected).toBe(8);
    expect(state.objectives.wood.collected).toBeGreaterThan(state.objectives.wood.target);
    expect(state.xp).toBe(230);
    expect(state.cutRevision).toBe(4);
  });

  it("replays seeded sapling cutting identically", () => {
    const first = createInitialState(292);
    const replay = createInitialState(292);
    const firstTarget = first.targets.find((target) => target.kind === "sapling");
    const replayTarget = replay.targets.find((target) => target.kind === "sapling");
    if (firstTarget === undefined || replayTarget === undefined) {
      throw new Error("Missing seeded sapling");
    }

    first.targets = [firstTarget];
    replay.targets = [replayTarget];
    first.player.x = firstTarget.x;
    first.player.z = firstTarget.z;
    replay.player.x = replayTarget.x;
    replay.player.z = replayTarget.z;
    prepareLevelFourBlade(first);
    prepareLevelFourBlade(replay);

    for (let frame = 0; frame < 300; frame += 1) {
      stepState(first, idleInput, FIXED_TIME_STEP_SECONDS);
      stepState(replay, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(firstTarget.status).toBe("cut");
    expect(replay).toEqual(first);
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
    const eventSnapshot = [...state.cutEvents];

    for (let frame = 0; frame < 120; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect({
      grass: state.inventory.grass,
      xp: state.xp,
      cutRevision: state.cutRevision,
    }).toEqual(rewardedSnapshot);
    expect(state.cutEvents).toEqual(eventSnapshot);
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
  const source = requireTarget(state, kind);

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

function requireTarget(state: GameState, kind: TargetKind): TargetState {
  const target = state.targets.find((candidate) => candidate.kind === kind);
  if (target === undefined) {
    throw new Error(`Missing ${kind} target`);
  }
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

function cutCurrentTarget(state: GameState, target: TargetState): number {
  let cutTicks = 0;
  for (; cutTicks < 600 && target.status !== "cut"; cutTicks += 1) {
    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
  }
  expect(target.status).toBe("cut");
  return cutTicks;
}

function prepareLevelTwoBlade(state: GameState): void {
  state.xp = 20;
  state.player.level = 2;
  state.player.rpm = 760;
  state.player.targetRpm = 760;
}

function prepareLevelFourBlade(state: GameState): void {
  state.xp = 110;
  state.player.level = 4;
  state.player.rpm = 840;
  state.player.targetRpm = 840;
}

function hasGrassTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "grass" &&
    target.solidRadius === 0 &&
    target.recommendedLevel === 1 &&
    target.requiredWork === 1.5 &&
    target.resistance === 0.04 &&
    target.yield === 1 &&
    target.xp === 1
  );
}

function hasFlowerTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "flower" &&
    target.solidRadius === 0 &&
    target.recommendedLevel === 1 &&
    target.requiredWork === 4 &&
    target.resistance === 0.08 &&
    target.yield === 1 &&
    target.xp === 3
  );
}

function hasDenseWeedTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "denseWeed" &&
    target.solidRadius === 0 &&
    target.recommendedLevel === 2 &&
    target.requiredWork === 12 &&
    target.resistance === 0.25 &&
    target.yield === 1 &&
    target.xp === 6
  );
}

function hasSaplingTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "sapling" &&
    target.solidRadius > 0 &&
    target.recommendedLevel === 4 &&
    target.requiredWork === 50 &&
    target.resistance === 0.9 &&
    target.yield === 2 &&
    target.xp === 30
  );
}

function hasMatureTreeTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "matureTree" &&
    target.solidRadius > 0 &&
    target.recommendedLevel === 6 &&
    target.requiredWork === 60 &&
    target.resistance === 1.6 &&
    target.yield === 6 &&
    target.xp === 75
  );
}
