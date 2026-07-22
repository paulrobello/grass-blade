import * as THREE from "three";

import { GameAudio, resolveAudioSettings, type AudioDiagnostics } from "./audio";
import { createCollectionMotes, type CollectionMotes } from "./collectionMotes";
import { createScene, type MeadowScene } from "./createScene";
import {
  createFrameDiagnosticsTracker,
  type FrameDiagnosticsTracker,
  type GraphicsAdapterDiagnostics,
} from "./frameDiagnostics";
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
const OBJECTIVE_RESOURCES = ["grass", "flowers", "fiber", "wood"] as const;
type ObjectiveResource = (typeof OBJECTIVE_RESOURCES)[number];

const OBJECTIVE_LABELS: Record<ObjectiveResource, string> = {
  grass: "Grass",
  flowers: "Flowers",
  fiber: "Fiber",
  wood: "Wood",
};
interface HudElements {
  root: HTMLElement;
  contractTitle: HTMLElement;
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

interface AudioElements {
  root: HTMLElement;
  toggle: HTMLButtonElement;
  master: HTMLInputElement;
  music: HTMLInputElement;
  effects: HTMLInputElement;
  masterValue: HTMLElement;
  musicValue: HTMLElement;
  effectsValue: HTMLElement;
}

interface ResultsElements {
  overlay: HTMLDivElement;
  title: HTMLElement;
  summary: HTMLElement;
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

interface IntroElements {
  overlay: HTMLDivElement;
  startButton: HTMLButtonElement;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  contrastSource: "standard" | "query" | "forced-colors" | "prefers-contrast";
}

export interface MotionSettings {
  reducedMotion: boolean;
  motionSource: "standard" | "query" | "prefers-reduced-motion";
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly appRoot: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly meadow: MeadowScene;
  private readonly state: GameState;
  private readonly hud: HudElements;
  private readonly audioControls: AudioElements;
  private readonly intro: IntroElements;
  private readonly results: ResultsElements;
  private readonly pause: PauseElements;
  private readonly accessibilityStatus: HTMLElement;
  private readonly collectionMotes: CollectionMotes;
  private readonly targetProgress: TargetProgressOverlay;
  private readonly audio: GameAudio;
  private readonly frameDiagnostics: FrameDiagnosticsTracker = createFrameDiagnosticsTracker();
  private readonly quality: QualitySettings;
  private readonly accessibilitySettings: AccessibilitySettings;
  private readonly motionSettings: MotionSettings;
  private readonly graphicsAdapter: GraphicsAdapterDiagnostics;
  private readonly layoutResizeObserver: ResizeObserver | null =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => this.resize());
  private readonly input: MovementInput = createMovementInput();
  private readonly keyboardInput: MovementInput = createMovementInput();
  private readonly pointerInput: MovementInput = createMovementInput();
  private activePointerId: number | null = null;
  private pointerAnchorX = 0;
  private pointerAnchorY = 0;
  private readonly pointerDeadZonePixels = 14;
  private canvasCssWidth = 1;
  private canvasCssHeight = 1;
  private displayAspectRatio = 1;

  private simulationTimeSeconds = 0;
  private accumulatorSeconds = 0;
  private lastFrameTimeMs: number | null = null;
  private processedHudCutEvents = 0;
  private processedAudioCutEvents = 0;
  private lastAnnouncedMode: GameState["mode"] = "active";
  private lastAudioMode: GameState["mode"] = "active";
  private lastAnnouncedLevel = 1;
  private lastAccessibilityAnnouncement = "";
  private readonly announcedObjectiveCompletions: Record<ObjectiveResource, boolean> = {
    grass: false,
    flowers: false,
    fiber: false,
    wood: false,
  };
  private manualTime = false;
  private started = false;
  private contractStarted = false;
  private pauseFocusPlaced = false;
  private resultsFocusPlaced = false;

