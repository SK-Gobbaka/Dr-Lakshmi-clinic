import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelForm } from "@/components/booking/CancelForm";
import { appointmentLabel, getByToken } from "@/lib/clinic";
import { formatLongDate, formatTime12Hour } from "@/lib/utils";

export const metadata: Metadata = { title: "Cancel Appointment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const shell = "bg-background min-h-screen flex items-center justify-center px-4";
const box = "max-w-md w-full rounded-2xl border border-border bg-white p-8 shadow-sm";

export default async function CancelAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getByToken(token);
  if (!a) notFound();

  // Only a pending or confirmed appointment can be cancelled; say what happened to the others instead of showing a dead form.
  if (a.status !== "PENDING" && a.status !== "CONFIRMED") {
    return (
      <div className={shell}>
        <div className={`${box} text-center`}>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{a.status === "CANCELLED" ? "Already cancelled" : "Nothing to cancel"}</h1>
          <p className="mt-2 text-text-secondary">
            Appointment {a.id} is {a.status.toLowerCase().replace("_", "-")}.
          </p>
          <Link href="/book" className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-[#17604E]">
            Book a new appointment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className={box}>
        <CancelForm token={token} summary={{ id: a.id, name: a.fullName, what: appointmentLabel(a), when: `${formatLongDate(a.date)}, ${formatTime12Hour(a.startTime)}` }} />
      </div>
    </div>
  );
}
