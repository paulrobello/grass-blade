import { describe, expect, it } from "vitest";

import {
  FIXED_TIME_STEP_SECONDS,
  MAX_MOVE_SPEED,
  MEADOW_SEED,
  WORLD_HALF_EXTENT,
  createInitialState,
  stepState,
  type MovementInput,
} from "../src/game/state";

const idleInput: MovementInput = {
  left: false,
  right: false,
  forward: false,
  backward: false,
};

describe("foundation game state", () => {
  it("creates the same documented foundation state every time", () => {
    const first = createInitialState();
    const second = createInitialState();

    expect(first).toEqual(second);
    expect(first.mode).toBe("foundation");
    expect(first.seed).toBe(MEADOW_SEED);
    expect(first.player).toMatchObject({
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      level: 1,
      rpm: 720,
    });
    expect(first.objectives).toEqual({
      status: "planned",
      grass: { collected: 0, target: 50 },
      flowers: { collected: 0, target: 10 },
      fiber: { collected: 0, target: 6 },
      wood: { collected: 0, target: 6 },
    });
  });

  it("uses an explicit seed without changing the foundation contract", () => {
    const state = createInitialState(12345);

    expect(state.seed).toBe(12345);
    expect(state.mode).toBe("foundation");
    expect(state.player.level).toBe(1);
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