  public constructor(canvas: HTMLCanvasElement, seed?: number, contractId: string | null = null) {
    this.canvas = canvas;
    this.appRoot = requireAppRoot(canvas);
    this.state = createInitialState(seed, contractId);
    const searchParams = new URLSearchParams(window.location.search);
    this.quality = resolveQualitySettings(searchParams.get("quality"));
    this.accessibilitySettings = resolveAccessibilitySettings({
      contrastQuery: searchParams.get("contrast"),
      forcedColorsActive: window.matchMedia("(forced-colors: active)").matches,
      prefersContrastMore: window.matchMedia("(prefers-contrast: more)").matches,
    });
    this.appRoot.dataset.contrast = this.accessibilitySettings.highContrast ? "high" : "standard";
    this.appRoot.dataset.contrastSource = this.accessibilitySettings.contrastSource;
    this.motionSettings = resolveMotionSettings({
      motionQuery: searchParams.get("motion"),
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    this.appRoot.dataset.motion = this.motionSettings.reducedMotion ? "reduced" : "standard";
    this.appRoot.dataset.motionSource = this.motionSettings.motionSource;
    this.hud = getHudElements();
    this.audio = new GameAudio(resolveAudioSettings(searchParams));
    this.audioControls = createAudioElements(this.appRoot);
    this.accessibilityStatus = requireElement("accessibility-status");
    this.intro = createIntroElements(this.appRoot);
    this.results = createResultsElements(this.appRoot);
    this.pause = createPauseElements(this.appRoot);
    this.meadow = createScene(this.state.seed, this.quality, this.motionSettings.reducedMotion);
    this.collectionMotes = createCollectionMotes(
      this.appRoot,
      {
        grass: this.hud.grass,
        flowers: this.hud.flowers,
        fiber: this.hud.fiber,
        wood: this.hud.wood,
      },
      this.state.seed,
      this.motionSettings.reducedMotion,
    );
    this.targetProgress = createTargetProgressOverlay(this.appRoot);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.antialias,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = this.quality.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.graphicsAdapter = detectGraphicsAdapter(this.renderer);

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
    window.visualViewport?.addEventListener("resize", this.resize);
    window.visualViewport?.addEventListener("scroll", this.resize);
    document.addEventListener("fullscreenchange", this.resize);
    this.layoutResizeObserver?.observe(this.canvas);
    this.layoutResizeObserver?.observe(this.appRoot);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerEnd);
    this.canvas.addEventListener("pointercancel", this.onPointerEnd);
    this.canvas.addEventListener("lostpointercapture", this.onPointerEnd);
    this.results.restartButton.addEventListener("click", this.restartContract);
    this.results.nextButton.addEventListener("click", this.nextContract);
    this.intro.startButton.addEventListener("click", this.beginContract);
    this.pause.resumeButton.addEventListener("click", this.resumeContract);
    this.pause.restartButton.addEventListener("click", this.restartContract);
    this.audioControls.toggle.addEventListener("click", this.toggleMuted);
    this.audioControls.master.addEventListener("input", this.onMasterVolumeInput);
    this.audioControls.music.addEventListener("input", this.onMusicVolumeInput);
    this.audioControls.effects.addEventListener("input", this.onEffectsVolumeInput);

    this.resize();
    this.render();
    this.intro.startButton.focus({ preventScroll: true });
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
    window.visualViewport?.removeEventListener("resize", this.resize);
    window.visualViewport?.removeEventListener("scroll", this.resize);
    document.removeEventListener("fullscreenchange", this.resize);
    this.layoutResizeObserver?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerEnd);
    this.canvas.removeEventListener("pointercancel", this.onPointerEnd);
    this.canvas.removeEventListener("lostpointercapture", this.onPointerEnd);
    this.results.restartButton.removeEventListener("click", this.restartContract);
    this.results.nextButton.removeEventListener("click", this.nextContract);
    this.intro.startButton.removeEventListener("click", this.beginContract);
    this.pause.resumeButton.removeEventListener("click", this.resumeContract);
    this.pause.restartButton.removeEventListener("click", this.restartContract);
    this.audioControls.toggle.removeEventListener("click", this.toggleMuted);
    this.audioControls.master.removeEventListener("input", this.onMasterVolumeInput);
    this.audioControls.music.removeEventListener("input", this.onMusicVolumeInput);
    this.audioControls.effects.removeEventListener("input", this.onEffectsVolumeInput);
    this.audioControls.root.remove();
    this.intro.overlay.remove();
    this.results.overlay.remove();
    this.pause.overlay.remove();
    delete window.completeContractForDebug;
    delete window.cutTargetForDebug;
    this.collectionMotes.dispose();
    this.audio.dispose();
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

    if (!this.contractStarted) {
      this.lastFrameTimeMs = timeMs;
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
    if (!this.contractStarted) {
      this.render();
      return;
    }
    this.step(milliseconds / MILLISECONDS_PER_SECOND);
    this.render();
  };

  private step(deltaSeconds: number): void {
    if (!this.contractStarted) {
      return;
    }

    this.accumulatorSeconds += deltaSeconds;

    while (this.accumulatorSeconds + Number.EPSILON >= FIXED_TIME_STEP_SECONDS) {
      stepState(this.state, this.currentMovementInput(), FIXED_TIME_STEP_SECONDS);
      this.simulationTimeSeconds += FIXED_TIME_STEP_SECONDS;
      this.meadow.sync(this.state, this.simulationTimeSeconds);
      this.collectionMotes.enqueue(this.state.cutEvents, this.simulationTimeSeconds);
      this.updateAudioFeedback();
      this.accumulatorSeconds -= FIXED_TIME_STEP_SECONDS;
    }
  }

  private currentMovementInput(): MovementInput {
    if (!this.contractStarted || this.state.mode !== "active") {
      clearMovementInput(this.input);
      return this.input;
    }

    this.input.left = this.keyboardInput.left || this.pointerInput.left;
    this.input.right = this.keyboardInput.right || this.pointerInput.right;
    this.input.forward = this.keyboardInput.forward || this.pointerInput.forward;
    this.input.backward = this.keyboardInput.backward || this.pointerInput.backward;
    return this.input;
  }

  private render(): void {
    this.updateHud();
    this.syncAudio();
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

    setText(this.hud.contractTitle, this.state.contract.title.toUpperCase());
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
    this.updateIntro();
    this.updatePause();
    this.updateResults();
    this.updateAccessibilityAnnouncements();
    this.updateAudioControls();
  }

  private syncAudio(): void {
    this.audio.sync({
      mode: this.contractStarted ? this.state.mode : "ready",
      player: this.state.player,
      contactCount: this.state.bladeContactTargetIds.length,
    });
  }

  private updateIntro(): void {
    this.intro.overlay.hidden = this.contractStarted;
  }

  private updatePause(): void {
    const isPaused = this.state.mode === "paused";
    this.pause.overlay.hidden = !isPaused;
    if (!isPaused) {
      this.pauseFocusPlaced = false;
      return;
    }

    if (!this.pauseFocusPlaced) {
      this.pauseFocusPlaced = true;
      this.pause.resumeButton.focus({ preventScroll: true });
    }
  }

  private updateResults(): void {
    const result = this.state.result;
    if (this.state.mode !== "complete" || result === null) {
      this.results.overlay.hidden = true;
      this.resultsFocusPlaced = false;
      return;
    }

    this.results.overlay.hidden = false;
    setText(this.results.title, this.state.contract.title);
    setText(this.results.summary, this.state.contract.summary);
    setText(this.results.elapsed, formatElapsedTime(result.completedAtSeconds));
    setText(this.results.cutTargets, String(result.cutTargets));
    setText(this.results.highestLevel, `LV ${result.highestLevel}`);
    if (!this.resultsFocusPlaced) {
      this.resultsFocusPlaced = true;
      this.results.nextButton.focus({ preventScroll: true });
    }
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

  private updateAudioFeedback(): void {
    while (this.processedAudioCutEvents < this.state.cutEvents.length) {
      const event = this.state.cutEvents[this.processedAudioCutEvents];
      this.processedAudioCutEvents += 1;
      if (event === undefined) {
        continue;
      }

      this.audio.playCut(event);
      if (event.levelAfter > event.levelBefore) {
        this.audio.playLevelUp(event.levelAfter);
      }
    }

    if (this.state.mode !== this.lastAudioMode) {
      this.lastAudioMode = this.state.mode;
      if (this.state.mode === "complete") {
        this.audio.playComplete();
      }
    }
  }

  private updateAudioControls(): void {
    const diagnostics = this.audio.diagnostics;
    this.audioControls.toggle.setAttribute("aria-pressed", String(!diagnostics.muted));
    this.audioControls.toggle.textContent = diagnostics.muted ? "Sound off" : "Sound on";
    this.audioControls.root.dataset.muted = String(diagnostics.muted);
    syncRangeInput(this.audioControls.master, diagnostics.masterVolume);
    syncRangeInput(this.audioControls.music, diagnostics.musicVolume);
    syncRangeInput(this.audioControls.effects, diagnostics.effectsVolume);
    setText(this.audioControls.masterValue, formatPercent(diagnostics.masterVolume));
    setText(this.audioControls.musicValue, formatPercent(diagnostics.musicVolume));
    setText(this.audioControls.effectsValue, formatPercent(diagnostics.effectsVolume));
  }

  private updateAccessibilityAnnouncements(): void {
    const { objectives, player, result } = this.state;
    const announcements: string[] = [];

    for (const resource of OBJECTIVE_RESOURCES) {
      const objective = objectives[resource];
      if (
        !this.announcedObjectiveCompletions[resource] &&
        objective.collected >= objective.target
      ) {
        this.announcedObjectiveCompletions[resource] = true;
        announcements.push(
          `${OBJECTIVE_LABELS[resource]} quota complete: ${objective.target} collected.`,
        );
      }
    }

    if (player.level > this.lastAnnouncedLevel) {
      this.lastAnnouncedLevel = player.level;
      announcements.push(`Blade level ${player.level}. Target speed ${player.targetRpm} RPM.`);
    }

    if (this.state.mode !== this.lastAnnouncedMode) {
      this.lastAnnouncedMode = this.state.mode;
      if (this.state.mode === "paused") {
        announcements.push("Contract paused. Cutting and timer are frozen.");
      } else if (this.state.mode === "active") {
        announcements.push("Contract resumed. Cutting is active.");
      } else if (this.state.mode === "complete" && result !== null) {
        announcements.push(
          `Contract complete in ${formatElapsedTime(result.completedAtSeconds)}. ` +
            `${result.cutTargets} targets cut. Highest blade level ${result.highestLevel}.`,
        );
      }
    }

    if (announcements.length > 0) {
      this.lastAccessibilityAnnouncement = announcements.join(" ");
      setText(this.accessibilityStatus, this.lastAccessibilityAnnouncement);
    }
  }

  private readonly resize = (): void => {
    syncPlayableRootSize(this.appRoot);
    const { width, height } = measureCanvasDisplaySize(this.canvas);
    this.canvasCssWidth = width;
    this.canvasCssHeight = height;
    this.displayAspectRatio = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.meadow.resize(this.displayAspectRatio);
    this.render();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "KeyM" && !event.repeat) {
      event.preventDefault();
      this.toggleMuted();
      return;
    }

    if (!this.contractStarted) {
      return;
    }

    if (event.code === "Space" && document.activeElement === this.canvas) {
      event.preventDefault();
      return;
    }

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
    if (!this.contractStarted) {
      return;
    }

    if (this.setMovementKey(event.code, false)) {
      event.preventDefault();
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (!this.contractStarted || this.activePointerId !== null || this.state.mode !== "active") {
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

  private readonly beginContract = (): void => {
    if (this.contractStarted) {
      return;
    }

    this.contractStarted = true;
    this.pauseFocusPlaced = false;
    this.resultsFocusPlaced = false;
    this.manualTime = false;
    this.accumulatorSeconds = 0;
    this.lastFrameTimeMs = null;
    this.lastAccessibilityAnnouncement =
      "Contract started. Drag to move, or use W A S D and arrow keys.";
    setText(this.accessibilityStatus, this.lastAccessibilityAnnouncement);
    void this.audio.resume();
    this.resetInput();
    this.render();
    this.canvas.focus({ preventScroll: true });
  };

  private readonly toggleMuted = (): void => {
    const muted = !this.audio.diagnostics.muted;
    this.audio.setMuted(muted);
    if (!muted) {
      void this.audio.resume();
    }
    this.updateAudioControls();
  };

  private readonly onMasterVolumeInput = (): void => {
    this.audio.setVolume("masterVolume", volumeFromInput(this.audioControls.master));
    this.updateAudioControls();
  };

  private readonly onMusicVolumeInput = (): void => {
    this.audio.setVolume("musicVolume", volumeFromInput(this.audioControls.music));
    this.updateAudioControls();
  };

  private readonly onEffectsVolumeInput = (): void => {
    this.audio.setVolume("effectsVolume", volumeFromInput(this.audioControls.effects));
    this.updateAudioControls();
  };

  private togglePause(): void {
    if (!this.contractStarted || this.state.mode === "complete") {
      return;
    }

    const wasPaused = this.state.mode === "paused";
    setPaused(this.state, this.state.mode === "active");
    this.resetInput();
    this.render();
    if (wasPaused) {
      this.canvas.focus({ preventScroll: true });
    }
  }

  private readonly completeContractForDebug = (): void => {
    if (this.state.mode === "complete") {
      return;
    }
    this.beginContract();

    const finalTarget = this.state.targets.find(
      (target) => target.kind === "grass" && target.status !== "cut",
    );
    if (finalTarget === undefined) {
      return;
    }

    const grassBeforeFinalCut = Math.max(0, this.state.objectives.grass.target - 1);
    this.state.inventory = {
      grass: grassBeforeFinalCut,
      flowers: this.state.objectives.flowers.target,
      fiber: this.state.objectives.fiber.target,
      wood: this.state.objectives.wood.target,
    };
    this.state.objectives.grass.collected = grassBeforeFinalCut;
    this.state.objectives.flowers.collected = this.state.objectives.flowers.target;
    this.state.objectives.fiber.collected = this.state.objectives.fiber.target;
    this.state.objectives.wood.collected = this.state.objectives.wood.target;
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
    this.beginContract();

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

    const playableRootBounds = this.appRoot.getBoundingClientRect();
    const activeElement = document.activeElement;
    const activeHtmlElement = activeElement instanceof HTMLElement ? activeElement : null;

    return JSON.stringify({
      coordinateSystem:
        "Ground plane is XZ with origin at meadow center and +Y up; movement is screen-relative under the fixed isometric camera.",
      mode: this.contractStarted ? this.state.mode : "ready",
      seed: this.state.seed,
      contract: this.state.contract,
      flow: {
        contractStarted: this.contractStarted,
        focusedElementId: activeHtmlElement?.id || null,
      },
      elapsedSeconds: round(this.state.elapsedSeconds),
      result: this.state.result,
      accessibility: {
        liveRegionText: this.lastAccessibilityAnnouncement,
        highContrast: this.accessibilitySettings.highContrast,
        contrastSource: this.accessibilitySettings.contrastSource,
        reducedMotion: this.motionSettings.reducedMotion,
        motionSource: this.motionSettings.motionSource,
      },
      audio: this.audio.diagnostics satisfies AudioDiagnostics,
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
        canvasCssWidth: this.canvasCssWidth,
        canvasCssHeight: this.canvasCssHeight,
        displayAspectRatio: this.displayAspectRatio,
        graphicsAdapter: this.graphicsAdapter,
        qualityPreset: this.quality.preset,
        antialias: this.quality.antialias,
        maxPixelRatio: this.quality.maxPixelRatio,
        grassBladesPerVisual: this.quality.grassBladesPerVisual,
        shadowsEnabled: this.quality.shadowsEnabled,
        shadowMapSize: this.quality.shadowMapSize,
      }),
      layout: {
        playableRootWidth: round(playableRootBounds.width),
        playableRootHeight: round(playableRootBounds.height),
        playableRootAspectRatio: round(
          deriveAspectRatio(playableRootBounds.width, playableRootBounds.height),
        ),
      },
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
        start: this.contractStarted ? null : "Activate Start Cutting before movement is captured",
        movement: this.contractStarted ? "Drag on the canvas, or use WASD / arrow keys" : null,
        fullscreen: this.contractStarted
          ? "F toggles; Escape exits fullscreen before pausing"
          : null,
        pause:
          this.contractStarted && this.state.mode !== "complete" ? "Escape toggles pause" : null,
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

export interface PlayableRootSize {
  width: number;
  height: number;
  constrained: boolean;
}

export function derivePlayableRootSize(options: {
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  screenAvailableWidth?: number;
  screenAvailableHeight?: number;
  allowConstrain: boolean;
}): PlayableRootSize {
  const viewportWidth = Math.max(1, options.viewportWidth);
  const viewportHeight = Math.max(1, options.viewportHeight);

  return {
    width: viewportWidth,
    height: viewportHeight,
    constrained: false,
  };
}

function syncPlayableRootSize(root: HTMLElement): void {
  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const rootSize = derivePlayableRootSize({
    viewportWidth,
    viewportHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    screenAvailableWidth: window.screen.availWidth,
    screenAvailableHeight: window.screen.availHeight,
    allowConstrain: true,
  });

  if (!rootSize.constrained) {
    root.style.removeProperty("width");
    root.style.removeProperty("height");
    root.style.removeProperty("margin-left");
    root.style.removeProperty("margin-right");
    return;
  }

  root.style.width = `${rootSize.width}px`;
  root.style.height = `${rootSize.height}px`;
  root.style.marginLeft = "auto";
  root.style.marginRight = "auto";
}

export function resolveAccessibilitySettings(options: {
  contrastQuery: string | null;
  forcedColorsActive: boolean;
  prefersContrastMore: boolean;
}): AccessibilitySettings {
  const normalizedQuery = options.contrastQuery?.trim().toLowerCase() ?? "";
  if (["1", "high", "more", "true"].includes(normalizedQuery)) {
    return { highContrast: true, contrastSource: "query" };
  }
  if (["0", "false", "normal", "standard"].includes(normalizedQuery)) {
    return { highContrast: false, contrastSource: "query" };
  }
  if (options.forcedColorsActive) {
    return { highContrast: true, contrastSource: "forced-colors" };
  }
  if (options.prefersContrastMore) {
    return { highContrast: true, contrastSource: "prefers-contrast" };
  }

  return { highContrast: false, contrastSource: "standard" };
}

export function resolveMotionSettings(options: {
  motionQuery: string | null;
  prefersReducedMotion: boolean;
}): MotionSettings {
  const normalizedQuery = options.motionQuery?.trim().toLowerCase() ?? "";
  if (["1", "reduced", "reduce", "true"].includes(normalizedQuery)) {
    return { reducedMotion: true, motionSource: "query" };
  }
  if (["0", "false", "normal", "standard", "off"].includes(normalizedQuery)) {
    return { reducedMotion: false, motionSource: "query" };
  }
  if (options.prefersReducedMotion) {
    return { reducedMotion: true, motionSource: "prefers-reduced-motion" };
  }

  return { reducedMotion: false, motionSource: "standard" };
}

function deriveAspectRatio(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }

  return width / height;
}

function getHudElements(): HudElements {
  return {
    root: requireElement("game-hud"),
    contractTitle: requireElement("hud-contract-title"),
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

function createAudioElements(root: HTMLElement): AudioElements {
  const controls = document.createElement("details");
  const summary = document.createElement("summary");
  const panel = document.createElement("div");
  const toggle = document.createElement("button");
  const master = createVolumeInput("audio-master-volume");
  const music = createVolumeInput("audio-music-volume");
  const effects = createVolumeInput("audio-effects-volume");
  const masterValue = document.createElement("span");
  const musicValue = document.createElement("span");
  const effectsValue = document.createElement("span");

  controls.className = "audio-controls";
  controls.setAttribute("aria-label", "Sound controls");
  summary.className = "audio-controls__summary";
  summary.textContent = "Sound";
  panel.className = "audio-controls__panel";
  toggle.id = "audio-toggle";
  toggle.type = "button";
  toggle.className = "audio-controls__toggle";
  toggle.textContent = "Sound on";
  toggle.setAttribute("aria-pressed", "true");
  panel.append(
    toggle,
    createVolumeLabel("Master", master, masterValue),
    createVolumeLabel("Music", music, musicValue),
    createVolumeLabel("Effects", effects, effectsValue),
  );
  controls.append(summary, panel);
  root.append(controls);

  return { root: controls, toggle, master, music, effects, masterValue, musicValue, effectsValue };
}

function createVolumeInput(id: string): HTMLInputElement {
  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  return input;
}

function createVolumeLabel(
  text: string,
  input: HTMLInputElement,
  value: HTMLElement,
): HTMLLabelElement {
  const label = document.createElement("label");
  const title = document.createElement("span");
  title.textContent = text;
  value.className = "audio-controls__value";
  label.className = "audio-controls__slider";
  label.htmlFor = input.id;
  label.append(title, input, value);
  return label;
}

function createIntroElements(root: HTMLElement): IntroElements {
  const overlay = document.createElement("div");
  const card = document.createElement("section");
  const eyebrow = document.createElement("p");
  const title = document.createElement("h2");
  const summary = document.createElement("p");
  const controls = document.createElement("p");
  const startButton = document.createElement("button");

  overlay.className = "intro-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "intro-title");
  overlay.setAttribute("aria-describedby", "intro-summary");
  card.className = "intro-card";
  eyebrow.className = "intro-card__eyebrow";
  eyebrow.textContent = "Meadow Delivery";
  title.id = "intro-title";
  title.textContent = "Start Cutting";
  summary.id = "intro-summary";
  summary.className = "intro-card__summary";
  summary.textContent =
    "Clear grass, flowers, fiber, and wood quotas with a spinning blade that levels up as you cut.";
  controls.className = "intro-card__controls";
  controls.textContent = "Drag to move after starting. Keyboard: WASD or arrows. Escape pauses.";
  startButton.id = "start-contract";
  startButton.type = "button";
  startButton.className = "intro-card__button intro-card__button--primary";
  startButton.textContent = "Start Cutting";

  card.append(eyebrow, title, summary, controls, startButton);
  overlay.append(card);
  root.append(overlay);

  return { overlay, startButton };
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
  restartButton.id = "results-restart";
  restartButton.className = "results-card__button";
  restartButton.textContent = "Restart";
  nextButton.type = "button";
  nextButton.id = "results-next";
  nextButton.className = "results-card__button results-card__button--primary";
  nextButton.textContent = "Next Contract";

  stats.append(elapsedLabel, elapsed, cutTargetsLabel, cutTargets, highestLevelLabel, highestLevel);
  actions.append(restartButton, nextButton);
  card.append(eyebrow, title, summary, stats, actions);
  overlay.append(card);
  root.append(overlay);

  return {
    overlay,
    title,
    summary,
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
  resumeButton.id = "pause-resume";
  resumeButton.className = "pause-card__button pause-card__button--primary";
  resumeButton.textContent = "Resume";
  restartButton.type = "button";
  restartButton.id = "pause-restart";
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

function syncRangeInput(input: HTMLInputElement, volume: number): void {
  const value = String(Math.round(volume * 100));
  if (input.value !== value) {
    input.value = value;
  }
}

function volumeFromInput(input: HTMLInputElement): number {
  const parsed = Number(input.value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(1, Math.max(0, parsed / 100));
}

function formatPercent(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
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

function measureCanvasDisplaySize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const bounds = canvas.getBoundingClientRect();
  const viewport = window.visualViewport;
  const fallbackWidth = viewport?.width ?? window.innerWidth;
  const fallbackHeight = viewport?.height ?? window.innerHeight;
  return {
    width: Math.max(1, Math.round(bounds.width || canvas.clientWidth || fallbackWidth)),
    height: Math.max(1, Math.round(bounds.height || canvas.clientHeight || fallbackHeight)),
  };
}

function detectGraphicsAdapter(renderer: THREE.WebGLRenderer): GraphicsAdapterDiagnostics {
  const context = renderer.getContext();
  const extension = context.getExtension("WEBGL_debug_renderer_info");
  if (extension === null) {
    return {
      debugRendererAvailable: false,
      vendor: "unavailable",
      renderer: "unavailable",
    };
  }

  const vendor: unknown = context.getParameter(extension.UNMASKED_VENDOR_WEBGL);
  const rendererName: unknown = context.getParameter(extension.UNMASKED_RENDERER_WEBGL);
  return {
    debugRendererAvailable: true,
    vendor: stringifyGraphicsParameter(vendor),
    renderer: stringifyGraphicsParameter(rendererName),
  };
}

function stringifyGraphicsParameter(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : "unavailable";
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
