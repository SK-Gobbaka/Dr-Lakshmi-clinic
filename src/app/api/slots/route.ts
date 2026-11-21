import { NextRequest, NextResponse } from "next/server";
import { bookableSlots, idForToken } from "@/lib/clinic";
import { isDatabaseDown } from "@/lib/db";
import { log } from "@/lib/logger";
import { clientKey, withinLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Public availability for a date. `exclude` is the editing patient's own appointment token (so their own place is not counted against them). */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  try {
    if (!(await withinLimit(`slots:${await clientKey()}`, 120, 60))) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
    const token = request.nextUrl.searchParams.get("exclude");
    const own = token ? ((await idForToken(token)) ?? undefined) : undefined;
    const slots = await bookableSlots(date, own);
    return NextResponse.json({ slots: slots.map((s) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, sessionName: s.sessionName, remaining: s.remaining })) });
  } catch (err) {
    log.error("api.slots", err);
    return NextResponse.json({ error: "Availability is temporarily unavailable" }, { status: isDatabaseDown(err) ? 503 : 500 });
  }
}
