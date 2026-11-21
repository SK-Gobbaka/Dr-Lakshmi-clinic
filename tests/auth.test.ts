import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authenticate,
  changeOwnPassword,
  clearLoginFailures,
  createAdminUser,
  getAdminUser,
  listAdminUsers,
  loginAllowed,
  recordLoginFailure,
  resetPassword,
  setUserActive,
  setUserRole,
} from "../src/lib/auth/users";
import { closeDb, sql } from "../src/lib/db";
import { withinLimit } from "../src/lib/rate-limit";
import { resetDb } from "./helpers/db";

const saved = { ...process.env };
beforeEach(async () => {
  await resetDb();
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});
afterAll(closeDb);

const PW = "Strong-Pass-2026";
const idOf = async (username: string) => (await listAdminUsers()).find((u) => u.username === username)!.id;

describe("first owner", () => {
  it("is created from the ADMIN_USERNAME setting on the first sign-in, with a hashed password", async () => {
    process.env.ADMIN_USERNAME = "boss";
    process.env.ADMIN_PASSWORD = PW;
    expect(await authenticate("boss", "wrong-password-1")).toBeNull(); // nothing is created for a wrong password
    expect(await listAdminUsers()).toHaveLength(0);

    const user = await authenticate("boss", PW);
    expect(user).toMatchObject({ username: "boss", role: "OWNER", active: true });
    const [row] = await sql()`select password_hash from admin_users where username = 'boss'`;
    expect(row.passwordHash).toMatch(/^pbkdf2-sha512\$/);
    expect(row.passwordHash).not.toContain(PW);
  });

  it("stops working once an account exists, so the setting cannot mint more owners", async () => {
    process.env.ADMIN_USERNAME = "boss";
    process.env.ADMIN_PASSWORD = PW;
    await authenticate("boss", PW);
    process.env.ADMIN_USERNAME = "second";
    expect(await authenticate("second", PW)).toBeNull();
    expect(await listAdminUsers()).toHaveLength(1);
  });

  it("never lets the setting create an account with a reserved name", async () => {
    process.env.ADMIN_USERNAME = "patient";
    process.env.ADMIN_PASSWORD = PW;
    expect(await authenticate("patient", PW)).toBeNull();
    expect(await listAdminUsers()).toHaveLength(0);
  });
});

