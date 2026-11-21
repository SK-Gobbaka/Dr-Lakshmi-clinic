import { deleteFaqAction, saveFaqAction } from "@/actions/admin";
import { requireOwner } from "@/lib/admin-auth";
import { listFaqs, type Faq } from "@/lib/content";
import { Empty, Notice, PageTitle, btnDanger, btnPrimary, card, input, label, one, textarea, type SP } from "../../ui";

export const dynamic = "force-dynamic";

function FaqForm({ f }: { f?: Faq }) {
  return (
    <form action={saveFaqAction} className="space-y-4">
      {f && <input type="hidden" name="id" value={f.id} />}
      <label className={label}>
        Question *
        <input name="question" required minLength={5} maxLength={160} defaultValue={f?.question} className={`${input} mt-1`} />
      </label>
      <label className={label}>
        Answer *
        <textarea name="answer" required minLength={5} maxLength={1000} rows={3} defaultValue={f?.answer} className={`${textarea} mt-1`} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="published" defaultChecked={f ? f.published : true} /> Shown on the home page
      </label>
      <button className={btnPrimary}>{f ? "Save FAQ" : "Add FAQ"}</button>
    </form>
  );
}

export default async function FaqsAdminPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const sp = await searchParams;
  const faqs = await listFaqs();

  return (
    <>
      <PageTitle sub="Common questions shown on the home page. New questions go to the end of the list.">FAQs</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add a question</h2>
        <FaqForm />
      </section>

      <h2 className="mb-3 font-heading text-lg font-semibold">All questions ({faqs.length})</h2>
      {faqs.length === 0 ? (
        <Empty>No questions yet. The FAQ section stays hidden until you add one.</Empty>
      ) : (
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.id} className={`${card} p-4`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="font-semibold">{f.question}</span>
                {!f.published && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">Hidden</span>}
              </summary>
              <div className="mt-4">
                <FaqForm f={f} />
                <form action={deleteFaqAction} className="mt-4 border-t border-border pt-4">
                  <input type="hidden" name="id" value={f.id} />
                  <button className={btnDanger}>Delete question</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
