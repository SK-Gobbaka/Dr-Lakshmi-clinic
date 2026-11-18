import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BOOKING_HOURS, HOSPITAL } from "./constants";
import { formatLongDate, formatTime12Hour } from "./utils";
import { doctors as seedDoctors } from "./data/doctors";
import {
  addDaysUTC,
  formatDateForApi,
  getBookableDates,
  isDateBookable,
  parseApiDate,
  slotStartsAt,
  todayIST,
} from "./slots";

/**
 * The application's data store: one JSON file (.local-data/store.json).
 *
 * Consistency model: every write goes through tx(), which takes an exclusive
 * lock file, re-reads the latest data, applies the change in memory and writes
 * it back atomically (tmp file + rename) only if the change succeeded. A failed
 * change therefore leaves nothing behind (rollback) and two simultaneous
 * bookings are serialised, so a session can never be overbooked.
 */

export type Status = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export const LIVE_STATUSES: Status[] = ["PENDING", "CONFIRMED"];

/** The booking form offers two choices: Dr. Lakshmi, or any other doctor. Each has its own daily capacity. */
export type DoctorGroup = "LAKSHMI" | "OTHERS";
export const DOCTOR_GROUPS: DoctorGroup[] = ["LAKSHMI", "OTHERS"];
export const OTHER_DOCTORS = "Other Doctors";
export const DEFAULT_SLOT_CAPACITY = 25;
const DEFAULT_DOCTOR_CAPS: Record<DoctorGroup, number> = { LAKSHMI: 25, OTHERS: 100 };

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface HistoryEntry {
  at: string;
  from: Status | null;
  to: Status;
  by: string;
  note?: string;
  kind?: "created" | "status" | "edit" | "reschedule" | "block-redirect";
  changes?: FieldChange[];
}

export interface Appointment {
  id: string;
  token: string;
  date: string; // yyyy-MM-dd (India)
  startTime: string;
  endTime: string;
  fullName: string;
  phone: string;
  email: string | null;
  age: number | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  patientType: "NEW" | "FOLLOW_UP";
  typeId: string | null;
  kind: "CONSULTATION" | "TREATMENT";
  doctorId: string | null;
  doctorName: string | null; // snapshot, so history survives a doctor being removed
  doctorGroup: DoctorGroup | null; // null for treatment bookings
  typeName: string | null; // snapshot, so the record survives its appointment type being deleted
  cancelledBy: "ADMIN" | "PATIENT" | null;
  tokenNumber: number | null; // assigned once, when the appointment is marked completed
  completedAt: string | null;
  treatmentId: string | null;
  treatmentName: string | null;
  persons: number;
  notes: string | null;
  status: Status;
  cancelReason: string | null;
  needsAttention: boolean;
  attentionReason: string | null;
  reminderSent: boolean;
  source: "ONLINE" | "ADMIN";
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
}

export interface AppointmentType {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface Doctor {
  id: string;
  name: string;
  qualification: string;
  designation: string;
  regNo: string;
  experience: number;
  specialization: string[];
  bio: string;
  message: string;
  image: string;
  isSenior: boolean;
  published: boolean;
  sortOrder: number;
}

/** A treatment is a headline (title + image) with the sub-treatments listed under it. */
export interface Treatment {
  id: string;
  slug: string;
  name: string;
  image: string;
  subcategories: string[];
  published: boolean;
  sortOrder: number;
}

/** One bookable time slot, repeated every day (Mon-Sat). Kept under the old name "session" in the data file. */
export interface SessionConfig {
  id: string;
  name: string; // "9:00 AM - 10:00 AM", generated from the times
  startTime: string; // HH:mm
  endTime: string;
  capacity: number; // appointments accepted per day in this slot
  active: boolean;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  entityId?: string;
  summary: string;
}

export interface Notification {
  id: string;
  audience: "ADMIN" | "PATIENT";
  appointmentId: string;
  kind: "CREATED" | "CONFIRMED" | "UPDATED" | "RESCHEDULED" | "CANCELLED" | "NEEDS_ATTENTION";
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  dedupeKey: string;
}

interface Settings {
  autoConfirmOnline: boolean;
}

interface Data {
  seq: number;
  seqByYear: Record<string, number>;
  appointments: Appointment[];
  blockedDates: { date: string; reason: string }[];
  slotOverrides: Record<string, { capacity?: number; disabled?: boolean }>;
  audit: AuditEntry[];
  appointmentTypes: AppointmentType[];
  sessions: SessionConfig[];
  notifications: Notification[];
  settings: Settings;
  doctors: Doctor[];
  treatments: Treatment[];
  tokenSeq: number; // last token number issued; only ever increases
  doctorCaps: Record<DoctorGroup, number>; // appointments allowed per day for each doctor group
  slotsV2: boolean; // true once the old morning/evening sessions were converted to individual time slots
}

export interface Outgoing {
  phone: string;
  text: string;
}

type Result<T> = { ok: true; data: T; outbox: Outgoing[] } | { ok: false; error: string };
type Raw<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const done = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });

const FILE = process.env.LOCAL_STORE_FILE || path.join(process.cwd(), ".local-data", "store.json");
const LOCK = `${FILE}.lock`;

const DEFAULT_TYPES: Omit<AppointmentType, "sortOrder">[] = [
  { id: "type-general", name: "General Consultation", description: "First visit or general skin and hair check-up", active: true },
  { id: "type-hair", name: "Hair Treatment", description: "Hair loss, PRP, transplant and related care", active: true },
  { id: "type-skin", name: "Skin Treatment", description: "Acne, pigmentation, laser and related care", active: true },
  { id: "type-followup", name: "Follow-up Visit", description: "Review of an ongoing treatment", active: true },
];

const nowIso = () => new Date().toISOString();
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- persistence ----------

function normalize(raw: Partial<Data>): Data {
  const d: Data = {
    seq: raw.seq ?? 0,
    seqByYear: raw.seqByYear ?? {},
    appointments: (raw.appointments ?? []).map((a) => {
      const legacy = a as Partial<Appointment>;
      return {
        ...a,
        typeId: legacy.typeId ?? null,
        persons: legacy.persons ?? 1,
        notes: legacy.notes ?? null,
        needsAttention: legacy.needsAttention ?? false,
        attentionReason: legacy.attentionReason ?? null,
        age: legacy.age ?? null,
        gender: legacy.gender ?? null,
        kind: legacy.kind ?? "CONSULTATION",
        doctorId: legacy.doctorId ?? null,
        doctorName: legacy.doctorName ?? null,
        doctorGroup: legacy.doctorGroup ?? null,
        typeName: legacy.typeName ?? null,
        cancelledBy: legacy.cancelledBy ?? null,
        tokenNumber: legacy.tokenNumber ?? null,
        completedAt: legacy.completedAt ?? null,
        treatmentId: legacy.treatmentId ?? null,
        treatmentName: legacy.treatmentName ?? null,
      } as Appointment;
    }),
    blockedDates: raw.blockedDates ?? [],
    slotOverrides: raw.slotOverrides ?? {},
    audit: raw.audit ?? [],
    appointmentTypes: raw.appointmentTypes ?? [],
    sessions: raw.sessions ?? [],
    notifications: raw.notifications ?? [],
    settings: { autoConfirmOnline: false, ...(raw.settings ?? {}) },
    // seeded once from the original site content; after that the admin owns them
    doctors:
      raw.doctors ??
      seedDoctors.map((x, i) => ({
        id: x.id,
        name: x.name,
        qualification: x.qualification,
        designation: x.designation,
        regNo: x.regNo ?? "",
        experience: x.experience,
        specialization: x.specialization,
        bio: x.bio,
        message: x.message ?? "",
        image: x.image,
        isSenior: !!x.isSenior,
        published: true,
        sortOrder: i,
      })),
    // Treatments are now title + image + subcategories. Records from the old layout are dropped (the admin re-adds them).
    treatments: (raw.treatments ?? []).filter((t) => Array.isArray((t as Partial<Treatment>).subcategories)),
    tokenSeq: raw.tokenSeq ?? 0,
    doctorCaps: { ...DEFAULT_DOCTOR_CAPS, ...(raw.doctorCaps ?? {}) },
    slotsV2: !!raw.slotsV2,
  };
  if (d.appointmentTypes.length === 0) d.appointmentTypes = DEFAULT_TYPES.map((t, i) => ({ ...t, sortOrder: i }));

  if (!d.slotsV2 || d.sessions.length === 0) {
    // One-time conversion: the old morning/evening sessions become one slot per hour, each with the default capacity.
    const old: SessionConfig[] = d.sessions.length
      ? d.sessions
      : [
          { id: "m", name: "Morning", startTime: "09:00", endTime: "12:00", capacity: 0, active: true },
          { id: "e", name: "Evening", startTime: "17:00", endTime: "22:00", capacity: 0, active: true },
        ];
    d.sessions = old.flatMap((s) =>
      sessionSlotTimes(s).map((t) => ({ id: `slot-${t.startTime.replace(":", "")}`, name: slotName(t.startTime, t.endTime), startTime: t.startTime, endTime: t.endTime, capacity: DEFAULT_SLOT_CAPACITY, active: s.active }))
    );
    d.slotsV2 = true;
  }

  const lakshmiId = (d.doctors.find((x) => x.isSenior) ?? d.doctors.find((x) => x.id === "dr-lakshmi-villa"))?.id;
  for (const a of d.appointments) {
    if (!a.doctorGroup && a.kind !== "TREATMENT") a.doctorGroup = a.doctorId && a.doctorId === lakshmiId ? "LAKSHMI" : "OTHERS";
    if (a.status === "CANCELLED" && !a.cancelledBy) {
      const last = [...a.history].reverse().find((h) => h.to === "CANCELLED");
      a.cancelledBy = last?.by === "patient" ? "PATIENT" : "ADMIN";
    }
    if (a.tokenNumber) d.tokenSeq = Math.max(d.tokenSeq, a.tokenNumber);
  }
  return d;
}

