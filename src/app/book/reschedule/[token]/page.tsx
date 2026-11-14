import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { getAppointmentByToken } from "@/actions/appointment";
import { notFound } from "next/navigation";
export const metadata: Metadata = {
  title: "Reschedule Appointment",
  description: "Reschedule your appointment at Lakshmi Hair & Skin Hospital.",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReschedulePage({ params }: Props) {
  const { token } = await params;
  const appointment = await getAppointmentByToken(token);

  if (!appointment || (appointment.status !== "CONFIRMED" && appointment.status !== "PENDING")) {
    notFound();
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border bg-white p-4 mb-4 text-sm text-text-secondary">
          Rescheduling appointment for <strong>{appointment.fullName}</strong>.
          Select a new date and time below.
        </div>
      </div>
      <BookingWizard mode="reschedule" rescheduleToken={token} />
    </div>
  );
}
