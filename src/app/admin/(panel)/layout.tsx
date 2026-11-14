import type { Metadata } from "next";
import { adminLogout } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { listNotifications } from "@/lib/local-store";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const unread = listNotifications({ audience: "ADMIN" }, 1000).filter((n) => !n.readAt).length;
  return (
    <AdminShell admin={admin} unread={unread} logout={adminLogout}>
      {children}
    </AdminShell>
  );
}
