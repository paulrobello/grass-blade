import { describe, expect, it } from "vitest";

import {
  GameAudio,
  clampVolume,
  deriveRpmFrequencyHz,
  resolveAudioSettings,
  resolveVolume,
} from "../src/game/audio";
import {
  BEST_TIMES_STORAGE_KEY,
  applyPlayableRootSize,
  contractCardBadges,
  contractMedalForTime,
  contractMedalSummary,
  contractMedalTargets,
  contractMatchesFilter,
  contractNavigationSearch,
  derivePlayableRootSize,
  nextAuthoredContractId,
  nextAuthoredContractTitle,
  parseContractBestTimes,
  primaryContractFilterId,
  resolveAccessibilitySettings,
  resolveMotionSettings,
  serializeContractBestTimes,
  updateContractBestTime,
} from "../src/game/Game";
import { CONTRACT_DEFINITIONS, type ContractDefinition } from "../src/game/state";

describe("playable root sizing", () => {
  it("uses the visible phone browser viewport instead of narrowing the play area", () => {
    const rootSize = derivePlayableRootSize({
      viewportWidth: 592,
      viewportHeight: 981,
      screenWidth: 592,
      screenHeight: 1280,
      allowConstrain: true,
    });

    expect(rootSize).toEqual({
      width: 592,
      height: 981,
      constrained: false,
    });
  });

  it("keeps browser-chrome-sized phone viewports full width", () => {
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
      width: 592,
      height: 981,
      constrained: false,
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

  it("applies the visible viewport size to the playable root", () => {
    const root = createStyleTarget();

    applyPlayableRootSize(root, {
      width: 592,
      height: 981,
      constrained: false,
    });

    expect(root.style.width).toBe("592px");
    expect(root.style.height).toBe("981px");
    expect(root.removedProperties).toEqual(["margin-left", "margin-right"]);
  });
});

describe("contract navigation URLs", () => {
  it("keeps default contract navigation URLs clean", () => {
    expect(contractNavigationSearch(12345, "meadow-delivery")).toBe("?seed=12345");
  });

  it("preserves non-default contracts across restart and next-contract navigation", () => {
    expect(contractNavigationSearch(12345, "flower-sweep")).toBe(
      "?seed=12345&contract=flower-sweep",
    );
  });

  it("preserves existing diagnostics and display query parameters during navigation", () => {
    expect(
      contractNavigationSearch(707, "flower-sweep", "?seed=12345&debug=1&motion=reduced"),
    ).toBe("?seed=707&debug=1&motion=reduced&contract=flower-sweep");
    expect(contractNavigationSearch(707, "meadow-delivery", "?contract=flower-sweep&debug=1")).toBe(
      "?debug=1&seed=707",
    );
  });

  it("cycles through authored contracts for the results next action", () => {
    expect(nextAuthoredContractId("meadow-delivery")).toBe("flower-sweep");
    expect(nextAuthoredContractId("flower-sweep")).toBe("woodland-cleanup");
    expect(nextAuthoredContractId("woodland-cleanup")).toBe("timber-trail");
    expect(nextAuthoredContractId("timber-trail")).toBe("rock-garden");
    expect(nextAuthoredContractId("rock-garden")).toBe("hedge-maze");
    expect(nextAuthoredContractId("hedge-maze")).toBe("timed-harvest");
    expect(nextAuthoredContractId("timed-harvest")).toBe("field-sprint");
    expect(nextAuthoredContractId("field-sprint")).toBe("weed-rush");
    expect(nextAuthoredContractId("weed-rush")).toBe("reed-run");
    expect(nextAuthoredContractId("reed-run")).toBe("clover-circuit");
    expect(nextAuthoredContractId("clover-circuit")).toBe("orchard-loop");
    expect(nextAuthoredContractId("orchard-loop")).toBe("brook-bend");
    expect(nextAuthoredContractId("brook-bend")).toBe("harvest-spiral");
    expect(nextAuthoredContractId("harvest-spiral")).toBe("crescent-grove");
    expect(nextAuthoredContractId("crescent-grove")).toBe("forked-thicket");
    expect(nextAuthoredContractId("forked-thicket")).toBe("switchback-orchard");
    expect(nextAuthoredContractId("switchback-orchard")).toBe("braided-meadow");
    expect(nextAuthoredContractId("braided-meadow")).toBe("clear-every-patch");
    expect(nextAuthoredContractId("clear-every-patch")).toBe("meadow-delivery");
    expect(nextAuthoredContractId("unknown-contract")).toBe("meadow-delivery");
    expect(nextAuthoredContractTitle("meadow-delivery")).toBe("Flower Sweep");
    expect(nextAuthoredContractTitle("flower-sweep")).toBe("Woodland Cleanup");
    expect(nextAuthoredContractTitle("woodland-cleanup")).toBe("Timber Trail");
    expect(nextAuthoredContractTitle("timber-trail")).toBe("Rock Garden");
    expect(nextAuthoredContractTitle("rock-garden")).toBe("Hedge Maze");
    expect(nextAuthoredContractTitle("hedge-maze")).toBe("Timed Harvest");
    expect(nextAuthoredContractTitle("timed-harvest")).toBe("Field Sprint");
    expect(nextAuthoredContractTitle("field-sprint")).toBe("Weed Rush");
    expect(nextAuthoredContractTitle("weed-rush")).toBe("Reed Run");
    expect(nextAuthoredContractTitle("reed-run")).toBe("Clover Circuit");
    expect(nextAuthoredContractTitle("clover-circuit")).toBe("Orchard Loop");
    expect(nextAuthoredContractTitle("orchard-loop")).toBe("Brook Bend");
    expect(nextAuthoredContractTitle("brook-bend")).toBe("Harvest Spiral");
    expect(nextAuthoredContractTitle("harvest-spiral")).toBe("Crescent Grove");
    expect(nextAuthoredContractTitle("crescent-grove")).toBe("Forked Thicket");
    expect(nextAuthoredContractTitle("forked-thicket")).toBe("Switchback Orchard");
    expect(nextAuthoredContractTitle("switchback-orchard")).toBe("Braided Meadow");
    expect(nextAuthoredContractTitle("braided-meadow")).toBe("Clear Every Patch");
    expect(nextAuthoredContractTitle("clear-every-patch")).toBe("Meadow Delivery");
    expect(nextAuthoredContractTitle("unknown-contract")).toBe("Meadow Delivery");
  });

  it("opens the next authored contract while preserving diagnostics", () => {
    expect(
      contractNavigationSearch(
        2654448114,
        nextAuthoredContractId("meadow-delivery"),
        "?seed=12345&debug=1",
      ),
    ).toBe("?seed=2654448114&debug=1&contract=flower-sweep");
    expect(
      contractNavigationSearch(
        1013916587,
        nextAuthoredContractId("flower-sweep"),
        "?seed=2654448114&debug=1&contract=flower-sweep",
      ),
    ).toBe("?seed=1013916587&debug=1&contract=woodland-cleanup");
    expect(
      contractNavigationSearch(
        3668364708,
        nextAuthoredContractId("woodland-cleanup"),
        "?seed=1013916587&debug=1&contract=woodland-cleanup",
      ),
    ).toBe("?seed=3668364708&debug=1&contract=timber-trail");
    expect(
      contractNavigationSearch(
        2027808453,
        nextAuthoredContractId("timber-trail"),
        "?seed=3668364708&debug=1&contract=timber-trail",
      ),
    ).toBe("?seed=2027808453&debug=1&contract=rock-garden");
    expect(
      contractNavigationSearch(
        3872777624,
        nextAuthoredContractId("rock-garden"),
        "?seed=2027808453&debug=1&contract=rock-garden",
      ),
    ).toBe("?seed=3872777624&debug=1&contract=hedge-maze");
    expect(
      contractNavigationSearch(
        1401181199,
        nextAuthoredContractId("hedge-maze"),
        "?seed=3872777624&debug=1&contract=hedge-maze",
      ),
    ).toBe("?seed=1401181199&debug=1&contract=timed-harvest");
    expect(
      contractNavigationSearch(
        3872777624,
        nextAuthoredContractId("timed-harvest"),
        "?seed=2027808453&debug=1&contract=timed-harvest",
      ),
    ).toBe("?seed=3872777624&debug=1&contract=field-sprint");
    expect(
      contractNavigationSearch(
        1222246375,
        nextAuthoredContractId("field-sprint"),
        "?seed=3872777624&debug=1&contract=field-sprint",
      ),
    ).toBe("?seed=1222246375&debug=1&contract=weed-rush");
    expect(
      contractNavigationSearch(
        3041725071,
        nextAuthoredContractId("weed-rush"),
        "?seed=1222246375&debug=1&contract=weed-rush",
      ),
    ).toBe("?seed=3041725071&debug=1&contract=reed-run");
    expect(
      contractNavigationSearch(
        1401193544,
        nextAuthoredContractId("reed-run"),
        "?seed=3041725071&debug=1&contract=reed-run",
      ),
    ).toBe("?seed=1401193544&debug=1&contract=clover-circuit");
    expect(
      contractNavigationSearch(
        1401193544,
        nextAuthoredContractId("clover-circuit"),
        "?seed=3041725071&debug=1&contract=clover-circuit",
      ),
    ).toBe("?seed=1401193544&debug=1&contract=orchard-loop");
    expect(
      contractNavigationSearch(
        4055629313,
        nextAuthoredContractId("orchard-loop"),
        "?seed=1401193544&debug=1&contract=orchard-loop",
      ),
    ).toBe("?seed=4055629313&debug=1&contract=brook-bend");
    expect(
      contractNavigationSearch(
        2415055461,
        nextAuthoredContractId("brook-bend"),
        "?seed=4055629313&debug=1&contract=brook-bend",
      ),
    ).toBe("?seed=2415055461&debug=1&contract=harvest-spiral");
    expect(
      contractNavigationSearch(
        774553834,
        nextAuthoredContractId("harvest-spiral"),
        "?seed=2415055461&debug=1&contract=harvest-spiral",
      ),
    ).toBe("?seed=774553834&debug=1&contract=crescent-grove");
    expect(
      contractNavigationSearch(
        2126699815,
        nextAuthoredContractId("crescent-grove"),
        "?seed=774553834&debug=1&contract=crescent-grove",
      ),
    ).toBe("?seed=2126699815&debug=1&contract=forked-thicket");
    expect(
      contractNavigationSearch(
        486168288,
        nextAuthoredContractId("forked-thicket"),
        "?seed=2126699815&debug=1&contract=forked-thicket",
      ),
    ).toBe("?seed=486168288&debug=1&contract=switchback-orchard");
    expect(
      contractNavigationSearch(
        3140604057,
        nextAuthoredContractId("switchback-orchard"),
        "?seed=486168288&debug=1&contract=switchback-orchard",
      ),
    ).toBe("?seed=3140604057&debug=1&contract=braided-meadow");
    expect(
      contractNavigationSearch(
        1500072530,
        nextAuthoredContractId("braided-meadow"),
        "?seed=3140604057&debug=1&contract=braided-meadow",
      ),
    ).toBe("?seed=1500072530&debug=1&contract=clear-every-patch");
    expect(
      contractNavigationSearch(
        774499206,
        nextAuthoredContractId("clear-every-patch"),
        "?seed=2415055461&debug=1&contract=clear-every-patch",
      ),
    ).toBe("?seed=774499206&debug=1");
  });
});

describe("contract best times", () => {
  it("uses a stable local-storage key", () => {
    expect(BEST_TIMES_STORAGE_KEY).toBe("grass-blade.best-times.v1");
  });

  it("parses only finite authored contract records", () => {
    expect(
      parseContractBestTimes(
        JSON.stringify({
          "meadow-delivery": 42.3456,
          "field-sprint": 38,
          "unknown-contract": 9,
          "flower-sweep": -1,
          "timed-harvest": "12",
        }),
      ),
    ).toEqual({
      "meadow-delivery": 42.346,
      "field-sprint": 38,
    });
    expect(parseContractBestTimes("{bad")).toEqual({});
    expect(parseContractBestTimes(null)).toEqual({});
  });

  it("updates a contract best time only when the completed run is faster", () => {
    const first = updateContractBestTime({}, "field-sprint", 44.9);
    expect(first).toEqual({
      bestTimes: { "field-sprint": 44.9 },
      bestSeconds: 44.9,
      isNewBest: true,
    });

    const slower = updateContractBestTime(first.bestTimes, "field-sprint", 45.2);
    expect(slower).toEqual({
      bestTimes: { "field-sprint": 44.9 },
      bestSeconds: 44.9,
      isNewBest: false,
    });

    const faster = updateContractBestTime(first.bestTimes, "field-sprint", 39.1119);
    expect(faster).toEqual({
      bestTimes: { "field-sprint": 39.112 },
      bestSeconds: 39.112,
      isNewBest: true,
    });
  });

  it("serializes best times in authored contract order", () => {
    expect(
      serializeContractBestTimes({
        "field-sprint": 39.1119,
        "meadow-delivery": 81,
      }),
    ).toBe('{"meadow-delivery":81,"field-sprint":39.112}');
  });

  it("derives target-time medals from balanced contract benchmarks", () => {
    expect(contractMedalTargets(contractById("field-sprint"))).toEqual({
      goldSeconds: 43,
      silverSeconds: 44,
      bronzeSeconds: 45,
    });
    expect(contractMedalTargets(contractById("timed-harvest"))).toEqual({
      goldSeconds: 57,
      silverSeconds: 59,
      bronzeSeconds: 60,
    });
    expect(contractMedalTargets(contractById("meadow-delivery"))).toEqual({
      goldSeconds: 29,
      silverSeconds: 33,
      bronzeSeconds: 38,
    });

    for (const contract of CONTRACT_DEFINITIONS as readonly ContractDefinition[]) {
      const targets = contractMedalTargets(contract);
      expect(targets.goldSeconds).toBeGreaterThan(0);
      expect(targets.silverSeconds).toBeGreaterThanOrEqual(targets.goldSeconds);
      expect(targets.bronzeSeconds).toBeGreaterThanOrEqual(targets.silverSeconds);
      if (contract.timeLimitSeconds !== undefined) {
        expect(targets.bronzeSeconds).toBe(contract.timeLimitSeconds);
      }
    }
  });

  it("awards the best medal reached by a completed time", () => {
    expect(contractMedalForTime("field-sprint", 43)).toBe("gold");
    expect(contractMedalForTime("field-sprint", 44)).toBe("silver");
    expect(contractMedalForTime("field-sprint", 45)).toBe("bronze");
    expect(contractMedalForTime("field-sprint", 46)).toBeNull();
    expect(contractMedalForTime("unknown-contract", 30)).toBeNull();
    expect(contractMedalForTime("field-sprint", null)).toBeNull();
    expect(contractMedalForTime("field-sprint", Number.NaN)).toBeNull();
  });

  it("summarizes saved medal progress across every authored contract", () => {
    expect(contractMedalSummary({})).toEqual({
      totalContracts: CONTRACT_DEFINITIONS.length,
      recordedContracts: 0,
      medaledContracts: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    });

    expect(
      contractMedalSummary({
        "field-sprint": 43,
        "meadow-delivery": 33,
        "timed-harvest": 60,
        "flower-sweep": 99,
      }),
    ).toEqual({
      totalContracts: CONTRACT_DEFINITIONS.length,
      recordedContracts: 4,
      medaledContracts: 3,
      gold: 1,
      silver: 1,
      bronze: 1,
    });
  });
});

describe("contract chooser filters", () => {
  it("derives compact card badges from contract pacing and quotas", () => {
    expect(contractCardBadges(contractById("meadow-delivery"))).toEqual([
      "No timer",
      "Wood",
      "Easy",
    ]);
    expect(contractCardBadges(contractById("field-sprint"))).toEqual([
      "45s",
      "Soft cuts",
      "Medium",
    ]);
    expect(contractCardBadges(contractById("timed-harvest"))).toEqual(["60s", "Fiber", "Hard"]);
    expect(contractCardBadges(contractById("timber-trail"))).toEqual(["90s", "Wood", "Expert"]);
    expect(contractCardBadges(contractById("clear-every-patch"))).toEqual([
      "Full clear",
      "Patch clear",
      "Expert",
    ]);
  });

  it("chooses a compact primary filter for each selected contract type", () => {
    expect(primaryContractFilterId(contractById("meadow-delivery"))).toBe("wood");
    expect(primaryContractFilterId(contractById("timber-trail"))).toBe("wood");
    expect(primaryContractFilterId(contractById("orchard-loop"))).toBe("wood");
    expect(primaryContractFilterId(contractById("crescent-grove"))).toBe("wood");
    expect(primaryContractFilterId(contractById("forked-thicket"))).toBe("wood");
    expect(primaryContractFilterId(contractById("switchback-orchard"))).toBe("wood");
    expect(primaryContractFilterId(contractById("braided-meadow"))).toBe("timed");
    expect(primaryContractFilterId(contractById("timed-harvest"))).toBe("timed");
    expect(primaryContractFilterId(contractById("reed-run"))).toBe("timed");
    expect(primaryContractFilterId(contractById("brook-bend"))).toBe("timed");
    expect(primaryContractFilterId(contractById("field-sprint"))).toBe("soft");
    expect(primaryContractFilterId(contractById("clear-every-patch"))).toBe("clear");
  });

  it("matches contracts by broad chooser categories", () => {
    const timberTrail = contractById("timber-trail");
    const timedHarvest = contractById("timed-harvest");
    const fieldSprint = contractById("field-sprint");
    const crescentGrove = contractById("crescent-grove");
    const forkedThicket = contractById("forked-thicket");
    const switchbackOrchard = contractById("switchback-orchard");
    const braidedMeadow = contractById("braided-meadow");
    const reedRun = contractById("reed-run");
    const clearEveryPatch = contractById("clear-every-patch");

    expect(contractMatchesFilter(timberTrail, "all")).toBe(true);
    expect(contractMatchesFilter(timberTrail, "timed")).toBe(false);
    expect(contractMatchesFilter(timberTrail, "wood")).toBe(true);
    expect(contractMatchesFilter(timedHarvest, "timed")).toBe(true);
    expect(contractMatchesFilter(timedHarvest, "wood")).toBe(false);
    expect(contractMatchesFilter(fieldSprint, "soft")).toBe(true);
    expect(contractMatchesFilter(crescentGrove, "wood")).toBe(true);
    expect(contractMatchesFilter(crescentGrove, "timed")).toBe(false);
    expect(contractMatchesFilter(forkedThicket, "wood")).toBe(true);
    expect(contractMatchesFilter(forkedThicket, "timed")).toBe(false);
    expect(contractMatchesFilter(switchbackOrchard, "wood")).toBe(true);
    expect(contractMatchesFilter(switchbackOrchard, "timed")).toBe(false);
    expect(contractMatchesFilter(braidedMeadow, "timed")).toBe(true);
    expect(contractMatchesFilter(braidedMeadow, "soft")).toBe(false);
    expect(contractMatchesFilter(reedRun, "timed")).toBe(true);
    expect(contractMatchesFilter(reedRun, "wood")).toBe(false);
    expect(contractMatchesFilter(clearEveryPatch, "clear")).toBe(true);
  });
});

function createStyleTarget(): {
  style: Pick<
    CSSStyleDeclaration,
    "height" | "marginLeft" | "marginRight" | "removeProperty" | "width"
  >;
  removedProperties: string[];
} {
  const removedProperties: string[] = [];

  return {
    removedProperties,
    style: {
      width: "",
      height: "",
      marginLeft: "",
      marginRight: "",
      removeProperty(property: string): string {
        removedProperties.push(property);
        return "";
      },
    },
  };
}

function contractById(id: ContractDefinition["id"]): ContractDefinition {
  const contract = CONTRACT_DEFINITIONS.find((definition) => definition.id === id);
  if (contract === undefined) {
    throw new Error(`Missing test contract: ${id}`);
  }
  return contract;
}

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

describe("motion settings", () => {
  it("lets query-string reduced motion override standard media settings", () => {
    expect(
      resolveMotionSettings({
        motionQuery: "reduced",
        prefersReducedMotion: false,
      }),
    ).toEqual({
      reducedMotion: true,
      motionSource: "query",
    });
  });

  it("lets query-string standard motion override reduced media settings", () => {
    expect(
      resolveMotionSettings({
        motionQuery: "standard",
        prefersReducedMotion: true,
      }),
    ).toEqual({
      reducedMotion: false,
      motionSource: "query",
    });
  });

  it("honors prefers-reduced-motion when no query override is present", () => {
    expect(
      resolveMotionSettings({
        motionQuery: null,
        prefersReducedMotion: true,
      }),
    ).toEqual({
      reducedMotion: true,
      motionSource: "prefers-reduced-motion",
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

  it("reports rock deflection audio diagnostics even without WebAudio support", () => {
    const audio = new GameAudio(resolveAudioSettings(new URLSearchParams("muted=1")));

    expect(audio.diagnostics.processedRockDeflections).toBe(0);
    expect(audio.diagnostics.lastRockDeflectionTargetId).toBeNull();

    audio.playRockDeflection("rock-5");

    expect(audio.diagnostics.processedRockDeflections).toBe(1);
    expect(audio.diagnostics.lastRockDeflectionTargetId).toBe("rock-5");

    audio.dispose();
  });
});
