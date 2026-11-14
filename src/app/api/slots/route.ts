import { NextRequest, NextResponse } from "next/server";
import { bookableSlots, idForToken } from "@/lib/local-store";

export const dynamic = "force-dynamic";

/** Public availability for a date. `exclude` is the editing patient's own appointment token (so their own place is not counted against them). */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const token = request.nextUrl.searchParams.get("exclude");
  const own = token ? (idForToken(token) ?? undefined) : undefined;
  return NextResponse.json({
    slots: bookableSlots(date, own).map((s) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, sessionName: s.sessionName, remaining: s.remaining })),
  });
}
