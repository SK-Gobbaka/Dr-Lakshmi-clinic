import Link from "next/link";
import { unblockDateAction, updateSlotAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { blockedReason, listBlocked, listSlots } from "@/lib/local-store";
import { addDaysUTC, formatDateForApi, todayIST } from "@/lib/slots";
import { Empty, Notice, PageTitle, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function SlotsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : formatDateForApi(addDaysUTC(todayIST(), 1));
  const slots = listSlots(date);
  const closed = blockedReason(date);

  return (
    <>
      <PageTitle sub="Fine-tune individual hours on one date. Session capacity (the main limit) is set on the Sessions page; a slot limit here can only make a slot stricter.">Slots &amp; dates</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-sm font-semibold">
          Date
          <input type="date" name="date" defaultValue={date} className={`${input} mt-1`} />
        </label>
        <button className={btnPlain}>View</button>
      </form>

      <section className={`${card} p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">{fmtDate(date)}</h2>
        {closed && <p className="mb-3 text-sm font-semibold text-danger">Blocked: {closed}. Patients cannot book this date.</p>}
        {slots.length === 0 ? (
          <p className="text-text-secondary">No slots: this is a Sunday.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="py-2 font-semibold">Time</th>
                  <th className="py-2 font-semibold">Session</th>
                  <th className="py-2 font-semibold">Booked</th>
                  <th className="py-2 font-semibold">Slot limit (optional)</th>
                  <th className="py-2 font-semibold">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slots.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">{fmtTime(s.startTime)}</td>
                    <td className="py-2">
                      {s.sessionName}
                      <div className="text-xs text-text-secondary">
                        {s.sessionBooked}/{s.sessionCapacity} used
                      </div>
                    </td>
                    <td className="py-2">
                      {s.booked} ({s.remaining} left)
                    </td>
                    <td className="py-2">
                      <form action={updateSlotAction} className="flex gap-2">
                        <input type="hidden" name="slotId" value={s.id} />
                        <input type="number" name="capacity" min={Math.max(1, s.booked)} max={500} defaultValue={s.slotCapacity ?? ""} placeholder="none" aria-label={`Slot limit for ${fmtTime(s.startTime)}`} className={`${input} w-24`} />
                        <button className={`${btnPlain} h-10`}>Save</button>
                      </form>
                    </td>
                    <td className="py-2">
                      <form action={updateSlotAction}>
                        <input type="hidden" name="slotId" value={s.id} />
                        <input type="hidden" name="disabled" value={String(!s.disabled)} />
                        <button className={`${btnPlain} h-10`}>{s.disabled ? "Enable" : "Disable"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-text-secondary">A slot limit cannot go below the number already booked. Leave it empty to use only the session capacity.</p>
      </section>

      <section className={`${card} mt-6 p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">Blocked dates (holidays, closures)</h2>
          <Link href={`/admin/calendar/block?date=${date}`} className={btnPrimary}>
            Block {date}
          </Link>
        </div>
        {listBlocked().length === 0 ? (
          <Empty>No blocked dates.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {listBlocked().map((b) => (
              <li key={b.date} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {fmtDate(b.date)} · {b.reason}
                </span>
                <form action={unblockDateAction}>
                  <input type="hidden" name="date" value={b.date} />
                  <button className={`${btnPlain} h-9`}>Unblock</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-text-secondary">Blocking a date first shows the appointments on it and proposes new dates for your approval; nothing is cancelled silently.</p>
      </section>
    </>
  );
}
