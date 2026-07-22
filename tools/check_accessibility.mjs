#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:4209/?seed=12345";
const DEFAULT_OUTPUT_DIR = "output/playwright/accessibility-check";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: !options.headed });
  const summaries = [];

  try {
    summaries.push(await checkKeyboardFocus(browser, options));
    summaries.push(await checkReducedMotion(browser, options));
    summaries.push(await checkZoomedGrayscale(browser, options));
  } finally {
    await browser.close();
  }

  const summaryPath = path.join(options.outputDir, "summary.json");
  await fs.writeFile(summaryPath, `${JSON.stringify(summaries, null, 2)}\n`);
  for (const summary of summaries) {
    console.log(`${summary.name}: passed`);
  }
  console.log(`wrote ${summaryPath}`);
}

async function checkKeyboardFocus(browser, options) {
  const page = await newGamePage(browser, { width: 430, height: 860, touch: true });
  const errors = collectBrowserErrors(page);

  try {
    await openGame(page, scenarioUrl(options.url, { debug: "1" }));

    let state = await renderState(page);
    assertEqual(state.mode, "ready", "keyboard-focus starts in ready mode");
    assertEqual(
      state.flow.focusedElementId,
      "start-contract",
      "keyboard-focus starts on Start Cutting button",
    );
    await page.keyboard.press("ArrowUp");
    await page.evaluate(() => window.advanceTime(1000));
    state = await renderState(page);
    assertEqual(state.elapsedSeconds, 0, "movement key does not advance before Start");

    await page.click("#start-contract");
    await waitForState(page, (nextState) => nextState.flow.focusedElementId === "game-canvas");

    await page.keyboard.press("Space");
    const scrollAfterSpace = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    assertEqual(scrollAfterSpace.x, 0, "Space on focused canvas does not scroll horizontally");
    assertEqual(scrollAfterSpace.y, 0, "Space on focused canvas does not scroll vertically");

    await page.keyboard.down("ArrowUp");
    await page.evaluate(() => window.advanceTime(500));
    const beforeBlur = await renderState(page);
    assertEqual(beforeBlur.mode, "active", "contract is active before blur");
    assert(beforeBlur.elapsedSeconds > 0, "contract advanced before blur");
    assertEqual(
      beforeBlur.controls.input.keyboard.forward,
      true,
      "held key registered before blur",
    );

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "paused" &&
        nextState.flow.focusedElementId === "pause-resume" &&
        nextState.controls.input.keyboard.forward === false,
    );
    const blurPausedState = await renderState(page);
    await page.evaluate(() => window.advanceTime(1000));
    const afterBlurAdvance = await renderState(page);
    assertEqual(
      afterBlurAdvance.elapsedSeconds,
      blurPausedState.elapsedSeconds,
      "blur pause freezes elapsed time",
    );
    const pausedPath = path.join(options.outputDir, "keyboard-paused.png");
    await page.screenshot({ path: pausedPath, fullPage: false });
    await page.keyboard.up("ArrowUp");

    await page.keyboard.press("Enter");
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "active" && nextState.flow.focusedElementId === "game-canvas",
    );

    await page.keyboard.press("Escape");
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "paused" && nextState.flow.focusedElementId === "pause-resume",
    );
    await page.keyboard.press("Enter");
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "active" && nextState.flow.focusedElementId === "game-canvas",
    );

    await page.evaluate(() => window.completeContractForDebug());
    await waitForState(
      page,
      (nextState) =>
        nextState.mode === "complete" && nextState.flow.focusedElementId === "results-next",
    );
    const resultsPath = path.join(options.outputDir, "keyboard-results.png");
    await page.screenshot({ path: resultsPath, fullPage: false });
    assertNoBrowserErrors(errors, "keyboard-focus");

    return {
      name: "keyboard-focus",
      viewport: "430x860",
      focusedElementId: (await renderState(page)).flow.focusedElementId,
      blurPausedElapsedSeconds: blurPausedState.elapsedSeconds,
      scrollAfterSpace,
      screenshots: [pausedPath, resultsPath],
      errors,
    };
  } finally {
    await page.close();
  }
}

