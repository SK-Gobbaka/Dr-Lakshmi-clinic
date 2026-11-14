"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { updateMyAppointment } from "@/actions/appointment";
import { SlotPicker } from "@/components/shared/SlotPicker";

interface Props {
  token: string;
  types: { id: string; name: string }[];
  values: {
    fullName: string;
    phone: string;
    email: string | null;
    age: number | null;
    gender: string | null;
    patientType: string;
    typeId: string | null;
    notes: string | null;
    persons: number;
    slotId: string;
  };
}

const inp = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10";
const lbl = "block text-sm font-bold text-text-primary";

export function PatientEditForm({ token, types, values }: Props) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setError("");
    setSaved(false);
    start(async () => {
      const r = await updateMyAppointment({
        token,
        fullName: get("fullName"),
        phone: get("phone"),
        email: get("email"),
        age: get("age"),
        gender: get("gender"),
        patientType: get("patientType"),
        typeId: get("typeId"),
        persons: values.persons,
        notes: get("notes"),
        slotId: get("slotId"),
      });
      if (r.success) setSaved(true);
      else setError(r.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Your appointment was updated successfully. The clinic has been notified.{" "}
          <Link href="/my-appointments" className="underline">
            Back to My Appointments
          </Link>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={lbl}>
          Name
          <input name="fullName" required defaultValue={values.fullName} className={inp} />
        </label>
        <label className={lbl}>
          Mobile number
          <input name="phone" required inputMode="numeric" maxLength={10} pattern="\d{10}" title="10 digits" defaultValue={values.phone} className={inp} />
        </label>
        <label className={lbl}>
          Email (optional)
          <input name="email" type="email" defaultValue={values.email ?? ""} className={inp} />
        </label>
        <label className={lbl}>
          Appointment type
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
          Age
          <input name="age" type="number" min={1} max={120} defaultValue={values.age ?? ""} className={inp} />
        </label>
        <label className={lbl}>
          Gender
          <select name="gender" defaultValue={values.gender ?? ""} className={inp}>
            <option value="">Not given</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className={lbl}>
          Patient type
          <select name="patientType" defaultValue={values.patientType} className={inp}>
            <option value="NEW">New patient</option>
            <option value="FOLLOW_UP">Follow-up</option>
          </select>
        </label>
      </div>
      <SlotPicker endpoint="/api/slots" excludeId={token} defaultSlotId={values.slotId} />
      <label className={lbl}>
        Notes (optional)
        <textarea name="notes" rows={3} maxLength={500} defaultValue={values.notes ?? ""} className={inp} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full border-2 border-[#1F7A63] bg-[#1F7A63] px-8 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#17604E] disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
