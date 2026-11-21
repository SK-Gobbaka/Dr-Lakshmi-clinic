"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { saveTreatmentAction } from "@/actions/admin";
import { SubmitButton } from "./SubmitButton";

const inp = "mt-1 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-primary";
const lbl = "block text-sm font-semibold text-ink";

export interface TreatmentFormValues {
  id: string;
  name: string;
  subcategories: string[];
  published: boolean;
}

/** Image + title + any number of subcategories. Shared by "Add" and by editing an existing treatment. */
export function TreatmentForm({ t, onCancel }: { t?: TreatmentFormValues; onCancel?: () => void }) {
  const [subs, setSubs] = useState<string[]>(t?.subcategories.length ? t.subcategories : [""]);

  return (
    <form action={saveTreatmentAction} className="space-y-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <label className={lbl}>
        Treatment title *
        <input name="name" required maxLength={80} defaultValue={t?.name} className={inp} />
      </label>
      <label className={lbl}>
        Treatment image (optional; JPG, PNG or WebP, up to 2 MB){t ? ". Leave empty to keep the current image." : ""}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
      </label>

      <fieldset>
        <legend className={lbl}>Subcategories</legend>
        <div className="mt-1 space-y-2">
          {subs.map((value, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="subcategory"
                value={value}
                maxLength={80}
                placeholder={`Subcategory ${i + 1}`}
                aria-label={`Subcategory ${i + 1}`}
                onChange={(e) => setSubs((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                className={inp.replace("mt-1 ", "")}
              />
              <button
                type="button"
                aria-label={`Remove subcategory ${i + 1}`}
                onClick={() => setSubs((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [""]))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white hover:bg-sand/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setSubs((list) => [...list, ""])} className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-ink hover:border-primary/30 hover:bg-sand/50">
          <Plus className="h-4 w-4" /> Add subcategory
        </button>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="published" defaultChecked={t ? t.published : true} /> Published (shown on the Treatments page)
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-60">{t ? "Save treatment" : "Save new treatment"}</SubmitButton>
        {onCancel && (
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center rounded-xl border border-border bg-white px-5 text-sm font-semibold text-ink hover:bg-sand/50">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** The "Add" button; the form opens underneath it. */
export function AddTreatment() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8]">
          <Plus className="h-4 w-4" /> Add
        </button>
      )}
      {open && (
        <section className="admin-card rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="mb-3 font-heading text-lg font-semibold">Add a treatment</h2>
          <TreatmentForm onCancel={() => setOpen(false)} />
        </section>
      )}
    </div>
  );
}
