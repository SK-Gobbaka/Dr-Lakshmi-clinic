import { z } from "zod";

/**
 * Every setting the app reads from the environment, in one place.
 * On Cloudflare set secrets with `npx wrangler secret put NAME`; locally copy .env.example to .env.local.
 * Nothing here is required to start the website: a missing optional setting switches that integration off
 * and the admin portal (Integrations page) says what is missing.
 */
// A blank setting (for example "WHATSAPP_PHONE_NUMBER_ID=" copied from .env.example) means "not set", never an error.
const blankIsUnset = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optional = z.preprocess(blankIsUnset, z.string().trim().optional());
const withDefault = (fallback: string) => z.preprocess(blankIsUnset, z.string().trim().default(fallback));

const schema = z.object({
  // database (Supabase)
  DATABASE_URL: optional,
  // admin sign-in
  SESSION_SECRET: optional,
  ADMIN_SESSION_SECRET: optional, // older name, still accepted
  ADMIN_USERNAME: optional, // first sign-in only: creates the owner account when no admin exists yet
  ADMIN_PASSWORD: optional,
  // public site
  NEXT_PUBLIC_SITE_URL: optional,
  // WhatsApp Business (Meta Cloud API)
  WHATSAPP_PHONE_NUMBER_ID: optional,
  WHATSAPP_ACCESS_TOKEN: optional,
  WHATSAPP_API_VERSION: withDefault("v21.0"),
  WHATSAPP_TEMPLATE_LANGUAGE: withDefault("en"),
  ADMIN_WHATSAPP_NUMBER: optional,
  // email (Resend)
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  ADMIN_NOTIFY_EMAIL: optional,
  // photos (Supabase Storage)
  SUPABASE_URL: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  SUPABASE_STORAGE_BUCKET: withDefault("clinic-media"),
  // abuse protection (Cloudflare Turnstile)
  TURNSTILE_SECRET_KEY: optional,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
  // reminders
  CRON_SECRET: optional,
});

export type Env = z.infer<typeof schema>;

/** The environment, parsed. Read it when needed (not at import time) so a missing value never breaks the build. */
export function env(): Env {
  const parsed = schema.safeParse(process.env);
  return parsed.success ? parsed.data : schema.parse({});
}

export const sessionSecret = () => env().SESSION_SECRET ?? env().ADMIN_SESSION_SECRET;
export const isProduction = () => process.env.NODE_ENV === "production";

export interface IntegrationStatus {
  key: string;
  name: string;
  required: boolean;
  configured: boolean;
  missing: string[];
  note: string;
}

const check = (key: string, name: string, required: boolean, vars: (keyof Env)[], note: string, e = env()): IntegrationStatus => {
  const missing = vars.filter((v) => !e[v]).map(String);
  return { key, name, required, configured: missing.length === 0, missing, note };
};

/** What is connected and what is not. Shown in Admin > Integrations. Never contains a secret value. */
export function integrationStatus(): IntegrationStatus[] {
  const e = env();
  return [
    check("database", "Database (Supabase Postgres)", true, ["DATABASE_URL"], "Stores appointments, doctors, content and admin accounts.", e),
    { ...check("session", "Admin sign-in secret", true, [], "Signs the admin session cookie. Must be a long random string.", e), configured: !!sessionSecret() && sessionSecret()!.length >= 32, missing: sessionSecret() && sessionSecret()!.length >= 32 ? [] : ["SESSION_SECRET (32+ characters)"] },
    check("siteUrl", "Public site address", true, ["NEXT_PUBLIC_SITE_URL"], "Used in sitemap, social previews and the links inside patient messages.", e),
    check("whatsapp", "WhatsApp Business", false, ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"], "Sends booking confirmations, reminders and cancellations. Patients are messaged with approved templates (see README).", e),
    check("adminAlerts", "Staff alert number", false, ["ADMIN_WHATSAPP_NUMBER"], "Receives a WhatsApp message for new bookings and cancellations.", e),
    check("email", "Email (Resend)", false, ["RESEND_API_KEY", "EMAIL_FROM", "ADMIN_NOTIFY_EMAIL"], "Emails staff when something needs attention.", e),
    check("storage", "Photo storage (Supabase Storage)", false, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], "Doctor, treatment and gallery photos. Without it photo uploads are switched off.", e),
    check("turnstile", "Bot protection (Cloudflare Turnstile)", false, ["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"], "Stops scripts from filling the booking calendar. Strongly recommended before launch.", e),
    check("cron", "Reminder scheduler", false, ["CRON_SECRET"], "Authorises the 15-minute reminder job.", e),
  ];
}
