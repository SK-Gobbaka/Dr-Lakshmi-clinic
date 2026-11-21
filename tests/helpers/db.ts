import fs from "node:fs";
import path from "node:path";
import { addDaysUTC, formatDateForApi, todayIST } from "../../src/lib/slots";
import { sql } from "../../src/lib/db";

/** Empty every table and load the default data (time slots, types, Dr. Lakshmi...). */
export async function resetDb() {
  const q = sql();
  await q.unsafe(
    "truncate appointments, appointment_events, appointment_counters, audit_log, message_log, login_failures, rate_limits, blocked_dates, slot_overrides, admin_users, gallery_items, testimonials, faqs, treatments, doctors, appointment_types, time_slots, app_settings, site_settings restart identity cascade"
  );
  await q.unsafe(fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20261121000002_defaults.sql"), "utf8"));
}

/** The n-th bookable day from today, skipping Sundays. */
export function day(n: number): string {
  let d = addDaysUTC(todayIST(), n);
  while (d.getUTCDay() === 0) d = addDaysUTC(d, 1);
  return formatDateForApi(d);
}

/** Inserts a confirmed appointment that has already started (the public form only books future dates). */
export async function insertStarted(id: string, phone = "9000000001"): Promise<void> {
  const yesterday = formatDateForApi(addDaysUTC(todayIST(), -1));
  await sql()`insert into appointments (id, date, start_time, end_time, full_name, phone, status, kind, doctor_group, doctor_name, type_name)
              values (${id}, ${yesterday}, '09:00', '10:00', ${"Past " + id}, ${phone}, 'CONFIRMED', 'CONSULTATION', 'OTHERS', 'Other Doctors', 'General Consultation')`;
}
