import { NextRequest, NextResponse } from "next/server";
import { claimDueReminders, releaseReminder } from "@/lib/local-store";
import { sendAppointmentReminder } from "@/lib/whatsapp";
import { parseApiDate } from "@/lib/slots";

/**
 * Cron endpoint for sending appointment reminders about 2 hours before.
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when the
 * CRON_SECRET env var is set; other schedulers must send the same header.
 * The secret is not accepted in the URL, so it cannot end up in access logs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Claimed atomically: an overlapping run gets nothing, so no double message.
    const due = claimDueReminders(105 * 60_000, 135 * 60_000);
    let sent = 0;
    for (const a of due) {
      try {
        const result = await sendAppointmentReminder(a.phone, {
          patientName: a.fullName,
          date: parseApiDate(a.date),
          startTime: a.startTime,
          confirmationToken: a.token,
        });
        if (!result.success) throw new Error(result.error || "WhatsApp send failed");
        sent++;
      } catch (error) {
        console.error("[Cron Reminders] send failed", a.id, error);
        releaseReminder(a.id); // next run retries
      }
    }
    return NextResponse.json({ success: true, remindersSent: sent });
  } catch (error) {
    console.error("[Cron Reminders]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
