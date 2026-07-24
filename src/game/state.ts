import {
  FLOWER_TARGET_COUNT,
  GRASS_FIELD_SIZE,
  GRASS_VISUAL_COLUMNS,
  createMeadowLayout,
  type GrassVisual,
  type MeadowLayout,
  type TargetSeed,
} from "./world";

export const MEADOW_SEED = 0x6a09e667;
export const FIXED_TIME_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_DELTA_SECONDS = 1 / 20;
export const WORLD_HALF_EXTENT = 22;
export const PLAYER_RADIUS = 2.15;
export const PLAYER_HUB_RADIUS = 0.82;
export const MAX_MOVE_SPEED = 7.5;

const MOVE_ACCELERATION = 20;
const MOVE_BRAKING = 26;
const MIN_CUTTING_RPM = 180;
const LOAD_APPROACH_RATE = 5;
const RECOVERY_APPROACH_RATE = 3;
const BASE_WORK_RATE = 12;
const MAX_BLADE_LEVEL = 8;
const COLLISION_TIME_EPSILON = 1e-6;
const GRASS_VISUAL_JITTER_RATIO = 0.42;
const TARGET_SPATIAL_CELL_SIZE = 4;
const TAU = Math.PI * 2;
export const CUMULATIVE_XP_THRESHOLDS = [20, 55, 110, 190, 300, 450, 650] as const;

export interface MovementInput {
  left: boolean;
  right: boolean;
  forward: boolean;
  backward: boolean;
}

export interface ObjectiveCounter {
  status: "active" | "complete" | "planned";
  collected: number;
  target: number;
}

export interface ObjectivesState {
  status: "active" | "complete";
  grass: ObjectiveCounter;
  flowers: ObjectiveCounter;
  fiber: ObjectiveCounter;
  wood: ObjectiveCounter;
}

export interface ContractDefinition {
  id:
    | "meadow-delivery"
    | "flower-sweep"
    | "woodland-cleanup"
    | "timber-trail"
    | "rock-garden"
    | "hedge-maze"
    | "timed-harvest"
    | "field-sprint"
    | "weed-rush"
    | "reed-run"
    | "clover-circuit"
    | "orchard-loop"
    | "brook-bend"
    | "harvest-spiral"
    | "crescent-grove"
    | "forked-thicket"
    | "switchback-orchard"
    | "braided-meadow"
    | "ring-grove"
    | "twin-glade"
    | "frost-ribbons"
    | "prism-prairie"
    | "stone-bloom"
    | "willow-weave"
    | "petal-gate"
    | "sunset-switchback"
    | "cedar-crossroads"
    | "lagoon-braid"
    | "wildflower-narrows"
    | "clear-every-patch";
  title: string;
  summary: string;
  benchmarkSeconds: number;
  timeLimitSeconds?: number;
  completionMode?: "quota" | "clear-patches";
  objectives: {
    grass: number;
    flowers: number;
    fiber: number;
    wood: number;
  };
}

export interface ContractState {
  id: ContractDefinition["id"];
  title: string;
  summary: string;
  timeLimitSeconds: number | null;
  completionMode: "quota" | "clear-patches";
}

export const DEFAULT_CONTRACT_ID: ContractDefinition["id"] = "meadow-delivery";

