import { describe, expect, it } from "vitest";

import { resolveQualitySettings } from "../src/game/quality";

describe("quality settings", () => {
  it("uses default quality unless low is explicitly requested", () => {
    expect(resolveQualitySettings(null)).toEqual({
      preset: "default",
      antialias: true,
      maxPixelRatio: 1.5,
      grassBladesPerVisual: 14,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    });
    expect(resolveQualitySettings("default")).toEqual({
      preset: "default",
      antialias: true,
      maxPixelRatio: 1.5,
      grassBladesPerVisual: 14,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    });
    expect(resolveQualitySettings("unknown")).toEqual({
      preset: "default",
      antialias: true,
      maxPixelRatio: 1.5,
      grassBladesPerVisual: 14,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    });
  });

  it("uses low quality for low-cost contexts unless a preset is explicit", () => {
    expect(resolveQualitySettings(null, { prefersLowCost: true })).toEqual({
      preset: "low",
      antialias: false,
      maxPixelRatio: 1,
      grassBladesPerVisual: 8,
      shadowsEnabled: false,
      shadowMapSize: 0,
    });
    expect(resolveQualitySettings("default", { prefersLowCost: true })).toEqual({
      preset: "default",
      antialias: true,
      maxPixelRatio: 1.5,
      grassBladesPerVisual: 14,
      shadowsEnabled: true,
      shadowMapSize: 1024,
    });
  });

  it("uses lower render-cost settings for low quality", () => {
    expect(resolveQualitySettings("low")).toEqual({
      preset: "low",
      antialias: false,
      maxPixelRatio: 1,
      grassBladesPerVisual: 8,
      shadowsEnabled: false,
      shadowMapSize: 0,
    });
  });
});
