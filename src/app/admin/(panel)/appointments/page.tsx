import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { changeStatus } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { QUICK_VIEWS, filterAppointments, filterDate, parseFilter } from "@/lib/admin-appointments";
import { appointmentLabel, doctorLabel, listDoctors, listTypes, tokenInfo, wasRescheduled, type Appointment } from "@/lib/local-store";
import { parseApiDate, slotStartsAt } from "@/lib/slots";
import { AddAppointmentDialog } from "@/components/admin/AddAppointmentDialog";
import { DateFilter } from "@/components/admin/DateFilter";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Empty, Notice, PageTitle, StatusBadge, StatusLegend, btnPlain, btnPrimary, card, fmtDate, fmtStamp, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

const nowMs = () => Date.now();
const startMs = (a: Appointment) => slotStartsAt(parseApiDate(a.date), a.startTime).getTime();

export default async function AppointmentsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = parseFilter({ view: one(sp.view), date: one(sp.date), q: one(sp.q) });
  const attention = one(sp.attention) === "1";
  const now = nowMs();
  // Today is the default; a picked date replaces the quick filter.
  const activeView = filter.date ? null : filter.view;

  const rows = filterAppointments(filter).filter((a) => !attention || a.needsAttention);
  const day = filterDate(filter);
  const token = tokenInfo();

  const qs = new URLSearchParams();
  if (filter.date) qs.set("date", filter.date);
  else qs.set("view", filter.view);
  if (filter.phone) qs.set("q", filter.phone);
  const here = `/admin/appointments?${qs}`;
  const baseView = (v: string) => `/admin/appointments?view=${v}`;

  return (
    <>
      <PageTitle
        sub={`${rows.length} shown${day ? ` for ${fmtDate(day)}` : ""}`}
        action={<AddAppointmentDialog types={listTypes().filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))} doctors={listDoctors({ publishedOnly: true }).map((d) => ({ id: d.id, name: d.name }))} openByDefault={one(sp.add) === "1"} />}
      >
        Appointments
      </PageTitle>

      <section aria-label="Token number" className={`${card} mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 p-4`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Token number</p>
          <p className="font-heading text-4xl font-semibold text-primary" data-testid="token-last">
            {token.last === 0 ? "-" : token.last}
          </p>
        </div>
        <p className="text-sm text-text-secondary">
          {token.latest ? (
            <>
              Last token issued to <span className="font-semibold text-ink">{token.latest.fullName}</span> ({token.latest.id}). Next token: <span className="font-semibold text-ink">{token.next}</span>.
            </>
          ) : (
            <>No token issued yet. The first appointment marked Completed gets token 1.</>
          )}
        </p>
      </section>

      <nav aria-label="Quick filters" className="mb-4 flex flex-wrap items-center gap-2">
        {QUICK_VIEWS.map(([v, label]) => (
          <Link key={v} href={baseView(v)} className={`${btnPlain} h-9 ${activeView === v ? "border-primary bg-sand/60" : ""}`} aria-current={activeView === v ? "page" : undefined}>
            {label}
          </Link>
        ))}
        <DateFilter date={filter.date} base="/admin/appointments" />
      </nav>

      <Notice notice={one(sp.notice)} error={one(sp.error)} />
      <StatusLegend />

      <form className={`${card} mb-4 flex flex-wrap items-end gap-2 p-4`}>
        {filter.date ? <input type="hidden" name="date" value={filter.date} /> : <input type="hidden" name="view" value={filter.view} />}
        <label className="text-sm font-semibold">
          Search by mobile number
          <input name="q" type="search" inputMode="numeric" defaultValue={one(sp.q)} placeholder="10-digit number" className={`${input} mt-1 w-72`} />
        </label>
        <button type="submit" className={btnPrimary}>
          Search
        </button>
        {(filter.phone || attention) && (
          <Link href={filter.date ? `/admin/appointments?date=${filter.date}` : baseView(filter.view)} className={btnPlain}>
            Clear
          </Link>
        )}
      </form>

      <div className="mb-3 flex justify-end">
        <a href={`/admin/appointments/download?${qs}`} className={btnPlain} download>
          <Download className="h-4 w-4" /> Download
        </a>
      </div>

      {rows.length === 0 ? (
        <Empty>{filter.phone ? "No appointments match this search." : day ? "No appointments on this day." : "No appointments yet."}</Empty>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-border bg-sand/40">
              <tr>
                {["ID", "Customer", "Phone", "Appointment", "Type", "Doctor", "Status", "Token", "Booked", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((a) => {
                const live = a.status === "PENDING" || a.status === "CONFIRMED";
                const started = startMs(a) <= now;
                return (
                  <tr key={a.id} className="hover:bg-sand/20">
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/appointments/${a.id}`} className="font-semibold text-primary hover:underline">
                        {a.id}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.fullName}
                      <div className="text-xs text-text-secondary">{[a.age ? `${a.age}` : null, a.gender?.toLowerCase(), a.persons > 1 ? `${a.persons} persons` : null].filter(Boolean).join(", ") || "-"}</div>
                    </td>
                    <td className="px-3 py-2.5">{a.phone}</td>
                    <td className="px-3 py-2.5">
                      {fmtDate(a.date)}
                      <div className="text-xs text-text-secondary">{fmtTime(a.startTime)}</div>
                    </td>
                    <td className="px-3 py-2.5">{appointmentLabel(a)}</td>
                    <td className="px-3 py-2.5">{doctorLabel(a)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={a.status} cancelledBy={a.cancelledBy} />
                        {live &&
                          (started ? (
                            <form action={changeStatus}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="action" value="complete" />
                              <input type="hidden" name="returnTo" value={here} />
                              <SubmitButton pendingText="Saving..." className="h-7 rounded-lg border border-green-300 bg-green-50 px-2.5 text-xs font-semibold text-green-800 hover:bg-green-100 disabled:opacity-60">
                                Completed
                              </SubmitButton>
                            </form>
                          ) : (
                            <button type="button" disabled title="Can be marked Completed once the appointment time has started" className="h-7 cursor-not-allowed rounded-lg border border-border bg-gray-50 px-2.5 text-xs font-semibold text-text-secondary/60">
                              Completed
                            </button>
                          ))}
                      </div>
                      {wasRescheduled(a) && <div className="mt-1 text-xs font-semibold text-primary">Rescheduled</div>}
                      {a.needsAttention && (
                        <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-800">
                          <AlertTriangle className="h-3 w-3" /> Needs handling
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-semibold" data-testid={`token-${a.id}`}>
                      {a.tokenNumber ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{fmtStamp(a.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/appointments/${a.id}`} className={`${btnPlain} h-8 px-3`}>
                        {a.status === "PENDING" ? "Review" : "Open"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
