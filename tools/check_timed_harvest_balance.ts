#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";

import {
  CUMULATIVE_XP_THRESHOLDS,
  FIXED_TIME_STEP_SECONDS,
  MEADOW_SEED,
  createInitialState,
  stepState,
  type GameState,
  type InventoryState,
  type MovementInput,
  type TargetState,
} from "../src/game/state";
import type { TargetKind } from "../src/game/world";

const DEFAULT_OUTPUT_DIR = "output/balance/timed-harvest";
const CONTRACT_ID = "timed-harvest";
const CUT_FRAME_LIMIT = 900;

type Resource = keyof InventoryState;

interface BalanceOptions {
  seed: number;
  outputDir: string;
  maxSeconds: number;
}

interface BalanceCutEvent {
  timeSeconds: number;
  id: string;
  kind: TargetKind;
  resource: Resource;
  inventory: InventoryState;
  level: number;
  rpm: number;
}

interface BalanceSummary {
  contract: string;
  seed: number;
  maxSeconds: number;
  status: "complete" | "timed-out" | "incomplete";
  elapsedSeconds: number;
  timeRemainingSeconds: number;
  finalInventory: InventoryState;
  objectives: InventoryState;
  cutTargets: number;
  highestLevel: number;
  woodRequired: boolean;
  quotaXpBeforeWood: number;
  levelFourXpThreshold: number;
  xpShortfallBeforeWood: number;
  cutEvents: BalanceCutEvent[];
  result: GameState["result"];
}

const idleInput: MovementInput = {
  left: false,
  right: false,
  forward: false,
  backward: false,
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });

  const summary = runBalanceCapture(options);
  const summaryPath = path.join(options.outputDir, `seed-${options.seed}.json`);
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(
    `timed-harvest balance capture: ${summary.status} seed=${options.seed} ` +
      `elapsed=${summary.elapsedSeconds.toFixed(2)}s inventory=${formatInventory(
        summary.finalInventory,
      )} wrote ${summaryPath}`,
  );
}

function runBalanceCapture(options: BalanceOptions): BalanceSummary {
  const state = createInitialState(options.seed, CONTRACT_ID);
  const objectives: InventoryState = {
    grass: state.objectives.grass.target,
    flowers: state.objectives.flowers.target,
    fiber: state.objectives.fiber.target,
    wood: state.objectives.wood.target,
  };
  const quotaTargets = selectQuotaTargets(state);
  const cutEvents: BalanceCutEvent[] = [];
  let processedCutEvents = 0;
  let highestLevel = state.player.level;

  state.targets = quotaTargets;
  parkTargetsOutOfReach(quotaTargets);

  for (const target of quotaTargets) {
    if (state.mode !== "active") {
      break;
    }

    target.x = 0;
    target.z = 0;
    state.player.x = 0;
    state.player.z = 0;
    state.player.vx = 0;
    state.player.vz = 0;

    for (
      let frame = 0;
      frame < CUT_FRAME_LIMIT && target.status !== "cut" && state.mode === "active";
      frame += 1
    ) {
      stepState(state, idleInput, FIXED_TIME_STEP_SECONDS);
      highestLevel = Math.max(highestLevel, state.player.level);
      processedCutEvents = consumeCutEvents(state, processedCutEvents, cutEvents);
    }

    if (target.status !== "cut") {
      break;
    }
  }

  processedCutEvents = consumeCutEvents(state, processedCutEvents, cutEvents);

  const levelFourXpThreshold = CUMULATIVE_XP_THRESHOLDS[2] ?? 110;
  const quotaXp = quotaXpBeforeWood(state);
  const timeLimitSeconds = state.contract.timeLimitSeconds ?? options.maxSeconds;

  return {
    contract: CONTRACT_ID,
    seed: options.seed,
    maxSeconds: options.maxSeconds,
    status:
      state.result?.status === "complete"
        ? "complete"
        : state.result?.status === "timed-out"
          ? "timed-out"
          : "incomplete",
    elapsedSeconds: round(state.elapsedSeconds),
    timeRemainingSeconds: round(Math.max(0, timeLimitSeconds - state.elapsedSeconds)),
    finalInventory: { ...state.inventory },
    objectives,
    cutTargets: state.targets.filter((target) => target.status === "cut").length,
    highestLevel,
    woodRequired: state.objectives.wood.target > 0,
    quotaXpBeforeWood: quotaXp,
    levelFourXpThreshold,
    xpShortfallBeforeWood:
      state.objectives.wood.target > 0 ? Math.max(0, levelFourXpThreshold - quotaXp) : 0,
    cutEvents,
    result: state.result,
  };
}

