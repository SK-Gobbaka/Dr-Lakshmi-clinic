/**
 * The public address of the site, without a trailing slash. NEXT_PUBLIC_SITE_URL wins; otherwise it is read from
 * the current request's host, so links in messages, the sitemap and the robots file are right even before the
 * setting is added. Outside a request (scripts, tests) it falls back to localhost.
 */
export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  } catch {
    // not inside a request (script or test)
  }
  return "http://localhost:3000";
}
