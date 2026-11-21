import { spawn } from "node:child_process";

/**
 * Starts the throw-away PostgreSQL server (scripts/e2e-db.mjs, port 54330) before the tests and returns the function
 * Playwright calls when the run ends. scripts/e2e-server.mjs points the site at the same port.
 */
export default async function globalSetup() {
  const child = spawn(process.execPath, ["scripts/e2e-db.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
  await new Promise<void>((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
      if (out.includes("READY")) resolve();
    });
    child.once("exit", (code) => reject(new Error(`The test database stopped early (exit code ${code}). Is port 54330 already in use?`)));
    setTimeout(() => reject(new Error("The test database did not start within two minutes")), 120_000).unref();
  });

  return async () => {
    child.stdin.end(); // the database stops itself when its input closes
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      setTimeout(resolve, 30_000).unref();
    });
    if (child.exitCode === null) child.kill();
  };
}
