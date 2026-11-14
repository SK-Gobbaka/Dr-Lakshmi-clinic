import { NextRequest, NextResponse } from "next/server";
import { bookableSlots, idForToken } from "@/lib/local-store";

export const dynamic = "force-dynamic";

/** Slots for a treatment booking: no capacity limit, so every open, enabled slot of the day is offered. */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const token = request.nextUrl.searchParams.get("exclude");
  const own = token ? (idForToken(token) ?? undefined) : undefined;
  return NextResponse.json({
    slots: bookableSlots(date, own, true).map((s) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, sessionName: s.sessionName, remaining: s.remaining })),
  });
}
