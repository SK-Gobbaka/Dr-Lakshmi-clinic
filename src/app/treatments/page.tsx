import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { listTreatments } from "@/lib/local-store";

// Treatments are edited in the admin portal, so this page is always rendered fresh.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Treatments",
  description: "Hair, skin and laser treatments at Dr. Lakshmi Skin & Hair Clinic: what each treatment is, who it suits, how it works and what to expect.",
};

const CATEGORY_LABEL = { hair: "Hair treatment", skin: "Skin treatment", laser: "Laser treatment" } as const;

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-sm font-semibold text-ink">{term}</dt>
      <dd className="mt-1 text-text-secondary">{children}</dd>
    </div>
  );
}

export default function TreatmentsPage() {
  const treatments = listTreatments({ publishedOnly: true });

  return (
    <div className="min-h-screen">
      <section className="py-14">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-4xl font-semibold text-ink sm:text-5xl">Our treatments</h1>
          <p className="mt-4 max-w-[60ch] text-lg text-text-secondary">
            What each treatment is, who it suits, how it works and what to expect afterwards. The doctor confirms what is right for you at your consultation.
          </p>
          <nav aria-label="Treatments" className="mt-6 flex flex-wrap gap-2">
            {treatments.map((t) => (
              <a key={t.id} href={`#${t.slug}`} className="rounded-full border border-border bg-white px-4 py-1.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary">
                {t.name}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-[1200px] space-y-10 px-4 sm:px-6 lg:px-8">
          {treatments.length === 0 && <p className="text-text-secondary">Our treatment list is being updated. Please call the clinic for details.</p>}
          {treatments.map((t) => (
            <article key={t.id} id={t.slug} className="scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-white">
              <div className="grid lg:grid-cols-[22rem_1fr]">
                <div className="relative aspect-[3/2] lg:aspect-auto lg:min-h-full">
                  <Image src={t.image} alt={t.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 352px" />
                </div>
                <div className="space-y-5 p-6 sm:p-8">
                  <div>
                    <p className="text-sm font-semibold text-primary">{CATEGORY_LABEL[t.category]}</p>
                    <h2 className="mt-1 font-heading text-2xl font-semibold text-ink sm:text-3xl">{t.name}</h2>
                    <p className="mt-2 text-lg text-text-secondary">{t.shortDescription}</p>
                  </div>

                  {t.description && <p className="max-w-[70ch] leading-relaxed text-ink">{t.description}</p>}

                  <dl className="grid gap-5 sm:grid-cols-2">
                    <Fact term="Who it is for">{t.suitableFor}</Fact>
                    <Fact term="How it works">{t.procedure}</Fact>
                    <Fact term="Each session">{t.duration}</Fact>
                    <Fact term="Number of sessions">{t.sessions}</Fact>
                    <Fact term="Aftercare">{t.aftercare}</Fact>
                  </dl>

                  {t.benefits.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Benefits</h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {t.benefits.map((b) => (
                          <li key={b} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link href={`/book/treatment?treatment=${t.slug}`} className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-white hover:bg-[#17604E] transition-colors">
                      Book this treatment
                    </Link>
                    <Link href="/book" className="rounded-full border border-ink/30 px-6 py-3 text-base font-semibold text-ink hover:bg-sand/60 transition-colors">
                      Book a consultation first
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-ink py-14 text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="max-w-xl">
            <h2 className="font-heading text-3xl font-semibold leading-tight">Not sure which treatment you need?</h2>
            <p className="mt-2 text-white/75">Book a consultation and the doctor will recommend a plan, or call us.</p>
          </div>
          <div className="flex flex-wrap gap-3">
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
