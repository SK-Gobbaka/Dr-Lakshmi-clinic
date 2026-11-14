"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/statistics", label: "Statistics" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/slots", label: "Slots & dates" },
  { href: "/admin/patients", label: "Patients" },
  { href: "/admin/audit", label: "Audit log" },
];

/** Scrolls sideways on a phone instead of wrapping to three rows; the current page is marked. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="order-last flex w-full gap-1 overflow-x-auto lg:order-none lg:w-auto lg:flex-1">
      {NAV.map((n) => {
        const on = n.href === "/admin" ? path === n.href : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold ${on ? "bg-primary text-white" : "text-ink hover:bg-sand/60"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
