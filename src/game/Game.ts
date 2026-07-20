import * as THREE from "three";

import { createScene, type MeadowScene } from "./createScene";
import {
  CUMULATIVE_XP_THRESHOLDS,
  FIXED_TIME_STEP_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  createInitialState,
  stepState,
  type GameState,
  type MovementInput,
} from "./state";

const MILLISECONDS_PER_SECOND = 1000;
const MAX_PIXEL_RATIO = 2;

interface HudElements {
  root: HTMLElement;
  time: HTMLElement;
  level: HTMLElement;
  rpm: HTMLElement;
  grass: HTMLElement;
  grassTarget: HTMLElement;
  flowers: HTMLElement;
  flowersTarget: HTMLElement;
  xpFill: HTMLElement;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly meadow: MeadowScene;
  private readonly state: GameState;
  private readonly hud: HudElements;
  private readonly input: MovementInput = {
    left: false,
    right: false,
    forward: false,
    backward: false,
  };

  private simulationTimeSeconds = 0;
  private accumulatorSeconds = 0;
  private lastFrameTimeMs: number | null = null;
  private manualTime = false;
  private started = false;

  public constructor(canvas: HTMLCanvasElement, seed?: number) {
    this.canvas = canvas;
    this.state = createInitialState(seed);
    this.hud = getHudElements();
    this.meadow = createScene(this.state.seed);
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
      stepState(this.state, this.input, FIXED_TIME_STEP_SECONDS);
      this.simulationTimeSeconds += FIXED_TIME_STEP_SECONDS;
      this.accumulatorSeconds -= FIXED_TIME_STEP_SECONDS;
    }
  }

  private render(): void {
    this.updateHud();
    this.meadow.sync(this.state, this.simulationTimeSeconds);
    this.renderer.render(this.meadow.scene, this.meadow.camera);
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

    setText(this.hud.time, formatElapsedTime(this.simulationTimeSeconds));
    setText(this.hud.level, `LV ${player.level}`);
    setText(this.hud.rpm, `${Math.round(player.rpm)} RPM`);
    setText(this.hud.grass, String(objectives.grass.collected));
    setText(this.hud.grassTarget, String(objectives.grass.target));
    setText(this.hud.flowers, String(objectives.flowers.collected));
    setText(this.hud.flowersTarget, String(objectives.flowers.target));
    this.hud.root.style.setProperty("--rpm-progress", `${Math.round(rpmProgress * 100)}%`);
    this.hud.xpFill.style.width = `${xpProgress * 100}%`;
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
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

    if (event.code === "Escape" && document.fullscreenElement !== null && !event.repeat) {
      event.preventDefault();
      void document.exitFullscreen();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.setMovementKey(event.code, false)) {
      event.preventDefault();
    }
  };

  private setMovementKey(code: string, pressed: boolean): boolean {
    switch (code) {
      case "KeyA":
      case "ArrowLeft":
        this.input.left = pressed;
        return true;
      case "KeyD":
      case "ArrowRight":
        this.input.right = pressed;
        return true;
      case "KeyW":
      case "ArrowUp":
        this.input.forward = pressed;
        return true;
      case "KeyS":
      case "ArrowDown":
        this.input.backward = pressed;
        return true;
      default:
        return false;
    }
  }

  private readonly resetInput = (): void => {
    this.input.left = false;
    this.input.right = false;
    this.input.forward = false;
    this.input.backward = false;
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

  private readonly renderGameToText = (): string => {
    const { player, objectives } = this.state;
    const targetCounts = { standing: 0, cutting: 0, cut: 0 };
    const activeTargets: Array<{
      id: string;
      kind: string;
      status: string;
      work: number;
      requiredWork: number;
    }> = [];

    for (const target of this.state.targets) {
      targetCounts[target.status] += 1;
      if (target.status === "cutting" && activeTargets.length < 12) {
        activeTargets.push({
          id: target.id,
          kind: target.kind,
          status: target.status,
          work: round(target.accumulatedWork),
          requiredWork: target.requiredWork,
        });
      }
    }

    return JSON.stringify({
      coordinateSystem:
        "Ground plane is XZ with origin at meadow center and +Y up; movement is screen-relative under the fixed isometric camera.",
      mode: this.state.mode,
      seed: this.state.seed,
      elapsedSeconds: round(this.simulationTimeSeconds),
      meadow: this.meadow.density,
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
        movement: "WASD or arrow keys",
        fullscreen: "F toggles; Escape exits fullscreen",
      },
      inventory: this.state.inventory,
      xp: this.state.xp,
      objectives,
      targets: {
        total: this.state.targets.length,
        ...targetCounts,
        active: activeTargets,
        cutRevision: this.state.cutRevision,
      },
    });
  };
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
    xpFill: requireElement("hud-xp-fill"),
  };
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

function formatElapsedTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
