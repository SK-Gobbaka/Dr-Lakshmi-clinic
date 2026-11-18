import { deleteSessionAction, saveDoctorCapacityAction, saveSessionAction, setAutoConfirmAction, toggleSessionAction, unblockDateAction, updateSlotAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { DEFAULT_SLOT_CAPACITY, blockedReason, doctorCapacity, getSettings, listBlocked, listSessions, listSlots } from "@/lib/local-store";
import { formatDateForApi, todayIST } from "@/lib/slots";
import { Empty, Notice, PageTitle, btnDanger, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = getSettings();
  // Today's capacity is shown first; pick another date to see that day's bookings.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : formatDateForApi(todayIST());
  const timeSlots = listSessions();
  const slots = listSlots(date);
  const doctors = doctorCapacity(date);
  const closed = blockedReason(date);

  return (
    <>
      <PageTitle sub="Set the bookable time slots and their capacity, and the daily capacity of each doctor group. The booking page uses these numbers directly.">Session &amp; capacity</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mt-6 p-4 sm:p-6`} aria-labelledby="slots-h">
        <h2 id="slots-h" className="font-heading text-lg font-semibold">
          Time slots
        </h2>
        <p className="mt-1 text-sm text-text-secondary">Slots repeat every day, Monday to Saturday. Each slot accepts the capacity below (default {DEFAULT_SLOT_CAPACITY}). Slots cannot overlap and can be 60 minutes long at most.</p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-slate-50">
              <tr>
                {["Time slot", "Capacity", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {timeSlots.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3">
                    <form action={saveSessionAction} className="flex gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="number" name="capacity" min={1} max={500} required defaultValue={s.capacity} aria-label={`Capacity for ${s.name}`} className={`${input} w-24`} />
                      <button className={`${btnPlain} h-11`}>Save</button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={String(!s.active)} />
                      <button className={`${btnPlain} h-11`}>{s.active ? "Disable" : "Enable"}</button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className={`${btnDanger} h-11`} aria-label={`Delete ${s.name}`}>
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={saveSessionAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
          <h3 className="w-full font-heading text-base font-semibold">Add a time slot</h3>
          <label className="text-sm font-semibold">
            Start
            <input type="time" name="startTime" required className={`${input} mt-1`} />
          </label>
          <label className="text-sm font-semibold">
            End
            <input type="time" name="endTime" required className={`${input} mt-1`} />
          </label>
          <label className="text-sm font-semibold">
            Capacity
            <input type="number" name="capacity" min={1} max={500} defaultValue={DEFAULT_SLOT_CAPACITY} required className={`${input} mt-1 w-28`} />
          </label>
          <button className={btnPrimary}>Add time slot</button>
        </form>
      </section>

      <section className={`${card} mt-6 p-4 sm:p-6`} aria-labelledby="doctor-h">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="doctor-h" className="font-heading text-lg font-semibold">
              Doctor-wise capacity
            </h2>
            <p className="mt-1 text-sm text-text-secondary">Daily capacity for each doctor group. Dr. Lakshmi has her own capacity; it is never added to Other Doctors.</p>
          </div>
          <form className="flex items-end gap-2">
            <label className="text-sm font-semibold">
              Date
              <input type="date" name="date" defaultValue={date} className={`${input} mt-1`} />
            </label>
            <button className={btnPlain}>View</button>
          </form>
        </div>
        <p className="mb-3 text-sm font-semibold">
          {fmtDate(date)}
          {date === formatDateForApi(todayIST()) ? " (today)" : ""}
          {closed && <span className="ml-2 text-danger">Blocked: {closed}</span>}
        </p>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {doctors.map((d) => (
            <li key={d.group} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-48">
                <p className="font-semibold">{d.label}</p>
                {d.doctors.length > 0 && <p className="text-xs text-text-secondary">{d.doctors.join(", ")}</p>}
              </div>
              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-ink" data-testid={`booked-${d.group}`}>
                  {d.booked}
                </span>{" "}
                booked · <span className="font-semibold text-ink">{d.remaining}</span> left
              </p>
              <form action={saveDoctorCapacityAction} className="flex items-center gap-2">
                <input type="hidden" name="group" value={d.group} />
                <input type="hidden" name="date" value={date} />
                <input type="number" name="capacity" min={1} max={1000} required defaultValue={d.capacity} aria-label={`Daily capacity for ${d.label}`} className={`${input} w-24`} />
                <button className={`${btnPlain} h-11`}>Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} mt-6 p-4 sm:p-6`} aria-labelledby="date-h">
        <h2 id="date-h" className="font-heading text-lg font-semibold">
          Slots on {fmtDate(date)}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">Bookings and places left for the date above. A date limit applies to this date only; leave it empty to use the slot capacity.</p>
        <div className="mt-3 rounded-xl border border-border">
          {slots.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">No slots: this is a Sunday.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border bg-slate-50">
                  <tr>
                    {["Time", "Capacity", "Booked", "Date limit", "This date"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {slots.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">{fmtTime(s.startTime)}</td>
                      <td className="px-4 py-3">{s.sessionCapacity}</td>
                      <td className="px-4 py-3">
                        {s.booked} ({s.remaining} left)
                      </td>
                      <td className="px-4 py-3">
                        <form action={updateSlotAction} className="flex gap-2">
                          <input type="hidden" name="slotId" value={s.id} />
                          <input type="number" name="capacity" min={Math.max(1, s.booked)} max={500} defaultValue={s.slotCapacity ?? ""} placeholder="none" aria-label={`Date limit for ${fmtTime(s.startTime)}`} className={`${input} w-24`} />
                          <button className={`${btnPlain} h-11`}>Save</button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <form action={updateSlotAction}>
                          <input type="hidden" name="slotId" value={s.id} />
                          <input type="hidden" name="disabled" value={String(!s.disabled)} />
                          <button className={`${btnPlain} h-11`}>{s.disabled ? "Enable" : "Disable"}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-base font-semibold">Blocked dates</h3>
            <a href={`/admin/calendar/block?date=${date}`} className={btnPrimary}>
              Block {date}
            </a>
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
        </div>
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
          Off (default): online bookings wait as Pending until you confirm them, which sends the patient and admin confirmation notifications. Pending bookings still hold a place in the slot.
        </p>
      </section>
    </>
  );
}
