import * as THREE from "three";

import type { GameState } from "./state";
import { WORLD_HALF_EXTENT } from "./state";

const TAU = Math.PI * 2;
const CAMERA_OFFSET_X = 12;
const CAMERA_OFFSET_Y = 24;
const CAMERA_OFFSET_Z = 12;
const CAMERA_VIEW_HEIGHT = 20;
const GRASS_GRID_COLUMNS = 104;
const GRASS_FIELD_SIZE = 41;
const FLOWER_CLUSTER_COUNT = 16;
const FLOWER_COUNT = 420;

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
  scene.background = new THREE.Color(0xa8e7ff);
  scene.fog = new THREE.Fog(0xa8e7ff, 28, 58);

  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  const random = createSeededRandom(seed);
  const scratchMatrix = new THREE.Matrix4();
  const scratchPosition = new THREE.Vector3();
  const scratchRotation = new THREE.Quaternion();
  const scratchScale = new THREE.Vector3();
  const scratchColor = new THREE.Color();
  const cameraTarget = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  const groundGeometry = track(resources, new THREE.PlaneGeometry(48, 48));
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
  addGrass(
    scene,
    resources,
    random,
    scratchMatrix,
    scratchPosition,
    scratchRotation,
    scratchScale,
    scratchColor,
    yAxis,
  );
  addFlowers(
    scene,
    resources,
    random,
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

  function sync(state: GameState, simulationTimeSeconds: number): void {
    playerRoot.position.set(state.player.x, 0, state.player.z);
    bladePivot.rotation.y = simulationTimeSeconds * (state.player.rpm / 60) * TAU;

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
      grassInstances: GRASS_GRID_COLUMNS * GRASS_GRID_COLUMNS,
      flowerInstances: FLOWER_COUNT,
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
  random: () => number,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
): void {
  const count = GRASS_GRID_COLUMNS * GRASS_GRID_COLUMNS;
  const geometry = track(resources, new THREE.ConeGeometry(0.115, 0.82, 3, 1));
  const material = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
    }),
  );
  const grass = new THREE.InstancedMesh(geometry, material, count);
  const palette = [0x2f9e44, 0x40b84f, 0x5dcc5f, 0x74d66b] as const;

  const cellSize = GRASS_FIELD_SIZE / GRASS_GRID_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;
  const jitter = cellSize * 0.42;

  for (let index = 0; index < count; index += 1) {
    const column = index % GRASS_GRID_COLUMNS;
    const row = Math.floor(index / GRASS_GRID_COLUMNS);
    const x = -halfField + (column + 0.5) * cellSize + randomRange(random, -jitter, jitter);
    const z = -halfField + (row + 0.5) * cellSize + randomRange(random, -jitter, jitter);
    const height = 0.68 + random() * 0.72;
    position.set(x, (0.82 * height) / 2, z);
    rotation.setFromAxisAngle(yAxis, random() * TAU);
    scale.set(0.82 + random() * 0.62, height, 0.82 + random() * 0.62);
    matrix.compose(position, rotation, scale);
    grass.setMatrixAt(index, matrix);
    color.setHex(palette[Math.floor(random() * palette.length)] ?? palette[0]);
    grass.setColorAt(index, color);
  }

  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor !== null) {
    grass.instanceColor.needsUpdate = true;
  }
  scene.add(grass);
}

