import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * Browser tests run against a throw-away database and a private copy of the site (scripts/e2e-server.mjs).
 * They use the Chrome that is already installed (no browser download) and never touch real data.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1, // the tests share one database
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  // outside the project folder, so writing traces and screenshots never looks like a source change to the site's file watcher
  outputDir: path.join(os.tmpdir(), "lakshmi-e2e-results"),
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${PORT}/robots.txt`,
    reuseExistingServer: false,
    timeout: 240_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 20_000 },
    stdout: "pipe",
    stderr: "pipe",
  },
});
