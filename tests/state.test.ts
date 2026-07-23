import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  accumulateReadableBladeAngle,
  createScene,
  deriveBladeVisualScale,
  deriveReadableBladeAngle,
} from "../src/game/createScene";
import { ROCK_CONTACT_FRAGMENTS_PER_EMISSION } from "../src/game/cutEffects";
import { resolveQualitySettings } from "../src/game/quality";
import {
  CONTRACT_DEFINITIONS,
  FIXED_TIME_STEP_SECONDS,
  MAX_MOVE_SPEED,
  MEADOW_SEED,
  PLAYER_HUB_RADIUS,
  PLAYER_RADIUS,
  WORLD_HALF_EXTENT,
  createInitialState,
  setPaused,
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
  FLOWER_TARGET_COUNT,
  FLOWER_VISUAL_COUNT,
  GRASS_BLADES_PER_VISUAL,
  GRASS_FIELD_SIZE,
  GRASS_LOGICAL_COLUMNS,
  GRASS_VISUAL_COLUMNS,
  MATURE_TREE_COUNT,
  ROCK_COUNT,
  SAPLING_COUNT,
  SHRUB_COUNT,
  SHRUB_VISUAL_COUNT,
  createMeadowDensityReport,
  createMeadowLayout,
  isPointInArenaGrowth,
  type MeadowLayout,
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

const COMPLETION_VALIDATION_SEEDS = [
  MEADOW_SEED,
  1,
  42,
  707,
  12345,
  98765,
  314159,
  2654448114,
  3456789012,
  4000000000,
] as const;

interface ContractSnapshot {
  mode: GameState["mode"];
  inventory: GameState["inventory"];
  objectives: GameState["objectives"];
  result: GameState["result"];
  cutRevision: number;
  cutEvents: GameState["cutEvents"];
}

describe("active game state", () => {
  it("derives a slower visible blade angle to avoid high-rpm strobing", () => {
    const rawFrameAdvance = (720 / 60) * Math.PI * 2 * FIXED_TIME_STEP_SECONDS;
    const visualFrameAdvance = deriveReadableBladeAngle(rawFrameAdvance);

    expect(visualFrameAdvance).toBeGreaterThan(0.07);
    expect(visualFrameAdvance).toBeLessThan(0.13);
    expect(visualFrameAdvance).toBeLessThan(rawFrameAdvance / 8);
  });

  it("keeps readable blade rotation continuous across raw angle wraparound", () => {
    const previousRawAngle = Math.PI * 2 - 0.05;
    const currentRawAngle = 0.1;
    const previousVisualAngle = 1.2;
    const nextVisualAngle = accumulateReadableBladeAngle(
      previousRawAngle,
      currentRawAngle,
      previousVisualAngle,
    );

    expect(nextVisualAngle).toBeGreaterThan(previousVisualAngle);
    expect(nextVisualAngle - previousVisualAngle).toBeCloseTo(deriveReadableBladeAngle(0.15));
  });

  it("derives visual-only cutter scale from blade level", () => {
    expect(deriveBladeVisualScale(1)).toBe(1);
    expect(deriveBladeVisualScale(2)).toBeCloseTo(1.04);
    expect(deriveBladeVisualScale(4)).toBeCloseTo(1.12);
    expect(deriveBladeVisualScale(6)).toBeCloseTo(1.2);
    expect(deriveBladeVisualScale(8)).toBeCloseTo(1.2);
  });

  it("creates the same active contract state every time", () => {
    const first = createInitialState();
    const second = createInitialState();
    const layout = createMeadowLayout(MEADOW_SEED);

    expect(first).toEqual(second);
    expect(first.mode).toBe("active");
    expect(first.seed).toBe(MEADOW_SEED);
    expect(first.contract).toEqual({
      id: "meadow-delivery",
      title: "Meadow Delivery",
      summary: "Clear a balanced starter meadow contract.",
      timeLimitSeconds: null,
      completionMode: "quota",
    });
    expect(first.elapsedSeconds).toBe(0);
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
    expect(first.result).toBeNull();
    expect(first.cutRevision).toBe(0);
    expect(first.bladeContactTargetIds).toEqual([]);
    expect(first.targets).toHaveLength(
      layout.grassCells.length +
        FLOWER_TARGET_COUNT +
        DENSE_WEED_COUNT +
        SHRUB_COUNT +
        SAPLING_COUNT +
        MATURE_TREE_COUNT +
        ROCK_COUNT,
    );
    const grassEnd = layout.grassCells.length;
    const flowersEnd = grassEnd + FLOWER_TARGET_COUNT;
    const denseWeedsEnd = flowersEnd + DENSE_WEED_COUNT;
    const shrubsEnd = denseWeedsEnd + SHRUB_COUNT;
    const saplingsEnd = shrubsEnd + SAPLING_COUNT;
    const matureTreesEnd = saplingsEnd + MATURE_TREE_COUNT;
    expect(first.targets.slice(0, grassEnd).every((target) => target.kind === "grass")).toBe(true);
    expect(
      first.targets.slice(grassEnd, flowersEnd).every((target) => target.kind === "flower"),
    ).toBe(true);
    expect(
      first.targets.slice(flowersEnd, denseWeedsEnd).every((target) => target.kind === "denseWeed"),
    ).toBe(true);
    expect(
      first.targets.slice(denseWeedsEnd, shrubsEnd).every((target) => target.kind === "shrub"),
    ).toBe(true);
    expect(
      first.targets.slice(shrubsEnd, saplingsEnd).every((target) => target.kind === "sapling"),
    ).toBe(true);
    expect(
      first.targets
        .slice(saplingsEnd, matureTreesEnd)
        .every((target) => target.kind === "matureTree"),
    ).toBe(true);
    expect(first.targets.slice(matureTreesEnd).every((target) => target.kind === "rock")).toBe(
      true,
    );
    expect(first.grassVisualPositions).toBeInstanceOf(Float32Array);
    expect(first.grassVisualCutMask).toBeInstanceOf(Uint8Array);
    expect(first.cutGrassVisualIndices).toEqual([]);
    expect(first.cutEvents).toEqual([]);
    expect(first.tooToughNotice).toBeNull();
    expect(first.tooToughRevision).toBe(0);
    expect(first.tooToughNoticeCooldowns).toEqual({});
  });

  it("shows progress only after durable targets take initial damage", () => {
    const state = createInitialState();
    const grass = requireTarget(state, "grass");
    const flower = requireTarget(state, "flower");
    const weed = requireTarget(state, "denseWeed");
    const shrub = requireTarget(state, "shrub");
    const sapling = requireTarget(state, "sapling");
    const matureTree = requireTarget(state, "matureTree");
    const rock = requireTarget(state, "rock");

    expect(shouldShowTargetProgress(grass)).toBe(false);
    expect(shouldShowTargetProgress(flower)).toBe(false);
    expect(shouldShowTargetProgress(weed)).toBe(false);
    expect(shouldShowTargetProgress(shrub)).toBe(false);
    expect(shouldShowTargetProgress(sapling)).toBe(false);
    expect(shouldShowTargetProgress(matureTree)).toBe(false);
    expect(shouldShowTargetProgress(rock)).toBe(false);

    grass.status = "cutting";
    grass.accumulatedWork = 0.75;
    flower.status = "cutting";
    flower.accumulatedWork = 2;
    weed.status = "cutting";
    weed.accumulatedWork = 3;
    shrub.status = "cutting";
    shrub.accumulatedWork = 15;
    sapling.status = "cutting";
    sapling.accumulatedWork = 12.5;
    matureTree.status = "cutting";
    matureTree.accumulatedWork = 30;

    const entries = collectTargetProgressEntries(state.targets);

    expect(entries.map((entry) => entry.id)).toEqual([
      weed.id,
      shrub.id,
      sapling.id,
      matureTree.id,
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "denseWeed",
      "shrub",
      "sapling",
      "matureTree",
    ]);
    expect(targetProgressFraction(shrub)).toBe(0.5);
    expect(targetProgressFraction(sapling)).toBe(0.75);
    expect(targetProgressFraction(matureTree)).toBe(0.5);

    sapling.status = "cut";
    expect(shouldShowTargetProgress(sapling)).toBe(false);
  });

  it("uses an explicit seed without changing the active contract", () => {
    const state = createInitialState(12345);

    expect(state.seed).toBe(12345);
    expect(state.mode).toBe("active");
    expect(state.elapsedSeconds).toBe(0);
    expect(state.player.level).toBe(1);
    expect(state.targets.every((target) => target.status === "standing")).toBe(true);
  });

  it("falls back to the default contract for unknown contract ids", () => {
    const state = createInitialState(12345, "unknown-contract");

    expect(state.contract.id).toBe("meadow-delivery");
    expect(state.objectives.grass.target).toBe(50);
    expect(state.objectives.flowers.target).toBe(10);
    expect(state.objectives.fiber.target).toBe(6);
    expect(state.objectives.wood.target).toBe(6);
  });

  it("creates and completes the authored Flower Sweep contract", () => {
    const state = createInitialState(12345, "flower-sweep");

    expect(state.contract).toEqual({
      id: "flower-sweep",
      title: "Flower Sweep",
      summary: "Harvest every flower drift instead of just clipping the patch edges.",
      timeLimitSeconds: null,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(34);
    expect(state.objectives.flowers.target).toBe(FLOWER_TARGET_COUNT);
    expect(state.objectives.fiber.target).toBe(4);
    expect(state.objectives.wood.target).toBe(4);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.inventory).toEqual({ grass: 34, flowers: FLOWER_TARGET_COUNT, fiber: 4, wood: 4 });
    expect(state.result).toMatchObject({
      cutTargets: 360,
      highestLevel: 8,
      finalInventory: { grass: 34, flowers: FLOWER_TARGET_COUNT, fiber: 4, wood: 4 },
      completionRevision: 360,
    });
  });

  it("creates and completes the authored Woodland Cleanup contract", () => {
    const state = createInitialState(12345, "woodland-cleanup");

    expect(state.contract).toEqual({
      id: "woodland-cleanup",
      title: "Woodland Cleanup",
      summary: "Focus on weeds and saplings for a heavier Fiber and Wood delivery.",
      timeLimitSeconds: null,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(30);
    expect(state.objectives.flowers.target).toBe(6);
    expect(state.objectives.fiber.target).toBe(8);
    expect(state.objectives.wood.target).toBe(8);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.inventory).toEqual({ grass: 30, flowers: 6, fiber: 8, wood: 8 });
    expect(state.result).toMatchObject({
      cutTargets: 48,
      highestLevel: 5,
      finalInventory: { grass: 30, flowers: 6, fiber: 8, wood: 8 },
      completionRevision: 48,
    });
  });

  it("creates and completes the authored Timed Harvest contract before the clock expires", () => {
    const state = createInitialState(12345, "timed-harvest");

    expect(state.contract).toEqual({
      id: "timed-harvest",
      title: "Timed Harvest",
      summary: "A 60-second grass, flower, and fiber endurance route with no room to wander.",
      timeLimitSeconds: 60,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(170);
    expect(state.objectives.flowers.target).toBe(300);
    expect(state.objectives.fiber.target).toBe(18);
    expect(state.objectives.wood.target).toBe(0);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(60);
    expect(state.inventory).toEqual({ grass: 170, flowers: 300, fiber: 18, wood: 0 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 60,
      cutTargets: 485,
      highestLevel: 8,
      finalInventory: { grass: 170, flowers: 300, fiber: 18, wood: 0 },
      completionRevision: 485,
    });
  });

  it("creates and completes the authored Timber Trail contract before the clock expires", () => {
    const state = createInitialState(12345, "timber-trail");

    expect(state.contract).toEqual({
      id: "timber-trail",
      title: "Timber Trail",
      summary: "A 90-second wood route that grows into mature-tree cutting.",
      timeLimitSeconds: 90,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(250);
    expect(state.objectives.flowers.target).toBe(260);
    expect(state.objectives.fiber.target).toBe(28);
    expect(state.objectives.wood.target).toBe(28);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(90);
    expect(state.inventory).toEqual({ grass: 250, flowers: 260, fiber: 28, wood: 28 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 90,
      cutTargets: 538,
      highestLevel: 8,
      finalInventory: { grass: 250, flowers: 260, fiber: 28, wood: 28 },
      completionRevision: 538,
    });
    expect(state.targets.filter((target) => target.kind === "sapling")).toHaveLength(5);
    expect(state.targets.filter((target) => target.kind === "matureTree")).toHaveLength(3);
  });

  it("creates and completes the authored Rock Garden contract before the clock expires", () => {
    const state = createInitialState(12345, "rock-garden");

    expect(state.contract).toEqual({
      id: "rock-garden",
      title: "Rock Garden",
      summary: "A 70-second obstacle slalom around visible stones and mixed harvest pockets.",
      timeLimitSeconds: 70,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(190);
    expect(state.objectives.flowers.target).toBe(220);
    expect(state.objectives.fiber.target).toBe(16);
    expect(state.objectives.wood.target).toBe(10);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(70);
    expect(state.inventory).toEqual({ grass: 190, flowers: 220, fiber: 16, wood: 10 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 70,
      cutTargets: 429,
      highestLevel: 8,
      finalInventory: { grass: 190, flowers: 220, fiber: 16, wood: 10 },
      completionRevision: 429,
    });
    expect(state.targets.filter((target) => target.kind === "denseWeed")).toHaveLength(12);
    expect(state.targets.filter((target) => target.kind === "sapling")).toHaveLength(5);
  });

  it("creates and completes the authored Hedge Maze contract before the clock expires", () => {
    const state = createInitialState(12345, "hedge-maze");

    expect(state.contract).toEqual({
      id: "hedge-maze",
      title: "Hedge Maze",
      summary: "An 80-second shrub maze that turns durable hedges into the Fiber objective.",
      timeLimitSeconds: 80,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(183);
    expect(state.objectives.flowers.target).toBe(300);
    expect(state.objectives.fiber.target).toBe(28);
    expect(state.objectives.wood.target).toBe(0);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(80);
    expect(state.inventory).toEqual({ grass: 183, flowers: 300, fiber: 28, wood: 0 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 80,
      cutTargets: 503,
      highestLevel: 8,
      finalInventory: { grass: 183, flowers: 300, fiber: 28, wood: 0 },
      completionRevision: 503,
    });
    expect(state.targets.filter((target) => target.kind === "denseWeed")).toHaveLength(12);
    expect(state.targets.filter((target) => target.kind === "shrub")).toHaveLength(8);
  });

  it("creates and completes the authored Field Sprint contract before the clock expires", () => {
    const state = createInitialState(12345, "field-sprint");

    expect(state.contract).toEqual({
      id: "field-sprint",
      title: "Field Sprint",
      summary: "A 45-second flower-lane sprint with only soft targets.",
      timeLimitSeconds: 45,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(175);
    expect(state.objectives.flowers.target).toBe(230);
    expect(state.objectives.fiber.target).toBe(0);
    expect(state.objectives.wood.target).toBe(0);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(45);
    expect(state.inventory).toEqual({ grass: 175, flowers: 230, fiber: 0, wood: 0 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 45,
      cutTargets: 405,
      highestLevel: 8,
      finalInventory: { grass: 175, flowers: 230, fiber: 0, wood: 0 },
      completionRevision: 405,
    });
  });

  it("creates and completes the authored Weed Rush contract before the clock expires", () => {
    const state = createInitialState(12345, "weed-rush");

    expect(state.contract).toEqual({
      id: "weed-rush",
      title: "Weed Rush",
      summary: "A 55-second switchback route that mixes soft cuts with dense Fiber weeds.",
      timeLimitSeconds: 55,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(150);
    expect(state.objectives.flowers.target).toBe(220);
    expect(state.objectives.fiber.target).toBe(18);
    expect(state.objectives.wood.target).toBe(0);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(55);
    expect(state.inventory).toEqual({ grass: 150, flowers: 220, fiber: 18, wood: 0 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 55,
      cutTargets: 385,
      highestLevel: 8,
      finalInventory: { grass: 150, flowers: 220, fiber: 18, wood: 0 },
      completionRevision: 385,
    });
  });

  it("creates and completes the authored Clover Circuit contract before the clock expires", () => {
    const state = createInitialState(12345, "clover-circuit");

    expect(state.contract).toEqual({
      id: "clover-circuit",
      title: "Clover Circuit",
      summary: "A 75-second figure-eight route around dense flower and Fiber pockets.",
      timeLimitSeconds: 75,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(240);
    expect(state.objectives.flowers.target).toBe(320);
    expect(state.objectives.fiber.target).toBe(28);
    expect(state.objectives.wood.target).toBe(0);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(75);
    expect(state.inventory).toEqual({ grass: 240, flowers: 320, fiber: 28, wood: 0 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 75,
      cutTargets: 580,
      highestLevel: 8,
      finalInventory: { grass: 240, flowers: 320, fiber: 28, wood: 0 },
      completionRevision: 580,
    });
    expect(state.targets.filter((target) => target.kind === "denseWeed")).toHaveLength(12);
    expect(state.targets.filter((target) => target.kind === "shrub")).toHaveLength(8);
  });

  it("creates and completes the authored Orchard Loop contract before the clock expires", () => {
    const state = createInitialState(12345, "orchard-loop");

    expect(state.contract).toEqual({
      id: "orchard-loop",
      title: "Orchard Loop",
      summary: "An 85-second wood loop through saplings, trees, and flower pockets.",
      timeLimitSeconds: 85,
      completionMode: "quota",
    });
    expect(state.objectives.grass.target).toBe(240);
    expect(state.objectives.flowers.target).toBe(260);
    expect(state.objectives.fiber.target).toBe(20);
    expect(state.objectives.wood.target).toBe(22);

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBeLessThan(85);
    expect(state.inventory).toEqual({ grass: 240, flowers: 260, fiber: 20, wood: 22 });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: 85,
      cutTargets: 523,
      highestLevel: 8,
      finalInventory: { grass: 240, flowers: 260, fiber: 20, wood: 22 },
      completionRevision: 523,
    });
    expect(state.targets.filter((target) => target.kind === "sapling")).toHaveLength(5);
    expect(state.targets.filter((target) => target.kind === "matureTree")).toHaveLength(2);
  });

  it("creates and completes the authored Clear Every Patch contract only after all soft patches are cut", () => {
    const state = createInitialState(12345, "clear-every-patch");
    const expectedGrassTargets = state.targets.filter((target) => target.kind === "grass").length;
    const expectedFlowerTargets = state.targets.filter((target) => target.kind === "flower").length;

    expect(state.contract).toEqual({
      id: "clear-every-patch",
      title: "Clear Every Patch",
      summary: "Sweep the full starter meadow clean instead of stopping at delivery quotas.",
      timeLimitSeconds: null,
      completionMode: "clear-patches",
    });
    expect(state.objectives.grass.target).toBe(expectedGrassTargets);
    expect(state.objectives.flowers.target).toBe(expectedFlowerTargets);
    expect(state.objectives.grass.target).toBe(277);
    expect(state.objectives.flowers.target).toBe(FLOWER_TARGET_COUNT);
    expect(state.objectives.fiber.target).toBe(0);
    expect(state.objectives.wood.target).toBe(0);

    state.inventory = {
      grass: state.objectives.grass.target,
      flowers: state.objectives.flowers.target,
      fiber: 0,
      wood: 0,
    };
    state.objectives.grass.collected = state.objectives.grass.target;
    state.objectives.flowers.collected = state.objectives.flowers.target;
    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(state.mode).toBe("active");
    expect(state.objectives.status).toBe("active");

    completeContractThroughQuotaCuts(state);

    expect(state.mode).toBe("complete");
    expect(state.inventory).toEqual({
      grass: expectedGrassTargets,
      flowers: expectedFlowerTargets,
      fiber: 0,
      wood: 0,
    });
    expect(state.result).toMatchObject({
      status: "complete",
      timeLimitSeconds: null,
      cutTargets: expectedGrassTargets + expectedFlowerTargets,
      highestLevel: 8,
      finalInventory: {
        grass: expectedGrassTargets,
        flowers: expectedFlowerTargets,
        fiber: 0,
        wood: 0,
      },
      completionRevision: expectedGrassTargets + expectedFlowerTargets,
    });
  });

  it("ends a timed contract with a time-up result when quotas are incomplete", () => {
    const state = createInitialState(12345, "timed-harvest");
    state.targets = [];

    advanceState(state, 60.5);

    expect(state.mode).toBe("complete");
    expect(state.elapsedSeconds).toBe(60);
    expect(state.objectives.status).toBe("active");
    expect(state.result).toEqual({
      status: "timed-out",
      completedAtSeconds: 60,
      timeLimitSeconds: 60,
      cutTargets: 0,
      highestLevel: 1,
      finalInventory: { grass: 0, flowers: 0, fiber: 0, wood: 0 },
      completionRevision: 0,
    });
  });

  it("keeps every authored contract completable across ten authored seeds", () => {
    for (const seed of COMPLETION_VALIDATION_SEEDS) {
      for (const contract of CONTRACT_DEFINITIONS) {
        const state = createInitialState(seed, contract.id);

        completeContractThroughQuotaCuts(state);

        expect(state.mode).toBe("complete");
        expect(state.objectives.status).toBe("complete");
        expect(state.inventory).toEqual({
          grass: state.objectives.grass.target,
          flowers: state.objectives.flowers.target,
          fiber: state.objectives.fiber.target,
          wood: state.objectives.wood.target,
        });
        expect(state.result?.finalInventory).toEqual(state.inventory);
      }
    }
  });

  it("builds deterministic logical targets and visual mappings", () => {
    const first = createMeadowLayout(12345);
    const interleaved = createMeadowLayout(98765);
    const replay = createMeadowLayout(12345);

    expect(replay).toEqual(first);
    expect(first.grassCells.length).toBeGreaterThan(450);
    expect(first.grassCells.length).toBeLessThan(GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS);
    expect(first.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(first.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(first.flowerVisuals).toHaveLength(FLOWER_VISUAL_COUNT);
    expect(first.boundaryMarkers.length).toBeGreaterThan(100);
    expect(first.boundaryMarkers.every((marker) => Number.isFinite(marker.x))).toBe(true);
    expect(first.boundaryMarkers.every((marker) => Number.isFinite(marker.z))).toBe(true);
    expect(first.denseWeedTargets).toHaveLength(DENSE_WEED_COUNT);
    expect(first.denseWeedVisuals).toHaveLength(DENSE_WEED_VISUAL_COUNT);
    expect(first.shrubTargets).toHaveLength(SHRUB_COUNT);
    expect(first.shrubVisuals).toHaveLength(SHRUB_VISUAL_COUNT);
    expect(first.saplingTargets).toHaveLength(SAPLING_COUNT);
    expect(first.saplingVisuals).toHaveLength(SAPLING_COUNT);
    expect(first.matureTreeTargets).toHaveLength(MATURE_TREE_COUNT);
    expect(first.rockTargets).toHaveLength(ROCK_COUNT);
    expect(first.rockVisuals).toHaveLength(ROCK_COUNT);
    expect(first.arenaId).toBe("meadow-delivery");
    expect(first.arenaShape).toBe("starter-meadow-paths");
    expect(first.grassCells.length).toBeGreaterThan(450);
    expect(first.grassCells.length).toBeLessThan(GRASS_LOGICAL_COLUMNS * GRASS_LOGICAL_COLUMNS);
    expect(first.denseWeedTargets.map((target) => target.id)).toEqual(
      interleaved.denseWeedTargets.map((target) => target.id),
    );
    expect(first.denseWeedTargets).not.toEqual(interleaved.denseWeedTargets);
    expect(first.saplingTargets.map((target) => target.id)).toEqual(
      interleaved.saplingTargets.map((target) => target.id),
    );
    expect(first.saplingTargets).not.toEqual(interleaved.saplingTargets);
    expect(first.shrubTargets.map((target) => target.id)).toEqual(
      interleaved.shrubTargets.map((target) => target.id),
    );
    expect(first.shrubTargets).not.toEqual(interleaved.shrubTargets);
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
    for (const visual of first.grassVisuals) {
      if (visual.height > 0 || visual.scaleX > 0) {
        expect(visual.cellIndex).not.toBe(-1);
      } else {
        expect(visual.height).toBe(0);
        expect(visual.scaleX).toBe(0);
      }
    }
    expect(grassVisualCounts.every((count) => count > 0 && count <= 16)).toBe(true);

    const flowerVisualCounts = Array<number>(first.flowerTargets.length).fill(0);
    for (const visual of first.flowerVisuals) {
      flowerVisualCounts[visual.targetIndex] = (flowerVisualCounts[visual.targetIndex] ?? 0) + 1;
    }
    expect(flowerVisualCounts.every((count) => count >= 2 && count <= 3)).toBe(true);
    expect(first.flowerTargets.filter((target) => target.id.startsWith("flower-0-"))).toHaveLength(
      20,
    );

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
    expect(first.shrubTargets.every(hasShrubTierValues)).toBe(true);
    for (const visual of first.shrubVisuals) {
      const target = first.shrubTargets[visual.targetIndex];
      expect(target).toMatchObject({
        x: visual.x,
        z: visual.z,
        radius: visual.size,
      });
    }
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
    expect(first.rockTargets.every(hasRockObstacleValues)).toBe(true);
    for (const visual of first.rockVisuals) {
      const target = first.rockTargets[visual.targetIndex];
      expect(target).toMatchObject({
        x: visual.x,
        z: visual.z,
        radius: visual.size * 0.62,
        solidRadius: visual.size * 0.62,
      });
    }
  });

  it("builds contract-specific non-square growth arenas", () => {
    const meadow = createMeadowLayout(12345, "meadow-delivery");
    const flowerSweep = createMeadowLayout(12345, "flower-sweep");
    const woodland = createMeadowLayout(12345, "woodland-cleanup");
    const timber = createMeadowLayout(12345, "timber-trail");
    const rockGarden = createMeadowLayout(12345, "rock-garden");
    const hedgeMaze = createMeadowLayout(12345, "hedge-maze");
    const timed = createMeadowLayout(12345, "timed-harvest");
    const sprint = createMeadowLayout(12345, "field-sprint");
    const weedRush = createMeadowLayout(12345, "weed-rush");
    const cloverCircuit = createMeadowLayout(12345, "clover-circuit");
    const orchardLoop = createMeadowLayout(12345, "orchard-loop");
    const clearEveryPatch = createMeadowLayout(12345, "clear-every-patch");
    const unknown = createMeadowLayout(12345, "unknown-contract");

    expect(meadow.arenaShape).toBe("starter-meadow-paths");
    expect(unknown.arenaShape).toBe("starter-meadow-paths");
    expect(flowerSweep.arenaShape).toBe("branching-flower-corridors");
    expect(woodland.arenaShape).toBe("woodland-clearings");
    expect(timber.arenaShape).toBe("timber-groves");
    expect(rockGarden.arenaShape).toBe("rock-slalom");
    expect(hedgeMaze.arenaShape).toBe("hedge-maze");
    expect(timed.arenaShape).toBe("timed-loop");
    expect(sprint.arenaShape).toBe("sprint-lanes");
    expect(weedRush.arenaShape).toBe("weed-switchbacks");
    expect(cloverCircuit.arenaShape).toBe("figure-eight-circuit");
    expect(orchardLoop.arenaShape).toBe("orchard-loop");
    expect(clearEveryPatch.arenaShape).toBe("split-clearings");
    expect(flowerSweep.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(woodland.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(timber.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(rockGarden.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(hedgeMaze.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(timed.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(sprint.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(weedRush.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(cloverCircuit.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(orchardLoop.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(clearEveryPatch.flowerTargets).toHaveLength(FLOWER_TARGET_COUNT);
    expect(meadow.boundaryMarkers.length).toBeGreaterThan(100);
    expect(flowerSweep.boundaryMarkers.length).toBeGreaterThan(80);
    expect(woodland.boundaryMarkers.length).toBeGreaterThan(80);
    expect(timber.boundaryMarkers.length).toBeGreaterThan(120);
    expect(rockGarden.boundaryMarkers.length).toBeGreaterThan(120);
    expect(hedgeMaze.boundaryMarkers.length).toBeGreaterThan(95);
    expect(timed.boundaryMarkers.length).toBeGreaterThan(75);
    expect(sprint.boundaryMarkers.length).toBeGreaterThan(80);
    expect(weedRush.boundaryMarkers.length).toBeGreaterThan(100);
    expect(orchardLoop.boundaryMarkers.length).toBeGreaterThan(110);
    expect(clearEveryPatch.boundaryMarkers.length).toBeGreaterThan(90);
    expect(clearEveryPatch.boundaryMarkers).not.toEqual(meadow.boundaryMarkers);
    expect(flowerSweep.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(woodland.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(timber.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(rockGarden.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(hedgeMaze.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(timed.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(sprint.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(weedRush.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(orchardLoop.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(clearEveryPatch.grassVisuals).toHaveLength(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
    expect(flowerSweep.grassCells.length).toBeGreaterThan(120);
    expect(woodland.grassCells.length).toBeGreaterThan(160);
    expect(timber.grassCells.length).toBeGreaterThan(260);
    expect(rockGarden.grassCells.length).toBeGreaterThan(200);
    expect(hedgeMaze.grassCells.length).toBeGreaterThan(170);
    expect(timed.grassCells.length).toBeGreaterThan(120);
    expect(sprint.grassCells.length).toBeGreaterThan(140);
    expect(weedRush.grassCells.length).toBeGreaterThan(190);
    expect(orchardLoop.grassCells.length).toBeGreaterThan(230);
    expect(clearEveryPatch.grassCells.length).toBeGreaterThan(250);
    expect(flowerSweep.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.72);
    expect(woodland.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.78);
    expect(timber.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.7);
    expect(rockGarden.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.6);
    expect(hedgeMaze.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.5);
    expect(timed.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.5);
    expect(sprint.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.5);
    expect(weedRush.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.55);
    expect(orchardLoop.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.7);
    expect(clearEveryPatch.grassCells.length).toBeLessThan(meadow.grassCells.length * 0.7);
    expect(countVisibleGrassVisuals(meadow)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.74,
    );
    expect(countVisibleGrassVisuals(meadow)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS,
    );
    expect(countVisibleGrassVisuals(flowerSweep)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.72,
    );
    expect(countVisibleGrassVisuals(woodland)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.78,
    );
    expect(countVisibleGrassVisuals(timber)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.7,
    );
    expect(countVisibleGrassVisuals(rockGarden)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.62,
    );
    expect(countVisibleGrassVisuals(hedgeMaze)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.52,
    );
    expect(countVisibleGrassVisuals(timed)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.5,
    );
    expect(countVisibleGrassVisuals(sprint)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.5,
    );
    expect(countVisibleGrassVisuals(weedRush)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.5,
    );
    expect(countVisibleGrassVisuals(clearEveryPatch)).toBeLessThan(
      GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * 0.5,
    );

    const flowerState = createInitialState(12345, "flower-sweep");
    const woodlandState = createInitialState(12345, "woodland-cleanup");
    const timberState = createInitialState(12345, "timber-trail");
    const rockGardenState = createInitialState(12345, "rock-garden");
    const hedgeMazeState = createInitialState(12345, "hedge-maze");
    const timedState = createInitialState(12345, "timed-harvest");
    const sprintState = createInitialState(12345, "field-sprint");
    const weedRushState = createInitialState(12345, "weed-rush");
    const clearEveryPatchState = createInitialState(12345, "clear-every-patch");
    expect(flowerState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      flowerSweep.grassCells.length,
    );
    expect(woodlandState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      woodland.grassCells.length,
    );
    expect(timberState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      timber.grassCells.length,
    );
    expect(rockGardenState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      rockGarden.grassCells.length,
    );
    expect(hedgeMazeState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      hedgeMaze.grassCells.length,
    );
    expect(timedState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      timed.grassCells.length,
    );
    expect(sprintState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      sprint.grassCells.length,
    );
    expect(weedRushState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      weedRush.grassCells.length,
    );
    const orchardLoopState = createInitialState(12345, "orchard-loop");
    expect(orchardLoopState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      orchardLoop.grassCells.length,
    );
    expect(clearEveryPatchState.targets.filter((target) => target.kind === "grass")).toHaveLength(
      clearEveryPatch.grassCells.length,
    );
    expect(flowerSweep.grassCells.length).toBeGreaterThan(flowerState.objectives.grass.target);
    expect(woodland.grassCells.length).toBeGreaterThan(woodlandState.objectives.grass.target);
    expect(timber.grassCells.length).toBeGreaterThan(timberState.objectives.grass.target);
    expect(rockGarden.grassCells.length).toBeGreaterThan(rockGardenState.objectives.grass.target);
    expect(hedgeMaze.grassCells.length).toBeGreaterThanOrEqual(
      hedgeMazeState.objectives.grass.target,
    );
    expect(timed.grassCells.length).toBeGreaterThanOrEqual(timedState.objectives.grass.target);
    expect(sprint.grassCells.length).toBeGreaterThan(sprintState.objectives.grass.target);
    expect(weedRush.grassCells.length).toBeGreaterThanOrEqual(
      weedRushState.objectives.grass.target,
    );
    expect(orchardLoop.grassCells.length).toBeGreaterThanOrEqual(
      orchardLoopState.objectives.grass.target,
    );
    expect(clearEveryPatch.grassCells.length).toBe(clearEveryPatchState.objectives.grass.target);
  });

  it("keeps each authored arena visibly path-shaped instead of a full square", () => {
    const meadow = createMeadowLayout(12345, "meadow-delivery");
    const flowerSweep = createMeadowLayout(12345, "flower-sweep");
    const woodland = createMeadowLayout(12345, "woodland-cleanup");
    const timber = createMeadowLayout(12345, "timber-trail");
    const rockGarden = createMeadowLayout(12345, "rock-garden");
    const hedgeMaze = createMeadowLayout(12345, "hedge-maze");
    const timed = createMeadowLayout(12345, "timed-harvest");
    const sprint = createMeadowLayout(12345, "field-sprint");
    const weedRush = createMeadowLayout(12345, "weed-rush");
    const orchardLoop = createMeadowLayout(12345, "orchard-loop");
    const clearEveryPatch = createMeadowLayout(12345, "clear-every-patch");

    expect(hasGrassCellNear(meadow, 0, -18)).toBe(true);
    expect(hasGrassCellNear(meadow, -17, 8)).toBe(true);
    expect(hasGrassCellNear(meadow, -9, 1)).toBe(false);
    expect(hasGrassCellNear(meadow, 9, 2)).toBe(false);
    expect(hasGrassCellNear(meadow, 0, -11)).toBe(false);

    expect(hasGrassCellNear(flowerSweep, 0, -18)).toBe(true);
    expect(hasGrassCellNear(flowerSweep, 0, -4)).toBe(true);
    expect(hasGrassCellNear(flowerSweep, -17, 8)).toBe(true);
    expect(hasGrassCellNear(flowerSweep, -8, -2)).toBe(false);
    expect(hasGrassCellNear(flowerSweep, 8, 2)).toBe(false);

    expect(hasGrassCellNear(woodland, -10, -11)).toBe(true);
    expect(hasGrassCellNear(woodland, 8, 9)).toBe(true);
    expect(hasGrassCellNear(woodland, 0, -4)).toBe(true);
    expect(hasGrassCellNear(woodland, -17, 8)).toBe(false);
    expect(hasGrassCellNear(woodland, 16, 8)).toBe(false);

    expect(hasGrassCellNear(timber, -8.5, -7)).toBe(true);
    expect(hasGrassCellNear(timber, 8.5, -6.5)).toBe(true);
    expect(hasGrassCellNear(timber, -16, -15)).toBe(true);
    expect(hasGrassCellNear(timber, 17, -10)).toBe(true);
    expect(hasGrassCellNear(timber, 7, 18)).toBe(true);
    expect(hasGrassCellNear(timber, -2.8, 4.2)).toBe(false);
    expect(hasGrassCellNear(timber, 4.2, 3.6)).toBe(false);
    expect(hasGrassCellNear(timber, 18, 0)).toBe(false);

    expect(hasGrassCellNear(rockGarden, -16, -6)).toBe(true);
    expect(hasGrassCellNear(rockGarden, 2, 2)).toBe(true);
    expect(hasGrassCellNear(rockGarden, 13, 7)).toBe(true);
    expect(hasGrassCellNear(rockGarden, -14.5, -2.5)).toBe(false);
    expect(hasGrassCellNear(rockGarden, 13.7, 3.4)).toBe(false);
    expect(hasGrassCellNear(rockGarden, 17, 17)).toBe(false);

    expect(hasGrassCellNear(hedgeMaze, -12, -8)).toBe(true);
    expect(hasGrassCellNear(hedgeMaze, 12, -7)).toBe(true);
    expect(hasGrassCellNear(hedgeMaze, 9, 7)).toBe(true);
    expect(hasGrassCellNear(hedgeMaze, 6.2, -6.2)).toBe(false);
    expect(hasGrassCellNear(hedgeMaze, -6.4, -6.2)).toBe(false);
    expect(hasGrassCellNear(hedgeMaze, 17, 17)).toBe(false);

    expect(hasGrassCellNear(timed, -8, -2)).toBe(true);
    expect(hasGrassCellNear(timed, 8, 2)).toBe(true);
    expect(hasGrassCellNear(timed, 0, -4)).toBe(false);
    expect(hasGrassCellNear(timed, 0, 11)).toBe(false);

    expect(hasGrassCellNear(sprint, -15, -15)).toBe(true);
    expect(hasGrassCellNear(sprint, 13, 2)).toBe(true);
    expect(hasGrassCellNear(sprint, -9, 15)).toBe(true);
    expect(hasGrassCellNear(sprint, -2, -2)).toBe(false);
    expect(hasGrassCellNear(sprint, 5, 7)).toBe(false);
    expect(hasGrassCellNear(sprint, 15, 15)).toBe(false);

    expect(hasGrassCellNear(weedRush, -15, -14)).toBe(true);
    expect(hasGrassCellNear(weedRush, 13.5, 0)).toBe(true);
    expect(hasGrassCellNear(weedRush, -12, 12)).toBe(true);
    expect(hasGrassCellNear(weedRush, 8, 14)).toBe(true);
    expect(hasGrassCellNear(weedRush, -1, -6)).toBe(false);
    expect(hasGrassCellNear(weedRush, 6, 5)).toBe(false);
    expect(hasGrassCellNear(weedRush, 17, 17)).toBe(false);

    expect(hasGrassCellNear(orchardLoop, -16, -15)).toBe(true);
    expect(hasGrassCellNear(orchardLoop, 17, -10)).toBe(true);
    expect(hasGrassCellNear(orchardLoop, 7, 18)).toBe(true);
    expect(hasGrassCellNear(orchardLoop, -8.5, -7)).toBe(true);
    expect(hasGrassCellNear(orchardLoop, 0, -12)).toBe(false);
    expect(hasGrassCellNear(orchardLoop, 12, 2)).toBe(false);
    expect(hasGrassCellNear(orchardLoop, 0, 12)).toBe(false);

    expect(hasGrassCellNear(clearEveryPatch, -12, -12)).toBe(true);
    expect(hasGrassCellNear(clearEveryPatch, 12, 5)).toBe(true);
    expect(hasGrassCellNear(clearEveryPatch, 0.8, 13.4)).toBe(true);
    expect(hasGrassCellNear(clearEveryPatch, -4, 5)).toBe(false);
    expect(hasGrassCellNear(clearEveryPatch, 5, 10)).toBe(false);
    expect(hasGrassCellNear(clearEveryPatch, 17, 17)).toBe(false);
  });

  it("does not use decorative no-growth arena gaps as invisible movement blockers", () => {
    const state = createInitialState(12345, "timed-harvest");
    state.player.x = 0;
    state.player.z = -4;
    state.player.vx = 0;
    state.player.vz = MAX_MOVE_SPEED;
    state.targets = [];

    expect(isPointInArenaGrowth(state.contract.id, state.player.x, state.player.z)).toBe(false);

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(state.player.z).toBeGreaterThan(-4);
    expect(state.player.vz).toBeGreaterThan(0);
  });

  it("provides at least 150 percent of each required contract resource", () => {
    const state = createInitialState(12345);
    const available = totalAvailableResources(state);

    expect(available.grass).toBeGreaterThanOrEqual(state.objectives.grass.target * 1.5);
    expect(available.flowers).toBeGreaterThanOrEqual(state.objectives.flowers.target * 1.5);
    expect(available.fiber).toBeGreaterThanOrEqual(state.objectives.fiber.target * 1.5);
    expect(available.wood).toBeGreaterThanOrEqual(state.objectives.wood.target * 1.5);

    const saplingWood = state.targets
      .filter((target) => target.kind === "sapling")
      .reduce((sum, target) => sum + target.yield, 0);
    expect(saplingWood).toBeGreaterThanOrEqual(state.objectives.wood.target);
  });

  it("reports deterministic meadow density against the Phase 3 lush-field thresholds", () => {
    for (const seed of COMPLETION_VALIDATION_SEEDS) {
      const layout = createMeadowLayout(seed);
      const report = createMeadowDensityReport(layout);
      const lowQualityReport = createMeadowDensityReport(layout, 8);

      const visualCellArea = (GRASS_FIELD_SIZE / GRASS_VISUAL_COLUMNS) ** 2;

      expect(report.eligibleTerrainArea).toBeLessThan(GRASS_FIELD_SIZE * GRASS_FIELD_SIZE);
      expect(report.eligibleTerrainArea).toBeGreaterThan(GRASS_FIELD_SIZE * GRASS_FIELD_SIZE * 0.7);
      expect(report.visibleGrassVisuals).toBeLessThan(GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS);
      expect(report.visibleGrassVisuals).toBeGreaterThan(7400);
      expect(report.grassBladesPerVisual).toBe(GRASS_BLADES_PER_VISUAL);
      expect(report.grassCoverageFraction).toBe(1);
      expect(report.decorativeGrassBladesPerWorldUnitSquared).toBeCloseTo(
        GRASS_BLADES_PER_VISUAL / visualCellArea,
      );
      expect(report.flowerDriftCoverageFraction).toBeGreaterThanOrEqual(0.2);
      expect(report.flowerDriftCoverageFraction).toBeLessThanOrEqual(0.3);
      expect(report.flowerBlossomsPerDriftWorldUnitSquared).toBeGreaterThanOrEqual(2);
      expect(report.flowerBlossomsPerDriftWorldUnitSquared).toBeLessThanOrEqual(4);
      expect(report.meetsDefaultGrassCoverage).toBe(true);
      expect(report.meetsDefaultGrassDensity).toBe(true);
      expect(report.meetsLowGrassDensity).toBe(true);
      expect(report.meetsFlowerDriftCoverage).toBe(true);
      expect(report.meetsFlowerBlossomDensity).toBe(true);

      expect(lowQualityReport.grassBladesPerVisual).toBe(8);
      expect(lowQualityReport.visibleGrassVisuals).toBe(report.visibleGrassVisuals);
      expect(lowQualityReport.decorativeGrassBladesPerWorldUnitSquared).toBeCloseTo(
        8 / visualCellArea,
      );
      expect(lowQualityReport.meetsDefaultGrassDensity).toBe(false);
      expect(lowQualityReport.meetsLowGrassDensity).toBe(true);
    }
  });

  it("reports grass render chunk visibility diagnostics from the camera footprint", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
      },
    });
    const scene = createScene(12345, resolveQualitySettings(null));
    try {
      const state = createInitialState(12345);
      scene.resize(16 / 9);
      scene.sync(state, 0);

      const visibleAtCenter = scene.presentation.grassVisibleChunks;
      expect(scene.density.boundaryInstances).toBeGreaterThan(100);
      expect(scene.presentation.arenaBoundaryMarkers).toBe(scene.density.boundaryInstances);
      expect(scene.presentation.grassTotalChunks).toBe(64);
      expect(scene.presentation.grassNearBladesPerVisual).toBe(14);
      expect(scene.presentation.grassFarBladesPerVisual).toBe(8);
      expect(visibleAtCenter).toBeGreaterThan(0);
      expect(visibleAtCenter).toBeLessThanOrEqual(scene.presentation.grassTotalChunks);
      expect(scene.presentation.grassCulledChunks).toBe(
        scene.presentation.grassTotalChunks - visibleAtCenter,
      );
      expect(scene.presentation.grassNearChunks).toBeGreaterThan(0);
      expect(scene.presentation.grassFarChunks).toBeGreaterThan(0);
      expect(scene.presentation.grassNearChunks + scene.presentation.grassFarChunks).toBe(
        visibleAtCenter,
      );
      expect(scene.presentation.grassVisibleInstances).toBe(visibleAtCenter * 169);
      expect(scene.presentation.grassVisibleBladeBudget).toBe(
        scene.presentation.grassNearChunks * 169 * scene.presentation.grassNearBladesPerVisual +
          scene.presentation.grassFarChunks * 169 * scene.presentation.grassFarBladesPerVisual,
      );

      state.player.x = WORLD_HALF_EXTENT;
      state.player.z = WORLD_HALF_EXTENT;
      scene.sync(state, 1);
      expect(scene.presentation.grassVisibleChunks).toBeGreaterThan(0);
      expect(scene.presentation.grassVisibleChunks).toBeLessThanOrEqual(visibleAtCenter);
      expect(scene.presentation.grassVisibleChunks).toBeLessThan(
        scene.presentation.grassTotalChunks,
      );
      expect(scene.presentation.grassNearChunks + scene.presentation.grassFarChunks).toBe(
        scene.presentation.grassVisibleChunks,
      );
      expect(scene.presentation.grassCulledChunks).toBe(
        scene.presentation.grassTotalChunks - scene.presentation.grassVisibleChunks,
      );
      expect(scene.presentation.grassVisibleBladeBudget).toBe(
        scene.presentation.grassNearChunks * 169 * scene.presentation.grassNearBladesPerVisual +
          scene.presentation.grassFarChunks * 169 * scene.presentation.grassFarBladesPerVisual,
      );
    } finally {
      scene.dispose();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("reports visual cutter scale without changing authoritative collision radius", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
      },
    });
    const scene = createScene(12345, resolveQualitySettings(null));
    try {
      const state = createInitialState(12345);
      scene.sync(state, 0);
      expect(scene.presentation.bladeVisualScale).toBe(1);
      expect(state.player.radius).toBe(PLAYER_RADIUS);

      state.player.level = 4;
      scene.sync(state, 1);
      expect(scene.presentation.bladeTier).toBe("four-arm");
      expect(scene.presentation.bladeVisualScale).toBeCloseTo(1.12);
      expect(state.player.radius).toBe(PLAYER_RADIUS);

      state.player.level = 8;
      scene.sync(state, 2);
      expect(scene.presentation.bladeTier).toBe("saw");
      expect(scene.presentation.bladeVisualScale).toBe(1.2);
      expect(state.player.radius).toBe(PLAYER_RADIUS);
    } finally {
      scene.dispose();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("keeps grass chunk meshes frustum-cullable with computed bounds", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
      },
    });
    const scene = createScene(12345, resolveQualitySettings(null));
    try {
      let grassChunkMeshCount = 0;
      scene.scene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh && object.name.startsWith("GB_GrassChunk_")) {
          grassChunkMeshCount += 1;
          expect(object.frustumCulled).toBe(true);
          expect(object.boundingSphere).not.toBeNull();
        }
      });

      expect(grassChunkMeshCount).toBe(128);
    } finally {
      scene.dispose();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("keeps a minimum playable world width in portrait camera framing", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
      },
    });
    const scene = createScene(12345, resolveQualitySettings(null));
    try {
      scene.resize(16 / 9);
      const landscapeWidth = scene.camera.right - scene.camera.left;
      const landscapeHeight = scene.camera.top - scene.camera.bottom;

      scene.resize(592 / 981);
      const portraitWidth = scene.camera.right - scene.camera.left;
      const portraitHeight = scene.camera.top - scene.camera.bottom;

      expect(landscapeHeight).toBeCloseTo(15.5);
      expect(landscapeWidth).toBeCloseTo((15.5 * 16) / 9);
      expect(portraitWidth).toBeCloseTo(15.5);
      expect(portraitHeight).toBeCloseTo(15.5 / (592 / 981));
      expect(scene.presentation.cameraViewWidth).toBeCloseTo(portraitWidth);
      expect(scene.presentation.cameraViewHeight).toBeCloseTo(portraitHeight);
      expect(scene.presentation.cameraViewAspectRatio).toBeCloseTo(592 / 981);
    } finally {
      scene.dispose();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("projects completed grass visuals into the world-aligned render cut mask", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
      },
    });
    const scene = createScene(707, resolveQualitySettings(null));
    try {
      const state = createInitialState(707);
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
      expect(state.cutGrassVisualIndices.length).toBeGreaterThan(0);

      scene.resize(16 / 9);
      scene.sync(state, 0);
      expect(scene.presentation.grassCutMaskResolution).toBe(GRASS_VISUAL_COLUMNS);
      expect(scene.presentation.grassCutMaskWorldSize).toBe(GRASS_FIELD_SIZE);
      expect(scene.presentation.grassCutMaskAppliedTexels).toBe(0);
      expect(scene.presentation.grassCutMaskCoverageRatio).toBe(0);
      expect(scene.presentation.grassCutMaskGpuSettledVisuals).toBe(0);
      expect(scene.presentation.grassCpuCompletedGrassMatrixUpdates).toBe(0);

      scene.sync(state, 5);
      expect(scene.presentation.grassCutMaskAppliedTexels).toBe(state.cutGrassVisualIndices.length);
      expect(scene.presentation.grassCutMaskGpuSettledVisuals).toBe(
        state.cutGrassVisualIndices.length,
      );
      expect(scene.presentation.grassCpuCompletedGrassMatrixUpdates).toBe(0);
      expect(scene.presentation.grassCutMaskCoverageRatio).toBeCloseTo(
        state.cutGrassVisualIndices.length / (GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS),
        6,
      );

      scene.sync(state, 6);
      expect(scene.presentation.grassCutMaskAppliedTexels).toBe(state.cutGrassVisualIndices.length);
    } finally {
      scene.dispose();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("completes quota contracts deterministically across ten authored seeds", () => {
    for (const seed of COMPLETION_VALIDATION_SEEDS) {
      const first = createInitialState(seed);
      const replay = createInitialState(seed);

      expect(totalAvailableResources(first)).toEqual(totalAvailableResources(replay));
      completeContractThroughQuotaCuts(first);
      completeContractThroughQuotaCuts(replay);

      expect(contractSnapshot(first)).toEqual(contractSnapshot(replay));
      expect(first.mode).toBe("complete");
      expect(first.inventory).toEqual({ grass: 50, flowers: 10, fiber: 6, wood: 6 });
      expect(first.objectives.status).toBe("complete");
      expect(first.result).toMatchObject({
        cutTargets: 69,
        highestLevel: 5,
        finalInventory: { grass: 50, flowers: 10, fiber: 6, wood: 6 },
        completionRevision: 69,
      });
      expect(first.cutEvents).toHaveLength(69);
      expect(first.cutEvents.every((event) => !event.targetId.startsWith("rock-"))).toBe(true);
      expect(new Set(first.cutEvents.map((event) => event.targetId)).size).toBe(69);
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
      { kind: "shrub", yield: 2, xp: 14, levelAfter: 1 },
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

  it("rebuilds the target spatial query after an authored target position changes", () => {
    const state = createInitialState(92);
    const target = requireTarget(state, "flower");
    const originalPosition = { x: target.x, z: target.z };

    target.x = state.player.x;
    target.z = state.player.z;
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(originalPosition).not.toEqual({ x: target.x, z: target.z });
    expect(target.status).toBe("cut");
    expect(state.inventory.flowers).toBe(1);
    expect(state.cutEvents).toEqual([
      expect.objectContaining({
        targetId: target.id,
        kind: "flower",
      }),
    ]);
  });

  it("completes the contract on the same tick that the final quota is awarded", () => {
    const state = createInitialState(94);
    const target = isolateTarget(state, "sapling");
    prepareLevelFourBlade(state);
    state.inventory = { grass: 50, flowers: 10, fiber: 6, wood: 4 };
    state.objectives.grass.collected = 50;
    state.objectives.flowers.collected = 10;
    state.objectives.fiber.collected = 6;
    state.objectives.wood.collected = 4;
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(target.status).toBe("cut");
    expect(state.mode).toBe("complete");
    expect(state.objectives.status).toBe("complete");
    expect(state.objectives.wood).toMatchObject({ status: "complete", collected: 6, target: 6 });
    expect(state.result).toEqual({
      status: "complete",
      completedAtSeconds: FIXED_TIME_STEP_SECONDS,
      timeLimitSeconds: null,
      cutTargets: 1,
      highestLevel: 4,
      finalInventory: { grass: 50, flowers: 10, fiber: 6, wood: 6 },
      completionRevision: 1,
    });
  });

  it("keeps completed contracts idempotent across later simulation ticks", () => {
    const state = createInitialState(95);
    const target = isolateTarget(state, "grass");
    state.inventory = { grass: 49, flowers: 10, fiber: 6, wood: 6 };
    state.objectives.grass.collected = 49;
    state.objectives.flowers.collected = 10;
    state.objectives.fiber.collected = 6;
    state.objectives.wood.collected = 6;
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    const resultSnapshot = state.result;
    const inventorySnapshot = { ...state.inventory };
    const cutRevisionSnapshot = state.cutRevision;
    const elapsedSnapshot = state.elapsedSeconds;
    state.player.vx = MAX_MOVE_SPEED;

    for (let frame = 0; frame < 60; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.mode).toBe("complete");
    expect(state.result).toEqual(resultSnapshot);
    expect(state.inventory).toEqual(inventorySnapshot);
    expect(state.cutRevision).toBe(cutRevisionSnapshot);
    expect(state.elapsedSeconds).toBe(elapsedSnapshot);
    expect(state.player.vx).toBe(MAX_MOVE_SPEED);
  });

  it("replays repeated contract-completion snapshots deterministically", () => {
    const first = createInitialState(96);
    const replay = createInitialState(96);

    prepareOneCutFromCompletion(first);
    prepareOneCutFromCompletion(replay);

    stepState(first, idleInput, FIXED_TIME_STEP_SECONDS);
    stepState(replay, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(contractSnapshot(replay)).toEqual(contractSnapshot(first));

    const stableSnapshot = contractSnapshot(first);
    for (let frame = 0; frame < 90; frame += 1) {
      stepState(first, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(contractSnapshot(first)).toEqual(stableSnapshot);
  });

  it("pauses and resumes active simulation without advancing cuts or elapsed time", () => {
    const state = createInitialState(454);
    const target = isolateTarget(state, "grass");

    setPaused(state, true);

    expect(state.mode).toBe("paused");
    for (let frame = 0; frame < 60; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.elapsedSeconds).toBe(0);
    expect(target.status).toBe("standing");
    expect(target.accumulatedWork).toBe(0);
    expect(state.inventory.grass).toBe(0);

    setPaused(state, false);
    cutCurrentTarget(state, target);

    expect(state.mode).toBe("active");
    expect(target.status).toBe("cut");
    expect(state.inventory.grass).toBe(1);
    expect(state.elapsedSeconds).toBeGreaterThan(0);
  });

  it("clears movement, contact, and too-tough feedback when pausing", () => {
    const state = createInitialState(455);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);

    for (let frame = 0; frame < 300 && state.tooToughNotice === null; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.tooToughNotice?.targetId).toBe(target.id);
    expect(state.bladeContactTargetIds).toEqual([target.id]);

    setPaused(state, true);

    expect(state.mode).toBe("paused");
    expect(state.player.vx).toBe(0);
    expect(state.player.vz).toBe(0);
    expect(state.bladeContactTargetIds).toEqual([]);
    expect(state.tooToughNotice).toBeNull();
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

  it("cuts one flower pocket without awarding the whole visual drift", () => {
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

  it("cuts only edge flowers when the blade grazes a real flower patch", () => {
    const state = createInitialState(202);
    const clusterFlowers = state.targets
      .filter((target) => target.kind === "flower" && target.id.startsWith("flower-0-"))
      .sort((first, second) => first.x - second.x);
    const edgeFlower = clusterFlowers[0];
    if (edgeFlower === undefined) {
      throw new Error("Missing edge flower target");
    }

    state.targets = clusterFlowers;
    state.player.x = edgeFlower.x;
    state.player.z = edgeFlower.z;
    state.player.vx = 0;
    state.player.vz = 0;

    for (let frame = 0; frame < 60; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    const cutFlowers = clusterFlowers.filter((target) => target.status === "cut");
    expect(cutFlowers.length).toBeGreaterThan(0);
    expect(cutFlowers.length).toBeLessThan(clusterFlowers.length);
    expect(cutFlowers.length).toBeLessThanOrEqual(3);
    expect(state.inventory.flowers).toBe(cutFlowers.length);
  });

  it("does not complete Flower Sweep by grazing one flower patch edge", () => {
    const state = createInitialState(202, "flower-sweep");
    const clusterFlowers = state.targets
      .filter((target) => target.kind === "flower" && target.id.startsWith("flower-0-"))
      .sort((first, second) => first.x - second.x);
    const edgeFlower = clusterFlowers[0];
    if (edgeFlower === undefined) {
      throw new Error("Missing edge flower target");
    }

    state.targets = clusterFlowers;
    state.objectives.grass.collected = state.objectives.grass.target;
    state.objectives.fiber.collected = state.objectives.fiber.target;
    state.objectives.wood.collected = state.objectives.wood.target;
    state.player.x = edgeFlower.x;
    state.player.z = edgeFlower.z;
    state.player.vx = 0;
    state.player.vz = 0;

    for (let frame = 0; frame < 60; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    const cutFlowers = clusterFlowers.filter((target) => target.status === "cut");
    expect(cutFlowers.length).toBeGreaterThan(0);
    expect(cutFlowers.length).toBeLessThan(clusterFlowers.length);
    expect(state.objectives.flowers.collected).toBe(cutFlowers.length);
    expect(state.objectives.flowers.collected).toBeLessThan(state.objectives.flowers.target);
    expect(state.mode).toBe("active");
    expect(state.result).toBeNull();
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

  it("cuts an isolated shrub within its recommended-level timing range", () => {
    const state = createInitialState(247);
    const target = isolateTarget(state, "shrub");
    prepareLevelThreeBlade(state);

    const cutTicks = cutCurrentTarget(state, target);
    const cutSeconds = cutTicks * FIXED_TIME_STEP_SECONDS;

    expect(cutSeconds).toBeGreaterThanOrEqual(1.8);
    expect(cutSeconds).toBeLessThanOrEqual(3);
  });

  it("blocks movement while an authoritative shrub is standing", () => {
    const state = createInitialState(248);
    const target = isolateTarget(state, "shrub");
    prepareLevelThreeBlade(state);
    placeTargetAtPositiveXContact(state, target);

    stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);

    expect(state.player.x).toBeCloseTo(0, 8);
    expect(state.player.z).toBeCloseTo(0, 8);
    expect(target.status).toBe("cutting");
    expect(target.accumulatedWork).toBeGreaterThan(0);
    expect(state.inventory.fiber).toBe(0);
  });

  it("awards two Fiber and fourteen XP exactly once on the shrub cut tick", () => {
    const state = createInitialState(249);
    const target = isolateTarget(state, "shrub");
    prepareLevelThreeBlade(state);
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);

    expect(target.status).toBe("cut");
    expect(state.inventory.fiber).toBe(2);
    expect(state.objectives.fiber.collected).toBe(2);
    expect(state.xp).toBe(69);
    expect(state.cutRevision).toBe(1);

    for (let frame = 0; frame < 120; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.inventory.fiber).toBe(2);
    expect(state.objectives.fiber.collected).toBe(2);
    expect(state.xp).toBe(69);
    expect(state.cutRevision).toBe(1);
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

  it("recovers RPM after the blade leaves a high-load target", () => {
    const state = createInitialState(312);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);

    for (let frame = 0; frame < 240; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }
    expect(state.player.rpm).toBeLessThan(180);

    for (let frame = 0; frame < 120 && state.bladeContactTargetIds.length > 0; frame += 1) {
      stepState(state, negativeXInput, FIXED_TIME_STEP_SECONDS);
    }
    expect(state.bladeContactTargetIds).toEqual([]);

    const releasedRpm = state.player.rpm;
    for (let frame = 0; frame < 120; frame += 1) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.player.rpm).toBeGreaterThan(releasedRpm);
    expect(state.player.rpm).toBeLessThanOrEqual(state.player.targetRpm);
    expect(target.status).toBe("cutting");
    expect(state.inventory.wood).toBe(0);
  });

  it("applies aggregate RPM load for simultaneous blade contacts", () => {
    const singleContact = createInitialState(317);
    const singleWeed = isolateTarget(singleContact, "denseWeed");
    prepareLevelTwoBlade(singleContact);

    const doubleContact = createInitialState(317);
    const firstWeed = isolateTarget(doubleContact, "denseWeed");
    const secondWeed: TargetState = {
      ...firstWeed,
      id: "test-denseWeed-second",
      accumulatedWork: 0,
      status: "standing",
    };
    doubleContact.targets = [firstWeed, secondWeed];
    prepareLevelTwoBlade(doubleContact);

    for (let frame = 0; frame < 30; frame += 1) {
      stepState(singleContact, idleInput, FIXED_TIME_STEP_SECONDS);
      stepState(doubleContact, idleInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(singleContact.bladeContactTargetIds).toEqual([singleWeed.id]);
    expect(doubleContact.bladeContactTargetIds).toEqual([firstWeed.id, secondWeed.id]);
    expect(doubleContact.player.rpm).toBeLessThan(singleContact.player.rpm);
    expect(firstWeed.accumulatedWork).toBeLessThan(singleWeed.accumulatedWork);
    expect(secondWeed.accumulatedWork).toBeCloseTo(firstWeed.accumulatedWork);
  });

  it("emits a throttled too-tough notice when a higher-level target stalls the blade", () => {
    const state = createInitialState(314);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);

    for (let frame = 0; frame < 300 && state.tooToughNotice === null; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.player.rpm).toBeLessThan(180);
    expect(state.tooToughNotice).toMatchObject({
      targetId: target.id,
      kind: "matureTree",
      recommendedLevel: 6,
      currentLevel: 1,
    });
    const firstNoticeRevision = state.tooToughNotice?.revision ?? 0;

    for (let frame = 0; frame < 10; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.tooToughRevision).toBe(firstNoticeRevision);
  });

  it("clears too-tough feedback after backing away from the stalled target", () => {
    const state = createInitialState(315);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);

    for (let frame = 0; frame < 300 && state.tooToughNotice === null; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }
    expect(state.tooToughNotice?.targetId).toBe(target.id);

    for (let frame = 0; frame < 90 && state.bladeContactTargetIds.length > 0; frame += 1) {
      stepState(state, negativeXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.bladeContactTargetIds).toEqual([]);
    expect(state.tooToughNotice).toBeNull();
  });

  it("does not show too-tough feedback when the blade level can reasonably cut the target", () => {
    const state = createInitialState(316);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);
    prepareLevelSixBlade(state);

    for (let frame = 0; frame < 120; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(target.accumulatedWork).toBeGreaterThan(0);
    expect(state.tooToughNotice).toBeNull();
    expect(state.tooToughRevision).toBe(0);
  });

  it("allows the blade hub to back away from a solid target", () => {
    const state = createInitialState(323);
    const target = isolateTarget(state, "matureTree");
    placeTargetAtPositiveXContact(state, target);

    stepState(state, negativeXInput, FIXED_TIME_STEP_SECONDS);

    expect(state.player.x).toBeLessThan(0);
    expect(state.player.z).toBeCloseTo(0, 8);
  });

  it("blocks on a non-cuttable rock without awarding resources or cut progress", () => {
    const state = createInitialState(343);
    const target = isolateTarget(state, "rock");
    placeTargetAtPositiveXContact(state, target);

    for (let frame = 0; frame < 180; frame += 1) {
      stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
    }

    expect(state.player.x).toBeCloseTo(0, 8);
    expect(state.player.z).toBeCloseTo(0, 8);
    expect(target.status).toBe("standing");
    expect(target.accumulatedWork).toBe(0);
    expect(state.bladeContactTargetIds).toEqual([target.id]);
    expect(state.tooToughNotice).toBeNull();
    expect(shouldShowTargetProgress(target)).toBe(false);
    expect(state.inventory).toEqual({ grass: 0, flowers: 0, fiber: 0, wood: 0 });
    expect(state.xp).toBe(0);
    expect(state.cutEvents).toEqual([]);
    expect(state.cutRevision).toBe(0);
  });

  it("emits a bounded rock deflection burst without making rocks cuttable", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
      },
    });
    const scene = createScene(343, resolveQualitySettings(null));
    try {
      const state = createInitialState(343);
      const target = isolateTarget(state, "rock");
      placeTargetAtPositiveXContact(state, target);

      for (let frame = 0; frame < 24; frame += 1) {
        stepState(state, positiveXInput, FIXED_TIME_STEP_SECONDS);
      }
      scene.sync(state, state.elapsedSeconds);

      expect(state.bladeContactTargetIds).toEqual([target.id]);
      expect(target.status).toBe("standing");
      expect(target.accumulatedWork).toBe(0);
      expect(state.cutEvents).toEqual([]);
      expect(scene.presentation.rockDeflectionEmissions).toBe(1);
      expect(scene.presentation.lastRockDeflectionTargetId).toBe(target.id);
      expect(scene.presentation.activeFragments).toBeGreaterThanOrEqual(
        ROCK_CONTACT_FRAGMENTS_PER_EMISSION,
      );

      scene.sync(state, state.elapsedSeconds + 0.05);
      expect(scene.presentation.rockDeflectionEmissions).toBe(1);
    } finally {
      scene.dispose();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("allows the blade hub to back away from a non-cuttable rock", () => {
    const state = createInitialState(344);
    const target = isolateTarget(state, "rock");
    placeTargetAtPositiveXContact(state, target);

    stepState(state, negativeXInput, FIXED_TIME_STEP_SECONDS);

    expect(state.player.x).toBeLessThan(0);
    expect(state.player.z).toBeCloseTo(0, 8);
    expect(target.status).toBe("standing");
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
    expect(state.player.x).toBeLessThanOrEqual(limit);
    expect(state.player.vx).toBe(0);

    state.player.z = -limit + 0.01;
    state.player.vz = -MAX_MOVE_SPEED;
    stepState(state, { ...idleInput, forward: true }, FIXED_TIME_STEP_SECONDS);
    expect(state.player.z).toBeGreaterThanOrEqual(-limit);
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

function totalAvailableResources(state: GameState): {
  grass: number;
  flowers: number;
  fiber: number;
  wood: number;
} {
  const totals = { grass: 0, flowers: 0, fiber: 0, wood: 0 };
  for (const target of state.targets) {
    switch (target.kind) {
      case "grass":
        totals.grass += target.yield;
        break;
      case "flower":
        totals.flowers += target.yield;
        break;
      case "denseWeed":
      case "shrub":
        totals.fiber += target.yield;
        break;
      case "sapling":
      case "matureTree":
        totals.wood += target.yield;
        break;
      case "rock":
        break;
    }
  }
  return totals;
}

function countVisibleGrassVisuals(layout: MeadowLayout): number {
  return layout.grassVisuals.filter((visual) => visual.height > 0 && visual.scaleX > 0).length;
}

function hasGrassCellNear(layout: MeadowLayout, x: number, z: number, radius = 0.95): boolean {
  return layout.grassCells.some((cell) => Math.hypot(cell.x - x, cell.z - z) <= radius);
}

function advanceState(state: GameState, seconds: number): void {
  const frames = Math.ceil(seconds / FIXED_TIME_STEP_SECONDS);
  for (let frame = 0; frame < frames; frame += 1) {
    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
  }
}

function prepareOneCutFromCompletion(state: GameState): void {
  const target = isolateTarget(state, "grass");
  state.inventory = { grass: 49, flowers: 10, fiber: 6, wood: 6 };
  state.objectives.grass.collected = 49;
  state.objectives.flowers.collected = 10;
  state.objectives.fiber.collected = 6;
  state.objectives.wood.collected = 6;
  target.status = "cutting";
  target.accumulatedWork = target.requiredWork - 0.001;
}

function contractSnapshot(state: GameState): ContractSnapshot {
  return JSON.parse(
    JSON.stringify({
      mode: state.mode,
      inventory: state.inventory,
      objectives: state.objectives,
      result: state.result,
      cutRevision: state.cutRevision,
      cutEvents: state.cutEvents,
    }),
  ) as ContractSnapshot;
}

function completeContractThroughQuotaCuts(state: GameState): void {
  const quotaTargets =
    state.contract.completionMode === "clear-patches"
      ? [
          ...targetsForKind(state, "grass", state.objectives.grass.target),
          ...targetsForKind(state, "flower", state.objectives.flowers.target),
        ]
      : [
          ...targetsForKind(state, "grass", state.objectives.grass.target),
          ...targetsForKind(state, "flower", state.objectives.flowers.target),
          ...targetsForFiberQuota(state, state.objectives.fiber.target),
          ...targetsForWoodQuota(state, state.objectives.wood.target),
        ];
  state.inventory = { grass: 0, flowers: 0, fiber: 0, wood: 0 };
  state.objectives.grass.collected = 0;
  state.objectives.flowers.collected = 0;
  state.objectives.fiber.collected = 0;
  state.objectives.wood.collected = 0;
  state.targets = quotaTargets;

  for (let index = 0; index < quotaTargets.length; index += 1) {
    const target = quotaTargets[index];
    if (target === undefined) {
      continue;
    }
    target.x = 80 + index * 4;
    target.z = 80;
    target.status = "standing";
    target.accumulatedWork = 0;
  }

  for (const target of quotaTargets) {
    target.x = state.player.x;
    target.z = state.player.z;
    target.status = "cutting";
    target.accumulatedWork = target.requiredWork - 0.001;

    stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
    expect(target.status).toBe("cut");
  }
}

function targetsForKind(state: GameState, kind: TargetKind, count: number): TargetState[] {
  const targets = state.targets.filter((target) => target.kind === kind).slice(0, count);
  expect(targets).toHaveLength(count);
  return targets;
}

function targetsForFiberQuota(state: GameState, fiberQuota: number): TargetState[] {
  if (fiberQuota <= 0) {
    return [];
  }

  const targets: TargetState[] = [];
  let remainingFiber = fiberQuota;
  for (const target of state.targets) {
    if (target.kind !== "denseWeed" && target.kind !== "shrub") {
      continue;
    }
    if (remainingFiber <= 0) {
      break;
    }

    targets.push(target);
    remainingFiber -= target.yield;
  }

  expect(remainingFiber).toBeLessThanOrEqual(0);
  return targets;
}

function targetsForWoodQuota(state: GameState, woodQuota: number): TargetState[] {
  if (woodQuota <= 0) {
    return [];
  }

  const targets: TargetState[] = [];
  let remainingWood = woodQuota;
  for (const target of state.targets) {
    if (target.kind !== "sapling" && target.kind !== "matureTree") {
      continue;
    }
    if (remainingWood <= 0) {
      break;
    }

    targets.push(target);
    remainingWood -= target.yield;
  }

  expect(remainingWood).toBeLessThanOrEqual(0);
  return targets;
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

function prepareLevelThreeBlade(state: GameState): void {
  state.xp = 55;
  state.player.level = 3;
  state.player.rpm = 800;
  state.player.targetRpm = 800;
}

function prepareLevelFourBlade(state: GameState): void {
  state.xp = 110;
  state.player.level = 4;
  state.player.rpm = 840;
  state.player.targetRpm = 840;
}

function prepareLevelSixBlade(state: GameState): void {
  state.xp = 300;
  state.player.level = 6;
  state.player.rpm = 920;
  state.player.targetRpm = 920;
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

function hasShrubTierValues(target: {
  kind: TargetKind;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "shrub" &&
    target.solidRadius > 0 &&
    target.recommendedLevel === 3 &&
    target.requiredWork === 30 &&
    target.resistance === 0.55 &&
    target.yield === 2 &&
    target.xp === 14
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

function hasRockObstacleValues(target: {
  kind: TargetKind;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}): boolean {
  return (
    target.kind === "rock" &&
    target.solidRadius > 0 &&
    target.recommendedLevel === Number.POSITIVE_INFINITY &&
    target.requiredWork === 0 &&
    target.resistance === 1.2 &&
    target.yield === 0 &&
    target.xp === 0
  );
}
