import { Star } from "lucide-react";
import { listTestimonials } from "@/lib/content";
import { log } from "@/lib/logger";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-warning text-warning" : "text-border"}`} aria-hidden />
      ))}
    </div>
  );
}

/** Only testimonials the clinic published after confirming the patient's consent (Admin > Testimonials). */
export async function Testimonials() {
  const items = await listTestimonials({ publishedOnly: true }).catch((err) => {
    log.error("home.testimonials_unavailable", err);
    return [];
  });
  if (items.length === 0) return null;
  return (
    <section className="section" id="testimonials">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 className="section-title">What patients say</h2>

        <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.id} className="flex flex-col gap-4 border-t-2 border-ink pt-5">
              {t.rating && <StarRating rating={t.rating} />}
              <blockquote className="font-heading text-lg leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-auto text-sm text-text-secondary">
                <span className="font-semibold text-ink">{t.name}</span>
                {t.treatment ? `, ${t.treatment}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
