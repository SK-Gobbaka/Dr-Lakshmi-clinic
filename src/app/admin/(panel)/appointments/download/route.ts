import type { NextRequest } from "next/server";
import { currentAdmin } from "@/lib/admin-auth";
import { appointmentsCsv, csvResponse, filterAppointments, filterDate, parseFilter } from "@/lib/admin-appointments";

export const dynamic = "force-dynamic";

/** Downloads exactly the rows the Appointments page shows for the same ?view= / ?date= / ?q=. */
export async function GET(request: NextRequest) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const p = request.nextUrl.searchParams;
  const filter = parseFilter({ view: p.get("view") ?? undefined, date: p.get("date") ?? undefined, q: p.get("q") ?? undefined });
  const rows = filterAppointments(filter);
  return csvResponse(appointmentsCsv(rows), `appointments-${filterDate(filter) ?? "all"}.csv`);
}
