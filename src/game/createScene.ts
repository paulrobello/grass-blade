import * as THREE from "three";

import { createCutEffects } from "./cutEffects";
import type { QualitySettings } from "./quality";
import type { GameState } from "./state";
import { WORLD_HALF_EXTENT } from "./state";
import {
  DENSE_WEED_FALL_TIMING,
  FLOWER_FALL_TIMING,
  GRASS_FALL_TIMING,
  REDUCED_MOTION_FALL_TIMING,
  WOODY_FALL_TIMING,
  sampleVegetationFall,
  transformRootedFallPoint,
  type RootedFallPosition,
  type VegetationFallSample,
} from "./vegetationFall";
import {
  createMeadowLayout,
  createMeadowDensityReport,
  FLOWER_VISUAL_COUNT,
  GRASS_VISUAL_COLUMNS,
  type MeadowLayout,
  type MeadowDensityReport,
} from "./world";

const CAMERA_OFFSET_X = 8.5;
const CAMERA_OFFSET_Y = 22;
const CAMERA_OFFSET_Z = 8.5;
const CAMERA_VIEW_HEIGHT = 15.5;
const BLADE_VISUAL_SPIN_SCALE = 0.0775;

interface VegetationSync {
  syncTargets: (state: GameState, simulationTimeSeconds: number) => void;
}

interface FallingVegetationSync extends VegetationSync {
  diagnostics: {
    activeFalls: number;
  };
}

export type BladeTier = "two-arm" | "four-arm" | "saw";

export interface MeadowPresentationDiagnostics {
  bladeTier: BladeTier;
  visibleBladeCount: number;
  visibleTeeth: number;
  orientationCueCount: number;
  visualBladeAngleRadians: number;
  fallingGrassTufts: number;
  fallingFlowerInstances: number;
  fallingWeedInstances: number;
  fallingShrubInstances: number;
  fallingSaplingInstances: number;
  fallingTreeInstances: number;
  activeFragments: number;
  consumedCutRevision: number;
  consumedGrassVisualCuts: number;
}

interface BladeVisual {
  diagnostics: Pick<
    MeadowPresentationDiagnostics,
    | "bladeTier"
    | "visibleBladeCount"
    | "visibleTeeth"
    | "orientationCueCount"
    | "visualBladeAngleRadians"
  >;
  sync: (level: number, angleRadians: number) => void;
}

export interface MeadowScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  density: {
    grassInstances: number;
    grassBlades: number;
    flowerInstances: number;
    weedInstances: number;
    shrubInstances: number;
    saplingInstances: number;
    treeInstances: number;
    rockInstances: number;
    report: MeadowDensityReport;
  };
  presentation: MeadowPresentationDiagnostics;
  resize: (aspect: number) => void;
  sync: (state: GameState, simulationTimeSeconds: number) => void;
  dispose: () => void;
}

export function createScene(seed: number, quality: QualitySettings): MeadowScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb5df8b);
  scene.fog = new THREE.Fog(0xb5df8b, 28, 58);

  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  const layout = createMeadowLayout(seed);
  const densityReport = createMeadowDensityReport(layout, quality.grassBladesPerVisual);
  const random = createSeededRandom(seed);
  const scratchMatrix = new THREE.Matrix4();
  const scratchPosition = new THREE.Vector3();
  const scratchRotation = new THREE.Quaternion();
  const scratchScale = new THREE.Vector3();
  const scratchColor = new THREE.Color();
  const cameraTarget = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const groundGeometry = track(resources, new THREE.PlaneGeometry(80, 80));
  const groundMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x74c85c,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  addGroundPatches(
    scene,
    resources,
    random,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
  );
  const grass = addGrass(
    scene,
    resources,
    layout,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    yAxis,
    reducedMotion,
    quality.grassBladesPerVisual,
  );
  const flowers = addFlowers(
    scene,
    resources,
    layout,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    yAxis,
    reducedMotion,
  );
  const weeds = addDenseWeeds(
    scene,
    resources,
    layout,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    yAxis,
    reducedMotion,
  );
  const shrubs = addShrubs(
    scene,
    resources,
    layout,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    yAxis,
    reducedMotion,
  );
  const saplings = addSaplings(
    scene,
    resources,
    layout,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    yAxis,
    reducedMotion,
  );
  const trees = addTrees(
    scene,
    resources,
    layout,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    reducedMotion,
  );
  addRocks(
    scene,
    resources,
    layout,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    yAxis,
  );
  addBoundaryStones(
    scene,
    resources,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    yAxis,
  );

  const cutEffects = createCutEffects(scene, seed, reducedMotion);
  const playerRoot = new THREE.Group();
  const blade = addBlade(playerRoot, resources);
  scene.add(playerRoot);

  const presentation: MeadowPresentationDiagnostics = {
    bladeTier: blade.diagnostics.bladeTier,
    visibleBladeCount: blade.diagnostics.visibleBladeCount,
    visibleTeeth: blade.diagnostics.visibleTeeth,
    orientationCueCount: blade.diagnostics.orientationCueCount,
    visualBladeAngleRadians: blade.diagnostics.visualBladeAngleRadians,
    fallingGrassTufts: 0,
    fallingFlowerInstances: 0,
    fallingWeedInstances: 0,
    fallingShrubInstances: 0,
    fallingSaplingInstances: 0,
    fallingTreeInstances: 0,
    activeFragments: 0,
    consumedCutRevision: 0,
    consumedGrassVisualCuts: 0,
  };

  const hemisphere = new THREE.HemisphereLight(0xeafcff, 0x4f8a3f, 2.4);
  scene.add(hemisphere);

  const sunlight = new THREE.DirectionalLight(0xfff4d0, 3.1);
  sunlight.position.set(14, 24, 10);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -28;
  sunlight.shadow.camera.right = 28;
  sunlight.shadow.camera.top = 28;
  sunlight.shadow.camera.bottom = -28;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 60;
  sunlight.shadow.bias = -0.0004;
  scene.add(sunlight);

  const fillLight = new THREE.DirectionalLight(0x9edbff, 0.8);
  fillLight.position.set(-10, 8, -14);
  scene.add(fillLight);

  function sync(state: GameState, simulationTimeSeconds: number): void {
    playerRoot.position.set(state.player.x, 0, state.player.z);
    blade.sync(state.player.level, state.player.bladeAngleRadians);

    grass.syncTargets(state, simulationTimeSeconds);
    flowers.syncTargets(state, simulationTimeSeconds);
    weeds.syncTargets(state, simulationTimeSeconds);
    shrubs.syncTargets(state, simulationTimeSeconds);
    saplings.syncTargets(state, simulationTimeSeconds);
    trees.syncTargets(state, simulationTimeSeconds);
    cutEffects.sync(state, simulationTimeSeconds);

    presentation.bladeTier = blade.diagnostics.bladeTier;
    presentation.visibleBladeCount = blade.diagnostics.visibleBladeCount;
    presentation.visibleTeeth = blade.diagnostics.visibleTeeth;
    presentation.orientationCueCount = blade.diagnostics.orientationCueCount;
    presentation.visualBladeAngleRadians = blade.diagnostics.visualBladeAngleRadians;
    presentation.fallingGrassTufts = grass.diagnostics.activeFalls;
    presentation.fallingFlowerInstances = flowers.diagnostics.activeFalls;
    presentation.fallingWeedInstances = weeds.diagnostics.activeFalls;
    presentation.fallingShrubInstances = shrubs.diagnostics.activeFalls;
    presentation.fallingSaplingInstances = saplings.diagnostics.activeFalls;
    presentation.fallingTreeInstances = trees.diagnostics.activeFalls;
    presentation.activeFragments = cutEffects.diagnostics.activeFragments;
    presentation.consumedCutRevision = cutEffects.diagnostics.consumedCutRevision;
    presentation.consumedGrassVisualCuts = cutEffects.diagnostics.consumedGrassVisualCuts;

    camera.position.set(
      state.player.x + CAMERA_OFFSET_X,
      CAMERA_OFFSET_Y,
      state.player.z + CAMERA_OFFSET_Z,
    );
    cameraTarget.set(state.player.x, 0.35, state.player.z);
    camera.lookAt(cameraTarget);
  }

  function resize(aspect: number): void {
    const halfHeight = CAMERA_VIEW_HEIGHT / 2;
    const halfWidth = halfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  function dispose(): void {
    cutEffects.dispose();
    for (const resource of resources) {
      resource.dispose();
    }
  }

  return {
    scene,
    camera,
    density: {
      grassInstances: GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS,
      grassBlades: GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * quality.grassBladesPerVisual,
      flowerInstances: FLOWER_VISUAL_COUNT,
      weedInstances: layout.denseWeedVisuals.length,
      shrubInstances: layout.shrubVisuals.length,
      saplingInstances: layout.saplingVisuals.length,
      treeInstances: layout.matureTreeVisuals.length,
      rockInstances: layout.rockVisuals.length,
      report: densityReport,
    },
    presentation,
    resize,
    sync,
    dispose,
  };
}

export function deriveReadableBladeAngle(angleRadians: number): number {
  return (angleRadians * BLADE_VISUAL_SPIN_SCALE) % (Math.PI * 2);
}

export function accumulateReadableBladeAngle(
  previousRawAngleRadians: number,
  currentRawAngleRadians: number,
  previousVisualAngleRadians: number,
): number {
  const rawDelta = (currentRawAngleRadians - previousRawAngleRadians + Math.PI * 2) % (Math.PI * 2);
  return (previousVisualAngleRadians + deriveReadableBladeAngle(rawDelta)) % (Math.PI * 2);
}

