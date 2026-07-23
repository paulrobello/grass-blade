import "./styles.css";

import { Game } from "./game/Game";

window.__grassBladeReady = false;
document.documentElement.dataset.displayMode = resolveDisplayMode();

const canvas = document.querySelector("#game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Grass Blade requires a #game-canvas HTMLCanvasElement.");
}

const seedParameter = new URLSearchParams(window.location.search).get("seed");
const contractParameter = new URLSearchParams(window.location.search).get("contract");
const parsedSeed = seedParameter === null ? Number.NaN : Number(seedParameter);
const seed =
  Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 0xffffffff
    ? parsedSeed
    : undefined;

const game = new Game(canvas, seed, contractParameter);
game.start();
registerServiceWorker();

window.addEventListener("pagehide", () => game.dispose(), { once: true });

function resolveDisplayMode(): "browser" | "standalone" {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  if (
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  ) {
    return "standalone";
  }

  return "browser";
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD) {
    return;
  }
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener(
    "load",
    () => {
      const hadController = navigator.serviceWorker.controller !== null;
      let reloadedForControllerUpdate = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloadedForControllerUpdate) {
          return;
        }
        reloadedForControllerUpdate = true;
        window.location.reload();
      });

      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => registration.update())
        .catch((error: unknown) => {
          console.warn("Grass Blade service worker registration failed", error);
        });
    },
    { once: true },
  );
}
