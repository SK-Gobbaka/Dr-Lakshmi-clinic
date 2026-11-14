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
import { HOSPITAL } from "@/lib/constants";
import { getSeniorDoctor } from "@/lib/local-store";

export const dynamic = "force-dynamic"; // doctors and treatments are edited in the admin portal

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  name: HOSPITAL.name,
  description: HOSPITAL.shortDescription,
  url: siteUrl,
  telephone: HOSPITAL.phone,
  email: HOSPITAL.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: HOSPITAL.address.line1,
    addressLocality: "Hyderabad",
    addressRegion: "Telangana",
    postalCode: "500032",
    addressCountry: "IN",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "12:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "17:00",
      closes: "22:00",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: HOSPITAL.googleRating,
    reviewCount: HOSPITAL.googleReviewCount,
  },
  medicalSpecialty: ["Dermatology", "Trichology"],
  image: `${siteUrl}/og-image.jpg`,
};

export default function HomePage() {
  const senior = getSeniorDoctor();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HeroSection />
      <TrustStats />
      <AboutSection />
      {senior && <SeniorConsultant doctor={senior} />}
      <DoctorsPreview />
      <TreatmentsPreview />
      <WhyChooseUs />
      <PatientJourney />
      <Gallery />
      <Testimonials />
      <FAQSection />
      <FinalCTA />
    </>
  );
}
