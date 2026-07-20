import { createMeadowLayout, type TargetSeed } from "./world";

export const MEADOW_SEED = 0x6a09e667;
export const FIXED_TIME_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_DELTA_SECONDS = 1 / 20;
export const WORLD_HALF_EXTENT = 22;
export const PLAYER_RADIUS = 2.15;
export const MAX_MOVE_SPEED = 7.5;

const MOVE_ACCELERATION = 20;
const MOVE_BRAKING = 26;
const MIN_CUTTING_RPM = 180;
const LOAD_APPROACH_RATE = 5;
const RECOVERY_APPROACH_RATE = 3;
const BASE_WORK_RATE = 12;
const MAX_BLADE_LEVEL = 8;
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
  cutRevision: number;
}

export function createInitialState(seed = MEADOW_SEED): GameState {
  const layout = createMeadowLayout(seed);
  const targetSeeds = [...layout.grassCells, ...layout.flowerTargets];

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
      fiber: { status: "planned", collected: 0, target: 6 },
      wood: { status: "planned", collected: 0, target: 6 },
    },
    xp: 0,
    targets: targetSeeds.map(createTargetState),
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
  stepCutting(state, startX, startZ, state.player.x, state.player.z, delta);

  return state;
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
  if (target.kind === "grass") {
    state.inventory.grass += target.yield;
    state.objectives.grass.collected += target.yield;
  } else {
    state.inventory.flowers += target.yield;
    state.objectives.flowers.collected += target.yield;
  }

  state.xp += target.xp;
  state.cutRevision += 1;
}

function applyProgression(state: GameState): void {
  let level = 1;

  for (const threshold of CUMULATIVE_XP_THRESHOLDS) {
    if (state.xp < threshold || level >= MAX_BLADE_LEVEL) {
      break;
    }
    level += 1;
  }

  state.player.level = level;
  state.player.targetRpm = targetRpmForLevel(level);
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
