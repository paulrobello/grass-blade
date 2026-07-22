#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:4209/?seed=12345&debug=1";
const DEFAULT_OUTPUT_DIR = "output/playwright/playthrough-check";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: !options.headed });
  try {
    const summary = await runPlaythrough(browser, options);
    const summaryPath = path.join(options.outputDir, "summary.json");
    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`playthrough: passed (${options.headed ? "headed" : "headless"})`);
    console.log(`wrote ${summaryPath}`);
  } finally {
    await browser.close();
  }
}

async function runPlaythrough(browser, options) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const errors = collectBrowserErrors(page);
  const screenshots = [];

  try {
    await openGame(page, options.url);

    let state = await renderState(page);
    assertEqual(state.mode, "ready", "playthrough starts at ready gate");
    assertEqual(
      state.flow.focusedElementId,
      "start-contract",
      "Start button receives initial focus",
    );

    await page.click("#start-contract");
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "active" && nextState.flow.focusedElementId === "game-canvas",
    );

    const beforeMove = await renderState(page);
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(450);
    await page.keyboard.up("ArrowUp");
    await page.evaluate(() => window.advanceTime(500));
    state = await renderState(page);
    assert(
      state.player.position.z < beforeMove.player.position.z,
      "ArrowUp moves the blade forward through the meadow",
    );
    assert(state.inventory.grass > 0, "movement cuts grass and awards inventory");
    screenshots.push(await screenshot(page, options.outputDir, "active-cutting.png"));

    if (options.fullscreen) {
      await page.keyboard.press("KeyF");
      await page.waitForFunction(() => document.fullscreenElement !== null, null, {
        timeout: 5000,
      });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.fullscreenElement === null, null, {
        timeout: 5000,
      });
      state = await renderState(page);
      assertEqual(state.mode, "active", "Escape exits fullscreen before pausing");
    }

    await page.keyboard.press("Escape");
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "paused" && nextState.flow.focusedElementId === "pause-resume",
    );
    screenshots.push(await screenshot(page, options.outputDir, "paused.png"));

    await page.keyboard.press("Enter");
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "active" && nextState.flow.focusedElementId === "game-canvas",
    );

    await page.evaluate(() => window.cutTargetForDebug("sapling"));
    await waitForState(
      page,
      (nextState) => nextState.inventory.wood > 0 && nextState.player.level >= 2,
    );
    screenshots.push(await screenshot(page, options.outputDir, "sapling-reward.png"));

    await page.evaluate(() => window.completeContractForDebug());
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "complete" &&
        nextState.flow.focusedElementId === "results-next" &&
        nextState.result !== null,
    );
    state = await renderState(page);
    screenshots.push(await screenshot(page, options.outputDir, "complete.png"));
    assertNoBrowserErrors(errors);

    return {
      headed: options.headed,
      fullscreenChecked: options.fullscreen,
      finalMode: state.mode,
      finalFocus: state.flow.focusedElementId,
      finalInventory: state.inventory,
      result: state.result,
      screenshots,
      errors,
    };
  } finally {
    await page.close();
  }
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openGame(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__grassBladeReady === true, null, {
    timeout: 10000,
  });
}

async function renderState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function waitForState(page, predicate) {
  await page.waitForFunction(
    (predicateSource) => {
      const nextState = JSON.parse(window.render_game_to_text());
      return new Function("state", `return (${predicateSource})(state);`)(nextState);
    },
    predicate.toString(),
    { timeout: 10000 },
  );
}

async function screenshot(page, outputDir, name) {
  const screenshotPath = path.join(outputDir, name);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

function assertNoBrowserErrors(errors) {
  assert(errors.length === 0, `browser errors: ${errors.join(" | ")}`);
}

function assertEqual(actual, expected, message) {
  assert(Object.is(actual, expected), `${message}: expected ${expected}, got ${actual}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs(args) {
  const options = {
    url: DEFAULT_URL,
    outputDir: DEFAULT_OUTPUT_DIR,
    headed: false,
    fullscreen: false,
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
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--fullscreen") {
      options.fullscreen = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg ?? "<empty>"}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node tools/check_playthrough.mjs [options]

Options:
  --url <url>       Game URL. Default: ${DEFAULT_URL}
  --out <dir>       Output directory. Default: ${DEFAULT_OUTPUT_DIR}
  --headed          Run a visible Chromium window.
  --fullscreen      Verify F enters fullscreen and Escape exits before pause.
  --help            Show this help.

Run the dev server first with: make dev
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
