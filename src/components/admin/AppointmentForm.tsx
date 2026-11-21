"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { FormState } from "@/actions/admin";
import { SlotPicker } from "@/components/shared/SlotPicker";

export interface FormType {
  id: string;
  name: string;
}
export interface FormDoctor {
  id: string;
  name: string;
}
export interface FormValues {
  id?: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  patientType?: string;
  typeId?: string | null;
  doctorId?: string | null;
  persons?: number;
  notes?: string | null;
  slotId?: string;
  status?: string;
}

const inp = "mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary";
const lbl = "block text-sm font-semibold text-ink";

/** Used for both manual entry (create) and editing; keeps the typed values when the server rejects them. */
export function AppointmentForm({
  action,
  types,
  doctors = [],
  values = {},
  submitLabel,
  withStatus,
  onDone,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  types: FormType[];
  doctors?: FormDoctor[];
  values?: FormValues;
  submitLabel: string;
  withStatus?: boolean;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.notice) {
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {state.error}
        </p>
      )}
      {state?.notice && !onDone && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          {state.notice}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={lbl}>
          Customer name *
          <input name="fullName" required defaultValue={values.fullName} className={inp} />
        </label>
        <label className={lbl}>
          Mobile number *
          <input name="phone" required inputMode="numeric" maxLength={10} pattern="\d{10}" title="10 digits" defaultValue={values.phone} className={inp} />
        </label>
        <label className={lbl}>
          Email (optional)
          <input name="email" type="email" defaultValue={values.email ?? ""} className={inp} />
        </label>
        <label className={lbl}>
          Appointment type *
          <select name="typeId" required defaultValue={values.typeId ?? ""} className={inp}>
            <option value="" disabled>
              Select a type
            </option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          Doctor to consult *
          <select name="doctorId" required defaultValue={values.doctorId ?? ""} className={inp}>
            <option value="" disabled>
              Select a doctor
            </option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value="OTHERS">Other Doctors</option>
          </select>
        </label>
        <label className={lbl}>
          Number of persons
          <input name="persons" type="number" min={1} max={20} defaultValue={values.persons ?? 1} className={inp} />
        </label>
        <label className={lbl}>
          Patient type
          <select name="patientType" defaultValue={values.patientType ?? "NEW"} className={inp}>
            <option value="NEW">New patient</option>
            <option value="FOLLOW_UP">Follow-up</option>
          </select>
        </label>
        <label className={lbl}>
          Age (optional)
          <input name="age" type="number" min={1} max={120} defaultValue={values.age ?? ""} className={inp} />
        </label>
        <label className={lbl}>
          Gender (optional)
          <select name="gender" defaultValue={values.gender ?? ""} className={inp}>
            <option value="">Not given</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>
      <SlotPicker endpoint="/admin/api/slots" excludeId={values.id} defaultSlotId={values.slotId} />
      {withStatus && (
        <label className={lbl}>
          Status
          <select name="status" defaultValue={values.status ?? "CONFIRMED"} className={inp}>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
          </select>
        </label>
      )}
      <label className={lbl}>
        Additional notes
        <textarea name="notes" rows={3} maxLength={500} defaultValue={values.notes ?? ""} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-[#17604E] disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
