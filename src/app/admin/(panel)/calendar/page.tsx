import Link from "next/link";
import { unblockDateAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { appointmentLabel, dayInfo, listAppointments, listSlots } from "@/lib/local-store";
import { formatDateForApi, todayIST } from "@/lib/slots";
import { Empty, Notice, PageTitle, StatusBadge, btnPlain, btnPrimary, card, fmtDate, fmtTime, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  blocked: "bg-red-50 border-red-200",
  full: "bg-amber-50 border-amber-200",
  available: "bg-green-50/60 border-green-200",
  holiday: "bg-gray-100 border-gray-200 text-text-secondary",
  past: "bg-white border-border text-text-secondary",
};

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = formatDateForApi(todayIST());
  const monthParam = /^\d{4}-\d{2}$/.test(one(sp.m)) ? one(sp.m) : today.slice(0, 7);
  const [y, m] = monthParam.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.day)) ? one(sp.day) : today.startsWith(monthParam) ? today : `${monthParam}-01`;

  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${monthParam}-${String(d).padStart(2, "0")}`);

  const dayAppts = listAppointments()
    .filter((a) => a.date === selected)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const info = dayInfo(selected);
  const daySlots = listSlots(selected);
  const canBlock = !info.blocked && !info.holiday;
  const liveLeft = dayAppts.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED").length;

  return (
    <>
      <PageTitle sub="Booked, full, open and blocked days at a glance. Pick a day to see its sessions and appointments.">Calendar</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <div className="mb-3 flex items-center justify-between gap-4 sm:justify-start">
        <Link href={`/admin/calendar?m=${prev}`} className={`${btnPlain} h-9`}>
          Previous
        </Link>
        <h2 className="font-heading text-xl font-semibold">{first.toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" })}</h2>
        <Link href={`/admin/calendar?m=${next}`} className={`${btnPlain} h-9`}>
          Next
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {[
          ["available", "Available"],
          ["full", "Fully booked"],
          ["blocked", "Blocked"],
          ["holiday", "Holiday (Sunday)"],
        ].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`inline-block h-3.5 w-3.5 rounded border ${TONE[k]}`} />
            {l}
          </span>
        ))}
      </div>

      <div className={`${card} grid grid-cols-7 overflow-hidden text-sm`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="border-b border-border bg-sand/40 px-1 py-1.5 text-center text-xs font-semibold sm:px-2 sm:text-left sm:text-sm">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} className="border-b border-r border-border" />;
          const di = dayInfo(date);
          return (
            <Link
              key={date}
              href={`/admin/calendar?m=${monthParam}&day=${date}`}
              aria-current={date === selected ? "date" : undefined}
              className={`min-h-16 border-b border-r p-1 sm:min-h-24 sm:p-2 ${TONE[di.state]} ${date === selected ? "ring-2 ring-inset ring-primary" : ""}`}
            >
              <span className={date === today ? "font-bold text-primary" : "font-semibold"}>{Number(date.slice(8))}</span>
              {di.state === "blocked" ? (
                <div className="text-[10px] font-semibold text-danger sm:text-xs">Blocked</div>
              ) : di.state === "holiday" ? null : (
                <>
                  {di.appointments > 0 && <div className="text-[10px] sm:text-xs">{di.appointments} booked</div>}
                  {di.state === "full" && <div className="text-[10px] font-semibold text-amber-800 sm:text-xs">Full</div>}
                  {di.state === "available" && <div className="hidden text-xs text-green-800 sm:block">{di.remaining} open</div>}
                </>
              )}
            </Link>
          );
        })}
      </div>

      <section className={`${card} mt-6 p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">{fmtDate(selected)}</h2>
          {info.blocked ? (
            <form action={unblockDateAction}>
              <input type="hidden" name="date" value={selected} />
              <button className={btnPlain}>Unblock this date</button>
            </form>
          ) : canBlock ? (
            <Link href={`/admin/calendar/block?date=${selected}`} className={btnPrimary}>
              Block this date
            </Link>
          ) : null}
        </div>
        {info.blocked && <p className="mb-3 text-sm font-semibold text-danger">Blocked: {info.blocked}. Patients cannot book this date.</p>}
        {info.blocked && liveLeft > 0 && (
          <p className="mb-3 text-sm">
            {liveLeft} appointment(s) are still active on this blocked date.{" "}
            <Link href={`/admin/calendar/block?date=${selected}`} className="font-semibold text-primary underline">
              Cancel all appointments for this date
            </Link>
          </p>
        )}
        {daySlots.length === 0 ? (
          <p className="mb-3 text-sm text-text-secondary">No sessions on this day (Sunday is a holiday).</p>
        ) : (
          <ul className="mb-4 flex flex-wrap gap-2">
            {daySlots.map((s) => (
              <li key={s.id} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                {fmtTime(s.startTime)} <span className="text-text-secondary">{s.sessionName} · {s.disabled ? "disabled" : s.remaining <= 0 ? "full" : `${s.remaining} left`}</span>
              </li>
            ))}
          </ul>
        )}
        {dayAppts.length === 0 ? (
          <Empty>No appointments on this day.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {dayAppts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{fmtTime(a.startTime)}</span>
                <Link href={`/admin/appointments/${a.id}`} className="font-semibold text-primary hover:underline">
                  {a.id} · {a.fullName}
                </Link>
                <span className="text-text-secondary">{appointmentLabel(a)}</span>
                <StatusBadge status={a.status} cancelledBy={a.cancelledBy} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
