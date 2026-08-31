import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src/views",
  base: "./",
  build: {
    outDir: "../../compiled/src/views",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/views/index.html"),
      output: {
        manualChunks: {
          xterm: ["@xterm/xterm", "@xterm/addon-search", "@xterm/addon-unicode-graphemes", "@xterm/addon-webgl"],
          monaco: ["monaco-editor"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
