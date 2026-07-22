import * as THREE from "three";

import { createCollectionMotes, type CollectionMotes } from "./collectionMotes";
import { createScene, type MeadowScene } from "./createScene";
import { createFrameDiagnosticsTracker, type FrameDiagnosticsTracker } from "./frameDiagnostics";
import { resolveQualitySettings, type QualitySettings } from "./quality";
import {
  CUMULATIVE_XP_THRESHOLDS,
  FIXED_TIME_STEP_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  createInitialState,
  setPaused,
  stepState,
  type GameState,
  type MovementInput,
} from "./state";
import { createTargetProgressOverlay, type TargetProgressOverlay } from "./targetProgress";

const MILLISECONDS_PER_SECOND = 1000;

interface HudElements {
  root: HTMLElement;
  time: HTMLElement;
  level: HTMLElement;
  rpm: HTMLElement;
  grass: HTMLElement;
  grassTarget: HTMLElement;
  flowers: HTMLElement;
  flowersTarget: HTMLElement;
  fiber: HTMLElement;
  fiberTarget: HTMLElement;
  wood: HTMLElement;
  woodTarget: HTMLElement;
  grassRow: HTMLElement;
  flowerRow: HTMLElement;
  fiberRow: HTMLElement;
  woodRow: HTMLElement;
  xpFill: HTMLElement;
  levelToast: HTMLElement;
  levelToastNumber: HTMLElement;
}

interface ResultsElements {
  overlay: HTMLDivElement;
  elapsed: HTMLElement;
  cutTargets: HTMLElement;
  highestLevel: HTMLElement;
  restartButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
}

interface PauseElements {
  overlay: HTMLDivElement;
  resumeButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly meadow: MeadowScene;
  private readonly state: GameState;
  private readonly hud: HudElements;
  private readonly results: ResultsElements;
  private readonly pause: PauseElements;
  private readonly collectionMotes: CollectionMotes;
  private readonly targetProgress: TargetProgressOverlay;
  private readonly frameDiagnostics: FrameDiagnosticsTracker = createFrameDiagnosticsTracker();
  private readonly quality: QualitySettings;
  private readonly input: MovementInput = createMovementInput();
  private readonly keyboardInput: MovementInput = createMovementInput();
  private readonly pointerInput: MovementInput = createMovementInput();
  private activePointerId: number | null = null;
  private pointerAnchorX = 0;
  private pointerAnchorY = 0;
  private readonly pointerDeadZonePixels = 14;

  private simulationTimeSeconds = 0;
  private accumulatorSeconds = 0;
  private lastFrameTimeMs: number | null = null;
  private processedHudCutEvents = 0;
  private manualTime = false;
  private started = false;

  public constructor(canvas: HTMLCanvasElement, seed?: number) {
    this.canvas = canvas;
    this.state = createInitialState(seed);
    this.quality = resolveQualitySettings(
      new URLSearchParams(window.location.search).get("quality"),
    );
    this.hud = getHudElements();
    this.results = createResultsElements(requireAppRoot(canvas));
    this.pause = createPauseElements(requireAppRoot(canvas));
    this.meadow = createScene(this.state.seed, this.quality);
    this.collectionMotes = createCollectionMotes(
      requireAppRoot(canvas),
      {
        grass: this.hud.grass,
        flowers: this.hud.flowers,
        fiber: this.hud.fiber,
        wood: this.hud.wood,
      },
      this.state.seed,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    this.targetProgress = createTargetProgressOverlay(requireAppRoot(canvas));
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    window.render_game_to_text = this.renderGameToText;
    window.advanceTime = this.advanceTime;
    window.restartContract = this.restartContract;
    window.nextContract = this.nextContract;
    if (new URLSearchParams(window.location.search).get("debug") === "1") {
      window.completeContractForDebug = this.completeContractForDebug;
      window.cutTargetForDebug = this.cutTargetForDebug;
    }
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.resetInput);
    window.addEventListener("resize", this.resize);
    document.addEventListener("fullscreenchange", this.resize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerEnd);
    this.canvas.addEventListener("pointercancel", this.onPointerEnd);
    this.canvas.addEventListener("lostpointercapture", this.onPointerEnd);
    this.results.restartButton.addEventListener("click", this.restartContract);
    this.results.nextButton.addEventListener("click", this.nextContract);
    this.pause.resumeButton.addEventListener("click", this.resumeContract);
    this.pause.restartButton.addEventListener("click", this.restartContract);

    this.resize();
    this.render();
    this.canvas.focus({ preventScroll: true });
    this.renderer.setAnimationLoop(this.onAnimationFrame);
    window.__grassBladeReady = true;
  }

