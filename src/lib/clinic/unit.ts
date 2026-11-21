import * as React from "react";
import { sql, type Q } from "../db";
import { addDaysUTC, formatDateForApi, parseApiDate, todayIST } from "../slots";
import { siteUrl as currentSiteUrl } from "../site-url";
import {
  fail,
  type Appointment,
  type AppointmentType,
  type AuditEntry,
  type BlockedDate,
  type Doctor,
  type DoctorGroup,
  type Outgoing,
  type Raw,
  type Result,
  type SessionConfig,
  type SiteSettings,
  type SlotOverride,
  type Treatment,
} from "./types";

/**
 * Unit of work: one database transaction around one business change.
 *
 *  1. lock the dates involved (advisory locks), so two people cannot take the last place of a slot;
 *  2. load the configuration and only the appointments in scope;
 *  3. run the rule (plain TypeScript that edits the loaded objects);
 *  4. write back exactly what changed and commit. A failed rule rolls everything back.
 */

// ---------- loaded data ----------

export interface Data {
  /** Only the appointments in the scope of this change (not the whole table). */
  appointments: Appointment[];
  blockedDates: BlockedDate[];
  slotOverrides: Record<string, SlotOverride>;
  /** Audit entries added by this change. */
  audit: AuditEntry[];
  appointmentTypes: AppointmentType[];
  sessions: SessionConfig[];
  settings: { autoConfirmOnline: boolean };
  doctors: Doctor[];
  treatments: Treatment[];
  tokenSeq: number;
  doctorCaps: Record<DoctorGroup, number>;
  /** Appointment number allocated for this change (see Scope.newId). */
  apptCounter: { year: number; last: number } | null;
  site: SiteSettings;
  siteUrl: string;
}

export interface Scope {
  dates?: string[];
  ids?: string[];
  from?: string;
  to?: string;
  /** Every appointment dated today or later. */
  upcoming?: boolean;
  /** Block all bookings while this change validates against every upcoming appointment. */
  exclusive?: boolean;
  /** Allocate the next appointment number. */
  newId?: boolean;
  /** Lock the settings row (token counter, doctor capacities, booking policy). */
  settings?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : ((v as string | null) ?? null));

// ---------- row <-> object ----------

export function appointmentFromRow(r: Row): Appointment {
  return {
    id: r.id,
    token: r.token,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    fullName: r.fullName,
    phone: r.phone,
    email: r.email,
    age: r.age,
    gender: r.gender,
    patientType: r.patientType,
    typeId: r.typeId,
    typeName: r.typeName,
    kind: r.kind,
    doctorId: r.doctorId,
    doctorName: r.doctorName,
    doctorGroup: r.doctorGroup,
    treatmentId: r.treatmentId,
    treatmentName: r.treatmentName,
    persons: r.persons,
    notes: r.notes,
    status: r.status,
    cancelReason: r.cancelReason,
    cancelledBy: r.cancelledBy,
    needsAttention: r.needsAttention,
    attentionReason: r.attentionReason,
    reminderSent: r.reminderSent,
    rescheduleCount: r.rescheduleCount,
    tokenNumber: r.tokenNumber,
    completedAt: iso(r.completedAt),
    source: r.source,
    createdAt: iso(r.createdAt) as string,
    updatedAt: iso(r.updatedAt) as string,
    history: [],
  };
}

const doctorFromRow = (r: Row): Doctor => ({
  id: r.id,
  name: r.name,
  qualification: r.qualification,
  designation: r.designation,
  regNo: r.regNo,
  experience: r.experience,
  specialization: r.specialization ?? [],
  bio: r.bio,
  message: r.message,
  image: r.image,
  isSenior: r.isSenior,
  published: r.published,
  sortOrder: r.sortOrder,
});

const treatmentFromRow = (r: Row): Treatment => ({ id: r.id, slug: r.slug, name: r.name, image: r.image, subcategories: r.subcategories ?? [], published: r.published, sortOrder: r.sortOrder });
const typeFromRow = (r: Row): AppointmentType => ({ id: r.id, name: r.name, description: r.description, active: r.active, sortOrder: r.sortOrder });
const sessionFromRow = (r: Row): SessionConfig => ({ id: r.id, name: r.name, startTime: r.startTime, endTime: r.endTime, capacity: r.capacity, active: r.active });

