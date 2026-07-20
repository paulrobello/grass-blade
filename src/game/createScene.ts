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

interface VegetationSync {
  syncTargets: (state: GameState) => void;
}

export interface MeadowScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  density: {
    grassInstances: number;
    flowerInstances: number;
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
  addTrees(
    scene,
    resources,
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

  let lastCutRevision = -1;

  function sync(state: GameState): void {
    playerRoot.position.set(state.player.x, 0, state.player.z);
    bladePivot.rotation.y = state.player.bladeAngleRadians;

    if (state.cutRevision !== lastCutRevision) {
      grass.syncTargets(state);
      flowers.syncTargets(state);
      lastCutRevision = state.cutRevision;
    }

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
      flowerInstances: FLOWER_VISUAL_COUNT,
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
  const standingMatrices = new Float32Array(count * 16);
  const cutMatrices = new Float32Array(count * 16);
  const visualsByTarget = Array.from({ length: layout.grassCells.length }, () => [] as number[]);
  const cutTargets = new Uint8Array(layout.grassCells.length);

  for (let index = 0; index < count; index += 1) {
    const visual = layout.grassVisuals[index];
    if (visual === undefined) {
      continue;
    }

    const targetVisuals = visualsByTarget[visual.cellIndex];
    targetVisuals?.push(index);

    position.set(visual.x, 0.015, visual.z);
    rotation.setFromAxisAngle(yAxis, visual.rotation);
    scale.set(visual.scaleX, visual.height, visual.scaleZ);
    matrix.compose(position, rotation, scale);
    grass.setMatrixAt(index, matrix);
    writeMatrix(standingMatrices, index, matrix);

    position.y = 0.018;
    rotation.setFromAxisAngle(yAxis, visual.rotation + 0.38);
    scale.set(visual.scaleX * 0.62, 0.085, visual.scaleZ * 0.62);
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

      for (let targetIndex = 0; targetIndex < layout.grassCells.length; targetIndex += 1) {
        const isCut = state.targets[targetIndex]?.status === "cut";
        const nextCutState = Number(isCut);
        if (cutTargets[targetIndex] === nextCutState) {
          continue;
        }

        cutTargets[targetIndex] = nextCutState;
        const targetVisuals = visualsByTarget[targetIndex];
        if (targetVisuals === undefined) {
          continue;
        }
        const transforms = isCut ? cutMatrices : standingMatrices;
        for (const visualIndex of targetVisuals) {
          readMatrix(matrix, transforms, visualIndex);
          grass.setMatrixAt(visualIndex, matrix);
        }
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
  const blades = [
    { angle: 0, x: -0.1, z: 0.02, width: 0.22, height: 1, lean: 0.12 },
    { angle: Math.PI * 0.4, x: 0.1, z: -0.04, width: 0.2, height: 0.9, lean: -0.11 },
    { angle: -Math.PI * 0.4, x: 0.01, z: 0.11, width: 0.19, height: 0.8, lean: 0.1 },
    { angle: Math.PI * 0.78, x: -0.03, z: -0.1, width: 0.17, height: 0.72, lean: -0.08 },
    { angle: -Math.PI * 0.78, x: 0.08, z: 0.06, width: 0.16, height: 0.66, lean: 0.07 },
  ] as const;

  for (const blade of blades) {
    appendGrassBlade(positions, blade);
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
  const shoulderWidth = halfWidth * 0.68;
  const shoulderX = blade.x + forwardX * blade.lean * 0.55;
  const shoulderZ = blade.z + forwardZ * blade.lean * 0.55;
  const tipX = blade.x + forwardX * blade.lean;
  const tipZ = blade.z + forwardZ * blade.lean;
  const baseLeft = [blade.x - rightX * halfWidth, 0, blade.z - rightZ * halfWidth] as const;
  const baseRight = [blade.x + rightX * halfWidth, 0, blade.z + rightZ * halfWidth] as const;
  const shoulderLeft = [
    shoulderX - rightX * shoulderWidth,
    blade.height * 0.58,
    shoulderZ - rightZ * shoulderWidth,
  ] as const;
  const shoulderRight = [
    shoulderX + rightX * shoulderWidth,
    blade.height * 0.58,
    shoulderZ + rightZ * shoulderWidth,
  ] as const;
  const tip = [tipX, blade.height, tipZ] as const;

  appendTriangle(positions, baseLeft, baseRight, shoulderRight);
  appendTriangle(positions, baseLeft, shoulderRight, shoulderLeft);
  appendTriangle(positions, shoulderLeft, shoulderRight, tip);
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
  const cutTargets = new Uint8Array(layout.flowerTargets.length);

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
        const isCut = state.targets[targetOffset + targetIndex]?.status === "cut";
        const nextCutState = Number(isCut);
        if (cutTargets[targetIndex] === nextCutState) {
          continue;
        }

        cutTargets[targetIndex] = nextCutState;
        const targetVisuals = visualsByTarget[targetIndex];
        if (targetVisuals === undefined) {
          continue;
        }

        const stemTransforms = isCut ? cutStemMatrices : standingStemMatrices;
        const headTransforms = isCut ? cutHeadMatrices : standingHeadMatrices;
        const centerTransforms = isCut ? cutCenterMatrices : standingCenterMatrices;
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

function addTrees(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
): void {
  const treePositions = [
    [-16, -15, 1.05],
    [-8, -18, 0.85],
    [8, -17, 1.15],
    [17, -10, 0.95],
    [17, 13, 1.1],
    [7, 18, 0.9],
    [-10, 17, 1.18],
    [-18, 8, 0.92],
  ] as const;
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
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treePositions.length);
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, treePositions.length);
  const crownPalette = [0x2f9c55, 0x42b45f, 0x5ac56a] as const;

  rotation.identity();
  for (let index = 0; index < treePositions.length; index += 1) {
    const tree = treePositions[index];
    if (tree === undefined) {
      continue;
    }
    const [x, z, size] = tree;

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
  shadow.position.y = 0.028;
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
