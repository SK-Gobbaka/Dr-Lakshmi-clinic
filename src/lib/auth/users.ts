import { sql } from "../db";
import { env } from "../env";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

export type Role = "OWNER" | "STAFF";

export interface AdminUser {
  id: string;
  username: string;
  role: Role;
  active: boolean;
  sessionVersion: number;
  createdAt: string;
  lastLoginAt: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromRow = (r: any): AdminUser => ({
  id: r.id,
  username: r.username,
  role: r.role,
  active: r.active,
  sessionVersion: r.sessionVersion,
  createdAt: (r.createdAt as Date).toISOString(),
  lastLoginAt: r.lastLoginAt ? (r.lastLoginAt as Date).toISOString() : null,
});

const COLUMNS = "id, username, role, active, session_version, created_at, last_login_at";
type Out = { ok: true } | { ok: false; error: string };

const audit = (actor: string, action: string, summary: string, entityId?: string) =>
  sql()`insert into audit_log (actor, action, entity_id, summary) values (${actor}, ${action}, ${entityId ?? null}, ${summary})`;

let dummyHash: Promise<string> | undefined;

/**
 * Checks a username and password. Always does one hash comparison, even for an unknown user, so response
 * time does not reveal which usernames exist. When no admin exists yet, the ADMIN_USERNAME / ADMIN_PASSWORD
 * settings create the first owner account (the password is stored hashed, never as given).
 */
export async function authenticate(username: string, password: string): Promise<AdminUser | null> {
  const q = sql();
  const name = username.trim();
  const [row] = await q`select ${q.unsafe(COLUMNS)}, password_hash from admin_users where lower(username) = lower(${name})`;
  if (!row) {
    const [{ n }] = await q`select count(*)::int as n from admin_users`;
    const e = env();
    if (n === 0 && e.ADMIN_USERNAME && e.ADMIN_PASSWORD && !usernameProblem(name) && name === e.ADMIN_USERNAME && password === e.ADMIN_PASSWORD) {
      const [created] = await q`insert into admin_users (username, password_hash, role) values (${name}, ${await hashPassword(password)}, 'OWNER')
                                on conflict do nothing returning ${q.unsafe(COLUMNS)}`;
      if (created) {
        await audit(name, "user.bootstrap", `First owner account "${name}" created from the ADMIN_USERNAME setting`, created.id);
        await q`update admin_users set last_login_at = now() where id = ${created.id}`;
        return fromRow(created);
      }
    }
    await verifyPassword(password, await (dummyHash ??= hashPassword("not-a-real-password")));
    return null;
  }
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok || !row.active) return null;
  await q`update admin_users set last_login_at = now() where id = ${row.id}`;
  return fromRow(row);
}

export async function getAdminUser(id: string): Promise<AdminUser | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const q = sql();
  const [row] = await q`select ${q.unsafe(COLUMNS)} from admin_users where id = ${id}`;
  return row ? fromRow(row) : null;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const q = sql();
  return (await q`select ${q.unsafe(COLUMNS)} from admin_users order by role, lower(username)`).map(fromRow);
}

// "patient" and "system" are the names the audit log uses for the public booking form and automatic jobs.
const RESERVED = new Set(["patient", "system"]);
const usernameProblem = (u: string) =>
  !/^[a-zA-Z0-9._-]{3,40}$/.test(u) ? "Usernames are 3 to 40 letters, numbers, dots, dashes or underscores." : RESERVED.has(u.toLowerCase()) ? "That username is reserved. Choose another." : null;

export async function createAdminUser(input: { username: string; password: string; role: Role }, by: string): Promise<Out> {
  const username = input.username.trim();
  const problem = usernameProblem(username) ?? passwordProblem(input.password, username);
  if (problem) return { ok: false, error: problem };
  const q = sql();
  const [made] = await q`insert into admin_users (username, password_hash, role) values (${username}, ${await hashPassword(input.password)}, ${input.role})
                         on conflict do nothing returning id`;
  if (!made) return { ok: false, error: "That username is already taken." };
  await audit(by, "user.create", `Created ${input.role.toLowerCase()} account "${username}"`, made.id);
  return { ok: true };
}

