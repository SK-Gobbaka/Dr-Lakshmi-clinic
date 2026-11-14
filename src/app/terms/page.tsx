import type { Metadata } from "next";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${HOSPITAL.name}`,
};

export default function TermsPage() {
  return (
    <div className="bg-background min-h-screen py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Terms of Service</h1>
        <p className="mt-2 text-text-secondary">Last updated: June 2026</p>

        <div className="mt-8 space-y-6 text-text-secondary">
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              Appointment Booking
            </h2>
            <p className="mt-2 leading-relaxed">
              By booking an appointment through our website, you agree to provide accurate
              information and arrive 10-15 minutes before your scheduled time. Late arrivals
              may result in rescheduling.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              Cancellation Policy
            </h2>
            <p className="mt-2 leading-relaxed">
              Please cancel or reschedule at least 4 hours before your appointment. Repeated
              no-shows may affect your ability to book future appointments online.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              Medical Disclaimer
            </h2>
            <p className="mt-2 leading-relaxed">
              Information on this website is for general purposes only and does not constitute
              medical advice. Always consult with a qualified healthcare professional for
              diagnosis and treatment.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">Contact</h2>
            <p className="mt-2 leading-relaxed">
              Questions about these terms? Contact {HOSPITAL.email} or {HOSPITAL.phoneDisplay}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
