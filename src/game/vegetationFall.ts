export type VegetationFallStage = "waiting" | "falling" | "settling" | "disappearing" | "complete";

export interface VegetationFallTiming {
  tipSeconds: number;
  holdSeconds: number;
  shrinkSeconds: number;
  maxTiltRadians: number;
}

export interface VegetationFallSample {
  stage: VegetationFallStage;
  tiltRadians: number;
  visibilityScale: number;
}

export const GRASS_FALL_TIMING: VegetationFallTiming = {
  tipSeconds: 0.38,
  holdSeconds: 0.12,
  shrinkSeconds: 0.24,
  maxTiltRadians: 1.5,
};

export const FLOWER_FALL_TIMING: VegetationFallTiming = {
  tipSeconds: 0.46,
  holdSeconds: 0.2,
  shrinkSeconds: 0.28,
  maxTiltRadians: 1.5,
};

export const REDUCED_MOTION_FALL_TIMING: VegetationFallTiming = {
  tipSeconds: 0.12,
  holdSeconds: 0,
  shrinkSeconds: 0.12,
  maxTiltRadians: 1.25,
};

export function vegetationFallDuration(timing: VegetationFallTiming): number {
  return timing.tipSeconds + timing.holdSeconds + timing.shrinkSeconds;
}

export function sampleVegetationFall(
  ageSeconds: number,
  timing: VegetationFallTiming,
  output: VegetationFallSample,
): void {
  if (ageSeconds < 0) {
    output.stage = "waiting";
    output.tiltRadians = 0;
    output.visibilityScale = 1;
    return;
  }

  if (ageSeconds < timing.tipSeconds) {
    const progress = clamp01(ageSeconds / timing.tipSeconds);
    output.stage = "falling";
    output.tiltRadians = timing.maxTiltRadians * easeOutCubic(progress);
    output.visibilityScale = 1;
    return;
  }

  const holdEnd = timing.tipSeconds + timing.holdSeconds;
  if (ageSeconds < holdEnd) {
    output.stage = "settling";
    output.tiltRadians = timing.maxTiltRadians;
    output.visibilityScale = 1;
    return;
  }

  const totalDuration = holdEnd + timing.shrinkSeconds;
  if (ageSeconds < totalDuration) {
    const progress = clamp01((ageSeconds - holdEnd) / timing.shrinkSeconds);
    output.stage = "disappearing";
    output.tiltRadians = timing.maxTiltRadians;
    output.visibilityScale = 1 - smoothstep(progress);
    return;
  }

  output.stage = "complete";
  output.tiltRadians = timing.maxTiltRadians;
  output.visibilityScale = 0;
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
