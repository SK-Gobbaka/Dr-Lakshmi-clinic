import { createUserAction, resetUserPasswordAction, setUserActiveAction, setUserRoleAction } from "@/actions/admin";
import { requireOwner } from "@/lib/admin-auth";
import { listAdminUsers } from "@/lib/auth/users";
import { Notice, PageTitle, btnPlain, btnPrimary, card, fmtStamp, input, label, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const sp = await searchParams;
  const users = await listAdminUsers();

  return (
    <>
      <PageTitle sub="Everyone who signs in has their own account, so the audit log shows who did what. Owners can change everything; staff handle appointments and patients.">Admin accounts</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add an account</h2>
        <form action={createUserAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
          <label className={label}>
            Username
            <input name="username" required minLength={3} maxLength={40} autoComplete="off" className={`${input} mt-1`} />
          </label>
          <label className={label}>
            Password (at least 10 characters, with letters and numbers)
            <input name="password" type="password" required minLength={10} autoComplete="new-password" className={`${input} mt-1`} />
          </label>
          <label className={label}>
            Role
            <select name="role" defaultValue="STAFF" className={`${input} mt-1`}>
              <option value="STAFF">Staff</option>
              <option value="OWNER">Owner</option>
            </select>
          </label>
          <button className={btnPrimary}>Create</button>
        </form>
      </section>

      <div className="space-y-3">
        {users.map((u) => (
          <section key={u.id} className={`${card} p-4 ${u.active ? "" : "opacity-70"}`} aria-label={`Account ${u.username}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {u.username}{" "}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === "OWNER" ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-700"}`}>{u.role === "OWNER" ? "Owner" : "Staff"}</span>
                  {!u.active && <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">Disabled</span>}
                </p>
                <p className="text-xs text-text-secondary">
                  Created {fmtStamp(u.createdAt)} · {u.lastLoginAt ? `last signed in ${fmtStamp(u.lastLoginAt)}` : "never signed in"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={setUserActiveAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="active" value={String(!u.active)} />
                  <button className={`${btnPlain} h-9`}>{u.active ? "Disable" : "Enable"}</button>
                </form>
                <form action={setUserRoleAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="role" value={u.role === "OWNER" ? "STAFF" : "OWNER"} />
                  <button className={`${btnPlain} h-9`}>Make {u.role === "OWNER" ? "staff" : "owner"}</button>
                </form>
              </div>
            </div>
            <form action={resetUserPasswordAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <input type="hidden" name="id" value={u.id} />
              <label className="text-sm font-semibold">
                New password for {u.username}
                <input name="password" type="password" required minLength={10} autoComplete="new-password" className={`${input} mt-1 w-64 max-w-full`} />
              </label>
              <button className={`${btnPlain} h-11`}>Reset password</button>
            </form>
          </section>
        ))}
      </div>
    </>
  );
}
