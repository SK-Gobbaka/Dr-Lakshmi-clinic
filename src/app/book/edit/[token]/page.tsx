import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppointmentByToken, getAppointmentTypes } from "@/actions/appointment";
import { PatientEditForm } from "@/components/booking/PatientEditForm";

export const metadata: Metadata = { title: "Edit Appointment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getAppointmentByToken(token);
  if (!a) notFound();
  const live = a.status === "CONFIRMED" || a.status === "PENDING";
  const types = await getAppointmentTypes();
  // keep a deactivated current type selectable so an edit of other fields does not lose it
  const current = "typeId" in a ? (a.typeId as string | null) : null;
  if (current && !types.some((t) => t.id === current)) {
    types.push({ id: current, name: `${"typeName" in a ? String(a.typeName) : "Current type"} (current)`, description: "" });
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-cyan-500/[0.04] sm:p-8">
          <h1 className="font-heading text-2xl font-bold text-text-primary">Edit appointment</h1>
          {"id" in a && typeof a.id === "string" && <p className="mt-1 text-sm text-text-secondary">Appointment ID: {a.id}</p>}
          {a.kind === "TREATMENT" ? (
            <p className="mt-6 text-sm text-text-secondary">
              Treatment bookings can be changed by rescheduling or cancelling.{" "}
              <Link href={`/book/reschedule/${token}`} className="font-semibold text-primary underline">
                Reschedule
              </Link>{" "}
              or{" "}
              <Link href={`/book/cancel/${token}`} className="font-semibold text-danger underline">
                cancel
              </Link>
              .
            </p>
          ) : !live ? (
            <p className="mt-6 text-sm text-text-secondary">
              This appointment is {String(a.status).toLowerCase().replace("_", "-")} and can no longer be edited.{" "}
              <Link href="/book" className="font-semibold text-primary underline">
                Book a new appointment
              </Link>
            </p>
          ) : (
            <div className="mt-6">
              <PatientEditForm
                token={token}
                types={types}
                values={{
                  fullName: a.fullName,
                  phone: a.phone,
                  email: a.email,
                  age: (a.age as number | null) ?? null,
                  gender: (a.gender as string | null) ?? null,
                  patientType: a.patientType,
                  typeId: current,
                  notes: ("notes" in a ? (a.notes as string | null) : null) ?? null,
                  persons: ("persons" in a ? (a.persons as number) : 1) ?? 1,
                  slotId: "date" in a && typeof a.date === "string" ? `${a.date}_${a.startTime}` : "",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
