"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createAppointmentAdmin } from "@/actions/admin";
import { AppointmentForm, type FormDoctor, type FormType } from "./AppointmentForm";

export function AddAppointmentDialog({ types, doctors, openByDefault = false }: { types: FormType[]; doctors: FormDoctor[]; openByDefault?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  const show = useCallback(() => {
    setKey((k) => k + 1); // fresh form each time
    setOpen(true);
    ref.current?.showModal();
  }, []);
  const close = useCallback(() => {
    ref.current?.close();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!openByDefault) return;
    const t = setTimeout(show, 0);
    return () => clearTimeout(t);
  }, [openByDefault, show]);

  return (
    <>
      <button type="button" onClick={show} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-[#17604E]">
        <Plus className="h-4 w-4" /> Add appointment
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} className="m-auto max-h-[92vh] w-[min(42rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-border p-0 shadow-2xl backdrop:bg-black/40">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-3">
          <h2 className="font-heading text-lg font-semibold text-ink">Add appointment</h2>
          <button type="button" onClick={close} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-sand/60">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{open && <AppointmentForm key={key} action={createAppointmentAdmin} types={types} doctors={doctors} withStatus submitLabel="Create appointment" onDone={close} />}</div>
      </dialog>
    </>
  );
}
