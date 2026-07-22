import * as THREE from "three";

import type { TargetState, TooToughNotice } from "./state";
import type { TargetKind } from "./world";

export const MAX_TARGET_PROGRESS_BARS = 16;

const DURABLE_TARGET_KINDS = new Set<TargetKind>(["denseWeed", "shrub", "sapling", "matureTree"]);

export interface TargetProgressDiagnostics {
  activeBars: number;
  tooToughVisible: boolean;
}

export interface TargetProgressEntry {
  id: string;
  kind: TargetKind;
  x: number;
  y: number;
  z: number;
  progress: number;
}

export interface TargetProgressOverlay {
  diagnostics: TargetProgressDiagnostics;
  sync: (
    targets: readonly TargetState[],
    tooToughNotice: TooToughNotice | null,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
  ) => void;
  dispose: () => void;
}

interface TargetProgressSlot {
  element: HTMLDivElement;
  fill: HTMLSpanElement;
}

export function shouldShowTargetProgress(target: TargetState): boolean {
  return (
    target.status !== "cut" &&
    target.accumulatedWork > 0 &&
    target.requiredWork > 0 &&
    DURABLE_TARGET_KINDS.has(target.kind)
  );
}

export function targetProgressFraction(target: TargetState): number {
  return clamp(1 - target.accumulatedWork / target.requiredWork, 0, 1);
}

export function targetProgressHeight(kind: TargetKind): number {
  switch (kind) {
    case "denseWeed":
      return 2.45;
    case "shrub":
      return 2.95;
    case "sapling":
      return 3.85;
    case "matureTree":
      return 5.35;
    case "grass":
    case "flower":
      return 1.8;
  }
}

export function collectTargetProgressEntries(
  targets: readonly TargetState[],
  maxEntries = MAX_TARGET_PROGRESS_BARS,
): TargetProgressEntry[] {
  const entries: TargetProgressEntry[] = [];
  for (const target of targets) {
    if (!shouldShowTargetProgress(target)) {
      continue;
    }
    entries.push({
      id: target.id,
      kind: target.kind,
      x: target.x,
      y: targetProgressHeight(target.kind),
      z: target.z,
      progress: targetProgressFraction(target),
    });
    if (entries.length >= maxEntries) {
      break;
    }
  }
  return entries;
}

export function createTargetProgressOverlay(root: HTMLElement): TargetProgressOverlay {
  const layer = document.createElement("div");
  const worldPoint = new THREE.Vector3();
  const diagnostics: TargetProgressDiagnostics = { activeBars: 0, tooToughVisible: false };
  const slots: TargetProgressSlot[] = [];
  const tooToughElement = document.createElement("div");
  const tooToughLabel = document.createElement("span");

  layer.className = "target-progress-layer";
  layer.setAttribute("aria-hidden", "true");
  root.append(layer);

  tooToughElement.className = "too-tough-notice";
  tooToughElement.hidden = true;
  tooToughLabel.className = "too-tough-notice__label";
  tooToughElement.append(tooToughLabel);
  layer.append(tooToughElement);

  for (let index = 0; index < MAX_TARGET_PROGRESS_BARS; index += 1) {
    const element = document.createElement("div");
    const track = document.createElement("span");
    const fill = document.createElement("span");

    element.className = "target-progress";
    element.hidden = true;
    track.className = "target-progress__track";
    fill.className = "target-progress__fill";
    track.append(fill);
    element.append(track);
    layer.append(element);
    slots.push({ element, fill });
  }

  function sync(
    targets: readonly TargetState[],
    tooToughNotice: TooToughNotice | null,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
  ): void {
    const entries = collectTargetProgressEntries(targets, slots.length);
    const rootBounds = root.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    diagnostics.activeBars = 0;
    diagnostics.tooToughVisible = syncTooToughNotice(
      tooToughNotice,
      camera,
      rootBounds,
      canvasBounds,
    );

    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      if (slot === undefined) {
        continue;
      }

      const entry = entries[index];
      if (entry === undefined) {
        slot.element.hidden = true;
        continue;
      }

      worldPoint.set(entry.x, entry.y, entry.z).project(camera);
      if (
        worldPoint.z < -1 ||
        worldPoint.z > 1 ||
        worldPoint.x < -1.08 ||
        worldPoint.x > 1.08 ||
        worldPoint.y < -1.08 ||
        worldPoint.y > 1.08
      ) {
        slot.element.hidden = true;
        continue;
      }

      const screenX =
        canvasBounds.left - rootBounds.left + (worldPoint.x + 1) * 0.5 * canvasBounds.width;
      const screenY =
        canvasBounds.top - rootBounds.top + (1 - worldPoint.y) * 0.5 * canvasBounds.height;
      slot.element.hidden = false;
      slot.element.dataset.kind = entry.kind;
      slot.element.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -100%)`;
      slot.fill.style.width = `${Math.round(entry.progress * 100)}%`;
      diagnostics.activeBars += 1;
    }
  }

  function syncTooToughNotice(
    notice: TooToughNotice | null,
    camera: THREE.Camera,
    rootBounds: DOMRect,
    canvasBounds: DOMRect,
  ): boolean {
    if (notice === null) {
      tooToughElement.hidden = true;
      return false;
    }

    worldPoint.set(notice.x, targetProgressHeight(notice.kind) + 0.75, notice.z).project(camera);
    if (
      worldPoint.z < -1 ||
      worldPoint.z > 1 ||
      worldPoint.x < -1.08 ||
      worldPoint.x > 1.08 ||
      worldPoint.y < -1.08 ||
      worldPoint.y > 1.08
    ) {
      tooToughElement.hidden = true;
      return false;
    }

    const screenX =
      canvasBounds.left - rootBounds.left + (worldPoint.x + 1) * 0.5 * canvasBounds.width;
    const screenY =
      canvasBounds.top - rootBounds.top + (1 - worldPoint.y) * 0.5 * canvasBounds.height;
    tooToughElement.hidden = false;
    tooToughElement.dataset.kind = notice.kind;
    tooToughElement.dataset.revision = String(notice.revision);
    tooToughLabel.textContent = `NEED LV ${notice.recommendedLevel}`;
    tooToughElement.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -100%)`;
    return true;
  }

  function dispose(): void {
    layer.remove();
  }

  return { diagnostics, sync, dispose };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
