import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { appointmentLabel, listAppointments, listDoctors, listTypes, stats } from "@/lib/local-store";
import { formatDateForApi, todayIST } from "@/lib/slots";
import { AddAppointmentDialog } from "@/components/admin/AddAppointmentDialog";
import { Empty, PageTitle, STATUS_ROW, StatusBadge, card, fmtDate, fmtTime } from "../ui";

export const dynamic = "force-dynamic";

function Tile({ label, value, href, tone }: { label: string; value: number; href: string; tone?: string }) {
  return (
    <Link href={href} className={`${card} block p-4 transition-colors hover:border-primary`}>
      <div className={`font-heading text-3xl font-semibold ${tone ?? "text-ink"}`}>{value}</div>
      <div className="text-sm text-text-secondary">{label}</div>
    </Link>
  );
}

export default async function Dashboard() {
  await requireAdmin();
  const s = stats();
  const types = listTypes({ activeOnly: true });
  const doctors = listDoctors({ publishedOnly: true });
  const today = formatDateForApi(todayIST());
  const todays = listAppointments()
    .filter((a) => a.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <>
      <PageTitle
        sub="Live counts from the saved appointments."
        action={<AddAppointmentDialog types={types.map((t) => ({ id: t.id, name: t.name }))} doctors={doctors.map((d) => ({ id: d.id, name: d.name }))} />}
      >
        Dashboard
      </PageTitle>

      {s.needsAttention > 0 && (
        <Link href="/admin/appointments?attention=1&view=all" className="mb-6 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {s.needsAttention} appointment(s) need manual handling after a blocked date. Review them.
        </Link>
      )}

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Today&apos;s schedule</h2>
        {todays.length === 0 ? (
          <p className="text-text-secondary">Nothing booked for today. Use “Add appointment” for a walk-in.</p>
        ) : (
          <ul className="space-y-2">
            {todays.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/appointments/${a.id}`} className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${STATUS_ROW[a.status]}`}>
                  <span className="font-semibold">
                    {fmtTime(a.startTime)} · {a.fullName}
                  </span>
                  <span className="text-text-secondary">{a.phone}</span>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total appointments" value={s.total} href="/admin/appointments?view=all" />
        <Tile label="Today's appointments" value={s.today} href="/admin/appointments?view=today" />
        <Tile label="Pending" value={s.pending} href="/admin/appointments?status=PENDING&view=all" tone="text-amber-700" />
        <Tile label="Confirmed" value={s.confirmed} href="/admin/appointments?status=CONFIRMED&view=all" tone="text-primary" />
        <Tile label="Cancelled" value={s.cancelled} href="/admin/appointments?status=CANCELLED&view=all" tone="text-danger" />
        <Tile label="Open seats (next 30 days)" value={s.openSeats} href="/admin/calendar" />
        <Tile label="Blocked dates ahead" value={s.blockedDates} href="/admin/calendar" />
        <Tile label="Completed" value={s.completed} href="/admin/appointments?status=COMPLETED&view=all" />
      </div>

      <section className={`${card} mt-8 p-4`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-ink">Recent bookings</h2>
          <Link href="/admin/appointments?view=all" className="text-sm font-semibold text-primary hover:underline">
            See all
          </Link>
        </div>
        {s.recent.length === 0 ? (
          <Empty>No bookings yet. They appear here as soon as one is made.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {s.recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <Link href={`/admin/appointments/${a.id}`} className="font-semibold text-primary hover:underline">
                  {a.id} · {a.fullName}
                </Link>
                <span className="text-text-secondary">
                  {appointmentLabel(a)}
                  {a.kind === "CONSULTATION" && a.doctorName ? ` · ${a.doctorName}` : ""} · {fmtDate(a.date)}, {fmtTime(a.startTime)}
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
