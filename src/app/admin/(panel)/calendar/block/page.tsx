import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { emergencyCloseAction, executeBlockAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { appointmentLabel, blockedReason, planBlock } from "@/lib/local-store";
import { Notice, PageTitle, btnDanger, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../../ui";

export const dynamic = "force-dynamic";

/**
 * Review step of "Block date": shows every affected appointment and where the system
 * proposes to move it. Nothing is changed until the admin approves the plan.
 */
export default async function BlockDatePage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const date = one(sp.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return <Notice error="Choose a date from the calendar first." />;
  const alreadyBlocked = blockedReason(date);
  const reason = one(sp.reason).trim() || alreadyBlocked || "";

  // A blocked date with active appointments left can still be cancelled in full; otherwise there is nothing to do here.
  if (alreadyBlocked && planBlock(date).length === 0) {
    return (
      <>
        <PageTitle>Block date</PageTitle>
        <Notice error={`${date} is already blocked.`} />
        <Link href={`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`} className={btnPlain}>
          Back to calendar
        </Link>
      </>
    );
  }

  const overrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (k.startsWith("ov_") && one(v)) overrides[k.slice(3)] = one(v);
  const plan = planBlock(date, overrides);
  const flagged = plan.filter((p) => !p.target).length;

  return (
    <>
      <Link href={`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`} className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
        Back to calendar
      </Link>
      <PageTitle sub={`${fmtDate(date)} · ${plan.length} appointment(s) affected`}>Block date</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      {alreadyBlocked ? (
        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {date} is already blocked ({alreadyBlocked}). {plan.length} appointment(s) are still active on it.
        </p>
      ) : (
      <>
      <form method="get" className={`${card} p-4`}>
        <input type="hidden" name="date" value={date} />
        <label className="block text-sm font-semibold">
          Reason for blocking (shown to affected patients)
          <input name="reason" defaultValue={reason} placeholder="e.g. Public holiday, doctor unavailable" className={`${input} mt-1`} required />
        </label>

        {plan.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary">No appointments are booked on this date, so nothing needs to be moved.</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-text-secondary">
              Proposed moves go to the nearest date with room in the same session when possible, and never to a blocked, fully booked or Sunday date. To pick a different date for an appointment, enter it
              below and press Recalculate.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-sand/40">
                  <tr>
                    {["Appointment", "Current", "Proposed new slot", "Choose another date"].map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.map((p) => (
                    <tr key={p.appointment.id}>
                      <td className="px-3 py-2">
                        <span className="font-semibold">{p.appointment.id}</span> · {p.appointment.fullName}
                        <div className="text-xs text-text-secondary">{appointmentLabel(p.appointment)}</div>
                      </td>
                      <td className="px-3 py-2">{fmtTime(p.appointment.startTime)}</td>
                      <td className="px-3 py-2">
                        {p.target ? (
                          <>
                            <span className="font-semibold text-green-800">{fmtDate(p.target.date)}</span>, {fmtTime(p.target.startTime)}
                            <div className="text-xs text-text-secondary">
                              {p.target.sessionName} session{p.manual ? " · chosen by you" : ""}
                            </div>
                          </>
                        ) : (
                          <span className="flex items-start gap-1 font-semibold text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              Manual handling
                              <span className="block text-xs font-normal">{p.reason}</span>
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" name={`ov_${p.appointment.id}`} defaultValue={overrides[p.appointment.id] ?? ""} className={`${input} w-44!`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <button type="submit" className={`${btnPlain} mt-4`}>
          Recalculate
        </button>
      </form>

      <section className={`${card} mt-6 p-4`}>
        <h2 className="mb-2 font-heading text-lg font-semibold">Approve</h2>
        {flagged > 0 && (
          <p className="mb-3 text-sm text-amber-900">
            {flagged} appointment(s) have no alternative. They will stay on this date, be flagged for manual handling, and the patients will be told the date is unavailable. Nothing is cancelled.
          </p>
        )}
        <p className="mb-3 text-sm text-text-secondary">
          Blocking stops new bookings for {fmtDate(date)}. {plan.length - flagged} appointment(s) will be moved and each patient notified with the old and new time.
        </p>
        <form action={executeBlockAction}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="reason" value={reason} />
          {plan.map((p) => (
            <input key={p.appointment.id} type="hidden" name={`plan_${p.appointment.id}`} value={p.target?.slotId ?? ""} />
          ))}
          {!reason && <p className="mb-3 text-sm font-semibold text-danger">Enter a reason above and press Recalculate before approving.</p>}
          <button className={plan.length ? btnDanger : btnPrimary} disabled={!reason}>
            Approve and block {date}
          </button>
        </form>
      </section>

      </>
      )}

      <section className="mt-6 rounded-xl border-2 border-danger/40 bg-red-50/50 p-4">
        <h2 className="mb-2 font-heading text-lg font-semibold text-danger">Emergency closure: cancel all appointments</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Use this when the clinic has to close at short notice. It blocks {fmtDate(date)} (new bookings stop) and <strong>cancels all {plan.length} appointment(s)</strong> on that date instead of moving them. They are marked Cancelled by Admin and stay visible when you open this date again. Each patient gets a WhatsApp message saying the clinic is closed, with a link to book again.
          This cannot be undone.
        </p>
        <form action={emergencyCloseAction}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="reason" value={reason} />
          {!reason && <p className="mb-3 text-sm font-semibold text-danger">Enter a reason above and press Recalculate first.</p>}
          <button className={btnDanger} disabled={!reason}>
            Cancel all appointments and block {date}
          </button>
        </form>
      </section>
    </>
  );
}
