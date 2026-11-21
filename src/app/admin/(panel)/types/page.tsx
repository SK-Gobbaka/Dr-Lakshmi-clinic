import { deleteTypeAction, saveTypeAction, toggleTypeAction } from "@/actions/admin";
import { requireOwner } from "@/lib/admin-auth";
import { listTypes, typeUsage } from "@/lib/clinic";
import { Notice, PageTitle, btnDanger, btnPlain, btnPrimary, card, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function TypesPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const sp = await searchParams;
  const [types, usage] = await Promise.all([listTypes(), typeUsage()]);

  return (
    <>
      <PageTitle sub="Patients choose one of the active types when booking. Deactivating hides a type from new bookings. Deleting removes it, and appointments that used it keep its name.">Appointment types</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <div className="space-y-3">
        {types.map((t) => (
          <section key={t.id} className={`${card} p-4 ${t.active ? "" : "opacity-70"}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-text-secondary">
                {usage[t.id] ?? 0} appointment(s) · {t.active ? "Active" : "Inactive"}
              </span>
              <div className="flex gap-2">
              <form action={toggleTypeAction}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="active" value={String(!t.active)} />
                <button className={`${btnPlain} h-9`}>{t.active ? "Deactivate" : "Activate"}</button>
              </form>
              <form action={deleteTypeAction}>
                <input type="hidden" name="id" value={t.id} />
                <button className={`${btnDanger} h-9`} aria-label={`Delete ${t.name}`}>Delete</button>
              </form>
              </div>
            </div>
            <form action={saveTypeAction} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <input type="hidden" name="id" value={t.id} />
              <label className="text-sm font-semibold">
                Name
                <input name="name" required defaultValue={t.name} className={`${input} mt-1`} />
              </label>
              <label className="text-sm font-semibold">
                Description
                <input name="description" defaultValue={t.description} maxLength={200} className={`${input} mt-1`} />
              </label>
              <button className={btnPlain}>Save</button>
            </form>
          </section>
        ))}
      </div>

      <section className={`${card} mt-6 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add appointment type</h2>
        <form action={saveTypeAction} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <label className="text-sm font-semibold">
            Name
            <input name="name" required className={`${input} mt-1`} />
          </label>
          <label className="text-sm font-semibold">
            Description
            <input name="description" maxLength={200} className={`${input} mt-1`} />
          </label>
          <button className={btnPrimary}>Add type</button>
        </form>
      </section>
    </>
  );
}
