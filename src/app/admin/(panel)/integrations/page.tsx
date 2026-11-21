import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { requireOwner } from "@/lib/admin-auth";
import { integrationStatus } from "@/lib/env";
import { WHATSAPP_TEMPLATES } from "@/lib/integrations/whatsapp";
import { storageMode } from "@/lib/integrations/storage";
import { PageTitle, card } from "../../ui";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireOwner();
  const items = integrationStatus();
  const mode = storageMode();

  return (
    <>
      <PageTitle sub="What is connected and what is not. Connections are switched on by adding settings (secrets) to the server; this page never shows their values.">Integrations</PageTitle>

      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.key} className={`${card} flex gap-3 p-4`}>
            {i.configured ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden /> : i.required ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden /> : <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" aria-hidden />}
            <div className="min-w-0">
              <p className="font-semibold">
                {i.name}{" "}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${i.configured ? "bg-green-50 text-green-800" : i.required ? "bg-red-50 text-red-800" : "bg-gray-100 text-gray-700"}`}>
                  {i.configured ? "Connected" : i.required ? "Required, missing" : "Not connected"}
                </span>
              </p>
              <p className="text-sm text-text-secondary">{i.note}</p>
              {!i.configured && i.missing.length > 0 && (
                <p className="mt-1 text-xs text-text-secondary">
                  Missing: <code className="break-all">{i.missing.join(", ")}</code>
                </p>
              )}
              {i.key === "storage" && <p className="mt-1 text-xs text-text-secondary">Photos are currently {mode === "supabase" ? "stored in Supabase Storage" : mode === "disk" ? "saved on this computer (development only)" : "not accepted until storage is connected"}.</p>}
            </div>
          </li>
        ))}
      </ul>

      <section className={`${card} mt-8 p-4 sm:p-6`} aria-labelledby="tpl-h">
        <h2 id="tpl-h" className="font-heading text-lg font-semibold">
          WhatsApp message templates
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          WhatsApp only delivers a message to a patient who has not written to you in the last 24 hours if it uses a template approved by Meta. Create one template per row in Meta Business Manager, with the variables in this order, then
          set the setting named in the first column to the template&apos;s name. Until a template name is set, the plain text is sent instead, which WhatsApp may refuse.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">WhatsApp templates and their variables</caption>
            <thead className="border-b border-border bg-sand/40">
              <tr>
                {["Setting", "Sent when", "Variables {{1}}, {{2}}, ..."].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {WHATSAPP_TEMPLATES.map((t) => (
                <tr key={t.event}>
                  <td className="px-3 py-2 font-mono text-xs">WHATSAPP_TEMPLATE_{t.event}</td>
                  <td className="px-3 py-2">{t.when}</td>
                  <td className="px-3 py-2 text-text-secondary">{t.variables.map((v, n) => `{{${n + 1}}} ${v}`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