export const siteFromRow = (r: Row): SiteSettings => ({
  phone: r.phone,
  phoneDisplay: r.phoneDisplay,
  whatsappNumber: r.whatsappNumber,
  email: r.email,
  addressLine1: r.addressLine1,
  addressLine2: r.addressLine2,
  pincode: r.pincode,
  workingHours: r.workingHours,
  closedDay: r.closedDay,
  facebookUrl: r.facebookUrl,
  instagramUrl: r.instagramUrl,
  xUrl: r.xUrl,
  youtubeUrl: r.youtubeUrl,
  googleMapsUrl: r.googleMapsUrl,
  googleReviewUrl: r.googleReviewUrl,
  googleRating: r.googleRating === null ? null : Number(r.googleRating),
  googleReviewCount: r.googleReviewCount,
  trustStats: Array.isArray(r.trustStats) ? r.trustStats : [],
});

// ---------- reading ----------

export interface Config {
  appointmentTypes: AppointmentType[];
  sessions: SessionConfig[];
  doctors: Doctor[];
  treatments: Treatment[];
  blockedDates: BlockedDate[];
  slotOverrides: Record<string, SlotOverride>;
  settings: { autoConfirmOnline: boolean };
  doctorCaps: Record<DoctorGroup, number>;
  tokenSeq: number;
  site: SiteSettings;
}

/** Everything that is configuration (small tables). Each query runs in one round trip. */
export async function loadConfig(q: Q, opts: { lockSettings?: boolean } = {}): Promise<Config> {
  const [types, sessions, doctors, treatments, blocked, overrides, app, site] = await Promise.all([
    q`select id, name, description, active, sort_order from appointment_types order by sort_order, name`,
    q`select id, name, start_time, end_time, capacity, active from time_slots order by start_time`,
    q`select id, name, qualification, designation, reg_no, experience, to_jsonb(specialization) as specialization, bio, message, image, is_senior, published, sort_order from doctors order by sort_order, name`,
    q`select id, slug, name, image, to_jsonb(subcategories) as subcategories, published, sort_order from treatments order by sort_order, name`,
    q`select date, reason from blocked_dates order by date`,
    q`select slot_key, capacity, disabled from slot_overrides`,
    opts.lockSettings
      ? q`select auto_confirm_online, doctor_cap_lakshmi, doctor_cap_others, token_seq from app_settings where id = 1 for update`
      : q`select auto_confirm_online, doctor_cap_lakshmi, doctor_cap_others, token_seq from app_settings where id = 1`,
    q`select phone, phone_display, whatsapp_number, email, address_line1, address_line2, pincode, working_hours, closed_day, facebook_url, instagram_url, x_url, youtube_url, google_maps_url, google_review_url, google_rating::float8 as google_rating, google_review_count, trust_stats from site_settings where id = 1`,
  ]);
  const a: Row = app[0];
  if (!a || !site[0]) throw new Error("The database has not been set up. Run `npm run db:migrate`.");
  const slotOverrides: Record<string, SlotOverride> = {};
  for (const o of overrides) slotOverrides[o.slotKey] = { ...(o.capacity !== null ? { capacity: o.capacity } : {}), ...(o.disabled ? { disabled: true } : {}) };
  return {
    appointmentTypes: types.map(typeFromRow),
    sessions: sessions.map(sessionFromRow),
    doctors: doctors.map(doctorFromRow),
    treatments: treatments.map(treatmentFromRow),
    blockedDates: blocked.map((b: Row) => ({ date: b.date, reason: b.reason })),
    slotOverrides,
    settings: { autoConfirmOnline: a.autoConfirmOnline },
    doctorCaps: { LAKSHMI: a.doctorCapLakshmi, OTHERS: a.doctorCapOthers },
    tokenSeq: a.tokenSeq,
    site: siteFromRow(site[0]),
  };
}

/** Per-request memo (Server Components); a plain function anywhere else, such as scripts and tests. */
const memo = <T,>(fn: () => T): (() => T) => {
  const cache = (React as unknown as { cache?: <F extends () => unknown>(f: F) => F }).cache;
  return typeof cache === "function" ? cache(fn) : fn;
};

/** The configuration tables, read once per page render. Do not mutate the result. */
export const getConfig = memo(() => loadConfig(sql()));

