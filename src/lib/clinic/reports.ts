import { sql } from "../db";
import { addDaysUTC, formatDateForApi, parseApiDate, todayIST } from "../slots";
import { sessionLabel, sessionOf } from "./rules";
import { appointmentFromRow, getConfig } from "./unit";
import type { Appointment, AuditEntry } from "./types";

/** "9:00 AM - 10:00 AM" for the slot containing a start time. */
export async function sessionNameFor(startTime: string): Promise<string> {
  return sessionLabel(sessionOf(startTime, (await getConfig()).sessions));
}

// ---------- dashboard ----------

export interface CountSet {
  appointments: number;
  completed: number;
  rescheduled: number;
  cancelled: number;
}

/** Dashboard cards, counted straight from the appointment records. "Today" = appointments dated today (India time). */
export async function dashboardStats(): Promise<{ overall: CountSet; today: CountSet }> {
  const today = formatDateForApi(todayIST());
  const [r] = await sql()`
    select count(*)::int as total,
           count(*) filter (where status = 'COMPLETED')::int as completed,
           count(*) filter (where reschedule_count > 0)::int as rescheduled,
           count(*) filter (where status = 'CANCELLED')::int as cancelled,
           count(*) filter (where date = ${today})::int as today_total,
           count(*) filter (where date = ${today} and status = 'COMPLETED')::int as today_completed,
           count(*) filter (where date = ${today} and reschedule_count > 0)::int as today_rescheduled,
           count(*) filter (where date = ${today} and status = 'CANCELLED')::int as today_cancelled
      from appointments`;
  return {
    overall: { appointments: r.total, completed: r.completed, rescheduled: r.rescheduled, cancelled: r.cancelled },
    today: { appointments: r.todayTotal, completed: r.todayCompleted, rescheduled: r.todayRescheduled, cancelled: r.todayCancelled },
  };
}

export async function needsAttentionCount(): Promise<number> {
  const [{ n }] = await sql()`select count(*)::int as n from appointments where needs_attention and status in ('PENDING', 'CONFIRMED')`;
  return n;
}

export async function recentBookings(limit = 10): Promise<Appointment[]> {
  return (await sql()`select * from appointments order by created_at desc limit ${limit}`).map(appointmentFromRow);
}

/** The latest token number issued and who got it (null before the first completed appointment). */
export async function tokenInfo(): Promise<{ last: number; next: number; latest: Appointment | null }> {
  const q = sql();
  const [[s], latest] = await Promise.all([q`select token_seq from app_settings where id = 1`, q`select * from appointments where token_number is not null order by token_number desc limit 1`]);
  return { last: s.tokenSeq, next: s.tokenSeq + 1, latest: latest[0] ? appointmentFromRow(latest[0]) : null };
}

/** How many appointments use each appointment type. */
export async function typeUsage(): Promise<Record<string, number>> {
  const rows = await sql()`select type_id, count(*)::int as n from appointments where type_id is not null group by type_id`;
  return Object.fromEntries(rows.map((r) => [r.typeId, r.n]));
}

// ---------- patients ----------

export interface PatientView {
  phone: string;
  name: string;
  email: string | null;
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  returning: boolean;
  lastVisit: string | null;
  appointments: Appointment[];
}

