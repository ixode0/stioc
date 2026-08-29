import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  root: "src",
  base: "./",
  build: {
    outDir: "../compiled/src",
    emptyOutDir: false,
    target: "es2022",
    sourcemap: "inline",
    rollupOptions: {
      input: {
        main: "src/main/Main.ts"
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "src/views/index.html",
          dest: "views"
        }
      ]
    })
  ]
});
