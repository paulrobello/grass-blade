import * as THREE from "three";

import type { GameState } from "./state";
import { WORLD_HALF_EXTENT } from "./state";
import {
  createMeadowLayout,
  FLOWER_VISUAL_COUNT,
  GRASS_VISUAL_COLUMNS,
  type MeadowLayout,
} from "./world";

const CAMERA_OFFSET_X = 8.5;
const CAMERA_OFFSET_Y = 22;
const CAMERA_OFFSET_Z = 8.5;
const CAMERA_VIEW_HEIGHT = 15.5;
const GRASS_BLADES_PER_INSTANCE = 14;

interface VegetationSync {
  syncTargets: (state: GameState, simulationTimeSeconds: number) => void;
}

export interface MeadowScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  density: {
    grassInstances: number;
    grassBlades: number;
    flowerInstances: number;
    weedInstances: number;
    saplingInstances: number;
    treeInstances: number;
  };
  resize: (aspect: number) => void;
  sync: (state: GameState, simulationTimeSeconds: number) => void;
  dispose: () => void;
}

export function createScene(seed: number): MeadowScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb5df8b);
  scene.fog = new THREE.Fog(0xb5df8b, 28, 58);

  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  const layout = createMeadowLayout(seed);
  const random = createSeededRandom(seed);
  const scratchMatrix = new THREE.Matrix4();
  const scratchPosition = new THREE.Vector3();
  const scratchRotation = new THREE.Quaternion();
  const scratchScale = new THREE.Vector3();
  const scratchColor = new THREE.Color();
  const cameraTarget = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

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

  const playerRoot = new THREE.Group();
  const bladePivot = addBlade(playerRoot, resources);
  scene.add(playerRoot);

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
    bladePivot.rotation.y = state.player.bladeAngleRadians;

    grass.syncTargets(state, simulationTimeSeconds);
    flowers.syncTargets(state, simulationTimeSeconds);
    weeds.syncTargets(state, simulationTimeSeconds);
    saplings.syncTargets(state, simulationTimeSeconds);
    trees.syncTargets(state, simulationTimeSeconds);

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
    for (const resource of resources) {
      resource.dispose();
    }
  }

  return {
    scene,
    camera,
    density: {
      grassInstances: GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS,
      grassBlades: GRASS_VISUAL_COLUMNS * GRASS_VISUAL_COLUMNS * GRASS_BLADES_PER_INSTANCE,
      flowerInstances: FLOWER_VISUAL_COUNT,
      weedInstances: layout.denseWeedVisuals.length,
      saplingInstances: layout.saplingVisuals.length,
      treeInstances: layout.matureTreeVisuals.length,
    },
    resize,
    sync,
    dispose,
  };
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
): VegetationSync {
  const count = layout.grassVisuals.length;
  const geometry = track(resources, createGrassClumpGeometry());
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
  let appliedCutVisualCount = 0;

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
    syncTargets(state: GameState): void {
      let matricesChanged = false;

      while (appliedCutVisualCount < state.cutGrassVisualIndices.length) {
        const visualIndex = state.cutGrassVisualIndices[appliedCutVisualCount];
        appliedCutVisualCount += 1;
        if (visualIndex === undefined || visualIndex < 0 || visualIndex >= count) {
          continue;
        }

        readMatrix(matrix, cutMatrices, visualIndex);
        grass.setMatrixAt(visualIndex, matrix);
        matricesChanged = true;
      }

      if (matricesChanged) {
        grass.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function createGrassClumpGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];

  for (let index = 0; index < GRASS_BLADES_PER_INSTANCE; index += 1) {
    const angle = index * 2.399963229728653;
    const radius = Math.sqrt((index + 0.5) / GRASS_BLADES_PER_INSTANCE) * 0.21;
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
): VegetationSync {
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
  const standingStemMatrices = new Float32Array(count * 16);
  const standingHeadMatrices = new Float32Array(count * 16);
  const standingCenterMatrices = new Float32Array(count * 16);
  const cutStemMatrices = new Float32Array(count * 16);
  const cutHeadMatrices = new Float32Array(count * 16);
  const cutCenterMatrices = new Float32Array(count * 16);
  const visualsByTarget = Array.from({ length: layout.flowerTargets.length }, () => [] as number[]);
  const flattenedTargets = new Uint8Array(layout.flowerTargets.length);

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
    writeMatrix(standingStemMatrices, index, matrix);

    position.y = 0.86 * flowerScale;
    scale.set(flowerScale * 1.08, flowerScale * 1.08, flowerScale * 1.08);
    matrix.compose(position, rotation, scale);
    heads.setMatrixAt(index, matrix);
    writeMatrix(standingHeadMatrices, index, matrix);
    color.setHex(palette[visual.colorIndex] ?? palette[0]);
    heads.setColorAt(index, color);

    position.y = 0.9 * flowerScale;
    matrix.compose(position, rotation, scale);
    centers.setMatrixAt(index, matrix);
    writeMatrix(standingCenterMatrices, index, matrix);

    position.set(visual.x, 0.05, visual.z);
    scale.set(flowerScale * 0.58, flowerScale * 0.1, flowerScale * 0.58);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutStemMatrices, index, matrix);

    position.set(
      visual.x + Math.cos(visual.rotation) * flowerScale * 0.12,
      0.047,
      visual.z + Math.sin(visual.rotation) * flowerScale * 0.12,
    );
    scale.set(flowerScale * 0.86, flowerScale * 0.86, flowerScale * 0.86);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutHeadMatrices, index, matrix);

    position.y = 0.069;
    matrix.compose(position, rotation, scale);
    writeMatrix(cutCenterMatrices, index, matrix);
  }

  stems.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  centers.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor !== null) {
    heads.instanceColor.needsUpdate = true;
  }
  scene.add(stems, heads, centers);

  return {
    syncTargets(state: GameState): void {
      const targetOffset = layout.grassCells.length;
      let matricesChanged = false;

      for (let targetIndex = 0; targetIndex < layout.flowerTargets.length; targetIndex += 1) {
        const isFlattened = state.targets[targetOffset + targetIndex]?.status !== "standing";
        const nextFlattenedState = Number(isFlattened);
        if (flattenedTargets[targetIndex] === nextFlattenedState) {
          continue;
        }

        flattenedTargets[targetIndex] = nextFlattenedState;
        const targetVisuals = visualsByTarget[targetIndex];
        if (targetVisuals === undefined) {
          continue;
        }

        const stemTransforms = isFlattened ? cutStemMatrices : standingStemMatrices;
        const headTransforms = isFlattened ? cutHeadMatrices : standingHeadMatrices;
        const centerTransforms = isFlattened ? cutCenterMatrices : standingCenterMatrices;
        for (const visualIndex of targetVisuals) {
          readMatrix(matrix, stemTransforms, visualIndex);
          stems.setMatrixAt(visualIndex, matrix);
          readMatrix(matrix, headTransforms, visualIndex);
          heads.setMatrixAt(visualIndex, matrix);
          readMatrix(matrix, centerTransforms, visualIndex);
          centers.setMatrixAt(visualIndex, matrix);
        }
        matricesChanged = true;
      }

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
): VegetationSync {
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
  const flattenedTargets = new Uint8Array(layout.denseWeedTargets.length);

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
  weeds.instanceMatrix.needsUpdate = true;
  if (weeds.instanceColor !== null) {
    weeds.instanceColor.needsUpdate = true;
  }
  scene.add(weeds);

  return {
    syncTargets(state: GameState): void {
      const targetOffset = layout.grassCells.length + layout.flowerTargets.length;
      let matricesChanged = false;

      for (let targetIndex = 0; targetIndex < layout.denseWeedTargets.length; targetIndex += 1) {
        const isFlattened = state.targets[targetOffset + targetIndex]?.status !== "standing";
        const nextFlattenedState = Number(isFlattened);
        if (flattenedTargets[targetIndex] === nextFlattenedState) {
          continue;
        }

        flattenedTargets[targetIndex] = nextFlattenedState;
        const targetVisuals = visualsByTarget[targetIndex];
        if (targetVisuals === undefined) {
          continue;
        }

        const transforms = isFlattened ? cutMatrices : standingMatrices;
        for (const visualIndex of targetVisuals) {
          readMatrix(matrix, transforms, visualIndex);
          weeds.setMatrixAt(visualIndex, matrix);
        }
        matricesChanged = true;
      }

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
): VegetationSync {
  const count = layout.saplingVisuals.length;
  const trunkGeometry = track(resources, new THREE.CylinderGeometry(0.12, 0.18, 1.76, 7));
  const trunkMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x9a6538,
      roughness: 0.9,
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
  const lowerCrowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const middleCrowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const upperCrowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
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
  ] as const;
  const crownPalettes = [
    [0x2b8f49, 0x3ea957, 0x61c568],
    [0x258746, 0x39a451, 0x57bd5d],
    [0x33974d, 0x47b05b, 0x6bca6c],
  ] as const;
  const tiltAxis = new THREE.Vector3();
  const tiltRotation = new THREE.Quaternion();
  const yawRotation = new THREE.Quaternion();
  const targetOffset =
    layout.grassCells.length + layout.flowerTargets.length + layout.denseWeedTargets.length;

  for (const visual of layout.saplingVisuals) {
    const palette = crownPalettes[visual.colorIndex] ?? crownPalettes[0];
    for (let layerIndex = 0; layerIndex < crownLayers.length; layerIndex += 1) {
      color.setHex(palette[layerIndex] ?? palette[0]);
      crownLayers[layerIndex]?.mesh.setColorAt(visual.targetIndex, color);
    }
  }

  for (const mesh of [trunks, lowerCrowns, middleCrowns, upperCrowns]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
  scene.add(trunks, lowerCrowns, middleCrowns, upperCrowns);

  return {
    syncTargets(state: GameState, simulationTimeSeconds: number): void {
      for (const visual of layout.saplingVisuals) {
        const target = state.targets[targetOffset + visual.targetIndex];
        const isCut = target?.status === "cut";

        if (isCut) {
          position.set(visual.x, 0, visual.z);
          rotation.identity();
          scale.setScalar(0);
          matrix.compose(position, rotation, scale);
          trunks.setMatrixAt(visual.targetIndex, matrix);
          for (const layer of crownLayers) {
            layer.mesh.setMatrixAt(visual.targetIndex, matrix);
          }
          continue;
        }

        const isCutting = target?.status === "cutting";
        const shudder = isCutting
          ? Math.sin(simulationTimeSeconds * 24 + visual.targetIndex * 1.73)
          : 0;
        const leanAngle = isCutting ? 0.105 + shudder * 0.038 : 0;
        const leanDirection =
          visual.rotation +
          (isCutting ? Math.sin(simulationTimeSeconds * 17 + visual.targetIndex * 2.1) * 0.22 : 0);
        const leanOffsetX = Math.cos(leanDirection) * Math.sin(leanAngle);
        const leanOffsetZ = Math.sin(leanDirection) * Math.sin(leanAngle);
        tiltAxis.set(Math.sin(leanDirection), 0, -Math.cos(leanDirection));
        tiltRotation.setFromAxisAngle(tiltAxis, leanAngle);
        yawRotation.setFromAxisAngle(yAxis, visual.rotation + shudder * 0.045);
        rotation.multiplyQuaternions(tiltRotation, yawRotation);

        const trunkCenterY = 0.88 * visual.size;
        position.set(
          visual.x + leanOffsetX * trunkCenterY,
          trunkCenterY,
          visual.z + leanOffsetZ * trunkCenterY,
        );
        scale.setScalar(visual.size);
        matrix.compose(position, rotation, scale);
        trunks.setMatrixAt(visual.targetIndex, matrix);

        const cosYaw = Math.cos(visual.rotation);
        const sinYaw = Math.sin(visual.rotation);
        for (const layer of crownLayers) {
          const localX = (layer.offsetX * cosYaw - layer.offsetZ * sinYaw) * visual.size;
          const localZ = (layer.offsetX * sinYaw + layer.offsetZ * cosYaw) * visual.size;
          const layerHeight = layer.offsetY * visual.size;
          position.set(
            visual.x + localX + leanOffsetX * layerHeight,
            layerHeight,
            visual.z + localZ + leanOffsetZ * layerHeight,
          );
          scale.set(
            layer.scaleX * visual.size,
            layer.scaleY * visual.size,
            layer.scaleZ * visual.size,
          );
          matrix.compose(position, rotation, scale);
          layer.mesh.setMatrixAt(visual.targetIndex, matrix);
        }
      }

      trunks.instanceMatrix.needsUpdate = true;
      lowerCrowns.instanceMatrix.needsUpdate = true;
      middleCrowns.instanceMatrix.needsUpdate = true;
      upperCrowns.instanceMatrix.needsUpdate = true;
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
): VegetationSync {
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
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
  const crownPalette = [0x2f9c55, 0x42b45f, 0x5ac56a] as const;
  const cutTrunkMatrices = new Float32Array(count * 16);
  const cutCrownMatrices = new Float32Array(count * 16);
  const cutTargets = new Uint8Array(count);

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

    position.y = 2.85 * size;
    scale.set(size * 1.05, size * 0.92, size * 1.05);
    matrix.compose(position, rotation, scale);
    crowns.setMatrixAt(index, matrix);
    color.setHex(crownPalette[index % crownPalette.length] ?? crownPalette[0]);
    crowns.setColorAt(index, color);

    position.set(x, 0.2115 * size, z);
    scale.set(size, 0.18 * size, size);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutTrunkMatrices, index, matrix);

    position.set(x, 0.02, z);
    scale.setScalar(0.001);
    matrix.compose(position, rotation, scale);
    writeMatrix(cutCrownMatrices, index, matrix);
  }

  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor !== null) {
    crowns.instanceColor.needsUpdate = true;
  }
  scene.add(trunks, crowns);

  return {
    syncTargets(state: GameState): void {
      const targetOffset =
        layout.grassCells.length +
        layout.flowerTargets.length +
        layout.denseWeedTargets.length +
        layout.saplingTargets.length;
      let matricesChanged = false;

      for (const visual of layout.matureTreeVisuals) {
        const isCut = state.targets[targetOffset + visual.targetIndex]?.status === "cut";
        const nextCutState = Number(isCut);
        if (cutTargets[visual.targetIndex] === nextCutState) {
          continue;
        }

        cutTargets[visual.targetIndex] = nextCutState;
        readMatrix(matrix, cutTrunkMatrices, visual.targetIndex);
        trunks.setMatrixAt(visual.targetIndex, matrix);
        readMatrix(matrix, cutCrownMatrices, visual.targetIndex);
        crowns.setMatrixAt(visual.targetIndex, matrix);
        matricesChanged = true;
      }

      if (matricesChanged) {
        trunks.instanceMatrix.needsUpdate = true;
        crowns.instanceMatrix.needsUpdate = true;
      }
    },
  };
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
): THREE.Group {
  const shadowGeometry = track(resources, new THREE.CircleGeometry(2.05, 40));
  const shadowMaterial = track(
    resources,
    new THREE.MeshBasicMaterial({
      color: 0x123e2a,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  // Keep the blob above ground patches and cut stubble while standing vegetation still occludes it.
  shadow.position.y = 0.13;
  playerRoot.add(shadow);

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

  for (let index = 0; index < 4; index += 1) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.rotation.y = index * (Math.PI / 2);
    blade.castShadow = true;
    bladePivot.add(blade);
  }

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

  return bladePivot;
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