export const CONTRACT_DEFINITIONS = [
  {
    id: "meadow-delivery",
    title: "Meadow Delivery",
    summary: "Clear a balanced starter meadow contract.",
    benchmarkSeconds: 25.867,
    objectives: { grass: 50, flowers: 10, fiber: 6, wood: 6 },
  },
  {
    id: "flower-sweep",
    title: "Flower Sweep",
    summary: "Harvest every flower drift instead of just clipping the patch edges.",
    benchmarkSeconds: 51.25,
    objectives: { grass: 34, flowers: FLOWER_TARGET_COUNT, fiber: 4, wood: 4 },
  },
  {
    id: "woodland-cleanup",
    title: "Woodland Cleanup",
    summary: "Focus on weeds and saplings for a heavier Fiber and Wood delivery.",
    benchmarkSeconds: 33.067,
    objectives: { grass: 30, flowers: 6, fiber: 8, wood: 8 },
  },
  {
    id: "timber-trail",
    title: "Timber Trail",
    summary: "A 90-second wood route that grows into mature-tree cutting.",
    benchmarkSeconds: 79.767,
    timeLimitSeconds: 90,
    objectives: { grass: 250, flowers: 260, fiber: 28, wood: 28 },
  },
  {
    id: "rock-garden",
    title: "Rock Garden",
    summary: "A 70-second obstacle slalom around visible stones and mixed harvest pockets.",
    benchmarkSeconds: 57.433,
    timeLimitSeconds: 70,
    objectives: { grass: 190, flowers: 220, fiber: 16, wood: 10 },
  },
  {
    id: "hedge-maze",
    title: "Hedge Maze",
    summary: "An 80-second shrub maze that turns durable hedges into the Fiber objective.",
    benchmarkSeconds: 61.7,
    timeLimitSeconds: 80,
    objectives: { grass: 183, flowers: 300, fiber: 28, wood: 0 },
  },
  {
    id: "timed-harvest",
    title: "Timed Harvest",
    summary: "A 60-second grass, flower, and fiber endurance route with no room to wander.",
    benchmarkSeconds: 56.7,
    timeLimitSeconds: 60,
    objectives: { grass: 170, flowers: 300, fiber: 18, wood: 0 },
  },
  {
    id: "field-sprint",
    title: "Field Sprint",
    summary: "A 45-second flower-lane sprint with only soft targets.",
    benchmarkSeconds: 43.233,
    timeLimitSeconds: 45,
    objectives: { grass: 175, flowers: 230, fiber: 0, wood: 0 },
  },
  {
    id: "weed-rush",
    title: "Weed Rush",
    summary: "A 55-second switchback route that mixes soft cuts with dense Fiber weeds.",
    benchmarkSeconds: 47.917,
    timeLimitSeconds: 55,
    objectives: { grass: 150, flowers: 220, fiber: 18, wood: 0 },
  },
  {
    id: "reed-run",
    title: "Reed Run",
    summary: "A 60-second golden-reed route that turns every Fiber Reed into the quota path.",
    benchmarkSeconds: 51.85,
    timeLimitSeconds: 60,
    objectives: { grass: 205, flowers: 270, fiber: 10, wood: 0 },
  },
  {
    id: "clover-circuit",
    title: "Clover Circuit",
    summary: "A 75-second figure-eight route around dense flower and Fiber pockets.",
    benchmarkSeconds: 66.433,
    timeLimitSeconds: 75,
    objectives: { grass: 240, flowers: 320, fiber: 28, wood: 0 },
  },
  {
    id: "orchard-loop",
    title: "Orchard Loop",
    summary: "An 85-second wood loop through saplings, trees, and flower pockets.",
    benchmarkSeconds: 72.3,
    timeLimitSeconds: 85,
    objectives: { grass: 240, flowers: 260, fiber: 20, wood: 22 },
  },
  {
    id: "brook-bend",
    title: "Brook Bend",
    summary: "A 60-second S-bend route through flower banks and Fiber weeds.",
    benchmarkSeconds: 55.65,
    timeLimitSeconds: 60,
    objectives: { grass: 200, flowers: 250, fiber: 24, wood: 0 },
  },
  {
    id: "harvest-spiral",
    title: "Harvest Spiral",
    summary: "An 80-second spiral route that tightens from soft sweeps into timber cuts.",
    benchmarkSeconds: 74.1,
    timeLimitSeconds: 80,
    objectives: { grass: 240, flowers: 260, fiber: 24, wood: 22 },
  },
  {
    id: "crescent-grove",
    title: "Crescent Grove",
    summary: "A 75-second crescent route that bends through flower banks and timber pockets.",
    benchmarkSeconds: 65.967,
    timeLimitSeconds: 75,
    objectives: { grass: 220, flowers: 240, fiber: 20, wood: 16 },
  },
  {
    id: "forked-thicket",
    title: "Forked Thicket",
    summary: "An 85-second three-way branch route through tangled flowers, shrubs, and timber.",
    benchmarkSeconds: 77.117,
    timeLimitSeconds: 85,
    objectives: { grass: 260, flowers: 280, fiber: 24, wood: 22 },
  },
  {
    id: "switchback-orchard",
    title: "Switchback Orchard",
    summary: "A 90-second zig-zag orchard route through flowers, Fiber, and timber.",
    benchmarkSeconds: 84.75,
    timeLimitSeconds: 90,
    objectives: { grass: 270, flowers: 300, fiber: 28, wood: 28 },
  },
  {
    id: "braided-meadow",
    title: "Braided Meadow",
    summary: "A 65-second braided route through interwoven flower lanes and Fiber hedges.",
    benchmarkSeconds: 60.35,
    timeLimitSeconds: 65,
    objectives: { grass: 230, flowers: 300, fiber: 20, wood: 0 },
  },
  {
    id: "ring-grove",
    title: "Ring Grove",
    summary: "A 75-second loop around a bare center clearing and timber pockets.",
    benchmarkSeconds: 71.017,
    timeLimitSeconds: 75,
    objectives: { grass: 245, flowers: 260, fiber: 24, wood: 16 },
  },
  {
    id: "twin-glade",
    title: "Twin Glade",
    summary: "A 70-second route joining two flower-heavy glades through narrow lanes.",
    benchmarkSeconds: 65.233,
    timeLimitSeconds: 70,
    objectives: { grass: 230, flowers: 260, fiber: 20, wood: 10 },
  },
  {
    id: "frost-ribbons",
    title: "Frost Ribbons",
    summary: "A 65-second ribbon route through cool-white grass bands and flower lanes.",
    benchmarkSeconds: 56.95,
    timeLimitSeconds: 65,
    objectives: { grass: 220, flowers: 280, fiber: 18, wood: 0 },
  },
  {
    id: "prism-prairie",
    title: "Prism Prairie",
    summary: "A 70-second flower-prism route through crossing meadow facets.",
    benchmarkSeconds: 64.4,
    timeLimitSeconds: 70,
    objectives: { grass: 235, flowers: 320, fiber: 24, wood: 0 },
  },
  {
    id: "stone-bloom",
    title: "Stone Bloom",
    summary: "A 68-second rock-garden bloom route through visible stone chicanes.",
    benchmarkSeconds: 62.633,
    timeLimitSeconds: 68,
    objectives: { grass: 240, flowers: 300, fiber: 24, wood: 0 },
  },
  {
    id: "willow-weave",
    title: "Willow Weave",
    summary: "A 105-second woven grove route that mixes flower lanes, Fiber, and timber.",
    benchmarkSeconds: 78.617,
    timeLimitSeconds: 105,
    objectives: { grass: 250, flowers: 300, fiber: 24, wood: 22 },
  },
  {
    id: "petal-gate",
    title: "Petal Gate",
    summary: "An 88-second flower-gate route that clears every bloom and Fiber hedge.",
    benchmarkSeconds: 66.95,
    timeLimitSeconds: 88,
    objectives: { grass: 250, flowers: 320, fiber: 28, wood: 0 },
  },
  {
    id: "sunset-switchback",
    title: "Sunset Switchback",
    summary: "A 100-second diagonal route through sunset flower lanes and Fiber hedges.",
    benchmarkSeconds: 65.45,
    timeLimitSeconds: 100,
    objectives: { grass: 260, flowers: 300, fiber: 28, wood: 0 },
  },
  {
    id: "cedar-crossroads",
    title: "Cedar Crossroads",
    summary: "An 86-second four-way timber route through cedar lanes and flower crossings.",
    benchmarkSeconds: 75.117,
    timeLimitSeconds: 86,
    objectives: { grass: 260, flowers: 260, fiber: 24, wood: 22 },
  },
  {
    id: "lagoon-braid",
    title: "Lagoon Braid",
    summary: "A 70-second braided lagoon route through flower banks and Fiber hedges.",
    benchmarkSeconds: 62.633,
    timeLimitSeconds: 70,
    objectives: { grass: 240, flowers: 300, fiber: 24, wood: 0 },
  },
  {
    id: "wildflower-narrows",
    title: "Wildflower Narrows",
    summary: "A 66-second narrow bloom route through flower corridors and Fiber hedges.",
    benchmarkSeconds: 64.15,
    timeLimitSeconds: 66,
    objectives: { grass: 230, flowers: FLOWER_TARGET_COUNT, fiber: 24, wood: 0 },
  },
  {
    id: "clear-every-patch",
    title: "Clear Every Patch",
    summary: "Sweep the full starter meadow clean instead of stopping at delivery quotas.",
    benchmarkSeconds: 57.15,
    completionMode: "clear-patches",
    objectives: { grass: 0, flowers: 0, fiber: 0, wood: 0 },
  },
] as const satisfies readonly ContractDefinition[];

