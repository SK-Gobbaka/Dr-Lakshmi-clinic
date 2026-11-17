"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarDays, ChartColumn, ClipboardList, Clock, History, LayoutDashboard, LogOut, Menu, Stethoscope, Syringe, Tags, Users, X } from "lucide-react";
import { NotificationBell } from "@/components/shared/NotificationBell";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: ClipboardList },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/sessions", label: "Sessions & capacity", icon: Clock },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/admin/treatments", label: "Treatments", icon: Syringe },
  { href: "/admin/statistics", label: "Statistics", icon: ChartColumn },
  { href: "/admin/types", label: "Appointment types", icon: Tags },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminShell({ admin, unread, logout, children }: { admin: string; unread: number; logout: () => Promise<void>; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1.5 p-4">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={active(href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${active(href) ? "bg-primary text-white shadow-sm" : "text-ink hover:bg-sand/70"}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="admin-shell min-h-screen bg-background lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-border bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-border px-6 py-5 font-heading text-lg font-semibold tracking-tight text-ink">Clinic admin</div>
          <div className="flex-1 overflow-y-auto">{nav}</div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="font-heading text-lg font-semibold text-ink">Clinic admin</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sand/60 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell endpoint="/admin/api/notifications" href="/admin/notifications" initialUnread={unread} />
          <span className="hidden text-sm text-text-secondary sm:inline">Signed in as {admin}</span>
          <form action={logout}>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-ink shadow-sm hover:border-primary/30 hover:bg-sand/50">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
