export const MEADOW_SEED = 0x6a09e667;
export const FIXED_TIME_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_DELTA_SECONDS = 1 / 20;
export const WORLD_HALF_EXTENT = 22;
export const PLAYER_RADIUS = 2.15;
export const MAX_MOVE_SPEED = 7.5;

const MOVE_ACCELERATION = 20;
const MOVE_BRAKING = 26;

export interface MovementInput {
  left: boolean;
  right: boolean;
  forward: boolean;
  backward: boolean;
}

export interface ObjectiveCounter {
  collected: number;
  target: number;
}

export interface FoundationObjectives {
  status: "planned";
  grass: ObjectiveCounter;
  flowers: ObjectiveCounter;
  fiber: ObjectiveCounter;
  wood: ObjectiveCounter;
}

export interface PlayerState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  rpm: number;
  level: number;
}

export interface GameState {
  mode: "foundation";
  seed: number;
  player: PlayerState;
  objectives: FoundationObjectives;
}

export function createInitialState(seed = MEADOW_SEED): GameState {
  return {
    mode: "foundation",
    seed,
    player: {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      radius: PLAYER_RADIUS,
      rpm: 720,
      level: 1,
    },
    objectives: {
      status: "planned",
      grass: { collected: 0, target: 50 },
      flowers: { collected: 0, target: 10 },
      fiber: { collected: 0, target: 6 },
      wood: { collected: 0, target: 6 },
    },
  };
}

export function stepState(state: GameState, input: MovementInput, deltaSeconds: number): GameState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return state;
  }

  const delta = Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS);
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

  return state;
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
