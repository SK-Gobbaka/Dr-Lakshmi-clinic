import { sql, type Q } from "../db";
import { parseApiDate } from "../slots";
import { reminderMessage, describe, notify, notifyCancelledByClinic, notifyCancelledByPatient, notifyConfirmed, notifyCreated, notifyDetailsChanged, notifyNeedsNewDate, notifyRescheduled, notifyThankYou } from "./messages";
import { bookableSlotsFrom, checkSlotOpen, lakshmiDoctor, slotsFor } from "./rules";
import { appointmentFromRow, getData, tx } from "./unit";
import {
  done,
  fail,
  isLive,
  nowIso,
  OTHER_DOCTORS,
  sameName,
  slotKey,
  startOf,
  type Appointment,
  type BlockOutcome,
  type Doctor,
  type DoctorGroup,
  type FieldChange,
  type Result,
  type SlotView,
  type Status,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateOfSlot = (slotId: string) => slotId.split("_")[0] ?? "";

// ---------- reading slots ----------

export async function listSlots(date: string): Promise<SlotView[]> {
  if (!DATE_RE.test(date)) return [];
  return slotsFor(date, await getData({ dates: [date] }));
}

/** Slots a patient or admin may book. `ignoreId`: an appointment being edited does not count against itself. */
export async function bookableSlots(date: string, ignoreId?: string): Promise<SlotView[]> {
  if (!DATE_RE.test(date)) return [];
  return bookableSlotsFrom(date, await getData({ dates: [date], ids: ignoreId ? [ignoreId] : [] }), ignoreId);
}

// ---------- reading appointments ----------

export async function getAppointment(id: string): Promise<Appointment | null> {
  const [r] = await sql()`select * from appointments where id = ${id}`;
  return r ? appointmentFromRow(r) : null;
}

export async function getByToken(token: string): Promise<Appointment | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const [r] = await sql()`select * from appointments where token = ${token}`;
  return r ? appointmentFromRow(r) : null;
}

export async function idForToken(token: string): Promise<string | null> {
  return (await getByToken(token))?.id ?? null;
}

export interface AppointmentQuery {
  date?: string;
  phone?: string; // digits; partial match
  exactPhone?: string;
  status?: Status;
  attention?: boolean;
}

function where(q: Q, f: AppointmentQuery) {
  const parts = [];
  if (f.date) parts.push(q`date = ${f.date}`);
  if (f.exactPhone) parts.push(q`phone = ${f.exactPhone}`);
  else if (f.phone) parts.push(q`phone like ${"%" + f.phone.replace(/\D/g, "") + "%"}`);
  if (f.status) parts.push(q`status = ${f.status}`);
  if (f.attention) parts.push(q`needs_attention and status in ('PENDING', 'CONFIRMED')`);
  return parts.length ? parts.reduce((acc, p, i) => (i === 0 ? q`where ${p}` : q`${acc} and ${p}`), q``) : q``;
}

const order = (q: Q, f: AppointmentQuery) => (f.date ? q`order by start_time, created_at` : q`order by date desc, start_time, created_at`);

/** One page of appointments plus the total number matching. */
export async function searchAppointments(f: AppointmentQuery, page = 1, pageSize = 50): Promise<{ rows: Appointment[]; total: number }> {
  const q = sql();
  const offset = (Math.max(1, page) - 1) * pageSize;
  const [rows, [{ count }]] = await Promise.all([
    q`select * from appointments ${where(q, f)} ${order(q, f)} limit ${pageSize} offset ${offset}`,
    q`select count(*)::int as count from appointments ${where(q, f)}`,
  ]);
  return { rows: rows.map(appointmentFromRow), total: count };
}

/** Every matching appointment (downloads). Capped so one request cannot read the whole table. */
export async function exportAppointments(f: AppointmentQuery, limit = 20_000): Promise<Appointment[]> {
  const q = sql();
  return (await q`select * from appointments ${where(q, f)} ${order(q, f)} limit ${limit}`).map(appointmentFromRow);
}

