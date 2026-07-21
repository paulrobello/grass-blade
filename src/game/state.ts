import {
  GRASS_FIELD_SIZE,
  GRASS_VISUAL_COLUMNS,
  createMeadowLayout,
  type GrassVisual,
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
const TAU = Math.PI * 2;
export const CUMULATIVE_XP_THRESHOLDS = [20, 55, 110, 190, 300, 450, 650] as const;

export interface MovementInput {
  left: boolean;
  right: boolean;
  forward: boolean;
  backward: boolean;
}

export interface ObjectiveCounter {
  status: "active" | "planned";
  collected: number;
  target: number;
}

export interface ObjectivesState {
  status: "active";
  grass: ObjectiveCounter;
  flowers: ObjectiveCounter;
  fiber: ObjectiveCounter;
  wood: ObjectiveCounter;
}

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

export interface CutCompletionEvent {
  revision: number;
  targetId: string;
  kind: TargetSeed["kind"];
  x: number;
  z: number;
  yield: number;
  xp: number;
  levelBefore: number;
  levelAfter: number;
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

export interface GameState {
  mode: "active";
  seed: number;
  player: PlayerState;
  inventory: InventoryState;
  objectives: ObjectivesState;
  xp: number;
  targets: TargetState[];
  bladeContactTargetIds: string[];
  grassVisualPositions: Float32Array;
  grassVisualCutMask: Uint8Array;
  cutGrassVisualIndices: number[];
  cutEvents: CutCompletionEvent[];
  cutRevision: number;
}

export function createInitialState(seed = MEADOW_SEED): GameState {
  const layout = createMeadowLayout(seed);
  const targetSeeds = [
    ...layout.grassCells,
    ...layout.flowerTargets,
    ...layout.denseWeedTargets,
    ...layout.shrubTargets,
    ...layout.saplingTargets,
    ...layout.matureTreeTargets,
  ];
  const grassVisualPositions = createGrassVisualPositions(layout.grassVisuals);

  return {
    mode: "active",
    seed,
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
      grass: { status: "active", collected: 0, target: 50 },
      flowers: { status: "active", collected: 0, target: 10 },
      fiber: { status: "active", collected: 0, target: 6 },
      wood: { status: "active", collected: 0, target: 6 },
    },
    xp: 0,
    targets: targetSeeds.map(createTargetState),
    bladeContactTargetIds: [],
    grassVisualPositions,
    grassVisualCutMask: new Uint8Array(layout.grassVisuals.length),
    cutGrassVisualIndices: [],
    cutEvents: [],
    cutRevision: 0,
  };
}

export function stepState(state: GameState, input: MovementInput, deltaSeconds: number): GameState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return state;
  }

  const delta = Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS);
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
  const contacts = findTargetContacts(
    state.targets,
    startX,
    startZ,
    endX,
    endZ,
    state.player.radius,
  );
  state.bladeContactTargetIds.length = 0;
  for (const contact of contacts) {
    state.bladeContactTargetIds.push(contact.target.id);
  }
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
  }

  for (const contact of contacts) {
    const target = contact.target;
    if (target.status === "cut" || normalizedRpm <= 0) {
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
  targets: TargetState[],
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  bladeRadius: number,
): TargetContact[] {
  const contacts: TargetContact[] = [];

  for (const target of targets) {
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
      state.inventory.flowers += target.yield;
      state.objectives.flowers.collected += target.yield;
      break;
    case "denseWeed":
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

  for (const target of state.targets) {
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
