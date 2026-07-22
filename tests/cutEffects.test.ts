import { describe, expect, it } from "vitest";

import {
  MAX_WOOD_CONTACT_EMISSIONS_PER_SYNC,
  REDUCED_MOTION_ROCK_CONTACT_FRAGMENTS_PER_EMISSION,
  REDUCED_MOTION_WOOD_CONTACT_FRAGMENTS_PER_EMISSION,
  ROCK_CONTACT_FRAGMENTS_PER_EMISSION,
  WOOD_CONTACT_FRAGMENTS_PER_EMISSION,
  planWoodContactChipEmissions,
  shouldEmitRockContactDeflection,
} from "../src/game/cutEffects";

describe("wood contact chip thresholds", () => {
  it("does not consume or emit thresholds while a woody target is out of contact", () => {
    expect(planWoodContactChipEmissions("sapling", 12.5, 2, false)).toEqual({
      firstEmissionOrdinal: 2,
      emissionCount: 0,
      nextConsumedThresholdCount: 2,
    });
  });

  it("emits once for positive live-contact work below the first interval", () => {
    expect(planWoodContactChipEmissions("matureTree", 1.437, 0, true)).toEqual({
      firstEmissionOrdinal: 0,
      emissionCount: 1,
      nextConsumedThresholdCount: 1,
    });
  });

  it("does not emit when live-contact work is still zero", () => {
    expect(planWoodContactChipEmissions("matureTree", 0, 0, true)).toEqual({
      firstEmissionOrdinal: 0,
      emissionCount: 0,
      nextConsumedThresholdCount: 0,
    });
  });

  it("preserves emitted work across contact loss and resumes at the next interval", () => {
    const initialContact = planWoodContactChipEmissions("sapling", 0.2, 0, true);
    const restingAboveThreshold = planWoodContactChipEmissions("sapling", 1.25, 1, false);
    const resumedContact = planWoodContactChipEmissions("sapling", 1.25, 1, true);

    expect(initialContact.emissionCount).toBe(1);
    expect(restingAboveThreshold.nextConsumedThresholdCount).toBe(1);
    expect(resumedContact).toEqual({
      firstEmissionOrdinal: 1,
      emissionCount: 1,
      nextConsumedThresholdCount: 2,
    });
  });

  it("catches up multiple crossed thresholds in deterministic ordinal order", () => {
    expect(planWoodContactChipEmissions("sapling", 5.5, 1, true)).toEqual({
      firstEmissionOrdinal: 1,
      emissionCount: 4,
      nextConsumedThresholdCount: 5,
    });
  });

  it("caps one sync without losing later catch-up emissions", () => {
    const first = planWoodContactChipEmissions("matureTree", 30, 0, true);
    const second = planWoodContactChipEmissions(
      "matureTree",
      30,
      first.nextConsumedThresholdCount,
      true,
    );

    expect(first.emissionCount).toBe(MAX_WOOD_CONTACT_EMISSIONS_PER_SYNC);
    expect(second).toEqual({
      firstEmissionOrdinal: MAX_WOOD_CONTACT_EMISSIONS_PER_SYNC,
      emissionCount: MAX_WOOD_CONTACT_EMISSIONS_PER_SYNC,
      nextConsumedThresholdCount: MAX_WOOD_CONTACT_EMISSIONS_PER_SYNC * 2,
    });
  });

  it("does not duplicate an already-consumed threshold", () => {
    const first = planWoodContactChipEmissions("sapling", 2.5, 0, true);
    const replay = planWoodContactChipEmissions(
      "sapling",
      2.5,
      first.nextConsumedThresholdCount,
      true,
    );

    expect(first.emissionCount).toBe(3);
    expect(replay.emissionCount).toBe(0);
    expect(replay.nextConsumedThresholdCount).toBe(3);
  });

  it("uses distinct explicit thresholds for saplings and mature trees", () => {
    expect(planWoodContactChipEmissions("sapling", 1.25, 1, true).emissionCount).toBe(1);
    expect(planWoodContactChipEmissions("matureTree", 1.25, 1, true).emissionCount).toBe(0);
    expect(planWoodContactChipEmissions("matureTree", 1.5, 1, true).emissionCount).toBe(1);
  });

  it("uses denser bounded bursts with a reduced-motion minimum", () => {
    expect(WOOD_CONTACT_FRAGMENTS_PER_EMISSION).toEqual({
      sapling: 18,
      matureTree: 24,
    });
    expect(REDUCED_MOTION_WOOD_CONTACT_FRAGMENTS_PER_EMISSION).toBe(4);
  });

  it("ignores non-woody cutting targets", () => {
    expect(planWoodContactChipEmissions("denseWeed", 100, 0, true).emissionCount).toBe(0);
  });
});

describe("rock contact deflection", () => {
  it("emits only on rock contact entry", () => {
    expect(shouldEmitRockContactDeflection("rock", "standing", false, true)).toBe(true);
    expect(shouldEmitRockContactDeflection("rock", "standing", true, true)).toBe(false);
    expect(shouldEmitRockContactDeflection("rock", "standing", false, false)).toBe(false);
  });

  it("ignores cut or non-rock targets", () => {
    expect(shouldEmitRockContactDeflection("rock", "cut", false, true)).toBe(false);
    expect(shouldEmitRockContactDeflection("sapling", "standing", false, true)).toBe(false);
  });

  it("uses bounded visible stone bursts with a reduced-motion minimum", () => {
    expect(ROCK_CONTACT_FRAGMENTS_PER_EMISSION).toBe(22);
    expect(REDUCED_MOTION_ROCK_CONTACT_FRAGMENTS_PER_EMISSION).toBe(4);
  });
});
