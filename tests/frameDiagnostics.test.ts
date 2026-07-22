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
        qualityPreset: "default",
        antialias: true,
        maxPixelRatio: 1.5,
        grassBladesPerVisual: 14,
        shadowsEnabled: true,
        shadowMapSize: 1024,
        canvasWidth: 1280,
        canvasHeight: 720,
        canvasCssWidth: 853.33,
        canvasCssHeight: 480,
        displayAspectRatio: 16 / 9,
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
      qualityPreset: "default",
      antialias: true,
      maxPixelRatio: 1.5,
      grassBladesPerVisual: 14,
      shadowsEnabled: true,
      shadowMapSize: 1024,
      canvasWidth: 1280,
      canvasHeight: 720,
      canvasCssWidth: 853.33,
      canvasCssHeight: 480,
      canvasBackingAspectRatio: 1.778,
      displayAspectRatio: 1.778,
      canvasAspectMismatchRatio: 1,
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
        qualityPreset: "low",
        antialias: false,
        maxPixelRatio: 1,
        grassBladesPerVisual: 8,
        shadowsEnabled: false,
        shadowMapSize: 0,
        canvasWidth: 1,
        canvasHeight: 1,
        canvasCssWidth: 375,
        canvasCssHeight: 667,
        displayAspectRatio: 375 / 667,
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
      qualityPreset: "low",
      antialias: false,
      maxPixelRatio: 1,
      grassBladesPerVisual: 8,
      shadowsEnabled: false,
      shadowMapSize: 0,
      canvasWidth: 1,
      canvasHeight: 1,
      canvasCssWidth: 375,
      canvasCssHeight: 667,
      canvasBackingAspectRatio: 1,
      displayAspectRatio: 0.562,
      canvasAspectMismatchRatio: 0.562,
    });
  });
});
