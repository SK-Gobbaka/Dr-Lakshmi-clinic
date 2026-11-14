import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getMyAppointments, getMyNotifications } from "@/actions/appointment";
import { MarkReadButton } from "@/components/booking/MarkReadButton";
import { formatLongDate, formatTime12Hour } from "@/lib/utils";

export const metadata: Metadata = { title: "My Appointments", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending confirmation", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  CONFIRMED: { label: "Confirmed", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  COMPLETED: { label: "Completed", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-50 text-red-800 border-red-200" },
  NO_SHOW: { label: "Missed", cls: "bg-gray-100 text-gray-700 border-gray-200" },
};

export default async function MyAppointmentsPage() {
  const [appointments, notes] = await Promise.all([getMyAppointments(), getMyNotifications()]);

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold text-text-primary">My Appointments</h1>
          <Link href="/book" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17604E]">
            Book an appointment
          </Link>
        </div>
        <p className="mt-2 text-sm text-text-secondary">Appointments booked from this browser, for you or for anyone else, each with its own status.</p>

        {appointments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-8 text-center text-text-secondary">
            No appointments were booked from this browser yet. If you have a link from WhatsApp, open it to manage that appointment.
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {appointments.map((a) => {
              const st = STATUS[a.status] ?? STATUS.PENDING;
              const live = a.status === "PENDING" || a.status === "CONFIRMED";
              return (
                <li key={a.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{a.id}</p>
                      <p className="text-lg font-bold text-text-primary">{a.fullName}</p>
                      <p className="text-sm text-text-secondary">{a.phone}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="inline text-text-secondary">Type: </dt>
                      <dd className="inline font-semibold">{a.typeName}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-secondary">Date: </dt>
                      <dd className="inline font-semibold">{formatLongDate(a.date)}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-secondary">Time: </dt>
                      <dd className="inline font-semibold">{formatTime12Hour(a.startTime)}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-secondary">Session: </dt>
                      <dd className="inline font-semibold">{a.sessionName}</dd>
                    </div>
                  </dl>
                  {a.needsAttention && live && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      The clinic is closed on this date. Please choose a new date or wait for the clinic to contact you.
                    </p>
                  )}
                  {a.cancelReason && a.status === "CANCELLED" && <p className="mt-3 text-sm text-text-secondary">Reason: {a.cancelReason}</p>}
                  {live && (
                    <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wider">
                      <Link href={`/book/edit/${a.token}`} className="rounded-full border border-teal-600 px-4 py-2 text-teal-700 hover:bg-teal-50">
                        Edit / change date
                      </Link>
                      <Link href={`/book/cancel/${a.token}`} className="rounded-full border border-danger px-4 py-2 text-danger hover:bg-danger/5">
                        Cancel
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-bold text-text-primary">
            Notifications {notes.unread > 0 && <span className="ml-1 rounded-full bg-danger px-2 py-0.5 align-middle text-xs font-bold text-white">{notes.unread} new</span>}
          </h2>
          {notes.unread > 0 && <MarkReadButton label="Mark all as read" />}
        </div>
        {notes.items.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary">No notifications yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {notes.items.map((n) => (
              <li key={n.id} className={`rounded-2xl border p-4 ${n.readAt ? "border-gray-100 bg-white" : "border-teal-200 bg-teal-50/40"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-text-primary">{n.title}</p>
                  <span className="text-xs text-text-secondary">{new Date(n.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-text-secondary">{n.message}</p>
                {!n.readAt && (
                  <div className="mt-2">
                    <MarkReadButton id={n.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
