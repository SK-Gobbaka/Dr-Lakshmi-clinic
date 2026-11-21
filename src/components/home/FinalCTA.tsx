import Link from "next/link";
import type { SiteSettings } from "@/lib/clinic/types";
import { telHref } from "@/lib/site-info";

export function FinalCTA({ site }: { site: SiteSettings }) {
  const tel = telHref(site);
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="max-w-xl">
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold leading-tight">Book a consultation and get a plan made for you</h2>
          <p className="mt-3 text-white/75">{tel ? "Pick a time online in a few minutes, or call and we will find one for you." : "Pick a time online in a few minutes."}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/book" className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-ink hover:bg-sand transition-colors">
            Book appointment
          </Link>
          <Link href="/book/treatment" className="rounded-full border border-white/50 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
            Book treatment
          </Link>
          {tel && (
            <a href={tel} className="rounded-full border border-white/50 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
              Call now
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
