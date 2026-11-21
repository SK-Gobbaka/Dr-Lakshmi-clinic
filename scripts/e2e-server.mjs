// Builds the website and serves it on port 3100 for the browser tests, pointed at the throw-away database that
// tests/e2e/global-setup.ts starts (port 54330). Nothing here touches real data.
// Playwright starts this through `webServer` in playwright.config.ts and stops it when the run ends.
// Set E2E_SKIP_BUILD=1 to reuse the last build when only the tests changed.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const PORT = process.env.E2E_PORT || "3100";
const DB_PORT = process.env.E2E_DB_PORT || "54330";
const next = path.join("node_modules", "next", "dist", "bin", "next");

const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/lakshmi`,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  // test-only values for the throw-away database (the same ones are in tests/e2e/helpers.ts)
  SESSION_SECRET: "e2e-session-secret-not-used-anywhere-else-0123456789",
  ADMIN_USERNAME: "e2e-owner",
  ADMIN_PASSWORD: "E2e-Owner-Pass-123",
  CRON_SECRET: "e2e-cron-secret",
  // make sure no real connection is used by accident (blank means "not set")
  WHATSAPP_PHONE_NUMBER_ID: "",
  WHATSAPP_ACCESS_TOKEN: "",
  RESEND_API_KEY: "",
  TURNSTILE_SECRET_KEY: "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
};

if (!process.env.E2E_SKIP_BUILD) {
  const built = spawnSync(process.execPath, [next, "build"], { stdio: "inherit", env });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

const child = spawn(process.execPath, [next, "start", "-p", PORT], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 1));
