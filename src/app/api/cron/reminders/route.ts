import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { claimDueReminders, releaseReminder, remindersFor } from "@/lib/clinic";
import { isDatabaseDown } from "@/lib/db";
import { sendOne } from "@/lib/integrations/deliver";
import { whatsappConfigured } from "@/lib/integrations/whatsapp";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Sends appointment reminders about two hours before a confirmed appointment. Call it every 15 minutes with
 * `Authorization: Bearer <CRON_SECRET>` (on Cloudflare the worker's scheduled trigger does this; see wrangler.jsonc).
 * The secret is not accepted in the URL, so it cannot end up in access logs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Without WhatsApp nothing could be delivered, and claiming reminders now would lose them.
  if (!whatsappConfigured()) return NextResponse.json({ success: true, remindersSent: 0, skipped: "WhatsApp is not connected" });

  try {
    // Claimed atomically: an overlapping run gets nothing, so no patient is reminded twice.
    const due = await claimDueReminders(105 * 60_000, 135 * 60_000);
    let sent = 0;
    for (const { appointment, message } of await remindersFor(due)) {
      if ((await sendOne(message)) === "SENT") sent++;
      else await releaseReminder(appointment.id); // the next run tries again while the window is still open
    }
    return NextResponse.json({ success: true, remindersSent: sent, retryLater: due.length - sent });
  } catch (err) {
    log.error("cron.reminders", err);
    return NextResponse.json({ error: isDatabaseDown(err) ? "Database unavailable" : "Internal server error" }, { status: isDatabaseDown(err) ? 503 : 500 });
  }
}