/** All dates from..to (inclusive), at most 93 days. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = parseApiDate(from), end = parseApiDate(to); d <= end && out.length < 93; d = addDaysUTC(d, 1)) out.push(formatDateForApi(d));
  return out;
}

async function loadAppointments(q: Q, scope: Scope): Promise<Appointment[]> {
  const parts = [];
  if (scope.dates?.length) parts.push(q`date in ${q(scope.dates)}`);
  if (scope.ids?.length) parts.push(q`id in ${q(scope.ids)}`);
  if (scope.from && scope.to) parts.push(q`date between ${scope.from} and ${scope.to}`);
  if (scope.upcoming) parts.push(q`date >= ${formatDateForApi(todayIST())}`);
  if (parts.length === 0) return [];
  const where = parts.reduce((acc, p, i) => (i === 0 ? p : q`${acc} or ${p}`));
  const rows = await q`select * from appointments where ${where} order by date, start_time, created_at`;
  return rows.map(appointmentFromRow);
}

/** Read-only snapshot: configuration plus the appointments in scope. No locks. */
export async function getData(scope: Scope = {}): Promise<Data> {
  const q = sql();
  const [config, appointments, siteUrl] = await Promise.all([getConfig(), loadAppointments(q, scope), currentSiteUrl()]);
  return { ...config, appointments, audit: [], apptCounter: null, siteUrl };
}

// ---------- transaction ----------

const GATE = 7_001; // advisory lock shared by every booking change; taken exclusively by capacity-wide changes
const dateLock = (q: Q, date: string) => q`select pg_advisory_xact_lock(hashtextextended(${"appt:" + date}, 0))`;

class Rollback extends Error {
  constructor(public readonly result: { ok: false; error: string }) {
    super("rollback");
  }
}
class Retry extends Error {}

type Rule<T> = (d: Data, out: Outgoing[], q: Q) => Raw<T> | Promise<Raw<T>>;

/**
 * Runs `rule` inside one transaction. The rule may query `q` directly for anything outside the scope.
 * Returns the rule's failure unchanged (and rolls everything back), or the saved result plus the messages to send.
 */
export async function tx<T>(scope: Scope, rule: Rule<T>): Promise<Result<T>> {
  const siteUrl = await currentSiteUrl();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await sql().begin(async (t) => {
        const q = t as unknown as Q;
        if (scope.exclusive) await q`select pg_advisory_xact_lock(${GATE})`;
        else await q`select pg_advisory_xact_lock_shared(${GATE})`;

        // dates to lock: those named, a range, and the current dates of the appointments named by id
        const dates = new Set<string>(scope.dates ?? []);
        if (scope.from && scope.to) for (const x of eachDate(scope.from, scope.to)) dates.add(x);
        if (scope.ids?.length) for (const r of await q`select date from appointments where id in ${q(scope.ids)}`) dates.add(r.date);
        for (const date of [...dates].sort()) await dateLock(q, date);

        const config = await loadConfig(q, { lockSettings: scope.settings });
        const appointments = await loadAppointments(q, { ...scope, dates: [...dates] });
        // an appointment moved to another date between the lookup and the lock: start over with the right lock
        if (appointments.some((a) => scope.ids?.includes(a.id) && !dates.has(a.date))) throw new Retry();

        let apptCounter: Data["apptCounter"] = null;
        if (scope.newId) {
          const year = Number(formatDateForApi(todayIST()).slice(0, 4));
          const [row] = await q`insert into appointment_counters (year, last) values (${year}, 1) on conflict (year) do update set last = appointment_counters.last + 1 returning last`;
          apptCounter = { year, last: row.last };
        }

        const d: Data = { ...config, appointments, audit: [], apptCounter, siteUrl };
        const before = snapshot(d);
        const out: Outgoing[] = [];
        const r = await rule(d, out, q);
        if (!r.ok) throw new Rollback(r); // nothing is kept, not even the allocated appointment number
        await persist(q, before, d);
        return { ok: true as const, data: r.data, outbox: out };
      });
    } catch (e) {
      if (e instanceof Rollback) return e.result;
      if (e instanceof Retry) continue;
      const err = e as { code?: string; constraint_name?: string };
      if (err?.code === "23505" && err.constraint_name === "appointments_no_duplicate_live") return fail("This person already has a booking in that time slot.");
      throw e;
    }
  }
  return fail("The clinic data was busy. Please try again.");
}

// ---------- writing back what changed ----------

interface Snapshot {
  appointments: Map<string, string>;
  types: Map<string, string>;
  sessions: Map<string, string>;
  doctors: Map<string, string>;
  treatments: Map<string, string>;
  blocked: Map<string, string>;
  overrides: Map<string, string>;
  settings: string;
}

const keyed = <T>(list: T[], key: (x: T) => string): Map<string, string> => new Map(list.map((x) => [key(x), JSON.stringify(x)]));
const settingsOf = (d: Data) => JSON.stringify([d.settings.autoConfirmOnline, d.doctorCaps.LAKSHMI, d.doctorCaps.OTHERS, d.tokenSeq]);