export async function appointmentsOn(date: string): Promise<Appointment[]> {
  return DATE_RE.test(date) ? (await sql()`select * from appointments where date = ${date} order by start_time, created_at`).map(appointmentFromRow) : [];
}

export async function appointmentsForPhone(phone: string): Promise<Appointment[]> {
  return (await sql()`select * from appointments where phone = ${phone} order by date desc, start_time desc limit 500`).map(appointmentFromRow);
}

// ---------- creating ----------

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
  treatmentId?: string | null;
  persons?: number;
  notes?: string | null;
  status?: Extract<Status, "PENDING" | "CONFIRMED">; // admin only
}

export async function createAppointment(input: NewAppointment, by = "patient"): Promise<Result<Appointment>> {
  const date = dateOfSlot(input.slotId);
  if (!DATE_RE.test(date)) return fail("Selected date is not available for booking");
  return tx({ dates: [date], newId: true }, (d, out) => {
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
      } else if (input.doctorGroup === "OTHERS" || input.doctorId === "OTHERS") {
        group = "OTHERS";
      } else if (input.doctorId) {
        doctor = d.doctors.find((x) => x.id === input.doctorId && x.published);
        if (!doctor) return fail("Please choose the doctor you want to consult");
        group = "OTHERS";
      } else return fail("Please choose the doctor you want to consult");
    }
    const open = checkSlotOpen(d, input.slotId, undefined, admin, group);
    if (!open.ok) return open;
    const slot = open.data;

    const dup = d.appointments.find((a) => isLive(a) && a.phone === input.phone && sameName(a.fullName, input.fullName) && a.date === slot.date && a.startTime === slot.startTime);
    if (dup) return fail(`${input.fullName.trim()} already has a booking in this time slot (${dup.id}).`);

    const status: Status = admin ? (input.status ?? "CONFIRMED") : d.settings.autoConfirmOnline ? "CONFIRMED" : "PENDING";
    const stamp = nowIso();
    const appt: Appointment = {
      id: `APT-${d.apptCounter!.year}-${String(d.apptCounter!.last).padStart(3, "0")}`,
      token: crypto.randomUUID(),
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
      typeName: type?.name ?? null,
      kind,
      doctorId: doctor?.id ?? null,
      doctorName: doctor?.name ?? (group === "OTHERS" ? OTHER_DOCTORS : null),
      doctorGroup: group,
      treatmentId: treatment?.id ?? null,
      treatmentName: treatment?.name ?? (kind === "TREATMENT" ? "Treatment" : null),
      persons: input.persons ?? 1,
      notes: input.notes?.trim() || null,
      status,
      cancelReason: null,
      cancelledBy: null,
      needsAttention: false,
      attentionReason: null,
      reminderSent: false,
      rescheduleCount: 0,
      tokenNumber: null,
      completedAt: null,
      source: admin ? "ADMIN" : "ONLINE",
      createdAt: stamp,
      updatedAt: stamp,
      history: [{ at: stamp, from: null, to: status, by, kind: "created", note: admin ? "Created manually by admin" : undefined }],
    };
    d.appointments.push(appt);
    d.audit.push({ at: stamp, actor: by, action: "appointment.create", entityId: appt.id, summary: `${appt.id} ${appt.fullName} ${appt.date} ${appt.startTime} (${treatment ? `treatment ${treatment.name}` : type?.name}${doctor ? `, ${doctor.name}` : ""}, ${status})` });
    if (status === "CONFIRMED") notifyConfirmed(d, out, appt);
    else notifyCreated(d, out, appt);
    return done(appt);
  });
}

// ---------- changing status ----------

const TRANSITIONS: Record<Status, Status[]> = {
  PENDING: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};
const pretty = (s: string) => s.toLowerCase().replace("_", "-");

