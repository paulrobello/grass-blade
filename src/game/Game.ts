import * as THREE from "three";

import { createScene, type MeadowScene } from "./createScene";
import {
  FIXED_TIME_STEP_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  createInitialState,
  stepState,
  type GameState,
  type MovementInput,
} from "./state";

const MILLISECONDS_PER_SECOND = 1000;
const MAX_PIXEL_RATIO = 2;

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly meadow: MeadowScene;
  private readonly state: GameState;
  private readonly input: MovementInput = {
    left: false,
    right: false,
    forward: false,
    backward: false,
  };

  private simulationTimeSeconds = 0;
  private lastFrameTimeMs: number | null = null;
  private manualTime = false;
  private started = false;

  public constructor(canvas: HTMLCanvasElement, seed?: number) {
    this.canvas = canvas;
    this.state = createInitialState(seed);
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

    this.manualTime = true;
    this.lastFrameTimeMs = null;
    const stepCount =
      milliseconds === 0
        ? 0
        : Math.max(
            1,
            Math.round(milliseconds / (FIXED_TIME_STEP_SECONDS * MILLISECONDS_PER_SECOND)),
          );

    for (let step = 0; step < stepCount; step += 1) {
      this.step(FIXED_TIME_STEP_SECONDS);
    }
    this.render();
  };

  private step(deltaSeconds: number): void {
    stepState(this.state, this.input, deltaSeconds);
    this.simulationTimeSeconds += deltaSeconds;
  }

  private render(): void {
    this.meadow.sync(this.state, this.simulationTimeSeconds);
    this.renderer.render(this.meadow.scene, this.meadow.camera);
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
    return JSON.stringify({
      coordinateSystem:
        "Ground plane is XZ with origin at meadow center and +Y up; movement is screen-relative under the fixed isometric camera.",
      mode: this.state.mode,
      seed: this.state.seed,
      meadow: this.meadow.density,
      player: {
        position: { x: round(player.x), z: round(player.z) },
        velocity: { x: round(player.vx), z: round(player.vz) },
        radius: player.radius,
        rpm: player.rpm,
        level: player.level,
      },
      controls: {
        movement: "WASD or arrow keys",
        fullscreen: "F toggles; Escape exits fullscreen",
      },
      objectives,
    });
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
