import type { Metadata } from "next";
import { getPublicSite } from "@/lib/content";
import { BRAND, displayPhone } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${BRAND.name}`,
};

export const dynamic = "force-dynamic"; // the contact details come from Admin > Contact & site details

const h2 = "font-heading text-xl font-semibold text-text-primary";

export default async function PrivacyPage() {
  const site = await getPublicSite();
  const contact = [site.email, displayPhone(site)].filter(Boolean).join(" or ");

  return (
    <div className="bg-background min-h-screen py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Privacy Policy</h1>
        <p className="mt-2 text-text-secondary">Last updated: November 2026</p>

        <div className="mt-8 prose prose-slate max-w-none space-y-6 text-text-secondary">
          <section>
            <h2 className={h2}>Information we collect</h2>
            <p className="mt-2 leading-relaxed">
              When you book an appointment we collect your name, mobile number, age, gender and whether you are a new or follow-up patient, and your email address if you give one. We also keep the details of the booking itself: the
              date, time, doctor or treatment, and its status. We use this only to manage your appointment and to contact you about it.
            </p>
          </section>
          <section>
            <h2 className={h2}>How we use your information</h2>
            <p className="mt-2 leading-relaxed">
              We use it to schedule and confirm appointments, to send you booking confirmations, changes, cancellations and reminders on WhatsApp, and to run the clinic. We do not sell your information and we do not use it for advertising.
            </p>
          </section>
          <section>
            <h2 className={h2}>Who handles it for us</h2>
            <p className="mt-2 leading-relaxed">
              Your details are stored in a cloud database and the website runs on a cloud hosting service. When WhatsApp messages are switched on, your mobile number and the appointment details in the message are passed to WhatsApp
              (Meta) so that it can deliver them. These providers process your data only to provide their service to us.
            </p>
          </section>
          <section>
            <h2 className={h2}>Who can see it</h2>
            <p className="mt-2 leading-relaxed">
              Only clinic staff who sign in to the admin portal can see appointment details. Each staff member has their own account, and the portal records who changed what. Anyone with your private booking link can view,
              change or cancel that one appointment, so please do not share the link.
            </p>
          </section>
          <section>
            <h2 className={h2}>Cookies</h2>
            <p className="mt-2 leading-relaxed">The website sets a sign-in cookie for clinic staff only. It does not use advertising or analytics cookies.</p>
          </section>
          <section>
            <h2 className={h2}>Your choices</h2>
            <p className="mt-2 leading-relaxed">
              You can ask the clinic to correct your details or to delete your appointment records. We will do this unless we are required to keep them for medical or legal reasons.
            </p>
          </section>
          <section>
            <h2 className={h2}>Contact us</h2>
            <p className="mt-2 leading-relaxed">{contact ? <>For privacy questions, contact us at {contact}.</> : <>For privacy questions, please ask at the clinic.</>}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
