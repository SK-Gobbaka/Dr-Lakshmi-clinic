import { PATIENT_JOURNEY } from "@/lib/content-static";

// Genuinely sequential content, so numbered steps are appropriate here.
export function PatientJourney() {
  return (
    <section className="section bg-sand/50">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 className="section-title">What to expect at your visit</h2>

        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PATIENT_JOURNEY.map((s) => (
            <li key={s.step} className="flex flex-col gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-heading font-semibold text-white"
                aria-hidden
              >
                {s.step}
              </span>
              <h3 className="mt-2 font-heading text-xl font-semibold text-ink">{s.title}</h3>
              <p className="text-text-secondary">{s.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
