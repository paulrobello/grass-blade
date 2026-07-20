const TAU = Math.PI * 2;
const GRASS_COLOR_COUNT = 4;
const FLOWER_COLOR_COUNT = 5;
const FLOWER_CLUSTER_COLUMNS = 4;

export const GRASS_VISUAL_COLUMNS = 104;
export const GRASS_LOGICAL_COLUMNS = 26;
export const GRASS_FIELD_SIZE = 41;
export const FLOWER_CLUSTER_COUNT = 16;
export const FLOWER_VISUAL_COUNT = 420;

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

export interface TargetSeed {
  id: string;
  kind: "grass" | "flower";
  x: number;
  z: number;
  radius: number;
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
}

export function createMeadowLayout(seed: number): MeadowLayout {
  const grassCells = createGrassCells();
  const grassVisuals = createGrassVisuals(createSeededRandom(seed ^ 0x9e3779b9));
  const flowerTargets = createFlowerTargets(createSeededRandom(seed ^ 0x243f6a88));
  const flowerVisuals = createFlowerVisuals(flowerTargets, createSeededRandom(seed ^ 0xb7e15162));

  return { grassCells, grassVisuals, flowerTargets, flowerVisuals };
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
