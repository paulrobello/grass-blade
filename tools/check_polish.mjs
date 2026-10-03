#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.GAME_URL ?? "http://127.0.0.1:4209/";
const outputDir = "output/playwright/polish-check";
const scenarios = [
  { contract: "pocket-garden", width: 1440, height: 900 },
  { contract: "long-orchard", width: 1440, height: 900 },
  { contract: "crescent-wetland", width: 1440, height: 900 },
  { contract: "crescent-wetland", width: 390, height: 844 },
  { contract: "pocket-garden", width: 320, height: 568 },
  { contract: "frost-ribbons", width: 1280, height: 720, reducedMotion: true },
  { contract: "sunset-switchback", width: 1280, height: 720 },
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: false, channel: "chrome", timeout: 15000 });
const summaries = [];
try {
  for (const scenario of scenarios) {
    const name = `${scenario.contract}-${scenario.width}`;
    console.log(`${name}: checking in headed Chrome`);
    const page = await browser.newPage({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: 1,
      isMobile: scenario.width < 600,
      hasTouch: scenario.width < 600,
      reducedMotion: scenario.reducedMotion ? "reduce" : "no-preference",
    });
    const errors = [];
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      const url = new URL(baseUrl);
      url.search = new URLSearchParams({
        seed: "12345",
        debug: "1",
        contract: scenario.contract,
      }).toString();
      await page.goto(url.href);
      await page.waitForFunction(() => window.__grassBladeReady === true);
      const ready = await readState(page);
      assert.equal(ready.mode, "ready");
      const preview = page.locator(`#contract-choice-${scenario.contract} svg`);
      assert.equal(await preview.count(), 1, `${name}: field preview`);
      assert.equal(
        await preview.locator(".intro-card__contract-preview-cell").count(),
        ready.meadow.arenaFloorInstances,
        `${name}: preview matches playable grass footprint`,
      );
      await page.screenshot({ path: path.join(outputDir, `${name}-chooser.png`) });
      await page.click("#start-contract");
      await page.evaluate(() => window.advanceTime(100));
      const before = await readState(page);
      await page.keyboard.down("ArrowUp");
      await page.evaluate(() => window.advanceTime(1200));
      await page.keyboard.up("ArrowUp");
      const moved = await readState(page);
      assert(moved.player.position.z < before.player.position.z, `${name}: movement`);
      assert(moved.inventory.grass > 0, `${name}: harvesting awards grass`);
      assert.equal(moved.contract.id, scenario.contract);
      assert.equal(moved.accessibility.reducedMotion, Boolean(scenario.reducedMotion));
      assert(moved.performance.graphicsAdapter.renderer, `${name}: graphics adapter`);
      assert.equal(moved.presentation.bladeReachCueRadius, moved.player.radius);
      assert.equal(
        await page
          .locator("#hud-row-grass")
          .evaluate((row) => row.style.getPropertyValue("--objective-progress")),
        `${Math.round(Math.min(1, moved.objectives.grass.collected / moved.objectives.grass.target) * 100)}%`,
        `${name}: quota fill matches actual harvest`,
      );
      await page.screenshot({ path: path.join(outputDir, `${name}-cutting.png`) });
      await page.keyboard.press("Escape");
      const paused = await readState(page);
      assert.equal(paused.mode, "paused");
      await page.evaluate(() => window.advanceTime(500));
      assert.equal((await readState(page)).elapsedSeconds, paused.elapsedSeconds);
      await page.click("#pause-resume");
      assert.equal((await readState(page)).mode, "active");
      await page.evaluate(() => window.completeContractForDebug());
      await page.waitForFunction(
        () => JSON.parse(window.render_game_to_text()).mode === "complete",
      );
      const completed = await readState(page);
      assert.equal(completed.result.status, "complete");
      assert.equal(completed.flow.focusedElementId, "results-next");
      for (const resource of ["grass", "flowers", "fiber", "wood"]) {
        if (completed.objectives[resource].target <= 0) continue;
        const rowId = resource === "flowers" ? "flower" : resource;
        assert.equal(
          await page.locator(`#hud-row-${rowId}`).getAttribute("data-complete"),
          "true",
          `${name}: ${resource} completed feedback`,
        );
      }
      await page.screenshot({ path: path.join(outputDir, `${name}-complete.png`) });
      assert.deepEqual(errors, [], `${name}: browser errors`);
      summaries.push({
        name,
        environment: moved.presentation.environment,
        shape: moved.meadow.report.arenaShape,
        grassCells: moved.meadow.arenaFloorInstances,
        inventoryAfterMovement: moved.inventory,
        renderer: moved.performance.graphicsAdapter.renderer,
        reducedMotion: moved.accessibility.reducedMotion,
        completionMethod: "debug final-cut fixture (flow verification only)",
        errors,
      });
      console.log(`${name}: passed`);
    } finally {
      await page.close();
    }
  }
  await fs.writeFile(
    path.join(outputDir, "summary.json"),
    `${JSON.stringify(summaries, null, 2)}\n`,
  );
} finally {
  await browser.close();
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}
