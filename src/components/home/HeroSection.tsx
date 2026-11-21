import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import type { SiteSettings } from "@/lib/clinic/types";
import { telHref } from "@/lib/site-info";

export function HeroSection({ site }: { site: SiteSettings }) {
  const tel = telHref(site);
  const hasRating = site.googleRating !== null && site.googleReviewCount !== null && site.googleReviewCount > 0;
  return (
    <section className="py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h1 className="hero-in font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] text-ink">Hair and skin care, led by Dr.&nbsp;Lakshmi</h1>
            <p className="hero-in hero-in-2 mt-6 max-w-[52ch] text-lg text-text-secondary">
              Our doctors look for the cause first, then build a treatment plan around your hair or skin, not a standard package.
            </p>
            <div className="hero-in hero-in-3 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/book" className="rounded-full bg-primary text-center px-8 py-3.5 text-base font-semibold text-white hover:bg-[#17604E] transition-colors">
                Book appointment
              </Link>
              <Link href="/book/treatment" className="rounded-full border border-primary text-center px-8 py-3.5 text-base font-semibold text-primary hover:bg-primary/10 transition-colors">
                Book treatment
              </Link>
              {tel && (
                <a href={tel} className="rounded-full border border-ink/30 text-center px-8 py-3.5 text-base font-semibold text-ink hover:bg-sand/60 transition-colors">
                  Call now
                </a>
              )}
            </div>
            {hasRating && (
              <p className="hero-in hero-in-3 mt-8 flex items-center gap-2 text-sm text-text-secondary">
                <Star className="h-4 w-4 fill-warning text-warning" aria-hidden />
                <span>
                  <strong className="text-ink">{site.googleRating}</strong> on Google from {site.googleReviewCount!.toLocaleString("en-IN")} reviews
                </span>
              </p>
            )}
          </div>

          <div className="hero-in hero-in-2 lg:col-span-5 rounded-[2rem] bg-sand p-6 sm:p-10 select-none">
            <Image src="/hero-illustration.png" alt="Skin & Hair Consultation" width={400} height={460} className="w-full h-auto max-w-sm mx-auto object-contain" priority />
          </div>
        </div>
      </div>
    </section>
  );
}
