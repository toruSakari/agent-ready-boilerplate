import { defineConfig, devices } from "@playwright/test";

import {
  E2E_SERVER_ORIGINS,
  E2E_SERVER_STARTUP_TIMEOUT_MS,
  E2E_SERVER_SHUTDOWN_TIMEOUT_MS,
} from "@/e2e/server-policy";

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: E2E_SERVER_ORIGINS.business,
    trace: "on-first-retry",
  },
  // E2E用のローカルDBを準備してから3画面とAPIを起動し、実サービスの書き込みを避ける。
  webServer: {
    command: "corepack pnpm db:migrate:local && corepack pnpm db:seed:local && corepack pnpm dev",
    cwd: ".",
    timeout: E2E_SERVER_STARTUP_TIMEOUT_MS,
    url: E2E_SERVER_ORIGINS.business,
    gracefulShutdown: { signal: "SIGTERM", timeout: E2E_SERVER_SHUTDOWN_TIMEOUT_MS },
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
