import { NextRequest, NextResponse } from "next/server";
import { routeAuth } from "@/lib/admin-auth";
import { bookableSlots } from "@/lib/clinic";
import { isDatabaseDown } from "@/lib/db";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Live slot availability for the admin forms (manual entry and edit). Admin session required. */
export async function GET(request: NextRequest) {
  const { denied } = await routeAuth();
  if (denied) return denied;
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const exclude = request.nextUrl.searchParams.get("exclude") ?? undefined;
  try {
    const slots = await bookableSlots(date, exclude);
    return NextResponse.json({ slots: slots.map((s) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, sessionName: s.sessionName, remaining: s.remaining })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    log.error("admin.api.slots", err);
    return NextResponse.json({ error: "Availability is temporarily unavailable" }, { status: isDatabaseDown(err) ? 503 : 500 });
  }
}
