import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listPatients } from "@/lib/local-store";
import { BackLink, PageTitle, StatusBadge, btnPlain, btnPrimary, card, fmtDate, fmtTime, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function PatientsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const rows = listPatients()
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q) || (qDigits.length >= 3 && p.phone.includes(qDigits)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <BackLink />
      <PageTitle sub="One patient per phone number. A patient is returning once they have a completed visit.">Patients</PageTitle>

      <form className="mb-4 flex items-end gap-2">
        <label className="text-sm font-semibold">
          Search name, phone or email
          <input name="q" defaultValue={one(sp.q)} className={`${input} mt-1 block w-72`} />
        </label>
        <button className={btnPrimary}>Search</button>
        <Link href="/admin/patients" className={btnPlain}>
          Clear
        </Link>
      </form>

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
                    <StatusBadge status={a.status} />
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
