import { describe, expect, it } from "vitest";

import { resolveQualitySettings } from "../src/game/quality";

describe("quality settings", () => {
  it("uses default quality unless low is explicitly requested", () => {
    expect(resolveQualitySettings(null)).toEqual({
      preset: "default",
      maxPixelRatio: 1.5,
    });
    expect(resolveQualitySettings("default")).toEqual({
      preset: "default",
      maxPixelRatio: 1.5,
    });
    expect(resolveQualitySettings("unknown")).toEqual({
      preset: "default",
      maxPixelRatio: 1.5,
    });
  });

  it("uses a lower pixel-ratio cap for low quality", () => {
    expect(resolveQualitySettings("low")).toEqual({
      preset: "low",
      maxPixelRatio: 1,
    });
  });
});
