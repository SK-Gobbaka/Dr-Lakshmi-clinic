import { getPublicSite } from "./content";
import { env } from "./env";
import { turnstileEnabled } from "./integrations/turnstile";
import { whatsappConfigured } from "./integrations/whatsapp";
import type { SiteSettings } from "./clinic/types";

/** What the booking screens need from the server: contact details, the bot-check key, and whether WhatsApp messages are switched on. */
export interface BookingContext {
  site: SiteSettings;
  /** Present only when Turnstile is fully configured; the server then requires a valid token. */
  turnstileSiteKey?: string;
  /** True when booking messages are really sent, so the screen can say so (and say otherwise when they are not). */
  messaging: boolean;
}

export async function bookingContext(): Promise<BookingContext> {
  return {
    site: await getPublicSite(),
    turnstileSiteKey: turnstileEnabled() ? env().NEXT_PUBLIC_TURNSTILE_SITE_KEY : undefined,
    messaging: whatsappConfigured(),
  };
}
