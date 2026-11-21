import { env } from "../env";
import { log } from "../logger";
import type { Outgoing } from "../clinic/types";

/**
 * WhatsApp Business (Meta Cloud API) adapter.
 *
 * Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to switch it on. Meta only delivers free-form text
 * inside 24 hours of the patient's last message, so register one approved template per event and put its name
 * in WHATSAPP_TEMPLATE_<EVENT> (for example WHATSAPP_TEMPLATE_BOOKING_CONFIRMED). The variables each template
 * receives are listed in README.md. Without a template name the plain text is sent instead.
 */
export interface SendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  providerId?: string;
  error?: string;
}

export const whatsappConfigured = () => !!(env().WHATSAPP_PHONE_NUMBER_ID && env().WHATSAPP_ACCESS_TOKEN);

/** Indian 10-digit numbers get the 91 prefix; any other number is used as given (digits only). */
export const toWhatsappNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

/** Template variables may not contain new lines, tabs or runs of spaces. */
const param = (v: string) => v.replace(/[\r\n\t]+/g, " | ").replace(/ {2,}/g, " ").trim().slice(0, 1000) || "-";

export async function sendWhatsApp(m: Outgoing): Promise<SendResult> {
  const e = env();
  if (!e.WHATSAPP_PHONE_NUMBER_ID || !e.WHATSAPP_ACCESS_TOKEN) return { status: "SKIPPED", error: "WhatsApp is not configured" };
  if (!m.phone) return { status: "SKIPPED", error: "No recipient number" };

  const template = process.env[`WHATSAPP_TEMPLATE_${m.event}`]?.trim();
  const body = template
    ? {
        messaging_product: "whatsapp",
        to: toWhatsappNumber(m.phone),
        type: "template",
        template: { name: template, language: { code: e.WHATSAPP_TEMPLATE_LANGUAGE }, components: [{ type: "body", parameters: m.params.map((text) => ({ type: "text", text: param(text) })) }] },
      }
    : { messaging_product: "whatsapp", recipient_type: "individual", to: toWhatsappNumber(m.phone), type: "text", text: { preview_url: true, body: m.text } };

  try {
    const res = await fetch(`https://graph.facebook.com/${e.WHATSAPP_API_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok) {
      const error = `WhatsApp error ${json.error?.code ?? res.status}: ${json.error?.message ?? "request failed"}`;
      log.warn("whatsapp.failed", { event: m.event, status: res.status, code: json.error?.code });
      return { status: "FAILED", error };
    }
    return { status: "SENT", providerId: json.messages?.[0]?.id };
  } catch (err) {
    log.error("whatsapp.unreachable", err, { event: m.event });
    return { status: "FAILED", error: "Could not reach WhatsApp" };
  }
}

/**
 * The approved WhatsApp templates the clinic registers with Meta, one per event. `variables` lists what fills
 * {{1}}, {{2}}, ... in order. Set WHATSAPP_TEMPLATE_<EVENT> to the template's name once Meta has approved it.
 */
export const WHATSAPP_TEMPLATES: { event: Outgoing["event"]; when: string; variables: string[] }[] = [
  { event: "BOOKING_PENDING", when: "A patient books and the clinic has not confirmed yet", variables: ["patient name", "appointment ID", "date", "time", "doctor or treatment", "cancel link", "reschedule link"] },
  { event: "BOOKING_CONFIRMED", when: "The booking is confirmed", variables: ["patient name", "appointment ID", "date", "time", "doctor or treatment", "cancel link", "reschedule link"] },
  { event: "BOOKING_RESCHEDULED", when: "The appointment is moved to another time", variables: ["patient name", "appointment ID", "date", "time", "doctor or treatment", "cancel link", "reschedule link"] },
  { event: "BOOKING_CANCELLED", when: "The clinic cancels (including an emergency closure)", variables: ["patient name", "appointment ID", "date", "time", "reason", "link to book again"] },
  { event: "DATE_UNAVAILABLE", when: "A date was blocked and the appointment needs a new date", variables: ["patient name", "appointment ID", "date", "reason", "reschedule link"] },
  { event: "THANK_YOU", when: "After a completed visit", variables: ["patient name", "Google review link", "link to book again"] },
  { event: "REMINDER", when: "About two hours before a confirmed appointment", variables: ["patient name", "date", "time", "map link", "reschedule link"] },
  { event: "ADMIN_ALERT", when: "Staff alert (new booking, cancellation, blocked date)", variables: ["title", "details"] },
];
