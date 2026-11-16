import type { Metadata } from "next";
import Link from "next/link";
import { getTreatmentsForBooking } from "@/actions/appointment";
import { BookingWizard } from "@/components/booking/BookingWizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a treatment",
  description: "Book a hair, skin or laser treatment at Dr. Lakshmi Skin & Hair Clinic. No doctor to choose and no daily limit.",
};

export default async function BookTreatmentPage({ searchParams }: { searchParams: Promise<{ treatment?: string }> }) {
  const [{ treatment }, treatments] = await Promise.all([searchParams, getTreatmentsForBooking()]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mx-auto mb-8 max-w-xl text-center">
        <h1 className="font-heading text-3xl font-semibold text-ink sm:text-4xl">Book a treatment</h1>
        <p className="mt-2 text-text-secondary">
          Choose the treatment and a time that suits you. Need advice first? <Link href="/book" className="font-semibold text-primary underline underline-offset-4">Book a consultation</Link> instead.
        </p>
      </header>
      {treatments.length === 0 ? (
        <p className="mx-auto max-w-xl rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">Treatments are not available to book right now. Please call the clinic.</p>
      ) : (
        <BookingWizard mode="treatment" treatments={treatments} initialTreatmentId={treatments.find((x) => x.slug === treatment)?.id ?? ""} />
      )}
    </div>
  );
}
