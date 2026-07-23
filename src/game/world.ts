const TAU = Math.PI * 2;
const GRASS_COLOR_COUNT = 4;
const FLOWER_COLOR_COUNT = 5;
const FLOWER_CLUSTER_COLUMNS = 4;
const FLOWER_TARGETS_PER_CLUSTER = 20;
const FLOWER_CONTACT_RADIUS = 0.24;
const FLOWER_VISUAL_SPREAD_RADIUS = 0.58;
const DENSE_WEED_COLOR_COUNT = 3;
const SHRUB_COLOR_COUNT = 3;
const SAPLING_COLOR_COUNT = 3;

export const GRASS_VISUAL_COLUMNS = 104;
export const GRASS_LOGICAL_COLUMNS = 26;
export const GRASS_FIELD_SIZE = 41;
export const GRASS_BLADES_PER_VISUAL = 14;
export const FLOWER_CLUSTER_COUNT = 16;
export const FLOWER_TARGET_COUNT = FLOWER_CLUSTER_COUNT * FLOWER_TARGETS_PER_CLUSTER;
export const FLOWER_VISUAL_COUNT = 880;
export const DENSE_WEED_COUNT = 12;
export const DENSE_WEED_VISUALS_PER_TARGET = 9;
export const DENSE_WEED_VISUAL_COUNT = DENSE_WEED_COUNT * DENSE_WEED_VISUALS_PER_TARGET;
export const SHRUB_COUNT = 8;
export const SHRUB_VISUAL_COUNT = SHRUB_COUNT;
export const SAPLING_COUNT = 5;
export const MATURE_TREE_COUNT = 8;
export const ROCK_COUNT = 8;

export type ArenaLayoutId =
  | "meadow-delivery"
  | "flower-sweep"
  | "woodland-cleanup"
  | "timber-trail"
  | "rock-garden"
  | "timed-harvest"
  | "field-sprint"
  | "weed-rush"
  | "clear-every-patch";
export type ArenaShape =
  | "starter-meadow-paths"
  | "branching-flower-corridors"
  | "woodland-clearings"
  | "timber-groves"
  | "rock-slalom"
  | "timed-loop"
  | "sprint-lanes"
  | "weed-switchbacks"
  | "split-clearings";

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

