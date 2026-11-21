import Link from "next/link";
import type { Metadata } from "next";
import { listTreatments } from "@/lib/clinic";
import { Photo } from "@/components/shared/Photo";

// Treatments are edited in the admin portal, so this page is always rendered fresh.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Treatments",
  description: "Hair and skin treatments at Dr. Lakshmi Skin & Hair Clinic, with the procedures offered under each.",
};

export default async function TreatmentsPage() {
  const treatments = await listTreatments({ publishedOnly: true });

  return (
    <div className="min-h-screen">
      <section className="py-14">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-4xl font-semibold text-ink sm:text-5xl">Our treatments</h1>
          <p className="mt-4 max-w-[60ch] text-lg text-text-secondary">
            Each treatment is listed with the procedures we offer under it. The doctor confirms what is right for you at your consultation.
          </p>
          {treatments.length > 0 && (
            <nav aria-label="Treatments" className="mt-6 flex flex-wrap gap-2">
              {treatments.map((t) => (
                <a key={t.id} href={`#${t.slug}`} className="rounded-full border border-border bg-white px-4 py-1.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary">
                  {t.name}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-[1200px] space-y-8 px-4 sm:px-6 lg:px-8">
          {treatments.length === 0 && <p className="text-text-secondary">Our treatment list is being updated. Please check back soon, or book a consultation.</p>}
          {treatments.map((t) => (
            <article key={t.id} id={t.slug} className="scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-white">
              <div className={t.image ? "grid lg:grid-cols-[18rem_1fr]" : undefined}>
                {t.image && (
                  <div className="relative aspect-[3/2] lg:aspect-auto lg:min-h-full">
                    <Photo src={t.image} alt={t.name} fallbackName={t.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 288px" />
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <h2 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">{t.name}</h2>
                  {t.subcategories.length > 0 ? (
                    <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                      {t.subcategories.map((sub) => (
                        <li key={sub} className="flex items-start gap-2 text-ink">
                          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          {sub}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-text-secondary">Details are available at the clinic.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* The call to action sits in its own band, apart from the content boxes above. */}
      <section className="bg-ink py-14 text-white">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <h2 className="font-heading text-3xl font-semibold leading-tight">Not sure which treatment you need?</h2>
            <p className="mt-2 text-white/75">Book a consultation and the doctor will recommend a plan, or call us.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book" className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-ink hover:bg-sand transition-colors">
              Book appointment
            </Link>
            <Link href="/book/treatment" className="rounded-full border border-white/50 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
              Book treatment
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
