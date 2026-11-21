import type { NextRequest } from "next/server";
import { routeAuth } from "@/lib/admin-auth";
import { appointmentsCsv, filterDate, parseFilter, queryOf } from "@/lib/admin-appointments";
import { exportAppointments } from "@/lib/clinic";
import { csvResponse } from "@/lib/csv";
import { logAudit } from "@/lib/log-audit";

export const dynamic = "force-dynamic";

/** Downloads exactly the rows the Appointments page shows for the same ?view= / ?date= / ?q= / ?status=. Owners only. */
export async function GET(request: NextRequest) {
  const { user, denied } = await routeAuth("OWNER");
  if (denied) return denied;
  const p = request.nextUrl.searchParams;
  const filter = parseFilter({ view: p.get("view") ?? undefined, date: p.get("date") ?? undefined, q: p.get("q") ?? undefined, status: p.get("status") ?? undefined });
  const rows = await exportAppointments(queryOf(filter, p.get("attention") === "1"));
  await logAudit(user.username, "export.appointments", `Downloaded ${rows.length} appointment record(s)`);
  return csvResponse(appointmentsCsv(rows), `appointments-${filterDate(filter) ?? "all"}.csv`);
}