async function checkReducedMotion(browser, options) {
  const page = await newGamePage(browser, { width: 430, height: 860, touch: true });
  const errors = collectBrowserErrors(page);

  try {
    await openGame(page, scenarioUrl(options.url, { debug: "1", motion: "reduced" }));
    await page.click("#start-contract");
    await page.evaluate(() => window.cutTargetForDebug("sapling"));
    await waitForState(
      page,
      (state) =>
        state.accessibility.reducedMotion === true &&
        state.presentation.reducedMotion === true &&
        state.presentation.activeFragments <= 24 &&
        state.presentation.collectionMotes.activeMotes <= 8,
    );
    const state = await renderState(page);
    const screenshotPath = path.join(options.outputDir, "reduced-motion.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    assertEqual(state.accessibility.motionSource, "query", "reduced motion comes from query");
    assertNoBrowserErrors(errors, "reduced-motion");

    return {
      name: "reduced-motion",
      viewport: "430x860",
      activeFragments: state.presentation.activeFragments,
      activeCollectionMotes: state.presentation.collectionMotes.activeMotes,
      reducedMotion: state.presentation.reducedMotion,
      screenshot: screenshotPath,
      errors,
    };
  } finally {
    await page.close();
  }
}

async function checkZoomedGrayscale(browser, options) {
  const page = await newGamePage(browser, { width: 215, height: 430, touch: true });
  const errors = collectBrowserErrors(page);

  try {
    await openGame(page, scenarioUrl(options.url, { debug: "1", contrast: "high" }));
    await page.addStyleTag({ content: "#app { filter: grayscale(1); }" });
    await page.click("#start-contract");
    await page.evaluate(() => window.advanceTime(1000));
    const activeMetrics = await measureActiveHud(page);
    assert(activeMetrics.overflowsViewport === false, `HUD overflows viewport: ${activeMetrics}`);

    await page.evaluate(() => window.cutTargetForDebug("sapling"));
    const toughnessPath = path.join(options.outputDir, "zoom-grayscale-toughness.png");
    await page.screenshot({ path: toughnessPath, fullPage: false });

    await page.evaluate(() => window.completeContractForDebug());
    await waitForState(page, (state) => state.mode === "complete");
    const completionMetrics = await measureCompletionCard(page);
    assert(
      completionMetrics.cardOverflowsViewport === false,
      `completion card overflows viewport: ${completionMetrics}`,
    );
    assertEqual(
      completionMetrics.labels.join("|"),
      "Time|Targets cut|Highest level",
      "completion labels remain visible",
    );

    const completionPath = path.join(options.outputDir, "zoom-grayscale-complete.png");
    await page.screenshot({ path: completionPath, fullPage: false });
    assertNoBrowserErrors(errors, "zoom-grayscale");

    return {
      name: "zoom-grayscale",
      viewport: "215x430",
      activeMetrics,
      completionMetrics,
      screenshots: [toughnessPath, completionPath],
      errors,
    };
  } finally {
    await page.close();
  }
}

async function newGamePage(browser, options) {
  return browser.newPage({
    viewport: { width: options.width, height: options.height },
    screen: {
      width: options.touch ? options.width * 2 : options.width,
      height: options.touch ? options.height * 2 : options.height,
    },
    isMobile: options.touch,
    hasTouch: options.touch,
  });
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

async function measureActiveHud(page) {
  return page.evaluate(() => {
    const toRect = (rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    const getRect = (selector) => {
      const element = document.querySelector(selector);
      if (element === null) {
        throw new Error(`Missing element for selector: ${selector}`);
      }
      return toRect(element.getBoundingClientRect());
    };
    const tray = getRect(".objective-tray");
    const rows = [...document.querySelectorAll(".objective-row")].map((row) =>
      toRect(row.getBoundingClientRect()),
    );
    const rects = [tray, ...rows];
    return {
      tray,
      rows,
      overflowsViewport: rects.some(
        (rect) => rect.left < -0.5 || rect.right > window.innerWidth + 0.5,
      ),
    };
  });
}

async function measureCompletionCard(page) {
  return page.evaluate(() => {
    const toRect = (rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    const getRect = (selector) => {
      const element = document.querySelector(selector);
      if (element === null) {
        throw new Error(`Missing element for selector: ${selector}`);
      }
      return toRect(element.getBoundingClientRect());
    };
    const card = getRect(".results-card");
    const next = getRect("#results-next");
    const labels = [...document.querySelectorAll(".results-card__stats dt")].map((node) =>
      (node.textContent ?? "").trim(),
    );
    return {
      card,
      next,
      labels,
      cardOverflowsViewport:
        card.left < -0.5 ||
        card.right > window.innerWidth + 0.5 ||
        card.top < -0.5 ||
        card.bottom > window.innerHeight + 0.5,
    };
  });
}

function scenarioUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

function assertNoBrowserErrors(errors, label) {
  assert(errors.length === 0, `${label} browser errors: ${errors.join(" | ")}`);
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
  console.log(`Usage: node tools/check_accessibility.mjs [options]

Options:
  --url <url>       Base game URL. Default: ${DEFAULT_URL}
  --out <dir>       Output directory. Default: ${DEFAULT_OUTPUT_DIR}
  --headed          Run a visible Chromium window.
  --help            Show this help.

Run the dev server first with: make dev
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