const SHRUB_PLACEMENT_ANCHORS = [
  [6.2, -6.2],
  [-6.4, -6.2],
  [-6.1, 6.1],
  [6.5, 6],
  [11.2, -2.4],
  [-11.4, 2.7],
  [2.8, 11.3],
  [-2.8, -11.2],
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

const ROCK_PLACEMENTS = [
  [-14.5, -2.5, 0.86],
  [13.7, 3.4, 0.74],
  [-14.2, 12.8, 0.92],
  [14.5, -13.3, 0.82],
  [0.4, 17.1, 0.72],
  [18.1, 0.3, 0.78],
  [-18.2, -6.4, 0.7],
  [4.1, -12.7, 0.76],
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

export interface ShrubVisual {
  x: number;
  z: number;
  size: number;
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

export interface RockVisual {
  x: number;
  z: number;
  size: number;
  rotation: number;
  targetIndex: number;
}

export interface ArenaBoundaryMarker {
  x: number;
  z: number;
  rotation: number;
  scale: number;
  colorIndex: number;
}

export type TargetKind =
  "grass" | "flower" | "denseWeed" | "shrub" | "sapling" | "matureTree" | "rock";

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
  arenaId: ArenaLayoutId;
  arenaShape: ArenaShape;
  grassCells: TargetSeed[];
  grassVisuals: GrassVisual[];
  flowerTargets: TargetSeed[];
  flowerVisuals: FlowerVisual[];
  denseWeedTargets: TargetSeed[];
  denseWeedVisuals: DenseWeedVisual[];
  shrubTargets: TargetSeed[];
  shrubVisuals: ShrubVisual[];
  saplingTargets: TargetSeed[];
  saplingVisuals: SaplingVisual[];
  matureTreeTargets: TargetSeed[];
  matureTreeVisuals: MatureTreeVisual[];
  rockTargets: TargetSeed[];
  rockVisuals: RockVisual[];
  boundaryMarkers: ArenaBoundaryMarker[];
}

export interface MeadowDensityReport {
  arenaShape: ArenaShape;
  eligibleTerrainArea: number;
  visibleGrassVisuals: number;
  grassBladesPerVisual: number;
  grassCoverageFraction: number;
  decorativeGrassBladesPerWorldUnitSquared: number;
  flowerDriftCoverageFraction: number;
  flowerBlossomsPerDriftWorldUnitSquared: number;
  meetsDefaultGrassCoverage: boolean;
  meetsDefaultGrassDensity: boolean;
  meetsLowGrassDensity: boolean;
  meetsFlowerDriftCoverage: boolean;
  meetsFlowerBlossomDensity: boolean;
}

export function createMeadowLayout(
  seed: number,
  arenaId: string = "meadow-delivery",
): MeadowLayout {
  const resolvedArenaId = resolveArenaLayoutId(arenaId);
  const arenaShape = resolveArenaShape(resolvedArenaId);
  const grass = createGrassCells(resolvedArenaId);
  const boundaryMarkers = createArenaBoundaryMarkers(resolvedArenaId);
  const grassVisuals = createGrassVisuals(
    createSeededRandom(seed ^ 0x9e3779b9),
    resolvedArenaId,
    grass.logicalCellIndexToCellIndex,
  );
  const flowerTargets = createFlowerTargets(createSeededRandom(seed ^ 0x243f6a88), resolvedArenaId);
  const flowerVisuals = createFlowerVisuals(flowerTargets, createSeededRandom(seed ^ 0xb7e15162));
  const denseWeedTargets = createDenseWeedTargets(createSeededRandom(seed ^ 0x13198a2e));
  const denseWeedVisuals = createDenseWeedVisuals(
    denseWeedTargets,
    createSeededRandom(seed ^ 0x03707344),
  );
  const shrubTargets = createShrubTargets(createSeededRandom(seed ^ 0x452821e6));
  const shrubVisuals = createShrubVisuals(shrubTargets, createSeededRandom(seed ^ 0x38d01377));
  const saplingTargets = createSaplingTargets(createSeededRandom(seed ^ 0xa4093822));
  const saplingVisuals = createSaplingVisuals(
    saplingTargets,
    createSeededRandom(seed ^ 0x299f31d0),
  );
  const matureTreeTargets = createMatureTreeTargets();
  const matureTreeVisuals = createMatureTreeVisuals();
  const rockTargets = createRockTargets();
  const rockVisuals = createRockVisuals(createSeededRandom(seed ^ 0x082efa98));

  return {
    arenaId: resolvedArenaId,
    arenaShape,
    grassCells: grass.cells,
    grassVisuals,
    flowerTargets,
    flowerVisuals,
    denseWeedTargets,
    denseWeedVisuals,
    shrubTargets,
    shrubVisuals,
    saplingTargets,
    saplingVisuals,
    matureTreeTargets,
    matureTreeVisuals,
    rockTargets,
    rockVisuals,
    boundaryMarkers,
  };
}

export function createMeadowDensityReport(
  layout: MeadowLayout,
  grassBladesPerVisual = GRASS_BLADES_PER_VISUAL,
): MeadowDensityReport {
  const logicalCellArea = (GRASS_FIELD_SIZE / GRASS_LOGICAL_COLUMNS) ** 2;
  const visualCellArea = (GRASS_FIELD_SIZE / GRASS_VISUAL_COLUMNS) ** 2;
  const eligibleTerrainArea = layout.grassCells.length * logicalCellArea;
  const visibleGrassVisuals = countVisibleGrassVisuals(layout);
  const visibleGrassVisualArea = visibleGrassVisuals * visualCellArea;
  const grassCoverageFraction = eligibleTerrainArea === 0 ? 0 : 1;
  const decorativeGrassBladesPerWorldUnitSquared =
    visibleGrassVisualArea === 0
      ? 0
      : (visibleGrassVisuals * grassBladesPerVisual) / visibleGrassVisualArea;
  const flowerDriftArea = estimateFlowerDriftArea(layout.flowerTargets);
  const flowerDriftCoverageFraction =
    eligibleTerrainArea === 0 ? 0 : flowerDriftArea / eligibleTerrainArea;
  const flowerBlossomsPerDriftWorldUnitSquared = layout.flowerVisuals.length / flowerDriftArea;

  return {
    arenaShape: layout.arenaShape,
    eligibleTerrainArea: roundDensityMetric(eligibleTerrainArea),
    visibleGrassVisuals,
    grassBladesPerVisual,
    grassCoverageFraction: roundDensityMetric(grassCoverageFraction),
    decorativeGrassBladesPerWorldUnitSquared: roundDensityMetric(
      decorativeGrassBladesPerWorldUnitSquared,
    ),
    flowerDriftCoverageFraction: roundDensityMetric(flowerDriftCoverageFraction),
    flowerBlossomsPerDriftWorldUnitSquared: roundDensityMetric(
      flowerBlossomsPerDriftWorldUnitSquared,
    ),
    meetsDefaultGrassCoverage: grassCoverageFraction >= 0.85,
    meetsDefaultGrassDensity: decorativeGrassBladesPerWorldUnitSquared >= 90,
    meetsLowGrassDensity: decorativeGrassBladesPerWorldUnitSquared >= 45,
    meetsFlowerDriftCoverage:
      flowerDriftCoverageFraction >= 0.2 && flowerDriftCoverageFraction <= 0.3,
    meetsFlowerBlossomDensity:
      flowerBlossomsPerDriftWorldUnitSquared >= 2 && flowerBlossomsPerDriftWorldUnitSquared <= 4,
  };
}

function countVisibleGrassVisuals(layout: MeadowLayout): number {
  return layout.grassVisuals.filter((visual) => visual.height > 0 && visual.scaleX > 0).length;
}

function createGrassCells(arenaId: ArenaLayoutId): {
  cells: TargetSeed[];
  logicalCellIndexToCellIndex: Map<number, number>;
} {
  const cellSize = GRASS_FIELD_SIZE / GRASS_LOGICAL_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;
  const radius = cellSize * 0.54;
  const cells: TargetSeed[] = [];
  const logicalCellIndexToCellIndex = new Map<number, number>();

  for (let row = 0; row < GRASS_LOGICAL_COLUMNS; row += 1) {
    for (let column = 0; column < GRASS_LOGICAL_COLUMNS; column += 1) {
      const index = row * GRASS_LOGICAL_COLUMNS + column;
      const x = -halfField + (column + 0.5) * cellSize;
      const z = -halfField + (row + 0.5) * cellSize;
      if (!isPointInArenaGrowth(arenaId, x, z)) {
        continue;
      }
      logicalCellIndexToCellIndex.set(index, cells.length);
      cells.push({
        id: `grass-${index}`,
        kind: "grass",
        x,
        z,
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

  return { cells, logicalCellIndexToCellIndex };
}

function createGrassVisuals(
  random: () => number,
  arenaId: ArenaLayoutId,
  logicalCellIndexToCellIndex: Map<number, number>,
): GrassVisual[] {
  const visualCellSize = GRASS_FIELD_SIZE / GRASS_VISUAL_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;
  const jitter = visualCellSize * 0.42;
  const visuals: GrassVisual[] = [];

  for (let row = 0; row < GRASS_VISUAL_COLUMNS; row += 1) {
    for (let column = 0; column < GRASS_VISUAL_COLUMNS; column += 1) {
      const logicalRow = Math.floor(row / 4);
      const logicalColumn = Math.floor(column / 4);
      const logicalIndex = logicalRow * GRASS_LOGICAL_COLUMNS + logicalColumn;
      const cellIndex = logicalCellIndexToCellIndex.get(logicalIndex);
      const x = -halfField + (column + 0.5) * visualCellSize + randomRange(random, -jitter, jitter);
      const z = -halfField + (row + 0.5) * visualCellSize + randomRange(random, -jitter, jitter);
      const visible = cellIndex !== undefined && isPointInArenaGrowth(arenaId, x, z);
      visuals.push({
        x,
        z,
        height: visible ? 0.68 + random() * 0.72 : 0,
        rotation: random() * TAU,
        scaleX: visible ? 0.82 + random() * 0.62 : 0,
        scaleZ: visible ? 0.82 + random() * 0.62 : 0,
        cellIndex: cellIndex ?? -1,
        colorIndex: Math.floor(random() * GRASS_COLOR_COUNT),
      });
    }
  }

  return visuals;
}

function createFlowerTargets(random: () => number, arenaId: ArenaLayoutId): TargetSeed[] {
  const centers = createFlowerClusterCenters(random, arenaId);
  const clusterRadius = 4.1;
  const targets: TargetSeed[] = [];

  for (let clusterIndex = 0; clusterIndex < FLOWER_CLUSTER_COUNT; clusterIndex += 1) {
    const center = centers[clusterIndex];
    if (center === undefined) {
      continue;
    }
    const [centerX, centerZ] = center;

    for (let subIndex = 0; subIndex < FLOWER_TARGETS_PER_CLUSTER; subIndex += 1) {
      const angle = (subIndex / FLOWER_TARGETS_PER_CLUSTER) * TAU + randomRange(random, -0.3, 0.3);
      const distance = subIndex === 0 ? random() * 0.3 : Math.sqrt(random()) * clusterRadius * 0.9;
      targets.push({
        id: `flower-${clusterIndex}-${subIndex}`,
        kind: "flower",
        x: centerX + Math.cos(angle) * distance,
        z: centerZ + Math.sin(angle) * distance,
        radius: FLOWER_CONTACT_RADIUS + random() * 0.03,
        solidRadius: 0,
        recommendedLevel: 1,
        requiredWork: 4,
        resistance: 0.08,
        yield: 1,
        xp: 3,
      });
    }
  }

  return targets;
}

function createArenaBoundaryMarkers(arenaId: ArenaLayoutId): ArenaBoundaryMarker[] {
  const cellSize = GRASS_FIELD_SIZE / GRASS_LOGICAL_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;
  const markers: ArenaBoundaryMarker[] = [];
  const directions = [
    { columnOffset: 1, rowOffset: 0, xOffset: 0.5, zOffset: 0, rotation: 0 },
    { columnOffset: -1, rowOffset: 0, xOffset: -0.5, zOffset: 0, rotation: Math.PI },
    { columnOffset: 0, rowOffset: 1, xOffset: 0, zOffset: 0.5, rotation: Math.PI / 2 },
    { columnOffset: 0, rowOffset: -1, xOffset: 0, zOffset: -0.5, rotation: -Math.PI / 2 },
  ] as const;

  for (let row = 0; row < GRASS_LOGICAL_COLUMNS; row += 1) {
    for (let column = 0; column < GRASS_LOGICAL_COLUMNS; column += 1) {
      const x = -halfField + (column + 0.5) * cellSize;
      const z = -halfField + (row + 0.5) * cellSize;
      if (!isPointInArenaGrowth(arenaId, x, z)) {
        continue;
      }

      for (const [directionIndex, direction] of directions.entries()) {
        const neighborColumn = column + direction.columnOffset;
        const neighborRow = row + direction.rowOffset;
        const neighborX = -halfField + (neighborColumn + 0.5) * cellSize;
        const neighborZ = -halfField + (neighborRow + 0.5) * cellSize;
        const neighborInside =
          neighborColumn >= 0 &&
          neighborColumn < GRASS_LOGICAL_COLUMNS &&
          neighborRow >= 0 &&
          neighborRow < GRASS_LOGICAL_COLUMNS &&
          isPointInArenaGrowth(arenaId, neighborX, neighborZ);
        if (neighborInside) {
          continue;
        }

        const markerKey = row * 97 + column * 53 + directionIndex * 19;
        if (markerKey % 3 === 0) {
          continue;
        }
        const alongJitter = (((markerKey * 17) % 11) - 5) * cellSize * 0.035;
        const normalJitter = (((markerKey * 23) % 7) - 3) * cellSize * 0.025;
        const tangentX = direction.rowOffset;
        const tangentZ = direction.columnOffset;
        markers.push({
          x:
            x +
            direction.xOffset * cellSize +
            tangentX * alongJitter +
            direction.columnOffset * normalJitter,
          z:
            z +
            direction.zOffset * cellSize +
            tangentZ * alongJitter +
            direction.rowOffset * normalJitter,
          rotation: direction.rotation + (((markerKey * 29) % 17) - 8) * 0.035,
          scale: 0.72 + (markerKey % 5) * 0.07,
          colorIndex: markerKey % 4,
        });
      }
    }
  }

  return markers;
}

function resolveArenaLayoutId(arenaId: string): ArenaLayoutId {
  switch (arenaId) {
    case "flower-sweep":
    case "woodland-cleanup":
    case "timber-trail":
    case "rock-garden":
    case "timed-harvest":
    case "field-sprint":
    case "weed-rush":
    case "clear-every-patch":
      return arenaId;
    default:
      return "meadow-delivery";
  }
}

function resolveArenaShape(arenaId: ArenaLayoutId): ArenaShape {
  switch (arenaId) {
    case "flower-sweep":
      return "branching-flower-corridors";
    case "woodland-cleanup":
      return "woodland-clearings";
    case "timber-trail":
      return "timber-groves";
    case "rock-garden":
      return "rock-slalom";
    case "timed-harvest":
      return "timed-loop";
    case "field-sprint":
      return "sprint-lanes";
    case "weed-rush":
      return "weed-switchbacks";
    case "clear-every-patch":
      return "split-clearings";
    case "meadow-delivery":
      return "starter-meadow-paths";
  }
}

function createFlowerClusterCenters(
  random: () => number,
  arenaId: ArenaLayoutId,
): Array<readonly [number, number]> {
  if (arenaId === "flower-sweep") {
    return jitterAnchors(
      [
        [0, -15],
        [0, -10],
        [0, -5],
        [0, 0],
        [0, 5],
        [0, 10],
        [0, 15],
        [-5, 6],
        [-10, 6],
        [-15, 6],
        [5, -6],
        [10, -6],
        [15, -6],
        [-7, -12],
        [7, 12],
        [0, 17],
      ],
      random,
      0.7,
    );
  }

  if (arenaId === "woodland-cleanup") {
    return jitterAnchors(
      [
        [-9, -11],
        [-5, -8],
        [0, -4],
        [5, -7],
        [9, -10],
        [-10, 4],
        [-6, 7],
        [0, 4],
        [6, 8],
        [10, 5],
        [-3, 13],
        [3, 13],
        [-14, -2],
        [14, 0],
        [-1, 0],
        [1, 9],
      ],
      random,
      0.85,
    );
  }

  if (arenaId === "timed-harvest") {
    return jitterAnchors(
      [
        [0, -12],
        [4, -10],
        [8, -6],
        [10, 0],
        [7, 6],
        [1, 9],
        [-5, 8],
        [-10, 4],
        [-11, -2],
        [-7, -8],
        [-2, -11],
        [0, 0],
        [5, 1],
        [-5, 0],
        [2, 6],
        [-2, -6],
      ],
      random,
      0.65,
    );
  }

  if (arenaId === "timber-trail") {
    return jitterAnchors(
      [
        [-12, -13],
        [-8, -9],
        [-3, -4],
        [2, -2],
        [7, -6],
        [12, -9],
        [14, -3],
        [9, 4],
        [4, 8],
        [1, 12],
        [-5, 10],
        [-10, 7],
        [-14, 2],
        [-8, -1],
        [6, 1],
        [0, 0],
      ],
      random,
      0.72,
    );
  }

  if (arenaId === "rock-garden") {
    return jitterAnchors(
      [
        [-16, -6],
        [-12, -2],
        [-7, 2],
        [-2, 3],
        [4, 0],
        [9, -4],
        [14, -1],
        [-14, 11],
        [-8, 9],
        [-3, 7],
        [4, 8],
        [11, 6],
        [14, -12],
        [7, -10],
        [1, -8],
        [-8, -8],
      ],
      random,
      0.62,
    );
  }

  if (arenaId === "field-sprint") {
    return jitterAnchors(
      [
        [-13, -14],
        [-8, -11],
        [-3, -8],
        [2, -5],
        [7, -2],
        [12, 1],
        [7, 5],
        [2, 8],
        [-3, 11],
        [-8, 14],
        [0, 0],
        [-11, 2],
        [11, -6],
        [-5, 4],
        [5, 12],
        [0, 16],
      ],
      random,
      0.55,
    );
  }

  if (arenaId === "weed-rush") {
    return jitterAnchors(
      [
        [-13, -13],
        [-8, -11],
        [-3, -8],
        [3, -5],
        [9, -3],
        [14, 0],
        [8, 3],
        [2, 6],
        [-4, 8],
        [-11, 11],
        [-6, 14],
        [0, 15],
        [6, 12],
        [11, 8],
        [4, 1],
        [-5, -1],
      ],
      random,
      0.58,
    );
  }

  if (arenaId === "clear-every-patch") {
    return jitterAnchors(
      [
        [-11, -13],
        [-5, -12],
        [3, -12],
        [10, -10],
        [7, -4],
        [0, -3],
        [-8, -1],
        [-14, 4],
        [-8, 8],
        [0, 8],
        [9, 6],
        [14, 2],
        [8, 13],
        [0, 15],
        [-7, 14],
        [-13, 11],
      ],
      random,
      0.62,
    );
  }

  if (arenaId === "meadow-delivery") {
    return jitterAnchors(
      [
        [0, -15],
        [-6, -13],
        [6, -12],
        [0, -8],
        [-10, -4],
        [10, -4],
        [0, 0],
        [-13, 4],
        [13, 4],
        [-7, 8],
        [7, 8],
        [0, 12],
        [-12, 14],
        [12, 14],
        [-3, 17],
        [3, 17],
      ],
      random,
      0.5,
    );
  }

  const usableFieldSize = 34;
  const clusterCellSize = usableFieldSize / FLOWER_CLUSTER_COLUMNS;
  const halfUsableField = usableFieldSize / 2;
  const jitter = clusterCellSize * 0.24;
  const centers: Array<readonly [number, number]> = [];

  for (let clusterIndex = 0; clusterIndex < FLOWER_CLUSTER_COUNT; clusterIndex += 1) {
    const column = clusterIndex % FLOWER_CLUSTER_COLUMNS;
    const row = Math.floor(clusterIndex / FLOWER_CLUSTER_COLUMNS);
    centers.push([
      -halfUsableField + (column + 0.5) * clusterCellSize + randomRange(random, -jitter, jitter),
      -halfUsableField + (row + 0.5) * clusterCellSize + randomRange(random, -jitter, jitter),
    ]);
  }

  return centers;
}

function jitterAnchors(
  anchors: ReadonlyArray<readonly [number, number]>,
  random: () => number,
  amount: number,
): Array<readonly [number, number]> {
  return anchors.map(([x, z]) => [
    x + randomRange(random, -amount, amount),
    z + randomRange(random, -amount, amount),
  ]);
}

export function isPointInArenaGrowth(arenaId: ArenaLayoutId, x: number, z: number): boolean {
  switch (arenaId) {
    case "flower-sweep":
      return (
        (isPointInCapsule(x, z, 0, -18, 0, 18, 2.85) ||
          isPointInCapsule(x, z, -18, 6, 1, 6, 2.65) ||
          isPointInCapsule(x, z, -1, -6, 18, -6, 2.65) ||
          isPointInCapsule(x, z, -9, -14, 3, -5, 2.25) ||
          isPointInCapsule(x, z, 2, 4, 12, 15, 2.15) ||
          isPointInCircle(x, z, -15, 6, 4.4) ||
          isPointInCircle(x, z, 15, -6, 4.4) ||
          isPointInCircle(x, z, 0, 0, 4.8)) &&
        !isPointInCircle(x, z, -8, -2, 2.7) &&
        !isPointInCircle(x, z, 8, 2, 2.6)
      );
    case "woodland-cleanup":
      return (
        (isPointInCircle(x, z, -10, -11, 5.3) ||
          isPointInCircle(x, z, 8, -10, 5.0) ||
          isPointInCircle(x, z, -10, 7, 5.0) ||
          isPointInCircle(x, z, 8, 8, 5.5) ||
          isPointInCircle(x, z, 0, 0, 5.7) ||
          isPointInCircle(x, z, -1, 14, 3.9) ||
          isPointInCapsule(x, z, -10, -11, 0, 0, 2.35) ||
          isPointInCapsule(x, z, 8, -10, 0, 0, 2.35) ||
          isPointInCapsule(x, z, -10, 7, 0, 0, 2.35) ||
          isPointInCapsule(x, z, 8, 8, 0, 0, 2.35) ||
          isPointInCapsule(x, z, 0, 0, -1, 14, 2.05)) &&
        !isPointInCapsule(x, z, -17, -1, 17, 2, 1.65)
      );
    case "timber-trail":
      return (
        (isPointInCircle(x, z, 0, 0, 4.6) ||
          isPointInCircle(x, z, -8.5, -7, 4.2) ||
          isPointInCircle(x, z, 8.5, -6.5, 4.2) ||
          isPointInCircle(x, z, -7.5, 8.5, 4.0) ||
          isPointInCircle(x, z, 8, 9, 4.2) ||
          isPointInCircle(x, z, 1.5, 11.5, 3.8) ||
          isPointInCircle(x, z, -16, -15, 4.4) ||
          isPointInCircle(x, z, 17, -10, 4.2) ||
          isPointInCircle(x, z, -10, 17, 4.2) ||
          isPointInCircle(x, z, 7, 18, 3.8) ||
          isPointInCircle(x, z, 17, 13, 3.8) ||
          isPointInCapsule(x, z, 0, 0, -8.5, -7, 2.3) ||
          isPointInCapsule(x, z, -8.5, -7, -16, -15, 2.35) ||
          isPointInCapsule(x, z, 0, 0, 8.5, -6.5, 2.3) ||
          isPointInCapsule(x, z, 8.5, -6.5, 17, -10, 2.35) ||
          isPointInCapsule(x, z, 0, 0, -7.5, 8.5, 2.25) ||
          isPointInCapsule(x, z, -7.5, 8.5, -10, 17, 2.3) ||
          isPointInCapsule(x, z, 0, 0, 8, 9, 2.25) ||
          isPointInCapsule(x, z, 8, 9, 7, 18, 2.25) ||
          isPointInCapsule(x, z, 8, 9, 17, 13, 2.15) ||
          isPointInCapsule(x, z, -8.5, -7, 8.5, -6.5, 2.1) ||
          isPointInCapsule(x, z, -7.5, 8.5, 8, 9, 2.05)) &&
        !isPointInCircle(x, z, -2.8, 4.2, 1.95) &&
        !isPointInCircle(x, z, 4.2, 3.6, 1.8) &&
        !isPointInCircle(x, z, -12, -2, 1.9)
      );
    case "rock-garden":
      return (
        (isPointInCapsule(x, z, -18, -6, -10, -2, 2.75) ||
          isPointInCapsule(x, z, -10, -2, 0, 3, 2.75) ||
          isPointInCapsule(x, z, 0, 3, 10, -4, 2.65) ||
          isPointInCapsule(x, z, 10, -4, 18, 0, 2.55) ||
          isPointInCapsule(x, z, -14, 13, 0, 3, 2.45) ||
          isPointInCapsule(x, z, 0, 3, 13, 7, 2.4) ||
          isPointInCapsule(x, z, 14, -13, 0, 3, 2.45) ||
          isPointInCapsule(x, z, -18, -6, 4, -13, 2.25) ||
          isPointInCircle(x, z, -16, -6, 3.9) ||
          isPointInCircle(x, z, -14, 13, 3.8) ||
          isPointInCircle(x, z, 14, -13, 3.7) ||
          isPointInCircle(x, z, 0, 3, 4.4) ||
          isPointInCircle(x, z, 13, 7, 3.7)) &&
        !isPointInCircle(x, z, -14.5, -2.5, 1.85) &&
        !isPointInCircle(x, z, 13.7, 3.4, 1.75) &&
        !isPointInCircle(x, z, -14.2, 12.8, 1.9) &&
        !isPointInCircle(x, z, 14.5, -13.3, 1.85) &&
        !isPointInCircle(x, z, 4.1, -12.7, 1.7)
      );
    case "timed-harvest":
      return (
        (isPointInCapsule(x, z, 0, -14, 10, -4, 2.65) ||
          isPointInCapsule(x, z, 10, -4, 6, 8, 2.65) ||
          isPointInCapsule(x, z, 6, 8, -7, 8, 2.65) ||
          isPointInCapsule(x, z, -7, 8, -12, -4, 2.65) ||
          isPointInCapsule(x, z, -12, -4, 0, -14, 2.65) ||
          isPointInCapsule(x, z, -6, 0, 6, 0, 2.05) ||
          isPointInCircle(x, z, 0, 0, 3.6)) &&
        !isPointInCircle(x, z, 0, -4, 2.35) &&
        !isPointInCircle(x, z, 0, 11, 2.1)
      );
    case "field-sprint":
      return (
        (isPointInCapsule(x, z, -15, -15, 13, 2, 2.55) ||
          isPointInCapsule(x, z, 13, 2, -9, 15, 2.55) ||
          isPointInCapsule(x, z, -9, 15, 0, 18, 2.1) ||
          isPointInCapsule(x, z, -13, 1, 11, -7, 2.15) ||
          isPointInCircle(x, z, -15, -15, 3.8) ||
          isPointInCircle(x, z, 13, 2, 3.7) ||
          isPointInCircle(x, z, -9, 15, 3.5) ||
          isPointInCircle(x, z, 0, 0, 3.7)) &&
        !isPointInCircle(x, z, -2, -2, 1.9) &&
        !isPointInCircle(x, z, 5, 7, 2.0)
      );
    case "weed-rush":
      return (
        (isPointInCapsule(x, z, -15, -14, 14, 0, 2.55) ||
          isPointInCapsule(x, z, 14, 0, -12, 12, 2.55) ||
          isPointInCapsule(x, z, -12, 12, 8, 14, 2.3) ||
          isPointInCapsule(x, z, -6, -2, 10, 8, 2.1) ||
          isPointInCircle(x, z, -15, -14, 3.9) ||
          isPointInCircle(x, z, 14, 0, 4.0) ||
          isPointInCircle(x, z, -12, 12, 3.8) ||
          isPointInCircle(x, z, 8, 14, 3.5) ||
          isPointInCircle(x, z, 0, 0, 3.9)) &&
        !isPointInCircle(x, z, -1, -6, 2.05) &&
        !isPointInCircle(x, z, 6, 5, 2.0) &&
        !isPointInCircle(x, z, -8, 5, 1.8)
      );
    case "clear-every-patch":
      return (
        (isPointInCircle(x, z, -12, -12, 5.4) ||
          isPointInCircle(x, z, 6, -12, 5.2) ||
          isPointInCircle(x, z, 0, -2, 6.0) ||
          isPointInCircle(x, z, -13, 6, 5.3) ||
          isPointInCircle(x, z, 12, 5, 5.3) ||
          isPointInCircle(x, z, 0, 14, 5.4) ||
          isPointInCapsule(x, z, -12, -12, 0, -2, 3.2) ||
          isPointInCapsule(x, z, 6, -12, 0, -2, 3.0) ||
          isPointInCapsule(x, z, 0, -2, -13, 6, 3.05) ||
          isPointInCapsule(x, z, 0, -2, 12, 5, 3.05) ||
          isPointInCapsule(x, z, -13, 6, 0, 14, 2.75) ||
          isPointInCapsule(x, z, 12, 5, 0, 14, 2.75) ||
          isPointInCapsule(x, z, -15, 2, 15, 2, 2.2)) &&
        !isPointInCircle(x, z, -4, 5, 2.3) &&
        !isPointInCircle(x, z, 5, 10, 2.15) &&
        !isPointInCircle(x, z, 6, -3, 1.9)
      );
    case "meadow-delivery":
      return (
        (isPointInCapsule(x, z, 0, -18, 0, 18, 5.85) ||
          isPointInCapsule(x, z, -16, -5, 16, -5, 4.75) ||
          isPointInCapsule(x, z, -18, 8, 17, 8, 4.8) ||
          isPointInCapsule(x, z, -13, 15, 13, 15, 3.65) ||
          isPointInCapsule(x, z, -16, -14, -3, -2, 3.0) ||
          isPointInCapsule(x, z, 14, -1, 3, 12, 3.0) ||
          isPointInCircle(x, z, 0, 0, 6.8) ||
          isPointInCircle(x, z, -15, -5, 5.1) ||
          isPointInCircle(x, z, 15, -5, 5.1) ||
          isPointInCircle(x, z, -16, 8, 5.2) ||
          isPointInCircle(x, z, 16, 8, 5.2)) &&
        !isPointInCircle(x, z, -9, 1, 2.35) &&
        !isPointInCircle(x, z, 9, 2, 2.35) &&
        !isPointInCircle(x, z, 0, -11, 2.05)
      );
  }
}

function isPointInCircle(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  radius: number,
): boolean {
  return distanceSquared(x, z, centerX, centerZ) <= radius ** 2;
}

function isPointInCapsule(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  radius: number,
): boolean {
  const abX = bx - ax;
  const abZ = bz - az;
  const abLengthSquared = abX * abX + abZ * abZ;
  if (abLengthSquared === 0) {
    return isPointInCircle(x, z, ax, az, radius);
  }
  const projection = ((x - ax) * abX + (z - az) * abZ) / abLengthSquared;
  const clampedProjection = Math.min(1, Math.max(0, projection));
  const closestX = ax + abX * clampedProjection;
  const closestZ = az + abZ * clampedProjection;
  return distanceSquared(x, z, closestX, closestZ) <= radius ** 2;
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
    const distance = Math.sqrt(random()) * FLOWER_VISUAL_SPREAD_RADIUS;
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

function createShrubTargets(random: () => number): TargetSeed[] {
  return SHRUB_PLACEMENT_ANCHORS.map(([anchorX, anchorZ], index) => {
    const size = 0.84 + random() * 0.24;
    const solidRadius = size * 0.54;
    return {
      id: `shrub-${index}`,
      kind: "shrub",
      x: anchorX + randomRange(random, -0.55, 0.55),
      z: anchorZ + randomRange(random, -0.55, 0.55),
      radius: size * 0.96,
      solidRadius,
      recommendedLevel: 3,
      requiredWork: 30,
      resistance: 0.55,
      yield: 2,
      xp: 14,
    };
  });
}

function createShrubVisuals(targets: TargetSeed[], random: () => number): ShrubVisual[] {
  return targets.map((target, targetIndex) => ({
    x: target.x,
    z: target.z,
    size: target.radius,
    rotation: random() * TAU,
    targetIndex,
    colorIndex: Math.floor(random() * SHRUB_COLOR_COUNT),
  }));
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

function createRockTargets(): TargetSeed[] {
  return ROCK_PLACEMENTS.map(([x, z, size], index) => ({
    id: `rock-${index}`,
    kind: "rock",
    x,
    z,
    radius: size * 0.62,
    solidRadius: size * 0.62,
    recommendedLevel: Number.POSITIVE_INFINITY,
    requiredWork: 0,
    resistance: 1.2,
    yield: 0,
    xp: 0,
  }));
}

function createRockVisuals(random: () => number): RockVisual[] {
  return ROCK_PLACEMENTS.map(([x, z, size], targetIndex) => ({
    x,
    z,
    size,
    rotation: random() * TAU,
    targetIndex,
  }));
}

function estimateFlowerDriftArea(targets: TargetSeed[]): number {
  const sampleColumns = 192;
  const cellSize = GRASS_FIELD_SIZE / sampleColumns;
  const halfField = GRASS_FIELD_SIZE / 2;
  let coveredSamples = 0;

  for (let row = 0; row < sampleColumns; row += 1) {
    const z = -halfField + (row + 0.5) * cellSize;
    for (let column = 0; column < sampleColumns; column += 1) {
      const x = -halfField + (column + 0.5) * cellSize;
      if (
        targets.some(
          (target) => distanceSquared(x, z, target.x, target.z) <= FLOWER_VISUAL_SPREAD_RADIUS ** 2,
        )
      ) {
        coveredSamples += 1;
      }
    }
  }

  return (coveredSamples / (sampleColumns * sampleColumns)) * GRASS_FIELD_SIZE * GRASS_FIELD_SIZE;
}

function distanceSquared(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function roundDensityMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
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