function addGroundPatches(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  random: () => number,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
): void {
  const count = 24;
  const geometry = track(resources, new THREE.CylinderGeometry(1, 1, 0.035, 18));
  const material = track(
    resources,
    new THREE.MeshStandardMaterial({ color: 0x66b953, roughness: 1 }),
  );
  const patches = new THREE.InstancedMesh(geometry, material, count);

  for (let index = 0; index < count; index += 1) {
    const radius = 0.8 + random() * 1.7;
    position.set(randomRange(random, -19, 19), 0.012, randomRange(random, -19, 19));
    rotation.identity();
    scale.set(radius, 1, radius * (0.65 + random() * 0.45));
    matrix.compose(position, rotation, scale);
    patches.setMatrixAt(index, matrix);
  }

  patches.receiveShadow = true;
  patches.instanceMatrix.needsUpdate = true;
  scene.add(patches);
}

function addGrass(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  layout: MeadowLayout,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
  reducedMotion: boolean,
  grassBladesPerVisual: number,
): FallingVegetationSync {
  const count = layout.grassVisuals.length;
  const geometry = track(resources, createGrassClumpGeometry(grassBladesPerVisual));
  const material = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  );
  const grass = new THREE.InstancedMesh(geometry, material, count);
  const palette = [0x227a38, 0x2f9640, 0x43ad48, 0x62c94f] as const;
  const cutMatrices = new Float32Array(count * 16);
  const fallStartTimes = new Float32Array(count);
  const fallDirections = new Float32Array(count);
  const fallingVisualIndices: number[] = [];
  const yawRotation = new THREE.Quaternion();
  const fallRotation = new THREE.Quaternion();
  const fallAxis = new THREE.Vector3();
  const fallSample: VegetationFallSample = {
    stage: "waiting",
    tiltRadians: 0,
    visibilityScale: 1,
  };
  const fallTiming = reducedMotion ? REDUCED_MOTION_FALL_TIMING : GRASS_FALL_TIMING;
  const diagnostics = { activeFalls: 0 };
  let appliedCutVisualCount = 0;

  fallStartTimes.fill(-1);

  for (let index = 0; index < count; index += 1) {
    const visual = layout.grassVisuals[index];
    if (visual === undefined) {
      continue;
    }

    position.set(visual.x, 0.015, visual.z);
    rotation.setFromAxisAngle(yAxis, visual.rotation);
    scale.set(visual.scaleX, visual.height, visual.scaleZ);
    matrix.compose(position, rotation, scale);
    grass.setMatrixAt(index, matrix);

    position.y = 0.018;
    rotation.setFromAxisAngle(yAxis, visual.rotation + 0.38);
    scale.set(visual.scaleX * 0.78, 0.04, visual.scaleZ * 0.78);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutMatrices, index, matrix);

    color.setHex(palette[visual.colorIndex] ?? palette[0]);
    grass.setColorAt(index, color);
  }

  grass.receiveShadow = true;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor !== null) {
    grass.instanceColor.needsUpdate = true;
  }
  scene.add(grass);

  return {
    diagnostics,
    syncTargets(state: GameState, simulationTimeSeconds: number): void {
      let matricesChanged = false;

      while (appliedCutVisualCount < state.cutGrassVisualIndices.length) {
        const visualIndex = state.cutGrassVisualIndices[appliedCutVisualCount];
        appliedCutVisualCount += 1;
        if (visualIndex === undefined || visualIndex < 0 || visualIndex >= count) {
          continue;
        }

        const visual = layout.grassVisuals[visualIndex];
        if (visual === undefined) {
          continue;
        }

        const travelSpeed = Math.hypot(state.player.vx, state.player.vz);
        const travelDirection =
          travelSpeed > 0.35 ? Math.atan2(state.player.vz, state.player.vx) : visual.rotation;
        const directionJitter = (((visualIndex * 37) % 31) / 30 - 0.5) * 0.8;
        fallDirections[visualIndex] = travelDirection + directionJitter;
        fallStartTimes[visualIndex] = simulationTimeSeconds;
        fallingVisualIndices.push(visualIndex);
      }

      let activeWriteIndex = 0;
      for (const visualIndex of fallingVisualIndices) {
        const visual = layout.grassVisuals[visualIndex];
        if (visual === undefined) {
          continue;
        }

        sampleVegetationFall(
          simulationTimeSeconds - (fallStartTimes[visualIndex] ?? simulationTimeSeconds),
          fallTiming,
          fallSample,
        );
        if (fallSample.stage === "complete") {
          readMatrix(matrix, cutMatrices, visualIndex);
          grass.setMatrixAt(visualIndex, matrix);
          matricesChanged = true;
          continue;
        }

        const fallDirection = fallDirections[visualIndex] ?? visual.rotation;
        fallAxis.set(Math.sin(fallDirection), 0, -Math.cos(fallDirection)).normalize();
        fallRotation.setFromAxisAngle(fallAxis, fallSample.tiltRadians);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation);
        rotation.copy(fallRotation).multiply(yawRotation);

        const stubbleProgress = 1 - fallSample.visibilityScale;
        const tiltProgress = fallSample.tiltRadians / fallTiming.maxTiltRadians;
        const fallenHeightScale = 1 - tiltProgress * 0.28;
        position.set(visual.x, 0.015 + stubbleProgress * 0.003, visual.z);
        scale.set(
          visual.scaleX * (1 - stubbleProgress * 0.22),
          visual.height * fallSample.visibilityScale * fallenHeightScale + 0.04 * stubbleProgress,
          visual.scaleZ * (1 - stubbleProgress * 0.22),
        );
        matrix.compose(position, rotation, scale);
        grass.setMatrixAt(visualIndex, matrix);
        fallingVisualIndices[activeWriteIndex] = visualIndex;
        activeWriteIndex += 1;
        matricesChanged = true;
      }
      fallingVisualIndices.length = activeWriteIndex;
      diagnostics.activeFalls = activeWriteIndex;

      if (matricesChanged) {
        grass.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function createGrassClumpGeometry(grassBladesPerVisual: number): THREE.BufferGeometry {
  const positions: number[] = [];

  for (let index = 0; index < grassBladesPerVisual; index += 1) {
    const angle = index * 2.399963229728653;
    const radius = Math.sqrt((index + 0.5) / grassBladesPerVisual) * 0.21;
    appendGrassBlade(positions, {
      angle,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      width: 0.06 + ((index * 5) % 7) * 0.007,
      height: 0.62 + ((index * 7) % 11) * 0.038,
      lean: Math.sin(index * 1.73) * 0.11,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function appendGrassBlade(
  positions: number[],
  blade: {
    angle: number;
    x: number;
    z: number;
    width: number;
    height: number;
    lean: number;
  },
): void {
  const rightX = Math.cos(blade.angle);
  const rightZ = Math.sin(blade.angle);
  const forwardX = -rightZ;
  const forwardZ = rightX;
  const halfWidth = blade.width / 2;
  const tipX = blade.x + forwardX * blade.lean;
  const tipZ = blade.z + forwardZ * blade.lean;
  const baseLeft = [blade.x - rightX * halfWidth, 0, blade.z - rightZ * halfWidth] as const;
  const baseRight = [blade.x + rightX * halfWidth, 0, blade.z + rightZ * halfWidth] as const;
  const tip = [tipX, blade.height, tipZ] as const;

  appendTriangle(positions, baseLeft, baseRight, tip);
}

function appendTriangle(
  positions: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): void {
  positions.push(...a, ...b, ...c);
}

function addFlowers(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  layout: MeadowLayout,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
  reducedMotion: boolean,
): FallingVegetationSync {
  const count = layout.flowerVisuals.length;
  const stemGeometry = track(resources, new THREE.CylinderGeometry(0.038, 0.062, 0.82, 6));
  const stemMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({ color: 0x1f7d35, roughness: 0.88 }),
  );
  const headGeometry = track(resources, createFlowerHeadGeometry());
  const headMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  );
  const centerGeometry = track(resources, new THREE.SphereGeometry(0.075, 6, 4));
  const centerMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({ color: 0xffc928, roughness: 0.62, flatShading: true }),
  );
  const stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, count);
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, count);
  const centers = new THREE.InstancedMesh(centerGeometry, centerMaterial, count);
  const palette = [0xfff7d6, 0xff6fa9, 0xc675ff, 0xffffff, 0x6ec8ff] as const;
  const cutStemMatrices = new Float32Array(count * 16);
  const hiddenMatrices = new Float32Array(count * 16);
  const fallStartTimes = new Float32Array(count);
  const fallDirections = new Float32Array(count);
  const fallingVisualIndices: number[] = [];
  const yawRotation = new THREE.Quaternion();
  const fallRotation = new THREE.Quaternion();
  const headFallRotation = new THREE.Quaternion();
  const headRotation = new THREE.Quaternion();
  const fallAxis = new THREE.Vector3();
  const localOffset = new THREE.Vector3();
  const fallSample: VegetationFallSample = {
    stage: "waiting",
    tiltRadians: 0,
    visibilityScale: 1,
  };
  const fallTiming = reducedMotion ? REDUCED_MOTION_FALL_TIMING : FLOWER_FALL_TIMING;
  const fallStaggerSeconds = reducedMotion ? 0 : 0.1;
  const diagnostics = { activeFalls: 0 };
  const visualsByTarget = Array.from({ length: layout.flowerTargets.length }, () => [] as number[]);
  const queuedCutTargets = new Uint8Array(layout.flowerTargets.length);

  fallStartTimes.fill(-1);

  for (let index = 0; index < count; index += 1) {
    const visual = layout.flowerVisuals[index];
    if (visual === undefined) {
      continue;
    }

    visualsByTarget[visual.targetIndex]?.push(index);
    const flowerScale = visual.scale;
    rotation.setFromAxisAngle(yAxis, visual.rotation);
    position.set(visual.x, 0.41 * flowerScale, visual.z);
    scale.set(flowerScale * 0.86, flowerScale, flowerScale * 0.86);
    matrix.compose(position, rotation, scale);
    stems.setMatrixAt(index, matrix);

    position.y = 0.86 * flowerScale;
    scale.set(flowerScale * 1.08, flowerScale * 1.08, flowerScale * 1.08);
    matrix.compose(position, rotation, scale);
    heads.setMatrixAt(index, matrix);
    color.setHex(palette[visual.colorIndex] ?? palette[0]);
    heads.setColorAt(index, color);

    position.y = 0.9 * flowerScale;
    matrix.compose(position, rotation, scale);
    centers.setMatrixAt(index, matrix);

    position.set(visual.x, 0.05, visual.z);
    scale.set(flowerScale * 0.58, flowerScale * 0.1, flowerScale * 0.58);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutStemMatrices, index, matrix);

    position.set(visual.x, 0.02, visual.z);
    rotation.identity();
    scale.setScalar(0);
    matrix.compose(position, rotation, scale);
    writeMatrix(hiddenMatrices, index, matrix);
  }

  stems.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  centers.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor !== null) {
    heads.instanceColor.needsUpdate = true;
  }
  scene.add(stems, heads, centers);

  return {
    diagnostics,
    syncTargets(state: GameState, simulationTimeSeconds: number): void {
      const targetOffset = layout.grassCells.length;
      let matricesChanged = false;

      for (let targetIndex = 0; targetIndex < layout.flowerTargets.length; targetIndex += 1) {
        if (
          queuedCutTargets[targetIndex] === 1 ||
          state.targets[targetOffset + targetIndex]?.status !== "cut"
        ) {
          continue;
        }

        queuedCutTargets[targetIndex] = 1;
        const targetVisuals = visualsByTarget[targetIndex];
        if (targetVisuals === undefined) {
          continue;
        }

        for (const visualIndex of targetVisuals) {
          const visual = layout.flowerVisuals[visualIndex];
          if (visual === undefined) {
            continue;
          }

          const stagger = (((visualIndex * 17) % 11) / 10) * fallStaggerSeconds;
          const deltaX = visual.x - state.player.x;
          const deltaZ = visual.z - state.player.z;
          fallDirections[visualIndex] =
            Math.hypot(deltaX, deltaZ) > 0.05
              ? Math.atan2(deltaZ, deltaX)
              : visual.rotation + Math.PI * 0.5;
          fallStartTimes[visualIndex] = simulationTimeSeconds + stagger;
          fallingVisualIndices.push(visualIndex);
        }
      }

      let activeWriteIndex = 0;
      for (const visualIndex of fallingVisualIndices) {
        const visual = layout.flowerVisuals[visualIndex];
        if (visual === undefined) {
          continue;
        }

        sampleVegetationFall(
          simulationTimeSeconds - (fallStartTimes[visualIndex] ?? simulationTimeSeconds),
          fallTiming,
          fallSample,
        );
        if (fallSample.stage === "complete") {
          readMatrix(matrix, cutStemMatrices, visualIndex);
          stems.setMatrixAt(visualIndex, matrix);
          readMatrix(matrix, hiddenMatrices, visualIndex);
          heads.setMatrixAt(visualIndex, matrix);
          centers.setMatrixAt(visualIndex, matrix);
          matricesChanged = true;
          continue;
        }

        const fallDirection = fallDirections[visualIndex] ?? visual.rotation;
        fallAxis.set(Math.sin(fallDirection), 0, -Math.cos(fallDirection)).normalize();
        fallRotation.setFromAxisAngle(fallAxis, fallSample.tiltRadians);
        headFallRotation.setFromAxisAngle(fallAxis, fallSample.tiltRadians * 0.62);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation);
        rotation.copy(fallRotation).multiply(yawRotation);
        headRotation.copy(headFallRotation).multiply(yawRotation);

        const flowerScale = visual.scale;
        const visibilityScale = fallSample.visibilityScale;
        localOffset.set(0, 0.41 * flowerScale * visibilityScale, 0);
        localOffset.applyQuaternion(fallRotation);
        position.set(visual.x + localOffset.x, localOffset.y, visual.z + localOffset.z);
        scale.set(
          flowerScale * 0.86 * visibilityScale,
          flowerScale * visibilityScale,
          flowerScale * 0.86 * visibilityScale,
        );
        matrix.compose(position, rotation, scale);
        stems.setMatrixAt(visualIndex, matrix);

        localOffset.set(0, 0.86 * flowerScale * visibilityScale, 0);
        localOffset.applyQuaternion(fallRotation);
        position.set(visual.x + localOffset.x, localOffset.y, visual.z + localOffset.z);
        scale.setScalar(flowerScale * 1.08 * visibilityScale);
        matrix.compose(position, headRotation, scale);
        heads.setMatrixAt(visualIndex, matrix);

        localOffset.set(0, 0.9 * flowerScale * visibilityScale, 0);
        localOffset.applyQuaternion(fallRotation);
        position.set(visual.x + localOffset.x, localOffset.y, visual.z + localOffset.z);
        matrix.compose(position, headRotation, scale);
        centers.setMatrixAt(visualIndex, matrix);

        fallingVisualIndices[activeWriteIndex] = visualIndex;
        activeWriteIndex += 1;
        matricesChanged = true;
      }
      fallingVisualIndices.length = activeWriteIndex;
      diagnostics.activeFalls = activeWriteIndex;

      if (matricesChanged) {
        stems.instanceMatrix.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
        centers.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function createFlowerHeadGeometry(): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(0.195, 20);
  const positions = geometry.getAttribute("position");

  for (let index = 1; index < positions.count; index += 1) {
    const angle = Math.atan2(positions.getY(index), positions.getX(index));
    const radius = 0.18 + Math.cos(angle * 5) * 0.064;
    positions.setXY(index, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  positions.needsUpdate = true;
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function addDenseWeeds(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  layout: MeadowLayout,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
  reducedMotion: boolean,
): FallingVegetationSync {
  const count = layout.denseWeedVisuals.length;
  const geometry = track(resources, createDenseWeedGeometry());
  const material = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  );
  const weeds = new THREE.InstancedMesh(geometry, material, count);
  const palette = [0x64a92d, 0x82c638, 0xa1dc45] as const;
  const standingMatrices = new Float32Array(count * 16);
  const cutMatrices = new Float32Array(count * 16);
  const visualsByTarget = Array.from(
    { length: layout.denseWeedTargets.length },
    () => [] as number[],
  );
  const fallStartTimes = new Float32Array(count);
  const fallDirections = new Float32Array(count);
  const fallingVisualIndices: number[] = [];
  const queuedCutTargets = new Uint8Array(layout.denseWeedTargets.length);
  const bentTargets = new Uint8Array(layout.denseWeedTargets.length);
  const yawRotation = new THREE.Quaternion();
  const fallRotation = new THREE.Quaternion();
  const terminalPosition = new THREE.Vector3();
  const terminalRotation = new THREE.Quaternion();
  const terminalScale = new THREE.Vector3();
  const fallAxis = new THREE.Vector3();
  const fallSample: VegetationFallSample = {
    stage: "waiting",
    tiltRadians: 0,
    visibilityScale: 1,
  };
  const fallTiming = reducedMotion ? REDUCED_MOTION_FALL_TIMING : DENSE_WEED_FALL_TIMING;
  const diagnostics = { activeFalls: 0 };
  const targetOffset = layout.grassCells.length + layout.flowerTargets.length;

  fallStartTimes.fill(-1);

  for (let index = 0; index < count; index += 1) {
    const visual = layout.denseWeedVisuals[index];
    if (visual === undefined) {
      continue;
    }

    visualsByTarget[visual.targetIndex]?.push(index);
    position.set(visual.x, 0.02, visual.z);
    rotation.setFromAxisAngle(yAxis, visual.rotation);
    scale.setScalar(visual.scale);
    matrix.compose(position, rotation, scale);
    weeds.setMatrixAt(index, matrix);
    writeMatrix(standingMatrices, index, matrix);

    position.y = 0.025;
    rotation.setFromAxisAngle(yAxis, visual.rotation + 0.24);
    scale.set(visual.scale * 1.04, visual.scale * 0.045, visual.scale * 1.04);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutMatrices, index, matrix);

    color.setHex(palette[visual.colorIndex] ?? palette[0]);
    weeds.setColorAt(index, color);
  }

  weeds.castShadow = true;
  weeds.receiveShadow = true;
  weeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  weeds.instanceMatrix.needsUpdate = true;
  if (weeds.instanceColor !== null) {
    weeds.instanceColor.needsUpdate = true;
  }
  scene.add(weeds);

  return {
    diagnostics,
    syncTargets(state: GameState, simulationTimeSeconds: number): void {
      let matricesChanged = false;

      for (let targetIndex = 0; targetIndex < layout.denseWeedTargets.length; targetIndex += 1) {
        const target = state.targets[targetOffset + targetIndex];
        if (queuedCutTargets[targetIndex] === 0 && target?.status === "cut") {
          queuedCutTargets[targetIndex] = 1;
          bentTargets[targetIndex] = 0;
          const targetVisuals = visualsByTarget[targetIndex];
          if (targetVisuals === undefined) {
            continue;
          }

          for (const visualIndex of targetVisuals) {
            const visual = layout.denseWeedVisuals[visualIndex];
            if (visual === undefined) {
              continue;
            }
            const deltaX = visual.x - state.player.x;
            const deltaZ = visual.z - state.player.z;
            const fallDirection =
              Math.hypot(deltaX, deltaZ) > 0.05
                ? Math.atan2(deltaZ, deltaX)
                : visual.rotation + Math.PI * 0.5;
            const directionJitter = (((visualIndex * 29) % 17) / 16 - 0.5) * 0.36;
            const stagger = reducedMotion ? 0 : (((visualIndex * 13) % 7) / 6) * 0.04;
            fallDirections[visualIndex] = fallDirection + directionJitter;
            fallStartTimes[visualIndex] = simulationTimeSeconds + stagger;
            fallingVisualIndices.push(visualIndex);
          }
          continue;
        }
        if (queuedCutTargets[targetIndex] === 1) {
          continue;
        }

        const targetVisuals = visualsByTarget[targetIndex];
        if (targetVisuals === undefined) {
          continue;
        }

        const isInBladeContact =
          target !== undefined && state.bladeContactTargetIds.includes(target.id);
        const nextBentState = Number(isInBladeContact);
        if (bentTargets[targetIndex] === nextBentState && !isInBladeContact) {
          continue;
        }
        bentTargets[targetIndex] = nextBentState;

        for (const visualIndex of targetVisuals) {
          const visual = layout.denseWeedVisuals[visualIndex];
          if (visual === undefined) {
            continue;
          }
          if (!isInBladeContact) {
            readMatrix(matrix, standingMatrices, visualIndex);
            weeds.setMatrixAt(visualIndex, matrix);
            continue;
          }

          const deltaX = visual.x - state.player.x;
          const deltaZ = visual.z - state.player.z;
          const leanDirection =
            Math.hypot(deltaX, deltaZ) > 0.05
              ? Math.atan2(deltaZ, deltaX)
              : visual.rotation + Math.PI * 0.5;
          const shudder = reducedMotion
            ? 0
            : Math.sin(simulationTimeSeconds * 22 + visualIndex * 1.37);
          const leanAngle = 0.075 + shudder * 0.018;
          fallAxis.set(Math.sin(leanDirection), 0, -Math.cos(leanDirection)).normalize();
          fallRotation.setFromAxisAngle(fallAxis, leanAngle);
          yawRotation.setFromAxisAngle(yAxis, visual.rotation);
          rotation.copy(fallRotation).multiply(yawRotation);
          position.set(visual.x, 0.02, visual.z);
          scale.setScalar(visual.scale);
          matrix.compose(position, rotation, scale);
          weeds.setMatrixAt(visualIndex, matrix);
        }
        matricesChanged = true;
      }

      let activeWriteIndex = 0;
      for (const visualIndex of fallingVisualIndices) {
        const visual = layout.denseWeedVisuals[visualIndex];
        if (visual === undefined) {
          continue;
        }

        sampleVegetationFall(
          simulationTimeSeconds - (fallStartTimes[visualIndex] ?? simulationTimeSeconds),
          fallTiming,
          fallSample,
        );
        if (fallSample.stage === "complete") {
          readMatrix(matrix, cutMatrices, visualIndex);
          weeds.setMatrixAt(visualIndex, matrix);
          matricesChanged = true;
          continue;
        }

        const fallDirection = fallDirections[visualIndex] ?? visual.rotation;
        fallAxis.set(Math.sin(fallDirection), 0, -Math.cos(fallDirection)).normalize();
        fallRotation.setFromAxisAngle(fallAxis, fallSample.tiltRadians);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation);
        rotation.copy(fallRotation).multiply(yawRotation);
        position.set(visual.x, 0.02, visual.z);
        scale.setScalar(visual.scale);
        if (fallSample.stage === "disappearing") {
          readMatrix(matrix, cutMatrices, visualIndex);
          matrix.decompose(terminalPosition, terminalRotation, terminalScale);
          const terminalProgress = 1 - fallSample.visibilityScale;
          position.lerp(terminalPosition, terminalProgress);
          rotation.slerp(terminalRotation, terminalProgress);
          scale.lerp(terminalScale, terminalProgress);
        }
        matrix.compose(position, rotation, scale);
        weeds.setMatrixAt(visualIndex, matrix);
        fallingVisualIndices[activeWriteIndex] = visualIndex;
        activeWriteIndex += 1;
        matricesChanged = true;
      }
      fallingVisualIndices.length = activeWriteIndex;
      diagnostics.activeFalls = activeWriteIndex;

      if (matricesChanged) {
        weeds.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function createDenseWeedGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const leafCount = 7;

  for (let index = 0; index < leafCount; index += 1) {
    const angle = (index / leafCount) * Math.PI * 2 + (index % 2) * 0.14;
    const height = 1.22 + (index % 3) * 0.13;
    const reach = 0.43 + (index % 2) * 0.09;
    const width = 0.24 + (index % 3) * 0.025;
    appendDenseWeedLeaf(positions, angle, height, reach, width);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function appendDenseWeedLeaf(
  positions: number[],
  angle: number,
  height: number,
  reach: number,
  width: number,
): void {
  const forwardX = Math.cos(angle);
  const forwardZ = Math.sin(angle);
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const baseDistance = 0.035;
  const shoulderDistance = reach * 0.56;
  const baseHalfWidth = width * 0.11;
  const shoulderHalfWidth = width / 2;
  const baseLeft = [
    forwardX * baseDistance - rightX * baseHalfWidth,
    0,
    forwardZ * baseDistance - rightZ * baseHalfWidth,
  ] as const;
  const baseRight = [
    forwardX * baseDistance + rightX * baseHalfWidth,
    0,
    forwardZ * baseDistance + rightZ * baseHalfWidth,
  ] as const;
  const shoulderLeft = [
    forwardX * shoulderDistance - rightX * shoulderHalfWidth,
    height * 0.58,
    forwardZ * shoulderDistance - rightZ * shoulderHalfWidth,
  ] as const;
  const shoulderRight = [
    forwardX * shoulderDistance + rightX * shoulderHalfWidth,
    height * 0.58,
    forwardZ * shoulderDistance + rightZ * shoulderHalfWidth,
  ] as const;
  const tip = [forwardX * reach, height, forwardZ * reach] as const;

  appendTriangle(positions, baseLeft, baseRight, shoulderRight);
  appendTriangle(positions, baseLeft, shoulderRight, shoulderLeft);
  appendTriangle(positions, shoulderLeft, shoulderRight, tip);
}

function addShrubs(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  layout: MeadowLayout,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
  reducedMotion: boolean,
): FallingVegetationSync {
  const count = layout.shrubVisuals.length;
  const geometry = track(resources, new THREE.DodecahedronGeometry(1, 1));
  const material = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0,
      flatShading: true,
    }),
  );
  const shrubs = new THREE.InstancedMesh(geometry, material, count);
  const palette = [0x2f9b45, 0x46b756, 0x6bcb61] as const;
  const standingMatrices = new Float32Array(count * 16);
  const flattenedMatrices = new Float32Array(count * 16);
  const queuedCutTargets = new Uint8Array(count);
  const movingTargets = new Uint8Array(count);
  const fallStartTimes = new Float32Array(count);
  const fallDirections = new Float32Array(count);
  const fallingTargetIndices: number[] = [];
  const yawRotation = new THREE.Quaternion();
  const fallRotation = new THREE.Quaternion();
  const fallAxis = new THREE.Vector3();
  const terminalPosition = new THREE.Vector3();
  const terminalRotation = new THREE.Quaternion();
  const terminalScale = new THREE.Vector3();
  const fallSample: VegetationFallSample = {
    stage: "waiting",
    tiltRadians: 0,
    visibilityScale: 1,
  };
  const fallTiming = reducedMotion ? REDUCED_MOTION_FALL_TIMING : DENSE_WEED_FALL_TIMING;
  const diagnostics = { activeFalls: 0 };
  const targetOffset =
    layout.grassCells.length + layout.flowerTargets.length + layout.denseWeedTargets.length;

  fallStartTimes.fill(-1);

  for (const visual of layout.shrubVisuals) {
    position.set(visual.x, 0.58 * visual.size, visual.z);
    rotation.setFromAxisAngle(yAxis, visual.rotation);
    scale.set(visual.size * 0.98, visual.size * 0.62, visual.size * 0.9);
    matrix.compose(position, rotation, scale);
    shrubs.setMatrixAt(visual.targetIndex, matrix);
    writeMatrix(standingMatrices, visual.targetIndex, matrix);

    position.set(visual.x, 0.12, visual.z);
    rotation.setFromAxisAngle(yAxis, visual.rotation + 0.32);
    scale.set(visual.size * 1.08, visual.size * 0.12, visual.size * 0.98);
    matrix.compose(position, rotation, scale);
    writeMatrix(flattenedMatrices, visual.targetIndex, matrix);

    color.setHex(palette[visual.colorIndex] ?? palette[0]);
    shrubs.setColorAt(visual.targetIndex, color);
  }

  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  shrubs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shrubs.instanceMatrix.needsUpdate = true;
  if (shrubs.instanceColor !== null) {
    shrubs.instanceColor.needsUpdate = true;
  }
  scene.add(shrubs);

  return {
    diagnostics,
    syncTargets(state: GameState, simulationTimeSeconds: number): void {
      let matricesChanged = false;

      for (const visual of layout.shrubVisuals) {
        const target = state.targets[targetOffset + visual.targetIndex];
        if (target?.status === "cut") {
          if (queuedCutTargets[visual.targetIndex] === 0) {
            queuedCutTargets[visual.targetIndex] = 1;
            movingTargets[visual.targetIndex] = 0;
            fallStartTimes[visual.targetIndex] = simulationTimeSeconds;
            const deltaX = visual.x - state.player.x;
            const deltaZ = visual.z - state.player.z;
            fallDirections[visual.targetIndex] =
              Math.hypot(deltaX, deltaZ) > 0.05
                ? Math.atan2(deltaZ, deltaX)
                : visual.rotation + Math.PI * 0.5;
            fallingTargetIndices.push(visual.targetIndex);
          }
          continue;
        }

        const isInBladeContact =
          target !== undefined && state.bladeContactTargetIds.includes(target.id);
        const nextMovingState = Number(isInBladeContact);
        if (movingTargets[visual.targetIndex] === nextMovingState && !isInBladeContact) {
          continue;
        }
        movingTargets[visual.targetIndex] = nextMovingState;

        if (!isInBladeContact) {
          readMatrix(matrix, standingMatrices, visual.targetIndex);
          shrubs.setMatrixAt(visual.targetIndex, matrix);
          matricesChanged = true;
          continue;
        }

        const deltaX = visual.x - state.player.x;
        const deltaZ = visual.z - state.player.z;
        const leanDirection =
          Math.hypot(deltaX, deltaZ) > 0.05
            ? Math.atan2(deltaZ, deltaX)
            : visual.rotation + Math.PI * 0.5;
        const shudder = reducedMotion
          ? 0
          : Math.sin(simulationTimeSeconds * 23 + visual.targetIndex * 1.61);
        const leanAngle = 0.06 + shudder * 0.018;
        fallAxis.set(Math.sin(leanDirection), 0, -Math.cos(leanDirection)).normalize();
        fallRotation.setFromAxisAngle(fallAxis, leanAngle);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation + shudder * 0.035);
        rotation.copy(fallRotation).multiply(yawRotation);
        position.set(visual.x, 0.58 * visual.size, visual.z);
        scale.set(visual.size * 0.98, visual.size * 0.62, visual.size * 0.9);
        matrix.compose(position, rotation, scale);
        shrubs.setMatrixAt(visual.targetIndex, matrix);
        matricesChanged = true;
      }

      let activeWriteIndex = 0;
      for (const targetIndex of fallingTargetIndices) {
        const visual = layout.shrubVisuals[targetIndex];
        if (visual === undefined) {
          continue;
        }

        sampleVegetationFall(
          simulationTimeSeconds - (fallStartTimes[targetIndex] ?? simulationTimeSeconds),
          fallTiming,
          fallSample,
        );
        if (fallSample.stage === "complete") {
          readMatrix(matrix, flattenedMatrices, targetIndex);
          shrubs.setMatrixAt(targetIndex, matrix);
          matricesChanged = true;
          continue;
        }

        const fallDirection = fallDirections[targetIndex] ?? visual.rotation;
        fallAxis.set(Math.sin(fallDirection), 0, -Math.cos(fallDirection)).normalize();
        fallRotation.setFromAxisAngle(fallAxis, fallSample.tiltRadians);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation);
        rotation.copy(fallRotation).multiply(yawRotation);
        position.set(visual.x, 0.58 * visual.size, visual.z);
        scale.set(visual.size * 0.98, visual.size * 0.62, visual.size * 0.9);
        if (fallSample.stage === "disappearing") {
          readMatrix(matrix, flattenedMatrices, targetIndex);
          matrix.decompose(terminalPosition, terminalRotation, terminalScale);
          const terminalProgress = 1 - fallSample.visibilityScale;
          position.lerp(terminalPosition, terminalProgress);
          rotation.slerp(terminalRotation, terminalProgress);
          scale.lerp(terminalScale, terminalProgress);
        }
        matrix.compose(position, rotation, scale);
        shrubs.setMatrixAt(targetIndex, matrix);
        fallingTargetIndices[activeWriteIndex] = targetIndex;
        activeWriteIndex += 1;
        matricesChanged = true;
      }
      fallingTargetIndices.length = activeWriteIndex;
      diagnostics.activeFalls = activeWriteIndex;

      if (matricesChanged) {
        shrubs.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function addSaplings(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  layout: MeadowLayout,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
  reducedMotion: boolean,
): FallingVegetationSync {
  const count = layout.saplingVisuals.length;
  const trunkGeometry = track(resources, new THREE.CylinderGeometry(0.12, 0.18, 1.76, 7));
  const trunkMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
    }),
  );
  const cutDiscGeometry = track(resources, new THREE.CylinderGeometry(0.16, 0.2, 0.035, 14));
  const cutDiscMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      flatShading: true,
    }),
  );
  const crownGeometry = track(resources, new THREE.DodecahedronGeometry(1, 1));
  const crownMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      flatShading: true,
    }),
  );
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const stumps = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const cutDiscs = new THREE.InstancedMesh(cutDiscGeometry, cutDiscMaterial, count);
  const lowerCrowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const middleCrowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const upperCrowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const tipCrowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const crownLayers = [
    {
      mesh: lowerCrowns,
      offsetX: -0.2,
      offsetY: 1.72,
      offsetZ: 0.08,
      scaleX: 0.67,
      scaleY: 0.5,
      scaleZ: 0.59,
    },
    {
      mesh: middleCrowns,
      offsetX: 0.23,
      offsetY: 2.08,
      offsetZ: -0.09,
      scaleX: 0.62,
      scaleY: 0.55,
      scaleZ: 0.64,
    },
    {
      mesh: upperCrowns,
      offsetX: -0.06,
      offsetY: 2.48,
      offsetZ: 0.11,
      scaleX: 0.53,
      scaleY: 0.58,
      scaleZ: 0.52,
    },
    {
      mesh: tipCrowns,
      offsetX: 0.16,
      offsetY: 2.75,
      offsetZ: -0.02,
      scaleX: 0.26,
      scaleY: 0.22,
      scaleZ: 0.24,
    },
  ] as const;
  const trunkPalette = [0x9a6538, 0xaa7141, 0x855633] as const;
  const cutDiscPalette = [0xf3c985, 0xf8d89a, 0xe7b873] as const;
  const crownPalettes = [
    [0x2b8f49, 0x3ea957, 0x61c568, 0x9be778],
    [0x258746, 0x39a451, 0x57bd5d, 0x90dc70],
    [0x33974d, 0x47b05b, 0x6bca6c, 0xa9ef83],
  ] as const;
  const tiltAxis = new THREE.Vector3();
  const tiltRotation = new THREE.Quaternion();
  const yawRotation = new THREE.Quaternion();
  const targetOffset =
    layout.grassCells.length +
    layout.flowerTargets.length +
    layout.denseWeedTargets.length +
    layout.shrubTargets.length;
  const stumpMatrices = new Float32Array(count * 16);
  const hiddenMatrices = new Float32Array(count * 16);
  const queuedCutTargets = new Uint8Array(count);
  const fallStartTimes = new Float32Array(count);
  const fallDirections = new Float32Array(count);
  const fallingTargetIndices: number[] = [];
  const rootedPosition: RootedFallPosition = { x: 0, y: 0, z: 0 };
  const trunkHeight = 1.76;
  const stumpHeightScale = 0.18;
  const severedTopHeightScale = 1 - stumpHeightScale;
  const fallSample: VegetationFallSample = {
    stage: "waiting",
    tiltRadians: 0,
    visibilityScale: 1,
  };
  const fallTiming = reducedMotion ? REDUCED_MOTION_FALL_TIMING : WOODY_FALL_TIMING;
  const diagnostics = { activeFalls: 0 };

  fallStartTimes.fill(-1);

  for (const visual of layout.saplingVisuals) {
    const palette = crownPalettes[visual.colorIndex] ?? crownPalettes[0];
    color.setHex(trunkPalette[visual.colorIndex] ?? trunkPalette[0]);
    trunks.setColorAt(visual.targetIndex, color);
    stumps.setColorAt(visual.targetIndex, color);
    color.setHex(cutDiscPalette[visual.colorIndex] ?? cutDiscPalette[0]);
    cutDiscs.setColorAt(visual.targetIndex, color);
    for (let layerIndex = 0; layerIndex < crownLayers.length; layerIndex += 1) {
      color.setHex(palette[layerIndex] ?? palette[0]);
      crownLayers[layerIndex]?.mesh.setColorAt(visual.targetIndex, color);
    }

    rotation.identity();
    const stumpHeight = trunkHeight * stumpHeightScale * visual.size;
    position.set(visual.x, stumpHeight / 2, visual.z);
    scale.set(visual.size, stumpHeightScale * visual.size, visual.size);
    matrix.compose(position, rotation, scale);
    writeMatrix(stumpMatrices, visual.targetIndex, matrix);

    position.set(visual.x, 0.02, visual.z);
    scale.setScalar(0);
    matrix.compose(position, rotation, scale);
    writeMatrix(hiddenMatrices, visual.targetIndex, matrix);
    stumps.setMatrixAt(visual.targetIndex, matrix);
    cutDiscs.setMatrixAt(visual.targetIndex, matrix);
  }

  for (const mesh of [
    trunks,
    stumps,
    cutDiscs,
    lowerCrowns,
    middleCrowns,
    upperCrowns,
    tipCrowns,
  ]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
  scene.add(trunks, stumps, cutDiscs, lowerCrowns, middleCrowns, upperCrowns, tipCrowns);

  return {
    diagnostics,
    syncTargets(state: GameState, simulationTimeSeconds: number): void {
      for (const visual of layout.saplingVisuals) {
        const target = state.targets[targetOffset + visual.targetIndex];
        if (target?.status === "cut") {
          if (queuedCutTargets[visual.targetIndex] === 0) {
            queuedCutTargets[visual.targetIndex] = 1;
            fallStartTimes[visual.targetIndex] = simulationTimeSeconds;
            readMatrix(matrix, stumpMatrices, visual.targetIndex);
            stumps.setMatrixAt(visual.targetIndex, matrix);
            const stumpHeight = trunkHeight * stumpHeightScale * visual.size;
            rotation.identity();
            position.set(visual.x, stumpHeight + 0.018, visual.z);
            scale.setScalar(visual.size);
            matrix.compose(position, rotation, scale);
            cutDiscs.setMatrixAt(visual.targetIndex, matrix);
            const deltaX = visual.x - state.player.x;
            const deltaZ = visual.z - state.player.z;
            fallDirections[visual.targetIndex] =
              Math.hypot(deltaX, deltaZ) > 0.05
                ? Math.atan2(deltaZ, deltaX)
                : visual.rotation + Math.PI * 0.5;
            fallingTargetIndices.push(visual.targetIndex);
          }
          continue;
        }

        const isInBladeContact =
          target !== undefined && state.bladeContactTargetIds.includes(target.id);
        const shudder =
          isInBladeContact && !reducedMotion
            ? Math.sin(simulationTimeSeconds * 24 + visual.targetIndex * 1.73)
            : 0;
        const leanAngle = isInBladeContact ? 0.105 + shudder * 0.038 : 0;
        const leanDirection =
          visual.rotation +
          (isInBladeContact && !reducedMotion
            ? Math.sin(simulationTimeSeconds * 17 + visual.targetIndex * 2.1) * 0.22
            : 0);
        tiltAxis.set(Math.sin(leanDirection), 0, -Math.cos(leanDirection));
        tiltRotation.setFromAxisAngle(tiltAxis, leanAngle);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation + shudder * 0.045);
        rotation.multiplyQuaternions(tiltRotation, yawRotation);

        const trunkCenterY = 0.88 * visual.size;
        transformRootedFallPoint(0, trunkCenterY, 0, 0, leanDirection, leanAngle, rootedPosition);
        position.set(visual.x + rootedPosition.x, rootedPosition.y, visual.z + rootedPosition.z);
        scale.setScalar(visual.size);
        matrix.compose(position, rotation, scale);
        trunks.setMatrixAt(visual.targetIndex, matrix);

        const cosYaw = Math.cos(visual.rotation);
        const sinYaw = Math.sin(visual.rotation);
        for (const layer of crownLayers) {
          const localX = (layer.offsetX * cosYaw - layer.offsetZ * sinYaw) * visual.size;
          const localZ = (layer.offsetX * sinYaw + layer.offsetZ * cosYaw) * visual.size;
          const layerHeight = layer.offsetY * visual.size;
          transformRootedFallPoint(
            localX,
            layerHeight,
            localZ,
            0,
            leanDirection,
            leanAngle,
            rootedPosition,
          );
          position.set(visual.x + rootedPosition.x, rootedPosition.y, visual.z + rootedPosition.z);
          scale.set(
            layer.scaleX * visual.size,
            layer.scaleY * visual.size,
            layer.scaleZ * visual.size,
          );
          matrix.compose(position, rotation, scale);
          layer.mesh.setMatrixAt(visual.targetIndex, matrix);
        }
      }

      let activeWriteIndex = 0;
      for (const targetIndex of fallingTargetIndices) {
        const visual = layout.saplingVisuals[targetIndex];
        if (visual === undefined) {
          continue;
        }

        sampleVegetationFall(
          simulationTimeSeconds - (fallStartTimes[targetIndex] ?? simulationTimeSeconds),
          fallTiming,
          fallSample,
        );
        if (fallSample.stage === "complete") {
          readMatrix(matrix, hiddenMatrices, targetIndex);
          trunks.setMatrixAt(targetIndex, matrix);
          for (const layer of crownLayers) {
            layer.mesh.setMatrixAt(targetIndex, matrix);
          }
          continue;
        }

        const fallDirection = fallDirections[targetIndex] ?? visual.rotation;
        tiltAxis.set(Math.sin(fallDirection), 0, -Math.cos(fallDirection)).normalize();
        tiltRotation.setFromAxisAngle(tiltAxis, fallSample.tiltRadians);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation);
        rotation.multiplyQuaternions(tiltRotation, yawRotation);
        const visibilityScale = fallSample.visibilityScale;
        const stumpHeight = trunkHeight * stumpHeightScale * visual.size;
        const severedTopHeight = trunkHeight * severedTopHeightScale * visual.size;
        const cosYaw = Math.cos(visual.rotation);
        const sinYaw = Math.sin(visual.rotation);
        let groundLift = 0;

        for (const layer of crownLayers) {
          const localX =
            (layer.offsetX * cosYaw - layer.offsetZ * sinYaw) * visual.size * visibilityScale;
          const localZ =
            (layer.offsetX * sinYaw + layer.offsetZ * cosYaw) * visual.size * visibilityScale;
          const localY = (layer.offsetY * visual.size - stumpHeight) * visibilityScale;
          transformRootedFallPoint(
            localX,
            localY,
            localZ,
            stumpHeight,
            fallDirection,
            fallSample.tiltRadians,
            rootedPosition,
          );
          const crownRadius =
            Math.max(layer.scaleX, layer.scaleY, layer.scaleZ) * visual.size * visibilityScale;
          groundLift = Math.max(groundLift, crownRadius + 0.025 - rootedPosition.y);
        }

        transformRootedFallPoint(
          0,
          (severedTopHeight / 2) * visibilityScale,
          0,
          stumpHeight,
          fallDirection,
          fallSample.tiltRadians,
          rootedPosition,
        );
        position.set(
          visual.x + rootedPosition.x,
          rootedPosition.y + groundLift,
          visual.z + rootedPosition.z,
        );
        scale.set(
          visual.size * visibilityScale,
          severedTopHeightScale * visual.size * visibilityScale,
          visual.size * visibilityScale,
        );
        matrix.compose(position, rotation, scale);
        trunks.setMatrixAt(targetIndex, matrix);

        for (const layer of crownLayers) {
          const localX =
            (layer.offsetX * cosYaw - layer.offsetZ * sinYaw) * visual.size * visibilityScale;
          const localZ =
            (layer.offsetX * sinYaw + layer.offsetZ * cosYaw) * visual.size * visibilityScale;
          const localY = (layer.offsetY * visual.size - stumpHeight) * visibilityScale;
          transformRootedFallPoint(
            localX,
            localY,
            localZ,
            stumpHeight,
            fallDirection,
            fallSample.tiltRadians,
            rootedPosition,
          );
          position.set(
            visual.x + rootedPosition.x,
            rootedPosition.y + groundLift,
            visual.z + rootedPosition.z,
          );
          scale.set(
            layer.scaleX * visual.size * visibilityScale,
            layer.scaleY * visual.size * visibilityScale,
            layer.scaleZ * visual.size * visibilityScale,
          );
          matrix.compose(position, rotation, scale);
          layer.mesh.setMatrixAt(targetIndex, matrix);
        }

        fallingTargetIndices[activeWriteIndex] = targetIndex;
        activeWriteIndex += 1;
      }
      fallingTargetIndices.length = activeWriteIndex;
      diagnostics.activeFalls = activeWriteIndex;

      trunks.instanceMatrix.needsUpdate = true;
      stumps.instanceMatrix.needsUpdate = true;
      cutDiscs.instanceMatrix.needsUpdate = true;
      lowerCrowns.instanceMatrix.needsUpdate = true;
      middleCrowns.instanceMatrix.needsUpdate = true;
      upperCrowns.instanceMatrix.needsUpdate = true;
      tipCrowns.instanceMatrix.needsUpdate = true;
    },
  };
}

