import { saveSessionAction, saveSlotCapsAction, setAutoConfirmAction, toggleSessionAction, unblockDateAction, updateSlotAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { blockedReason, getSettings, listBlocked, listSessions, listSlots, slotCaps } from "@/lib/local-store";
import { addDaysUTC, formatDateForApi, todayIST } from "@/lib/slots";
import { formatTime12Hour } from "@/lib/utils";
import { Empty, Notice, PageTitle, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

/** One-hour starts inside a session, e.g. 09:00, 10:00, 11:00. */
function hoursOf(s: { startTime: string; endTime: string }): string[] {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out: string[] = [];
  for (let t = m(s.startTime); t < m(s.endTime); t += 60) out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

function SessionForm({ s }: { s?: ReturnType<typeof listSessions>[number] }) {
  return (
    <form action={saveSessionAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
      {s && <input type="hidden" name="id" value={s.id} />}
      <label className="text-sm font-semibold">
        Session name
        <input name="name" required defaultValue={s?.name} placeholder="e.g. Afternoon" className={`${input} mt-1`} />
      </label>
      <label className="text-sm font-semibold">
        Starts
        <input type="time" name="startTime" required defaultValue={s?.startTime} className={`${input} mt-1`} />
      </label>
      <label className="text-sm font-semibold">
        Ends
        <input type="time" name="endTime" required defaultValue={s?.endTime} className={`${input} mt-1`} />
      </label>
      <label className="text-sm font-semibold">
        Appointments per day
        <input type="number" name="capacity" min={1} max={500} required defaultValue={s?.capacity ?? 10} className={`${input} mt-1`} />
      </label>
      <button className={s ? btnPlain : btnPrimary}>{s ? "Save" : "Add session"}</button>
    </form>
  );
}

export default async function SessionsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const sessions = listSessions();
  const settings = getSettings();
  const caps = slotCaps();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : formatDateForApi(addDaysUTC(todayIST(), 1));
  const slots = listSlots(date);
  const closed = blockedReason(date);

  return (
    <>
      <PageTitle sub="Each session accepts up to its capacity per day. Confirmed and pending appointments both count; cancelled ones free their place immediately.">Sessions &amp; capacity</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <div className="space-y-4">
        {sessions.map((s) => (
          <section key={s.id} className={`${card} p-4 ${s.active ? "" : "opacity-70"}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">
                {s.name} {!s.active && <span className="text-sm font-normal text-text-secondary">(inactive, hidden from booking)</span>}
              </h2>
              <form action={toggleSessionAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="active" value={String(!s.active)} />
                <button className={`${btnPlain} h-9`}>{s.active ? "Deactivate" : "Activate"}</button>
              </form>
            </div>
            <SessionForm s={s} />

            <form action={saveSlotCapsAction} className="mt-5 border-t border-border pt-4">
              <h3 className="mb-1 text-sm font-semibold text-ink">Capacity for each time slot</h3>
              <p className="mb-3 text-xs text-text-secondary">
                How many appointments one hour can take, every day. Leave a box empty for no limit beyond the session total ({s.capacity}). A slot never takes more than the session total.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                {hoursOf(s).map((h) => (
                  <label key={h} className="text-sm font-semibold">
                    {formatTime12Hour(h)}
                    <input type="number" name={`cap_${h}`} min={1} max={500} defaultValue={caps[h] ?? ""} placeholder="no limit" className={`${input} mt-1 w-28`} />
                  </label>
                ))}
                <button className={btnPlain}>Save slot capacity</button>
              </div>
            </form>
          </section>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        Slots are one hour long, starting at the session start. Times and capacity cannot be changed in a way that would leave an upcoming booking outside every session or above capacity.
      </p>

      <section className={`${card} mt-6 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add a session</h2>
        <SessionForm />
      </section>

      <section className={`${card} mt-8 p-4 sm:p-6`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Slots &amp; dates</h2>
            <p className="mt-1 text-sm text-text-secondary">Fine-tune individual slots, disable a time, or manage blocked dates.</p>
          </div>
          <form className="flex items-end gap-2">
            <label className="text-sm font-semibold">Date<input type="date" name="date" defaultValue={date} className={`${input} mt-1`} /></label>
            <button className={btnPlain}>View</button>
          </form>
        </div>
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3 font-semibold">{fmtDate(date)} {closed && <span className="ml-2 text-sm text-danger">Blocked: {closed}</span>}</div>
          {slots.length === 0 ? <p className="p-4 text-sm text-text-secondary">No slots: this is a Sunday.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border bg-slate-50"><tr><th className="px-4 py-3 font-semibold">Time</th><th className="px-4 py-3 font-semibold">Session</th><th className="px-4 py-3 font-semibold">Booked</th><th className="px-4 py-3 font-semibold">Slot limit</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-border">{slots.map((s) => <tr key={s.id}><td className="px-4 py-3">{fmtTime(s.startTime)}</td><td className="px-4 py-3">{s.sessionName}<div className="text-xs text-text-secondary">{s.sessionBooked}/{s.sessionCapacity} used</div></td><td className="px-4 py-3">{s.booked} ({s.remaining} left)</td><td className="px-4 py-3"><form action={updateSlotAction} className="flex gap-2"><input type="hidden" name="slotId" value={s.id} /><input type="number" name="capacity" min={Math.max(1, s.booked)} max={500} defaultValue={s.slotCapacity ?? ""} placeholder="none" aria-label={`Slot limit for ${fmtTime(s.startTime)}`} className={`${input} w-28`} /><button className={`${btnPlain} h-11`}>Save</button></form></td><td className="px-4 py-3"><form action={updateSlotAction}><input type="hidden" name="slotId" value={s.id} /><input type="hidden" name="disabled" value={String(!s.disabled)} /><button className={`${btnPlain} h-11`}>{s.disabled ? "Enable" : "Disable"}</button></form></td></tr>)}</tbody></table></div>}
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
