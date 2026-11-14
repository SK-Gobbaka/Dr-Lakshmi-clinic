import { NextResponse } from "next/server";
import { getMyNotifications } from "@/actions/appointment";

export const dynamic = "force-dynamic";

/** Notifications for the appointments this browser booked (signed cookie); empty for everyone else. */
export async function GET() {
  const { unread, items } = await getMyNotifications();
  return NextResponse.json({ unread, items: items.slice(0, 30) });
}
