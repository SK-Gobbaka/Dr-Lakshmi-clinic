import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// plain JS helpers shared with the dev scripts
import { freePort, startEmbedded } from "../../scripts/lib/embedded-db.mjs";
import { migrate } from "../../scripts/migrate.mjs";

/** One real PostgreSQL server for the whole test run, created from the same migrations Supabase uses. */
export default async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lakshmi-test-pg-"));
  const db = await startEmbedded({ dir, port: await freePort(), persistent: false });
  await migrate(db.url, () => {});
  process.env.DATABASE_URL = db.url;
  process.env.SESSION_SECRET = "test-session-secret-test-session-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  return async () => {
    await db.stop();
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // Windows can keep the folder locked for a moment; it is a temp folder, the OS cleans it up
    }
  };
}
