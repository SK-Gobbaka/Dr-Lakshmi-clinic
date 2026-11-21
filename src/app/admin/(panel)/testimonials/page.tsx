import { deleteTestimonialAction, saveTestimonialAction } from "@/actions/admin";
import { requireOwner } from "@/lib/admin-auth";
import { listTestimonials, type Testimonial } from "@/lib/content";
import { Empty, Notice, PageTitle, btnDanger, btnPrimary, card, input, label, one, textarea, type SP } from "../../ui";

export const dynamic = "force-dynamic";

function TestimonialForm({ t }: { t?: Testimonial }) {
  return (
    <form action={saveTestimonialAction} className="space-y-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={label}>
          Patient name *
          <input name="name" required minLength={2} maxLength={60} defaultValue={t?.name} placeholder="First name and initial" className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Treatment (optional)
          <input name="treatment" maxLength={60} defaultValue={t?.treatment} className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Rating (optional)
          <select name="rating" defaultValue={t?.rating ?? ""} className={`${input} mt-1`}>
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} out of 5
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={label}>
        What the patient said *
        <textarea name="quote" required minLength={10} maxLength={600} rows={3} defaultValue={t?.quote} className={`${textarea} mt-1`} />
      </label>
      <div className="flex flex-wrap gap-6 text-sm font-semibold">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="consentConfirmed" defaultChecked={t?.consentConfirmed} /> The patient gave written consent to publish this
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={t?.published} /> Show on the home page
        </label>
      </div>
      <button className={btnPrimary}>{t ? "Save testimonial" : "Add testimonial"}</button>
    </form>
  );
}

export default async function TestimonialsAdminPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const sp = await searchParams;
  const items = await listTestimonials();

  return (
    <>
      <PageTitle sub="Real patient words only. A testimonial can be shown on the website only after you confirm the patient's written consent. The section stays hidden until one is published.">Testimonials</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add a testimonial</h2>
        <TestimonialForm />
      </section>

      <h2 className="mb-3 font-heading text-lg font-semibold">All testimonials ({items.length})</h2>
      {items.length === 0 ? (
        <Empty>No testimonials yet.</Empty>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <details key={t.id} className={`${card} p-4`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="font-semibold">{t.name}</span>
                {t.treatment && <span className="text-sm text-text-secondary">{t.treatment}</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.published ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-700"}`}>{t.published ? "Published" : "Not published"}</span>
                {!t.consentConfirmed && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Consent not confirmed</span>}
              </summary>
              <div className="mt-4">
                <TestimonialForm t={t} />
                <form action={deleteTestimonialAction} className="mt-4 border-t border-border pt-4">
                  <input type="hidden" name="id" value={t.id} />
                  <button className={btnDanger}>Delete testimonial</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
