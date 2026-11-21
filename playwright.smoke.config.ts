import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Smoke test against a site that is ALREADY running: the local Workers preview (`npm run preview`), a staging copy, or
 * production. It starts nothing. It makes one test booking and cancels it, so point it only at a database where that
 * is acceptable (never real patients' production data without the owner's say-so).
 *
 *   SMOKE_BASE_URL=http://localhost:8787 ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run test:smoke
 */
export default defineConfig({
  testDir: "tests/smoke",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  outputDir: path.join(os.tmpdir(), "lakshmi-smoke-results"),
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://localhost:8787",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
