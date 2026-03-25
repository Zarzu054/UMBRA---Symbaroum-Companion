import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@umbra/shared": resolve(__dirname, "../../packages/shared/src/index.ts")
    },
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"]
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      // Docker Desktop on Windows frequently drops FS events on bind mounts.
      // Polling makes HMR deterministic in this setup.
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
      interval: 300
    },
    proxy: {
      "/auth": {
        target: process.env.VITE_API_PROXY ?? "http://api:4000",
        changeOrigin: true
      },
      "/admin": {
        target: process.env.VITE_API_PROXY ?? "http://api:4000",
        changeOrigin: true
      },
      "/health": {
        target: process.env.VITE_API_PROXY ?? "http://api:4000",
        changeOrigin: true
      },
      "/api": {
        target: process.env.VITE_API_PROXY ?? "http://api:4000",
        changeOrigin: true
      }
    }
  }
});
