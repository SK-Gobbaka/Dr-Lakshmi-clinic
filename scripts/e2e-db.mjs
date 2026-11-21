// A throw-away PostgreSQL server for the browser tests, built from the same migrations Supabase uses.
// tests/e2e/global-setup.ts starts this and waits for the line READY. It stops itself (and deletes its temp
// folder) when its input is closed, which is how the test runner asks it to stop: that also works on Windows,
// and when the runner dies unexpectedly the closed input stops the database too.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startEmbedded } from "./lib/embedded-db.mjs";
import { migrate } from "./migrate.mjs";

const port = Number(process.env.E2E_DB_PORT || 54330);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lakshmi-e2e-pg-"));
const db = await startEmbedded({ dir, port, persistent: false });
await migrate(db.url, () => {});
console.log("READY");

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await db.stop();
  } catch {
    // already stopped
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    // Windows can keep the folder locked for a moment; it is a temp folder
  }
  process.exit(0);
}
process.stdin.resume();
process.stdin.on("end", stop);
process.stdin.on("close", stop);
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
