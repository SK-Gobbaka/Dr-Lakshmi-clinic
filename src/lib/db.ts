import postgres from "postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The PostgreSQL connection (Supabase in production).
 *
 * DATABASE_URL is the connection string from Supabase > Project Settings > Database. Use the pooler
 * ("Transaction", port 6543) string. Locally it points at the embedded Postgres started by `npm run db:dev`.
 */
export type Q = postgres.Sql<Record<string, never>>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Add the Supabase connection string (see .env.example).");
    this.name = "DatabaseNotConfiguredError";
  }
}

/** True when the database cannot be reached or is not configured: the app should answer 503, not 500. */
export function isDatabaseDown(e: unknown): boolean {
  if (e instanceof DatabaseNotConfiguredError) return true;
  const code = (e as { code?: string })?.code ?? "";
  return /^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_DESTROYED|CONNECTION_ENDED|57P0[1-3]|08\d{3}|53300)$/.test(code);
}

const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function connect(): Q {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return postgres(url, {
    max: onWorkers ? 1 : 10, // a Worker request holds one connection; a Node server shares a small pool
    prepare: false, // required by the Supabase transaction pooler
    fetch_types: false, // saves a round trip per connection; array columns are read with to_jsonb()
    connect_timeout: 10,
    idle_timeout: 20,
    ssl: local ? false : "require",
    onnotice: () => {},
    // dates stay plain "yyyy-MM-dd" strings; column names are camelCase in code and snake_case in SQL
    types: { date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x } },
    transform: { column: { to: postgres.fromCamel, from: postgres.toCamel } },
  }) as unknown as Q;
}

let shared: Q | undefined;
const perRequest = new WeakMap<object, Q>();

/**
 * The database client. A Node server keeps one pool for its lifetime. A Cloudflare Worker may not reuse
 * sockets between requests, so each request gets its own client (the runtime closes it when the request ends).
 */
export function sql(): Q {
  if (!onWorkers) return (shared ??= connect());
  const { ctx } = getCloudflareContext();
  let client = perRequest.get(ctx);
  if (!client) perRequest.set(ctx, (client = connect()));
  return client;
}

/** Closes the shared pool (tests and scripts). */
export async function closeDb() {
  const s = shared;
  shared = undefined;
  await s?.end({ timeout: 5 });
}
