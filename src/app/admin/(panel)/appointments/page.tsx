import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { appointmentLabel, doctorLabel, listAppointments, listDoctors, listSessions, listTypes, type Appointment } from "@/lib/local-store";
import { formatDateForApi, parseApiDate, slotStartsAt, todayIST } from "@/lib/slots";
import { AddAppointmentDialog } from "@/components/admin/AddAppointmentDialog";
import { Empty, Notice, PageTitle, StatusBadge, StatusLegend, btnPlain, btnPrimary, card, fmtDate, fmtStamp, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

const VIEWS = [
  ["today", "Today"],
  ["after", "After today"],
  ["upcoming", "Upcoming"],
  ["previous", "Previous"],
  ["all", "All"],
] as const;

const nowMs = () => Date.now();
const startMs = (a: Appointment) => slotStartsAt(parseApiDate(a.date), a.startTime).getTime();


export default async function AppointmentsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  const status = one(sp.status);
  const typeId = one(sp.typeId);
  const sessionId = one(sp.session);
  const date = one(sp.date);
  const attention = one(sp.attention) === "1";
  const filtered = Boolean(q || date || status || typeId || sessionId || attention);
  // Opens on today's appointments; a search or a dashboard link searches everything.
  const view = one(sp.view) || (filtered ? "all" : "today");
  const today = formatDateForApi(todayIST());
  const now = nowMs();

  const types = listTypes();
  const sessions = listSessions();
  const sessionWindow = sessions.find((s) => s.id === sessionId);

  const rows = listAppointments()
    .filter((a) => {
      if (q && !(qDigits && a.phone.includes(qDigits))) return false;
      if (date && a.date !== date) return false;
      if (view === "today" && a.date !== today) return false;
      if (view === "after" && a.date <= today) return false;
      if (view === "upcoming" && !(["PENDING", "CONFIRMED"].includes(a.status) && startMs(a) > now)) return false;
      if (view === "previous" && startMs(a) > now) return false;
      if (status && a.status !== status) return false;
      if (typeId && (typeId === "none" ? a.typeId : a.typeId !== typeId)) return false;
      if (sessionWindow && !(a.startTime >= sessionWindow.startTime && a.startTime < sessionWindow.endTime)) return false;
      if (attention && !a.needsAttention) return false;
      return true;
    })
    // All: today first, then later days (soonest first), then past days (most recent first).
    // Previous: most recent first. Other views: earliest first.
    .sort((a, b) => {
      if (view === "previous") return startMs(b) - startMs(a);
      if (view !== "all") return startMs(a) - startMs(b);
      const rank = (x: Appointment) => (x.date === today ? 0 : x.date > today ? 1 : 2);
      return rank(a) - rank(b) || (rank(a) === 2 ? startMs(b) - startMs(a) : startMs(a) - startMs(b));
    });

  const keep = (v: string) => `/admin/appointments?view=${v}`;

  return (
    <>
      <PageTitle sub={`${rows.length} shown`} action={<AddAppointmentDialog types={types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))} doctors={listDoctors({ publishedOnly: true }).map((d) => ({ id: d.id, name: d.name }))} openByDefault={one(sp.add) === "1"} />}>
        Appointments
      </PageTitle>

      <nav aria-label="Views" className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={keep(v)} className={`${btnPlain} h-9 ${view === v ? "border-primary bg-sand/60" : ""}`} aria-current={view === v ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <Notice notice={one(sp.notice)} error={one(sp.error)} />
      <StatusLegend />

      <form className={`${card} mb-4 flex flex-wrap items-end gap-2 p-4`}>
        <input type="hidden" name="view" value={view} />
        <label className="text-sm font-semibold">
          Search by mobile number
          <input name="q" type="search" inputMode="numeric" defaultValue={one(sp.q)} placeholder="10-digit number" className={`${input} mt-1 w-72`} />
        </label>
        <button type="submit" className={btnPrimary}>
          Search
        </button>
        {filtered && (
          <Link href={keep(view)} className={btnPlain}>
            Clear
          </Link>
        )}
      </form>

      <section className={`${card} mb-6 flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-sm">
          <span className="font-semibold">Capacity per day: </span>
          {sessions.filter((s) => s.active).map((s) => `${s.name} ${s.capacity}`).join(" · ") || "no active sessions"}
        </p>
        <Link href="/admin/sessions" className={btnPlain}>
          Change capacity
        </Link>
      </section>

      {rows.length === 0 ? (
        <Empty>{filtered ? "No appointments match this search." : view === "today" ? "No appointments today." : "No appointments in this view."}</Empty>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-border bg-sand/40">
              <tr>
                {["ID", "Customer", "Phone", "Appointment", "Type", "Doctor", "Status", "Booked", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-sand/20">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/appointments/${a.id}`} className="font-semibold text-primary hover:underline">
                      {a.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    {a.fullName}
                    <div className="text-xs text-text-secondary">
                      {[a.age ? `${a.age}` : null, a.gender?.toLowerCase(), a.persons > 1 ? `${a.persons} persons` : null].filter(Boolean).join(", ") || "-"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{a.phone}</td>
                  <td className="px-3 py-2.5">
                    {fmtDate(a.date)}
                    <div className="text-xs text-text-secondary">{fmtTime(a.startTime)}</div>
                  </td>
                  <td className="px-3 py-2.5">{appointmentLabel(a)}</td>
                  <td className="px-3 py-2.5">{doctorLabel(a)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={a.status} />
                    {a.needsAttention && (
                      <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> Needs handling
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">{fmtStamp(a.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/appointments/${a.id}`} className={`${btnPlain} h-8 px-3`}>
                      {a.status === "PENDING" ? "Review" : "Open"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
