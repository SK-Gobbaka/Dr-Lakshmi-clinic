import { env } from "../env";
import { log } from "../logger";
import type { SendResult } from "./whatsapp";

/**
 * Email adapter (Resend). Set RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend) to
 * switch it on. To use another provider, replace the fetch call below; everything else stays the same.
 */
export const emailConfigured = () => !!(env().RESEND_API_KEY && env().EMAIL_FROM);

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<SendResult> {
  const e = env();
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) return { status: "SKIPPED", error: "Email is not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      log.warn("email.failed", { status: res.status });
      return { status: "FAILED", error: `Email error ${res.status}: ${json.message ?? "request failed"}` };
    }
    return { status: "SENT", providerId: json.id };
  } catch (err) {
    log.error("email.unreachable", err);
    return { status: "FAILED", error: "Could not reach the email service" };
  }
}
