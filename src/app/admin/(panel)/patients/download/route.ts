import type { NextRequest } from "next/server";
import { currentAdmin } from "@/lib/admin-auth";
import { appointmentsCsv, csvResponse } from "@/lib/admin-appointments";
import { listAppointments } from "@/lib/local-store";

export const dynamic = "force-dynamic";

/** Every appointment booked with the searched phone number, and nothing else. */
export async function GET(request: NextRequest) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const phone = (request.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^\d{10}$/.test(phone)) return new Response("Enter a 10-digit phone number", { status: 400 });
  const rows = listAppointments()
    .filter((a) => a.phone === phone)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  return csvResponse(appointmentsCsv(rows), `appointments-${phone}.csv`);
}
