/**
 * Entry point of the deployed Cloudflare Worker (wrangler.jsonc "main").
 * It is the OpenNext handler that serves the website, plus a scheduled job: every 15 minutes Cloudflare calls
 * `scheduled`, which asks the site's own /api/cron/reminders route to send due appointment reminders.
 */
interface Env {
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
interface Ctx {
  waitUntil(work: Promise<unknown>): void;
}

// The generated handler only exists after `opennextjs-cloudflare build`, so its types are not available here.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import openNext from "./.open-next/worker.js";

const worker = {
  fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    return openNext.fetch(request, env, ctx);
  },

  async scheduled(_event: unknown, env: Env, ctx: Ctx): Promise<void> {
    if (!env.CRON_SECRET) {
      console.warn(JSON.stringify({ level: "warn", event: "cron.skipped", error: "CRON_SECRET is not set, so reminders are not sent" }));
      return;
    }
    const origin = (env.NEXT_PUBLIC_SITE_URL ?? "https://reminders.internal").replace(/\/$/, "");
    const call = openNext.fetch(new Request(`${origin}/api/cron/reminders`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }), env, ctx).then(
      async (res: Response) => {
        if (!res.ok) console.error(JSON.stringify({ level: "error", event: "cron.failed", status: res.status }));
      },
      (err: unknown) => console.error(JSON.stringify({ level: "error", event: "cron.error", error: String(err) }))
    );
    ctx.waitUntil(call);
  },
};

export default worker;

// Durable Object classes that OpenNext generates must be exported from the entry point.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
