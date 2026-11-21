import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { bookingContext } from "@/lib/booking-page";
import { getByToken } from "@/lib/clinic";
import { BRAND } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Reschedule Appointment",
  description: `Reschedule your appointment at ${BRAND.name}.`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReschedulePage({ params }: Props) {
  const { token } = await params;
  const [appointment, ctx] = await Promise.all([getByToken(token), bookingContext()]);

  if (!appointment || (appointment.status !== "CONFIRMED" && appointment.status !== "PENDING")) {
    notFound();
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border bg-white p-4 mb-4 text-sm text-text-secondary">
          Rescheduling appointment for <strong>{appointment.fullName}</strong>. Select a new date and time below.
        </div>
      </div>
      <BookingWizard mode="reschedule" rescheduleToken={token} {...ctx} />
    </div>
  );
}
