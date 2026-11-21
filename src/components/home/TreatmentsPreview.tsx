import Link from "next/link";
import { listTreatments } from "@/lib/clinic";
import { log } from "@/lib/logger";

/** Published treatments from the admin portal; the procedures under each live on the Treatments page. */
export async function TreatmentsPreview() {
  const all = await listTreatments({ publishedOnly: true }).catch((err) => {
    log.error("home.treatments_unavailable", err);
    return [];
  });
  const treatments = all.slice(0, 6);
  if (treatments.length === 0) return null;

  return (
    <section className="section bg-sand/50">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-4">
          <h2 className="section-title">Treatments we offer</h2>
          <p className="mt-4 max-w-[40ch] text-text-secondary">Every plan starts with a consultation, so you only get the treatment you need.</p>
          <Link href="/treatments" className="mt-6 inline-block font-semibold text-primary underline underline-offset-4 hover:text-[#17604E]">
            See all treatments in detail
          </Link>
        </div>

        <ul className="lg:col-span-8 divide-y divide-ink/15 border-y border-ink/15">
          {treatments.map((t) => (
            <li key={t.id}>
              <Link href={`/treatments#${t.slug}`} className="group flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
                <span className="font-heading text-xl font-semibold text-ink group-hover:text-primary">{t.name}</span>
                <span className="text-text-secondary sm:max-w-[34ch] sm:text-right">{t.subcategories.slice(0, 3).join(" · ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
