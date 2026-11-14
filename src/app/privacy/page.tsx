import type { Metadata } from "next";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${HOSPITAL.name}`,
};

export default function PrivacyPage() {
  return (
    <div className="bg-background min-h-screen py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Privacy Policy</h1>
        <p className="mt-2 text-text-secondary">Last updated: June 2026</p>

        <div className="mt-8 prose prose-slate max-w-none space-y-6 text-text-secondary">
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              Information We Collect
            </h2>
            <p className="mt-2 leading-relaxed">
              When you book an appointment, we collect your name, phone number, email (optional),
              age, gender, and patient type. This information is used solely for appointment
              management and communication regarding your visit.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              How We Use Your Information
            </h2>
            <p className="mt-2 leading-relaxed">
              Your information is used to schedule appointments, send confirmations and reminders
              via WhatsApp, and provide you with quality healthcare services. We do not sell or
              share your personal information with third parties for marketing purposes.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              Data Security
            </h2>
            <p className="mt-2 leading-relaxed">
              We implement industry-standard security measures to protect your personal and
              medical information. All data is stored securely and accessed only by authorized
              personnel.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold text-text-primary">Contact Us</h2>
            <p className="mt-2 leading-relaxed">
              For privacy-related inquiries, contact us at {HOSPITAL.email} or call{" "}
              {HOSPITAL.phoneDisplay}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
