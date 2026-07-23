import * as THREE from "three";

import type { CutCompletionEvent } from "./state";

export const MAX_COLLECTION_MOTES = 64;

const REDUCED_MOTION_DURATION_SECONDS = 0.18;
const MIN_ARC_DURATION_SECONDS = 0.28;
const ARC_DURATION_RANGE_SECONDS = 0.17;

export type CollectionResource = "grass" | "flowers" | "fiber" | "wood";

export interface CollectionMoteDiagnostics {
  activeMotes: number;
  consumedCutRevision: number;
  aggregatedUnits: number;
}

export interface CollectionMoteDestinations {
  grass: HTMLElement;
  flowers: HTMLElement;
  fiber: HTMLElement;
  wood: HTMLElement;
}

export interface CollectionMoteSample {
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

export interface CollectionMotePoolSlotState {
  active: boolean;
  resource: CollectionResource | null;
  bornAt: number;
}

export interface CollectionMotePoolChoice {
  index: number;
  aggregate: boolean;
}

export interface CollectionMotes {
  diagnostics: CollectionMoteDiagnostics;
  enqueue: (events: readonly CutCompletionEvent[], simulationTimeSeconds: number) => void;
  sync: (simulationTimeSeconds: number, camera: THREE.Camera, canvas: HTMLCanvasElement) => void;
  dispose: () => void;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface MoteSlot extends CollectionMotePoolSlotState {
  element: HTMLDivElement;
  glyph: HTMLSpanElement;
  amountLabel: HTMLSpanElement;
  amount: number;
  duration: number;
  originX: number;
  originY: number;
  originZ: number;
  startX: number;
  startY: number;
  projected: boolean;
  presentationDirty: boolean;
  sample: CollectionMoteSample;
}

export function collectionResourceForKind(kind: CutCompletionEvent["kind"]): CollectionResource {
  switch (kind) {
    case "grass":
      return "grass";
    case "flower":
      return "flowers";
    case "denseWeed":
    case "fiberReed":
    case "shrub":
      return "fiber";
    case "sapling":
    case "matureTree":
      return "wood";
  }
}

export function collectionMoteDurationSeconds(
  seed: number,
  revision: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) {
    return REDUCED_MOTION_DURATION_SECONDS;
  }

  return MIN_ARC_DURATION_SECONDS + deterministicUnit(seed, revision) * ARC_DURATION_RANGE_SECONDS;
}

export function sampleCollectionMotePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  progress: number,
  reducedMotion: boolean,
  output: CollectionMoteSample,
): CollectionMoteSample {
  const normalizedProgress = clamp(progress, 0, 1);

  if (reducedMotion) {
    const fade = Math.sin(normalizedProgress * Math.PI);
    output.x = endX;
    output.y = endY;
    output.opacity = fade;
    output.scale = 0.82 + fade * 0.18;
    return output;
  }

  const easedProgress = 1 - (1 - normalizedProgress) ** 3;
  const distance = Math.hypot(endX - startX, endY - startY);
  const arcHeight = clamp(distance * 0.16, 42, 110);
  output.x = startX + (endX - startX) * easedProgress;
  output.y =
    startY + (endY - startY) * easedProgress - Math.sin(normalizedProgress * Math.PI) * arcHeight;
  output.opacity = normalizedProgress < 0.78 ? 1 : (1 - normalizedProgress) / 0.22;
  output.scale = 0.72 + Math.sin(normalizedProgress * Math.PI) * 0.34;
  return output;
}

export function chooseCollectionMoteSlot(
  slots: readonly CollectionMotePoolSlotState[],
  resource: CollectionResource,
): CollectionMotePoolChoice {
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index]?.active === false) {
      return { index, aggregate: false };
    }
  }

  let newestMatchingIndex = -1;
  let newestMatchingTime = Number.NEGATIVE_INFINITY;
  let oldestIndex = 0;
  let oldestTime = Number.POSITIVE_INFINITY;

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (slot === undefined) {
      continue;
    }
    if (slot.resource === resource && slot.bornAt >= newestMatchingTime) {
      newestMatchingIndex = index;
      newestMatchingTime = slot.bornAt;
    }
    if (slot.bornAt < oldestTime) {
      oldestIndex = index;
      oldestTime = slot.bornAt;
    }
  }

  return newestMatchingIndex >= 0
    ? { index: newestMatchingIndex, aggregate: true }
    : { index: oldestIndex, aggregate: false };
}