/** One patient per phone number; returning = has a completed visit. Searchable by name, phone or email. */
export async function listPatients(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<{ rows: PatientView[]; total: number }> {
  const q = sql();
  const text = (opts.q ?? "").trim();
  const digits = text.replace(/\D/g, "");
  const pageSize = opts.pageSize ?? 25;
  const offset = ((opts.page ?? 1) - 1) * pageSize;
  const filter = text
    ? q`where full_name ilike ${"%" + text + "%"} or coalesce(email, '') ilike ${"%" + text + "%"} ${digits.length >= 3 ? q`or phone like ${"%" + digits + "%"}` : q``}`
    : q``;
  const [rows, [{ n }]] = await Promise.all([
    q`select phone,
             (array_agg(full_name order by date desc, start_time desc))[1] as name,
             (array_agg(email order by date desc) filter (where email is not null))[1] as email,
             count(*)::int as total,
             count(*) filter (where status in ('PENDING', 'CONFIRMED') and ((date + start_time::time) at time zone 'Asia/Kolkata') > now())::int as upcoming,
             count(*) filter (where status = 'COMPLETED')::int as completed,
             count(*) filter (where status = 'CANCELLED')::int as cancelled,
             count(*) filter (where status = 'NO_SHOW')::int as no_show,
             max(date) filter (where status = 'COMPLETED') as last_visit
        from appointments ${filter} group by phone order by name limit ${pageSize} offset ${offset}`,
    q`select count(distinct phone)::int as n from appointments ${filter}`,
  ]);
  const appts = rows.length ? (await q`select * from appointments where phone in ${q(rows.map((r) => r.phone))} order by date desc, start_time desc`).map(appointmentFromRow) : [];
  return {
    total: n,
    rows: rows.map((r) => ({
      phone: r.phone,
      name: r.name,
      email: r.email,
      total: r.total,
      upcoming: r.upcoming,
      completed: r.completed,
      cancelled: r.cancelled,
      noShow: r.noShow,
      returning: r.completed > 0,
      lastVisit: r.lastVisit,
      appointments: appts.filter((a) => a.phone === r.phone),
    })),
  };
}

// ---------- statistics ----------

export interface Trend {
  labels: string[];
  booked: number[];
  cancelled: number[];
  rescheduled: number[];
}

/** Counts for the Statistics page. `days` limits to appointment dates in the last N days (0 = all time). */
export async function analysis(days: number) {
  const q = sql();
  const today = todayIST();
  const from = days ? formatDateForApi(addDaysUTC(today, -days)) : "0001-01-01";
  const [[c], [rb], byDoctor, booked, moves, list] = await Promise.all([
    q`select count(*)::int as booked,
             count(*) filter (where status = 'COMPLETED')::int as completed,
             count(*) filter (where status = 'NO_SHOW')::int as no_show,
             count(*) filter (where status = 'CANCELLED')::int as cancelled,
             count(*) filter (where status in ('PENDING', 'CONFIRMED'))::int as upcoming,
             count(*) filter (where reschedule_count > 0)::int as rescheduled,
             count(*) filter (where patient_type = 'NEW')::int as new_patients,
             count(*) filter (where patient_type = 'FOLLOW_UP')::int as follow_ups,
             count(*) filter (where source = 'ONLINE')::int as online,
             count(*) filter (where source = 'ADMIN')::int as by_admin,
             count(*) filter (where kind = 'CONSULTATION')::int as consultations,
             count(*) filter (where kind = 'TREATMENT')::int as treatments
        from appointments where date >= ${from}`,
    // rebooked = not the patient's first appointment (same phone, an earlier booking exists)
    q`select count(*)::int as n from (select date, row_number() over (partition by phone order by created_at, id) as rn from appointments) t where rn > 1 and date >= ${from}`,
    q`select coalesce(doctor_name, 'Not specified') as label, count(*)::int as value from appointments
       where kind = 'CONSULTATION' and status <> 'CANCELLED' and date >= ${from} group by 1 order by 2 desc, 1`,
    q`select (created_at at time zone 'Asia/Kolkata')::date::text as day, count(*)::int as n from appointments where created_at > now() - interval '200 days' group by 1`,
    q`select (at at time zone 'Asia/Kolkata')::date::text as day,
             count(*) filter (where to_status = 'CANCELLED' and from_status is distinct from 'CANCELLED')::int as cancelled,
             count(*) filter (where kind = 'reschedule' or (kind = 'block-redirect' and changes is not null))::int as rescheduled
        from appointment_events where at > now() - interval '200 days' group by 1`,
    q`select * from appointments where date >= ${from} order by date desc, start_time limit 20000`,
  ]);

  const monday = (date: string) => {
    const x = parseApiDate(date);
    return formatDateForApi(addDaysUTC(x, -((x.getUTCDay() + 6) % 7)));
  };
  const sum = (rows: { day: string; n: number }[], keys: string[], bucket: (day: string) => string) => keys.map((k) => rows.filter((r) => bucket(r.day) === k).reduce((s, r) => s + r.n, 0));
  const bookedRows = booked.map((r) => ({ day: r.day, n: r.n }));
  const cancelledRows = moves.map((r) => ({ day: r.day, n: r.cancelled }));
  const rescheduledRows = moves.map((r) => ({ day: r.day, n: r.rescheduled }));
  const trend = (keys: string[], bucket: (day: string) => string): Trend => ({
    labels: keys,
    booked: sum(bookedRows, keys, bucket),
    cancelled: sum(cancelledRows, keys, bucket),
    rescheduled: sum(rescheduledRows, keys, bucket),
  });

  return {
    list: list.map(appointmentFromRow),
    newPatients: c.newPatients,
    followUps: c.followUps,
    online: c.online,
    byAdmin: c.byAdmin,
    consultations: c.consultations,
    treatments: c.treatments,
    booked: c.booked,
    completed: c.completed,
    noShow: c.noShow,
    cancelled: c.cancelled,
    upcoming: c.upcoming,
    rescheduled: c.rescheduled,
    rebooked: rb.n,
    attendanceRate: c.completed + c.noShow ? Math.round((c.completed / (c.completed + c.noShow)) * 100) : null,
    byDoctor: byDoctor.map((r) => ({ label: r.label as string, value: r.value as number })),
    daily: trend(Array.from({ length: 14 }, (_, i) => formatDateForApi(addDaysUTC(today, i - 13))), (day) => day),
    weekly: trend(Array.from({ length: 8 }, (_, i) => monday(formatDateForApi(addDaysUTC(today, (i - 7) * 7)))), monday),
    monthly: trend(Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i - 5, 1)).toISOString().slice(0, 7)), (day) => day.slice(0, 7)),
  };
}

// ---------- audit and messages ----------

export async function listAudit(page = 1, pageSize = 100): Promise<{ rows: AuditEntry[]; total: number }> {
  const q = sql();
  const [rows, [{ n }]] = await Promise.all([
    q`select at, actor, action, entity_id, summary from audit_log order by at desc, id desc limit ${pageSize} offset ${(Math.max(1, page) - 1) * pageSize}`,
    q`select count(*)::int as n from audit_log`,
  ]);
  return {
    total: n,
    rows: rows.map((r) => ({ at: (r.at as Date).toISOString(), actor: r.actor, action: r.action, entityId: r.entityId ?? undefined, summary: r.summary })),
  };
}

export interface MessageLogRow {
  at: string;
  appointmentId: string | null;
  event: string;
  recipient: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
}

export async function listMessages(limit = 100, onlyProblems = false): Promise<MessageLogRow[]> {
  const q = sql();
  const rows = await q`select at, appointment_id, event, recipient_masked, status, error from message_log ${onlyProblems ? q`where status <> 'SENT'` : q``} order by at desc, id desc limit ${limit}`;
  return rows.map((r) => ({ at: (r.at as Date).toISOString(), appointmentId: r.appointmentId, event: r.event, recipient: r.recipientMasked, status: r.status, error: r.error }));
}
