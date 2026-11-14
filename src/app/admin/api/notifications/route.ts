import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin-auth";
import { listNotifications } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await currentAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = listNotifications({ audience: "ADMIN" }, 30);
  return NextResponse.json({ unread: listNotifications({ audience: "ADMIN" }, 1000).filter((n) => !n.readAt).length, items });
}
