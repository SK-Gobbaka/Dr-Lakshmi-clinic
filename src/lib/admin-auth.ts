import * as React from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isProduction, sessionSecret } from "./env";
import { getAdminUser, type AdminUser, type Role } from "./auth/users";

/**
 * Admin sign-in. The browser holds a signed cookie that names the account and its session version; every
 * request looks the account up again, so disabling an account or changing its password signs it out at once.
 * Passwords are stored hashed in the admin_users table (see auth/users.ts).
 */
const COOKIE = "admin_session";
const MAX_AGE_S = 60 * 60 * 8;

const memo = <T,>(fn: () => Promise<T>): (() => Promise<T>) => {
  const cache = (React as unknown as { cache?: <F extends () => unknown>(f: F) => F }).cache;
  return typeof cache === "function" ? cache(fn) : fn;
};

// The "admin-session:" prefix means this signature can never be confused with another use of the same secret.
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(`admin-session:${value}`).digest("hex");

function equal(a: string, b: string) {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

export class SessionSecretMissingError extends Error {
  constructor() {
    super("SESSION_SECRET is not set (use a random string of 32 or more characters).");
  }
}

function secret(): string {
  const s = sessionSecret();
  if (!s || s.length < 32) throw new SessionSecretMissingError();
  return s;
}

export async function startSession(user: AdminUser) {
  const expires = Date.now() + MAX_AGE_S * 1000;
  const payload = `${user.id}.${user.sessionVersion}.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload, secret())}`, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/admin",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

/** The signed-in account, or null. Looked up once per request. */
export const currentAdminUser = memo(async (): Promise<AdminUser | null> => {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const s = sessionSecret();
  if (!s || s.length < 32) return null;
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const payload = raw.slice(0, i);
  if (!equal(raw.slice(i + 1), sign(payload, s))) return null;
  const [id, version, expires] = payload.split(".");
  if (!id || Number(expires) <= Date.now()) return null;
  const user = await getAdminUser(id);
  return user && user.active && user.sessionVersion === Number(version) ? user : null;
});

/** Username of the signed-in admin, or null. */
export async function currentAdmin(): Promise<string | null> {
  return (await currentAdminUser())?.username ?? null;
}

/** Call at the top of every admin page, route and server action. Returns the signed-in account. */
export async function requireAdminUser(): Promise<AdminUser> {
  const user = await currentAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Like requireAdminUser, but returns just the username (used as the "who did it" in the audit log). */
export async function requireAdmin(): Promise<string> {
  return (await requireAdminUser()).username;
}

/** Owner-only pages and actions. Staff accounts are sent back to the dashboard with a message. */
export async function requireOwner(): Promise<string> {
  const user = await requireAdminUser();
  if (user.role !== "OWNER") redirect(`/admin?error=${encodeURIComponent("Only an owner account can open that area.")}`);
  return user.username;
}

/** For route handlers (downloads, JSON): the signed-in account, or a ready-made 401/403 response. */
export async function routeAuth(role: Role = "STAFF"): Promise<{ user: AdminUser; denied?: undefined } | { user?: undefined; denied: Response }> {
  const user = await currentAdminUser();
  const headers = { "Cache-Control": "no-store" };
  if (!user) return { denied: new Response("Sign in required", { status: 401, headers }) };
  if (role === "OWNER" && user.role !== "OWNER") return { denied: new Response("Only an owner account can do this", { status: 403, headers }) };
  return { user };
}
