// A real PostgreSQL server for local development and tests (no Docker, no Supabase account needed).
// The same SQL migrations that run on Supabase run here.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

export const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Starts (and if needed creates) a local PostgreSQL server and returns its connection URL. */
export async function startEmbedded({ dir, port, database = "lakshmi", persistent = true }) {
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent,
    onLog: () => {},
    onError: () => {},
  });
  if (!fs.existsSync(path.join(dir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch (e) {
    if (!/already exists/i.test(String(e?.message ?? e))) throw e;
  }
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/${database}`,
    async stop() {
      let postmaster = 0;
      try {
        postmaster = Number(fs.readFileSync(path.join(dir, "postmaster.pid"), "utf8").split("\n")[0]);
      } catch {
        // already gone
      }
      await pg.stop();
      // On Windows PostgreSQL's helper processes can outlive the server (and one may even start while it shuts down):
      // remove the ones whose parent was this server, twice, a moment apart. Nothing else is touched.
      if (process.platform === "win32" && postmaster > 0) {
        for (let pass = 0; pass < 2; pass++) {
          await new Promise((r) => setTimeout(r, 700));
          spawnSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "ParentProcessId=${postmaster}" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore" });
        }
      }
    },
  };
}