  public dispose(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.resetInput);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("fullscreenchange", this.resize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerEnd);
    this.canvas.removeEventListener("pointercancel", this.onPointerEnd);
    this.canvas.removeEventListener("lostpointercapture", this.onPointerEnd);
    this.results.restartButton.removeEventListener("click", this.restartContract);
    this.results.nextButton.removeEventListener("click", this.nextContract);
    this.pause.resumeButton.removeEventListener("click", this.resumeContract);
    this.pause.restartButton.removeEventListener("click", this.restartContract);
    this.results.overlay.remove();
    this.pause.overlay.remove();
    delete window.completeContractForDebug;
    delete window.cutTargetForDebug;
    this.collectionMotes.dispose();
    this.targetProgress.dispose();
    this.meadow.dispose();
    this.renderer.dispose();
    window.__grassBladeReady = false;
  }

  private readonly onAnimationFrame = (timeMs: number): void => {
    if (this.manualTime) {
      this.render();
      return;
    }

    if (this.lastFrameTimeMs === null) {
      this.lastFrameTimeMs = timeMs;
      this.render();
      return;
    }

    const deltaSeconds = Math.min(
      Math.max((timeMs - this.lastFrameTimeMs) / MILLISECONDS_PER_SECOND, 0),
      MAX_FRAME_DELTA_SECONDS,
    );
    this.lastFrameTimeMs = timeMs;
    this.frameDiagnostics.recordFrameDelta(deltaSeconds);
    this.step(deltaSeconds);
    this.render();
  };

  private readonly advanceTime = (milliseconds: number): void => {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      return;
    }

    if (!this.manualTime) {
      this.accumulatorSeconds = 0;
    }
    this.manualTime = true;
    this.lastFrameTimeMs = null;
    this.step(milliseconds / MILLISECONDS_PER_SECOND);
    this.render();
  };

  private step(deltaSeconds: number): void {
    this.accumulatorSeconds += deltaSeconds;

    while (this.accumulatorSeconds + Number.EPSILON >= FIXED_TIME_STEP_SECONDS) {
      stepState(this.state, this.currentMovementInput(), FIXED_TIME_STEP_SECONDS);
      this.simulationTimeSeconds += FIXED_TIME_STEP_SECONDS;
      this.meadow.sync(this.state, this.simulationTimeSeconds);
      this.collectionMotes.enqueue(this.state.cutEvents, this.simulationTimeSeconds);
      this.accumulatorSeconds -= FIXED_TIME_STEP_SECONDS;
    }
  }

  private currentMovementInput(): MovementInput {
    this.input.left = this.keyboardInput.left || this.pointerInput.left;
    this.input.right = this.keyboardInput.right || this.pointerInput.right;
    this.input.forward = this.keyboardInput.forward || this.pointerInput.forward;
    this.input.backward = this.keyboardInput.backward || this.pointerInput.backward;
    return this.input;
  }

  private render(): void {
    this.updateHud();
    this.meadow.sync(this.state, this.simulationTimeSeconds);
    this.renderer.render(this.meadow.scene, this.meadow.camera);
    this.targetProgress.sync(
      this.state.targets,
      this.state.tooToughNotice,
      this.meadow.camera,
      this.canvas,
    );
    this.collectionMotes.sync(this.simulationTimeSeconds, this.meadow.camera, this.canvas);
  }

  private updateHud(): void {
    const { player, objectives, xp } = this.state;
    const rpmProgress = clamp(player.rpm / player.targetRpm, 0, 1);
    const previousThreshold =
      player.level <= 1 ? 0 : (CUMULATIVE_XP_THRESHOLDS[player.level - 2] ?? 0);
    const nextThreshold = CUMULATIVE_XP_THRESHOLDS[player.level - 1];
    const xpProgress =
      nextThreshold === undefined
        ? 1
        : clamp((xp - previousThreshold) / (nextThreshold - previousThreshold), 0, 1);

    setText(this.hud.time, formatElapsedTime(this.state.elapsedSeconds));
    setText(this.hud.level, `LV ${player.level}`);
    setText(this.hud.rpm, `${Math.round(player.rpm)} RPM`);
    setText(this.hud.grass, String(objectives.grass.collected));
    setText(this.hud.grassTarget, String(objectives.grass.target));
    setText(this.hud.flowers, String(objectives.flowers.collected));
    setText(this.hud.flowersTarget, String(objectives.flowers.target));
    setText(this.hud.fiber, String(objectives.fiber.collected));
    setText(this.hud.fiberTarget, String(objectives.fiber.target));
    setText(this.hud.wood, String(objectives.wood.collected));
    setText(this.hud.woodTarget, String(objectives.wood.target));
    this.hud.root.style.setProperty("--rpm-progress", `${Math.round(rpmProgress * 100)}%`);
    this.hud.xpFill.style.width = `${xpProgress * 100}%`;
    this.updateHudFeedback();
    this.updatePause();
    this.updateResults();
  }

  private updatePause(): void {
    this.pause.overlay.hidden = this.state.mode !== "paused";
  }

  private updateResults(): void {
    const result = this.state.result;
    if (this.state.mode !== "complete" || result === null) {
      this.results.overlay.hidden = true;
      return;
    }

    this.results.overlay.hidden = false;
    setText(this.results.elapsed, formatElapsedTime(result.completedAtSeconds));
    setText(this.results.cutTargets, String(result.cutTargets));
    setText(this.results.highestLevel, `LV ${result.highestLevel}`);
  }

  private updateHudFeedback(): void {
    let grassAwarded = false;
    let flowerAwarded = false;
    let fiberAwarded = false;
    let woodAwarded = false;
    let consolidatedLevel = 0;

    while (this.processedHudCutEvents < this.state.cutEvents.length) {
      const event = this.state.cutEvents[this.processedHudCutEvents];
      this.processedHudCutEvents += 1;
      if (event === undefined) {
        continue;
      }

      switch (event.kind) {
        case "grass":
          grassAwarded = true;
          break;
        case "flower":
          flowerAwarded = true;
          break;
        case "denseWeed":
        case "shrub":
          fiberAwarded = true;
          break;
        case "sapling":
        case "matureTree":
          woodAwarded = true;
          break;
      }
      if (event.levelAfter > event.levelBefore) {
        consolidatedLevel = Math.max(consolidatedLevel, event.levelAfter);
      }
    }

    if (grassAwarded) {
      restartCssAnimation(this.hud.grassRow, "objective-row--awarded");
    }
    if (flowerAwarded) {
      restartCssAnimation(this.hud.flowerRow, "objective-row--awarded");
    }
    if (fiberAwarded) {
      restartCssAnimation(this.hud.fiberRow, "objective-row--awarded");
    }
    if (woodAwarded) {
      restartCssAnimation(this.hud.woodRow, "objective-row--awarded");
    }
    if (consolidatedLevel > 0) {
      setText(this.hud.levelToastNumber, String(consolidatedLevel));
      restartCssAnimation(this.hud.levelToast, "level-toast--active");
    }
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.meadow.resize(width / height);
    this.render();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.setMovementKey(event.code, true)) {
      event.preventDefault();
      return;
    }

    if (event.code === "KeyF" && !event.repeat) {
      event.preventDefault();
      void this.toggleFullscreen();
      return;
    }

    if (
      (this.state.mode === "paused" || this.state.mode === "complete") &&
      event.code === "KeyR" &&
      !event.repeat
    ) {
      event.preventDefault();
      this.restartContract();
      return;
    }

    if (this.state.mode === "complete" && event.code === "KeyN" && !event.repeat) {
      event.preventDefault();
      this.nextContract();
      return;
    }

    if (event.code === "Escape" && document.fullscreenElement !== null && !event.repeat) {
      event.preventDefault();
      void document.exitFullscreen();
      return;
    }

    if (event.code === "Escape" && this.state.mode !== "complete" && !event.repeat) {
      event.preventDefault();
      this.togglePause();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.setMovementKey(event.code, false)) {
      event.preventDefault();
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (this.activePointerId !== null || this.state.mode !== "active") {
      return;
    }

    this.activePointerId = event.pointerId;
    this.pointerAnchorX = event.clientX;
    this.pointerAnchorY = event.clientY;
    clearMovementInput(this.pointerInput);
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.focus({ preventScroll: true });
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.updatePointerInput(event.clientX, event.clientY);
    event.preventDefault();
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    clearMovementInput(this.pointerInput);
    event.preventDefault();
  };

  private updatePointerInput(clientX: number, clientY: number): void {
    const deltaX = clientX - this.pointerAnchorX;
    const deltaY = clientY - this.pointerAnchorY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < this.pointerDeadZonePixels) {
      clearMovementInput(this.pointerInput);
      return;
    }

    this.pointerInput.left = deltaX < -this.pointerDeadZonePixels;
    this.pointerInput.right = deltaX > this.pointerDeadZonePixels;
    this.pointerInput.forward = deltaY < -this.pointerDeadZonePixels;
    this.pointerInput.backward = deltaY > this.pointerDeadZonePixels;
  }

  private setMovementKey(code: string, pressed: boolean): boolean {
    let handled = true;
    switch (code) {
      case "KeyA":
      case "ArrowLeft":
        if (this.state.mode === "active") {
          this.keyboardInput.left = pressed;
        }
        break;
      case "KeyD":
      case "ArrowRight":
        if (this.state.mode === "active") {
          this.keyboardInput.right = pressed;
        }
        break;
      case "KeyW":
      case "ArrowUp":
        if (this.state.mode === "active") {
          this.keyboardInput.forward = pressed;
        }
        break;
      case "KeyS":
      case "ArrowDown":
        if (this.state.mode === "active") {
          this.keyboardInput.backward = pressed;
        }
        break;
      default:
        handled = false;
    }
    return handled;
  }

  private readonly resetInput = (): void => {
    this.activePointerId = null;
    clearMovementInput(this.input);
    clearMovementInput(this.keyboardInput);
    clearMovementInput(this.pointerInput);
  };

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement !== null) {
      await document.exitFullscreen();
      return;
    }

    const parent = this.canvas.closest("#app");
    const target = parent instanceof HTMLElement ? parent : this.canvas;
    await target.requestFullscreen();
  }

  private readonly restartContract = (): void => {
    window.location.assign(`?seed=${this.state.seed}`);
  };

  private readonly nextContract = (): void => {
    const nextSeed = (this.state.seed + 0x9e3779b9) >>> 0;
    window.location.assign(`?seed=${nextSeed}`);
  };

  private readonly resumeContract = (): void => {
    if (this.state.mode !== "paused") {
      return;
    }

    setPaused(this.state, false);
    this.resetInput();
    this.render();
    this.canvas.focus({ preventScroll: true });
  };

  private togglePause(): void {
    if (this.state.mode === "complete") {
      return;
    }

    setPaused(this.state, this.state.mode === "active");
    this.resetInput();
    this.render();
  }

  private readonly completeContractForDebug = (): void => {
    if (this.state.mode === "complete") {
      return;
    }

    const finalTarget = this.state.targets.find(
      (target) => target.kind === "grass" && target.status !== "cut",
    );
    if (finalTarget === undefined) {
      return;
    }

    this.state.inventory = { grass: 49, flowers: 10, fiber: 6, wood: 6 };
    this.state.objectives.grass.collected = 49;
    this.state.objectives.flowers.collected = 10;
    this.state.objectives.fiber.collected = 6;
    this.state.objectives.wood.collected = 6;
    finalTarget.x = this.state.player.x;
    finalTarget.z = this.state.player.z;
    finalTarget.status = "cutting";
    finalTarget.accumulatedWork = finalTarget.requiredWork - 0.001;
    this.resetInput();
    this.step(FIXED_TIME_STEP_SECONDS);
    this.render();
  };

  private readonly cutTargetForDebug = (kind: string): void => {
    if (this.state.mode === "complete") {
      return;
    }

    const target = this.state.targets.find(
      (candidate) => candidate.kind === kind && candidate.status !== "cut",
    );
    if (target === undefined || target.requiredWork <= 0) {
      return;
    }

    this.state.player.x = target.x;
    this.state.player.z = target.z;
    this.state.player.vx = 0;
    this.state.player.vz = 0;
    target.status = "cutting";
    target.accumulatedWork = Math.max(0, target.requiredWork - 0.001);
    this.resetInput();
    this.step(FIXED_TIME_STEP_SECONDS);
    this.render();
  };

  private readonly renderGameToText = (): string => {
    const { player, objectives } = this.state;
    const targetCounts = { standing: 0, cutting: 0, cut: 0 };
    const activeTargets: Array<{
      id: string;
      kind: string;
      status: string;
      work: number;
      requiredWork: number;
      inBladeContact: boolean;
    }> = [];
    const solidTargets: Array<{
      id: string;
      kind: string;
      position: { x: number; z: number };
      solidRadius: number;
      status: string;
      work: number;
      requiredWork: number;
      inBladeContact: boolean;
    }> = [];

    for (const target of this.state.targets) {
      targetCounts[target.status] += 1;
      const inBladeContact = this.state.bladeContactTargetIds.includes(target.id);
      if (target.status === "cutting" && activeTargets.length < 12) {
        activeTargets.push({
          id: target.id,
          kind: target.kind,
          status: target.status,
          work: round(target.accumulatedWork),
          requiredWork: target.requiredWork,
          inBladeContact,
        });
      }
      if (target.solidRadius > 0 && target.status !== "cut") {
        solidTargets.push({
          id: target.id,
          kind: target.kind,
          position: { x: target.x, z: target.z },
          solidRadius: target.solidRadius,
          status: target.status,
          work: round(target.accumulatedWork),
          requiredWork: target.requiredWork,
          inBladeContact,
        });
      }
    }

    return JSON.stringify({
      coordinateSystem:
        "Ground plane is XZ with origin at meadow center and +Y up; movement is screen-relative under the fixed isometric camera.",
      mode: this.state.mode,
      seed: this.state.seed,
      elapsedSeconds: round(this.state.elapsedSeconds),
      result: this.state.result,
      meadow: this.meadow.density,
      presentation: {
        ...this.meadow.presentation,
        collectionMotes: this.collectionMotes.diagnostics,
        targetProgress: this.targetProgress.diagnostics,
      },
      performance: this.frameDiagnostics.snapshot({
        accumulatorSeconds: this.accumulatorSeconds,
        pixelRatio: this.renderer.getPixelRatio(),
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
        qualityPreset: this.quality.preset,
        maxPixelRatio: this.quality.maxPixelRatio,
        grassBladesPerVisual: this.quality.grassBladesPerVisual,
      }),
      player: {
        position: { x: round(player.x), z: round(player.z) },
        velocity: { x: round(player.vx), z: round(player.vz) },
        radius: player.radius,
        rpm: round(player.rpm),
        targetRpm: player.targetRpm,
        bladeAngleRadians: round(player.bladeAngleRadians),
        level: player.level,
      },
      controls: {
        movement: "Drag on the canvas, or use WASD / arrow keys",
        fullscreen: "F toggles; Escape exits fullscreen before pausing",
        pause: this.state.mode === "complete" ? null : "Escape toggles pause",
        restart:
          this.state.mode === "paused" || this.state.mode === "complete"
            ? "R restarts the current seed"
            : null,
        nextContract: this.state.mode === "complete" ? "N opens the next deterministic seed" : null,
        input: {
          keyboard: { ...this.keyboardInput },
          pointer: { ...this.pointerInput },
          active: { ...this.currentMovementInput() },
        },
      },
      inventory: this.state.inventory,
      xp: this.state.xp,
      objectives,
      targets: {
        total: this.state.targets.length,
        ...targetCounts,
        active: activeTargets,
        bladeContacts: this.state.bladeContactTargetIds,
        tooToughNotice: this.state.tooToughNotice,
        solids: solidTargets,
        visuallyCutGrassTufts: this.state.cutGrassVisualIndices.length,
        cutRevision: this.state.cutRevision,
        recentCutEvents: this.state.cutEvents.slice(-8),
      },
    });
  };
}

