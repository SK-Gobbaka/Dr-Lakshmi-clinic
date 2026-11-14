"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle, Loader2, MapPin } from "lucide-react";
import { createTreatmentBooking, type PublicTreatment } from "@/actions/appointment";
import { SlotPicker } from "@/components/shared/SlotPicker";
import { HOSPITAL } from "@/lib/constants";

const field = "mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-primary";
const lbl = "block text-sm font-semibold text-ink";

/** Book a treatment: pick the treatment, a day and a time. No doctor to choose and no capacity limit. */
export function TreatmentBooking({ treatments, initialSlug }: { treatments: PublicTreatment[]; initialSlug?: string }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ id: string; token: string; status: string; treatment: string; when: string } | null>(null);
  const initial = treatments.find((t) => t.slug === initialSlug)?.id ?? "";

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const slotId = String(fd.get("slotId") ?? "");
    if (!slotId) {
      setError("Please choose a date and a time.");
      return;
    }
    const treatmentId = String(fd.get("treatmentId") ?? "");
    start(async () => {
      setError("");
      const r = await createTreatmentBooking({
        fullName: String(fd.get("fullName") ?? "").trim(),
        phone: String(fd.get("phone") ?? "").trim(),
        email: String(fd.get("email") ?? "").trim(),
        notes: String(fd.get("notes") ?? "").trim() || undefined,
        treatmentId,
        slotId,
        date: slotId.split("_")[0],
      });
      if (!r.success) return setError(r.error);
      const [date, time] = slotId.split("_");
      setDone({ id: r.data.appointmentId, token: r.data.confirmationToken, status: r.data.status, treatment: treatments.find((t) => t.id === treatmentId)?.name ?? "", when: `${date} ${time}` });
    });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <CheckCircle className="mx-auto h-12 w-12 text-success" />
        <h2 className="mt-4 font-heading text-2xl font-semibold text-ink">{done.status === "PENDING" ? "Treatment booked, awaiting confirmation" : "Treatment booking confirmed"}</h2>
        <p className="mt-2 text-text-secondary">We are sending the details, the clinic map and your cancel and reschedule links to your WhatsApp.</p>
        <dl className="mt-6 space-y-1 rounded-xl bg-sand/40 p-4 text-left text-sm">
          <div>
            <dt className="inline font-semibold">Booking ID: </dt>
            <dd className="inline">{done.id}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Treatment: </dt>
            <dd className="inline">{done.treatment}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Date and time: </dt>
            <dd className="inline">{done.when}</dd>
          </div>
          <div className="flex items-start gap-2 pt-1">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{HOSPITAL.address.full}</span>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-semibold">
          <a href={HOSPITAL.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            Open map
          </a>
          <Link href={`/book/reschedule/${done.token}`} className="text-primary underline underline-offset-4">
            Reschedule
          </Link>
          <Link href={`/book/cancel/${done.token}`} className="text-danger underline underline-offset-4">
            Cancel
          </Link>
          <Link href="/my-appointments" className="text-ink underline underline-offset-4">
            My appointments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      <label className={lbl}>
        Treatment *
        <select name="treatmentId" required defaultValue={initial} className={field}>
          <option value="" disabled>
            Choose a treatment
          </option>
          {treatments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={lbl}>
          Your name *
          <input name="fullName" required minLength={2} maxLength={100} autoComplete="name" className={field} />
        </label>
        <label className={lbl}>
          Mobile number *
          <input name="phone" required inputMode="numeric" pattern="\d{10}" maxLength={10} title="10 digits" autoComplete="tel-national" className={field} />
        </label>
      </div>
      <label className={lbl}>
        Email (optional)
        <input name="email" type="email" autoComplete="email" className={field} />
      </label>
      <SlotPicker endpoint="/api/treatment-slots" showRemaining={false} />
      <label className={lbl}>
        Anything we should know (optional)
        <textarea name="notes" rows={3} maxLength={500} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary" />
      </label>
      <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-white hover:bg-[#17604E] disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Booking..." : "Book treatment"}
      </button>
      <p className="text-center text-xs text-text-secondary">Treatment bookings have no daily limit, and you do not need to pick a doctor.</p>
    </form>
  );
}