export async function setStatus(id: string, to: Status, by: string, opts: { reason?: string; patient?: boolean } = {}): Promise<Result<Appointment>> {
  return tx({ ids: [id], settings: to === "COMPLETED" }, (d, out) => {
    const a = d.appointments.find((x) => x.id === id);
    if (!a) return fail("Appointment not found");
    if (a.status === to) return fail(`Appointment is already ${pretty(to)}`);
    if (!TRANSITIONS[a.status].includes(to)) return fail(`A ${pretty(a.status)} appointment cannot be changed to ${pretty(to)}`);
    if (to === "CONFIRMED" && startOf(a) <= Date.now()) return fail("This appointment time has already passed and cannot be confirmed.");
    if (to === "CONFIRMED" && d.blockedDates.some((b) => b.date === a.date)) return fail("This date is blocked. Move the appointment to another date before confirming.");
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
      // The counter row is locked for the whole transaction and a second completion is rejected above,
      // so tokens are sequential and a token is never issued twice.
      a.tokenNumber ??= ++d.tokenSeq;
      a.completedAt = stamp;
    }
    if (to !== "PENDING" && to !== "CONFIRMED") {
      a.needsAttention = false;
      a.attentionReason = null;
    }
    a.status = to;
    a.updatedAt = stamp;
    d.audit.push({ at: stamp, actor: by, action: `appointment.${to.toLowerCase()}`, entityId: a.id, summary: `${a.id} ${a.fullName} -> ${to}${opts.reason ? ` (${opts.reason})` : ""}` });
    if (to === "CONFIRMED") notifyConfirmed(d, out, a);
    if (to === "CANCELLED") {
      notifyCancelledByPatient(d, out, a);
      if (!opts.patient) notifyCancelledByClinic(d, out, a);
    }
    if (to === "COMPLETED") notifyThankYou(d, out, a);
    return done(a);
  });
}