function requireAppRoot(canvas: HTMLCanvasElement): HTMLElement {
  const root = canvas.closest("#app");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Grass Blade requires an #app HTMLElement around the game canvas.");
  }
  return root;
}

function getHudElements(): HudElements {
  return {
    root: requireElement("game-hud"),
    time: requireElement("hud-time"),
    level: requireElement("hud-level"),
    rpm: requireElement("hud-rpm"),
    grass: requireElement("hud-grass"),
    grassTarget: requireElement("hud-grass-target"),
    flowers: requireElement("hud-flowers"),
    flowersTarget: requireElement("hud-flowers-target"),
    fiber: requireElement("hud-fiber"),
    fiberTarget: requireElement("hud-fiber-target"),
    wood: requireElement("hud-wood"),
    woodTarget: requireElement("hud-wood-target"),
    grassRow: requireElement("hud-row-grass"),
    flowerRow: requireElement("hud-row-flower"),
    fiberRow: requireElement("hud-row-fiber"),
    woodRow: requireElement("hud-row-wood"),
    xpFill: requireElement("hud-xp-fill"),
    levelToast: requireElement("level-toast"),
    levelToastNumber: requireElement("level-toast-number"),
  };
}

function createResultsElements(root: HTMLElement): ResultsElements {
  const overlay = document.createElement("div");
  const card = document.createElement("section");
  const eyebrow = document.createElement("p");
  const title = document.createElement("h2");
  const summary = document.createElement("p");
  const stats = document.createElement("dl");
  const elapsedLabel = document.createElement("dt");
  const elapsed = document.createElement("dd");
  const cutTargetsLabel = document.createElement("dt");
  const cutTargets = document.createElement("dd");
  const highestLevelLabel = document.createElement("dt");
  const highestLevel = document.createElement("dd");
  const actions = document.createElement("div");
  const restartButton = document.createElement("button");
  const nextButton = document.createElement("button");

  overlay.className = "results-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-atomic", "true");
  card.className = "results-card";
  card.setAttribute("aria-label", "Meadow Delivery results");
  eyebrow.className = "results-card__eyebrow";
  eyebrow.textContent = "Contract complete";
  title.textContent = "Meadow Delivery";
  summary.className = "results-card__summary";
  summary.textContent = "Every quota is packed. Take another pass through the meadow when ready.";
  stats.className = "results-card__stats";
  elapsedLabel.textContent = "Time";
  cutTargetsLabel.textContent = "Targets cut";
  highestLevelLabel.textContent = "Highest level";
  actions.className = "results-card__actions";
  restartButton.type = "button";
  restartButton.className = "results-card__button";
  restartButton.textContent = "Restart";
  nextButton.type = "button";
  nextButton.className = "results-card__button results-card__button--primary";
  nextButton.textContent = "Next Contract";

  stats.append(elapsedLabel, elapsed, cutTargetsLabel, cutTargets, highestLevelLabel, highestLevel);
  actions.append(restartButton, nextButton);
  card.append(eyebrow, title, summary, stats, actions);
  overlay.append(card);
  root.append(overlay);

  return {
    overlay,
    elapsed,
    cutTargets,
    highestLevel,
    restartButton,
    nextButton,
  };
}

