import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createScene } from "../src/game/createScene";
import { resolveQualitySettings } from "../src/game/quality";
import { createInitialState } from "../src/game/state";
import { REDUCED_MOTION_FALL_TIMING, WOODY_FALL_TIMING } from "../src/game/vegetationFall";

function instanceMatrix(mesh: THREE.InstancedMesh, index: number): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

function expectMatrixClose(actual: THREE.Matrix4, expected: THREE.Matrix4): void {
  actual.elements.forEach((value, index) =>
    expect(value).toBeCloseTo(expected.elements[index]!, 5),
  );
}

describe("tree fruit attachment", () => {
  for (const contract of ["orchard-loop", "switchback-orchard", "long-orchard"] as const) {
    for (const reducedMotion of [false, true]) {
      it(`${contract} keeps fruit attached through sway, recovery and falling (reduced=${reducedMotion})`, () => {
        const meadow = createScene(12345, resolveQualitySettings(null), reducedMotion, contract);
        try {
          const state = createInitialState(12345, contract);
          const target = state.targets.find((candidate) => candidate.kind === "matureTree")!;
          const crowns = meadow.scene.getObjectByName("GB_MatureTreeCrowns") as THREE.InstancedMesh;
          const fruits = meadow.scene.getObjectByName("GB_MatureTreeFruit") as THREE.InstancedMesh;
          const originalCrown = instanceMatrix(crowns, 0);
          const originalFruit = [0, 1, 2].map((index) => instanceMatrix(fruits, index));
          const attachments = originalFruit.map((matrix) =>
            originalCrown.clone().invert().multiply(matrix),
          );
          const otherTreeFruit = instanceMatrix(fruits, 3);
          const assertAttached = (): void => {
            const crown = instanceMatrix(crowns, 0);
            for (let index = 0; index < 3; index += 1) {
              expectMatrixClose(
                instanceMatrix(fruits, index),
                crown.clone().multiply(attachments[index]!),
              );
            }
            expectMatrixClose(instanceMatrix(fruits, 3), otherTreeFruit);
          };

          state.player.x = target.x - 2;
          state.player.z = target.z;
          state.bladeContactTargetIds = [target.id];
          meadow.sync(state, 0.1);
          expect(instanceMatrix(crowns, 0).equals(originalCrown)).toBe(false);
          expect(instanceMatrix(fruits, 0).equals(originalFruit[0]!)).toBe(false);
          assertAttached();
          meadow.sync(state, 0.2);
          assertAttached();

          state.bladeContactTargetIds = [];
          meadow.sync(state, 0.3);
          expectMatrixClose(instanceMatrix(fruits, 0), originalFruit[0]!);

          target.status = "cut";
          meadow.sync(state, 1);
          assertAttached();
          const timing = reducedMotion ? REDUCED_MOTION_FALL_TIMING : WOODY_FALL_TIMING;
          meadow.sync(state, 1 + timing.tipSeconds / 2);
          assertAttached();
          expect(instanceMatrix(fruits, 0).getMaxScaleOnAxis()).toBeGreaterThan(0);
          meadow.sync(state, 1 + timing.tipSeconds + timing.holdSeconds + timing.shrinkSeconds / 2);
          assertAttached();
          expect(instanceMatrix(fruits, 0).getMaxScaleOnAxis()).toBeLessThan(
            originalFruit[0]!.getMaxScaleOnAxis(),
          );
          meadow.sync(
            state,
            1 + timing.tipSeconds + timing.holdSeconds + timing.shrinkSeconds + 0.01,
          );
          for (let index = 0; index < 3; index += 1) {
            expect(instanceMatrix(fruits, index).getMaxScaleOnAxis()).toBe(0);
          }
        } finally {
          meadow.dispose();
        }
      });
    }
  }

  it("never reveals fruit on non-orchard trees when their transforms change", () => {
    const meadow = createScene(12345, resolveQualitySettings(null), false);
    try {
      const state = createInitialState(12345);
      const target = state.targets.find((candidate) => candidate.kind === "matureTree")!;
      const fruits = meadow.scene.getObjectByName("GB_MatureTreeFruit") as THREE.InstancedMesh;
      state.bladeContactTargetIds = [target.id];
      meadow.sync(state, 0.1);
      expect(instanceMatrix(fruits, 0).getMaxScaleOnAxis()).toBe(0);
      target.status = "cut";
      meadow.sync(state, 1);
      meadow.sync(state, 1.4);
      expect(instanceMatrix(fruits, 0).getMaxScaleOnAxis()).toBe(0);
    } finally {
      meadow.dispose();
    }
  });
});
