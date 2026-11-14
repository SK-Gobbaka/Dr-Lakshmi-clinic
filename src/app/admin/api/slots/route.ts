import { NextRequest, NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin-auth";
import { bookableSlots } from "@/lib/local-store";

export const dynamic = "force-dynamic";

/** Live slot availability for the admin forms (manual entry and edit). Admin session required. */
export async function GET(request: NextRequest) {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const exclude = request.nextUrl.searchParams.get("exclude") ?? undefined;
  return NextResponse.json({
    slots: bookableSlots(date, exclude).map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      sessionName: s.sessionName,
      remaining: s.remaining,
    })),
  });
}