function createPauseElements(root: HTMLElement): PauseElements {
  const overlay = document.createElement("div");
  const card = document.createElement("section");
  const eyebrow = document.createElement("p");
  const title = document.createElement("h2");
  const summary = document.createElement("p");
  const actions = document.createElement("div");
  const resumeButton = document.createElement("button");
  const restartButton = document.createElement("button");

  overlay.className = "pause-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-atomic", "true");
  card.className = "pause-card";
  card.setAttribute("aria-label", "Paused contract");
  eyebrow.className = "pause-card__eyebrow";
  eyebrow.textContent = "Contract paused";
  title.textContent = "Take a breather";
  summary.className = "pause-card__summary";
  summary.textContent = "Resume cutting when ready, or restart this seeded meadow.";
  actions.className = "pause-card__actions";
  resumeButton.type = "button";
  resumeButton.className = "pause-card__button pause-card__button--primary";
  resumeButton.textContent = "Resume";
  restartButton.type = "button";
  restartButton.className = "pause-card__button";
  restartButton.textContent = "Restart";

  actions.append(resumeButton, restartButton);
  card.append(eyebrow, title, summary, actions);
  overlay.append(card);
  root.append(overlay);

  return { overlay, resumeButton, restartButton };
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing required HUD element #${id}`);
  }
  return element;
}

function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function restartCssAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function formatElapsedTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function createMovementInput(): MovementInput {
  return {
    left: false,
    right: false,
    forward: false,
    backward: false,
  };
}

function clearMovementInput(input: MovementInput): void {
  input.left = false;
  input.right = false;
  input.forward = false;
  input.backward = false;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
