import { saveSessionAction, setAutoConfirmAction, unblockDateAction, updateSlotAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { blockedReason, getSettings, listBlocked, listSessions, listSlots } from "@/lib/local-store";
import { addDaysUTC, formatDateForApi, todayIST } from "@/lib/slots";
import { Empty, Notice, PageTitle, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = getSettings();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : formatDateForApi(addDaysUTC(todayIST(), 1));
  const slots = listSlots(date);
  const sessions = listSessions();
  const closed = blockedReason(date);

  return (
    <>
      <PageTitle sub="Choose a date and edit each available time directly. Set a slot limit, disable a time, or manage blocked dates.">Slots &amp; dates</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mt-6 p-4 sm:p-6`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Date &amp; time slots</h2>
            <p className="mt-1 text-sm text-text-secondary">Edit any time slot directly for the selected date.</p>
          </div>
          <form className="flex items-end gap-2">
            <label className="text-sm font-semibold">Date<input type="date" name="date" defaultValue={date} className={`${input} mt-1`} /></label>
            <button className={btnPlain}>View</button>
          </form>
        </div>
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3 font-semibold">{fmtDate(date)} {closed && <span className="ml-2 text-sm text-danger">Blocked: {closed}</span>}</div>
          {slots.length === 0 ? <p className="p-4 text-sm text-text-secondary">No slots: this is a Sunday.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b border-border bg-slate-50"><tr><th className="px-4 py-3 font-semibold">Time</th><th className="px-4 py-3 font-semibold">Session</th><th className="px-4 py-3 font-semibold">Booked</th><th className="px-4 py-3 font-semibold">Session capacity</th><th className="px-4 py-3 font-semibold">Slot limit</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-border">{slots.map((s) => { const session = sessions.find((x) => x.id === s.sessionId); return <tr key={s.id}><td className="px-4 py-3">{fmtTime(s.startTime)}</td><td className="px-4 py-3">{s.sessionName}<div className="text-xs text-text-secondary">{s.sessionBooked}/{s.sessionCapacity} used</div></td><td className="px-4 py-3">{s.booked} ({s.remaining} left)</td><td className="px-4 py-3"><form action={saveSessionAction} className="flex gap-2"><input type="hidden" name="id" value={session?.id} /><input type="hidden" name="name" value={session?.name} /><input type="hidden" name="startTime" value={session?.startTime} /><input type="hidden" name="endTime" value={session?.endTime} /><input type="hidden" name="published" value="on" /><input type="number" name="capacity" min={Math.max(1, s.sessionBooked)} max={500} defaultValue={s.sessionCapacity} aria-label={`Session capacity for ${s.sessionName}`} className={`${input} w-24`} /><button className={`${btnPlain} h-11`}>Save</button></form></td><td className="px-4 py-3"><form action={updateSlotAction} className="flex gap-2"><input type="hidden" name="slotId" value={s.id} /><input type="number" name="capacity" min={Math.max(1, s.booked)} max={500} defaultValue={s.slotCapacity ?? ""} placeholder="none" aria-label={`Slot limit for ${fmtTime(s.startTime)}`} className={`${input} w-24`} /><button className={`${btnPlain} h-11`}>Save</button></form></td><td className="px-4 py-3"><form action={updateSlotAction}><input type="hidden" name="slotId" value={s.id} /><input type="hidden" name="disabled" value={String(!s.disabled)} /><button className={`${btnPlain} h-11`}>{s.disabled ? "Enable" : "Disable"}</button></form></td></tr>; })}</tbody></table></div>}
        </div>
        <p className="mt-3 text-xs text-text-secondary">A slot limit cannot go below the number already booked. Leave it empty to use only the session capacity.</p>
        <div className="mt-6 border-t border-border pt-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-heading text-base font-semibold">Blocked dates</h3><a href={`/admin/calendar/block?date=${date}`} className={btnPrimary}>Block {date}</a></div>{listBlocked().length === 0 ? <Empty>No blocked dates.</Empty> : <ul className="divide-y divide-border">{listBlocked().map((b) => <li key={b.date} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{fmtDate(b.date)} · {b.reason}</span><form action={unblockDateAction}><input type="hidden" name="date" value={b.date} /><button className={`${btnPlain} h-9`}>Unblock</button></form></li>)}</ul>}</div>
      </section>

      <section className={`${card} mt-6 p-4`}>
        <h2 className="mb-2 font-heading text-lg font-semibold">Booking policy</h2>
        <form action={setAutoConfirmAction} className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="autoConfirm" defaultChecked={settings.autoConfirmOnline} />
            Confirm online bookings automatically
          </label>
          <button className={btnPlain}>Save policy</button>
        </form>
        <p className="mt-2 text-xs text-text-secondary">
          Off (default): online bookings wait as Pending until you confirm them, which sends the patient and admin confirmation notifications. Pending bookings still hold a place in the session.
        </p>
      </section>
    </>
  );
}
