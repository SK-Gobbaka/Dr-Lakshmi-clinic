import Link from "next/link";
import { requireOwner } from "@/lib/admin-auth";
import { listMessages } from "@/lib/clinic";
import { PageTitle, btnPlain, card, fmtStamp, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

const TONE = { SENT: "bg-green-50 text-green-800", FAILED: "bg-red-50 text-red-800", SKIPPED: "bg-gray-100 text-gray-700" } as const;

export default async function MessagesPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const problems = one((await searchParams).problems) === "1";
  const rows = await listMessages(200, problems);

  return (
    <>
      <PageTitle
        sub="Every message the system tried to send. Phone numbers are masked and message text is not stored. Skipped means the connection is not set up (see Integrations); failed means the provider refused it."
        action={
          <Link href={problems ? "/admin/messages" : "/admin/messages?problems=1"} className={btnPlain}>
            {problems ? "Show all" : "Show problems only"}
          </Link>
        }
      >
        Message log
      </PageTitle>

      {rows.length === 0 ? (
        <p className={`${card} p-6 text-text-secondary`}>{problems ? "No failed or skipped messages." : "No messages yet. They appear here after a booking is made."}</p>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Message log</caption>
            <thead className="border-b border-border bg-sand/40">
              <tr>
                {["When", "Appointment", "Message", "To", "Result"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={`${r.at}-${i}`}>
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">{fmtStamp(r.at)}</td>
                  <td className="px-3 py-2">
                    {r.appointmentId ? (
                      <Link href={`/admin/appointments/${r.appointmentId}`} className="font-semibold text-primary hover:underline">
                        {r.appointmentId}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">{r.event.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-3 py-2">{r.recipient}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>{r.status.toLowerCase()}</span>
                    {r.error && <div className="mt-1 text-xs text-text-secondary">{r.error}</div>}
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
