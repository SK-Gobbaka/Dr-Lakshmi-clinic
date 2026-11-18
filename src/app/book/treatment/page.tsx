import type { Metadata } from "next";
import Link from "next/link";
import { BookingWizard } from "@/components/booking/BookingWizard";

export const metadata: Metadata = {
  title: "Book a treatment",
  description: "Book a hair or skin treatment at Dr. Lakshmi Skin & Hair Clinic. Pick a date and a time slot.",
};

export const dynamic = "force-dynamic";

/** Date, time slot, and four patient details (name, age, gender, phone). No treatment, type or doctor to choose. */
export default function BookTreatmentPage() {
  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto max-w-xl px-4 pt-10 text-center">
        <h1 className="font-heading text-3xl font-semibold text-ink sm:text-4xl">Book a treatment</h1>
        <p className="mt-2 text-text-secondary">
          Choose a date and a time slot. See what we offer on the{" "}
          <Link href="/treatments" className="font-semibold text-primary underline underline-offset-4">
            Treatments page
          </Link>
          .
        </p>
      </header>
      <BookingWizard mode="treatment" />
    </div>
  );
}
