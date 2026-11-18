import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { changeStatus, deleteAppointmentAction, rescheduleByAdmin } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { appointmentLabel, doctorLabel, getAppointment, listAppointments, sessionNameFor } from "@/lib/local-store";
import { SlotPicker } from "@/components/shared/SlotPicker";
import { Notice, PageTitle, StatusBadge, btnDanger, btnPlain, btnPrimary, card, fmtDate, fmtStamp, fmtTime, input, one, type SP } from "../../../ui";

export const dynamic = "force-dynamic";

export default async function AppointmentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const a = getAppointment(id);
  if (!a) notFound();

  const live = a.status === "PENDING" || a.status === "CONFIRMED";
  const others = listAppointments().filter((x) => x.phone === a.phone && x.id !== a.id);
  const dl = "grid grid-cols-[8.5rem_1fr] gap-y-2 text-sm";
  const hidden = (action: string) => (
    <>
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="action" value={action} />
    </>
  );

  return (
    <>
      <Link href="/admin/appointments" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
        Back to appointments
      </Link>
      <PageTitle sub={`Booked ${fmtStamp(a.createdAt)} (${a.source === "ADMIN" ? "by admin" : "online"})`}>
        {a.id} · {a.fullName}
      </PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      {a.needsAttention && live && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Needs manual handling</p>
            <p>{a.attentionReason}. Use Reschedule below to move it to a date with room; the patient is notified automatically.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} p-4`}>
          <h2 className="mb-3 font-heading text-lg font-semibold">Appointment</h2>
          <dl className={dl}>
            <dt className="text-text-secondary">Status</dt>
            <dd>
              <StatusBadge status={a.status} cancelledBy={a.cancelledBy} />
            </dd>
            <dt className="text-text-secondary">{a.kind === "TREATMENT" ? "Booking" : "Type"}</dt>
            <dd className="font-semibold">{appointmentLabel(a)}</dd>
            <dt className="text-text-secondary">Doctor</dt>
            <dd>{a.kind === "TREATMENT" ? "Not needed for treatments" : doctorLabel(a)}</dd>
            <dt className="text-text-secondary">Date</dt>
            <dd>{fmtDate(a.date)}</dd>
            <dt className="text-text-secondary">Time</dt>
            <dd>
              {fmtTime(a.startTime)} to {fmtTime(a.endTime)}
            </dd>
            <dt className="text-text-secondary">Session</dt>
            <dd>{sessionNameFor(a.startTime)}</dd>
            <dt className="text-text-secondary">Persons</dt>
            <dd>{a.persons}</dd>
            {a.tokenNumber && (
              <>
                <dt className="text-text-secondary">Token number</dt>
                <dd className="font-semibold">{a.tokenNumber}</dd>
              </>
            )}
            <dt className="text-text-secondary">Reminder sent</dt>
            <dd>{a.reminderSent ? "Yes" : "No"}</dd>
            {a.notes && (
              <>
                <dt className="text-text-secondary">Notes</dt>
                <dd className="whitespace-pre-line">{a.notes}</dd>
              </>
            )}
            {a.cancelReason && (
              <>
                <dt className="text-text-secondary">Cancellation reason</dt>
                <dd>{a.cancelReason}</dd>
              </>
            )}
          </dl>
        </section>

        <section className={`${card} p-4`}>
          <h2 className="mb-3 font-heading text-lg font-semibold">Patient details</h2>
          <dl className={dl}>
            <dt className="text-text-secondary">Name</dt>
            <dd>{a.fullName}</dd>
            <dt className="text-text-secondary">Phone</dt>
            <dd>{a.phone}</dd>
            <dt className="text-text-secondary">Email</dt>
            <dd>{a.email ?? "Not given"}</dd>
            <dt className="text-text-secondary">Age and gender</dt>
            <dd>{[a.age, a.gender?.toLowerCase()].filter(Boolean).join(", ") || "Not given"}</dd>
            <dt className="text-text-secondary">Booked as</dt>
            <dd>{a.patientType === "NEW" ? "New patient" : "Follow-up"}</dd>
            <dt className="text-text-secondary">Same phone</dt>
            <dd>
              {others.length === 0
                ? "No other bookings"
                : others.map((h) => (
                    <Link key={h.id} href={`/admin/appointments/${h.id}`} className="mr-2 text-primary hover:underline">
                      {h.id}
                    </Link>
                  ))}
            </dd>
          </dl>
        </section>
      </div>

      <Link href={`/admin/appointments/new?from=${a.id}`} className={`${btnPlain} mt-6`}>
        Rebook this patient
      </Link>

      {live && (
        <section className={`${card} mt-6 p-4`}>
          <h2 className="mb-3 font-heading text-lg font-semibold">Actions</h2>
          <div className="flex flex-wrap items-end gap-3">
            {a.status === "PENDING" && (
              <form action={changeStatus}>
                {hidden("confirm")}
                <button className={btnPrimary}>Confirm appointment</button>
              </form>
            )}
            {a.status === "CONFIRMED" && (
              <form action={changeStatus}>
                {hidden("complete")}
                <button className={btnPrimary}>Mark completed</button>
              </form>
            )}
            <form action={changeStatus}>
              {hidden("no_show")}
              <button className={btnPlain}>Mark no-show</button>
            </form>
            <form action={changeStatus} className="flex flex-wrap items-end gap-2">
              {hidden("cancel")}
              <label className="text-sm font-semibold">
                Cancellation reason
                <input name="reason" required className={`${input} mt-1 sm:w-64`} />
              </label>
              <button className={btnDanger}>Cancel appointment</button>
            </form>
          </div>
          <p className="mt-2 text-xs text-text-secondary">Confirming notifies the patient and the admin. Completed and no-show can be set once the appointment time has started.</p>
        </section>
      )}

      {live && (
        <section className={`${card} mt-6 p-4`}>
          <h2 className="mb-1 font-heading text-lg font-semibold">Reschedule</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Pick a new date, then a time slot. {a.kind === "TREATMENT" ? "Treatment bookings have no capacity limit." : "Only slots with room are shown."} The patient is sent the new details with the cancel and reschedule links.
          </p>
          <form action={rescheduleByAdmin} className="space-y-4">
            <input type="hidden" name="id" value={a.id} />
            <SlotPicker endpoint="/admin/api/slots" excludeId={a.id} defaultSlotId={`${a.date}_${a.startTime}`} />
            <button className={btnPrimary}>Reschedule appointment</button>
          </form>
        </section>
      )}

      {a.status === "CANCELLED" && (
        <section className={`${card} mt-6 p-4`}>
          <h2 className="mb-2 font-heading text-lg font-semibold">Delete record</h2>
          <p className="mb-3 text-sm text-text-secondary">Only cancelled appointments can be deleted. This permanently removes the record and its notifications and cannot be undone.</p>
          <form action={deleteAppointmentAction}>
            <input type="hidden" name="id" value={a.id} />
            <button className={btnDanger}>Delete permanently</button>
          </form>
        </section>
      )}

    </>
  );
}
