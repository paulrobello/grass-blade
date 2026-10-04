import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createScene } from "../src/game/createScene";
import { resolveQualitySettings } from "../src/game/quality";
import { createInitialState } from "../src/game/state";
import {
  DENSE_WEED_FALL_TIMING,
  FLOWER_FALL_TIMING,
  REDUCED_MOTION_FALL_TIMING,
} from "../src/game/vegetationFall";
import { createMeadowLayout } from "../src/game/world";

function matrixAt(scene: THREE.Scene, name: string, index = 0): THREE.Matrix4 {
  const mesh = scene.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
  const matrix = new THREE.Matrix4();
  (mesh as THREE.InstancedMesh).getMatrixAt(index, matrix);
  return matrix;
}

function expectMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4): void {
  actual.elements.forEach((value, index) =>
    expect(value).toBeCloseTo(expected.elements[index]!, 5),
  );
}

describe("plant decorations", () => {
  for (const reduced of [false, true]) {
    for (const contract of ["berry-bloom", "hedge-maze"] as const) {
      it(`${contract} carries its decoration with the bush (reduced=${reduced})`, () => {
        const state = createInitialState(12345, contract);
        const meadow = createScene(12345, resolveQualitySettings(null), reduced, contract);
        try {
          const layout = createMeadowLayout(12345, contract);
          const index = layout.shrubTargets.findIndex((target) => target.collectible !== undefined);
          const target = state.targets.find(
            (target) => target.id === layout.shrubTargets[index]!.id,
          )!;
          const body = (): THREE.Matrix4 => matrixAt(meadow.scene, "GB_Shrubs", index);
          const berry = (): THREE.Matrix4 => matrixAt(meadow.scene, "GB_ShrubBerries", index);
          const original = berry();
          const local = body().invert().multiply(original);
          const assertAttached = (): void => expectMatrix(berry(), body().multiply(local));

          state.bladeContactTargetIds = [target.id];
          meadow.sync(state, 0.1);
          expect(berry().equals(original)).toBe(false);
          assertAttached();
          meadow.sync(state, 0.2);
          assertAttached();
          state.bladeContactTargetIds = [];
          meadow.sync(state, 0.3);
          expectMatrix(berry(), original);

          target.status = "cut";
          const timing = reduced ? REDUCED_MOTION_FALL_TIMING : DENSE_WEED_FALL_TIMING;
          meadow.sync(state, 1);
          for (const age of [
            timing.tipSeconds / 2,
            timing.tipSeconds + timing.holdSeconds + timing.shrinkSeconds / 2,
          ]) {
            meadow.sync(state, 1 + age);
            assertAttached();
            expect(berry().getMaxScaleOnAxis()).toBeGreaterThan(0);
          }
          meadow.sync(
            state,
            1 + timing.tipSeconds + timing.holdSeconds + timing.shrinkSeconds + 0.01,
          );
          expect(berry().getMaxScaleOnAxis()).toBe(0);
        } finally {
          meadow.dispose();
        }
      });
    }

    it(`keeps flower centers attached to the bending petals (reduced=${reduced})`, () => {
      const state = createInitialState(12345);
      const meadow = createScene(12345, resolveQualitySettings(null), reduced);
      try {
        const head = (): THREE.Matrix4 => matrixAt(meadow.scene, "GB_FlowerHeads");
        const center = (): THREE.Matrix4 => matrixAt(meadow.scene, "GB_FlowerCenters");
        const local = head().invert().multiply(center());
        state.targets.find((target) => target.kind === "flower")!.status = "cut";
        const timing = reduced ? REDUCED_MOTION_FALL_TIMING : FLOWER_FALL_TIMING;
        meadow.sync(state, 1);
        for (const age of [
          timing.tipSeconds / 2,
          timing.tipSeconds + timing.holdSeconds + timing.shrinkSeconds / 2,
        ]) {
          meadow.sync(state, 1 + age);
          expectMatrix(center(), head().multiply(local));
        }
      } finally {
        meadow.dispose();
      }
    });

    it(`keeps crop leaf and berry anchors on their falling stem (reduced=${reduced})`, () => {
      const state = createInitialState(12345);
      const meadow = createScene(12345, resolveQualitySettings(null), reduced);
      try {
        const names = ["GB_CropLeaves", "GB_CropBerries"];
        const localPoints = names.map((name) =>
          new THREE.Vector3()
            .setFromMatrixPosition(matrixAt(meadow.scene, name))
            .applyMatrix4(matrixAt(meadow.scene, "GB_CropStems").invert()),
        );
        state.targets.find((target) => target.kind === "softCrop")!.status = "cut";
        meadow.sync(state, 1);
        const timing = reduced ? REDUCED_MOTION_FALL_TIMING : FLOWER_FALL_TIMING;
        for (const age of [
          timing.tipSeconds / 2,
          timing.tipSeconds + timing.holdSeconds + timing.shrinkSeconds / 2,
        ]) {
          meadow.sync(state, 1 + age);
          names.forEach((name, index) => {
            const actual = new THREE.Vector3().setFromMatrixPosition(matrixAt(meadow.scene, name));
            const expected = localPoints[index]!.clone().applyMatrix4(
              matrixAt(meadow.scene, "GB_CropStems"),
            );
            expect(actual.distanceTo(expected)).toBeLessThan(0.00001);
          });
        }
        meadow.sync(state, 3);
        for (const name of names) expect(matrixAt(meadow.scene, name).getMaxScaleOnAxis()).toBe(0);
      } finally {
        meadow.dispose();
      }
    });

    it(`keeps undecorated bushes undecorated (reduced=${reduced})`, () => {
      const state = createInitialState(12345);
      const meadow = createScene(12345, resolveQualitySettings(null), reduced);
      try {
        const target = state.targets.find((target) => target.kind === "shrub")!;
        state.bladeContactTargetIds = [target.id];
        meadow.sync(state, 0.1);
        expect(matrixAt(meadow.scene, "GB_ShrubBerries").getMaxScaleOnAxis()).toBe(0);
        target.status = "cut";
        meadow.sync(state, 1);
        meadow.sync(state, 1.2);
        expect(matrixAt(meadow.scene, "GB_ShrubBerries").getMaxScaleOnAxis()).toBe(0);
      } finally {
        meadow.dispose();
      }
    });

    it(`moves sapling foliage with the severed trunk (reduced=${reduced})`, () => {
      const state = createInitialState(12345);
      const meadow = createScene(12345, resolveQualitySettings(null), reduced);
      try {
        const target = state.targets.find((target) => target.kind === "sapling")!;
        const names = ["GB_SaplingLowerCrowns", "GB_SaplingTipCrowns"];
        meadow.sync(state, 0);
        const standing = names.map((name) => matrixAt(meadow.scene, name));
        state.bladeContactTargetIds = [target.id];
        meadow.sync(state, 0.1);
        names.forEach((name, index) =>
          expect(matrixAt(meadow.scene, name).equals(standing[index]!)).toBe(false),
        );
        state.bladeContactTargetIds = [];
        meadow.sync(state, 0.3);
        names.forEach((name, index) =>
          expectMatrix(matrixAt(meadow.scene, name), standing[index]!),
        );
        target.status = "cut";
        meadow.sync(state, 1);
        const local = names.map((name) =>
          matrixAt(meadow.scene, "GB_SaplingTrunks")
            .invert()
            .multiply(matrixAt(meadow.scene, name)),
        );
        meadow.sync(state, reduced ? 1.06 : 1.3);
        names.forEach((name, index) =>
          expectMatrix(
            matrixAt(meadow.scene, name),
            matrixAt(meadow.scene, "GB_SaplingTrunks").multiply(local[index]!),
          ),
        );
        meadow.sync(state, 3);
        names.forEach((name) => expect(matrixAt(meadow.scene, name).getMaxScaleOnAxis()).toBe(0));
      } finally {
        meadow.dispose();
      }
    });
  }
});
