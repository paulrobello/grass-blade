import { describe, expect, it } from "vitest";

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
