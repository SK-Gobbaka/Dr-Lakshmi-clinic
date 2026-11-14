import { sendWhatsAppMessage } from "./whatsapp";
import type { Outgoing } from "./local-store";

/**
 * Sends messages produced by a store change over the channel already wired into the
 * app (WhatsApp; it logs instead of sending when credentials are not configured).
 * Runs after the data change is saved and never throws, so a messaging outage cannot
 * undo or block a booking. The in-app notification is already stored by then.
 */
export function deliver(outbox: Outgoing[]) {
  for (const m of outbox) {
    sendWhatsAppMessage({ to: m.phone, body: m.text }).catch((e) => console.error("[notify] delivery failed", e));
  }
}
