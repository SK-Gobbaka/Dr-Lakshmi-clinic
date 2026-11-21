import { WHY_CHOOSE_US } from "@/lib/content-static";

export function WhyChooseUs() {
  return (
    <section className="section">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 className="section-title">How we work</h2>

        <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_CHOOSE_US.map((item) => (
            <div key={item.title} className="border-t border-ink/20 pt-4">
              <dt className="font-heading text-xl font-semibold text-ink">{item.title}</dt>
              <dd className="mt-2 text-text-secondary">{item.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