export interface InventoryState {
  grass: number;
  flowers: number;
  fiber: number;
  wood: number;
}

export type TargetStatus = "standing" | "cutting" | "cut";

export interface TargetState extends TargetSeed {
  status: TargetStatus;
  accumulatedWork: number;
}

interface TargetSpatialIndex {
  targets: TargetState[];
  targetCount: number;
  maxRadius: number;
  maxSolidRadius: number;
  positions: Float32Array;
  cells: Map<string, number[]>;
}

export type CuttableTargetKind = Exclude<TargetSeed["kind"], "rock">;

export interface CutCompletionEvent {
  revision: number;
  targetId: string;
  kind: CuttableTargetKind;
  x: number;
  z: number;
  yield: number;
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

export interface TooToughNotice {
  revision: number;
  targetId: string;
  kind: TargetSeed["kind"];
  x: number;
  z: number;
  recommendedLevel: number;
  currentLevel: number;
  issuedAtSeconds: number;
}

export interface PlayerState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  rpm: number;
  targetRpm: number;
  bladeAngleRadians: number;
  level: number;
}

export interface ContractResult {
  status: "complete" | "timed-out";
  completedAtSeconds: number;
  timeLimitSeconds: number | null;
  cutTargets: number;
  highestLevel: number;
  finalInventory: InventoryState;
  completionRevision: number;
}

