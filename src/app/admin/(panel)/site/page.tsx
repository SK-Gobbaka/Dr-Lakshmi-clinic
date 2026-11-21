import { saveSiteSettingsAction } from "@/actions/admin";
import { requireOwner } from "@/lib/admin-auth";
import { getSiteSettings } from "@/lib/content";
import { Notice, PageTitle, btnPrimary, card, input, label, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

const hint = "mt-1 text-xs font-normal text-text-secondary";

export default async function SiteSettingsPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const sp = await searchParams;
  const s = await getSiteSettings();
  const stats = Array.from({ length: 6 }, (_, i) => s.trustStats[i] ?? { label: "", value: "" });

  return (
    <>
      <PageTitle sub="Shown on the website and used in the messages sent to patients. Anything left empty is simply not shown.">Contact &amp; site details</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <form action={saveSiteSettingsAction} className="space-y-6">
        <section className={`${card} p-4 sm:p-6`} aria-labelledby="contact-h">
          <h2 id="contact-h" className="font-heading text-lg font-semibold">
            Contact
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Phone number (for the Call buttons)
              <input name="phone" inputMode="tel" defaultValue={s.phone} placeholder="+91 98765 43210" className={`${input} mt-1`} />
              <span className={`${hint} block`}>Include the country code. Call buttons appear once this is filled in.</span>
            </label>
            <label className={label}>
              Phone number as shown on the website
              <input name="phoneDisplay" defaultValue={s.phoneDisplay} placeholder="+91 98765 43210" className={`${input} mt-1`} />
            </label>
            <label className={label}>
              WhatsApp number (for the chat link)
              <input name="whatsappNumber" inputMode="tel" defaultValue={s.whatsappNumber} className={`${input} mt-1`} />
              <span className={`${hint} block`}>This is only the website chat link. Booking messages are sent from the WhatsApp Business connection under Integrations.</span>
            </label>
            <label className={label}>
              Email address
              <input name="email" type="email" defaultValue={s.email} className={`${input} mt-1`} />
            </label>
          </div>
        </section>

        <section className={`${card} p-4 sm:p-6`} aria-labelledby="where-h">
          <h2 id="where-h" className="font-heading text-lg font-semibold">
            Address and opening hours
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Address line 1
              <input name="addressLine1" defaultValue={s.addressLine1} className={`${input} mt-1`} />
            </label>
            <label className={label}>
              Address line 2
              <input name="addressLine2" defaultValue={s.addressLine2} className={`${input} mt-1`} />
            </label>
            <label className={label}>
              PIN code
              <input name="pincode" inputMode="numeric" maxLength={6} defaultValue={s.pincode} className={`${input} mt-1`} />
            </label>
            <label className={label}>
              Opening hours
              <input name="workingHours" defaultValue={s.workingHours} placeholder="Mon-Sat: 9 am - 12 pm & 5 pm - 10 pm" className={`${input} mt-1`} />
            </label>
            <label className={label}>
              Closed day
              <input name="closedDay" defaultValue={s.closedDay} placeholder="Sun: Holiday" className={`${input} mt-1`} />
            </label>
            <label className={label}>
              Google Maps link (optional)
              <input name="googleMapsUrl" type="url" defaultValue={s.googleMapsUrl} placeholder="https://maps.google.com/..." className={`${input} mt-1`} />
              <span className={`${hint} block`}>The map on the website is drawn from the address above.</span>
            </label>
          </div>
        </section>

        <section className={`${card} p-4 sm:p-6`} aria-labelledby="social-h">
          <h2 id="social-h" className="font-heading text-lg font-semibold">
            Social links and reviews
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["instagramUrl", "Instagram page", s.instagramUrl],
                ["facebookUrl", "Facebook page", s.facebookUrl],
                ["xUrl", "X (Twitter) page", s.xUrl],
                ["youtubeUrl", "YouTube channel", s.youtubeUrl],
                ["googleReviewUrl", "Google review link (sent after a visit)", s.googleReviewUrl],
              ] as const
            ).map(([name, text, value]) => (
              <label key={name} className={label}>
                {text}
                <input name={name} type="url" defaultValue={value} placeholder="https://" className={`${input} mt-1`} />
              </label>
            ))}
            <label className={label}>
              Google rating (1 to 5)
              <input name="googleRating" inputMode="decimal" defaultValue={s.googleRating ?? ""} className={`${input} mt-1`} />
            </label>
            <label className={label}>
              Number of Google reviews
              <input name="googleReviewCount" inputMode="numeric" defaultValue={s.googleReviewCount ?? ""} className={`${input} mt-1`} />
              <span className={`${hint} block`}>Enter the rating and count only if they are real and current. They appear on the home page.</span>
            </label>
          </div>
        </section>

        <section className={`${card} p-4 sm:p-6`} aria-labelledby="stats-h">
          <h2 id="stats-h" className="font-heading text-lg font-semibold">
            Figures on the home page
          </h2>
          <p className="mt-1 text-sm text-text-secondary">For example &ldquo;Years of experience&rdquo; and its number. Only enter figures you can stand behind. Rows left empty are not shown.</p>
          <div className="mt-4 space-y-3">
            {stats.map((st, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <input name={`statLabel${i}`} defaultValue={st.label} maxLength={40} placeholder="Label" aria-label={`Figure ${i + 1} label`} className={input} />
                <input name={`statValue${i}`} defaultValue={st.value} maxLength={20} placeholder="Value" aria-label={`Figure ${i + 1} value`} className={input} />
              </div>
            ))}
          </div>
        </section>

        <button className={btnPrimary}>Save details</button>
      </form>
    </>
  );
}
