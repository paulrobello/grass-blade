export type QualityPreset = "default" | "low";

export interface QualitySettings {
  preset: QualityPreset;
  maxPixelRatio: number;
}

const DEFAULT_QUALITY: QualitySettings = {
  preset: "default",
  maxPixelRatio: 1.5,
};

const LOW_QUALITY: QualitySettings = {
  preset: "low",
  maxPixelRatio: 1,
};

export function resolveQualitySettings(rawPreset: string | null): QualitySettings {
  if (rawPreset === "low") {
    return LOW_QUALITY;
  }

  return DEFAULT_QUALITY;
}
