export const FRAME_DIAGNOSTIC_SAMPLE_CAPACITY = 180;

export interface FrameDiagnosticsSnapshot {
  sampleCapacity: number;
  sampledFrames: number;
  totalFrames: number;
  lastFrameMs: number;
  averageFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  accumulatorMs: number;
  pixelRatio: number;
  qualityPreset: string;
  maxPixelRatio: number;
  grassBladesPerVisual: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface FrameDiagnosticsTracker {
  recordFrameDelta: (deltaSeconds: number) => void;
  snapshot: (options: {
    accumulatorSeconds: number;
    pixelRatio: number;
    qualityPreset: string;
    maxPixelRatio: number;
    grassBladesPerVisual: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => FrameDiagnosticsSnapshot;
}

export function createFrameDiagnosticsTracker(
  sampleCapacity = FRAME_DIAGNOSTIC_SAMPLE_CAPACITY,
): FrameDiagnosticsTracker {
  const samples = new Float32Array(sampleCapacity);
  let writeIndex = 0;
  let sampledFrames = 0;
  let totalFrames = 0;
  let sampleSumMs = 0;
  let sampleMaxMs = 0;
  let lastFrameMs = 0;

  function recordFrameDelta(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      return;
    }

    const frameMs = deltaSeconds * 1000;
    const replacedMs = samples[writeIndex] ?? 0;
    if (sampledFrames === sampleCapacity) {
      sampleSumMs -= replacedMs;
    } else {
      sampledFrames += 1;
    }

    samples[writeIndex] = frameMs;
    writeIndex = (writeIndex + 1) % sampleCapacity;
    sampleSumMs += frameMs;
    totalFrames += 1;
    lastFrameMs = frameMs;

    if (frameMs >= sampleMaxMs || replacedMs >= sampleMaxMs) {
      sampleMaxMs = maxSample(samples, sampledFrames);
    }
  }

  function snapshot(options: {
    accumulatorSeconds: number;
    pixelRatio: number;
    qualityPreset: string;
    maxPixelRatio: number;
    grassBladesPerVisual: number;
    canvasWidth: number;
    canvasHeight: number;
  }): FrameDiagnosticsSnapshot {
    return {
      sampleCapacity,
      sampledFrames,
      totalFrames,
      lastFrameMs: roundFrameMetric(lastFrameMs),
      averageFrameMs: roundFrameMetric(sampledFrames === 0 ? 0 : sampleSumMs / sampledFrames),
      p95FrameMs: roundFrameMetric(percentileSample(samples, sampledFrames, 0.95)),
      maxFrameMs: roundFrameMetric(sampleMaxMs),
      accumulatorMs: roundFrameMetric(options.accumulatorSeconds * 1000),
      pixelRatio: roundFrameMetric(options.pixelRatio),
      qualityPreset: options.qualityPreset,
      maxPixelRatio: roundFrameMetric(options.maxPixelRatio),
      grassBladesPerVisual: options.grassBladesPerVisual,
      canvasWidth: options.canvasWidth,
      canvasHeight: options.canvasHeight,
    };
  }

  return { recordFrameDelta, snapshot };
}

function percentileSample(samples: Float32Array, sampleCount: number, percentile: number): number {
  if (sampleCount === 0) {
    return 0;
  }

  const sortedSamples = Array.from(samples.slice(0, sampleCount)).sort((a, b) => a - b);
  const index = Math.ceil(sampleCount * percentile) - 1;
  return sortedSamples[Math.min(Math.max(index, 0), sampleCount - 1)] ?? 0;
}

function maxSample(samples: Float32Array, sampleCount: number): number {
  let max = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    max = Math.max(max, samples[index] ?? 0);
  }
  return max;
}

function roundFrameMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