function snapshot(d: Data): Snapshot {
  return {
    appointments: keyed(
      d.appointments.map((a) => ({ ...a, history: [] })),
      (a) => a.id
    ),
    types: keyed(d.appointmentTypes, (x) => x.id),
    sessions: keyed(d.sessions, (x) => x.id),
    doctors: keyed(d.doctors, (x) => x.id),
    treatments: keyed(d.treatments, (x) => x.id),
    blocked: keyed(d.blockedDates, (x) => x.date),
    overrides: keyed(
      Object.entries(d.slotOverrides).map(([k, v]) => ({ k, ...v })),
      (x) => x.k
    ),
    settings: settingsOf(d),
  };
}

/** Rows that are new or different compared with the snapshot, and ids that disappeared. */
function changes<T>(before: Map<string, string>, after: T[], key: (x: T) => string, ignore?: (x: T) => T) {
  const upserts: T[] = [];
  const seen = new Set<string>();
  for (const x of after) {
    const k = key(x);
    seen.add(k);
    if (before.get(k) !== JSON.stringify(ignore ? ignore(x) : x)) upserts.push(x);
  }
  const removed = [...before.keys()].filter((k) => !seen.has(k));
  return { upserts, removed };
}

async function persist(q: Q, before: Snapshot, d: Data) {
  // appointments (the in-transaction history is stored as events, not compared)
  const appts = changes(before.appointments, d.appointments, (a) => a.id, (a) => ({ ...a, history: [] }));
  for (const id of appts.removed) await q`delete from appointments where id = ${id}`;
  for (const a of appts.upserts) await upsertAppointment(q, a);
  for (const a of d.appointments) {
    for (const h of a.history) {
      await q`insert into appointment_events (appointment_id, at, kind, from_status, to_status, actor, note, changes)
              values (${a.id}, ${h.at}, ${h.kind}, ${h.from}, ${h.to}, ${h.by}, ${h.note ?? null}, ${h.changes ? JSON.stringify(h.changes) : null}::text::jsonb)`;
    }
  }

  const types = changes(before.types, d.appointmentTypes, (x) => x.id);
  for (const id of types.removed) await q`delete from appointment_types where id = ${id}`;
  for (const t of types.upserts)
    await q`insert into appointment_types (id, name, description, active, sort_order) values (${t.id}, ${t.name}, ${t.description}, ${t.active}, ${t.sortOrder})
            on conflict (id) do update set name = excluded.name, description = excluded.description, active = excluded.active, sort_order = excluded.sort_order`;

  const sessions = changes(before.sessions, d.sessions, (x) => x.id);
  for (const id of sessions.removed) await q`delete from time_slots where id = ${id}`;
  for (const s of sessions.upserts)
    await q`insert into time_slots (id, name, start_time, end_time, capacity, active) values (${s.id}, ${s.name}, ${s.startTime}, ${s.endTime}, ${s.capacity}, ${s.active})
            on conflict (id) do update set name = excluded.name, start_time = excluded.start_time, end_time = excluded.end_time, capacity = excluded.capacity, active = excluded.active`;

  const doctors = changes(before.doctors, d.doctors, (x) => x.id);
  for (const id of doctors.removed) await q`delete from doctors where id = ${id}`;
  // the single-senior index needs the old senior cleared before a new one is set
  for (const x of doctors.upserts) if (!x.isSenior) await upsertDoctor(q, x);
  for (const x of doctors.upserts) if (x.isSenior) await upsertDoctor(q, x);

  const treatments = changes(before.treatments, d.treatments, (x) => x.id);
  for (const id of treatments.removed) await q`delete from treatments where id = ${id}`;
  for (const t of treatments.upserts)
    await q`insert into treatments (id, slug, name, image, subcategories, published, sort_order) values (${t.id}, ${t.slug}, ${t.name}, ${t.image}, ${textArray(q, t.subcategories)}, ${t.published}, ${t.sortOrder})
            on conflict (id) do update set slug = excluded.slug, name = excluded.name, image = excluded.image, subcategories = excluded.subcategories, published = excluded.published, sort_order = excluded.sort_order`;

  const blocked = changes(before.blocked, d.blockedDates, (x) => x.date);
  for (const date of blocked.removed) await q`delete from blocked_dates where date = ${date}`;
  for (const b of blocked.upserts) await q`insert into blocked_dates (date, reason) values (${b.date}, ${b.reason}) on conflict (date) do update set reason = excluded.reason`;

  const overrideList = Object.entries(d.slotOverrides).map(([k, v]) => ({ k, ...v }));
  const overrides = changes(before.overrides, overrideList, (x) => x.k);
  for (const k of overrides.removed) await q`delete from slot_overrides where slot_key = ${k}`;
  for (const o of overrides.upserts)
    await q`insert into slot_overrides (slot_key, capacity, disabled) values (${o.k}, ${o.capacity ?? null}, ${!!o.disabled})
            on conflict (slot_key) do update set capacity = excluded.capacity, disabled = excluded.disabled`;

  if (before.settings !== settingsOf(d))
    await q`update app_settings set auto_confirm_online = ${d.settings.autoConfirmOnline}, doctor_cap_lakshmi = ${d.doctorCaps.LAKSHMI}, doctor_cap_others = ${d.doctorCaps.OTHERS}, token_seq = ${d.tokenSeq} where id = 1`;

  for (const e of d.audit) await q`insert into audit_log (at, actor, action, entity_id, summary) values (${e.at}, ${e.actor}, ${e.action}, ${e.entityId ?? null}, ${e.summary})`;
}

