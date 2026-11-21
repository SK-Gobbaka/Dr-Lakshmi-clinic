import type { NextRequest } from "next/server";
import { routeAuth } from "@/lib/admin-auth";
import { appointmentsCsv } from "@/lib/admin-appointments";
import { appointmentsForPhone } from "@/lib/clinic";
import { csvResponse } from "@/lib/csv";
import { logAudit } from "@/lib/log-audit";

export const dynamic = "force-dynamic";

/** Every appointment booked with the searched phone number, and nothing else. Owners only. */
export async function GET(request: NextRequest) {
  const { user, denied } = await routeAuth("OWNER");
  if (denied) return denied;
  const phone = (request.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^\d{10}$/.test(phone)) return new Response("Enter a 10-digit phone number", { status: 400 });
  const rows = await appointmentsForPhone(phone);
  await logAudit(user.username, "export.patient", `Downloaded the ${rows.length} appointment record(s) of a patient`);
  return csvResponse(appointmentsCsv(rows), `appointments-${phone}.csv`);
}
