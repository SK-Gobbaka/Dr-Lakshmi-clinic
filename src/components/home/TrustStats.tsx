import type { SiteSettings } from "@/lib/clinic/types";

/** Figures the clinic typed into Admin > Contact & site details (plus its Google rating, if entered). Nothing is shown until then. */
export function TrustStats({ site }: { site: SiteSettings }) {
  const stats = [...site.trustStats];
  if (site.googleRating !== null) stats.push({ label: "Google rating", value: `${site.googleRating}★` });
  if (stats.length === 0) return null;
  return (
    <section className="border-y border-border" aria-label="Clinic at a glance">
      <dl className="mx-auto grid max-w-[1200px] grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-flow-col md:auto-cols-fr lg:px-8">
        {stats.map((stat) => (
          <div key={stat.label} className="md:border-l md:border-border md:pl-6 md:first:border-l-0 md:first:pl-0">
            <dd className="font-heading text-3xl font-semibold text-ink">{stat.value}</dd>
            <dt className="mt-1 text-sm text-text-secondary">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