// Arrays travel as JSON and are turned into text[] by the database, so no driver array support is needed.
const textArray = (q: Q, v: string[]) => q`array(select jsonb_array_elements_text(${JSON.stringify(v)}::text::jsonb))`;

async function upsertDoctor(q: Q, x: Doctor) {
  if (x.isSenior) await q`update doctors set is_senior = false where is_senior and id <> ${x.id}`;
  await q`insert into doctors (id, name, qualification, designation, reg_no, experience, specialization, bio, message, image, is_senior, published, sort_order)
          values (${x.id}, ${x.name}, ${x.qualification}, ${x.designation}, ${x.regNo}, ${x.experience}, ${textArray(q, x.specialization)}, ${x.bio}, ${x.message}, ${x.image}, ${x.isSenior}, ${x.published}, ${x.sortOrder})
          on conflict (id) do update set name = excluded.name, qualification = excluded.qualification, designation = excluded.designation, reg_no = excluded.reg_no, experience = excluded.experience,
            specialization = excluded.specialization, bio = excluded.bio, message = excluded.message, image = excluded.image, is_senior = excluded.is_senior, published = excluded.published, sort_order = excluded.sort_order`;
}

async function upsertAppointment(q: Q, a: Appointment) {
  await q`insert into appointments (id, token, date, start_time, end_time, full_name, phone, email, age, gender, patient_type, type_id, type_name, kind, doctor_id, doctor_name, doctor_group,
            treatment_id, treatment_name, persons, notes, status, cancel_reason, cancelled_by, needs_attention, attention_reason, reminder_sent, reschedule_count, token_number, completed_at, source, created_at, updated_at)
          values (${a.id}, ${a.token}, ${a.date}, ${a.startTime}, ${a.endTime}, ${a.fullName}, ${a.phone}, ${a.email}, ${a.age}, ${a.gender}, ${a.patientType}, ${a.typeId}, ${a.typeName}, ${a.kind}, ${a.doctorId}, ${a.doctorName}, ${a.doctorGroup},
            ${a.treatmentId}, ${a.treatmentName}, ${a.persons}, ${a.notes}, ${a.status}, ${a.cancelReason}, ${a.cancelledBy}, ${a.needsAttention}, ${a.attentionReason}, ${a.reminderSent}, ${a.rescheduleCount}, ${a.tokenNumber}, ${a.completedAt}, ${a.source}, ${a.createdAt}, ${a.updatedAt})
          on conflict (id) do update set date = excluded.date, start_time = excluded.start_time, end_time = excluded.end_time, full_name = excluded.full_name, phone = excluded.phone, email = excluded.email, age = excluded.age,
            gender = excluded.gender, patient_type = excluded.patient_type, type_id = excluded.type_id, type_name = excluded.type_name, kind = excluded.kind, doctor_id = excluded.doctor_id, doctor_name = excluded.doctor_name,
            doctor_group = excluded.doctor_group, treatment_id = excluded.treatment_id, treatment_name = excluded.treatment_name, persons = excluded.persons, notes = excluded.notes, status = excluded.status,
            cancel_reason = excluded.cancel_reason, cancelled_by = excluded.cancelled_by, needs_attention = excluded.needs_attention, attention_reason = excluded.attention_reason, reminder_sent = excluded.reminder_sent,
            reschedule_count = excluded.reschedule_count, token_number = excluded.token_number, completed_at = excluded.completed_at, updated_at = excluded.updated_at`;
}