function addTrees(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  layout: MeadowLayout,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  reducedMotion: boolean,
): FallingVegetationSync {
  const count = layout.matureTreeVisuals.length;
  const trunkGeometry = track(resources, new THREE.CylinderGeometry(0.34, 0.5, 2.35, 7));
  const trunkMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x9a6335,
      roughness: 0.92,
      flatShading: true,
    }),
  );
  const crownGeometry = track(resources, new THREE.IcosahedronGeometry(1.2, 1));
  const crownMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      flatShading: true,
    }),
  );
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const stumps = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const crownPalette = [0x2f9c55, 0x42b45f, 0x5ac56a] as const;
  const standingTrunkMatrices = new Float32Array(count * 16);
  const standingCrownMatrices = new Float32Array(count * 16);
  const cutTrunkMatrices = new Float32Array(count * 16);
  const cutCrownMatrices = new Float32Array(count * 16);
  const queuedCutTargets = new Uint8Array(count);
  const movingTargets = new Uint8Array(count);
  const fallStartTimes = new Float32Array(count);
  const fallDirections = new Float32Array(count);
  const fallingTargetIndices: number[] = [];
  const tiltAxis = new THREE.Vector3();
  const tiltRotation = new THREE.Quaternion();
  const rootedPosition: RootedFallPosition = { x: 0, y: 0, z: 0 };
  const trunkHeight = 2.35;
  const stumpHeightScale = 0.18;
  const severedTopHeightScale = 1 - stumpHeightScale;
  const fallSample: VegetationFallSample = {
    stage: "waiting",
    tiltRadians: 0,
    visibilityScale: 1,
  };
  const fallTiming = reducedMotion ? REDUCED_MOTION_FALL_TIMING : WOODY_FALL_TIMING;
  const diagnostics = { activeFalls: 0 };
  const targetOffset =
    layout.grassCells.length +
    layout.flowerTargets.length +
    layout.denseWeedTargets.length +
    layout.shrubTargets.length +
    layout.saplingTargets.length;

  fallStartTimes.fill(-1);

  rotation.identity();
  for (let index = 0; index < count; index += 1) {
    const tree = layout.matureTreeVisuals[index];
    if (tree === undefined) {
      continue;
    }
    const { x, z, size } = tree;

    position.set(x, 1.175 * size, z);
    scale.set(size, size, size);
    matrix.compose(position, rotation, scale);
    trunks.setMatrixAt(index, matrix);
    writeMatrix(standingTrunkMatrices, index, matrix);

    position.y = 2.85 * size;
    scale.set(size * 1.05, size * 0.92, size * 1.05);
    matrix.compose(position, rotation, scale);
    crowns.setMatrixAt(index, matrix);
    writeMatrix(standingCrownMatrices, index, matrix);
    color.setHex(crownPalette[index % crownPalette.length] ?? crownPalette[0]);
    crowns.setColorAt(index, color);

    const stumpHeight = trunkHeight * stumpHeightScale * size;
    position.set(x, stumpHeight / 2, z);
    scale.set(size, stumpHeightScale * size, size);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutTrunkMatrices, index, matrix);

    position.set(x, 0.02, z);
    scale.setScalar(0.001);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutCrownMatrices, index, matrix);
    stumps.setMatrixAt(index, matrix);
  }

  for (const mesh of [trunks, stumps, crowns]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
  scene.add(trunks, stumps, crowns);

  return {
    diagnostics,
    syncTargets(state: GameState, simulationTimeSeconds: number): void {
      let matricesChanged = false;

      for (const visual of layout.matureTreeVisuals) {
        const target = state.targets[targetOffset + visual.targetIndex];
        if (target?.status === "cut") {
          if (queuedCutTargets[visual.targetIndex] === 0) {
            queuedCutTargets[visual.targetIndex] = 1;
            movingTargets[visual.targetIndex] = 0;
            fallStartTimes[visual.targetIndex] = simulationTimeSeconds;
            readMatrix(matrix, cutTrunkMatrices, visual.targetIndex);
            stumps.setMatrixAt(visual.targetIndex, matrix);
            const deltaX = visual.x - state.player.x;
            const deltaZ = visual.z - state.player.z;
            fallDirections[visual.targetIndex] =
              Math.hypot(deltaX, deltaZ) > 0.05
                ? Math.atan2(deltaZ, deltaX)
                : visual.targetIndex * 2.399963229728653;
            fallingTargetIndices.push(visual.targetIndex);
          }
          continue;
        }

        const isInBladeContact =
          target !== undefined && state.bladeContactTargetIds.includes(target.id);
        const nextMovingState = Number(isInBladeContact);
        if (movingTargets[visual.targetIndex] === nextMovingState && !isInBladeContact) {
          continue;
        }
        movingTargets[visual.targetIndex] = nextMovingState;

        if (!isInBladeContact) {
          readMatrix(matrix, standingTrunkMatrices, visual.targetIndex);
          trunks.setMatrixAt(visual.targetIndex, matrix);
          readMatrix(matrix, standingCrownMatrices, visual.targetIndex);
          crowns.setMatrixAt(visual.targetIndex, matrix);
          matricesChanged = true;
          continue;
        }

        const deltaX = visual.x - state.player.x;
        const deltaZ = visual.z - state.player.z;
        const leanDirection =
          Math.hypot(deltaX, deltaZ) > 0.05
            ? Math.atan2(deltaZ, deltaX)
            : visual.targetIndex * 2.399963229728653;
        const shudder = reducedMotion
          ? 0
          : Math.sin(simulationTimeSeconds * 18 + visual.targetIndex * 1.91);
        const leanAngle = 0.04 + shudder * 0.012;
        tiltAxis.set(Math.sin(leanDirection), 0, -Math.cos(leanDirection)).normalize();
        tiltRotation.setFromAxisAngle(tiltAxis, leanAngle);
        rotation.copy(tiltRotation);

        transformRootedFallPoint(
          0,
          1.175 * visual.size,
          0,
          0,
          leanDirection,
          leanAngle,
          rootedPosition,
        );
        position.set(visual.x + rootedPosition.x, rootedPosition.y, visual.z + rootedPosition.z);
        scale.setScalar(visual.size);
        matrix.compose(position, rotation, scale);
        trunks.setMatrixAt(visual.targetIndex, matrix);

        transformRootedFallPoint(
          0,
          2.85 * visual.size,
          0,
          0,
          leanDirection,
          leanAngle,
          rootedPosition,
        );
        position.set(visual.x + rootedPosition.x, rootedPosition.y, visual.z + rootedPosition.z);
        scale.set(visual.size * 1.05, visual.size * 0.92, visual.size * 1.05);
        matrix.compose(position, rotation, scale);
        crowns.setMatrixAt(visual.targetIndex, matrix);
        matricesChanged = true;
      }

      let activeWriteIndex = 0;
      for (const targetIndex of fallingTargetIndices) {
        const visual = layout.matureTreeVisuals[targetIndex];
        if (visual === undefined) {
          continue;
        }

        sampleVegetationFall(
          simulationTimeSeconds - (fallStartTimes[targetIndex] ?? simulationTimeSeconds),
          fallTiming,
          fallSample,
        );
        if (fallSample.stage === "complete") {
          readMatrix(matrix, cutCrownMatrices, targetIndex);
          trunks.setMatrixAt(targetIndex, matrix);
          crowns.setMatrixAt(targetIndex, matrix);
          matricesChanged = true;
          continue;
        }

        const fallDirection = fallDirections[targetIndex] ?? targetIndex * 2.399963229728653;
        tiltAxis.set(Math.sin(fallDirection), 0, -Math.cos(fallDirection)).normalize();
        tiltRotation.setFromAxisAngle(tiltAxis, fallSample.tiltRadians);
        rotation.copy(tiltRotation);
        const visibilityScale = fallSample.visibilityScale;
        const stumpHeight = trunkHeight * stumpHeightScale * visual.size;
        const severedTopHeight = trunkHeight * severedTopHeightScale * visual.size;

        transformRootedFallPoint(
          0,
          (2.85 * visual.size - stumpHeight) * visibilityScale,
          0,
          stumpHeight,
          fallDirection,
          fallSample.tiltRadians,
          rootedPosition,
        );
        const crownRadius = 1.2 * 1.05 * visual.size * visibilityScale;
        const groundLift = Math.max(0, crownRadius + 0.025 - rootedPosition.y);

        transformRootedFallPoint(
          0,
          (severedTopHeight / 2) * visibilityScale,
          0,
          stumpHeight,
          fallDirection,
          fallSample.tiltRadians,
          rootedPosition,
        );
        position.set(
          visual.x + rootedPosition.x,
          rootedPosition.y + groundLift,
          visual.z + rootedPosition.z,
        );
        scale.set(
          visual.size * visibilityScale,
          severedTopHeightScale * visual.size * visibilityScale,
          visual.size * visibilityScale,
        );
        matrix.compose(position, rotation, scale);
        trunks.setMatrixAt(targetIndex, matrix);

        transformRootedFallPoint(
          0,
          (2.85 * visual.size - stumpHeight) * visibilityScale,
          0,
          stumpHeight,
          fallDirection,
          fallSample.tiltRadians,
          rootedPosition,
        );
        position.set(
          visual.x + rootedPosition.x,
          rootedPosition.y + groundLift,
          visual.z + rootedPosition.z,
        );
        scale.set(
          visual.size * 1.05 * visibilityScale,
          visual.size * 0.92 * visibilityScale,
          visual.size * 1.05 * visibilityScale,
        );
        matrix.compose(position, rotation, scale);
        crowns.setMatrixAt(targetIndex, matrix);
        fallingTargetIndices[activeWriteIndex] = targetIndex;
        activeWriteIndex += 1;
        matricesChanged = true;
      }
      fallingTargetIndices.length = activeWriteIndex;
      diagnostics.activeFalls = activeWriteIndex;

      if (matricesChanged) {
        trunks.instanceMatrix.needsUpdate = true;
        stumps.instanceMatrix.needsUpdate = true;
        crowns.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function addRocks(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  layout: MeadowLayout,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
): void {
  const count = layout.rockVisuals.length;
  const geometry = track(resources, new THREE.DodecahedronGeometry(1, 0));
  const material = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    }),
  );
  const rocks = new THREE.InstancedMesh(geometry, material, count);
  const palette = [0x9fa8b2, 0x7f8790, 0xb8aa91] as const;

  for (const visual of layout.rockVisuals) {
    position.set(visual.x, 0.38 * visual.size, visual.z);
    rotation.setFromAxisAngle(yAxis, visual.rotation);
    scale.set(visual.size * 0.98, visual.size * 0.52, visual.size * 0.72);
    matrix.compose(position, rotation, scale);
    rocks.setMatrixAt(visual.targetIndex, matrix);
    color.setHex(palette[visual.targetIndex % palette.length] ?? palette[0]);
    rocks.setColorAt(visual.targetIndex, color);
  }

  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor !== null) {
    rocks.instanceColor.needsUpdate = true;
  }
  scene.add(rocks);
}

