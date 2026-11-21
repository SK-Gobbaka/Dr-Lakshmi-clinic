import { sql } from "./db";

/**
 * Fixed-window rate limiting kept in the database, so it works across every server instance.
 * Returns true while the caller is within `limit` hits per `windowSeconds`.
 */
export async function withinLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const q = sql();
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await q`
    insert into rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  if (Math.random() < 0.02) await q`delete from rate_limits where window_start < now() - interval '2 days'`; // housekeeping
  return row.count <= limit;
}

/** Who is calling, for limits and the sign-in lockout. Cloudflare sets cf-connecting-ip itself; a client cannot forge it. */
export async function clientKey(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  } catch {
    return "local";
  }
}
