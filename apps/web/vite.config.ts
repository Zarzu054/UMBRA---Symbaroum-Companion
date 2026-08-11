import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const PDFJS_WASM_ASSETS = ["openjpeg.wasm", "openjpeg_nowasm_fallback.js", "qcms_bg.wasm"] as const;
const PDFJS_WASM_DIRECTORY = resolve(__dirname, "node_modules/pdfjs-dist/wasm");
const PDFJS_WASM_PUBLIC_PATH = "/pdfjs/wasm/";

function pdfJsWasmAssets(): Plugin {
  let isBuild = false;
  return {
    name: "pdfjs-wasm-assets",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    buildStart() {
      if (!isBuild) return;
      for (const fileName of PDFJS_WASM_ASSETS) {
        this.emitFile({
          type: "asset",
          fileName: `pdfjs/wasm/${fileName}`,
          source: readFileSync(resolve(PDFJS_WASM_DIRECTORY, fileName))
        });
      }
    },
    configureServer(server) {
      server.middlewares.use(PDFJS_WASM_PUBLIC_PATH, (request, response, next) => {
        const fileName = decodeURIComponent((request.url ?? "").split("?")[0] ?? "").replace(/^\/+/, "");
        if (!PDFJS_WASM_ASSETS.includes(fileName as (typeof PDFJS_WASM_ASSETS)[number])) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader(
          "Content-Type",
          fileName.endsWith(".wasm") ? "application/wasm" : "application/javascript; charset=utf-8"
        );
        response.end(readFileSync(resolve(PDFJS_WASM_DIRECTORY, fileName)));
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), pdfJsWasmAssets()],
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