export function consumeNewCollectionMoteEvents(
  events: readonly CutCompletionEvent[],
  consumedEventCount: number,
  simulationTimeSeconds: number,
  consume: (event: CutCompletionEvent, bornAt: number) => void,
): number {
  let nextEventIndex = consumedEventCount;

  while (nextEventIndex < events.length) {
    const event = events[nextEventIndex];
    nextEventIndex += 1;
    if (event !== undefined) {
      consume(event, simulationTimeSeconds);
    }
  }

  return nextEventIndex;
}

export function createCollectionMotes(
  root: HTMLElement,
  destinations: CollectionMoteDestinations,
  seed: number,
  reducedMotion: boolean,
): CollectionMotes {
  const layer = document.createElement("div");
  const worldPoint = new THREE.Vector3();
  const diagnostics: CollectionMoteDiagnostics = {
    activeMotes: 0,
    consumedCutRevision: 0,
    aggregatedUnits: 0,
  };
  const slots: MoteSlot[] = [];

  layer.className = "collection-mote-layer";
  layer.setAttribute("aria-hidden", "true");
  root.append(layer);

  for (let index = 0; index < MAX_COLLECTION_MOTES; index += 1) {
    const element = document.createElement("div");
    const glyph = document.createElement("span");
    const amountLabel = document.createElement("span");

    element.className = "collection-mote";
    element.hidden = true;
    glyph.className = "collection-mote__glyph";
    amountLabel.className = "collection-mote__amount";
    amountLabel.hidden = true;
    element.append(glyph, amountLabel);
    layer.append(element);
    slots.push({
      active: false,
      resource: null,
      bornAt: 0,
      element,
      glyph,
      amountLabel,
      amount: 0,
      duration: 0,
      originX: 0,
      originY: 0,
      originZ: 0,
      startX: 0,
      startY: 0,
      projected: false,
      presentationDirty: false,
      sample: { x: 0, y: 0, opacity: 0, scale: 0 },
    });
  }

  let consumedCutEventCount = 0;

  function deactivate(slot: MoteSlot): void {
    if (!slot.active) {
      return;
    }
    slot.active = false;
    slot.resource = null;
    slot.projected = false;
    slot.presentationDirty = true;
    diagnostics.activeMotes -= 1;
  }

  function retireExpired(simulationTimeSeconds: number): void {
    for (const slot of slots) {
      if (slot.active && simulationTimeSeconds - slot.bornAt >= slot.duration) {
        deactivate(slot);
      }
    }
  }

  function updateAmountPresentation(slot: MoteSlot): void {
    const showAmount = slot.amount > 1;
    slot.amountLabel.hidden = !showAmount;
    slot.amountLabel.textContent = showAmount ? `+${slot.amount}` : "";
    slot.element.classList.toggle("collection-mote--aggregate", showAmount);
  }

  function queueEvent(event: CutCompletionEvent, simulationTimeSeconds: number): void {
    const resource = collectionResourceForKind(event.kind);
    const choice = chooseCollectionMoteSlot(slots, resource);
    const slot = slots[choice.index];
    if (slot === undefined) {
      return;
    }

    if (choice.aggregate) {
      slot.amount += event.yield;
      slot.bornAt = simulationTimeSeconds;
      slot.duration = collectionMoteDurationSeconds(seed, event.revision, reducedMotion);
      slot.originX = event.x;
      slot.originY = collectionMoteOriginHeight(event.kind);
      slot.originZ = event.z;
      slot.projected = false;
      slot.presentationDirty = true;
      diagnostics.aggregatedUnits += event.yield;
      return;
    }

    if (slot.active) {
      deactivate(slot);
    }

    slot.active = true;
    slot.resource = resource;
    slot.bornAt = simulationTimeSeconds;
    slot.duration = collectionMoteDurationSeconds(seed, event.revision, reducedMotion);
    slot.originX = event.x;
    slot.originY = collectionMoteOriginHeight(event.kind);
    slot.originZ = event.z;
    slot.projected = false;
    slot.presentationDirty = true;
    slot.amount = event.yield;
    diagnostics.activeMotes += 1;
  }

  function enqueue(events: readonly CutCompletionEvent[], simulationTimeSeconds: number): void {
    retireExpired(simulationTimeSeconds);
    consumedCutEventCount = consumeNewCollectionMoteEvents(
      events,
      consumedCutEventCount,
      simulationTimeSeconds,
      queueEvent,
    );
    diagnostics.consumedCutRevision = events[consumedCutEventCount - 1]?.revision ?? 0;
  }

  function sync(
    simulationTimeSeconds: number,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
  ): void {
    retireExpired(simulationTimeSeconds);

    for (const slot of slots) {
      if (!slot.active && !slot.element.hidden) {
        slot.element.hidden = true;
      }
    }

    if (diagnostics.activeMotes === 0) {
      return;
    }

    const rootBounds = root.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    const destinationPoints = measureDestinations(destinations, rootBounds);
    for (const slot of slots) {
      if (!slot.active || slot.resource === null) {
        continue;
      }

      if (!slot.projected) {
        worldPoint.set(slot.originX, slot.originY, slot.originZ).project(camera);
        slot.startX =
          canvasBounds.left - rootBounds.left + (worldPoint.x + 1) * 0.5 * canvasBounds.width;
        slot.startY =
          canvasBounds.top - rootBounds.top + (1 - worldPoint.y) * 0.5 * canvasBounds.height;
        slot.sample.x = slot.startX;
        slot.sample.y = slot.startY;
        slot.projected = true;
      }
      if (slot.presentationDirty) {
        slot.element.dataset.resource = slot.resource;
        slot.glyph.textContent = resourceGlyph(slot.resource);
        slot.element.hidden = false;
        updateAmountPresentation(slot);
        slot.presentationDirty = false;
      }

      const age = Math.max(0, simulationTimeSeconds - slot.bornAt);
      const destination = destinationPoints[slot.resource];
      sampleCollectionMotePath(
        slot.startX,
        slot.startY,
        destination.x,
        destination.y,
        slot.duration <= 0 ? 1 : age / slot.duration,
        reducedMotion,
        slot.sample,
      );
      const amountScale = 1 + Math.min(0.52, Math.log2(Math.max(1, slot.amount)) * 0.11);
      slot.element.style.opacity = String(clamp(slot.sample.opacity, 0, 1));
      slot.element.style.transform = `translate3d(${slot.sample.x}px, ${slot.sample.y}px, 0) translate(-50%, -50%) scale(${slot.sample.scale * amountScale})`;
    }
  }

  function dispose(): void {
    layer.remove();
  }

  return { diagnostics, enqueue, sync, dispose };
}

