import { HeroSection } from "@/components/home/HeroSection";
import { TrustStats } from "@/components/home/TrustStats";
import { AboutSection } from "@/components/home/AboutSection";
import { SeniorConsultant } from "@/components/home/SeniorConsultant";
import { DoctorsPreview } from "@/components/home/DoctorsPreview";
import { TreatmentsPreview } from "@/components/home/TreatmentsPreview";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { PatientJourney } from "@/components/home/PatientJourney";
import { Gallery } from "@/components/home/Gallery";
import { Testimonials } from "@/components/home/Testimonials";
import { FAQSection } from "@/components/home/FAQSection";
import { FinalCTA } from "@/components/home/FinalCTA";
import { getSeniorDoctor } from "@/lib/clinic";
import { getPublicSite } from "@/lib/content";
import { log } from "@/lib/logger";
import { BRAND, fullAddress } from "@/lib/site-info";
import { siteUrl } from "@/lib/site-url";
import type { SiteSettings } from "@/lib/clinic/types";

export const dynamic = "force-dynamic"; // doctors, treatments and content are edited in the admin portal

/** Search-engine data built only from what the clinic has saved; empty details are left out, never guessed. */
function structuredData(site: SiteSettings, url: string) {
  const street = [site.addressLine1, site.addressLine2].filter(Boolean).join(", ");
  return {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: BRAND.name,
    description: BRAND.shortDescription,
    url,
    ...(site.phone && { telephone: site.phone }),
    ...(site.email && { email: site.email }),
    ...(fullAddress(site) && {
      address: { "@type": "PostalAddress", streetAddress: street, ...(site.pincode && { postalCode: site.pincode }), addressLocality: "Hyderabad", addressRegion: "Telangana", addressCountry: "IN" },
    }),
    ...(site.googleRating && site.googleReviewCount && { aggregateRating: { "@type": "AggregateRating", ratingValue: site.googleRating, reviewCount: site.googleReviewCount } }),
    medicalSpecialty: ["Dermatology"],
  };
}

export default async function HomePage() {
  const [site, url] = await Promise.all([getPublicSite(), siteUrl()]);
  // The senior consultant is optional content: if the database is unreachable the rest of the page still renders.
  const senior = await getSeniorDoctor().catch((err) => {
    log.error("home.senior_unavailable", err);
    return null;
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(site, url)).replace(/</g, "\\u003c") }} />
      <HeroSection site={site} />
      <TrustStats site={site} />
      <AboutSection />
      {senior && <SeniorConsultant doctor={senior} />}
      <DoctorsPreview />
      <TreatmentsPreview />
      <WhyChooseUs />
      <PatientJourney />
      <Gallery />
      <Testimonials />
      <FAQSection />
      <FinalCTA site={site} />
    </>
  );
}
