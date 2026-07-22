export type QualityPreset = "default" | "low";

export interface QualitySettings {
  preset: QualityPreset;
  antialias: boolean;
  maxPixelRatio: number;
  grassBladesPerVisual: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
}

const DEFAULT_QUALITY: QualitySettings = {
  preset: "default",
  antialias: true,
  maxPixelRatio: 1.5,
  grassBladesPerVisual: 14,
  shadowsEnabled: true,
  shadowMapSize: 1024,
};

const LOW_QUALITY: QualitySettings = {
  preset: "low",
  antialias: false,
  maxPixelRatio: 1,
  grassBladesPerVisual: 8,
  shadowsEnabled: false,
  shadowMapSize: 0,
};

export function resolveQualitySettings(rawPreset: string | null): QualitySettings {
  if (rawPreset === "low") {
    return LOW_QUALITY;
  }

  return DEFAULT_QUALITY;
}
