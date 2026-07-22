import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 550,
  },
  server: {
    host: "127.0.0.1",
    port: 4209,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4209,
    strictPort: true,
  },
});
