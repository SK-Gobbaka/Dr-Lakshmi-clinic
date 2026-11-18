import type { Metadata } from "next";
import { adminLogout } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell admin={admin} logout={adminLogout}>
      {children}
    </AdminShell>
  );
}