function measureDestinations(
  destinations: CollectionMoteDestinations,
  rootBounds: DOMRect,
): Record<CollectionResource, ScreenPoint> {
  return {
    grass: elementCenter(destinations.grass, rootBounds),
    flowers: elementCenter(destinations.flowers, rootBounds),
    fiber: elementCenter(destinations.fiber, rootBounds),
    wood: elementCenter(destinations.wood, rootBounds),
  };
}

function elementCenter(element: HTMLElement, rootBounds: DOMRect): ScreenPoint {
  const bounds = element.getBoundingClientRect();
  return {
    x: bounds.left - rootBounds.left + bounds.width * 0.5,
    y: bounds.top - rootBounds.top + bounds.height * 0.5,
  };
}

function collectionMoteOriginHeight(kind: CutCompletionEvent["kind"]): number {
  switch (kind) {
    case "grass":
      return 0.28;
    case "flower":
      return 0.72;
    case "denseWeed":
      return 0.8;
    case "fiberReed":
      return 0.92;
    case "shrub":
      return 1.05;
    case "sapling":
      return 1.2;
    case "matureTree":
      return 1.8;
  }
}

function resourceGlyph(resource: CollectionResource): string {
  switch (resource) {
    case "grass":
      return "⌃";
    case "flowers":
      return "✿";
    case "fiber":
      return "≋";
    case "wood":
      return "▰";
  }
}

function deterministicUnit(seed: number, revision: number): number {
  let value = (seed ^ Math.imul(revision + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
