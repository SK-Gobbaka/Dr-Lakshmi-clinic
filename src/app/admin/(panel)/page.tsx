import Link from "next/link";
import { AlertTriangle, Plug } from "lucide-react";
import { requireAdminUser } from "@/lib/admin-auth";
import { appointmentLabel, dashboardStats, listDoctors, listTypes, needsAttentionCount, recentBookings } from "@/lib/clinic";
import { getSiteSettings } from "@/lib/content";
import { integrationStatus } from "@/lib/env";
import { AddAppointmentDialog } from "@/components/admin/AddAppointmentDialog";
import { Empty, Notice, PageTitle, StatusBadge, card, fmtDate, fmtTime, one, type SP } from "../ui";

export const dynamic = "force-dynamic";

function Tile({ label, value, href, tone }: { label: string; value: number; href: string; tone?: string }) {
  return (
    <Link href={href} className={`${card} block p-4 transition-colors hover:border-primary`}>
      <div className={`font-heading text-3xl font-semibold ${tone ?? "text-ink"}`}>{value}</div>
      <div className="text-sm text-text-secondary">{label}</div>
    </Link>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const user = await requireAdminUser();
  const sp = await searchParams;
  const [{ overall, today }, attention, recent, types, doctors, site] = await Promise.all([
    dashboardStats(),
    needsAttentionCount(),
    recentBookings(8),
    listTypes({ activeOnly: true }),
    listDoctors({ publishedOnly: true }),
    getSiteSettings(),
  ]);
  const owner = user.role === "OWNER";
  // What still needs setting up before the clinic goes live: only shown to owners.
  const todo = owner
    ? [
        ...integrationStatus().filter((i) => !i.configured && (i.required || i.key === "turnstile" || i.key === "whatsapp")).map((i) => ({ text: `${i.name} is not connected yet`, href: "/admin/integrations" })),
        ...(site.phone ? [] : [{ text: "Add the clinic phone number, address and opening hours", href: "/admin/site" }]),
      ]
    : [];

  return (
    <>
      <PageTitle
        sub="Live counts from the saved appointments."
        action={<AddAppointmentDialog types={types.map((t) => ({ id: t.id, name: t.name }))} doctors={doctors.map((d) => ({ id: d.id, name: d.name }))} />}
      >
        Dashboard
      </PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      {todo.length > 0 && (
        <section aria-labelledby="setup" className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <h2 id="setup" className="mb-1.5 flex items-center gap-2 font-semibold">
            <Plug className="h-4 w-4" aria-hidden /> Still to set up
          </h2>
          <ul className="list-disc space-y-0.5 pl-5">
            {todo.map((t) => (
              <li key={t.text}>
                <Link href={t.href} className="font-medium underline">
                  {t.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {attention > 0 && (
        <Link href="/admin/appointments?attention=1&view=all" className="mb-6 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          {attention} appointment(s) need manual handling after a blocked date. Review them.
        </Link>
      )}

      <section aria-labelledby="overall" className="mb-8">
        <h2 id="overall" className="mb-3 font-heading text-lg font-semibold text-ink">
          Overall statistics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Total Appointments" value={overall.appointments} href="/admin/appointments?view=all" />
          <Tile label="Total Completed" value={overall.completed} href="/admin/appointments?view=all&status=COMPLETED" tone="text-green-700" />
          <Tile label="Total Rescheduled" value={overall.rescheduled} href="/admin/appointments?view=all" tone="text-primary" />
          <Tile label="Total Cancelled" value={overall.cancelled} href="/admin/appointments?view=all&status=CANCELLED" tone="text-danger" />
        </div>
      </section>

      <section aria-labelledby="today" className="mb-8">
        <h2 id="today" className="mb-3 font-heading text-lg font-semibold text-ink">
          Today&apos;s statistics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Today's Appointments" value={today.appointments} href="/admin/appointments?view=today" />
          <Tile label="Today's Completed" value={today.completed} href="/admin/appointments?view=today&status=COMPLETED" tone="text-green-700" />
          <Tile label="Today's Rescheduled" value={today.rescheduled} href="/admin/appointments?view=today" tone="text-primary" />
          <Tile label="Today's Cancelled" value={today.cancelled} href="/admin/appointments?view=today&status=CANCELLED" tone="text-danger" />
        </div>
      </section>

      <section className={`${card} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-ink">Recent bookings</h2>
          <Link href="/admin/appointments?view=all" className="text-sm font-semibold text-primary hover:underline">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <Empty>No bookings yet. They appear here as soon as one is made.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <Link href={`/admin/appointments/${a.id}`} className="font-semibold text-primary hover:underline">
                  {a.id} · {a.fullName}
                </Link>
                <span className="text-text-secondary">
                  {appointmentLabel(a)}
                  {a.kind === "CONSULTATION" && a.doctorName ? ` · ${a.doctorName}` : ""} · {fmtDate(a.date)}, {fmtTime(a.startTime)}
                </span>
                <StatusBadge status={a.status} cancelledBy={a.cancelledBy} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