export type GameMode = "active" | "paused" | "complete";

export interface GameState {
  mode: GameMode;
  seed: number;
  contract: ContractState;
  elapsedSeconds: number;
  player: PlayerState;
  inventory: InventoryState;
  objectives: ObjectivesState;
  result: ContractResult | null;
  xp: number;
  targets: TargetState[];
  targetSpatialIndex: TargetSpatialIndex;
  bladeContactTargetIds: string[];
  grassVisualPositions: Float32Array;
  grassVisualCutMask: Uint8Array;
  cutGrassVisualIndices: number[];
  cutEvents: CutCompletionEvent[];
  cutRevision: number;
  tooToughNotice: TooToughNotice | null;
  tooToughRevision: number;
  tooToughNoticeCooldowns: Record<string, number>;
}

export function createInitialState(
  seed = MEADOW_SEED,
  contractId: string | null = DEFAULT_CONTRACT_ID,
): GameState {
  const contract = resolveContractDefinition(contractId);
  const layout = createMeadowLayout(seed, contract.id);
  const objectives = createContractObjectives(contract, layout);
  const targetSeeds = [
    ...layout.grassCells,
    ...layout.flowerTargets,
    ...layout.softCropTargets,
    ...layout.denseWeedTargets,
    ...layout.fiberReedTargets,
    ...layout.shrubTargets,
    ...layout.saplingTargets,
    ...layout.matureTreeTargets,
    ...layout.rockTargets,
  ];
  const targets = targetSeeds.map(createTargetState);
  const grassVisualPositions = createGrassVisualPositions(layout.grassVisuals);

  return {
    mode: "active",
    seed,
    contract: {
      id: contract.id,
      title: contract.title,
      summary: contract.summary,
      timeLimitSeconds: contract.timeLimitSeconds ?? null,
      completionMode: contract.completionMode ?? "quota",
    },
    elapsedSeconds: 0,
    player: {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      radius: PLAYER_RADIUS,
      rpm: 720,
      targetRpm: 720,
      bladeAngleRadians: 0,
      level: 1,
    },
    inventory: {
      grass: 0,
      flowers: 0,
      fiber: 0,
      wood: 0,
    },
    objectives: {
      status: "active",
      grass: { status: "active", collected: 0, target: objectives.grass },
      flowers: { status: "active", collected: 0, target: objectives.flowers },
      fiber: { status: "active", collected: 0, target: objectives.fiber },
      wood: { status: "active", collected: 0, target: objectives.wood },
    },
    result: null,
    xp: 0,
    targets,
    targetSpatialIndex: createTargetSpatialIndex(targets),
    bladeContactTargetIds: [],
    grassVisualPositions,
    grassVisualCutMask: new Uint8Array(layout.grassVisuals.length),
    cutGrassVisualIndices: [],
    cutEvents: [],
    cutRevision: 0,
    tooToughNotice: null,
    tooToughRevision: 0,
    tooToughNoticeCooldowns: {},
  };
}

function createContractObjectives(
  contract: ContractDefinition,
  layout: MeadowLayout,
): ContractDefinition["objectives"] {
  if (contract.completionMode !== "clear-patches") {
    return contract.objectives;
  }

  return {
    grass: layout.grassCells.length,
    flowers:
      layout.flowerTargets.reduce((sum, target) => sum + target.yield, 0) +
      layout.softCropTargets.reduce((sum, target) => sum + target.yield, 0),
    fiber: 0,
    wood: 0,
  };
}

export function resolveContractDefinition(contractId: string | null): ContractDefinition {
  const normalizedId = contractId ?? DEFAULT_CONTRACT_ID;
  return (
    CONTRACT_DEFINITIONS.find((definition) => definition.id === normalizedId) ??
    CONTRACT_DEFINITIONS[0]
  );
}

export function stepState(state: GameState, input: MovementInput, deltaSeconds: number): GameState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return state;
  }

  const delta = Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS);
  if (state.mode !== "active") {
    return state;
  }
  state.elapsedSeconds += delta;
  const startX = state.player.x;
  const startZ = state.player.z;
  const screenX = Number(input.right) - Number(input.left);
  const screenY = Number(input.forward) - Number(input.backward);
  let inputX = (screenX - screenY) * Math.SQRT1_2;
  let inputZ = -(screenX + screenY) * Math.SQRT1_2;
  const inputLength = Math.hypot(inputX, inputZ);

  if (inputLength > 0) {
    inputX /= inputLength;
    inputZ /= inputLength;
    state.player.vx += inputX * MOVE_ACCELERATION * delta;
    state.player.vz += inputZ * MOVE_ACCELERATION * delta;
  } else {
    state.player.vx = moveTowardZero(state.player.vx, MOVE_BRAKING * delta);
    state.player.vz = moveTowardZero(state.player.vz, MOVE_BRAKING * delta);
  }

  const speed = Math.hypot(state.player.vx, state.player.vz);
  if (speed > MAX_MOVE_SPEED) {
    const scale = MAX_MOVE_SPEED / speed;
    state.player.vx *= scale;
    state.player.vz *= scale;
  }

  state.player.x += state.player.vx * delta;
  state.player.z += state.player.vz * delta;
  clampPlayerToWorld(state.player);
  const intendedX = state.player.x;
  const intendedZ = state.player.z;
  stepCutting(state, startX, startZ, intendedX, intendedZ, delta);
  resolveSolidMovement(state, startX, startZ, intendedX, intendedZ);
  updateContractTimeout(state);

  return state;
}

