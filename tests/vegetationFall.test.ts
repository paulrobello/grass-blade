import { describe, expect, it } from "vitest";

import {
  FLOWER_FALL_TIMING,
  GRASS_FALL_TIMING,
  REDUCED_MOTION_FALL_TIMING,
  sampleVegetationFall,
  type VegetationFallSample,
  vegetationFallDuration,
} from "../src/game/vegetationFall";

function createSample(): VegetationFallSample {
  return { stage: "waiting", tiltRadians: 0, visibilityScale: 1 };
}

describe("vegetation fall timeline", () => {
  it("keeps staggered vegetation standing until its start time", () => {
    const sample = createSample();

    sampleVegetationFall(-0.05, FLOWER_FALL_TIMING, sample);

    expect(sample).toEqual({ stage: "waiting", tiltRadians: 0, visibilityScale: 1 });
  });

  it("tips, settles, shrinks, and completes in order", () => {
    const sample = createSample();

    sampleVegetationFall(0.19, GRASS_FALL_TIMING, sample);
    expect(sample.stage).toBe("falling");
    expect(sample.tiltRadians).toBeGreaterThan(GRASS_FALL_TIMING.maxTiltRadians / 2);
    expect(sample.visibilityScale).toBe(1);

    sampleVegetationFall(0.48, GRASS_FALL_TIMING, sample);
    expect(sample).toEqual({
      stage: "settling",
      tiltRadians: GRASS_FALL_TIMING.maxTiltRadians,
      visibilityScale: 1,
    });

    sampleVegetationFall(0.68, GRASS_FALL_TIMING, sample);
    expect(sample.stage).toBe("disappearing");
    expect(sample.visibilityScale).toBeGreaterThan(0);
    expect(sample.visibilityScale).toBeLessThan(1);

    sampleVegetationFall(vegetationFallDuration(GRASS_FALL_TIMING), GRASS_FALL_TIMING, sample);
    expect(sample.stage).toBe("complete");
    expect(sample.visibilityScale).toBe(0);
  });

  it("uses the longer flower silhouette timing", () => {
    expect(vegetationFallDuration(FLOWER_FALL_TIMING)).toBeCloseTo(0.94);
    expect(vegetationFallDuration(FLOWER_FALL_TIMING)).toBeGreaterThan(
      vegetationFallDuration(GRASS_FALL_TIMING),
    );
  });

  it("preserves the causal fall while shortening reduced motion", () => {
    const sample = createSample();

    sampleVegetationFall(0.06, REDUCED_MOTION_FALL_TIMING, sample);
    expect(sample.stage).toBe("falling");
    expect(sample.tiltRadians).toBeGreaterThan(0);

    sampleVegetationFall(0.18, REDUCED_MOTION_FALL_TIMING, sample);
    expect(sample.stage).toBe("disappearing");

    sampleVegetationFall(0.24, REDUCED_MOTION_FALL_TIMING, sample);
    expect(sample.stage).toBe("complete");
  });
});