function addFlowers(
  scene: THREE.Scene,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  random: () => number,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.Color,
  yAxis: THREE.Vector3,
): void {
  const count = FLOWER_COUNT;
  const stemGeometry = track(resources, new THREE.CylinderGeometry(0.035, 0.055, 0.72, 6));
  const stemMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({ color: 0x22863a, roughness: 0.88 }),
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
    new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.68, flatShading: true }),
  );
  const stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, count);
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, count);
  const centers = new THREE.InstancedMesh(centerGeometry, centerMaterial, count);
  const palette = [0xfff1a8, 0xff6b9e, 0xf783ff, 0xffffff, 0x74c0fc] as const;
  const clusters = Array.from({ length: FLOWER_CLUSTER_COUNT }, () => ({
    x: randomRange(random, -17.5, 17.5),
    z: randomRange(random, -17.5, 17.5),
    radius: 1.5 + random() * 2.2,
  }));

  for (let index = 0; index < count; index += 1) {
    const cluster = clusters[index % clusters.length];
    if (cluster === undefined) {
      continue;
    }
    const isMeadowSprinkle = index % 6 === 0;
    const angle = random() * TAU;
    const distance = Math.sqrt(random()) * cluster.radius;
    const x = isMeadowSprinkle
      ? randomRange(random, -19.5, 19.5)
      : THREE.MathUtils.clamp(cluster.x + Math.cos(angle) * distance, -19.5, 19.5);
    const z = isMeadowSprinkle
      ? randomRange(random, -19.5, 19.5)
      : THREE.MathUtils.clamp(cluster.z + Math.sin(angle) * distance, -19.5, 19.5);

    const flowerScale = 0.78 + random() * 0.5;
    rotation.setFromAxisAngle(yAxis, random() * TAU);
    position.set(x, 0.36 * flowerScale, z);
    scale.set(flowerScale * 0.86, flowerScale, flowerScale * 0.86);
    matrix.compose(position, rotation, scale);
    stems.setMatrixAt(index, matrix);

    position.y = 0.75 * flowerScale;
    scale.set(flowerScale, flowerScale, flowerScale);
    matrix.compose(position, rotation, scale);
    heads.setMatrixAt(index, matrix);
    color.setHex(palette[Math.floor(random() * palette.length)] ?? palette[0]);
    heads.setColorAt(index, color);

    position.y = 0.79 * flowerScale;
    matrix.compose(position, rotation, scale);
    centers.setMatrixAt(index, matrix);
  }

  stems.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  centers.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor !== null) {
    heads.instanceColor.needsUpdate = true;
  }
  scene.add(stems, heads, centers);
}

function createFlowerHeadGeometry(): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(0.195, 20);
  const positions = geometry.getAttribute("position");

  for (let index = 1; index < positions.count; index += 1) {
    const angle = Math.atan2(positions.getY(index), positions.getX(index));
    const radius = 0.145 + Math.cos(angle * 5) * 0.05;
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
  const shadowGeometry = track(resources, new THREE.CircleGeometry(1.18, 28));
  const shadowMaterial = track(
    resources,
    new THREE.MeshBasicMaterial({
      color: 0x17482d,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    }),
  );
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.028;
  playerRoot.add(shadow);

  const hubGeometry = track(resources, new THREE.CylinderGeometry(0.52, 0.64, 0.5, 16));
  const hubMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xff7a38,
      roughness: 0.34,
      metalness: 0.2,
      emissive: 0x7a2107,
      emissiveIntensity: 0.16,
    }),
  );
  const hub = new THREE.Mesh(hubGeometry, hubMaterial);
  hub.position.y = 0.37;
  hub.castShadow = true;
  playerRoot.add(hub);

  const bladePivot = new THREE.Group();
  bladePivot.position.y = 0.63;
  playerRoot.add(bladePivot);

  const bladeGeometry = track(resources, new THREE.BoxGeometry(3.45, 0.13, 0.42));
  const bladeMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xf8fbff,
      roughness: 0.2,
      metalness: 0.82,
      emissive: 0x385675,
      emissiveIntensity: 0.13,
    }),
  );
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.castShadow = true;
  bladePivot.add(blade);

  const tipGeometry = track(resources, new THREE.ConeGeometry(0.3, 0.68, 4));
  const tipMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0xffc83d,
      roughness: 0.34,
      metalness: 0.52,
      flatShading: true,
    }),
  );
  const rightTip = new THREE.Mesh(tipGeometry, tipMaterial);
  rightTip.position.x = 1.93;
  rightTip.rotation.z = -Math.PI / 2;
  rightTip.castShadow = true;
  bladePivot.add(rightTip);

  const leftTip = new THREE.Mesh(tipGeometry, tipMaterial);
  leftTip.position.x = -1.93;
  leftTip.rotation.z = Math.PI / 2;
  leftTip.castShadow = true;
  bladePivot.add(leftTip);

  const capGeometry = track(resources, new THREE.CylinderGeometry(0.22, 0.28, 0.18, 12));
  const capMaterial = track(
    resources,
    new THREE.MeshStandardMaterial({
      color: 0x244c68,
      roughness: 0.32,
      metalness: 0.56,
    }),
  );
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = 0.12;
  cap.castShadow = true;
  bladePivot.add(cap);

  return bladePivot;
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