export function setPaused(state: GameState, paused: boolean): GameState {
  if (state.mode === "complete") {
    return state;
  }

  if (paused) {
    state.mode = "paused";
    state.player.vx = 0;
    state.player.vz = 0;
    state.bladeContactTargetIds.length = 0;
    state.tooToughNotice = null;
  } else {
    state.mode = "active";
  }

  return state;
}

function createGrassVisualPositions(visuals: GrassVisual[]): Float32Array {
  const positions = new Float32Array(visuals.length * 2);

  for (let index = 0; index < visuals.length; index += 1) {
    const visual = visuals[index];
    if (visual === undefined) {
      continue;
    }
    positions[index * 2] = visual.x;
    positions[index * 2 + 1] = visual.z;
  }

  return positions;
}

function createTargetState(seed: TargetSeed): TargetState {
  return {
    ...seed,
    status: "standing",
    accumulatedWork: 0,
  };
}

function createTargetSpatialIndex(targets: TargetState[]): TargetSpatialIndex {
  const cells = new Map<string, number[]>();
  const positions = new Float32Array(targets.length * 2);
  let maxRadius = 0;
  let maxSolidRadius = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (target === undefined) {
      continue;
    }

    positions[index * 2] = target.x;
    positions[index * 2 + 1] = target.z;
    maxRadius = Math.max(maxRadius, target.radius);
    maxSolidRadius = Math.max(maxSolidRadius, target.solidRadius);
    const key = targetSpatialCellKey(target.x, target.z);
    const cellTargets = cells.get(key);
    if (cellTargets === undefined) {
      cells.set(key, [index]);
    } else {
      cellTargets.push(index);
    }
  }

  return {
    targets,
    targetCount: targets.length,
    maxRadius,
    maxSolidRadius,
    positions,
    cells,
  };
}

function ensureTargetSpatialIndex(state: GameState): TargetSpatialIndex {
  const index = state.targetSpatialIndex;
  if (
    index.targets !== state.targets ||
    index.targetCount !== state.targets.length ||
    hasMovedTarget(state.targets, index.positions)
  ) {
    state.targetSpatialIndex = createTargetSpatialIndex(state.targets);
  }

  return state.targetSpatialIndex;
}

function hasMovedTarget(targets: TargetState[], positions: Float32Array): boolean {
  if (positions.length !== targets.length * 2) {
    return true;
  }

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (target === undefined) {
      continue;
    }

    if (positions[index * 2] !== target.x || positions[index * 2 + 1] !== target.z) {
      return true;
    }
  }

  return false;
}

function queryTargetsInSweptBounds(
  state: GameState,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  margin: number,
): TargetState[] {
  const index = ensureTargetSpatialIndex(state);
  const minCellX = targetSpatialCellCoordinate(Math.min(startX, endX) - margin);
  const maxCellX = targetSpatialCellCoordinate(Math.max(startX, endX) + margin);
  const minCellZ = targetSpatialCellCoordinate(Math.min(startZ, endZ) - margin);
  const maxCellZ = targetSpatialCellCoordinate(Math.max(startZ, endZ) + margin);
  const candidateIndices = new Set<number>();

  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      const cellTargets = index.cells.get(`${cellX},${cellZ}`);
      if (cellTargets === undefined) {
        continue;
      }
      for (const targetIndex of cellTargets) {
        candidateIndices.add(targetIndex);
      }
    }
  }

  return [...candidateIndices]
    .sort((left, right) => left - right)
    .map((targetIndex) => state.targets[targetIndex])
    .filter((target): target is TargetState => target !== undefined);
}

function targetSpatialCellCoordinate(coordinate: number): number {
  return Math.floor(coordinate / TARGET_SPATIAL_CELL_SIZE);
}

function targetSpatialCellKey(x: number, z: number): string {
  return `${targetSpatialCellCoordinate(x)},${targetSpatialCellCoordinate(z)}`;
}

