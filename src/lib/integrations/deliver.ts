import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sql } from "../db";
import { env } from "../env";
import { log, maskPhone } from "../logger";
import type { Outgoing } from "../clinic/types";
import { emailConfigured, sendEmail } from "./email";
import { sendWhatsApp, whatsappConfigured, type SendResult } from "./whatsapp";

export type DeliveryStatus = SendResult["status"];

async function record(m: Outgoing, channel: "WHATSAPP" | "EMAIL", recipient: string, r: SendResult) {
  try {
    await sql()`insert into message_log (appointment_id, audience, event, channel, recipient_masked, status, error, provider_message_id)
                values (${m.appointmentId}, ${m.audience}, ${m.event}, ${channel}, ${recipient}, ${r.status}, ${r.error ?? null}, ${r.providerId ?? null})`;
  } catch (err) {
    log.error("message_log.write_failed", err);
  }
}

/**
 * Sends one message and records the attempt in message_log (Admin > Message log). Never throws.
 * Patients are messaged on WhatsApp. Staff alerts go to the staff WhatsApp number and/or the staff email,
 * whichever is set up; with neither, nothing is sent and nothing is recorded.
 */
export async function sendOne(m: Outgoing): Promise<DeliveryStatus> {
  try {
    if (m.audience === "PATIENT") {
      const r = await sendWhatsApp(m);
      await record(m, "WHATSAPP", maskPhone(m.phone), r);
      return r.status;
    }
    const results: SendResult[] = [];
    if (m.phone && whatsappConfigured()) {
      const r = await sendWhatsApp(m);
      await record(m, "WHATSAPP", maskPhone(m.phone), r);
      results.push(r);
    }
    const to = env().ADMIN_NOTIFY_EMAIL;
    if (to && emailConfigured()) {
      const r = await sendEmail({ to, subject: m.params[0] || "Clinic notification", text: m.params[1] || m.text });
      await record(m, "EMAIL", "staff email", r);
      results.push(r);
    }
    return results.some((r) => r.status === "SENT") ? "SENT" : results.some((r) => r.status === "FAILED") ? "FAILED" : "SKIPPED";
  } catch (err) {
    log.error("deliver.failed", err, { event: m.event });
    return "FAILED";
  }
}

/**
 * Sends the messages produced by a booking change. Runs after the change is saved and never throws, so a
 * messaging outage cannot undo or block a booking. On Cloudflare the sends are handed to waitUntil so they
 * finish after the response has been returned.
 */
export async function deliver(outbox: Outgoing[]): Promise<void> {
  if (outbox.length === 0) return;
  const work = Promise.all(outbox.map(sendOne)).then(() => undefined);
  try {
    getCloudflareContext().ctx.waitUntil(work);
  } catch {
    await work; // not on Cloudflare: just wait for it
  }
}
