import "./styles.css";

import { Game } from "./game/Game";

window.__grassBladeReady = false;

const canvas = document.querySelector("#game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Grass Blade requires a #game-canvas HTMLCanvasElement.");
}

const seedParameter = new URLSearchParams(window.location.search).get("seed");
const parsedSeed = seedParameter === null ? Number.NaN : Number(seedParameter);
const seed =
  Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 0xffffffff
    ? parsedSeed
    : undefined;

const game = new Game(canvas, seed);
game.start();

window.addEventListener("pagehide", () => game.dispose(), { once: true });
