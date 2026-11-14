import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * TEMPORARY single-admin auth for local use.
 * Defaults to admin / admin123 outside production; in production both the
 * credentials and ADMIN_SESSION_SECRET must come from the environment.
 * shortcut: one account from env, no roles, no lockout, in-memory-free signed cookie.
 * Replace with the AdminUser table from the spec before going live.
 */

const COOKIE = "admin_session";
const MAX_AGE_S = 60 * 60 * 8;
const isProd = process.env.NODE_ENV === "production";

function config() {
  const username = process.env.ADMIN_USERNAME ?? (isProd ? "" : "admin");
  const password = process.env.ADMIN_PASSWORD ?? (isProd ? "" : "admin123");
  const secret = process.env.ADMIN_SESSION_SECRET ?? (isProd ? "" : "dev-only-secret-change-me");
  if (!username || !password || !secret) {
    throw new Error("ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET must be set in production");
  }
  return { username, password, secret };
}

const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");

function safeEqual(a: string, b: string) {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

export function checkCredentials(username: string, password: string): boolean {
  const c = config();
  // evaluate both so timing does not reveal which field was wrong
  const userOk = safeEqual(username, c.username);
  const passOk = safeEqual(password, c.password);
  return userOk && passOk;
}

export async function startSession(username: string) {
  const { secret } = config();
  const expires = Date.now() + MAX_AGE_S * 1000;
  const payload = `${username}.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload, secret)}`, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/admin",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

/** Returns the signed-in admin's username, or null. */
export async function currentAdmin(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  const payload = raw.slice(0, i);
  if (i < 0 || !safeEqual(raw.slice(i + 1), sign(payload, config().secret))) return null;
  const [username, expires] = [payload.slice(0, payload.lastIndexOf(".")), Number(payload.slice(payload.lastIndexOf(".") + 1))];
  return expires > Date.now() ? username : null;
}

/** Call at the top of every admin page and server action. */
export async function requireAdmin(): Promise<string> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
