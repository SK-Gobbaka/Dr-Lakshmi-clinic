// Local development database: a real PostgreSQL server kept in .local-data/pg.
//   npm run db:dev      (leave it running in its own terminal, then `npm run dev`)
import path from "node:path";
import { startEmbedded } from "./lib/embedded-db.mjs";
import { migrate } from "./migrate.mjs";

const port = Number(process.env.LOCAL_DB_PORT || 54329);
const db = await startEmbedded({ dir: path.join(process.cwd(), ".local-data", "pg"), port });
await migrate(db.url);

console.log(`\nLocal Postgres is running.\n  DATABASE_URL=${db.url}\nPut that line in .env.local, then run \`npm run dev\`. Press Ctrl+C to stop.\n`);

const stop = async () => {
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