function stepCutting(
  state: GameState,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  deltaSeconds: number,
): void {
  const currentTargetRpm = targetRpmForLevel(state.player.level);
  const torque = torqueForLevel(state.player.level);
  const contacts = findTargetContacts(state, startX, startZ, endX, endZ, state.player.radius);
  state.bladeContactTargetIds.length = 0;
  for (const contact of contacts) {
    state.bladeContactTargetIds.push(contact.target.id);
  }
  refreshTooToughNoticeVisibility(state, contacts);
  const totalLoad = contacts.reduce(
    (sum, contact) => sum + contact.target.resistance * contact.contactFraction,
    0,
  );
  const loadedRpm = currentTargetRpm * clamp(1 - totalLoad / torque, 0.08, 1);
  const approachRate = contacts.length > 0 ? LOAD_APPROACH_RATE : RECOVERY_APPROACH_RATE;

  state.player.targetRpm = currentTargetRpm;
  state.player.rpm = exponentialApproach(state.player.rpm, loadedRpm, approachRate, deltaSeconds);
  state.player.bladeAngleRadians =
    (state.player.bladeAngleRadians + (state.player.rpm / 60) * TAU * deltaSeconds) % TAU;

  const normalizedRpm =
    state.player.rpm < MIN_CUTTING_RPM
      ? 0
      : clamp((state.player.rpm - MIN_CUTTING_RPM) / (currentTargetRpm - MIN_CUTTING_RPM), 0, 1);

  if (normalizedRpm > 0) {
    markCutGrassVisuals(state, startX, startZ, endX, endZ, state.player.radius);
  } else {
    emitTooToughNoticeIfNeeded(state, contacts);
  }

  for (const contact of contacts) {
    const target = contact.target;
    if (target.status === "cut" || target.requiredWork <= 0 || normalizedRpm <= 0) {
      continue;
    }

    const workRate = BASE_WORK_RATE * torque * normalizedRpm * contact.contactFraction;
    target.accumulatedWork = Math.min(
      target.requiredWork,
      target.accumulatedWork + workRate * deltaSeconds,
    );

    if (target.accumulatedWork >= target.requiredWork) {
      target.status = "cut";
      awardTarget(state, target);
    } else if (target.accumulatedWork > 0) {
      target.status = "cutting";
    }
  }

  applyProgression(state);
  updateContractCompletion(state);
}

function refreshTooToughNoticeVisibility(
  state: GameState,
  contacts: readonly TargetContact[],
): void {
  const notice = state.tooToughNotice;
  if (notice === null) {
    return;
  }

  const stillInContact = contacts.some((contact) => contact.target.id === notice.targetId);
  const stillVisible = state.elapsedSeconds - notice.issuedAtSeconds <= 0.95;
  if (!stillInContact || !stillVisible) {
    state.tooToughNotice = null;
  }
}

function emitTooToughNoticeIfNeeded(state: GameState, contacts: readonly TargetContact[]): void {
  const currentLevel = state.player.level;
  let candidate: TargetState | null = null;

  for (const contact of contacts) {
    const target = contact.target;
    if (
      target.status === "cut" ||
      target.accumulatedWork >= target.requiredWork ||
      target.recommendedLevel <= currentLevel
    ) {
      continue;
    }
    if (candidate === null || target.recommendedLevel > candidate.recommendedLevel) {
      candidate = target;
    }
  }

  if (candidate === null) {
    return;
  }

  const nextAllowedAt = state.tooToughNoticeCooldowns[candidate.id] ?? -Infinity;
  if (state.elapsedSeconds < nextAllowedAt) {
    return;
  }

  state.tooToughNoticeCooldowns[candidate.id] = state.elapsedSeconds + 1.5;
  state.tooToughRevision += 1;
  state.tooToughNotice = {
    revision: state.tooToughRevision,
    targetId: candidate.id,
    kind: candidate.kind,
    x: candidate.x,
    z: candidate.z,
    recommendedLevel: candidate.recommendedLevel,
    currentLevel,
    issuedAtSeconds: state.elapsedSeconds,
  };
}

function markCutGrassVisuals(
  state: GameState,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  bladeRadius: number,
): void {
  const cellSize = GRASS_FIELD_SIZE / GRASS_VISUAL_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;
  const candidateMargin = cellSize * GRASS_VISUAL_JITTER_RATIO;
  const minColumn = gridIndex(
    Math.min(startX, endX) - bladeRadius - candidateMargin,
    halfField,
    cellSize,
  );
  const maxColumn = gridIndex(
    Math.max(startX, endX) + bladeRadius + candidateMargin,
    halfField,
    cellSize,
  );
  const minRow = gridIndex(
    Math.min(startZ, endZ) - bladeRadius - candidateMargin,
    halfField,
    cellSize,
  );
  const maxRow = gridIndex(
    Math.max(startZ, endZ) + bladeRadius + candidateMargin,
    halfField,
    cellSize,
  );

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const visualIndex = row * GRASS_VISUAL_COLUMNS + column;
      if (state.grassVisualCutMask[visualIndex] === 1) {
        continue;
      }

      const positionIndex = visualIndex * 2;
      const visualX = state.grassVisualPositions[positionIndex];
      const visualZ = state.grassVisualPositions[positionIndex + 1];
      if (
        visualX === undefined ||
        visualZ === undefined ||
        distanceToSegment(visualX, visualZ, startX, startZ, endX, endZ) > bladeRadius
      ) {
        continue;
      }

      state.grassVisualCutMask[visualIndex] = 1;
      state.cutGrassVisualIndices.push(visualIndex);
    }
  }
}

