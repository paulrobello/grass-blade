import * as THREE from "three";

import type { CutCompletionEvent, GameState } from "./state";

const MAX_FRAGMENT_COUNT = 240;
const TAU = Math.PI * 2;
const GRAVITY = 5.6;

const GRASS_FRAGMENT = 0;
const PETAL_FRAGMENT = 1;
const LEAF_FRAGMENT = 2;
const WOOD_FRAGMENT = 3;

const GRASS_COLORS = [0x2b8c3f, 0x43ad48, 0x71cf50] as const;
const PETAL_COLORS = [0xffffff, 0xff78b4, 0xd08aff, 0x79d7ff, 0xffdd63] as const;
const LEAF_COLORS = [0x287f3b, 0x45a94b, 0x75c84e, 0xa6d74d] as const;
const WOOD_COLORS = [0x8f512b, 0xb76b33, 0xd9964f, 0xf0bd72] as const;

export interface CutEffectsDiagnostics {
  activeFragments: number;
  consumedCutRevision: number;
  consumedGrassVisualCuts: number;
}

export interface CutEffects {
  diagnostics: CutEffectsDiagnostics;
  sync: (state: GameState, simulationTimeSeconds: number) => void;
  dispose: () => void;
}

export function createCutEffects(
  scene: THREE.Scene,
  seed: number,
  reducedMotion: boolean,
): CutEffects {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const fragments = new THREE.InstancedMesh(geometry, material, MAX_FRAGMENT_COUNT);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const active = new Uint8Array(MAX_FRAGMENT_COUNT);
  const bornAt = new Float32Array(MAX_FRAGMENT_COUNT);
  const lifetime = new Float32Array(MAX_FRAGMENT_COUNT);
  const originX = new Float32Array(MAX_FRAGMENT_COUNT);
  const originY = new Float32Array(MAX_FRAGMENT_COUNT);
  const originZ = new Float32Array(MAX_FRAGMENT_COUNT);
  const velocityX = new Float32Array(MAX_FRAGMENT_COUNT);
  const velocityY = new Float32Array(MAX_FRAGMENT_COUNT);
  const velocityZ = new Float32Array(MAX_FRAGMENT_COUNT);
  const width = new Float32Array(MAX_FRAGMENT_COUNT);
  const height = new Float32Array(MAX_FRAGMENT_COUNT);
  const baseTilt = new Float32Array(MAX_FRAGMENT_COUNT);
  const baseYaw = new Float32Array(MAX_FRAGMENT_COUNT);
  const spinRate = new Float32Array(MAX_FRAGMENT_COUNT);
  const diagnostics: CutEffectsDiagnostics = {
    activeFragments: 0,
    consumedCutRevision: 0,
    consumedGrassVisualCuts: 0,
  };

  let nextSlot = 0;
  let activeFragmentCount = 0;
  let consumedCutEventCount = 0;
  let colorsChanged = false;

  position.set(0, -10, 0);
  quaternion.identity();
  scale.setScalar(0);
  matrix.compose(position, quaternion, scale);
  color.setHex(GRASS_COLORS[0]);
  for (let index = 0; index < MAX_FRAGMENT_COUNT; index += 1) {
    fragments.setMatrixAt(index, matrix);
    fragments.setColorAt(index, color);
  }

  fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fragments.instanceMatrix.needsUpdate = true;
  if (fragments.instanceColor !== null) {
    fragments.instanceColor.needsUpdate = true;
  }
  fragments.frustumCulled = false;
  fragments.renderOrder = 3;
  scene.add(fragments);

  function spawnFragment(
    style: number,
    key: number,
    x: number,
    z: number,
    simulationTimeSeconds: number,
  ): void {
    const slot = nextSlot;
    nextSlot = (nextSlot + 1) % MAX_FRAGMENT_COUNT;
    if (active[slot] === 0) {
      active[slot] = 1;
      activeFragmentCount += 1;
    }

    const angle = randomUnit(seed, key, 0) * TAU;
    const radius = randomUnit(seed, key, 1) * (style === GRASS_FRAGMENT ? 0.2 : 0.48);
    const speed =
      (style === WOOD_FRAGMENT ? 1.25 : style === GRASS_FRAGMENT ? 0.68 : 0.95) *
      (0.72 + randomUnit(seed, key, 2) * 0.72);
    const lift =
      (style === WOOD_FRAGMENT ? 2.5 : style === GRASS_FRAGMENT ? 1.28 : 2.05) *
      (0.82 + randomUnit(seed, key, 3) * 0.5);

    bornAt[slot] = simulationTimeSeconds;
    lifetime[slot] =
      (reducedMotion ? 0.24 : style === GRASS_FRAGMENT ? 0.58 : 0.88) +
      randomUnit(seed, key, 4) * (reducedMotion ? 0.12 : 0.32);
    originX[slot] = x + Math.cos(angle) * radius;
    originY[slot] = style === GRASS_FRAGMENT ? 0.16 : style === WOOD_FRAGMENT ? 0.42 : 0.3;
    originZ[slot] = z + Math.sin(angle) * radius;
    velocityX[slot] = Math.cos(angle) * speed;
    velocityY[slot] = lift;
    velocityZ[slot] = Math.sin(angle) * speed;
    baseTilt[slot] = randomUnit(seed, key, 5) * TAU;
    baseYaw[slot] = randomUnit(seed, key, 6) * TAU;
    spinRate[slot] = (randomUnit(seed, key, 7) * 2 - 1) * (style === WOOD_FRAGMENT ? 9 : 13);

    switch (style) {
      case PETAL_FRAGMENT:
        width[slot] = 0.16 + randomUnit(seed, key, 8) * 0.09;
        height[slot] = 0.09 + randomUnit(seed, key, 9) * 0.06;
        color.setHex(paletteColor(PETAL_COLORS, seed, key, 10));
        break;
      case LEAF_FRAGMENT:
        width[slot] = 0.2 + randomUnit(seed, key, 8) * 0.12;
        height[slot] = 0.065 + randomUnit(seed, key, 9) * 0.045;
        color.setHex(paletteColor(LEAF_COLORS, seed, key, 10));
        break;
      case WOOD_FRAGMENT:
        width[slot] = 0.17 + randomUnit(seed, key, 8) * 0.13;
        height[slot] = 0.055 + randomUnit(seed, key, 9) * 0.05;
        color.setHex(paletteColor(WOOD_COLORS, seed, key, 10));
        break;
      default:
        width[slot] = 0.1 + randomUnit(seed, key, 8) * 0.08;
        height[slot] = 0.035 + randomUnit(seed, key, 9) * 0.025;
        color.setHex(paletteColor(GRASS_COLORS, seed, key, 10));
        break;
    }

    fragments.setColorAt(slot, color);
    colorsChanged = true;
  }

  function spawnGrassClipping(
    state: GameState,
    visualIndex: number,
    simulationTimeSeconds: number,
  ): void {
    const threshold = reducedMotion ? 0.08 : 0.3;
    if (randomUnit(seed, visualIndex, 31) > threshold) {
      return;
    }

    const positionIndex = visualIndex * 2;
    const x = state.grassVisualPositions[positionIndex];
    const z = state.grassVisualPositions[positionIndex + 1];
    if (x === undefined || z === undefined) {
      return;
    }

    spawnFragment(GRASS_FRAGMENT, visualIndex * 17 + 3, x, z, simulationTimeSeconds);
  }

  function spawnCompletionBurst(event: CutCompletionEvent, simulationTimeSeconds: number): void {
    let count = reducedMotion ? 2 : 7;
    let primaryStyle = GRASS_FRAGMENT;
    let includesWood = false;

    switch (event.kind) {
      case "flower":
        count = reducedMotion ? 4 : 14;
        primaryStyle = PETAL_FRAGMENT;
        break;
      case "denseWeed":
        count = reducedMotion ? 4 : 13;
        primaryStyle = LEAF_FRAGMENT;
        break;
      case "sapling":
        count = reducedMotion ? 5 : 18;
        includesWood = true;
        break;
      case "matureTree":
        count = reducedMotion ? 6 : 24;
        includesWood = true;
        break;
      case "grass":
        break;
    }

    for (let index = 0; index < count; index += 1) {
      const style = includesWood
        ? index % (event.kind === "matureTree" ? 3 : 2) === 0
          ? LEAF_FRAGMENT
          : WOOD_FRAGMENT
        : primaryStyle;
      const key = event.revision * 131 + index * 19 + 7;
      spawnFragment(style, key, event.x, event.z, simulationTimeSeconds);
    }
  }

  function updateFragments(simulationTimeSeconds: number): boolean {
    let matricesChanged = false;

    for (let index = 0; index < MAX_FRAGMENT_COUNT; index += 1) {
      if (active[index] === 0) {
        continue;
      }

      const age = Math.max(0, simulationTimeSeconds - (bornAt[index] ?? 0));
      const fragmentLifetime = lifetime[index] ?? 0;
      if (age >= fragmentLifetime) {
        active[index] = 0;
        activeFragmentCount -= 1;
        position.set(0, -10, 0);
        quaternion.identity();
        scale.setScalar(0);
        matrix.compose(position, quaternion, scale);
        fragments.setMatrixAt(index, matrix);
        matricesChanged = true;
        continue;
      }

      const progress = fragmentLifetime <= 0 ? 1 : age / fragmentLifetime;
      const fade = Math.max(0, 1 - progress * progress);
      const x = (originX[index] ?? 0) + (velocityX[index] ?? 0) * age;
      const y = Math.max(
        0.025,
        (originY[index] ?? 0) + (velocityY[index] ?? 0) * age - GRAVITY * age * age * 0.5,
      );
      const z = (originZ[index] ?? 0) + (velocityZ[index] ?? 0) * age;
      const spin = (spinRate[index] ?? 0) * age;
      position.set(x, y, z);
      rotation.set((baseTilt[index] ?? 0) + spin, (baseYaw[index] ?? 0) + spin * 0.37, spin * 0.61);
      quaternion.setFromEuler(rotation);
      scale.set((width[index] ?? 0) * fade, (height[index] ?? 0) * fade, 1);
      matrix.compose(position, quaternion, scale);
      fragments.setMatrixAt(index, matrix);
      matricesChanged = true;
    }

    return matricesChanged;
  }

  function sync(state: GameState, simulationTimeSeconds: number): void {
    while (diagnostics.consumedGrassVisualCuts < state.cutGrassVisualIndices.length) {
      const visualIndex = state.cutGrassVisualIndices[diagnostics.consumedGrassVisualCuts];
      diagnostics.consumedGrassVisualCuts += 1;
      if (visualIndex !== undefined) {
        spawnGrassClipping(state, visualIndex, simulationTimeSeconds);
      }
    }

    while (consumedCutEventCount < state.cutEvents.length) {
      const event = state.cutEvents[consumedCutEventCount];
      consumedCutEventCount += 1;
      if (event === undefined) {
        continue;
      }
      spawnCompletionBurst(event, simulationTimeSeconds);
      diagnostics.consumedCutRevision = event.revision;
    }

    if (updateFragments(simulationTimeSeconds)) {
      fragments.instanceMatrix.needsUpdate = true;
    }
    if (colorsChanged && fragments.instanceColor !== null) {
      fragments.instanceColor.needsUpdate = true;
      colorsChanged = false;
    }
    diagnostics.activeFragments = activeFragmentCount;
  }

  function dispose(): void {
    scene.remove(fragments);
    geometry.dispose();
    material.dispose();
  }

  return { diagnostics, sync, dispose };
}

function paletteColor(palette: readonly number[], seed: number, key: number, lane: number): number {
  const index = Math.min(
    palette.length - 1,
    Math.floor(randomUnit(seed, key, lane) * palette.length),
  );
  return palette[index] ?? palette[0] ?? 0xffffff;
}

function randomUnit(seed: number, key: number, lane: number): number {
  let value = (seed ^ Math.imul(key + 1, 0x9e3779b1) ^ Math.imul(lane + 1, 0x85ebca6b)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}
