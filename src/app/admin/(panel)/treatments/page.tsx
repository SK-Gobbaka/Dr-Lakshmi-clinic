import Image from "next/image";
import { deleteTreatmentAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { listTreatments } from "@/lib/local-store";
import { AddTreatment, TreatmentForm } from "@/components/admin/TreatmentForm";
import { Empty, Notice, PageTitle, btnDanger, card, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function TreatmentsAdminPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const treatments = listTreatments();

  return (
    <>
      <PageTitle sub="Each treatment has an image, a title and its subcategories. What you save here appears on the public Treatments page." action={<AddTreatment />}>
        Treatments
      </PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <h2 className="mb-3 font-heading text-lg font-semibold">All treatments ({treatments.length})</h2>
      {treatments.length === 0 ? (
        <Empty>No treatments yet. Press Add to create the first one.</Empty>
      ) : (
        <div className="space-y-3">
          {treatments.map((t) => (
            <details key={t.id} className={`${card} p-4`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <Image src={t.image} alt="" width={64} height={48} className="h-12 w-16 rounded-md object-cover" />
                <span className="font-semibold">{t.name}</span>
                <span className="text-sm text-text-secondary">{t.subcategories.length} subcategories</span>
                {!t.published && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">Unpublished</span>}
              </summary>
              <div className="mt-4">
                <TreatmentForm t={{ id: t.id, name: t.name, subcategories: t.subcategories, published: t.published }} />
                <form action={deleteTreatmentAction} className="mt-4 border-t border-border pt-4">
                  <input type="hidden" name="id" value={t.id} />
                  <button className={btnDanger}>Delete treatment</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
