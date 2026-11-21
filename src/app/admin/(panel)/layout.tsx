import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminLogout } from "@/actions/admin";
import { currentAdminUser } from "@/lib/admin-auth";
import { isDatabaseDown } from "@/lib/db";
import { log } from "@/lib/logger";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await currentAdminUser();
  } catch (err) {
    if (!isDatabaseDown(err)) throw err;
    log.error("admin.database_down", err);
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
          <h1 className="font-heading text-xl font-semibold">The database cannot be reached</h1>
          <p className="mt-2 text-sm">
            The admin portal needs its database (Supabase) and cannot connect right now. Check that the project is running and that the <code>DATABASE_URL</code> setting is correct, then reload this page.
          </p>
          <a href="/admin" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
            Reload
          </a>
        </div>
      </main>
    );
  }
  if (!user) redirect("/admin/login");
  return (
    <AdminShell admin={user.username} role={user.role} logout={adminLogout}>
      {children}
    </AdminShell>
  );
}
