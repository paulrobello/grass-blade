const TAU = Math.PI * 2;
const GRASS_COLOR_COUNT = 4;
const FLOWER_COLOR_COUNT = 5;
const FLOWER_CLUSTER_COLUMNS = 4;
const DENSE_WEED_COLOR_COUNT = 3;
const SAPLING_COLOR_COUNT = 3;

export const GRASS_VISUAL_COLUMNS = 104;
export const GRASS_LOGICAL_COLUMNS = 26;
export const GRASS_FIELD_SIZE = 41;
export const FLOWER_CLUSTER_COUNT = 16;
export const FLOWER_VISUAL_COUNT = 420;
export const DENSE_WEED_COUNT = 12;
export const DENSE_WEED_VISUALS_PER_TARGET = 9;
export const DENSE_WEED_VISUAL_COUNT = DENSE_WEED_COUNT * DENSE_WEED_VISUALS_PER_TARGET;
export const SAPLING_COUNT = 5;
export const MATURE_TREE_COUNT = 8;

const DENSE_WEED_CLUSTER_CENTERS = [
  [-4.8, -3.5],
  [4.5, -4.2],
  [-4.2, 4.8],
  [5.5, 3.8],
] as const;

const SAPLING_PLACEMENT_ANCHORS = [
  [-8.5, -7],
  [8.5, -6.5],
  [-7.5, 8.5],
  [8, 9],
  [1.5, 11.5],
] as const;

const MATURE_TREE_PLACEMENTS = [
  [-16, -15, 1.05],
  [-8, -18, 0.85],
  [8, -17, 1.15],
  [17, -10, 0.95],
  [17, 13, 1.1],
  [7, 18, 0.9],
  [-10, 17, 1.18],
  [-18, 8, 0.92],
] as const;

export interface GrassVisual {
  x: number;
  z: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleZ: number;
  cellIndex: number;
  colorIndex: number;
}

export interface FlowerVisual {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  targetIndex: number;
  colorIndex: number;
}

export interface DenseWeedVisual {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  targetIndex: number;
  colorIndex: number;
}

export interface SaplingVisual {
  x: number;
  z: number;
  size: number;
  rotation: number;
  targetIndex: number;
  colorIndex: number;
}

export interface MatureTreeVisual {
  x: number;
  z: number;
  size: number;
  targetIndex: number;
}

export type TargetKind = "grass" | "flower" | "denseWeed" | "sapling" | "matureTree";

export interface TargetSeed {
  id: string;
  kind: TargetKind;
  x: number;
  z: number;
  radius: number;
  solidRadius: number;
  recommendedLevel: number;
  requiredWork: number;
  resistance: number;
  yield: number;
  xp: number;
}

export interface MeadowLayout {
  grassCells: TargetSeed[];
  grassVisuals: GrassVisual[];
  flowerTargets: TargetSeed[];
  flowerVisuals: FlowerVisual[];
  denseWeedTargets: TargetSeed[];
  denseWeedVisuals: DenseWeedVisual[];
  saplingTargets: TargetSeed[];
  saplingVisuals: SaplingVisual[];
  matureTreeTargets: TargetSeed[];
  matureTreeVisuals: MatureTreeVisual[];
}

export function createMeadowLayout(seed: number): MeadowLayout {
  const grassCells = createGrassCells();
  const grassVisuals = createGrassVisuals(createSeededRandom(seed ^ 0x9e3779b9));
  const flowerTargets = createFlowerTargets(createSeededRandom(seed ^ 0x243f6a88));
  const flowerVisuals = createFlowerVisuals(flowerTargets, createSeededRandom(seed ^ 0xb7e15162));
  const denseWeedTargets = createDenseWeedTargets(createSeededRandom(seed ^ 0x13198a2e));
  const denseWeedVisuals = createDenseWeedVisuals(
    denseWeedTargets,
    createSeededRandom(seed ^ 0x03707344),
  );
  const saplingTargets = createSaplingTargets(createSeededRandom(seed ^ 0xa4093822));
  const saplingVisuals = createSaplingVisuals(
    saplingTargets,
    createSeededRandom(seed ^ 0x299f31d0),
  );
  const matureTreeTargets = createMatureTreeTargets();
  const matureTreeVisuals = createMatureTreeVisuals();

  return {
    grassCells,
    grassVisuals,
    flowerTargets,
    flowerVisuals,
    denseWeedTargets,
    denseWeedVisuals,
    saplingTargets,
    saplingVisuals,
    matureTreeTargets,
    matureTreeVisuals,
  };
}