function addBoundaryStones(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  yAxis: THREE.Vector3,
): void {
  const stonesPerSide = 18;
  const count = stonesPerSide * 4;
  const geometry = track(resources, new THREE.DodecahedronGeometry(0.28, 0));
  const material = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xf3e8c2,
      roughness: 0.95,
      flatShading: true,
    }),
  );
  const stones = new THREE.InstancedMesh(geometry, material, count);
  const edge = WORLD_HALF_EXTENT + 0.35;

  for (let side = 0; side < 4; side += 1) {
    for (let index = 0; index < stonesPerSide; index += 1) {
      const t = -WORLD_HALF_EXTENT + (index / (stonesPerSide - 1)) * 44;
      const instanceIndex = side * stonesPerSide + index;
      const x = side < 2 ? t : side === 2 ? -edge : edge;
      const z = side < 2 ? (side === 0 ? -edge : edge) : t;
      position.set(x, 0.23, z);
      rotation.setFromAxisAngle(yAxis, instanceIndex * 0.71);
      const variation = 0.82 + (instanceIndex % 5) * 0.055;
      scale.set(variation, 0.76 + (instanceIndex % 3) * 0.08, variation);
      matrix.compose(position, rotation, scale);
      stones.setMatrixAt(instanceIndex, matrix);
    }
  }

  stones.castShadow = true;
  stones.receiveShadow = true;
  stones.instanceMatrix.needsUpdate = true;
  scene.add(stones);
}

