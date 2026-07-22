import { describe, expect, it } from "vitest";

import {
  clampVolume,
  deriveRpmFrequencyHz,
  resolveAudioSettings,
  resolveVolume,
} from "../src/game/audio";
import { derivePlayableRootSize, resolveAccessibilitySettings } from "../src/game/Game";

describe("playable root sizing", () => {
  it("constrains a phone browser viewport that is wider than the physical screen aspect", () => {
    const rootSize = derivePlayableRootSize({
      viewportWidth: 592,
      viewportHeight: 981,
      screenWidth: 592,
      screenHeight: 1280,
      allowConstrain: true,
    });

    expect(rootSize).toEqual({
      width: 454,
      height: 981,
      constrained: true,
    });
  });

  it("falls back to a phone aspect when browser chrome makes screen metrics match the visible viewport", () => {
    const rootSize = derivePlayableRootSize({
      viewportWidth: 592,
      viewportHeight: 981,
      screenWidth: 592,
      screenHeight: 981,
      screenAvailableWidth: 592,
      screenAvailableHeight: 981,
      allowConstrain: true,
    });

    expect(rootSize).toEqual({
      width: 454,
      height: 981,
      constrained: true,
    });
  });

  it("keeps touch tablets full width instead of forcing a narrow phone layout", () => {
    const rootSize = derivePlayableRootSize({
      viewportWidth: 768,
      viewportHeight: 1024,
      screenWidth: 768,
      screenHeight: 1024,
      allowConstrain: true,
    });

    expect(rootSize).toEqual({
      width: 768,
      height: 1024,
      constrained: false,
    });
  });

  it("keeps fullscreen phone play areas full width", () => {
    const rootSize = derivePlayableRootSize({
      viewportWidth: 592,
      viewportHeight: 1280,
      screenWidth: 592,
      screenHeight: 1280,
      allowConstrain: true,
    });

    expect(rootSize).toEqual({
      width: 592,
      height: 1280,
      constrained: false,
    });
  });

  it("does not constrain desktop or non-touch viewports", () => {
    const rootSize = derivePlayableRootSize({
      viewportWidth: 1440,
      viewportHeight: 900,
      screenWidth: 1440,
      screenHeight: 900,
      allowConstrain: false,
    });

    expect(rootSize).toEqual({
      width: 1440,
      height: 900,
      constrained: false,
    });
  });
});

describe("accessibility settings", () => {
  it("allows query-string high contrast to override standard media settings", () => {
    expect(
      resolveAccessibilitySettings({
        contrastQuery: "high",
        forcedColorsActive: false,
        prefersContrastMore: false,
      }),
    ).toEqual({
      highContrast: true,
      contrastSource: "query",
    });
  });

  it("allows query-string standard contrast to override high-contrast media settings", () => {
    expect(
      resolveAccessibilitySettings({
        contrastQuery: "standard",
        forcedColorsActive: true,
        prefersContrastMore: true,
      }),
    ).toEqual({
      highContrast: false,
      contrastSource: "query",
    });
  });

  it("uses forced colors before prefers-contrast when no query override is present", () => {
    expect(
      resolveAccessibilitySettings({
        contrastQuery: null,
        forcedColorsActive: true,
        prefersContrastMore: true,
      }),
    ).toEqual({
      highContrast: true,
      contrastSource: "forced-colors",
    });
  });

  it("uses prefers-contrast when no query override or forced colors are present", () => {
    expect(
      resolveAccessibilitySettings({
        contrastQuery: null,
        forcedColorsActive: false,
        prefersContrastMore: true,
      }),
    ).toEqual({
      highContrast: true,
      contrastSource: "prefers-contrast",
    });
  });
});

describe("audio settings", () => {
  it("clamps and parses volume values from query parameters", () => {
    expect(resolveVolume("80", 0.5)).toBe(0.8);
    expect(resolveVolume("0.25", 0.5)).toBe(0.25);
    expect(resolveVolume("not-a-number", 0.5)).toBe(0.5);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
  });

  it("resolves independent audio channels and mute state", () => {
    const settings = resolveAudioSettings(
      new URLSearchParams("muted=1&masterVolume=60&musicVolume=35&effectsVolume=90"),
    );

    expect(settings).toEqual({
      muted: true,
      masterVolume: 0.6,
      musicVolume: 0.35,
      effectsVolume: 0.9,
    });
  });

  it("derives an RPM hum pitch that rises with blade speed and clamps overspeed", () => {
    expect(deriveRpmFrequencyHz(0, 720)).toBe(82);
    expect(deriveRpmFrequencyHz(360, 720)).toBeGreaterThan(deriveRpmFrequencyHz(180, 720));
    expect(deriveRpmFrequencyHz(2000, 720)).toBe(273);
  });
});