/** A user changing their own password. Signs out every other session. */
export async function changeOwnPassword(userId: string, current: string, next: string): Promise<Out> {
  const q = sql();
  const [row] = await q`select username, password_hash from admin_users where id = ${userId}`;
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { ok: false, error: "The current password is not correct." };
  const problem = passwordProblem(next, row.username);
  if (problem) return { ok: false, error: problem };
  await q`update admin_users set password_hash = ${await hashPassword(next)}, session_version = session_version + 1 where id = ${userId}`;
  await audit(row.username, "user.password", "Changed own password", userId);
  return { ok: true };
}

/** An owner setting a new password for someone else. */
export async function resetPassword(userId: string, next: string, by: string): Promise<Out> {
  const q = sql();
  const [row] = await q`select username from admin_users where id = ${userId}`;
  if (!row) return { ok: false, error: "User not found." };
  const problem = passwordProblem(next, row.username);
  if (problem) return { ok: false, error: problem };
  await q`update admin_users set password_hash = ${await hashPassword(next)}, session_version = session_version + 1 where id = ${userId}`;
  await audit(by, "user.password_reset", `Reset the password of "${row.username}"`, userId);
  return { ok: true };
}

/** Turns an account on or off. The last active owner can never be turned off. */
export async function setUserActive(userId: string, active: boolean, by: string): Promise<Out> {
  const q = sql();
  const [row] = await q`select username, role, active from admin_users where id = ${userId}`;
  if (!row) return { ok: false, error: "User not found." };
  if (!active && row.role === "OWNER" && row.active) {
    const [{ n }] = await q`select count(*)::int as n from admin_users where role = 'OWNER' and active and id <> ${userId}`;
    if (n === 0) return { ok: false, error: "There must be at least one active owner." };
  }
  await q`update admin_users set active = ${active}, session_version = session_version + 1 where id = ${userId}`;
  await audit(by, active ? "user.enable" : "user.disable", `${active ? "Enabled" : "Disabled"} account "${row.username}"`, userId);
  return { ok: true };
}

export async function setUserRole(userId: string, role: Role, by: string): Promise<Out> {
  const q = sql();
  const [row] = await q`select username, role, active from admin_users where id = ${userId}`;
  if (!row) return { ok: false, error: "User not found." };
  if (row.role === "OWNER" && role !== "OWNER" && row.active) {
    const [{ n }] = await q`select count(*)::int as n from admin_users where role = 'OWNER' and active and id <> ${userId}`;
    if (n === 0) return { ok: false, error: "There must be at least one active owner." };
  }
  await q`update admin_users set role = ${role}, session_version = session_version + 1 where id = ${userId}`;
  await audit(by, "user.role", `Changed "${row.username}" to ${role.toLowerCase()}`, userId);
  return { ok: true };
}

/** Ends every session of one account (all browsers). */
export async function signOutEverywhere(userId: string) {
  await sql()`update admin_users set session_version = session_version + 1 where id = ${userId}`;
}

// ---------- sign-in lockout ----------

const MAX_FAILS = 5;
const WINDOW_MINUTES = 15;

/** False once a client has failed 5 sign-ins within 15 minutes. */
export async function loginAllowed(client: string): Promise<boolean> {
  const [row] = await sql()`select count from login_failures where client = ${client} and first_at > now() - make_interval(mins => ${WINDOW_MINUTES})`;
  return !row || row.count < MAX_FAILS;
}

export async function recordLoginFailure(client: string) {
  const q = sql();
  await q`delete from login_failures where first_at <= now() - make_interval(mins => ${WINDOW_MINUTES})`;
  await q`insert into login_failures (client, count, first_at) values (${client}, 1, now())
          on conflict (client) do update set count = login_failures.count + 1`;
}

export async function clearLoginFailures(client: string) {
  await sql()`delete from login_failures where client = ${client}`;
}