function addBlade(
  playerRoot: THREE.Group,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
): BladeVisual {
  const baseGeometry = track(resources, new THREE.CylinderGeometry(0.7, 0.82, 0.48, 24));
  const baseMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x176a92,
      roughness: 0.3,
      metalness: 0.48,
      emissive: 0x073f5a,
      emissiveIntensity: 0.18,
    }),
  );
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 1.02;
  base.castShadow = true;
  playerRoot.add(base);

  const bladePivot = new THREE.Group();
  bladePivot.position.y = 1.3;
  playerRoot.add(bladePivot);

  const bladeGeometry = track(resources, createCurvedBladeGeometry());
  const bladeMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xf3f8ff,
      roughness: 0.17,
      metalness: 0.88,
      emissive: 0x426888,
      emissiveIntensity: 0.12,
      flatShading: true,
    }),
  );

  const curvedBlades: THREE.Mesh[] = [];
  for (let index = 0; index < 4; index += 1) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.rotation.y = index * (Math.PI / 2);
    blade.castShadow = true;
    curvedBlades.push(blade);
    bladePivot.add(blade);
  }

  const sawGroup = new THREE.Group();
  const sawRingGeometry = track(resources, new THREE.TorusGeometry(1.22, 0.24, 8, 36));
  sawRingGeometry.rotateX(Math.PI / 2);
  const sawRingMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x75dcff,
      roughness: 0.2,
      metalness: 0.78,
      emissive: 0x0a658a,
      emissiveIntensity: 0.16,
      flatShading: true,
    }),
  );
  const sawRing = new THREE.Mesh(sawRingGeometry, sawRingMaterial);
  sawRing.position.y = 0.03;
  sawRing.castShadow = true;
  sawGroup.add(sawRing);

  const sawToothCount = 18;
  const sawToothGeometry = track(resources, createSawToothGeometry());
  for (let index = 0; index < sawToothCount; index += 1) {
    const tooth = new THREE.Mesh(sawToothGeometry, bladeMaterial);
    tooth.rotation.y = (index / sawToothCount) * Math.PI * 2;
    tooth.castShadow = true;
    sawGroup.add(tooth);
  }
  sawGroup.visible = false;
  bladePivot.add(sawGroup);

  const outerRingGeometry = track(resources, new THREE.CylinderGeometry(0.76, 0.82, 0.24, 28));
  const outerRingMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x35c9f4,
      roughness: 0.25,
      metalness: 0.46,
      emissive: 0x075b7d,
      emissiveIntensity: 0.22,
    }),
  );
  const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
  outerRing.position.y = 0.06;
  outerRing.castShadow = true;
  bladePivot.add(outerRing);

  const innerRingGeometry = track(resources, new THREE.CylinderGeometry(0.53, 0.59, 0.28, 24));
  const innerRingMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xe7f9ff,
      roughness: 0.22,
      metalness: 0.55,
      emissive: 0x3e7184,
      emissiveIntensity: 0.08,
    }),
  );
  const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
  innerRing.position.y = 0.105;
  innerRing.castShadow = true;
  bladePivot.add(innerRing);

  const capGeometry = track(resources, new THREE.CylinderGeometry(0.3, 0.36, 0.34, 20));
  const capMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x238fb9,
      roughness: 0.25,
      metalness: 0.52,
      emissive: 0x06465f,
      emissiveIntensity: 0.18,
    }),
  );
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = 0.19;
  cap.castShadow = true;
  bladePivot.add(cap);

  const orientationCueGeometry = track(
    resources,
    new THREE.CylinderGeometry(0.115, 0.115, 0.11, 12),
  );
  const orientationCueMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffc94d,
      roughness: 0.25,
      metalness: 0.68,
      emissive: 0x8a4a00,
      emissiveIntensity: 0.16,
    }),
  );
  const orientationCue = new THREE.Mesh(orientationCueGeometry, orientationCueMaterial);
  orientationCue.position.set(1.22, 0.235, 0);
  orientationCue.castShadow = true;
  bladePivot.add(orientationCue);

  const diagnostics: BladeVisual["diagnostics"] = {
    bladeTier: "two-arm",
    visibleBladeCount: 2,
    visibleTeeth: 0,
    orientationCueCount: 1,
    visualBladeAngleRadians: 0,
  };
  let appliedTier: BladeTier | null = null;
  let previousRawAngleRadians = 0;
  let accumulatedVisualAngleRadians = 0;

  function sync(level: number, angleRadians: number): void {
    accumulatedVisualAngleRadians = accumulateReadableBladeAngle(
      previousRawAngleRadians,
      angleRadians,
      accumulatedVisualAngleRadians,
    );
    previousRawAngleRadians = angleRadians;
    const visualBladeAngleRadians = accumulatedVisualAngleRadians;
    bladePivot.rotation.y = visualBladeAngleRadians;
    diagnostics.visualBladeAngleRadians = visualBladeAngleRadians;
    const tier: BladeTier = level >= 6 ? "saw" : level >= 2 ? "four-arm" : "two-arm";
    if (tier === appliedTier) {
      return;
    }

    appliedTier = tier;
    const visibleBladeCount = tier === "two-arm" ? 2 : tier === "four-arm" ? 4 : 0;
    for (let index = 0; index < curvedBlades.length; index += 1) {
      const blade = curvedBlades[index];
      if (blade === undefined) {
        continue;
      }
      blade.visible = index < visibleBladeCount;
      if (visibleBladeCount > 0) {
        blade.rotation.y = (index / visibleBladeCount) * Math.PI * 2;
      }
    }
    sawGroup.visible = tier === "saw";
    outerRingMaterial.color.setHex(
      tier === "saw" ? 0x52d8ff : tier === "four-arm" ? 0x38c5ff : 0x35c9f4,
    );
    diagnostics.bladeTier = tier;
    diagnostics.visibleBladeCount = visibleBladeCount;
    diagnostics.visibleTeeth = tier === "saw" ? sawToothCount : 0;
  }

  sync(1, 0);
  return { diagnostics, sync };
}

