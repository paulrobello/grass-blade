import { describe, expect, it } from "vitest";

import { sampleArenaPreview } from "../src/game/levelPreview";

describe("level previews", () => {
  it("samples every authored arena into a bounded logical grid", () => {
    const contractIds = [
      "meadow-delivery",
      "flower-sweep",
      "woodland-cleanup",
      "timber-trail",
      "pocket-garden",
      "long-orchard",
      "crescent-wetland",
    ] as const;
    const footprints = new Set<string>();
    for (const contractId of contractIds) {
      const cells = sampleArenaPreview(contractId);
      expect(cells).toHaveLength(26 * 26);
      expect(cells.some(Boolean)).toBe(true);
      expect(cells.some((cell) => !cell)).toBe(true);
      footprints.add(cells.map((cell) => (cell ? "1" : "0")).join(""));
    }
    expect(footprints.size).toBe(contractIds.length);
  });
});
