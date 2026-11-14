import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listAudit } from "@/lib/local-store";
import { BackLink, PageTitle, card, fmtStamp } from "../../ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireAdmin();
  const rows = listAudit().slice(0, 200);

  return (
    <>
      <BackLink />
      <PageTitle sub="Latest 200 admin and patient actions, newest first.">Audit log</PageTitle>
      {rows.length === 0 ? (
        <p className={`${card} p-6 text-text-secondary`}>Nothing recorded yet. Confirming, cancelling or rescheduling an appointment adds an entry here.</p>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-sand/40">
              <tr>
                {["When", "Who", "Action", "Details"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">{fmtStamp(r.at)}</td>
                  <td className="px-3 py-2">{r.actor}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">
                    {r.entityId ? (
                      <Link href={`/admin/appointments/${r.entityId}`} className="text-primary hover:underline">
                        {r.summary}
                      </Link>
                    ) : (
                      r.summary
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
