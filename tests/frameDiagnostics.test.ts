import { describe, expect, it } from "vitest";

import { createFrameDiagnosticsTracker } from "../src/game/frameDiagnostics";

describe("frame diagnostics", () => {
  it("summarizes recent frame timing in a fixed-size sample window", () => {
    const tracker = createFrameDiagnosticsTracker(4);

    tracker.recordFrameDelta(0.01);
    tracker.recordFrameDelta(0.02);
    tracker.recordFrameDelta(0.03);
    tracker.recordFrameDelta(0.04);
    tracker.recordFrameDelta(0.05);

    expect(
      tracker.snapshot({
        accumulatorSeconds: 0.0045,
        pixelRatio: 1.5,
        canvasWidth: 1280,
        canvasHeight: 720,
      }),
    ).toEqual({
      sampleCapacity: 4,
      sampledFrames: 4,
      totalFrames: 5,
      lastFrameMs: 50,
      averageFrameMs: 35,
      p95FrameMs: 50,
      maxFrameMs: 50,
      accumulatorMs: 4.5,
      pixelRatio: 1.5,
      canvasWidth: 1280,
      canvasHeight: 720,
    });
  });

  it("ignores invalid frame deltas and reports an empty snapshot before samples", () => {
    const tracker = createFrameDiagnosticsTracker(3);

    tracker.recordFrameDelta(Number.NaN);
    tracker.recordFrameDelta(-0.01);

    expect(
      tracker.snapshot({
        accumulatorSeconds: 0,
        pixelRatio: 2,
        canvasWidth: 1,
        canvasHeight: 1,
      }),
    ).toEqual({
      sampleCapacity: 3,
      sampledFrames: 0,
      totalFrames: 0,
      lastFrameMs: 0,
      averageFrameMs: 0,
      p95FrameMs: 0,
      maxFrameMs: 0,
      accumulatorMs: 0,
      pixelRatio: 2,
      canvasWidth: 1,
      canvasHeight: 1,
    });
  });
});