describe("accounts", () => {
  it("refuses weak passwords, reserved names and duplicates (case does not matter)", async () => {
    expect(await createAdminUser({ username: "asha", password: "weak", role: "STAFF" }, "owner")).toMatchObject({ ok: false });
    expect(await createAdminUser({ username: "patient", password: PW, role: "STAFF" }, "owner")).toMatchObject({ ok: false, error: expect.stringMatching(/reserved/) });
    expect(await createAdminUser({ username: "a b", password: PW, role: "STAFF" }, "owner")).toMatchObject({ ok: false });
    expect(await createAdminUser({ username: "Asha", password: PW, role: "STAFF" }, "owner")).toEqual({ ok: true });
    expect(await createAdminUser({ username: "asha", password: PW, role: "STAFF" }, "owner")).toMatchObject({ ok: false, error: expect.stringMatching(/taken/) });
  });

  it("signs in with the right password only, ignoring the case of the username", async () => {
    await createAdminUser({ username: "Asha", password: PW, role: "STAFF" }, "owner");
    expect((await authenticate("asha", PW))?.username).toBe("Asha");
    expect(await authenticate("asha", "Wrong-Pass-2026")).toBeNull();
    expect(await authenticate("nobody", PW)).toBeNull();
  });

  it("a disabled account cannot sign in and its sessions are invalidated", async () => {
    await createAdminUser({ username: "asha", password: PW, role: "STAFF" }, "owner");
    const id = await idOf("asha");
    const before = (await getAdminUser(id))!.sessionVersion;
    expect(await setUserActive(id, false, "owner")).toEqual({ ok: true });
    expect(await authenticate("asha", PW)).toBeNull();
    const after = (await getAdminUser(id))!;
    expect(after.active).toBe(false);
    expect(after.sessionVersion).toBeGreaterThan(before); // a cookie holding the old version no longer matches
  });

  it("changing or resetting a password ends the other sessions and the old password stops working", async () => {
    await createAdminUser({ username: "asha", password: PW, role: "STAFF" }, "owner");
    const id = await idOf("asha");
    const v0 = (await getAdminUser(id))!.sessionVersion;

    expect(await changeOwnPassword(id, "Not-The-Password-1", "Another-Pass-2027")).toMatchObject({ ok: false });
    expect(await changeOwnPassword(id, PW, "short")).toMatchObject({ ok: false });
    expect(await changeOwnPassword(id, PW, "Another-Pass-2027")).toEqual({ ok: true });
    expect(await authenticate("asha", PW)).toBeNull();
    expect((await authenticate("asha", "Another-Pass-2027"))?.username).toBe("asha");
    const v1 = (await getAdminUser(id))!.sessionVersion;
    expect(v1).toBeGreaterThan(v0);

    expect(await resetPassword(id, "Reset-By-Owner-1", "owner")).toEqual({ ok: true });
    expect((await getAdminUser(id))!.sessionVersion).toBeGreaterThan(v1);
    expect((await authenticate("asha", "Reset-By-Owner-1"))?.username).toBe("asha");
  });

  it("always keeps at least one active owner", async () => {
    await createAdminUser({ username: "boss", password: PW, role: "OWNER" }, "setup");
    const boss = await idOf("boss");
    expect(await setUserActive(boss, false, "boss")).toMatchObject({ ok: false, error: expect.stringMatching(/at least one active owner/) });
    expect(await setUserRole(boss, "STAFF", "boss")).toMatchObject({ ok: false });

    await createAdminUser({ username: "second", password: PW, role: "OWNER" }, "boss");
    expect(await setUserRole(boss, "STAFF", "second")).toEqual({ ok: true });
    const second = await idOf("second");
    expect(await setUserActive(second, false, "second")).toMatchObject({ ok: false }); // now the only owner
  });

  it("records who did what in the audit log, without passwords", async () => {
    await createAdminUser({ username: "asha", password: PW, role: "STAFF" }, "boss");
    const rows = await sql()`select actor, action, summary from audit_log`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: "boss", action: "user.create" });
    expect(JSON.stringify(rows)).not.toContain(PW);
  });
});

describe("sign-in lockout and rate limits", () => {
  it("locks a client out after five failures and releases it when cleared", async () => {
    for (let i = 0; i < 4; i++) await recordLoginFailure("1.2.3.4");
    expect(await loginAllowed("1.2.3.4")).toBe(true);
    await recordLoginFailure("1.2.3.4");
    expect(await loginAllowed("1.2.3.4")).toBe(false);
    expect(await loginAllowed("5.6.7.8")).toBe(true); // other clients are unaffected
    await clearLoginFailures("1.2.3.4");
    expect(await loginAllowed("1.2.3.4")).toBe(true);
  });

  it("lets a failed client back in after the 15-minute window", async () => {
    for (let i = 0; i < 5; i++) await recordLoginFailure("9.9.9.9");
    expect(await loginAllowed("9.9.9.9")).toBe(false);
    await sql()`update login_failures set first_at = now() - interval '16 minutes' where client = '9.9.9.9'`;
    expect(await loginAllowed("9.9.9.9")).toBe(true);
  });

  it("counts requests per key and window", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await withinLimit("test:key", 3, 86_400));
    expect(results).toEqual([true, true, true, false, false]);
    expect(await withinLimit("test:other", 3, 86_400)).toBe(true); // keys are independent
  });

  it("allows many parallel callers to be counted exactly", async () => {
    const hits = await Promise.all(Array.from({ length: 20 }, () => withinLimit("test:parallel", 10, 86_400)));
    expect(hits.filter(Boolean)).toHaveLength(10);
  });
});
