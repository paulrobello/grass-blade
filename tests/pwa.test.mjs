import fs from "node:fs";

import { describe, expect, it } from "vitest";

const publicManifestPath = new URL("../public/manifest.webmanifest", import.meta.url);
const indexPath = new URL("../index.html", import.meta.url);
const mainPath = new URL("../src/main.ts", import.meta.url);
const serviceWorkerPath = new URL("../public/service-worker.js", import.meta.url);

describe("mobile PWA install metadata", () => {
  it("ships fullscreen install metadata for mobile browsers", () => {
    const indexHtml = fs.readFileSync(indexPath, "utf8");

    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#67c84a" />');
    expect(indexHtml).toContain('<meta name="mobile-web-app-capable" content="yes" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(indexHtml).toContain(
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    );
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/pwa-icon-180.png" />');
  });

  it("defines a fullscreen manifest with installable raster and maskable icons", () => {
    const manifest = JSON.parse(fs.readFileSync(publicManifestPath, "utf8"));
    const iconBySrc = new Map(manifest.icons.map((icon) => [icon.src, icon]));

    expect(manifest.name).toBe("Grass Blade");
    expect(manifest.short_name).toBe("Grass Blade");
    expect(manifest.start_url).toBe("/?source=pwa");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("fullscreen");
    expect(manifest.display_override).toContain("fullscreen");
    expect(manifest.orientation).toBe("portrait-primary");
    expect(iconBySrc.get("/pwa-icon-192.png")).toMatchObject({
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    });
    expect(iconBySrc.get("/pwa-icon-512.png")).toMatchObject({
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    });
    expect(iconBySrc.get("/pwa-maskable-icon-512.png")).toMatchObject({
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    });
  });

  it("provides an update-safe service worker for installed clients", () => {
    const mainSource = fs.readFileSync(mainPath, "utf8");
    const serviceWorkerSource = fs.readFileSync(serviceWorkerPath, "utf8");

    expect(mainSource).toContain('updateViaCache: "none"');
    expect(serviceWorkerSource).toContain('self.addEventListener("install"');
    expect(serviceWorkerSource).toContain("self.skipWaiting()");
    expect(serviceWorkerSource).toContain('const CACHE_NAME = "grass-blade-v4"');
    expect(serviceWorkerSource).toContain('const CACHE_PREFIX = "grass-blade-"');
    expect(serviceWorkerSource).toContain("key.startsWith(CACHE_PREFIX)");
    expect(serviceWorkerSource).toContain("caches.delete(key)");
    expect(serviceWorkerSource).toContain('self.addEventListener("fetch"');
    expect(serviceWorkerSource).toContain('event.request.mode === "navigate"');
    expect(serviceWorkerSource).toContain('requestUrl.pathname.startsWith("/assets/")');
    expect(serviceWorkerSource).toContain("event.respondWith(networkFirst(event.request))");
    expect(serviceWorkerSource).not.toContain('"./index.html"');
  });
});
