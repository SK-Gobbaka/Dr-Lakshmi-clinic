import Image from "next/image";
import { deleteTreatmentAction, saveTreatmentAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { listTreatments, type Treatment } from "@/lib/local-store";
import { Empty, Notice, PageTitle, btnDanger, btnPrimary, card, input, label, one, textarea, type SP } from "../../ui";

export const dynamic = "force-dynamic";

function TreatmentForm({ t }: { t?: Treatment }) {
  return (
    <form action={saveTreatmentAction} className="space-y-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Treatment name *
          <input name="name" required maxLength={80} defaultValue={t?.name} className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Category *
          <select name="category" required defaultValue={t?.category ?? "skin"} className={`${input} mt-1`}>
            <option value="hair">Hair</option>
            <option value="skin">Skin</option>
            <option value="laser">Laser</option>
          </select>
        </label>
        <label className={label}>
          Duration of a session
          <input name="duration" maxLength={60} defaultValue={t?.duration} placeholder="e.g. 45 mins per session" className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Number of sessions
          <input name="sessions" maxLength={120} defaultValue={t?.sessions} placeholder="e.g. 4 to 6 sessions" className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Display order (smaller shows first)
          <input name="sortOrder" type="number" defaultValue={t?.sortOrder} placeholder="auto" className={`${input} mt-1`} />
        </label>
      </div>
      <label className={label}>
        Short description * (10 to 200 characters, shown in lists)
        <input name="shortDescription" required minLength={10} maxLength={200} defaultValue={t?.shortDescription} className={`${input} mt-1`} />
      </label>
      <label className={label}>
        About this treatment
        <textarea name="description" rows={3} maxLength={2000} defaultValue={t?.description} className={`${textarea} mt-1`} />
      </label>
      <label className={label}>
        Who it is for
        <textarea name="suitableFor" rows={2} maxLength={600} defaultValue={t?.suitableFor} className={`${textarea} mt-1`} />
      </label>
      <label className={label}>
        How the procedure works
        <textarea name="procedure" rows={3} maxLength={1500} defaultValue={t?.procedure} className={`${textarea} mt-1`} />
      </label>
      <label className={label}>
        Benefits (one per line)
        <textarea name="benefits" rows={3} defaultValue={t?.benefits.join("\n")} className={`${textarea} mt-1`} />
      </label>
      <label className={label}>
        Aftercare
        <textarea name="aftercare" rows={2} maxLength={1000} defaultValue={t?.aftercare} className={`${textarea} mt-1`} />
      </label>
      <label className={label}>
        Photo (JPG, PNG or WebP, up to 2 MB){t ? ". Leave empty to keep the current photo." : ""}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="published" defaultChecked={t ? t.published : true} /> Published (shown on the website and available to book)
      </label>
      <button className={btnPrimary}>{t ? "Save treatment" : "Add treatment"}</button>
    </form>
  );
}

export default async function TreatmentsAdminPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const treatments = listTreatments();

  return (
    <>
      <PageTitle sub="Treatments you add, change or delete here update the Treatments page, the home page and the Book treatment form.">Treatments</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add a treatment</h2>
        <TreatmentForm />
      </section>

      <h2 className="mb-3 font-heading text-lg font-semibold">All treatments ({treatments.length})</h2>
      {treatments.length === 0 ? (
        <Empty>No treatments yet. Add one above.</Empty>
      ) : (
        <div className="space-y-3">
          {treatments.map((t) => (
            <details key={t.id} className={`${card} p-4`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <Image src={t.image} alt="" width={64} height={48} className="h-12 w-16 rounded-md object-cover" />
                <span className="font-semibold">{t.name}</span>
                <span className="text-sm capitalize text-text-secondary">{t.category}</span>
                {!t.published && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">Unpublished</span>}
              </summary>
              <div className="mt-4">
                <TreatmentForm t={t} />
                <form action={deleteTreatmentAction} className="mt-4 border-t border-border pt-4">
                  <input type="hidden" name="id" value={t.id} />
                  <button className={btnDanger}>Delete treatment</button>
                  <p className="mt-2 text-xs text-text-secondary">A treatment with pending or confirmed bookings cannot be deleted; unpublish it instead.</p>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
