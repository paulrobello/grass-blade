#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";

import {
  CONTRACT_DEFINITIONS,
  FIXED_TIME_STEP_SECONDS,
  MEADOW_SEED,
  createInitialState,
  stepState,
  type ContractDefinition,
  type GameState,
  type InventoryState,
  type MovementInput,
  type TargetState,
} from "../src/game/state";
import type { TargetKind } from "../src/game/world";

const DEFAULT_OUTPUT_DIR = "output/balance/contracts";
const CUT_FRAME_LIMIT = 900;
const TIMED_EPSILON_SECONDS = FIXED_TIME_STEP_SECONDS / 2;
const DEFAULT_VALIDATION_SEEDS = [
  MEADOW_SEED,
  1,
  42,
  707,
  12345,
  98765,
  314159,
  2654448114,
  3456789012,
  4000000000,
] as const;

type Resource = keyof InventoryState;

interface BalanceOptions {
  seeds: number[];
  outputDir: string;
  contractId: ContractDefinition["id"] | "all";
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

interface ContractBalanceSummary {
  contract: ContractDefinition["id"];
  title: string;
  seed: number;
  status: "complete" | "timed-out" | "incomplete" | "late-complete";
  elapsedSeconds: number;
  timeLimitSeconds: number | null;
  timeRemainingSeconds: number | null;
  finalInventory: InventoryState;
  objectives: InventoryState;
  selectedTargets: Record<TargetKind, number>;
  availableResources: InventoryState;
  cutTargets: number;
  highestLevel: number;
  cutEvents: BalanceCutEvent[];
  result: GameState["result"];
}

interface ContractBalanceReport {
  seed: number;
  status: "pass" | "fail";
  contracts: ContractBalanceSummary[];
}

interface ContractTimingAggregate {
  contract: ContractDefinition["id"];
  runs: number;
  minElapsedSeconds: number;
  averageElapsedSeconds: number;
  maxElapsedSeconds: number;
  minHighestLevel: number;
  maxHighestLevel: number;
  maxCutTargets: number;
  statuses: Record<ContractBalanceSummary["status"], number>;
}

interface MultiSeedBalanceReport {
  seeds: number[];
  status: "pass" | "fail";
  aggregate: ContractTimingAggregate[];
  reports: ContractBalanceReport[];
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

  const report = runMultiSeedBalanceReport(options);
  const summaryPath =
    options.seeds.length === 1
      ? path.join(options.outputDir, `seed-${options.seeds[0]}.json`)
      : path.join(options.outputDir, "summary.json");
  await fs.writeFile(summaryPath, `${JSON.stringify(report, null, 2)}\n`);
  if (options.seeds.length > 1) {
    await writePerSeedReports(options.outputDir, report.reports);
  }

  const oneLine = report.aggregate
    .map(
      (contract) =>
        `${contract.contract}:${contract.minElapsedSeconds.toFixed(2)}-${contract.maxElapsedSeconds.toFixed(2)}s avg=${contract.averageElapsedSeconds.toFixed(2)}s`,
    )
    .join(" ");

  console.log(
    `contract balance capture: ${report.status} seeds=${options.seeds.length} wrote ${summaryPath}`,
  );
  console.log(oneLine);

