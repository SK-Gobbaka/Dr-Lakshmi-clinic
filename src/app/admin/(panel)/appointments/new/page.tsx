import Link from "next/link";
import { createByAdmin } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getAppointment, listDoctors, listPatients, listSlots } from "@/lib/local-store";
import { addDaysUTC, formatDateForApi, parseApiDate, slotStartsAt, todayIST } from "@/lib/slots";
import { Notice, PageTitle, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../../ui";

const nowMs = () => Date.now();

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;

  // Rebook: ?from=APT-0001 copies that patient's details; otherwise use whatever the form sent back.
  const from = getAppointment(one(sp.from));
  const v = (k: string, fallback = "") => one(sp[k]) || fallback;
  const d = {
    fullName: v("fullName", from?.fullName),
    phone: v("phone", from?.phone),
    age: v("age", from ? String(from.age) : ""),
    gender: v("gender", from?.gender ?? ""),
    email: v("email", from?.email ?? ""),
    patientType: v("patientType", from ? "FOLLOW_UP" : "NEW"),
    doctorId: v("doctorId", from?.doctorId ?? ""),
  };
  const doctors = listDoctors({ publishedOnly: true });

  const find = one(sp.find).trim().toLowerCase();
  const findDigits = find.replace(/\D/g, "");
  const matches = find
    ? listPatients()
        .filter((p) => p.name.toLowerCase().includes(find) || (findDigits.length >= 3 && p.phone.includes(findDigits)))
        .slice(0, 8)
    : [];

  const today = formatDateForApi(todayIST());
  const date = v("date", today);
  const slots = listSlots(date).filter((s) => slotStartsAt(parseApiDate(date), s.startTime).getTime() > nowMs());

  return (
    <>
      <Link href="/admin/appointments" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
        Back to appointments
      </Link>
      <PageTitle sub="Book for a walk-in or phone call, or rebook a returning patient.">New appointment</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <form className={`${card} mb-6 flex flex-wrap items-end gap-2 p-4`}>
        <label className="text-sm font-semibold">
          Find existing patient (name or number)
          <input name="find" defaultValue={one(sp.find)} className={`${input} mt-1 block w-72`} />
        </label>
        <button className={btnPlain}>Find</button>
        {find && matches.length === 0 && <p className="text-sm text-text-secondary">No patient found. Fill in the details below.</p>}
      </form>
      {matches.length > 0 && (
        <ul className={`${card} mb-6 divide-y divide-border text-sm`}>
          {matches.map((p) => (
            <li key={p.phone} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span>
                <span className="font-semibold">{p.name}</span> · {p.phone} · {p.total} booking(s)
              </span>
              <Link href={`/admin/appointments/new?from=${p.appointments[0].id}`} className={`${btnPlain} h-8`}>
                Rebook
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={createByAdmin} className={`${card} space-y-4 p-4`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Full name
            <input name="fullName" required defaultValue={d.fullName} className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-sm font-semibold">
            Mobile number (10 digits)
            <input name="phone" required inputMode="numeric" pattern="\d{10}" defaultValue={d.phone} className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-sm font-semibold">
            Age
            <input name="age" type="number" min={1} max={120} required defaultValue={d.age} className={`${input} mt-1 block w-full`} />
          </label>
          <label className="text-sm font-semibold">
            Gender
            <select name="gender" required defaultValue={d.gender} className={`${input} mt-1 block w-full`}>
              <option value="">Select</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Patient type
            <select name="patientType" defaultValue={d.patientType} className={`${input} mt-1 block w-full`}>
              <option value="NEW">New patient</option>
              <option value="FOLLOW_UP">Follow-up</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Doctor to consult
            <select name="doctorId" required defaultValue={d.doctorId} className={`${input} mt-1 block w-full`}>
              <option value="" disabled>
                Select a doctor
              </option>
              {doctors.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Email (optional)
            <input name="email" type="email" defaultValue={d.email} className={`${input} mt-1 block w-full`} />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-semibold">
            Date
            <input type="date" name="date" min={today} max={formatDateForApi(addDaysUTC(todayIST(), 30))} defaultValue={date} className={`${input} mt-1 block`} />
          </label>
          {/* GET submit keeps everything typed so far and reloads the slot list for the chosen date */}
          <button formAction="/admin/appointments/new" formMethod="get" formNoValidate className={btnPlain}>
            Show slots
          </button>
        </div>

        {slots.length === 0 ? (
          <p className="text-sm text-text-secondary">No slots left on {fmtDate(date)} (Sundays are closed). Choose another date.</p>
        ) : (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Time slot</legend>
            {slots.map((s) => {
              const full = s.remaining <= 0;
              const off = s.disabled || full;
              return (
                <label key={s.id} className={`rounded-md border border-border px-3 py-2 text-sm ${off ? "opacity-50" : "cursor-pointer"}`}>
                  <input type="radio" name="slotId" value={s.id} disabled={off} className="mr-2" />
                  {fmtTime(s.startTime)}
                  <span className="ml-2 text-xs text-text-secondary">{s.disabled ? "disabled" : full ? "full" : `${s.remaining} left`}</span>
                </label>
              );
            })}
          </fieldset>
        )}
        <button className={btnPrimary}>Book appointment</button>
      </form>
    </>
  );
}