const slotName = (start: string, end: string) => `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`;
/** Morning / Afternoon / Evening, only used to group slots on screen. */
const periodOf = (startTime: string) => (toMin(startTime) < 720 ? "Morning" : toMin(startTime) < 1020 ? "Afternoon" : "Evening");

function load(): Data {
  try {
    return normalize(JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch {
    return normalize({});
  }
}

function save(data: Data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock<T>(fn: () => T): T {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const start = Date.now();
  for (;;) {
    try {
      fs.closeSync(fs.openSync(LOCK, "wx"));
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - fs.statSync(LOCK).mtimeMs > 10_000) fs.unlinkSync(LOCK); // stale lock
      } catch {}
      if (Date.now() - start > 8_000) throw new Error("Could not obtain the data lock");
      sleepSync(15);
    }
  }
  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(LOCK);
    } catch {}
  }
}

/** Atomic read-modify-write. Nothing is saved unless fn succeeds. */
function tx<T>(fn: (d: Data, out: Outgoing[]) => Raw<T>): Result<T> {
  return withLock(() => {
    const d = load();
    const outbox: Outgoing[] = [];
    const r = fn(d, outbox);
    if (!r.ok) return r;
    save(d);
    return { ok: true as const, data: r.data, outbox };
  });
}

const log = (d: Data, actor: string, action: string, summary: string, entityId?: string) =>
  d.audit.unshift({ at: nowIso(), actor, action, summary, entityId });

export const slotKey = (date: string, startTime: string) => `${date}_${startTime}`;
const isLive = (a: Appointment) => LIVE_STATUSES.includes(a.status);
/** Treatment bookings have no capacity limit, so they never use up session or slot places. */
/** A place is held by every appointment except a cancelled one: completed and no-show visits still used their slot. Treatment bookings count too (they just have no doctor group). */
const usesCapacity = (a: Appointment) => a.status !== "CANCELLED";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const links = (a: Appointment) => ({
  cancel: `${siteUrl()}/book/cancel/${a.token}`,
  reschedule: `${siteUrl()}/book/reschedule/${a.token}`,
  rebook: `${siteUrl()}/book`,
  maps: HOSPITAL.googleMapsUrl,
  review: HOSPITAL.googleReviewUrl,
});

// ---------- appointment types ----------

