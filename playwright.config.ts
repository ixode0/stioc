import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch: "e2e.ts",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { trace: "on-first-retry" },
});
