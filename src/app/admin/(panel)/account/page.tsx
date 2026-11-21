import { changePasswordAction, signOutEverywhereAction } from "@/actions/admin";
import { requireAdminUser } from "@/lib/admin-auth";
import { Notice, PageTitle, btnPlain, btnPrimary, card, fmtStamp, input, label, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: SP }) {
  const user = await requireAdminUser();
  const sp = await searchParams;

  return (
    <>
      <PageTitle sub={`Signed in as ${user.username} (${user.role === "OWNER" ? "owner" : "staff"}). ${user.lastLoginAt ? `Last sign-in ${fmtStamp(user.lastLoginAt)}.` : ""}`}>My account</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mb-6 max-w-lg p-4 sm:p-6`} aria-labelledby="pw-h">
        <h2 id="pw-h" className="font-heading text-lg font-semibold">
          Change password
        </h2>
        <form action={changePasswordAction} className="mt-4 space-y-4">
          <label className={label}>
            Current password
            <input name="current" type="password" required autoComplete="current-password" className={`${input} mt-1`} />
          </label>
          <label className={label}>
            New password (at least 10 characters, with letters and numbers)
            <input name="next" type="password" required minLength={10} autoComplete="new-password" className={`${input} mt-1`} />
          </label>
          <label className={label}>
            New password again
            <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={`${input} mt-1`} />
          </label>
          <button className={btnPrimary}>Change password</button>
        </form>
      </section>

      <section className={`${card} max-w-lg p-4 sm:p-6`} aria-labelledby="out-h">
        <h2 id="out-h" className="font-heading text-lg font-semibold">
          Sign out everywhere
        </h2>
        <p className="mt-1 text-sm text-text-secondary">Ends every session of this account on every device, including this one. Use it if you left yourself signed in somewhere shared.</p>
        <form action={signOutEverywhereAction} className="mt-4">
          <button className={btnPlain}>Sign out of all devices</button>
        </form>
      </section>
    </>
  );
}
