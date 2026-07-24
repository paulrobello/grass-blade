import type { CutCompletionEvent, GameMode, PlayerState } from "./state";

export interface AudioSettings {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
}

export interface AudioDiagnostics extends AudioSettings {
  supported: boolean;
  enabled: boolean;
  contextState: AudioContextState | "unavailable";
  rpmFrequencyHz: number;
  rpmHumGain: number;
  processedCutEvents: number;
  processedRockDeflections: number;
  lastRockDeflectionTargetId: string | null;
}

export interface AudioSyncState {
  mode: GameMode | "ready";
  player: PlayerState;
  contactCount: number;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  masterVolume: 0.7,
  musicVolume: 0.45,
  effectsVolume: 0.85,
};

const MIN_RPM_FREQUENCY_HZ = 82;
const MAX_RPM_FREQUENCY_HZ = 248;

export function resolveAudioSettings(
  searchParams: URLSearchParams,
  defaults: AudioSettings = DEFAULT_AUDIO_SETTINGS,
): AudioSettings {
  return {
    muted: resolveBoolean(searchParams.get("muted"), defaults.muted),
    masterVolume: resolveVolume(searchParams.get("masterVolume"), defaults.masterVolume),
    musicVolume: resolveVolume(searchParams.get("musicVolume"), defaults.musicVolume),
    effectsVolume: resolveVolume(searchParams.get("effectsVolume"), defaults.effectsVolume),
  };
}

