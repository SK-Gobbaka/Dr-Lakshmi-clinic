import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { Download } from "lucide-react";
import { appointmentLabel, doctorLabel, listAppointments, listPatients } from "@/lib/local-store";
import { BackLink, PageTitle, StatusBadge, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function PatientsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  // A full 10-digit number lists every booking made with it, with a matching download.
  const phone = qDigits.replace(/^(91|0)(?=\d{10}$)/, "");
  const byPhone = /^\d{10}$/.test(phone)
    ? listAppointments().filter((a) => a.phone === phone).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
    : null;
  const rows = listPatients()
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q) || (qDigits.length >= 3 && p.phone.includes(qDigits)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <BackLink />
      <PageTitle sub="One patient per phone number. A patient is returning once they have a completed visit.">Patients</PageTitle>

      <form className="mb-4 flex items-end gap-2">
        <label className="text-sm font-semibold">
          Search by phone number, name or email
          <input name="q" defaultValue={one(sp.q)} className={`${input} mt-1 block w-72`} />
        </label>
        <button className={btnPrimary}>Search</button>
        <Link href="/admin/patients" className={btnPlain}>
          Clear
        </Link>
      </form>

      {byPhone && (
        <section className={`${card} mb-6 p-4`} aria-label="Appointments for this phone number">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold">
              {byPhone.length} appointment(s) for {phone}
            </h2>
            {byPhone.length > 0 && (
              <a href={`/admin/patients/download?phone=${phone}`} className={btnPlain} download>
                <Download className="h-4 w-4" /> Download
              </a>
            )}
          </div>
          {byPhone.length === 0 ? (
            <p className="text-sm text-text-secondary">No appointments were booked with this number.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border bg-sand/40">
                  <tr>
                    {["ID", "Name", "Appointment", "Type", "Doctor", "Status", "Token"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byPhone.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2">
                        <Link href={`/admin/appointments/${a.id}`} className="font-semibold text-primary hover:underline">
                          {a.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{a.fullName}</td>
                      <td className="px-3 py-2">
                        {fmtDate(a.date)}, {fmtTime(a.startTime)}
                      </td>
                      <td className="px-3 py-2">{appointmentLabel(a)}</td>
                      <td className="px-3 py-2">{doctorLabel(a)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={a.status} cancelledBy={a.cancelledBy} />
                      </td>
                      <td className="px-3 py-2">{a.tokenNumber ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {rows.length === 0 ? (
        <p className={`${card} p-6 text-text-secondary`}>No patients yet. They appear here after a booking is made.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <details key={p.phone} className={`${card} p-4`}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {p.name} <span className="font-normal text-text-secondary">· {p.phone}</span>
                </span>
                <span className="text-sm text-text-secondary">
                  {p.returning ? "Returning" : "New"} · {p.total} total · {p.upcoming} upcoming · {p.completed} completed · {p.cancelled} cancelled · {p.noShow} no-show
                </span>
              </summary>
              <Link href={`/admin/appointments/new?from=${p.appointments[0].id}`} className={`${btnPlain} mt-3 h-8`}>
                Rebook
              </Link>
              <p className="mt-2 text-sm text-text-secondary">
                {p.email ?? "No email"} · Last completed visit: {p.lastVisit ? fmtDate(p.lastVisit) : "none"}
              </p>
              <ul className="mt-3 divide-y divide-border text-sm">
                {p.appointments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/appointments/${a.id}`} className="font-semibold text-primary hover:underline">
                      {a.id}
                    </Link>
                    <span>
                      {fmtDate(a.date)}, {fmtTime(a.startTime)}
                    </span>
                    <StatusBadge status={a.status} cancelledBy={a.cancelledBy} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
