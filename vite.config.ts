import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { definitionPlugin } from "./server/definition-plugin.ts";
export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      input: {
        main: resolve("index.html"),
        dashboard: resolve("dashboard.html"),
      },
    },
  },
  server: {
    watch: {
      ignored: [
        "**/.qa/**",
        "**/public/models/**",
        "**/public/mediapipe/**",
        "**/public/dictionary/**",
        "**/dist-extension/**",
        "**/release/**",
        "**/extension/licenses/**",
        "**/extension/icons/**",
      ],
    },
  },
  plugins: [
    react(),
    definitionPlugin({
      ...loadEnv(mode, process.cwd(), ""),
      ...process.env,
    } as Record<string, string>),
  ],
}));