function createGrassCells(): TargetSeed[] {
  const cellSize = GRASS_FIELD_SIZE / GRASS_LOGICAL_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;
  const radius = cellSize * 0.54;
  const cells: TargetSeed[] = [];

  for (let row = 0; row < GRASS_LOGICAL_COLUMNS; row += 1) {
    for (let column = 0; column < GRASS_LOGICAL_COLUMNS; column += 1) {
      const index = row * GRASS_LOGICAL_COLUMNS + column;
      cells.push({
        id: `grass-${index}`,
        kind: "grass",
        x: -halfField + (column + 0.5) * cellSize,
        z: -halfField + (row + 0.5) * cellSize,
        radius,
        solidRadius: 0,
        recommendedLevel: 1,
        requiredWork: 1.5,
        resistance: 0.04,
        yield: 1,
        xp: 1,
      });
    }
  }

  return cells;
}

function createGrassVisuals(random: () => number): GrassVisual[] {
  const visualCellSize = GRASS_FIELD_SIZE / GRASS_VISUAL_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;
  const jitter = visualCellSize * 0.42;
  const visuals: GrassVisual[] = [];

  for (let row = 0; row < GRASS_VISUAL_COLUMNS; row += 1) {
    for (let column = 0; column < GRASS_VISUAL_COLUMNS; column += 1) {
      const logicalRow = Math.floor(row / 4);
      const logicalColumn = Math.floor(column / 4);
      visuals.push({
        x: -halfField + (column + 0.5) * visualCellSize + randomRange(random, -jitter, jitter),
        z: -halfField + (row + 0.5) * visualCellSize + randomRange(random, -jitter, jitter),
        height: 0.68 + random() * 0.72,
        rotation: random() * TAU,
        scaleX: 0.82 + random() * 0.62,
        scaleZ: 0.82 + random() * 0.62,
        cellIndex: logicalRow * GRASS_LOGICAL_COLUMNS + logicalColumn,
        colorIndex: Math.floor(random() * GRASS_COLOR_COUNT),
      });
    }
  }

  return visuals;
}

function createFlowerTargets(random: () => number): TargetSeed[] {
  const usableFieldSize = 34;
  const clusterCellSize = usableFieldSize / FLOWER_CLUSTER_COLUMNS;
  const halfUsableField = usableFieldSize / 2;
  const jitter = clusterCellSize * 0.24;
  const targets: TargetSeed[] = [];

  for (let index = 0; index < FLOWER_CLUSTER_COUNT; index += 1) {
    const column = index % FLOWER_CLUSTER_COLUMNS;
    const row = Math.floor(index / FLOWER_CLUSTER_COLUMNS);
    targets.push({
      id: `flower-${index}`,
      kind: "flower",
      x: -halfUsableField + (column + 0.5) * clusterCellSize + randomRange(random, -jitter, jitter),
      z: -halfUsableField + (row + 0.5) * clusterCellSize + randomRange(random, -jitter, jitter),
      radius: 1.35 + random() * 0.35,
      solidRadius: 0,
      recommendedLevel: 1,
      requiredWork: 4,
      resistance: 0.08,
      yield: 1,
      xp: 3,
    });
  }

  return targets;
}

function createFlowerVisuals(targets: TargetSeed[], random: () => number): FlowerVisual[] {
  const visuals: FlowerVisual[] = [];

  for (let index = 0; index < FLOWER_VISUAL_COUNT; index += 1) {
    const targetIndex = index % targets.length;
    const target = targets[targetIndex];
    if (target === undefined) {
      continue;
    }

    const angle = random() * TAU;
    const distance = Math.sqrt(random()) * target.radius * 0.9;
    visuals.push({
      x: target.x + Math.cos(angle) * distance,
      z: target.z + Math.sin(angle) * distance,
      scale: 0.78 + random() * 0.5,
      rotation: random() * TAU,
      targetIndex,
      colorIndex: Math.floor(random() * FLOWER_COLOR_COUNT),
    });
  }

  return visuals;
}

