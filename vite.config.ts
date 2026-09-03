import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "src/views",
  base: "./",
  publicDir: resolve(__dirname, "public"),
  build: {
    outDir: "../../compiled/src/views",
    emptyOutDir: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: resolve(__dirname, "src/views/index.html"),
    },
  },
  worker: {
    format: "es",
  },
});
