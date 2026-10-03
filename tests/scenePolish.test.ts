import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { BLADE_ASSET_CONTRACT } from "../src/game/bladeAsset";
import { createScene } from "../src/game/createScene";
import { resolveQualitySettings } from "../src/game/quality";
import { createInitialState } from "../src/game/state";

function findMaterial(scene: THREE.Scene, objectName: string): THREE.Material {
  const object = scene.getObjectByName(objectName);
  expect(object).toBeDefined();
  expect(object).toBeInstanceOf(THREE.Mesh);
  const material = (object as THREE.Mesh).material;
  expect(material).toBeInstanceOf(THREE.Material);
  return material as THREE.Material;
}

describe("scene presentation polish", () => {
  it("exposes a contract-sized, restrained blade reach cue", () => {
    const meadow = createScene(12345, resolveQualitySettings(null), false);
    const ring = meadow.scene.getObjectByName("GB_BladeReachRing");

    expect(ring).toBeDefined();
    expect(meadow.presentation.bladeReachCueRadius).toBe(BLADE_ASSET_CONTRACT.sweptRadius);
    expect(meadow.presentation.bladeReachCueVisible).toBe(true);
    expect(
      (findMaterial(meadow.scene, "GB_BladeReachRing") as THREE.MeshBasicMaterial).opacity,
    ).toBe(0.13);
    meadow.dispose();
  });

  it("shows contact feedback without animating while reduced motion is enabled", () => {
    const meadow = createScene(12345, resolveQualitySettings(null), true);
    const state = createInitialState(12345);
    state.bladeContactTargetIds.push("contact");
    const material = findMaterial(meadow.scene, "GB_BladeContactRing") as THREE.MeshBasicMaterial;

    meadow.sync(state, 0);
    const firstOpacity = material.opacity;
    meadow.sync(state, 1);

    expect(meadow.presentation.bladeReachCueContactCount).toBe(1);
    expect(firstOpacity).toBe(0.34);
    expect(material.opacity).toBe(firstOpacity);
    meadow.dispose();
  });

  it("keeps the contact reach radius fixed while feedback pulses", () => {
    const meadow = createScene(12345, resolveQualitySettings(null), false);
    const state = createInitialState(12345);
    state.bladeContactTargetIds.push("contact");
    const ring = meadow.scene.getObjectByName("GB_BladeContactRing");
    expect(ring).toBeDefined();

    meadow.sync(state, 0.1);
    meadow.sync(state, 0.8);

    expect(ring?.scale.x).toBe(1);
    expect(ring?.scale.y).toBe(1);
    expect(ring?.scale.z).toBe(1);
    meadow.dispose();
  });

  it("suppresses contact feedback while paused", () => {
    const meadow = createScene(12345, resolveQualitySettings(null), false);
    const state = createInitialState(12345);
    state.mode = "paused";
    state.bladeContactTargetIds.push("contact");

    meadow.sync(state, 2);

    expect(meadow.presentation.bladeReachCueContactCount).toBe(1);
    expect(
      (findMaterial(meadow.scene, "GB_BladeContactRing") as THREE.MeshBasicMaterial).opacity,
    ).toBe(0);
    meadow.dispose();
  });
});