function selectQuotaTargets(state: GameState): TargetState[] {
  return [
    ...targetsForKind(state, "grass", state.objectives.grass.target),
    ...targetsForKind(state, "flower", state.objectives.flowers.target),
    ...targetsForFiberQuota(state, state.objectives.fiber.target),
    ...targetsForKind(state, "sapling", Math.ceil(state.objectives.wood.target / 2)),
  ];
}

function targetsForFiberQuota(state: GameState, fiberQuota: number): TargetState[] {
  if (fiberQuota <= 0) {
    return [];
  }

  const targets: TargetState[] = [];
  let remainingFiber = fiberQuota;
  for (const target of state.targets) {
    if (target.kind !== "denseWeed" && target.kind !== "shrub") {
      continue;
    }
    if (remainingFiber <= 0) {
      break;
    }

    targets.push(target);
    remainingFiber -= target.yield;
  }

  if (remainingFiber > 0) {
    throw new Error(
      `Timed Harvest needs ${fiberQuota} Fiber but only found ${fiberQuota - remainingFiber}`,
    );
  }

  return targets;
}

function targetsForKind(state: GameState, kind: TargetKind, count: number): TargetState[] {
  if (count <= 0) {
    return [];
  }

  const targets = state.targets.filter((target) => target.kind === kind).slice(0, count);
  if (targets.length !== count) {
    throw new Error(
      `Timed Harvest needs ${count} ${kind} targets but only found ${targets.length}`,
    );
  }
  return targets;
}

function parkTargetsOutOfReach(targets: TargetState[]): void {
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (target === undefined) {
      continue;
    }
    target.x = 80 + index * 7;
    target.z = 80;
    target.status = "standing";
    target.accumulatedWork = 0;
  }
}

function consumeCutEvents(
  state: GameState,
  startIndex: number,
  cutEvents: BalanceCutEvent[],
): number {
  let processedIndex = startIndex;
  while (processedIndex < state.cutEvents.length) {
    const event = state.cutEvents[processedIndex];
    processedIndex += 1;
    if (event === undefined) {
      continue;
    }

    const resource = resourceForTargetKind(event.kind);
    if (resource === null) {
      continue;
    }

    cutEvents.push({
      timeSeconds: round(state.elapsedSeconds),
      id: event.targetId,
      kind: event.kind,
      resource,
      inventory: { ...state.inventory },
      level: state.player.level,
      rpm: round(state.player.rpm),
    });
  }

  return processedIndex;
}

function resourceForTargetKind(kind: TargetKind): Resource | null {
  switch (kind) {
    case "grass":
      return "grass";
    case "flower":
    case "softCrop":
      return "flowers";
    case "denseWeed":
    case "fiberReed":
    case "shrub":
      return "fiber";
    case "sapling":
    case "matureTree":
      return "wood";
    case "rock":
      return null;
  }
}

function quotaXpBeforeWood(state: GameState): number {
  const grassXp = state.targets.find((target) => target.kind === "grass")?.xp ?? 0;
  const flowerXp = state.targets.find((target) => target.kind === "flower")?.xp ?? 0;
  const denseWeedXp = state.targets.find((target) => target.kind === "denseWeed")?.xp ?? 0;

  return (
    state.objectives.grass.target * grassXp +
    state.objectives.flowers.target * flowerXp +
    state.objectives.fiber.target * denseWeedXp
  );
}

function formatInventory(inventory: InventoryState): string {
  return `${inventory.grass}/${inventory.flowers}/${inventory.fiber}/${inventory.wood}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parseArgs(args: string[]): BalanceOptions {
  const options: BalanceOptions = {
    seed: MEADOW_SEED,
    outputDir: DEFAULT_OUTPUT_DIR,
    maxSeconds: 60,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--seed" && next !== undefined) {
      options.seed = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--out" && next !== undefined) {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--max-seconds" && next !== undefined) {
      options.maxSeconds = Number.parseFloat(next);
      index += 1;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg ?? "<empty>"}`);
    }
  }

  if (!Number.isInteger(options.seed) || options.seed < 0) {
    throw new Error(`Invalid --seed value: ${options.seed}`);
  }
  if (!Number.isFinite(options.maxSeconds) || options.maxSeconds <= 0) {
    throw new Error(`Invalid --max-seconds value: ${options.maxSeconds}`);
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: bun tools/check_timed_harvest_balance.ts [options]

Options:
  --seed <uint32>       Seed to run. Default: ${MEADOW_SEED}
  --max-seconds <n>     Maximum simulated seconds. Default: 60
  --out <dir>           Output directory. Default: ${DEFAULT_OUTPUT_DIR}
  --help                Show this help.

This is an evidence capture, not the production gate. It writes deterministic
quota cut-budget and XP analysis so Timed Harvest tuning can compare contract
changes without depending on a fragile scripted movement route.
`);
}

await main();