function gridIndex(coordinate: number, halfField: number, cellSize: number): number {
  return Math.min(
    GRASS_VISUAL_COLUMNS - 1,
    Math.max(0, Math.floor((coordinate + halfField) / cellSize)),
  );
}

interface TargetContact {
  target: TargetState;
  contactFraction: number;
}

function findTargetContacts(
  state: GameState,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  bladeRadius: number,
): TargetContact[] {
  const contacts: TargetContact[] = [];
  const index = ensureTargetSpatialIndex(state);
  const candidates = queryTargetsInSweptBounds(
    state,
    startX,
    startZ,
    endX,
    endZ,
    bladeRadius + index.maxRadius,
  );

  for (const target of candidates) {
    if (target.status === "cut") {
      continue;
    }

    const distance = distanceToSegment(target.x, target.z, startX, startZ, endX, endZ);
    const overlapDepth = bladeRadius + target.radius - distance;
    const contactFraction = clamp(overlapDepth / bladeRadius, 0, 1);
    if (contactFraction > 0) {
      contacts.push({ target, contactFraction });
    }
  }

  return contacts;
}

function distanceToSegment(
  pointX: number,
  pointZ: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
): number {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ;

  if (segmentLengthSquared === 0) {
    return Math.hypot(pointX - startX, pointZ - startZ);
  }

  const projection = clamp(
    ((pointX - startX) * segmentX + (pointZ - startZ) * segmentZ) / segmentLengthSquared,
    0,
    1,
  );
  const closestX = startX + segmentX * projection;
  const closestZ = startZ + segmentZ * projection;
  return Math.hypot(pointX - closestX, pointZ - closestZ);
}

