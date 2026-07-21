import { describe, expect, it } from "vitest";

import {
  MAX_COLLECTION_MOTES,
  chooseCollectionMoteSlot,
  collectionMoteDurationSeconds,
  collectionResourceForKind,
  consumeNewCollectionMoteEvents,
  sampleCollectionMotePath,
  type CollectionMotePoolSlotState,
  type CollectionMoteSample,
  type CollectionResource,
} from "../src/game/collectionMotes";
import type { CutCompletionEvent } from "../src/game/state";

function createSample(): CollectionMoteSample {
  return { x: 0, y: 0, opacity: 0, scale: 0 };
}

function createFullPool(resource: CollectionResource): CollectionMotePoolSlotState[] {
  return Array.from({ length: MAX_COLLECTION_MOTES }, (_, index) => ({
    active: true,
    resource,
    bornAt: index,
  }));
}

function createCutEvent(revision: number): CutCompletionEvent {
  return {
    revision,
    targetId: `grass-${revision}`,
    kind: "grass",
    x: revision,
    z: -revision,
    yield: 1,
    xp: 1,
    levelBefore: 1,
    levelAfter: 1,
  };
}

describe("collection motes", () => {
  it("maps every authoritative target kind to its HUD resource", () => {
    expect(collectionResourceForKind("grass")).toBe("grass");
    expect(collectionResourceForKind("flower")).toBe("flowers");
    expect(collectionResourceForKind("denseWeed")).toBe("fiber");
    expect(collectionResourceForKind("sapling")).toBe("wood");
    expect(collectionResourceForKind("matureTree")).toBe("wood");
  });

  it("derives deterministic arc durations within the presentation contract", () => {
    const first = collectionMoteDurationSeconds(12345, 17, false);
    const replay = collectionMoteDurationSeconds(12345, 17, false);

    expect(replay).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0.28);
    expect(first).toBeLessThanOrEqual(0.45);
    for (let revision = 1; revision <= 256; revision += 1) {
      const duration = collectionMoteDurationSeconds(0x6a09e667, revision, false);
      expect(duration).toBeGreaterThanOrEqual(0.28);
      expect(duration).toBeLessThanOrEqual(0.45);
    }
    expect(collectionMoteDurationSeconds(12345, 17, true)).toBe(0.18);
  });

  it("preserves fixed-tick birth times when many ticks are advanced before rendering", () => {
    const events: CutCompletionEvent[] = [];
    const births: Array<{ revision: number; bornAt: number }> = [];
    let consumedEventCount = 0;
    const recordBirth = (event: CutCompletionEvent, bornAt: number): void => {
      births.push({ revision: event.revision, bornAt });
    };

    for (let tick = 1; tick <= 60; tick += 1) {
      if (tick === 12) {
        events.push(createCutEvent(1));
      }
      if (tick === 48) {
        events.push(createCutEvent(2));
      }
      consumedEventCount = consumeNewCollectionMoteEvents(
        events,
        consumedEventCount,
        tick / 60,
        recordBirth,
      );
    }

    expect(births).toEqual([
      { revision: 1, bornAt: 0.2 },
      { revision: 2, bornAt: 0.8 },
    ]);
    expect(1 - (births[0]?.bornAt ?? 1)).toBeGreaterThan(0.45);
    expect(1 - (births[1]?.bornAt ?? 1)).toBeLessThan(0.28);

    consumedEventCount = consumeNewCollectionMoteEvents(events, consumedEventCount, 1, recordBirth);
    expect(consumedEventCount).toBe(2);
    expect(births).toHaveLength(2);
  });

  it("samples a lifted arc with exact endpoints", () => {
    const sample = createSample();

    sampleCollectionMotePath(20, 200, 220, 40, 0, false, sample);
    expect(sample).toEqual({ x: 20, y: 200, opacity: 1, scale: 0.72 });

    sampleCollectionMotePath(20, 200, 220, 40, 0.5, false, sample);
    const linearMidpointY = 120;
    expect(sample.x).toBeGreaterThan(120);
    expect(sample.y).toBeLessThan(linearMidpointY);
    expect(sample.opacity).toBe(1);
    expect(sample.scale).toBeGreaterThan(1);

    sampleCollectionMotePath(20, 200, 220, 40, 1, false, sample);
    expect(sample.x).toBe(220);
    expect(sample.y).toBeCloseTo(40);
    expect(sample.opacity).toBe(0);
    expect(sample.scale).toBeCloseTo(0.72);
  });

  it("replaces the arc with a short destination fade for reduced motion", () => {
    const sample = createSample();

    sampleCollectionMotePath(20, 200, 220, 40, 0.5, true, sample);

    expect(sample).toEqual({ x: 220, y: 40, opacity: 1, scale: 1 });
  });

  it("uses an inactive slot before aggregating or recycling", () => {
    const slots: CollectionMotePoolSlotState[] = [
      { active: true, resource: "grass", bornAt: 1 },
      { active: false, resource: null, bornAt: 0 },
    ];

    expect(chooseCollectionMoteSlot(slots, "grass")).toEqual({
      index: 1,
      aggregate: false,
    });
  });

  it("aggregates into the newest matching resource when all 64 slots are active", () => {
    const slots = createFullPool("grass");

    expect(chooseCollectionMoteSlot(slots, "grass")).toEqual({
      index: MAX_COLLECTION_MOTES - 1,
      aggregate: true,
    });
  });

  it("recycles the oldest slot when a full pool has no matching resource", () => {
    const slots = createFullPool("flowers");

    expect(chooseCollectionMoteSlot(slots, "wood")).toEqual({
      index: 0,
      aggregate: false,
    });
  });
});
