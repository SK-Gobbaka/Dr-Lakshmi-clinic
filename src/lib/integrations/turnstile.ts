import { env } from "../env";
import { log } from "../logger";

/**
 * Cloudflare Turnstile (a free CAPTCHA replacement). Create a widget in the Cloudflare dashboard, then set
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY. Until both are set the check is skipped, so the
 * booking form still works while you are setting things up.
 */
export const turnstileEnabled = () => !!(env().TURNSTILE_SECRET_KEY && env().NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<{ ok: boolean; skipped: boolean }> {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (!token) return { ok: false, skipped: false };
  try {
    const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "local") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const json = (await res.json()) as { success?: boolean };
    return { ok: !!json.success, skipped: false };
  } catch (err) {
    log.error("turnstile.unreachable", err);
    return { ok: false, skipped: false }; // fail closed: a bot check that cannot run must not wave everyone through
  }
}
