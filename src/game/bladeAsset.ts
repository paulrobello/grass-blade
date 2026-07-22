export type BladeAssetLoadState = "procedural-fallback" | "loading" | "loaded" | "failed";

export interface BladeAssetContract {
  id: string;
  url: string;
  sourceGenerator: string;
  sweptRadius: number;
  spinAxis: "+Y";
  hubAtOrigin: true;
  nodes: {
    staticHub: string;
    twoArm: string;
    fourArm: string;
    saw: string;
  };
}

export const BLADE_ASSET_CONTRACT: BladeAssetContract = {
  id: "grass-blade-cutter-v1",
  url: "assets/blades/cutter-v1.glb",
  sourceGenerator: "tools/build_blade_asset.py",
  sweptRadius: 2.15,
  spinAxis: "+Y",
  hubAtOrigin: true,
  nodes: {
    staticHub: "GB_Hub_STATIC",
    twoArm: "GB_TwoArm_ROTATING",
    fourArm: "GB_FourArm_ROTATING",
    saw: "GB_Saw_ROTATING",
  },
};

export function resolveBladeAssetUrl(baseUrl: string): string {
  return `${baseUrl}${BLADE_ASSET_CONTRACT.url}`;
}
