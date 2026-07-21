import { describe, expect, it } from "vitest";

import {
  DENSE_WEED_FALL_TIMING,
  FLOWER_FALL_TIMING,
  GRASS_FALL_TIMING,
  REDUCED_MOTION_FALL_TIMING,
  WOODY_FALL_TIMING,
  sampleVegetationFall,
  transformRootedFallPoint,
  type RootedFallPosition,
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

  it("gives weeds a quick rooted collapse and woody targets a readable topple", () => {
    expect(vegetationFallDuration(DENSE_WEED_FALL_TIMING)).toBeCloseTo(0.76);
    expect(vegetationFallDuration(WOODY_FALL_TIMING)).toBeCloseTo(0.96);
    expect(vegetationFallDuration(WOODY_FALL_TIMING)).toBeGreaterThan(
      vegetationFallDuration(DENSE_WEED_FALL_TIMING),
    );

    const sample = createSample();
    sampleVegetationFall(WOODY_FALL_TIMING.tipSeconds, WOODY_FALL_TIMING, sample);
    expect(sample).toEqual({
      stage: "settling",
      tiltRadians: WOODY_FALL_TIMING.maxTiltRadians,
      visibilityScale: 1,
    });
  });

  it("rotates a severed top around its stump without sinking its rooted silhouette", () => {
    const stumpHeight = 0.32;
    const topHeight = 1.44;
    const pivot: RootedFallPosition = { x: 0, y: 0, z: 0 };
    const center: RootedFallPosition = { x: 0, y: 0, z: 0 };
    const tip: RootedFallPosition = { x: 0, y: 0, z: 0 };

    transformRootedFallPoint(0, 0, 0, stumpHeight, 0, WOODY_FALL_TIMING.maxTiltRadians, pivot);
    transformRootedFallPoint(
      0,
      topHeight / 2,
      0,
      stumpHeight,
      0,
      WOODY_FALL_TIMING.maxTiltRadians,
      center,
    );
    transformRootedFallPoint(
      0,
      topHeight,
      0,
      stumpHeight,
      0,
      WOODY_FALL_TIMING.maxTiltRadians,
      tip,
    );

    expect(pivot).toEqual({ x: 0, y: stumpHeight, z: 0 });
    expect(center.y).toBeGreaterThan(stumpHeight);
    expect(tip.y).toBeGreaterThan(stumpHeight);
    expect(tip.x).toBeGreaterThan(topHeight * 0.9);
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
