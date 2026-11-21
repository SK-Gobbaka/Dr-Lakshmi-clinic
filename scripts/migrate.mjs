// Applies the SQL files in supabase/migrations to DATABASE_URL, once each, in order.
//   npm run db:migrate
// On Supabase you can use `supabase db push` instead; the files are the same.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

export async function migrate(url, log = console.log) {
  const sql = postgres(url, { max: 1, onnotice: () => {}, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : "require" });
  try {
    await sql`create table if not exists app_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql`select name from app_migrations`).map((r) => r.name));
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      await sql.begin(async (t) => {
        await t.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
        await t`insert into app_migrations (name) values (${file})`;
      });
      log(`applied ${file}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("migrate.mjs")) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }
  migrate(url)
    .then(() => console.log("database is up to date"))
    .catch((e) => {
      console.error("migration failed:", e.message);
      process.exit(1);
    });
}