function awardTarget(state: GameState, target: TargetState): void {
  const levelBefore = levelForXp(state.xp);

  switch (target.kind) {
    case "grass":
      state.inventory.grass += target.yield;
      state.objectives.grass.collected += target.yield;
      break;
    case "flower":
    case "softCrop":
      state.inventory.flowers += target.yield;
      state.objectives.flowers.collected += target.yield;
      break;
    case "denseWeed":
    case "fiberReed":
    case "shrub":
      state.inventory.fiber += target.yield;
      state.objectives.fiber.collected += target.yield;
      break;
    case "sapling":
      state.inventory.wood += target.yield;
      state.objectives.wood.collected += target.yield;
      break;
    case "matureTree":
      state.inventory.wood += target.yield;
      state.objectives.wood.collected += target.yield;
      break;
    case "rock":
      return;
    default:
      assertNever(target.kind);
  }

  state.xp += target.xp;
  const revision = state.cutEvents.length + 1;
  state.cutEvents.push({
    revision,
    targetId: target.id,
    kind: target.kind,
    x: target.x,
    z: target.z,
    yield: target.yield,
    xp: target.xp,
    levelBefore,
    levelAfter: levelForXp(state.xp),
  });
  state.cutRevision = revision;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled target kind: ${String(value)}`);
}

function applyProgression(state: GameState): void {
  const level = levelForXp(state.xp);

  state.player.level = level;
  state.player.targetRpm = targetRpmForLevel(level);
}

function updateContractCompletion(state: GameState): void {
  if (state.mode === "complete") {
    return;
  }

  if (!isContractComplete(state)) {
    return;
  }

  finalizeContractResult(state, "complete");
  state.objectives.status = "complete";
  state.objectives.grass.status = "complete";
  state.objectives.flowers.status = "complete";
  state.objectives.fiber.status = "complete";
  state.objectives.wood.status = "complete";
}

function isContractComplete(state: GameState): boolean {
  const objectivesComplete =
    state.objectives.grass.collected >= state.objectives.grass.target &&
    state.objectives.flowers.collected >= state.objectives.flowers.target &&
    state.objectives.fiber.collected >= state.objectives.fiber.target &&
    state.objectives.wood.collected >= state.objectives.wood.target;

  if (!objectivesComplete) {
    return false;
  }

  if (state.contract.completionMode !== "clear-patches") {
    return true;
  }

  return state.targets.every(
    (target) =>
      (target.kind !== "grass" && target.kind !== "flower" && target.kind !== "softCrop") ||
      target.status === "cut",
  );
}

function updateContractTimeout(state: GameState): void {
  if (state.mode === "complete" || state.contract.timeLimitSeconds === null) {
    return;
  }

  if (state.elapsedSeconds < state.contract.timeLimitSeconds) {
    return;
  }

  state.elapsedSeconds = state.contract.timeLimitSeconds;
  finalizeContractResult(state, "timed-out");
}

function finalizeContractResult(state: GameState, status: ContractResult["status"]): void {
  state.mode = "complete";
  state.player.vx = 0;
  state.player.vz = 0;
  state.bladeContactTargetIds.length = 0;
  state.tooToughNotice = null;
  state.result = {
    status,
    completedAtSeconds: state.elapsedSeconds,
    timeLimitSeconds: state.contract.timeLimitSeconds,
    cutTargets: state.targets.filter((target) => target.status === "cut").length,
    highestLevel: state.player.level,
    finalInventory: { ...state.inventory },
    completionRevision: state.cutRevision,
  };
}

function levelForXp(xp: number): number {
  let level = 1;

  for (const threshold of CUMULATIVE_XP_THRESHOLDS) {
    if (xp < threshold || level >= MAX_BLADE_LEVEL) {
      break;
    }
    level += 1;
  }

  return level;
}

function targetRpmForLevel(level: number): number {
  return Math.min(1000, 720 + 40 * (level - 1));
}

function torqueForLevel(level: number): number {
  return 1 + 0.35 * (level - 1);
}

function exponentialApproach(
  current: number,
  target: number,
  rate: number,
  deltaSeconds: number,
): number {
  return target + (current - target) * Math.exp(-rate * deltaSeconds);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function moveTowardZero(value: number, amount: number): number {
  if (Math.abs(value) <= amount) {
    return 0;
  }

  return value - Math.sign(value) * amount;
}

function clampPlayerToWorld(player: PlayerState): void {
  const limit = WORLD_HALF_EXTENT - player.radius;

  if (player.x < -limit) {
    player.x = -limit;
    player.vx = Math.max(0, player.vx);
  } else if (player.x > limit) {
    player.x = limit;
    player.vx = Math.min(0, player.vx);
  }

  if (player.z < -limit) {
    player.z = -limit;
    player.vz = Math.max(0, player.vz);
  } else if (player.z > limit) {
    player.z = limit;
    player.vz = Math.min(0, player.vz);
  }
}

function resolveSolidMovement(
  state: GameState,
  startX: number,
  startZ: number,
  intendedX: number,
  intendedZ: number,
): void {
  let earliestHitTime: number | null = null;
  const index = ensureTargetSpatialIndex(state);
  const candidates = queryTargetsInSweptBounds(
    state,
    startX,
    startZ,
    intendedX,
    intendedZ,
    PLAYER_HUB_RADIUS + index.maxSolidRadius,
  );

  for (const target of candidates) {
    if (target.status === "cut" || target.solidRadius <= 0) {
      continue;
    }

    const hitTime = sweptCircleHitTime(
      startX,
      startZ,
      intendedX,
      intendedZ,
      target.x,
      target.z,
      PLAYER_HUB_RADIUS + target.solidRadius,
    );
    if (hitTime !== null && (earliestHitTime === null || hitTime < earliestHitTime)) {
      earliestHitTime = hitTime;
    }
  }

  if (earliestHitTime === null) {
    return;
  }

  const movementFraction = Math.max(0, earliestHitTime - COLLISION_TIME_EPSILON);
  state.player.x = startX + (intendedX - startX) * movementFraction;
  state.player.z = startZ + (intendedZ - startZ) * movementFraction;
  state.player.vx = 0;
  state.player.vz = 0;
}

function sweptCircleHitTime(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  circleX: number,
  circleZ: number,
  radius: number,
): number | null {
  const movementX = endX - startX;
  const movementZ = endZ - startZ;
  const movementLengthSquared = movementX * movementX + movementZ * movementZ;
  if (movementLengthSquared === 0) {
    return null;
  }

  const offsetX = startX - circleX;
  const offsetZ = startZ - circleZ;
  const startDistanceSquared = offsetX * offsetX + offsetZ * offsetZ;
  const radiusSquared = radius * radius;
  const approach = offsetX * movementX + offsetZ * movementZ;

  if (startDistanceSquared <= radiusSquared + Number.EPSILON) {
    return approach < 0 ? 0 : null;
  }

  const discriminant =
    approach * approach - movementLengthSquared * (startDistanceSquared - radiusSquared);
  if (discriminant < 0) {
    return null;
  }

  const hitTime = (-approach - Math.sqrt(discriminant)) / movementLengthSquared;
  return hitTime >= 0 && hitTime <= 1 ? hitTime : null;
}