  if (report.status !== "pass") {
    process.exitCode = 1;
  }
}

function runMultiSeedBalanceReport(options: BalanceOptions): MultiSeedBalanceReport {
  const reports = options.seeds.map((seed) => runContractBalanceReport(seed, options.contractId));
  const failed = reports.some((report) => report.status !== "pass");

  return {
    seeds: options.seeds,
    status: failed ? "fail" : "pass",
    aggregate: aggregateContractTiming(reports),
    reports,
  };
}

function runContractBalanceReport(
  seed: number,
  contractId: BalanceOptions["contractId"],
): ContractBalanceReport {
  const contracts =
    contractId === "all"
      ? CONTRACT_DEFINITIONS
      : CONTRACT_DEFINITIONS.filter((contract) => contract.id === contractId);
  const summaries = contracts.map((contract) => runContractBalanceCapture(seed, contract));
  const failed = summaries.some((summary) => summary.status !== "complete");

  return {
    seed,
    status: failed ? "fail" : "pass",
    contracts: summaries,
  };
}

async function writePerSeedReports(
  outputDir: string,
  reports: readonly ContractBalanceReport[],
): Promise<void> {
  await Promise.all(
    reports.map((report) =>
      fs.writeFile(
        path.join(outputDir, `seed-${report.seed}.json`),
        `${JSON.stringify(report, null, 2)}\n`,
      ),
    ),
  );
}

function aggregateContractTiming(
  reports: readonly ContractBalanceReport[],
): ContractTimingAggregate[] {
  const contractIds = new Set<ContractDefinition["id"]>();
  for (const report of reports) {
    for (const contract of report.contracts) {
      contractIds.add(contract.contract);
    }
  }

  return [...contractIds].map((contractId) => {
    const runs = reports
      .flatMap((report) => report.contracts)
      .filter((contract) => contract.contract === contractId);
    const elapsed = runs.map((contract) => contract.elapsedSeconds);
    const highestLevels = runs.map((contract) => contract.highestLevel);
    const statuses = createEmptyStatusCounts();
    for (const run of runs) {
      statuses[run.status] += 1;
    }

    return {
      contract: contractId,
      runs: runs.length,
      minElapsedSeconds: round(Math.min(...elapsed)),
      averageElapsedSeconds: round(elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length),
      maxElapsedSeconds: round(Math.max(...elapsed)),
      minHighestLevel: Math.min(...highestLevels),
      maxHighestLevel: Math.max(...highestLevels),
      maxCutTargets: Math.max(...runs.map((contract) => contract.cutTargets)),
      statuses,
    };
  });
}

function createEmptyStatusCounts(): Record<ContractBalanceSummary["status"], number> {
  return {
    complete: 0,
    "timed-out": 0,
    incomplete: 0,
    "late-complete": 0,
  };
}

function runContractBalanceCapture(
  seed: number,
  contract: ContractDefinition,
): ContractBalanceSummary {
  const state = createInitialState(seed, contract.id);
  const objectives: InventoryState = {
    grass: state.objectives.grass.target,
    flowers: state.objectives.flowers.target,
    fiber: state.objectives.fiber.target,
    wood: state.objectives.wood.target,
  };
  const availableResources = totalAvailableResources(state);
  const quotaTargets = selectContractTargets(state);
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
  void processedCutEvents;

  const status = balanceStatus(state);
  const timeLimitSeconds = state.contract.timeLimitSeconds;

  return {
    contract: contract.id,
    title: contract.title,
    seed,
    status,
    elapsedSeconds: round(state.elapsedSeconds),
    timeLimitSeconds,
    timeRemainingSeconds:
      timeLimitSeconds === null
        ? null
        : round(Math.max(0, timeLimitSeconds - state.elapsedSeconds)),
    finalInventory: { ...state.inventory },
    objectives,
    selectedTargets: countTargetsByKind(quotaTargets),
    availableResources,
    cutTargets: state.targets.filter((target) => target.status === "cut").length,
    highestLevel,
    cutEvents,
    result: state.result,
  };
}

function balanceStatus(state: GameState): ContractBalanceSummary["status"] {
  if (state.result?.status === "timed-out") {
    return "timed-out";
  }
  if (state.result?.status !== "complete") {
    return "incomplete";
  }
  if (
    state.contract.timeLimitSeconds !== null &&
    state.result.completedAtSeconds - state.contract.timeLimitSeconds > TIMED_EPSILON_SECONDS
  ) {
    return "late-complete";
  }
  return "complete";
}

function selectContractTargets(state: GameState): TargetState[] {
  if (state.contract.completionMode === "clear-patches") {
    return [
      ...targetsForKind(state, "grass", state.objectives.grass.target),
      ...allTargetsForKind(state, "flower"),
      ...allTargetsForKind(state, "softCrop"),
    ];
  }

  return [
    ...targetsForKind(state, "grass", state.objectives.grass.target),
    ...targetsForFlowerQuota(state, state.objectives.flowers.target),
    ...targetsForFiberQuota(state, state.objectives.fiber.target),
    ...targetsForWoodQuota(state, state.objectives.wood.target),
  ];
}

function targetsForFlowerQuota(state: GameState, flowerQuota: number): TargetState[] {
  if (flowerQuota <= 0) {
    return [];
  }

  const targets: TargetState[] = [];
  let remainingFlowers = flowerQuota;
  for (const target of state.targets) {
    if (target.kind !== "flower" && target.kind !== "softCrop") {
      continue;
    }
    if (remainingFlowers <= 0) {
      break;
    }

    targets.push(target);
    remainingFlowers -= target.yield;
  }

  if (remainingFlowers > 0) {
    throw new Error(
      `${state.contract.id} needs ${flowerQuota} Flowers but only found ${
        flowerQuota - remainingFlowers
      }`,
    );
  }

  return targets;
}

function targetsForFiberQuota(state: GameState, fiberQuota: number): TargetState[] {
  if (fiberQuota <= 0) {
    return [];
  }

  const targets: TargetState[] = [];
  let remainingFiber = fiberQuota;
  const preferredKinds =
    state.contract.id === "reed-run"
      ? new Set<TargetKind>(["fiberReed", "denseWeed", "shrub"])
      : new Set<TargetKind>(["denseWeed", "shrub"]);
  for (const target of state.targets) {
    if (!preferredKinds.has(target.kind)) {
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
      `${state.contract.id} needs ${fiberQuota} Fiber but only found ${fiberQuota - remainingFiber}`,
    );
  }

  return targets;
}

function targetsForWoodQuota(state: GameState, woodQuota: number): TargetState[] {
  if (woodQuota <= 0) {
    return [];
  }

  const targets: TargetState[] = [];
  let remainingWood = woodQuota;
  for (const target of state.targets) {
    if (target.kind !== "sapling" && target.kind !== "matureTree") {
      continue;
    }
    if (remainingWood <= 0) {
      break;
    }

    targets.push(target);
    remainingWood -= target.yield;
  }

  if (remainingWood > 0) {
    throw new Error(
      `${state.contract.id} needs ${woodQuota} Wood but only found ${woodQuota - remainingWood}`,
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
      `${state.contract.id} needs ${count} ${kind} targets but only found ${targets.length}`,
    );
  }
  return targets;
}

function allTargetsForKind(state: GameState, kind: TargetKind): TargetState[] {
  return state.targets.filter((target) => target.kind === kind);
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

function countTargetsByKind(targets: readonly TargetState[]): Record<TargetKind, number> {
  const counts: Record<TargetKind, number> = {
    grass: 0,
    flower: 0,
    softCrop: 0,
    denseWeed: 0,
    fiberReed: 0,
    shrub: 0,
    sapling: 0,
    matureTree: 0,
    rock: 0,
  };

  for (const target of targets) {
    counts[target.kind] += 1;
  }

  return counts;
}

function totalAvailableResources(state: GameState): InventoryState {
  const totals: InventoryState = { grass: 0, flowers: 0, fiber: 0, wood: 0 };
  for (const target of state.targets) {
    switch (target.kind) {
      case "grass":
        totals.grass += target.yield;
        break;
      case "flower":
      case "softCrop":
        totals.flowers += target.yield;
        break;
      case "denseWeed":
      case "fiberReed":
      case "shrub":
        totals.fiber += target.yield;
        break;
      case "sapling":
      case "matureTree":
        totals.wood += target.yield;
        break;
      case "rock":
        break;
    }
  }
  return totals;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parseArgs(args: string[]): BalanceOptions {
  const options: BalanceOptions = {
    seeds: [...DEFAULT_VALIDATION_SEEDS],
    outputDir: DEFAULT_OUTPUT_DIR,
    contractId: "all",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--seed" && next !== undefined) {
      options.seeds = [parseSeed(next)];
      index += 1;
    } else if (arg === "--seeds" && next !== undefined) {
      options.seeds = parseSeeds(next);
      index += 1;
    } else if (arg === "--out" && next !== undefined) {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--contract" && next !== undefined) {
      options.contractId = parseContractId(next);
      index += 1;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg ?? "<empty>"}`);
    }
  }

  return options;
}

function parseSeed(value: string): number {
  const seed = Number.parseInt(value, 10);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`Invalid seed value: ${value}`);
  }
  return seed;
}

function parseSeeds(value: string): number[] {
  if (value === "default") {
    return [...DEFAULT_VALIDATION_SEEDS];
  }

  const seeds = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(parseSeed);
  if (seeds.length === 0) {
    throw new Error("At least one seed is required");
  }
  return seeds;
}

function parseContractId(value: string): BalanceOptions["contractId"] {
  if (value === "all") {
    return value;
  }

  const contract = CONTRACT_DEFINITIONS.find((definition) => definition.id === value);
  if (contract === undefined) {
    throw new Error(`Unknown contract id: ${value}`);
  }
  return contract.id;
}

function printHelp(): void {
  console.log(`Usage: bun tools/check_contract_balance.ts [options]

Options:
  --seed <uint32>       Run one seed instead of the default validation set.
  --seeds <list>        Comma-separated uint32 seeds, or "default".
  --contract <id|all>   Contract to capture. Default: all
  --out <dir>           Output directory. Default: ${DEFAULT_OUTPUT_DIR}
  --help                Show this help.

This is a deterministic balance evidence capture. It isolates each required
target at full blade contact, cuts through normal fixed-step simulation, and
writes quota size, target mix, completion status, elapsed cut-budget seconds,
cut-event timing, and aggregate min/average/max timing for every authored
contract across the selected seeds.
`);
}

await main();