function createCurvedBladeGeometry(): THREE.ExtrudeGeometry {
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.4, -0.18);
  bladeShape.bezierCurveTo(0.92, -0.31, 1.58, -0.28, 2, -0.03);
  bladeShape.lineTo(2.14, 0.1);
  bladeShape.bezierCurveTo(1.66, 0.1, 1.18, 0.42, 0.4, 0.2);
  bladeShape.closePath();

  const geometry = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 7,
    steps: 1,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0.05, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createSawToothGeometry(): THREE.ExtrudeGeometry {
  const toothShape = new THREE.Shape();
  toothShape.moveTo(1.13, -0.13);
  toothShape.lineTo(2.12, 0);
  toothShape.lineTo(1.13, 0.13);
  toothShape.closePath();

  const geometry = new THREE.ExtrudeGeometry(toothShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 1,
    steps: 1,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0.04, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function writeMatrix(buffer: Float32Array, index: number, matrix: THREE.Matrix4): void {
  const offset = index * 16;
  for (let component = 0; component < 16; component += 1) {
    buffer[offset + component] = matrix.elements[component] ?? 0;
  }
}

function readMatrix(matrix: THREE.Matrix4, buffer: Float32Array, index: number): void {
  const offset = index * 16;
  for (let component = 0; component < 16; component += 1) {
    matrix.elements[component] = buffer[offset + component] ?? 0;
  }
}

function track<T extends THREE.BufferGeometry | THREE.Material>(
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  resource: T,
): T {
  resources.push(resource);
  return resource;
}

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return (): number => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomRange(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}