export function listTypes(opts: { activeOnly?: boolean } = {}): AppointmentType[] {
  return load()
    .appointmentTypes.filter((t) => !opts.activeOnly || t.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function typeName(typeId: string | null, d = load()): string {
  return d.appointmentTypes.find((t) => t.id === typeId)?.name ?? "Not specified";
}

/**
 * Deletes an appointment type. Appointments that used it keep its name (snapshot), so no record breaks.
 * The last active type cannot be deleted because patients need one to book.
 */
export function deleteType(id: string, by: string): Result<void> {
  return tx((d) => {
    const t = d.appointmentTypes.find((x) => x.id === id);
    if (!t) return fail("Appointment type not found");
    if (t.active && d.appointmentTypes.filter((x) => x.active && x.id !== id).length === 0) return fail("At least one appointment type must stay active");
    let kept = 0;
    for (const a of d.appointments) {
      if (a.typeId !== id) continue;
      a.typeName = t.name;
      kept++;
    }
    d.appointmentTypes = d.appointmentTypes.filter((x) => x.id !== id);
    log(d, by, "type.delete", `Deleted appointment type "${t.name}" (${kept} existing appointment(s) keep its name)`, id);
    return done(undefined);
  });
}

export function saveType(
  input: { id?: string; name: string; description?: string; active?: boolean },
  by: string
): Result<AppointmentType> {
  return tx((d) => {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) return fail("Type name must be 2 to 60 characters");
    if (d.appointmentTypes.some((t) => t.id !== input.id && t.name.toLowerCase() === name.toLowerCase())) {
      return fail("An appointment type with this name already exists");
    }
    let t = d.appointmentTypes.find((x) => x.id === input.id);
    if (input.id && !t) return fail("Appointment type not found");
    if (!t) {
      t = { id: `type-${randomUUID().slice(0, 8)}`, name, description: "", active: true, sortOrder: d.appointmentTypes.length };
      d.appointmentTypes.push(t);
      log(d, by, "type.create", `Created appointment type "${name}"`, t.id);
    } else {
      log(d, by, "type.update", `Updated appointment type "${t.name}" -> "${name}"`, t.id);
    }
    t.name = name;
    t.description = (input.description ?? t.description).trim().slice(0, 200);
    if (input.active !== undefined) {
      if (!input.active && t.active && d.appointmentTypes.filter((x) => x.active && x.id !== t.id).length === 0) {
        return fail("At least one appointment type must stay active");
      }
      t.active = input.active;
    }
    return done(t);
  });
}

// ---------- sessions & slots ----------

export function listSessions(): SessionConfig[] {
  return load().sessions.sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
}

export function getSettings(): Settings {
  return load().settings;
}

export function setAutoConfirm(on: boolean, by: string) {
  return tx((d) => {
    d.settings.autoConfirmOnline = on;
    log(d, by, "settings.auto_confirm", `Online bookings are now ${on ? "confirmed automatically" : "held as pending until an admin confirms"}`);
    return done(undefined);
  });
}

function sessionSlotTimes(s: SessionConfig): { startTime: string; endTime: string }[] {
  const out: { startTime: string; endTime: string }[] = [];
  const end = toMin(s.endTime);
  for (let t = toMin(s.startTime); t < end; t += 60) out.push({ startTime: fromMin(t), endTime: fromMin(Math.min(t + 60, end)) });
  return out;
}

function sessionOf(startTime: string, sessions: SessionConfig[]): SessionConfig | undefined {
  const m = toMin(startTime);
  const inWin = (s: SessionConfig) => m >= toMin(s.startTime) && m < toMin(s.endTime);
  return sessions.find((s) => s.active && inWin(s)) ?? sessions.find(inWin);
}

export const sessionLabel = (s: SessionConfig | undefined) => (s ? slotName(s.startTime, s.endTime) : "Outside time slots");

export function sessionNameFor(startTime: string): string {
  return sessionLabel(sessionOf(startTime, load().sessions));
}

export interface SlotView {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionId: string;
  sessionName: string;
  sessionCapacity: number;
  sessionBooked: number;
  slotCapacity: number | null; // optional per-slot cap set by an admin
  booked: number;
  remaining: number;
  disabled: boolean;
}

export function blockedReason(date: string, d = load()): string | null {
  return d.blockedDates.find((b) => b.date === date)?.reason ?? null;
}

function slotsFor(date: string, d: Data): SlotView[] {
  const day = parseApiDate(date);
  if (Number.isNaN(day.getTime()) || day.getUTCDay() === 0) return [];
  const live = d.appointments.filter((a) => usesCapacity(a) && a.date === date);
  const out: SlotView[] = [];
  for (const s of d.sessions.filter((x) => x.active).sort((a, b) => toMin(a.startTime) - toMin(b.startTime))) {
    const sessionBooked = live.filter((a) => sessionOf(a.startTime, d.sessions)?.id === s.id).length;
    for (const t of sessionSlotTimes(s)) {
      const id = slotKey(date, t.startTime);
      const o = d.slotOverrides[id] ?? {};
      const cap = o.capacity; // optional limit for this date only
      const booked = live.filter((a) => a.startTime === t.startTime).length;
      const room = Math.min(s.capacity - sessionBooked, cap === undefined ? Infinity : cap - booked);
      out.push({
        id,
        date,
        startTime: t.startTime,
        endTime: t.endTime,
        sessionId: s.id,
        sessionName: periodOf(t.startTime),
        sessionCapacity: s.capacity,
        sessionBooked,
        slotCapacity: cap ?? null,
        booked,
        remaining: Math.max(0, room),
        disabled: !!o.disabled,
      });
    }
  }
  return out;
}

export function listSlots(date: string): SlotView[] {
  return slotsFor(date, load());
}

/** Slots a patient or admin may book. `ignoreId`: an appointment being edited does not count against itself. */
export function bookableSlots(date: string, ignoreId?: string, unlimited = false): SlotView[] {
  const d = load();
  if (!isDateBookable(parseApiDate(date)) || blockedReason(date, d)) return [];
  const self = d.appointments.find((a) => a.id === ignoreId && isLive(a));
  // treatment bookings: no capacity limit, only closed/disabled slots are excluded
  if (unlimited) return slotsFor(date, d).filter((s) => !s.disabled).map((s) => ({ ...s, remaining: 999 }));
  return slotsFor(date, d)
    .filter((s) => !s.disabled)
    .map((s) => {
      if (!self || self.date !== date) return s;
      const sameSession = sessionOf(self.startTime, d.sessions)?.id === s.sessionId;
      const sameSlot = self.startTime === s.startTime;
      const room = Math.min(s.sessionCapacity - s.sessionBooked + (sameSession ? 1 : 0), s.slotCapacity === null ? Infinity : s.slotCapacity - s.booked + (sameSlot ? 1 : 0));
      return { ...s, remaining: Math.max(0, room) };
    })
    .filter((s) => s.remaining > 0 || (self && self.date === date && self.startTime === s.startTime));
}

export interface DayInfo {
  date: string;
  blocked: string | null;
  holiday: boolean;
  capacity: number;
  booked: number;
  remaining: number;
  appointments: number;
  state: "blocked" | "holiday" | "full" | "available" | "past";
}

export function dayInfo(date: string, d = load()): DayInfo {
  const day = parseApiDate(date);
  const blocked = blockedReason(date, d);
  const holiday = day.getUTCDay() === 0;
  const live = d.appointments.filter((a) => isLive(a) && a.date === date).length;
  let capacity = 0;
  let remaining = 0;
  const seen = new Set<string>();
  for (const s of slotsFor(date, d)) {
    if (seen.has(s.sessionId)) continue;
    seen.add(s.sessionId);
    capacity += s.sessionCapacity;
  }
  // remaining seats: per session, limited by that session's enabled slots
  const bySession = new Map<string, number>();
  for (const s of slotsFor(date, d)) if (!s.disabled) bySession.set(s.sessionId, Math.max(bySession.get(s.sessionId) ?? 0, s.remaining));
  remaining = [...bySession.values()].reduce((a, b) => a + b, 0);
  const past = day.getTime() <= todayIST().getTime() && !blocked;
  const state: DayInfo["state"] = blocked ? "blocked" : holiday ? "holiday" : past ? "past" : remaining <= 0 ? "full" : "available";
  return { date, blocked, holiday, capacity, booked: live, remaining, appointments: live, state };
}

function validateSessions(d: Data, next: SessionConfig[]): string | null {
  const active = next.filter((s) => s.active);
  for (const s of next) {
    if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) return "Times must be in HH:mm format";
    if (toMin(s.startTime) >= toMin(s.endTime)) return `${s.name}: end time must be after start time`;
    if (toMin(s.endTime) - toMin(s.startTime) > 60) return `${s.name}: a time slot can be at most 60 minutes long`;
    if (!Number.isInteger(s.capacity) || s.capacity < 1 || s.capacity > 500) return `${s.name}: capacity must be a whole number from 1 to 500`;
  }
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (toMin(active[i].startTime) < toMin(active[j].endTime) && toMin(active[j].startTime) < toMin(active[i].endTime)) {
        return `${active[i].name} and ${active[j].name} overlap`;
      }
    }
  }
  // existing upcoming bookings must still fit
  const today = formatDateForApi(todayIST());
  const counts = new Map<string, number>();
  for (const a of d.appointments.filter((x) => isLive(x) && x.date >= today)) {
    const counted = usesCapacity(a);
    const s = sessionOf(a.startTime, next.filter((x) => x.active));
    if (!s || !sessionSlotTimes(s).some((t) => t.startTime === a.startTime)) {
      return `Upcoming appointment ${a.id} (${a.date} ${formatTime12Hour(a.startTime)}) would fall outside every active session`;
    }
    if (!counted) continue; // treatment bookings do not count against capacity
    const k = `${a.date}|${s.id}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (counts.get(k)! > s.capacity) return `${s.name} already has ${counts.get(k)} bookings on ${a.date}; capacity cannot go below that`;
  }
  return null;
}

/** Adds or edits a bookable time slot. The name is generated from the times; capacity defaults to 25. */
export function saveSession(
  input: { id?: string; startTime: string; endTime: string; capacity?: number; active?: boolean },
  by: string
): Result<SessionConfig> {
  return tx((d) => {
    const existing = d.sessions.find((s) => s.id === input.id);
    if (input.id && !existing) return fail("Time slot not found");
    const s: SessionConfig = existing
      ? { ...existing }
      : { id: `slot-${randomUUID().slice(0, 8)}`, name: "", startTime: "", endTime: "", capacity: DEFAULT_SLOT_CAPACITY, active: true };
    s.startTime = input.startTime;
    s.endTime = input.endTime;
    if (input.capacity !== undefined) s.capacity = input.capacity;
    if (input.active !== undefined) s.active = input.active;
    if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) return fail("Times must be in HH:mm format");
    s.name = slotName(s.startTime, s.endTime);
    if (d.sessions.some((x) => x.id !== s.id && x.startTime === s.startTime && x.endTime === s.endTime)) return fail("This time slot already exists");
    const next = existing ? d.sessions.map((x) => (x.id === s.id ? s : x)) : [...d.sessions, s];
    if (!next.some((x) => x.active)) return fail("At least one time slot must stay active");
    const err = validateSessions(d, next);
    if (err) return fail(err);
    d.sessions = next.sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    log(d, by, existing ? "slot.update" : "slot.create", `${s.name}, capacity ${s.capacity}, ${s.active ? "active" : "inactive"}`, s.id);
    return done(s);
  });
}

export function deleteSession(id: string, by: string): Result<void> {
  return tx((d) => {
    const s = d.sessions.find((x) => x.id === id);
    if (!s) return fail("Time slot not found");
    const next = d.sessions.filter((x) => x.id !== id);
    if (!next.some((x) => x.active)) return fail("At least one time slot must stay active");
    const err = validateSessions(d, next); // refuses while upcoming appointments still use this slot
    if (err) return fail(err);
    d.sessions = next;
    log(d, by, "slot.delete", `Deleted time slot ${s.name}`, id);
    return done(undefined);
  });
}

// ---------- appointments: reads ----------

export function listAppointments(): Appointment[] {
  return load().appointments;
}

export function getAppointment(id: string): Appointment | null {
  return load().appointments.find((a) => a.id === id) ?? null;
}

export function getByToken(token: string): Appointment | null {
  return load().appointments.find((a) => a.token === token) ?? null;
}

export function idForToken(token: string): string | null {
  return getByToken(token)?.id ?? null;
}

export function getByTokens(tokens: string[]): Appointment[] {
  const set = new Set(tokens);
  return load().appointments.filter((a) => set.has(a.token));
}

// ---------- notifications ----------

/** What the appointment is for: the treatment name, or the consultation type. */
export function appointmentLabel(a: Appointment, d = load()): string {
  if (a.kind === "TREATMENT") return a.treatmentName && a.treatmentName !== "Treatment" ? `Treatment: ${a.treatmentName}` : "Treatment";
  return d.appointmentTypes.find((t) => t.id === a.typeId)?.name ?? a.typeName ?? "Not specified";
}

export function doctorLabel(a: Appointment): string {
  return a.kind === "TREATMENT" ? "-" : (a.doctorName ?? "Not specified");
}

const describe = (a: Appointment, d: Data) => ({
  id: a.id,
  type: appointmentLabel(a, d),
  doctor: doctorLabel(a),
  date: formatLongDate(a.date),
  time: formatTime12Hour(a.startTime),
  session: sessionLabel(sessionOf(a.startTime, d.sessions)),
});

function notify(
  d: Data,
  out: Outgoing[],
  n: { audience: Notification["audience"]; a: Appointment; kind: Notification["kind"]; title: string; message: string; dedupe: string; whatsapp?: boolean }
) {
  const dedupeKey = `${n.audience}:${n.dedupe}`;
  if (d.notifications.some((x) => x.dedupeKey === dedupeKey)) return;
  d.notifications.unshift({
    id: randomUUID(),
    audience: n.audience,
    appointmentId: n.a.id,
    kind: n.kind,
    title: n.title,
    message: n.message,
    createdAt: nowIso(),
    readAt: null,
    dedupeKey,
  });
  if (n.audience === "PATIENT" && n.whatsapp !== false) out.push({ phone: n.a.phone, text: `*${n.title}*\n\n${n.message}` });
  if (n.audience === "ADMIN" && process.env.ADMIN_WHATSAPP_NUMBER) out.push({ phone: process.env.ADMIN_WHATSAPP_NUMBER, text: `*${n.title}*\n\n${n.message}` });
}

/** Where to find us and how to change the booking; cancelling asks for a reason. */
function patientLinks(a: Appointment): string {
  const l = links(a);
  return `Location: ${HOSPITAL.address.full}\nMap: ${l.maps}\nTo cancel (please tell us why): ${l.cancel}\nTo reschedule: ${l.reschedule}`;
}

function notifyConfirmed(d: Data, out: Outgoing[], a: Appointment) {
  const x = describe(a, d);
  notify(d, out, {
    audience: "PATIENT",
    a,
    kind: "CONFIRMED",
    dedupe: `confirmed:${a.id}`,
    title: "Appointment confirmed",
    message: `Your appointment has been successfully confirmed!\nAppointment ID: ${x.id}\nName: ${a.fullName}\nAppointment Type: ${x.type}${a.kind === "TREATMENT" ? "" : `\nDoctor: ${x.doctor}`}\nDate: ${x.date}\nTime: ${x.time}\nSession: ${x.session}\n${patientLinks(a)}\nThank you for booking with us.`,
  });
  notify(d, out, {
    audience: "ADMIN",
    a,
    kind: "CONFIRMED",
    dedupe: `confirmed:${a.id}`,
    title: `Appointment ${x.id} confirmed`,
    message: `Appointment ID: ${x.id}\nCustomer: ${a.fullName}\nContact: ${a.phone}\nAppointment Type: ${x.type}${a.kind === "TREATMENT" ? "" : `\nDoctor: ${x.doctor}`}\nDate: ${x.date}\nSession: ${x.session}\nStatus: Confirmed`,
  });
}

export function listNotifications(scope: { audience: "ADMIN" } | { audience: "PATIENT"; appointmentIds: string[] }, limit = 100): Notification[] {
  const d = load();
  const ids = scope.audience === "PATIENT" ? new Set(scope.appointmentIds) : null;
  return d.notifications.filter((n) => n.audience === scope.audience && (!ids || ids.has(n.appointmentId))).slice(0, limit);
}

export function markNotificationsRead(scope: { audience: "ADMIN" } | { audience: "PATIENT"; appointmentIds: string[] }, notificationId?: string) {
  return tx((d) => {
    const ids = scope.audience === "PATIENT" ? new Set(scope.appointmentIds) : null;
    const stamp = nowIso();
    for (const n of d.notifications) {
      if (n.audience !== scope.audience || n.readAt) continue;
      if (ids && !ids.has(n.appointmentId)) continue;
      if (notificationId && n.id !== notificationId) continue;
      n.readAt = stamp;
    }
    return done(undefined);
  });
}

// ---------- doctor-wise capacity ----------

/** Dr. Lakshmi is the senior consultant profile. */
export function lakshmiDoctor(d = load()): Doctor | undefined {
  return d.doctors.find((x) => x.published && x.isSenior) ?? d.doctors.find((x) => x.published && x.id === "dr-lakshmi-villa");
}

const groupBooked = (d: Data, date: string, g: DoctorGroup, ignoreId?: string) =>
  d.appointments.filter((a) => usesCapacity(a) && a.date === date && a.doctorGroup === g && a.id !== ignoreId).length;

export const doctorGroupLabel = (g: DoctorGroup) => (g === "LAKSHMI" ? "Dr. Lakshmi" : OTHER_DOCTORS);

export interface DoctorCapacityRow {
  group: DoctorGroup;
  label: string;
  doctors: string[];
  capacity: number;
  booked: number;
  remaining: number;
}

/** Capacity and bookings of each doctor group on one date. Dr. Lakshmi is always first. */
export function doctorCapacity(date: string, d = load()): DoctorCapacityRow[] {
  const lakshmi = lakshmiDoctor(d);
  return DOCTOR_GROUPS.map((group) => {
    const booked = groupBooked(d, date, group);
    const capacity = d.doctorCaps[group];
    return {
      group,
      label: doctorGroupLabel(group),
      doctors: group === "LAKSHMI" ? (lakshmi ? [lakshmi.name] : []) : d.doctors.filter((x) => x.published && x.id !== lakshmi?.id).map((x) => x.name),
      capacity,
      booked,
      remaining: Math.max(0, capacity - booked),
    };
  });
}

/** Sets one group's daily capacity. Each group is independent: changing Dr. Lakshmi never touches Other Doctors. */
export function setDoctorCapacity(group: DoctorGroup, capacity: number, by: string): Result<void> {
  return tx((d) => {
    if (!DOCTOR_GROUPS.includes(group)) return fail("Unknown doctor group");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return fail("Capacity must be a whole number from 1 to 1000");
    const today = formatDateForApi(todayIST());
    const perDate = new Map<string, number>();
    for (const a of d.appointments) if (usesCapacity(a) && a.doctorGroup === group && a.date >= today) perDate.set(a.date, (perDate.get(a.date) ?? 0) + 1);
    const worst = [...perDate].find(([, n]) => n > capacity);
    if (worst) return fail(`${doctorGroupLabel(group)} already has ${worst[1]} bookings on ${worst[0]}; capacity cannot go below that`);
    d.doctorCaps[group] = capacity;
    log(d, by, "doctor.capacity", `${doctorGroupLabel(group)} daily capacity set to ${capacity}`);
    return done(undefined);
  });
}

// ---------- appointments: writes ----------

export interface NewAppointment {
  slotId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  age?: number | null;
  gender?: Appointment["gender"];
  patientType?: Appointment["patientType"];
  typeId?: string;
  kind?: Appointment["kind"];
  doctorGroup?: DoctorGroup | null; // booking form: Dr. Lakshmi or Other Doctors
  doctorId?: string | null; // admin form: a specific doctor
  treatmentId?: string | null; // required for treatments
  persons?: number;
  notes?: string | null;
  status?: Extract<Status, "PENDING" | "CONFIRMED">; // admin only
}

function checkSlotOpen(d: Data, slotId: string, ignoreId?: string, admin = false, unlimited = false, group?: DoctorGroup | null): Raw<SlotView> {
  const [date, time] = slotId.split("_");
  const day = parseApiDate(date);
  const okDate = admin
    ? day.getTime() >= todayIST().getTime() && day.getTime() <= addDaysUTC(todayIST(), 30).getTime() && day.getUTCDay() !== 0
    : isDateBookable(day);
  if (!okDate) return fail("Selected date is not available for booking");
  if (admin && slotStartsAt(parseApiDate(date), time ?? "").getTime() <= Date.now()) {
    return fail("That time has already started; choose a later slot");
  }
  if (blockedReason(date, d)) return fail("The clinic is closed on that date");
  const slot = slotsFor(date, d).find((s) => s.id === slotId);
  if (!slot || slot.disabled) return fail("Selected slot is no longer available");
  const self = d.appointments.find((a) => a.id === ignoreId && isLive(a) && a.date === date);
  let room = slot.remaining;
  if (self) {
    // an appointment being moved does not count against its own session or slot
    if (sessionOf(self.startTime, d.sessions)?.id === slot.sessionId) room = Math.min(slot.sessionCapacity - slot.sessionBooked + 1, slot.slotCapacity === null ? Infinity : slot.slotCapacity - slot.booked + (self.startTime === slot.startTime ? 1 : 0));
  }
  const ignored = d.appointments.find((a) => a.id === ignoreId);
  const noLimit = unlimited;
  if (!noLimit && room <= 0) return fail("This time slot is fully booked. Please choose another.");
  const grp = group ?? ignored?.doctorGroup;
  if (!noLimit && grp && groupBooked(d, date, grp, ignoreId) >= d.doctorCaps[grp]) return fail(`${doctorGroupLabel(grp)} is fully booked on this date. Please choose another date or doctor.`);
  return done(slot);
}

function nextId(d: Data): string {
  const year = formatDateForApi(todayIST()).slice(0, 4);
  for (;;) {
    d.seqByYear[year] = (d.seqByYear[year] ?? 0) + 1;
    d.seq += 1;
    const id = `APT-${year}-${String(d.seqByYear[year]).padStart(3, "0")}`;
    if (!d.appointments.some((a) => a.id === id)) return id;
  }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function createAppointment(input: NewAppointment, by = "patient"): Result<Appointment> {
  return tx((d, out) => {
    const admin = by !== "patient";
    const kind = input.kind ?? "CONSULTATION";
    const treatment = kind === "TREATMENT" && input.treatmentId ? d.treatments.find((t) => t.id === input.treatmentId && t.published) : undefined;
    // No type chosen (booking form): New -> General Consultation, Follow-up -> Follow-up Visit, else the first active type.
    const active = d.appointmentTypes.filter((t) => t.active);
    const type =
      kind === "TREATMENT"
        ? undefined
        : input.typeId
          ? d.appointmentTypes.find((t) => t.id === input.typeId)
          : (active.find((t) => t.id === (input.patientType === "FOLLOW_UP" ? "type-followup" : "type-general")) ?? active[0]);
    if (kind === "CONSULTATION" && (!type || !type.active)) return fail("Please select a valid appointment type");

    let doctor: Doctor | undefined;
    let group: DoctorGroup | null = null;
    if (kind === "CONSULTATION") {
      const lakshmi = lakshmiDoctor(d);
      if (input.doctorGroup === "LAKSHMI" || (!input.doctorGroup && input.doctorId && input.doctorId === lakshmi?.id)) {
        if (!lakshmi) return fail("Dr. Lakshmi is not available for booking");
        doctor = lakshmi;
        group = "LAKSHMI";
      } else if (input.doctorGroup === "OTHERS") {
        group = "OTHERS";
      } else if (input.doctorId) {
        doctor = d.doctors.find((x) => x.id === input.doctorId && x.published);
        if (!doctor) return fail("Please choose the doctor you want to consult");
        group = "OTHERS";
      } else return fail("Please choose the doctor you want to consult");
    }
    const open = checkSlotOpen(d, input.slotId, undefined, admin, false, group);
    if (!open.ok) return open;
    const slot = open.data;

    const dup = d.appointments.find((a) => isLive(a) && a.phone === input.phone && sameName(a.fullName, input.fullName) && a.date === slot.date && a.startTime === slot.startTime);
    if (dup) return fail(`${input.fullName.trim()} already has a booking in this time slot (${dup.id}).`);
    // anti-spam only: a family may book several people, but not a flood
    const recent = d.appointments.filter((a) => a.phone === input.phone && Date.now() - Date.parse(a.createdAt) < 5 * 60_000).length;
    if (recent >= 10) return fail("Too many bookings were made with this phone number just now. Please wait a few minutes.");

    const status: Status = admin ? (input.status ?? "CONFIRMED") : d.settings.autoConfirmOnline ? "CONFIRMED" : "PENDING";
    const stamp = nowIso();
    const appt: Appointment = {
      id: nextId(d),
      token: randomUUID(),
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      fullName: input.fullName.trim(),
      phone: input.phone,
      email: input.email || null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      patientType: input.patientType ?? "NEW",
      typeId: type?.id ?? null,
      kind,
      doctorId: doctor?.id ?? null,
      doctorName: doctor?.name ?? (group === "OTHERS" ? OTHER_DOCTORS : null),
      doctorGroup: group,
      typeName: type?.name ?? null,
      cancelledBy: null,
      tokenNumber: null,
      completedAt: null,
      treatmentId: treatment?.id ?? null,
      treatmentName: treatment?.name ?? (kind === "TREATMENT" ? "Treatment" : null),
      persons: input.persons ?? 1,
      notes: input.notes?.trim() || null,
      status,
      cancelReason: null,
      needsAttention: false,
      attentionReason: null,
      reminderSent: false,
      source: admin ? "ADMIN" : "ONLINE",
      createdAt: stamp,
      updatedAt: stamp,
      history: [{ at: stamp, from: null, to: status, by, kind: "created", note: admin ? "Created manually by admin" : undefined }],
    };
    d.appointments.push(appt);
    log(d, by, "appointment.create", `${appt.id} ${appt.fullName} ${appt.date} ${appt.startTime} (${treatment ? `treatment ${treatment.name}` : type?.name}${doctor ? `, ${doctor.name}` : ""}, ${status})`, appt.id);
    const x = describe(appt, d);
    if (status === "CONFIRMED") notifyConfirmed(d, out, appt);
    else
      notify(d, out, {
        audience: "ADMIN",
        a: appt,
        kind: "CREATED",
        dedupe: `created:${appt.id}`,
        title: `New appointment ${x.id}`,
        message: `Appointment ID: ${x.id}\nCustomer: ${appt.fullName}\nContact: ${appt.phone}\nAppointment Type: ${x.type}${appt.kind === "TREATMENT" ? "" : `\nDoctor: ${x.doctor}`}\nDate: ${x.date}\nSession: ${x.session}\nStatus: Pending, awaiting confirmation`,
      });
    if (status === "PENDING") {
      notify(d, out, {
        audience: "PATIENT",
        a: appt,
        kind: "CREATED",
        dedupe: `created:${appt.id}`,
        title: "Appointment booked, awaiting confirmation",
        message: `Thank you for booking with ${HOSPITAL.name}.\nAppointment ID: ${x.id}\nName: ${appt.fullName}\nAppointment Type: ${x.type}${appt.kind === "TREATMENT" ? "" : `\nDoctor: ${x.doctor}`}\nDate: ${x.date}\nTime: ${x.time}\n${patientLinks(appt)}\nThe clinic will confirm your booking shortly.`,
      });
    }
    return done(appt);
  });
}

const startOf = (a: Appointment) => slotStartsAt(parseApiDate(a.date), a.startTime).getTime();

const TRANSITIONS: Record<Status, Status[]> = {
  PENDING: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const pretty = (s: string) => s.toLowerCase().replace("_", "-");

export function setStatus(id: string, to: Status, by: string, opts: { reason?: string; patient?: boolean } = {}): Result<Appointment> {
  return tx((d, out) => {
    const a = d.appointments.find((x) => x.id === id);
    if (!a) return fail("Appointment not found");
    if (a.status === to) return fail(`Appointment is already ${pretty(to)}`);
    if (!TRANSITIONS[a.status].includes(to)) return fail(`A ${pretty(a.status)} appointment cannot be changed to ${pretty(to)}`);
    if (to === "CONFIRMED" && startOf(a) <= Date.now()) return fail("This appointment time has already passed and cannot be confirmed.");
    if (to === "CONFIRMED" && blockedReason(a.date, d)) return fail("This date is blocked. Move the appointment to another date before confirming.");
    if (to === "CANCELLED") {
      if (opts.patient && startOf(a) <= Date.now()) return fail("This appointment has already started or passed and cannot be cancelled online.");
      if (!opts.patient && startOf(a) + 60 * 60_000 <= Date.now()) return fail("This appointment is over; mark it completed or no-show instead.");
      if (!opts.reason?.trim()) return fail(opts.patient ? "Please tell us why you are cancelling" : "A reason is required to cancel");
    }
    if ((to === "COMPLETED" || to === "NO_SHOW") && startOf(a) > Date.now()) return fail("This can only be set once the appointment time has started");

    const stamp = nowIso();
    a.history.push({ at: stamp, from: a.status, to, by, kind: "status", note: opts.reason?.trim() || undefined });
    if (to === "CANCELLED") {
      a.cancelReason = opts.reason?.trim() || "Cancelled by patient";
      a.cancelledBy = opts.patient ? "PATIENT" : "ADMIN";
    }
    if (to === "COMPLETED") {
      // Token numbers come from one counter that is only read and bumped inside this locked write,
      // and the status check above rejects a second completion, so a token is never issued twice.
      a.tokenNumber ??= ++d.tokenSeq;
      a.completedAt = stamp;
    }
    if (to !== "PENDING" && to !== "CONFIRMED") {
      a.needsAttention = false;
      a.attentionReason = null;
    }
    a.status = to;
    a.updatedAt = stamp;
    log(d, by, `appointment.${to.toLowerCase()}`, `${a.id} ${a.fullName} -> ${to}${opts.reason ? ` (${opts.reason})` : ""}`, a.id);
    const x = describe(a, d);
    if (to === "CONFIRMED") notifyConfirmed(d, out, a);
    if (to === "CANCELLED") {
      notify(d, out, {
        audience: "ADMIN",
        a,
        kind: "CANCELLED",
        dedupe: `cancelled:${a.id}`,
        title: `Appointment ${x.id} cancelled`,
        message: `Appointment ID: ${x.id}\nCustomer: ${a.fullName}\nContact: ${a.phone}\nAppointment Type: ${x.type}\nDate: ${x.date}\nSession: ${x.session}\nReason: ${a.cancelReason}`,
      });
      if (!opts.patient)
        notify(d, out, {
          audience: "PATIENT",
          a,
          kind: "CANCELLED",
          dedupe: `cancelled:${a.id}`,
          title: "Appointment cancelled",
          message: `Your appointment ${x.id} (${x.type}) on ${x.date} at ${x.time} was cancelled by the clinic.\nReason: ${a.cancelReason}\nBook again any time: ${links(a).rebook}\nOr call ${HOSPITAL.phoneDisplay}.`,
        });
    }
    if (to === "COMPLETED") {
      notify(d, out, {
        audience: "PATIENT",
        a,
        kind: "CONFIRMED",
        dedupe: `completed:${a.id}`,
        title: "Thank you for visiting us",
        message: `Dear ${a.fullName}, thank you for visiting ${HOSPITAL.name}. We hope you are happy with your care.\nIf you have a moment, please share your experience with a Google review: ${links(a).review}\nBook your next visit: ${links(a).rebook}`,
      });
    }
    return done(a);
  });
}

export interface AppointmentPatch {
  fullName?: string;
  phone?: string;
  email?: string | null;
  age?: number | null;
  gender?: Appointment["gender"];
  patientType?: Appointment["patientType"];
  typeId?: string;
  persons?: number;
  notes?: string | null;
  slotId?: string;
}

/** Edit an appointment's details; changing the slot re-checks capacity. History records every changed field. */
export function updateAppointment(id: string, patch: AppointmentPatch, by: string, opts: { patient?: boolean } = {}): Result<Appointment> {
  return tx((d, out) => {
    const a = d.appointments.find((x) => x.id === id);
    if (!a) return fail("Appointment not found");
    if (!isLive(a)) return fail("Only pending or confirmed appointments can be edited");
    const before = { ...a };
    const beforeType = typeName(a.typeId, d);
    const beforeWhen = `${a.date} ${a.startTime}`;
    const changes: FieldChange[] = [];
    const set = <K extends keyof Appointment>(field: K, value: Appointment[K], label: string, show?: (v: Appointment[K]) => string | null) => {
      if (value === a[field]) return;
      const fmt = show ?? ((v) => (v === null || v === undefined ? null : String(v)));
      changes.push({ field: label, from: fmt(a[field]), to: fmt(value) });
      a[field] = value;
    };

    if (patch.slotId !== undefined && patch.slotId !== slotKey(a.date, a.startTime)) {
      if (startOf(a) <= Date.now()) return fail("This appointment has already started or passed; its time can no longer be changed.");
      const open = checkSlotOpen(d, patch.slotId, a.id);
      if (!open.ok) return open;
      const slot = open.data;
      changes.push({ field: "Date and time", from: beforeWhen, to: `${slot.date} ${slot.startTime}` });
      a.date = slot.date;
      a.startTime = slot.startTime;
      a.endTime = slot.endTime;
      a.reminderSent = false;
      if (a.needsAttention) {
        a.needsAttention = false;
        a.attentionReason = null;
      }
    }
    if (patch.typeId !== undefined && patch.typeId !== a.typeId) {
      const t = d.appointmentTypes.find((x) => x.id === patch.typeId);
      if (!t || !t.active) return fail("Please select a valid appointment type");
      changes.push({ field: "Appointment type", from: beforeType, to: t.name });
      a.typeId = t.id;
      a.typeName = t.name;
    }
    if (patch.fullName !== undefined) set("fullName", patch.fullName.trim(), "Name");
    if (patch.phone !== undefined) set("phone", patch.phone, "Phone");
    if (patch.email !== undefined) set("email", patch.email || null, "Email");
    if (patch.age !== undefined) set("age", patch.age, "Age");
    if (patch.gender !== undefined) set("gender", patch.gender, "Gender");
    if (patch.patientType !== undefined) set("patientType", patch.patientType, "Patient type");
    if (patch.persons !== undefined) set("persons", patch.persons, "Persons");
    if (patch.notes !== undefined) set("notes", patch.notes?.trim() || null, "Notes");

    if (changes.length === 0) return fail("Nothing was changed");
    const dup = d.appointments.find((x) => x.id !== a.id && isLive(x) && x.phone === a.phone && sameName(x.fullName, a.fullName) && x.date === a.date && x.startTime === a.startTime);
    if (dup) return fail(`${a.fullName} already has a booking in this time slot (${dup.id}).`);

    const stamp = nowIso();
    a.updatedAt = stamp;
    const moved = changes.some((c) => c.field === "Date and time");
    a.history.push({ at: stamp, from: before.status, to: a.status, by, kind: moved ? "reschedule" : "edit", changes, note: changes.map((c) => `${c.field}: ${c.from ?? "-"} -> ${c.to ?? "-"}`).join("; ") });
    log(d, by, "appointment.edit", `${a.id} ${changes.map((c) => c.field).join(", ")}`, a.id);

    const x = describe(a, d);
    const summary = changes.map((c) => `${c.field}: ${c.from ?? "-"} -> ${c.to ?? "-"}`).join("\n");
    if (opts.patient) {
      notify(d, out, { audience: "ADMIN", a, kind: "UPDATED", dedupe: `upd:${a.id}:${stamp}`, title: `Appointment ${x.id} ${moved ? "rescheduled" : "edited"} by patient`, message: `Customer: ${a.fullName}\nContact: ${a.phone}\n${summary}\nDate: ${x.date}\nSession: ${x.session}\nStatus: ${pretty(a.status)}` });
    }
    if (moved || (!opts.patient && changes.some((c) => c.field === "Appointment type"))) {
      notify(d, out, { audience: "PATIENT", a, kind: "UPDATED", dedupe: `upd:${a.id}:${stamp}:p`, title: moved ? "Appointment rescheduled" : "Appointment updated", message: `${opts.patient ? "Your appointment was rescheduled." : "Your appointment details were updated by the clinic."}\nAppointment ID: ${x.id}\nAppointment Type: ${x.type}${a.kind === "TREATMENT" ? "" : `\nDoctor: ${x.doctor}`}\nDate: ${x.date}\nTime: ${x.time}\n${patientLinks(a)}\nNeed help? Call ${HOSPITAL.phoneDisplay}.` });
    }
    return done(a);
  });
}

export function reschedule(id: string, newSlotId: string, by: string, opts: { patient?: boolean } = {}): Result<Appointment> {
  const a = getAppointment(id);
  if (!a) return fail("Appointment not found");
  if (!isLive(a)) return fail("This appointment cannot be rescheduled");
  if (slotKey(a.date, a.startTime) === newSlotId) return fail("Please choose a different time slot.");
  return updateAppointment(id, { slotId: newSlotId }, by, opts);
}

export function deleteAppointment(id: string, by: string): Result<void> {
  return tx((d) => {
    const a = d.appointments.find((x) => x.id === id);
    if (!a) return fail("Appointment not found");
    if (a.status !== "CANCELLED") return fail("Only cancelled appointments can be deleted. Cancel it first.");
    d.appointments = d.appointments.filter((x) => x.id !== id);
    d.notifications = d.notifications.filter((n) => n.appointmentId !== id);
    log(d, by, "appointment.delete", `${a.id} ${a.fullName} ${a.date} deleted`, a.id);
    return done(undefined);
  });
}

// ---------- availability controls ----------

export interface PlanTarget {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionName: string;
}
export interface PlanItem {
  appointment: Appointment;
  target: PlanTarget | null;
  manual: boolean;
  reason?: string;
}

/**
 * Proposes new slots for every live appointment on `date`, as it would be after blocking it.
 * Never proposes a blocked date, a Sunday, a disabled slot or a session without room;
 * earlier proposals in the same plan use up capacity so two patients never get the last seat.
 * `overrides[appointmentId]` is an admin-chosen date (yyyy-MM-dd) or slot id.
 */
export function planBlock(date: string, overrides: Record<string, string> = {}, d = load()): PlanItem[] {
  const affected = d.appointments.filter((a) => isLive(a) && a.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.createdAt.localeCompare(b.createdAt));
  const base = parseApiDate(date).getTime();
  const candidates = getBookableDates()
    .map(formatDateForApi)
    .filter((x) => x !== date && !blockedReason(x, d))
    .sort((x, y) => {
      const dx = Math.abs(parseApiDate(x).getTime() - base);
      const dy = Math.abs(parseApiDate(y).getTime() - base);
      return dx - dy || y.localeCompare(x); // nearer first; on a tie prefer the later date
    });
  const takenSlot = new Map<string, number>();
  const takenSession = new Map<string, number>();
  const takenGroup = new Map<string, number>();
  const room = (s: SlotView) =>
    Math.min(s.sessionCapacity - s.sessionBooked - (takenSession.get(`${s.date}|${s.sessionId}`) ?? 0), s.slotCapacity === null ? Infinity : s.slotCapacity - s.booked - (takenSlot.get(s.id) ?? 0));

  const pick = (a: Appointment, dates: string[], onlySlot?: string): PlanTarget | null => {
    const mySession = sessionOf(a.startTime, d.sessions)?.id;
    for (const day of dates) {
      const unlimited = false;
      const g = a.doctorGroup;
      const gKey = `${day}|${g}`;
      // the doctor group's own daily capacity must have room on that day too
      if (!unlimited && g && d.doctorCaps[g] - groupBooked(d, day, g) - (takenGroup.get(gKey) ?? 0) <= 0) continue;
      const slots = slotsFor(day, d).filter((s) => !s.disabled && (unlimited || room(s) > 0) && (!onlySlot || s.id === onlySlot));
      if (slots.length === 0) continue;
      const rank = (s: SlotView) => (s.startTime === a.startTime ? 0 : s.sessionId === mySession ? 1 : 2) * 10_000 + Math.abs(toMin(s.startTime) - toMin(a.startTime));
      const s = [...slots].sort((p, q) => rank(p) - rank(q))[0];
      if (!unlimited) {
        if (g) takenGroup.set(gKey, (takenGroup.get(gKey) ?? 0) + 1);
        takenSlot.set(s.id, (takenSlot.get(s.id) ?? 0) + 1);
        takenSession.set(`${s.date}|${s.sessionId}`, (takenSession.get(`${s.date}|${s.sessionId}`) ?? 0) + 1);
      }
      return { slotId: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, sessionName: s.sessionName };
    }
    return null;
  };

  return affected.map((a) => {
    const ov = overrides[a.id];
    if (ov) {
      const slotMode = ov.includes("_");
      const day = slotMode ? ov.split("_")[0] : ov;
      if (day === date || blockedReason(day, d) || !isDateBookable(parseApiDate(day))) {
        return { appointment: a, target: null, manual: true, reason: "The chosen date is blocked or outside the booking window" };
      }
      const t = pick(a, [day], slotMode ? ov : undefined);
      return t ? { appointment: a, target: t, manual: true } : { appointment: a, target: null, manual: true, reason: "No capacity on the chosen date" };
    }
    const t = pick(a, candidates);
    return t ? { appointment: a, target: t, manual: false } : { appointment: a, target: null, manual: false, reason: "No available alternative within the booking window" };
  });
}

export interface BlockOutcome {
  moved: { id: string; to: string }[];
  flagged: string[];
}

/**
 * Blocks a date and applies the admin-approved plan (appointmentId -> slotId, or null for manual handling).
 * Each target is re-validated at execution time; anything that no longer fits is flagged, never dropped or cancelled.
 */
export function blockDate(date: string, reason: string, by: string, approved: Record<string, string | null> = {}): Result<BlockOutcome> {
  return tx((d, out) => {
    const day = parseApiDate(date);
    if (Number.isNaN(day.getTime())) return fail("Choose a valid date");
    if (!reason.trim()) return fail("A reason is required");
    if (d.blockedDates.some((b) => b.date === date)) return fail("That date is already blocked");
    d.blockedDates.push({ date, reason: reason.trim() });
    d.blockedDates.sort((a, b) => a.date.localeCompare(b.date));

    const outcome: BlockOutcome = { moved: [], flagged: [] };
    const affected = d.appointments.filter((a) => isLive(a) && a.date === date);
    for (const a of affected) {
      const target = approved[a.id] ?? null;
      const stamp = nowIso();
      const was = describe(a, d);
      const open = target ? checkSlotOpen(d, target, a.id) : null;
      if (target && open && open.ok) {
        const slot = open.data;
        const from = `${a.date} ${a.startTime}`;
        a.date = slot.date;
        a.startTime = slot.startTime;
        a.endTime = slot.endTime;
        a.reminderSent = false;
        a.needsAttention = false;
        a.attentionReason = null;
        a.updatedAt = stamp;
        const note = `Date blocked (${reason.trim()}). Moved from ${from} to ${slot.date} ${slot.startTime}`;
        a.history.push({ at: stamp, from: a.status, to: a.status, by, kind: "block-redirect", note, changes: [{ field: "Date and time", from, to: `${slot.date} ${slot.startTime}` }] });
        const now = describe(a, d);
        outcome.moved.push({ id: a.id, to: `${slot.date} ${slot.startTime}` });
        notify(d, out, {
          audience: "PATIENT",
          a,
          kind: "RESCHEDULED",
          dedupe: `resched:${a.id}:${slot.id}`,
          title: "Your appointment has been rescheduled",
          message: `The clinic is closed on ${was.date} (${reason.trim()}), so your appointment was moved.\nAppointment ID: ${a.id}\nAppointment Type: ${now.type}\nOriginal: ${was.date}, ${was.time}\nNew: ${now.date}, ${now.time} - ${now.session}\nIf this time does not suit you, you can change it from My Appointments or call ${HOSPITAL.phoneDisplay}.`,
        });
      } else {
        a.needsAttention = true;
        a.attentionReason = `${date} was blocked (${reason.trim()}) and no alternative was assigned`;
        a.updatedAt = stamp;
        a.history.push({ at: stamp, from: a.status, to: a.status, by, kind: "block-redirect", note: `Date blocked (${reason.trim()}). Flagged for manual handling.` });
        outcome.flagged.push(a.id);
        notify(d, out, {
          audience: "PATIENT",
          a,
          kind: "NEEDS_ATTENTION",
          dedupe: `attention:${a.id}:${date}`,
          title: "Your appointment date is unavailable",
          message: `The clinic is closed on ${was.date} (${reason.trim()}). Your appointment ${a.id} (${was.type}) needs a new date.\nThe clinic will contact you, or you can pick a new date from My Appointments. Call ${HOSPITAL.phoneDisplay} for help.`,
        });
      }
    }
    log(d, by, "slots.block_date", `Blocked ${date}: ${reason.trim()} (${outcome.moved.length} moved, ${outcome.flagged.length} flagged)`);
    if (affected.length) {
      notify(d, out, {
        audience: "ADMIN",
        a: affected[0],
        kind: "RESCHEDULED",
        dedupe: `block:${date}:${nowIso()}`,
        title: `${date} blocked: ${affected.length} appointment(s) handled`,
        message: `Moved: ${outcome.moved.map((m) => `${m.id} to ${m.to}`).join(", ") || "none"}\nNeeds manual handling: ${outcome.flagged.join(", ") || "none"}`,
      });
    }
    return done(outcome);
  });
}

export function unblockDate(date: string, by: string) {
  return tx((d) => {
    d.blockedDates = d.blockedDates.filter((b) => b.date !== date);
    log(d, by, "slots.unblock_date", `Unblocked ${date}`);
    return done(undefined);
  });
}

export function setSlotOverride(slotId: string, patch: { capacity?: number | null; disabled?: boolean }, by: string): Result<void> {
  return tx((d) => {
    const slot = slotsFor(slotId.split("_")[0], d).find((s) => s.id === slotId);
    if (!slot) return fail("Slot not found");
    if (typeof patch.capacity === "number") {
      if (!Number.isInteger(patch.capacity) || patch.capacity < 1 || patch.capacity > 500) return fail("Capacity must be a whole number from 1 to 500");
      if (patch.capacity < slot.booked) return fail(`${slot.booked} appointment(s) are already booked; capacity cannot go below that`);
    }
    const next = { ...d.slotOverrides[slotId], ...patch } as { capacity?: number | null; disabled?: boolean };
    if (next.capacity === null) delete next.capacity;
    d.slotOverrides[slotId] = next as { capacity?: number; disabled?: boolean };
    log(d, by, "slots.update", `${slotId} ${JSON.stringify(patch)}`);
    return done(undefined);
  });
}

export function listBlocked() {
  return load().blockedDates;
}

export function listAudit(): AuditEntry[] {
  return load().audit;
}

// ---------- derived views ----------

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

/** One patient per phone number; returning = has a completed visit. */
export function listPatients(): PatientView[] {
  const byPhone = new Map<string, Appointment[]>();
  for (const a of load().appointments) byPhone.set(a.phone, [...(byPhone.get(a.phone) ?? []), a]);
  const t = Date.now();
  return [...byPhone.entries()].map(([phone, list]) => {
    const sorted = [...list].sort((x, y) => startOf(y) - startOf(x));
    const doneList = list.filter((a) => a.status === "COMPLETED");
    return {
      phone,
      name: sorted[0].fullName,
      email: sorted.find((a) => a.email)?.email ?? null,
      total: list.length,
      upcoming: list.filter((a) => isLive(a) && startOf(a) > t).length,
      completed: doneList.length,
      cancelled: list.filter((a) => a.status === "CANCELLED").length,
      noShow: list.filter((a) => a.status === "NO_SHOW").length,
      returning: doneList.length > 0,
      lastVisit: doneList.length ? [...doneList].sort((x, y) => startOf(y) - startOf(x))[0].date : null,
      appointments: sorted,
    };
  });
}

export function stats() {
  const d = load();
  const list = d.appointments;
  const today = formatDateForApi(todayIST());
  const t = Date.now();
  const count = (s: Status) => list.filter((a) => a.status === s).length;

  let openSeats = 0;
  for (let i = 1; i <= BOOKING_HOURS.maxDaysAhead; i++) {
    const info = dayInfo(formatDateForApi(addDaysUTC(todayIST(), i)), d);
    if (info.state === "available") openSeats += info.remaining;
  }

  return {
    total: list.length,
    pending: count("PENDING"),
    confirmed: count("CONFIRMED"),
    completed: count("COMPLETED"),
    cancelled: count("CANCELLED"),
    noShow: count("NO_SHOW"),
    today: list.filter((a) => a.date === today && a.status !== "CANCELLED").length,
    upcoming: list.filter((a) => isLive(a) && startOf(a) > t).length,
    needsAttention: list.filter((a) => a.needsAttention && isLive(a)).length,
    openSeats,
    blockedDates: d.blockedDates.filter((b) => b.date >= today).length,
    bookedAsNew: list.filter((a) => a.patientType === "NEW").length,
    bookedAsFollowUp: list.filter((a) => a.patientType === "FOLLOW_UP").length,
    recent: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
  };
}

/** True when the appointment was moved to another date or time at least once (by the patient, the admin or a date block). */
export const wasRescheduled = (a: Appointment) => a.history.some((h) => h.kind === "reschedule" || (h.kind === "block-redirect" && !!h.changes?.length));

export interface CountSet {
  appointments: number;
  completed: number;
  rescheduled: number;
  cancelled: number;
}

const countSet = (list: Appointment[]): CountSet => ({
  appointments: list.length,
  completed: list.filter((a) => a.status === "COMPLETED").length,
  rescheduled: list.filter(wasRescheduled).length,
  cancelled: list.filter((a) => a.status === "CANCELLED").length,
});

/** Dashboard cards, counted straight from the appointment records. "Today" = appointments dated today (India time). */
export function dashboardStats(): { overall: CountSet; today: CountSet } {
  const all = load().appointments;
  const today = formatDateForApi(todayIST());
  return { overall: countSet(all), today: countSet(all.filter((a) => a.date === today)) };
}

/** The latest token number issued and who got it (null before the first completed appointment). */
export function tokenInfo(): { last: number; next: number; latest: Appointment | null } {
  const d = load();
  const latest = d.appointments.filter((a) => a.tokenNumber).sort((x, y) => (y.tokenNumber ?? 0) - (x.tokenNumber ?? 0))[0] ?? null;
  return { last: d.tokenSeq, next: d.tokenSeq + 1, latest };
}

export function getDoctorCaps(): Record<DoctorGroup, number> {
  return load().doctorCaps;
}

// ---------- reminders (used by the cron route) ----------

/** Atomically marks as sent, and returns, confirmed appointments starting within the window. */
export function claimDueReminders(fromMs: number, toMs: number): Appointment[] {
  return withLock(() => {
    const d = load();
    const now = Date.now();
    const due = d.appointments.filter((a) => a.status === "CONFIRMED" && !a.reminderSent && startOf(a) >= now + fromMs && startOf(a) <= now + toMs);
    if (due.length === 0) return [];
    for (const a of due) a.reminderSent = true;
    save(d);
    return due;
  });
}

export function releaseReminder(id: string) {
  tx((d) => {
    const a = d.appointments.find((x) => x.id === id);
    if (a) a.reminderSent = false;
    return done(undefined);
  });
}

export interface Trend {
  labels: string[];
  booked: number[];
  cancelled: number[];
  rescheduled: number[];
}

const ISTDAY = (iso: string) => formatDateForApi(new Date(Date.parse(iso) + 330 * 60_000));
const isMove = (h: HistoryEntry) => h.kind === "reschedule" || (h.kind === "block-redirect" && !!h.changes?.length);

/** Counts for the Statistics page. `days` limits to appointment dates in the last N days (0 = all time). */
export function analysis(days: number) {
  const all = load().appointments;
  const today = todayIST();
  const from = days ? formatDateForApi(addDaysUTC(today, -days)) : "";
  const list = all.filter((a) => a.date >= from);

  // rebooked = not the patient's first appointment (same phone, earlier booking exists)
  const firstId = new Map<string, string>();
  for (const a of [...all].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) if (!firstId.has(a.phone)) firstId.set(a.phone, a.id);

  const count = (s: Status) => list.filter((a) => a.status === s).length;
  const completed = count("COMPLETED");
  const noShow = count("NO_SHOW");

  // What happened and when, from the history of every appointment
  const events: { day: string; type: "booked" | "cancelled" | "rescheduled" }[] = [];
  for (const a of all) {
    events.push({ day: ISTDAY(a.createdAt), type: "booked" });
    for (const h of a.history) {
      if (h.to === "CANCELLED" && h.from !== "CANCELLED") events.push({ day: ISTDAY(h.at), type: "cancelled" });
      if (isMove(h)) events.push({ day: ISTDAY(h.at), type: "rescheduled" });
    }
  }
  const monday = (date: string) => {
    const x = parseApiDate(date);
    return formatDateForApi(addDaysUTC(x, -((x.getUTCDay() + 6) % 7)));
  };
  const trend = (keys: string[], bucket: (day: string) => string): Trend => ({
    labels: keys,
    booked: keys.map((k) => events.filter((e) => e.type === "booked" && bucket(e.day) === k).length),
    cancelled: keys.map((k) => events.filter((e) => e.type === "cancelled" && bucket(e.day) === k).length),
    rescheduled: keys.map((k) => events.filter((e) => e.type === "rescheduled" && bucket(e.day) === k).length),
  });

  const of = <K extends keyof Appointment>(k: K, v: Appointment[K]) => list.filter((a) => a[k] === v).length;
  const doctorCounts = new Map<string, number>();
  for (const a of list) if (a.kind === "CONSULTATION" && a.status !== "CANCELLED") doctorCounts.set(doctorLabel(a), (doctorCounts.get(doctorLabel(a)) ?? 0) + 1);

  return {
    list,
    newPatients: of("patientType", "NEW"),
    followUps: of("patientType", "FOLLOW_UP"),
    online: of("source", "ONLINE"),
    byAdmin: of("source", "ADMIN"),
    consultations: of("kind", "CONSULTATION"),
    treatments: of("kind", "TREATMENT"),
    booked: list.length,
    completed,
    noShow,
    cancelled: count("CANCELLED"),
    upcoming: list.filter((a) => isLive(a)).length,
    rescheduled: list.filter((a) => a.history.some(isMove)).length,
    rebooked: list.filter((a) => firstId.get(a.phone) !== a.id).length,
    attendanceRate: completed + noShow ? Math.round((completed / (completed + noShow)) * 100) : null,
    byDoctor: [...doctorCounts].map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value),
    daily: trend(Array.from({ length: 14 }, (_, i) => formatDateForApi(addDaysUTC(today, i - 13))), (day) => day),
    weekly: trend(Array.from({ length: 8 }, (_, i) => monday(formatDateForApi(addDaysUTC(today, (i - 7) * 7)))), monday),
    monthly: trend(Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i - 5, 1)).toISOString().slice(0, 7)), (day) => day.slice(0, 7)),
  };
}

// ---------- doctors (content managed from the admin portal) ----------

export function listDoctors(opts: { publishedOnly?: boolean } = {}): Doctor[] {
  return load()
    .doctors.filter((x) => !opts.publishedOnly || x.published)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getSeniorDoctor(): Doctor | null {
  const list = listDoctors({ publishedOnly: true });
  return list.find((x) => x.isSenior) ?? null;
}

export interface DoctorInput {
  id?: string;
  name: string;
  qualification: string;
  designation: string;
  regNo: string;
  experience: number;
  specialization: string[];
  bio: string;
  message: string;
  image?: string;
  isSenior: boolean;
  published: boolean;
  sortOrder?: number;
}

export function saveDoctor(input: DoctorInput, by: string): Result<Doctor> {
  return tx((d) => {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) return fail("Doctor name must be 2 to 80 characters");
    if (input.designation.trim().length < 2 || input.designation.length > 80) return fail("Designation must be 2 to 80 characters");
    if (input.qualification.length > 80) return fail("Qualification must be 80 characters or fewer");
    if (!Number.isInteger(input.experience) || input.experience < 0 || input.experience > 60) return fail("Experience must be a whole number of years from 0 to 60");
    if (input.specialization.length > 8 || input.specialization.some((x) => x.length > 40)) return fail("Use up to 8 specialisations of 40 characters or fewer");
    if (input.bio.length > 1000) return fail("Biography must be 1000 characters or fewer");
    if (input.message.length > 400) return fail("Message must be 400 characters or fewer");
    if (d.doctors.some((x) => x.id !== input.id && x.name.toLowerCase() === name.toLowerCase())) return fail("A doctor with this name already exists");

    let doc = d.doctors.find((x) => x.id === input.id);
    if (input.id && !doc) return fail("Doctor not found");
    const created = !doc;
    if (!doc) {
      doc = {
        id: `doctor-${randomUUID().slice(0, 8)}`,
        name,
        qualification: "",
        designation: "",
        regNo: "",
        experience: 0,
        specialization: [],
        bio: "",
        message: "",
        image: "/logo-graphic.png",
        isSenior: false,
        published: true,
        sortOrder: d.doctors.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1,
      };
      d.doctors.push(doc);
    }
    if (!input.published && doc.published && d.doctors.filter((x) => x.published && x.id !== doc!.id).length === 0) {
      return fail("At least one doctor must stay published so patients can book");
    }
    doc.name = name;
    doc.qualification = input.qualification.trim();
    doc.designation = input.designation.trim();
    doc.regNo = input.regNo.trim();
    doc.experience = input.experience;
    doc.specialization = input.specialization.map((x) => x.trim()).filter(Boolean);
    doc.bio = input.bio.trim();
    doc.message = input.message.trim();
    if (input.image) doc.image = input.image;
    doc.published = input.published;
    if (input.sortOrder !== undefined && Number.isFinite(input.sortOrder)) doc.sortOrder = input.sortOrder;
    if (input.isSenior) for (const x of d.doctors) x.isSenior = x.id === doc.id;
    else doc.isSenior = false;
    // keep the name on existing bookings in step with the profile
    for (const a of d.appointments) if (a.doctorId === doc.id) a.doctorName = doc.name;
    log(d, by, created ? "doctor.create" : "doctor.update", `${created ? "Added" : "Updated"} doctor ${doc.name}${doc.published ? "" : " (unpublished)"}`, doc.id);
    return done(doc);
  });
}

export function deleteDoctor(id: string, by: string): Result<void> {
  return tx((d) => {
    const doc = d.doctors.find((x) => x.id === id);
    if (!doc) return fail("Doctor not found");
    const upcoming = d.appointments.filter((a) => a.doctorId === id && isLive(a)).length;
    if (upcoming) return fail(`${doc.name} has ${upcoming} pending or confirmed appointment(s). Reschedule or cancel them first, or unpublish the profile instead.`);
    if (doc.published && d.doctors.filter((x) => x.published && x.id !== id).length === 0) return fail("At least one doctor must stay published so patients can book");
    d.doctors = d.doctors.filter((x) => x.id !== id);
    log(d, by, "doctor.delete", `Deleted doctor ${doc.name}`, id);
    return done(undefined);
  });
}

// ---------- treatments (content managed from the admin portal) ----------

export function listTreatments(opts: { publishedOnly?: boolean } = {}): Treatment[] {
  return load()
    .treatments.filter((x) => !opts.publishedOnly || x.published)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getTreatment(idOrSlug: string): Treatment | null {
  return load().treatments.find((x) => x.id === idOrSlug || x.slug === idOrSlug) ?? null;
}

export interface TreatmentInput {
  id?: string;
  name: string;
  image?: string;
  subcategories: string[];
  published: boolean;
  sortOrder?: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "treatment";

export function saveTreatment(input: TreatmentInput, by: string): Result<Treatment> {
  return tx((d) => {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) return fail("Treatment title must be 2 to 80 characters");
    const subs = input.subcategories.map((x) => x.trim()).filter(Boolean);
    if (subs.length > 30 || subs.some((x) => x.length > 80)) return fail("Use up to 30 subcategories of 80 characters or fewer");
    if (new Set(subs.map((x) => x.toLowerCase())).size !== subs.length) return fail("Each subcategory must be different");
    if (d.treatments.some((x) => x.id !== input.id && x.name.toLowerCase() === name.toLowerCase())) return fail("A treatment with this title already exists");

    let t = d.treatments.find((x) => x.id === input.id);
    if (input.id && !t) return fail("Treatment not found");
    const created = !t;
    if (!t) {
      let slug = slugify(name);
      for (let n = 2; d.treatments.some((x) => x.slug === slug); n++) slug = `${slugify(name)}-${n}`;
      t = {
        id: `treatment-${randomUUID().slice(0, 8)}`,
        slug,
        name,
        image: "/logo-graphic.png",
        subcategories: [],
        published: true,
        sortOrder: d.treatments.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1,
      };
      d.treatments.push(t);
    }
    t.name = name;
    if (input.image) t.image = input.image;
    t.subcategories = subs;
    t.published = input.published;
    if (input.sortOrder !== undefined && Number.isFinite(input.sortOrder)) t.sortOrder = input.sortOrder;
    for (const a of d.appointments) if (a.treatmentId === t.id) a.treatmentName = t.name;
    log(d, by, created ? "treatment.create" : "treatment.update", `${created ? "Added" : "Updated"} treatment ${t.name} (${subs.length} subcategories)${t.published ? "" : " (unpublished)"}`, t.id);
    return done(t);
  });
}

export function deleteTreatment(id: string, by: string): Result<void> {
  return tx((d) => {
    const t = d.treatments.find((x) => x.id === id);
    if (!t) return fail("Treatment not found");
    const upcoming = d.appointments.filter((a) => a.treatmentId === id && isLive(a)).length;
    if (upcoming) return fail(`${t.name} has ${upcoming} pending or confirmed booking(s). Reschedule or cancel them first, or unpublish the treatment instead.`);
    d.treatments = d.treatments.filter((x) => x.id !== id);
    log(d, by, "treatment.delete", `Deleted treatment ${t.name}`, id);
    return done(undefined);
  });
}

// ---------- emergency closure ----------

/**
 * Closes a date because of an emergency: blocks it, cancels every pending/confirmed
 * appointment on it and tells each patient, with a link to book again.
 */
export function emergencyClose(date: string, reason: string, by: string): Result<{ cancelled: string[] }> {
  return tx((d, out) => {
    if (Number.isNaN(parseApiDate(date).getTime())) return fail("Choose a valid date");
    const why = reason.trim();
    if (!why) return fail("A reason is required");
    // An already-blocked date is fine: this still cancels whatever was left on it (e.g. appointments flagged by a plain block).
    if (!d.blockedDates.some((b) => b.date === date)) {
      d.blockedDates.push({ date, reason: why });
      d.blockedDates.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Every pending or confirmed appointment on the date, whatever filter or page the admin was looking at.
    // One locked write: either all of them are cancelled and saved, or none are.
    const affected = d.appointments.filter((a) => isLive(a) && a.date === date);
    for (const a of affected) {
      const stamp = nowIso();
      const was = describe(a, d);
      a.history.push({ at: stamp, from: a.status, to: "CANCELLED", by, kind: "status", note: `Cancelled by admin. Clinic closed: ${why}` });
      a.status = "CANCELLED";
      a.cancelledBy = "ADMIN";
      a.cancelReason = `Clinic closed: ${why}`;
      a.needsAttention = false;
      a.attentionReason = null;
      a.updatedAt = stamp;
      notify(d, out, {
        audience: "PATIENT",
        a,
        kind: "CANCELLED",
        dedupe: `closure:${a.id}:${date}`,
        title: "Your appointment was cancelled: the clinic is closed",
        message: `Dear ${a.fullName}, ${HOSPITAL.name} is closed on ${was.date} because of an emergency (${why}). We are very sorry: your appointment ${a.id} (${was.type}) at ${was.time} has been cancelled.\nPlease book a new appointment here: ${links(a).rebook}\nOr call ${HOSPITAL.phoneDisplay}.`,
      });
    }
    log(d, by, "slots.emergency_close", `Closed ${date} (${why}); ${affected.length} appointment(s) cancelled`);
    if (affected.length) {
      notify(d, out, {
        audience: "ADMIN",
        a: affected[0],
        kind: "CANCELLED",
        dedupe: `closure-admin:${date}:${nowIso()}`,
        title: `${date} closed: ${affected.length} appointment(s) cancelled`,
        message: `Reason: ${why}\nCancelled: ${affected.map((a) => a.id).join(", ")}\nEach patient was sent a message with a link to book again.`,
      });
    }
    return done({ cancelled: affected.map((a) => a.id) });
  });
}