export function resolveVolume(rawValue: string | null, fallback: number): number {
  if (rawValue === null || rawValue.trim() === "") {
    return clampVolume(fallback);
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return clampVolume(fallback);
  }

  return clampVolume(parsed > 1 ? parsed / 100 : parsed);
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function deriveRpmFrequencyHz(rpm: number, targetRpm: number): number {
  const safeTargetRpm = Math.max(1, targetRpm);
  const loadedRatio = Math.min(1.15, Math.max(0, rpm / safeTargetRpm));
  return Math.round(
    MIN_RPM_FREQUENCY_HZ + (MAX_RPM_FREQUENCY_HZ - MIN_RPM_FREQUENCY_HZ) * loadedRatio,
  );
}

export class GameAudio {
  private settings: AudioSettings;
  private readonly supported: boolean;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private rpmOscillator: OscillatorNode | null = null;
  private rpmGain: GainNode | null = null;
  private rpmFrequencyHz = deriveRpmFrequencyHz(0, 720);
  private rpmHumGain = 0;
  private processedCutEvents = 0;
  private processedRockDeflections = 0;
  private lastRockDeflectionTargetId: string | null = null;

  public constructor(settings: AudioSettings) {
    this.settings = { ...settings };
    this.supported = typeof AudioContext !== "undefined";
  }

  public get diagnostics(): AudioDiagnostics {
    return {
      ...this.settings,
      supported: this.supported,
      enabled: this.context !== null && !this.settings.muted,
      contextState: this.context?.state ?? "unavailable",
      rpmFrequencyHz: this.rpmFrequencyHz,
      rpmHumGain: Number(this.rpmHumGain.toFixed(4)),
      processedCutEvents: this.processedCutEvents,
      processedRockDeflections: this.processedRockDeflections,
      lastRockDeflectionTargetId: this.lastRockDeflectionTargetId,
    };
  }

  public setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted };
    this.applyVolumes();
  }

  public setVolume(
    channel: keyof Pick<AudioSettings, "masterVolume" | "musicVolume" | "effectsVolume">,
    value: number,
  ): void {
    this.settings = { ...this.settings, [channel]: clampVolume(value) };
    this.applyVolumes();
  }

  public async resume(): Promise<void> {
    if (this.settings.muted || !this.ensureContext()) {
      return;
    }

    if (this.context?.state === "suspended") {
      await this.context.resume();
    }
  }

  public sync(state: AudioSyncState): void {
    this.rpmFrequencyHz = deriveRpmFrequencyHz(state.player.rpm, state.player.targetRpm);
    this.rpmHumGain =
      state.mode === "active" && !this.settings.muted
        ? clampVolume(0.028 + Math.min(state.contactCount, 10) * 0.004)
        : 0;

    if (!this.context || !this.rpmOscillator || !this.rpmGain) {
      return;
    }

    const now = this.context.currentTime;
    this.rpmOscillator.frequency.setTargetAtTime(this.rpmFrequencyHz, now, 0.045);
    this.rpmGain.gain.setTargetAtTime(this.rpmHumGain, now, 0.075);
  }

  public playCut(event: CutCompletionEvent): void {
    this.processedCutEvents = Math.max(this.processedCutEvents, event.revision);
    if (this.settings.muted || !this.ensureContext() || !this.context || !this.effectsGain) {
      return;
    }

    const frequency = cutFrequency(event.kind);
    this.playTone({
      frequency,
      durationSeconds: event.kind === "sapling" || event.kind === "matureTree" ? 0.14 : 0.07,
      gain: event.kind === "sapling" || event.kind === "matureTree" ? 0.12 : 0.075,
      type: event.kind === "flower" || event.kind === "softCrop" ? "triangle" : "square",
    });
  }

  public playRockDeflection(targetId: string): void {
    this.processedRockDeflections += 1;
    this.lastRockDeflectionTargetId = targetId;
    if (this.settings.muted || !this.ensureContext() || !this.context || !this.effectsGain) {
      return;
    }

    this.playTone({
      frequency: 740,
      durationSeconds: 0.045,
      gain: 0.085,
      type: "square",
    });
    this.playTone({
      frequency: 1180,
      durationSeconds: 0.035,
      gain: 0.045,
      type: "triangle",
      delaySeconds: 0.018,
    });
  }

  public playLevelUp(level: number): void {
    if (this.settings.muted || !this.ensureContext() || !this.context) {
      return;
    }

    const base = 300 + level * 24;
    this.playTone({
      frequency: base,
      durationSeconds: 0.08,
      gain: 0.09,
      type: "sine",
      delaySeconds: 0,
    });
    this.playTone({
      frequency: base * 1.25,
      durationSeconds: 0.09,
      gain: 0.08,
      type: "sine",
      delaySeconds: 0.07,
    });
    this.playTone({
      frequency: base * 1.5,
      durationSeconds: 0.12,
      gain: 0.07,
      type: "sine",
      delaySeconds: 0.14,
    });
  }

  public playComplete(): void {
    if (this.settings.muted || !this.ensureContext() || !this.context) {
      return;
    }

    this.playTone({
      frequency: 392,
      durationSeconds: 0.18,
      gain: 0.09,
      type: "triangle",
      delaySeconds: 0,
    });
    this.playTone({
      frequency: 523,
      durationSeconds: 0.22,
      gain: 0.08,
      type: "triangle",
      delaySeconds: 0.12,
    });
  }

  public dispose(): void {
    this.rpmOscillator?.stop();
    this.rpmOscillator = null;
    this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private ensureContext(): boolean {
    if (!this.supported) {
      return false;
    }
    if (this.context !== null) {
      return true;
    }

    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.effectsGain = this.context.createGain();
    this.rpmGain = this.context.createGain();
    this.rpmOscillator = this.context.createOscillator();
    this.rpmOscillator.type = "sawtooth";
    this.rpmOscillator.frequency.value = this.rpmFrequencyHz;
    this.rpmGain.gain.value = 0;
    this.rpmOscillator.connect(this.rpmGain);
    this.rpmGain.connect(this.musicGain);
    this.musicGain.connect(this.masterGain);
    this.effectsGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.rpmOscillator.start();
    this.applyVolumes();
    return true;
  }

  private applyVolumes(): void {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const masterVolume = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain?.gain.setTargetAtTime(masterVolume, now, 0.025);
    this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume, now, 0.025);
    this.effectsGain?.gain.setTargetAtTime(this.settings.effectsVolume, now, 0.025);
  }

  private playTone(options: {
    frequency: number;
    durationSeconds: number;
    gain: number;
    type: OscillatorType;
    delaySeconds?: number;
  }): void {
    if (!this.context || !this.effectsGain) {
      return;
    }

    const startTime = this.context.currentTime + (options.delaySeconds ?? 0);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(options.gain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + options.durationSeconds);
    oscillator.connect(gain);
    gain.connect(this.effectsGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + options.durationSeconds + 0.025);
  }
}

function resolveBoolean(rawValue: string | null, fallback: boolean): boolean {
  const normalized = rawValue?.trim().toLowerCase() ?? "";
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function cutFrequency(kind: CutCompletionEvent["kind"]): number {
  switch (kind) {
    case "grass":
      return 520;
    case "flower":
      return 660;
    case "softCrop":
      return 705;
    case "denseWeed":
    case "fiberReed":
    case "shrub":
      return 390;
    case "sapling":
    case "matureTree":
      return 185;
  }
}
