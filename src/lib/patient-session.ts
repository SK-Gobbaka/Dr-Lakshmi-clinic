import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The site has no patient accounts. A browser remembers the appointments it booked
 * in a signed httpOnly cookie (list of confirmation tokens), which powers "My
 * appointments" and the notification bell. The cookie cannot be forged or edited
 * client-side, and holding it is the same authority as holding the WhatsApp link.
 */
const COOKIE = "my_bookings";
const MAX_AGE_S = 60 * 60 * 24 * 365;
const MAX_TOKENS = 100;
const isProd = process.env.NODE_ENV === "production";

const secret = () => process.env.ADMIN_SESSION_SECRET ?? (isProd ? "" : "dev-only-secret-change-me");
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

function equal(a: string, b: string) {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

export async function myTokens(): Promise<string[]> {
  if (!secret()) return [];
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  const i = raw.lastIndexOf(".");
  if (i < 0) return [];
  const payload = raw.slice(0, i);
  if (!equal(raw.slice(i + 1), sign(payload))) return [];
  try {
    const list = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Array.isArray(list) ? list.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/** Only call from a server action or route handler (it sets a cookie). */
export async function rememberToken(token: string) {
  if (!secret()) return;
  const list = [token, ...(await myTokens()).filter((t) => t !== token)].slice(0, MAX_TOKENS);
  const payload = Buffer.from(JSON.stringify(list)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}
