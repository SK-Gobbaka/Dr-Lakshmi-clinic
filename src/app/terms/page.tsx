import type { Metadata } from "next";
import { getPublicSite } from "@/lib/content";
import { BRAND, displayPhone } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${BRAND.name}`,
};

export const dynamic = "force-dynamic"; // the contact details come from Admin > Contact & site details

const h2 = "font-heading text-xl font-semibold text-text-primary";

export default async function TermsPage() {
  const site = await getPublicSite();
  const contact = [site.email, displayPhone(site)].filter(Boolean).join(" or ");

  return (
    <div className="bg-background min-h-screen py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Terms of Service</h1>
        <p className="mt-2 text-text-secondary">Last updated: November 2026</p>

        <div className="mt-8 space-y-6 text-text-secondary">
          <section>
            <h2 className={h2}>Appointment booking</h2>
            <p className="mt-2 leading-relaxed">
              By booking an appointment through our website, you agree to give accurate information and to arrive 10 to 15 minutes before your scheduled time. Late arrivals may result in rescheduling. A booking may wait as
              &ldquo;pending&rdquo; until the clinic confirms it.
            </p>
          </section>
          <section>
            <h2 className={h2}>Cancellation policy</h2>
            <p className="mt-2 leading-relaxed">
              Please cancel or reschedule at least 4 hours before your appointment, using the link in your booking message. Repeated no-shows may affect your ability to book future appointments online.
            </p>
          </section>
          <section>
            <h2 className={h2}>Medical disclaimer</h2>
            <p className="mt-2 leading-relaxed">
              Information on this website is for general purposes only and does not constitute medical advice. Always consult with a qualified healthcare professional for diagnosis and treatment.
            </p>
          </section>
          <section>
            <h2 className={h2}>Contact</h2>
            <p className="mt-2 leading-relaxed">{contact ? <>Questions about these terms? Contact {contact}.</> : <>Questions about these terms? Please ask at the clinic.</>}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