// ---------- editing and moving ----------

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
export async function updateAppointment(id: string, patch: AppointmentPatch, by: string, opts: { patient?: boolean } = {}): Promise<Result<Appointment>> {
  const target = patch.slotId ? dateOfSlot(patch.slotId) : "";
  return tx({ ids: [id], dates: DATE_RE.test(target) ? [target] : [] }, (d, out) => {
    const a = d.appointments.find((x) => x.id === id);
    if (!a) return fail("Appointment not found");
    if (!isLive(a)) return fail("Only pending or confirmed appointments can be edited");
    const beforeStatus = a.status;
    const beforeType = a.typeName;
    const beforeWhen = `${a.date} ${a.startTime}`;
    const was = describe(a, d);
    const changes: FieldChange[] = [];
    const set = <K extends keyof Appointment>(field: K, value: Appointment[K], label: string) => {
      if (value === a[field]) return;
      changes.push({ field: label, from: a[field] === null || a[field] === undefined ? null : String(a[field]), to: value === null || value === undefined ? null : String(value) });
      a[field] = value;
    };

    if (patch.slotId !== undefined && patch.slotId !== slotKey(a.date, a.startTime)) {
      if (startOf(a) <= Date.now()) return fail("This appointment has already started or passed; its time can no longer be changed.");
      const open = checkSlotOpen(d, patch.slotId, a.id, false);
      if (!open.ok) return open;
      const slot = open.data;
      changes.push({ field: "Date and time", from: beforeWhen, to: `${slot.date} ${slot.startTime}` });
      a.date = slot.date;
      a.startTime = slot.startTime;
      a.endTime = slot.endTime;
      a.reminderSent = false;
      a.rescheduleCount += 1;
      if (a.needsAttention) {
        a.needsAttention = false;
        a.attentionReason = null;
      }
    }
    if (patch.typeId !== undefined && patch.typeId !== a.typeId) {
      const t = d.appointmentTypes.find((x) => x.id === patch.typeId);
      if (!t || !t.active) return fail("Please select a valid appointment type");
      changes.push({ field: "Appointment type", from: beforeType ?? "Not specified", to: t.name });
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
    const summary = changes.map((c) => `${c.field}: ${c.from ?? "-"} -> ${c.to ?? "-"}`).join("\n");
    a.history.push({ at: stamp, from: beforeStatus, to: a.status, by, kind: moved ? "reschedule" : "edit", changes, note: summary.replace(/\n/g, "; ") });
    d.audit.push({ at: stamp, actor: by, action: "appointment.edit", entityId: a.id, summary: `${a.id} ${changes.map((c) => c.field).join(", ")}` });

    const who = opts.patient ? "patient" : "clinic";
    if (moved) notifyRescheduled(d, out, a, { by: who, summary, was });
    else {
      notifyDetailsChanged(d, out, a, summary, who);
      if (!opts.patient && changes.some((c) => c.field === "Appointment type")) notifyRescheduled(d, out, a, { by: "clinic", summary, was, moved: false });
    }
    return done(a);
  });
}

export async function reschedule(id: string, newSlotId: string, by: string, opts: { patient?: boolean } = {}): Promise<Result<Appointment>> {
  const a = await getAppointment(id);
  if (!a) return fail("Appointment not found");
  if (!isLive(a)) return fail("This appointment cannot be rescheduled");
  if (slotKey(a.date, a.startTime) === newSlotId) return fail("Please choose a different time slot.");
  return updateAppointment(id, { slotId: newSlotId }, by, opts);
}

export async function deleteAppointment(id: string, by: string): Promise<Result<void>> {
  return tx({ ids: [id] }, (d) => {
    const a = d.appointments.find((x) => x.id === id);
    if (!a) return fail("Appointment not found");
    if (a.status !== "CANCELLED") return fail("Only cancelled appointments can be deleted. Cancel it first.");
    d.appointments = d.appointments.filter((x) => x.id !== id);
    d.audit.push({ at: nowIso(), actor: by, action: "appointment.delete", entityId: a.id, summary: `${a.id} ${a.fullName} ${a.date} deleted` });
    return done(undefined);
  });
}

// ---------- blocking a date ----------

/**
 * Blocks a date and applies the admin-approved plan (appointmentId -> slotId, or null for manual handling).
 * Each target is re-validated inside the transaction; anything that no longer fits is flagged, never dropped or cancelled.
 */
export async function blockDate(date: string, reason: string, by: string, approved: Record<string, string | null> = {}): Promise<Result<BlockOutcome>> {
  if (!DATE_RE.test(date) || Number.isNaN(parseApiDate(date).getTime())) return fail("Choose a valid date");
  const targets = Object.values(approved).filter((v): v is string => !!v).map(dateOfSlot).filter((x) => DATE_RE.test(x));
  return tx({ dates: [date, ...targets] }, (d, out) => {
    if (!reason.trim()) return fail("A reason is required");
    if (d.blockedDates.some((b) => b.date === date)) return fail("That date is already blocked");
    d.blockedDates.push({ date, reason: reason.trim() });

    const outcome: BlockOutcome = { moved: [], flagged: [] };
    const affected = d.appointments.filter((a) => isLive(a) && a.date === date);
    for (const a of affected) {
      const target = approved[a.id] ?? null;
      const stamp = nowIso();
      const was = describe(a, d);
      const open = target ? checkSlotOpen(d, target, a.id, false) : null;
      if (target && open && open.ok) {
        const slot = open.data;
        const from = `${a.date} ${a.startTime}`;
        a.date = slot.date;
        a.startTime = slot.startTime;
        a.endTime = slot.endTime;
        a.reminderSent = false;
        a.needsAttention = false;
        a.attentionReason = null;
        a.rescheduleCount += 1;
        a.updatedAt = stamp;
        a.history.push({ at: stamp, from: a.status, to: a.status, by, kind: "block-redirect", note: `Date blocked (${reason.trim()}). Moved from ${from} to ${slot.date} ${slot.startTime}`, changes: [{ field: "Date and time", from, to: `${slot.date} ${slot.startTime}` }] });
        outcome.moved.push({ id: a.id, to: `${slot.date} ${slot.startTime}` });
        notifyRescheduled(d, out, a, { by: "clinic", summary: "", was, blockedReason: reason.trim() });
      } else {
        a.needsAttention = true;
        a.attentionReason = `${date} was blocked (${reason.trim()}) and no alternative was assigned`;
        a.updatedAt = stamp;
        a.history.push({ at: stamp, from: a.status, to: a.status, by, kind: "block-redirect", note: `Date blocked (${reason.trim()}). Flagged for manual handling.` });
        outcome.flagged.push(a.id);
        notifyNeedsNewDate(d, out, a, was, reason.trim());
      }
    }
    d.audit.push({ at: nowIso(), actor: by, action: "slots.block_date", summary: `Blocked ${date}: ${reason.trim()} (${outcome.moved.length} moved, ${outcome.flagged.length} flagged)` });
    if (affected.length) {
      notify(out, {
        audience: "ADMIN",
        a: affected[0],
        event: "ADMIN_ALERT",
        title: `${date} blocked: ${affected.length} appointment(s) handled`,
        message: `Moved: ${outcome.moved.map((m) => `${m.id} to ${m.to}`).join(", ") || "none"}\nNeeds manual handling: ${outcome.flagged.join(", ") || "none"}`,
        params: [],
      });
    }
    return done(outcome);
  });
}

export async function unblockDate(date: string, by: string): Promise<Result<void>> {
  return tx({}, (d) => {
    d.blockedDates = d.blockedDates.filter((b) => b.date !== date);
    d.audit.push({ at: nowIso(), actor: by, action: "slots.unblock_date", summary: `Unblocked ${date}` });
    return done(undefined);
  });
}

/**
 * Closes a date because of an emergency: blocks it, cancels every pending/confirmed
 * appointment on it and tells each patient, with a link to book again.
 * All of it is one transaction: either every appointment on the date is cancelled, or none is.
 */
export async function emergencyClose(date: string, reason: string, by: string): Promise<Result<{ cancelled: string[] }>> {
  if (!DATE_RE.test(date) || Number.isNaN(parseApiDate(date).getTime())) return fail("Choose a valid date");
  return tx({ dates: [date] }, (d, out) => {
    const why = reason.trim();
    if (!why) return fail("A reason is required");
    // An already-blocked date is fine: this still cancels whatever was left on it.
    if (!d.blockedDates.some((b) => b.date === date)) d.blockedDates.push({ date, reason: why });

    const affected = d.appointments.filter((a) => isLive(a) && a.date === date);
    for (const a of affected) {
      const stamp = nowIso();
      a.history.push({ at: stamp, from: a.status, to: "CANCELLED", by, kind: "status", note: `Cancelled by admin. Clinic closed: ${why}` });
      a.status = "CANCELLED";
      a.cancelledBy = "ADMIN";
      a.cancelReason = `Clinic closed: ${why}`;
      a.needsAttention = false;
      a.attentionReason = null;
      a.updatedAt = stamp;
      notifyCancelledByClinic(d, out, a, { why });
    }
    d.audit.push({ at: nowIso(), actor: by, action: "slots.emergency_close", summary: `Closed ${date} (${why}); ${affected.length} appointment(s) cancelled` });
    if (affected.length) {
      notify(out, {
        audience: "ADMIN",
        a: affected[0],
        event: "ADMIN_ALERT",
        title: `${date} closed: ${affected.length} appointment(s) cancelled`,
        message: `Reason: ${why}\nCancelled: ${affected.map((a) => a.id).join(", ")}\nEach patient was sent a message with a link to book again.`,
        params: [],
      });
    }
    return done({ cancelled: affected.map((a) => a.id) });
  });
}

// ---------- reminders (used by the cron route) ----------

/** Atomically marks as sent, and returns, confirmed appointments starting between `fromMs` and `toMs` from now. */
export async function claimDueReminders(fromMs: number, toMs: number): Promise<Appointment[]> {
  const rows = await sql()`
    update appointments set reminder_sent = true
     where status = 'CONFIRMED' and not reminder_sent
       and ((date + start_time::time) at time zone 'Asia/Kolkata') between now() + make_interval(secs => ${fromMs / 1000}) and now() + make_interval(secs => ${toMs / 1000})
    returning *`;
  return rows.map(appointmentFromRow);
}

export async function releaseReminder(id: string) {
  await sql()`update appointments set reminder_sent = false where id = ${id}`;
}

/** Reminder messages for appointments returned by claimDueReminders. */
export async function remindersFor(list: Appointment[]) {
  const d = await getData();
  return list.map((a) => ({ appointment: a, message: reminderMessage(a, d) }));
}

