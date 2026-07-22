#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:4209/?seed=12345";
const DEFAULT_OUTPUT_DIR = "output/playwright/performance-capture";
const DEFAULT_DURATION_MS = 2600;
const DEFAULT_SETTLE_MS = 600;

const SCENARIOS = {
  "desktop-default": {
    qualityQuery: "",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  "desktop-low": {
    qualityQuery: "quality=low",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  "phone-default": {
    qualityQuery: "",
    viewport: { width: 430, height: 860 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selectedScenarios = options.scenarios.map((name) => {
    const scenario = SCENARIOS[name];
    if (scenario === undefined) {
      throw new Error(
        `Unknown scenario "${name}". Available: ${Object.keys(SCENARIOS).join(", ")}`,
      );
    }
    return { name, ...scenario };
  });

  await fs.mkdir(options.outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: !options.headed });
  const summaries = [];

  try {
    for (const scenario of selectedScenarios) {
      const summary = await captureScenario(browser, options, scenario);
      summaries.push(summary);
      console.log(formatSummaryLine(summary));
    }
  } finally {
    await browser.close();
  }

  const summaryPath = path.join(options.outputDir, "summary.json");
  await fs.writeFile(summaryPath, `${JSON.stringify(summaries, null, 2)}\n`);
  console.log(`wrote ${summaryPath}`);
}

async function captureScenario(browser, options, scenario) {
  const page = await browser.newPage({
    viewport: scenario.viewport,
    deviceScaleFactor: scenario.deviceScaleFactor,
    isMobile: scenario.isMobile,
    hasTouch: scenario.hasTouch,
  });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    const url = scenarioUrl(options.url, scenario.qualityQuery);
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__grassBladeReady === true, null, {
      timeout: 10000,
    });
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(options.durationMs);
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(options.settleMs);

    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    const screenshotPath = path.join(options.outputDir, `${scenario.name}.png`);
    const statePath = path.join(options.outputDir, `${scenario.name}.json`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const summary = buildSummary(scenario, state, errors, screenshotPath);
    await fs.writeFile(statePath, `${JSON.stringify({ summary, state }, null, 2)}\n`);
    return summary;
  } finally {
    await page.close();
  }
}

function buildSummary(scenario, state, errors, screenshotPath) {
  const renderer = state.performance.graphicsAdapter.renderer;
  return {
    name: scenario.name,
    quality: state.performance.qualityPreset,
    canvas: {
      cssWidth: state.performance.canvasCssWidth,
      cssHeight: state.performance.canvasCssHeight,
      backingWidth: state.performance.canvasWidth,
      backingHeight: state.performance.canvasHeight,
      aspectMismatch: state.performance.canvasAspectMismatchRatio,
      pixelRatio: state.performance.pixelRatio,
    },
    frame: {
      sampledFrames: state.performance.sampledFrames,
      totalFrames: state.performance.totalFrames,
      averageFrameMs: state.performance.averageFrameMs,
      p95FrameMs: state.performance.p95FrameMs,
      maxFrameMs: state.performance.maxFrameMs,
    },
    graphicsAdapter: state.performance.graphicsAdapter,
    hardwareEvidence: !isSoftwareRenderer(renderer),
    grass: {
      blades: state.meadow.grassBlades,
      visibleBladeBudget: state.presentation.grassVisibleBladeBudget,
      cutMaskAppliedTexels: state.presentation.grassCutMaskAppliedTexels,
      cpuCompletedGrassMatrixUpdates: state.presentation.grassCpuCompletedGrassMatrixUpdates,
    },
    bladeAssetStatus: state.presentation.bladeAssetStatus,
    inventory: state.inventory,
    errors,
    screenshotPath,
  };
}

function scenarioUrl(baseUrl, qualityQuery) {
  const url = new URL(baseUrl);
  if (qualityQuery.length > 0) {
    for (const [key, value] of new URLSearchParams(qualityQuery)) {
      url.searchParams.set(key, value);
    }
  }
  return url.href;
}

function isSoftwareRenderer(renderer) {
  return /swiftshader|software|llvmpipe/i.test(renderer);
}

function formatSummaryLine(summary) {
  const adapter = summary.graphicsAdapter.renderer;
  const hardware = summary.hardwareEvidence ? "hardware-like" : "software";
  return [
    summary.name,
    `${summary.frame.averageFrameMs}ms avg`,
    `${summary.frame.p95FrameMs}ms p95`,
    `${summary.canvas.cssWidth}x${summary.canvas.cssHeight}@${summary.canvas.pixelRatio}`,
    hardware,
    adapter,
  ].join(" | ");
}

function parseArgs(args) {
  const options = {
    url: DEFAULT_URL,
    outputDir: DEFAULT_OUTPUT_DIR,
    durationMs: DEFAULT_DURATION_MS,
    settleMs: DEFAULT_SETTLE_MS,
    headed: false,
    scenarios: Object.keys(SCENARIOS),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--url" && next !== undefined) {
      options.url = next;
      index += 1;
    } else if (arg === "--out" && next !== undefined) {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--duration-ms" && next !== undefined) {
      options.durationMs = parsePositiveInteger(next, "--duration-ms");
      index += 1;
    } else if (arg === "--settle-ms" && next !== undefined) {
      options.settleMs = parsePositiveInteger(next, "--settle-ms");
      index += 1;
    } else if (arg === "--scenario" && next !== undefined) {
      options.scenarios = next
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      index += 1;
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg ?? "<empty>"}`);
    }
  }

  return options;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node tools/capture_performance.mjs [options]

Options:
  --url <url>            Base game URL. Default: ${DEFAULT_URL}
  --out <dir>            Output directory. Default: ${DEFAULT_OUTPUT_DIR}
  --duration-ms <ms>     Held-movement capture duration. Default: ${DEFAULT_DURATION_MS}
  --settle-ms <ms>       Idle settle duration after movement. Default: ${DEFAULT_SETTLE_MS}
  --scenario <names>     Comma-separated scenarios. Available: ${Object.keys(SCENARIOS).join(", ")}
  --headed               Run a visible Chromium window for hardware-adapter evidence.
  --help                 Show this help.

Run the dev server first with: make dev
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
