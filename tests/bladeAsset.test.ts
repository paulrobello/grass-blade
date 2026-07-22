import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import { BLADE_ASSET_CONTRACT, resolveBladeAssetUrl } from "../src/game/bladeAsset";

declare const process: { cwd: () => string };

async function readGlbJson(path: string): Promise<unknown> {
  const data = await readFile(path);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  const jsonChunkLength = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  expect(magic).toBe(0x46546c67);
  expect(version).toBe(2);
  expect(length).toBe(data.length);
  expect(jsonChunkType).toBe(0x4e4f534a);
  return JSON.parse(new TextDecoder().decode(data.subarray(20, 20 + jsonChunkLength)).trim());
}

describe("blade asset contract", () => {
  it("declares the browser GLB path and gameplay-independent metadata", () => {
    expect(BLADE_ASSET_CONTRACT).toMatchObject({
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
    });
    expect(resolveBladeAssetUrl("./")).toBe("./assets/blades/cutter-v1.glb");
  });

  it("ships a GLB with the required stable root nodes and mesh content", async () => {
    const assetPath = `${process.cwd()}/public/assets/blades/cutter-v1.glb`;
    const glb = (await readGlbJson(assetPath)) as {
      nodes?: Array<{ name?: string }>;
      meshes?: unknown[];
      materials?: Array<{ name?: string }>;
    };
    const nodeNames = new Set((glb.nodes ?? []).map((node) => node.name));
    const materialNames = new Set((glb.materials ?? []).map((material) => material.name));

    for (const nodeName of Object.values(BLADE_ASSET_CONTRACT.nodes)) {
      expect(nodeNames.has(nodeName)).toBe(true);
    }
    expect(materialNames.has("GB_Orientation_Cyan")).toBe(true);
    expect(materialNames.has("GB_Orientation_Gold")).toBe(false);
    expect(glb.meshes?.length ?? 0).toBeGreaterThanOrEqual(30);
    expect(glb.materials?.length ?? 0).toBeGreaterThanOrEqual(5);
  });
});
