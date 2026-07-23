#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:4209/?seed=12345&debug=1";
const DEFAULT_OUTPUT_DIR = "output/playwright/mobile-check";

const INTRO_VIEWPORTS = [
  { name: "phone-390x664", width: 390, height: 664 },
  { name: "phone-375x548", width: 375, height: 548 },
  { name: "phone-320x568", width: 320, height: 568 },
  { name: "phone-320x480", width: 320, height: 480 },
];

const HUD_VIEWPORTS = [
  { name: "phone-390x844", width: 390, height: 844 },
  { name: "phone-320x640", width: 320, height: 640 },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: !options.headed });
  const summaries = [];

  try {
    for (const viewport of INTRO_VIEWPORTS) {
      summaries.push(await checkIntroChooser(browser, options, viewport));
    }
    for (const viewport of HUD_VIEWPORTS) {
      summaries.push(await checkActiveHud(browser, options, viewport));
    }
    summaries.push(await checkTouchDrag(browser, options));
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

async function checkIntroChooser(browser, options, viewport) {
  const page = await newMobilePage(browser, viewport);
  const errors = collectBrowserErrors(page);

  try {
    await openGame(page, scenarioUrl(options.url, { contract: "field-sprint" }));
    const metrics = await measureIntroChooser(page);
    assert(metrics.cardFitsViewport, `${viewport.name} intro card overflows viewport`);
    assert(metrics.startButtonVisible, `${viewport.name} Start button is not fully visible`);
    assert(
      !metrics.startButtonOverlapsContractList,
      `${viewport.name} Start button overlaps contract list`,
    );
    assert(
      metrics.selectedContractVisible,
      `${viewport.name} selected contract card is clipped outside list`,
    );

    const introPath = path.join(options.outputDir, `${viewport.name}-intro.png`);
    await page.screenshot({ path: introPath, fullPage: false });

    await page.click("#start-contract");
    await waitForState(
      page,
      (state) => state.mode === "active" && state.flow.contractStarted === true,
    );
    const state = await renderState(page);
    assertEqual(state.contract.id, "field-sprint", `${viewport.name} starts selected contract`);
    assertNoBrowserErrors(errors, viewport.name);

    return {
      name: `${viewport.name}-intro`,
      viewport: `${viewport.width}x${viewport.height}`,
      metrics,
      modeAfterStart: state.mode,
      contractStarted: state.flow.contractStarted,
      screenshot: introPath,
      errors,
    };
  } finally {
    await page.close();
  }
}

async function checkActiveHud(browser, options, viewport) {
  const page = await newMobilePage(browser, viewport);
  const errors = collectBrowserErrors(page);

  try {
    await openGame(page, scenarioUrl(options.url, { contract: "meadow-delivery" }));
    await page.click("#start-contract");
    await waitForState(page, (state) => state.mode === "active");

    const metrics = await measureActiveHud(page);
    assert(metrics.pauseButtonVisible, `${viewport.name} pause button is not visible`);
    assert(metrics.objectiveTrayVisible, `${viewport.name} objective tray is not visible`);
    assert(metrics.pauseButtonInsideViewport, `${viewport.name} pause button overflows viewport`);
    assert(
      metrics.objectiveTrayInsideViewport,
      `${viewport.name} objective tray overflows viewport`,
    );
    assert(metrics.gapBetweenTrayAndPause > 0, `${viewport.name} HUD overlaps pause button`);

    await page.click("#pause-toggle");
    await waitForState(page, (state) => state.mode === "paused");
    await page.click("#pause-toggle");
    await waitForState(page, (state) => state.mode === "active");
    const state = await renderState(page);
    assertEqual(state.flow.pauseButtonHidden, false, `${viewport.name} pause button stays enabled`);
    assertNoBrowserErrors(errors, viewport.name);

    const screenshotPath = path.join(options.outputDir, `${viewport.name}-hud.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    return {
      name: `${viewport.name}-hud`,
      viewport: `${viewport.width}x${viewport.height}`,
      metrics,
      modeAfterResume: state.mode,
      screenshot: screenshotPath,
      errors,
    };
  } finally {
    await page.close();
  }
}

async function checkTouchDrag(browser, options) {
  const viewport = { name: "phone-390x844", width: 390, height: 844 };
  const page = await newMobilePage(browser, viewport);
  const errors = collectBrowserErrors(page);

  try {
    await openGame(page, scenarioUrl(options.url, { contract: "meadow-delivery" }));
    await page.click("#start-contract");
    await waitForState(page, (state) => state.mode === "active");

    const beforeDrag = await renderState(page);
    const canvasBox = await page.locator("#game-canvas").boundingBox();
    assert(canvasBox !== null, "game canvas has a layout box");
    const anchor = {
      x: Math.round(canvasBox.x + canvasBox.width / 2),
      y: Math.round(canvasBox.y + canvasBox.height / 2),
    };
    const dragTo = { x: anchor.x, y: anchor.y - 94 };
    const client = await page.context().newCDPSession(page);

    await dispatchTouch(client, "touchStart", anchor);
    await dispatchTouch(client, "touchMove", dragTo);
    await page.evaluate(() => window.advanceTime(700));
    const duringDrag = await renderState(page);
    assert(
      duringDrag.controls.input.pointerDrag.active,
      "touch drag is active during pointer hold",
    );
    assertEqual(duringDrag.controls.input.pointerDrag.type, "touch", "touch drag type is reported");
    assert(
      duringDrag.controls.input.pointerDrag.stickVisible,
      "touch stick is visible during drag",
    );
    assert(
      duringDrag.player.position.z < beforeDrag.player.position.z,
      "touch drag moves the blade forward",
    );

    const dragPath = path.join(options.outputDir, "phone-390x844-touch-drag.png");
    await page.screenshot({ path: dragPath, fullPage: false });

    await dispatchTouch(client, "touchEnd", dragTo);
    await client.detach();
    await waitForState(
      page,
      (state) =>
        state.controls.input.pointerDrag.active === false &&
        state.controls.input.pointerDrag.stickVisible === false,
    );
    const afterRelease = await renderState(page);
    assertEqual(afterRelease.controls.input.active.forward, false, "touch release clears movement");
    assertNoBrowserErrors(errors, "touch-drag");

    return {
      name: "phone-touch-drag",
      viewport: `${viewport.width}x${viewport.height}`,
      movedZ: round(beforeDrag.player.position.z - duringDrag.player.position.z),
      dragState: duringDrag.controls.input.pointerDrag,
      afterRelease: afterRelease.controls.input.pointerDrag,
      screenshot: dragPath,
      errors,
    };
  } finally {
    await page.close();
  }
}

async function newMobilePage(browser, viewport) {
  return browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    screen: { width: viewport.width * 2, height: viewport.height * 2 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
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
      const state = JSON.parse(window.render_game_to_text());
      return new Function("state", `return (${predicateSource})(state);`)(state);
    },
    predicate.toString(),
    { timeout: 10000 },
  );
}

async function measureIntroChooser(page) {
  return page.evaluate(() => {
    const requiredElement = (selector) => {
      const element = document.querySelector(selector);
      if (element === null) {
        throw new Error(`Missing element for selector: ${selector}`);
      }
      return element;
    };
    const toRect = (rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    const button = requiredElement("#start-contract");
    const card = requiredElement(".intro-card");
    const list = requiredElement(".intro-card__contract-list");
    const selected = requiredElement(".intro-card__contract--selected");
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const buttonRect = toRect(button.getBoundingClientRect());
    const cardRect = toRect(card.getBoundingClientRect());
    const listRect = toRect(list.getBoundingClientRect());
    const selectedRect = toRect(selected.getBoundingClientRect());

    return {
      viewportWidth,
      viewportHeight,
      card: cardRect,
      contractList: listRect,
      selectedContract: selectedRect,
      startButton: buttonRect,
      contractListScrollable: list.scrollHeight > list.clientHeight,
      contractListClientHeight: list.clientHeight,
      contractListScrollHeight: list.scrollHeight,
      cardFitsViewport:
        cardRect.left >= -0.5 &&
        cardRect.right <= viewportWidth + 0.5 &&
        cardRect.top >= -0.5 &&
        cardRect.bottom <= viewportHeight + 0.5,
      startButtonVisible:
        buttonRect.left >= -0.5 &&
        buttonRect.right <= viewportWidth + 0.5 &&
        buttonRect.top >= -0.5 &&
        buttonRect.bottom <= viewportHeight + 0.5,
      startButtonOverlapsContractList: buttonRect.top < listRect.bottom,
      selectedContractVisible:
        selectedRect.left >= listRect.left - 0.5 &&
        selectedRect.right <= listRect.right + 0.5 &&
        selectedRect.top >= listRect.top - 0.5 &&
        selectedRect.bottom <= listRect.bottom + 0.5,
    };
  });
}

async function measureActiveHud(page) {
  return page.evaluate(() => {
    const requiredElement = (selector) => {
      const element = document.querySelector(selector);
      if (element === null) {
        throw new Error(`Missing element for selector: ${selector}`);
      }
      return element;
    };
    const toRect = (rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    const round = (value) => Math.round(value * 1000) / 1000;
    const tray = requiredElement(".objective-tray");
    const pause = requiredElement("#pause-toggle");
    const trayRect = toRect(tray.getBoundingClientRect());
    const pauseRect = toRect(pause.getBoundingClientRect());
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      return !element.hidden && style.display !== "none" && style.visibility !== "hidden";
    };

    return {
      viewportWidth,
      viewportHeight,
      objectiveTray: trayRect,
      pauseButton: pauseRect,
      gapBetweenTrayAndPause: round(pauseRect.left - trayRect.right),
      objectiveTrayVisible: isVisible(tray),
      pauseButtonVisible: isVisible(pause),
      objectiveTrayInsideViewport:
        trayRect.left >= -0.5 &&
        trayRect.right <= viewportWidth + 0.5 &&
        trayRect.top >= -0.5 &&
        trayRect.bottom <= viewportHeight + 0.5,
      pauseButtonInsideViewport:
        pauseRect.left >= -0.5 &&
        pauseRect.right <= viewportWidth + 0.5 &&
        pauseRect.top >= -0.5 &&
        pauseRect.bottom <= viewportHeight + 0.5,
    };
  });
}

async function dispatchTouch(client, type, point) {
  await client.send("Input.dispatchTouchEvent", {
    type,
    touchPoints:
      type === "touchEnd"
        ? []
        : [
            {
              x: point.x,
              y: point.y,
              id: 77,
              radiusX: 1,
              radiusY: 1,
              force: 1,
            },
          ],
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

function round(value) {
  return Math.round(value * 1000) / 1000;
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
  console.log(`Usage: node tools/check_mobile.mjs [options]

Options:
  --url <url>   Game URL. Default: ${DEFAULT_URL}
  --out <dir>   Output directory. Default: ${DEFAULT_OUTPUT_DIR}
  --headed      Run a visible Chromium window.
  --help        Show this help.

Requires the local dev server to be running.
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