function createDenseWeedTargets(random: () => number): TargetSeed[] {
  const targets: TargetSeed[] = [];

  for (let index = 0; index < DENSE_WEED_COUNT; index += 1) {
    const clusterIndex = index % DENSE_WEED_CLUSTER_CENTERS.length;
    const cluster = DENSE_WEED_CLUSTER_CENTERS[clusterIndex];
    if (cluster === undefined) {
      continue;
    }

    const memberIndex = Math.floor(index / DENSE_WEED_CLUSTER_CENTERS.length);
    const angle = (memberIndex / 3) * TAU + randomRange(random, -0.24, 0.24);
    const distance = 0.7 + random() * 0.65;
    targets.push({
      id: `dense-weed-${index}`,
      kind: "denseWeed",
      x: cluster[0] + Math.cos(angle) * distance,
      z: cluster[1] + Math.sin(angle) * distance,
      radius: 0.82 + random() * 0.16,
      solidRadius: 0,
      recommendedLevel: 2,
      requiredWork: 12,
      resistance: 0.25,
      yield: 1,
      xp: 6,
    });
  }

  return targets;
}

function createDenseWeedVisuals(targets: TargetSeed[], random: () => number): DenseWeedVisual[] {
  const visuals: DenseWeedVisual[] = [];

  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const target = targets[targetIndex];
    if (target === undefined) {
      continue;
    }

    for (let memberIndex = 0; memberIndex < DENSE_WEED_VISUALS_PER_TARGET; memberIndex += 1) {
      const angle = random() * TAU;
      const distance = Math.sqrt(random()) * target.radius * 0.72;
      visuals.push({
        x: target.x + Math.cos(angle) * distance,
        z: target.z + Math.sin(angle) * distance,
        scale: 0.82 + random() * 0.48,
        rotation: random() * TAU,
        targetIndex,
        colorIndex: Math.floor(random() * DENSE_WEED_COLOR_COUNT),
      });
    }
  }

  return visuals;
}

function createSaplingTargets(random: () => number): TargetSeed[] {
  return SAPLING_PLACEMENT_ANCHORS.map(([anchorX, anchorZ], index) => {
    const size = 0.82 + random() * 0.28;
    const trunkRadius = size * 0.34;
    return {
      id: `sapling-${index}`,
      kind: "sapling",
      x: anchorX + randomRange(random, -0.7, 0.7),
      z: anchorZ + randomRange(random, -0.7, 0.7),
      radius: trunkRadius,
      solidRadius: trunkRadius,
      recommendedLevel: 4,
      requiredWork: 50,
      resistance: 0.9,
      yield: 2,
      xp: 30,
    };
  });
}

function createSaplingVisuals(targets: TargetSeed[], random: () => number): SaplingVisual[] {
  return targets.map((target, targetIndex) => ({
    x: target.x,
    z: target.z,
    size: target.solidRadius / 0.34,
    rotation: random() * TAU,
    targetIndex,
    colorIndex: Math.floor(random() * SAPLING_COLOR_COUNT),
  }));
}

function createMatureTreeTargets(): TargetSeed[] {
  return MATURE_TREE_PLACEMENTS.map(([x, z, size], index) => {
    const trunkRadius = 0.5 * size;
    return {
      id: `mature-tree-${index}`,
      kind: "matureTree",
      x,
      z,
      radius: trunkRadius,
      solidRadius: trunkRadius,
      recommendedLevel: 6,
      requiredWork: 60,
      resistance: 1.6,
      yield: 6,
      xp: 75,
    };
  });
}

function createMatureTreeVisuals(): MatureTreeVisual[] {
  return MATURE_TREE_PLACEMENTS.map(([x, z, size], targetIndex) => ({
    x,
    z,
    size,
    targetIndex,
  }));
}

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return (): number => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomRange(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}
