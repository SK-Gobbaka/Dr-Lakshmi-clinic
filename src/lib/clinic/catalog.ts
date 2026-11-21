import { formatDateForApi, todayIST } from "../slots";
import { slotsFor, validateSessions, lakshmiDoctor, doctorCapacity } from "./rules";
import { getConfig, getData, tx } from "./unit";
import {
  DEFAULT_SLOT_CAPACITY,
  DOCTOR_GROUPS,
  done,
  doctorGroupLabel,
  fail,
  nowIso,
  shortId,
  slotName,
  slugify,
  TIME_RE,
  toMin,
  usesCapacity,
  type AppointmentType,
  type Doctor,
  type DoctorCapacityRow,
  type DoctorGroup,
  type Result,
  type SessionConfig,
  type Treatment,
} from "./types";

const audit = (d: { audit: { at: string; actor: string; action: string; entityId?: string; summary: string }[] }, actor: string, action: string, summary: string, entityId?: string) =>
  d.audit.push({ at: nowIso(), actor, action, summary, entityId });

// ---------- appointment types ----------

export async function listTypes(opts: { activeOnly?: boolean } = {}): Promise<AppointmentType[]> {
  return (await getConfig()).appointmentTypes.filter((t) => !opts.activeOnly || t.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * Deletes an appointment type. Appointments that used it keep its name (snapshot), so no record breaks.
 * The last active type cannot be deleted because patients need one to book.
 */
export async function deleteType(id: string, by: string): Promise<Result<void>> {
  return tx({}, async (d, _out, q) => {
    const t = d.appointmentTypes.find((x) => x.id === id);
    if (!t) return fail("Appointment type not found");
    if (t.active && d.appointmentTypes.filter((x) => x.active && x.id !== id).length === 0) return fail("At least one appointment type must stay active");
    const kept = await q`update appointments set type_name = ${t.name} where type_id = ${id}`;
    d.appointmentTypes = d.appointmentTypes.filter((x) => x.id !== id);
    audit(d, by, "type.delete", `Deleted appointment type "${t.name}" (${kept.count} existing appointment(s) keep its name)`, id);
    return done(undefined);
  });
}

export async function saveType(input: { id?: string; name: string; description?: string; active?: boolean }, by: string): Promise<Result<AppointmentType>> {
  return tx({}, async (d, _out, q) => {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) return fail("Type name must be 2 to 60 characters");
    if (d.appointmentTypes.some((t) => t.id !== input.id && t.name.toLowerCase() === name.toLowerCase())) return fail("An appointment type with this name already exists");
    let t = d.appointmentTypes.find((x) => x.id === input.id);
    if (input.id && !t) return fail("Appointment type not found");
    if (!t) {
      t = { id: shortId("type"), name, description: "", active: true, sortOrder: d.appointmentTypes.length };
      d.appointmentTypes.push(t);
      audit(d, by, "type.create", `Created appointment type "${name}"`, t.id);
    } else {
      audit(d, by, "type.update", `Updated appointment type "${t.name}" -> "${name}"`, t.id);
      await q`update appointments set type_name = ${name} where type_id = ${t.id}`; // appointments show the renamed type
    }
    t.name = name;
    t.description = (input.description ?? t.description).trim().slice(0, 200);
    if (input.active !== undefined) {
      if (!input.active && t.active && d.appointmentTypes.filter((x) => x.active && x.id !== t.id).length === 0) return fail("At least one appointment type must stay active");
      t.active = input.active;
    }
    return done(t);
  });
}

// ---------- time slots ----------

export async function listSessions(): Promise<SessionConfig[]> {
  return [...(await getConfig()).sessions].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
}

export async function getSettings() {
  return (await getConfig()).settings;
}

export async function setAutoConfirm(on: boolean, by: string): Promise<Result<void>> {
  return tx({ settings: true }, (d) => {
    d.settings.autoConfirmOnline = on;
    audit(d, by, "settings.auto_confirm", `Online bookings are now ${on ? "confirmed automatically" : "held as pending until an admin confirms"}`);
    return done(undefined);
  });
}

/** Adds or edits a bookable time slot. The name is generated from the times; capacity defaults to 25. */
export async function saveSession(input: { id?: string; startTime: string; endTime: string; capacity?: number; active?: boolean }, by: string): Promise<Result<SessionConfig>> {
  return tx({ upcoming: true, exclusive: true }, (d) => {
    const existing = d.sessions.find((s) => s.id === input.id);
    if (input.id && !existing) return fail("Time slot not found");
    const s: SessionConfig = existing ? { ...existing } : { id: shortId("slot"), name: "", startTime: "", endTime: "", capacity: DEFAULT_SLOT_CAPACITY, active: true };
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
    audit(d, by, existing ? "slot.update" : "slot.create", `${s.name}, capacity ${s.capacity}, ${s.active ? "active" : "inactive"}`, s.id);
    return done(s);
  });
}

export async function deleteSession(id: string, by: string): Promise<Result<void>> {
  return tx({ upcoming: true, exclusive: true }, (d) => {
    const s = d.sessions.find((x) => x.id === id);
    if (!s) return fail("Time slot not found");
    const next = d.sessions.filter((x) => x.id !== id);
    if (!next.some((x) => x.active)) return fail("At least one time slot must stay active");
    const err = validateSessions(d, next); // refuses while upcoming appointments still use this slot
    if (err) return fail(err);
    d.sessions = next;
    audit(d, by, "slot.delete", `Deleted time slot ${s.name}`, id);
    return done(undefined);
  });
}

export async function setSlotOverride(slotId: string, patch: { capacity?: number | null; disabled?: boolean }, by: string): Promise<Result<void>> {
  const date = slotId.split("_")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Slot not found");
  return tx({ dates: [date] }, (d) => {
    const slot = slotsFor(date, d).find((s) => s.id === slotId);
    if (!slot) return fail("Slot not found");
    if (typeof patch.capacity === "number") {
      if (!Number.isInteger(patch.capacity) || patch.capacity < 1 || patch.capacity > 500) return fail("Capacity must be a whole number from 1 to 500");
      if (patch.capacity < slot.booked) return fail(`${slot.booked} appointment(s) are already booked; capacity cannot go below that`);
    }
    const next = { ...d.slotOverrides[slotId], ...patch } as { capacity?: number | null; disabled?: boolean };
    if (next.capacity === null) delete next.capacity;
    if (!next.disabled) delete next.disabled;
    if (next.capacity === undefined && !next.disabled) delete d.slotOverrides[slotId];
    else d.slotOverrides[slotId] = next as { capacity?: number; disabled?: boolean };
    audit(d, by, "slots.update", `${slotId} ${JSON.stringify(patch)}`);
    return done(undefined);
  });
}

export async function listBlocked() {
  return (await getConfig()).blockedDates;
}

// ---------- doctor-wise capacity ----------

export async function doctorCapacityFor(date: string): Promise<DoctorCapacityRow[]> {
  return doctorCapacity(date, await getData({ dates: [date] }));
}

/** Sets one group's daily capacity. Each group is independent: changing Dr. Lakshmi never touches Other Doctors. */
export async function setDoctorCapacity(group: DoctorGroup, capacity: number, by: string): Promise<Result<void>> {
  return tx({ upcoming: true, exclusive: true, settings: true }, (d) => {
    if (!DOCTOR_GROUPS.includes(group)) return fail("Unknown doctor group");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return fail("Capacity must be a whole number from 1 to 1000");
    const today = formatDateForApi(todayIST());
    const perDate = new Map<string, number>();
    for (const a of d.appointments) if (usesCapacity(a) && a.doctorGroup === group && a.date >= today) perDate.set(a.date, (perDate.get(a.date) ?? 0) + 1);
    const worst = [...perDate].find(([, n]) => n > capacity);
    if (worst) return fail(`${doctorGroupLabel(group)} already has ${worst[1]} bookings on ${worst[0]}; capacity cannot go below that`);
    d.doctorCaps[group] = capacity;
    audit(d, by, "doctor.capacity", `${doctorGroupLabel(group)} daily capacity set to ${capacity}`);
    return done(undefined);
  });
}

// ---------- doctors ----------

export async function listDoctors(opts: { publishedOnly?: boolean } = {}): Promise<Doctor[]> {
  return (await getConfig()).doctors.filter((x) => !opts.publishedOnly || x.published).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getSeniorDoctor(): Promise<Doctor | null> {
  return (await listDoctors({ publishedOnly: true })).find((x) => x.isSenior) ?? null;
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

export async function saveDoctor(input: DoctorInput, by: string): Promise<Result<Doctor>> {
  return tx({}, async (d, _out, q) => {
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
        id: shortId("doctor"),
        name,
        qualification: "",
        designation: "",
        regNo: "",
        experience: 0,
        specialization: [],
        bio: "",
        message: "",
        image: "",
        isSenior: false,
        published: true,
        sortOrder: d.doctors.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1,
      };
      d.doctors.push(doc);
    }
    if (!input.published && doc.published && d.doctors.filter((x) => x.published && x.id !== doc!.id).length === 0) return fail("At least one doctor must stay published so patients can book");
    if (doc.isSenior && !input.isSenior) return fail("Dr. Lakshmi is the senior consultant used by the booking form. Mark another doctor as senior instead of clearing this one.");
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
    await q`update appointments set doctor_name = ${doc.name} where doctor_id = ${doc.id}`; // keep the name on existing bookings in step with the profile
    audit(d, by, created ? "doctor.create" : "doctor.update", `${created ? "Added" : "Updated"} doctor ${doc.name}${doc.published ? "" : " (unpublished)"}`, doc.id);
    return done(doc);
  });
}

export async function deleteDoctor(id: string, by: string): Promise<Result<void>> {
  return tx({}, async (d, _out, q) => {
    const doc = d.doctors.find((x) => x.id === id);
    if (!doc) return fail("Doctor not found");
    if (lakshmiDoctor(d)?.id === id) return fail("Dr. Lakshmi is the senior consultant used by the booking form. Edit her profile instead of deleting it.");
    const [{ n }] = await q`select count(*)::int as n from appointments where doctor_id = ${id} and status in ('PENDING', 'CONFIRMED')`;
    if (n) return fail(`${doc.name} has ${n} pending or confirmed appointment(s). Reschedule or cancel them first, or unpublish the profile instead.`);
    if (doc.published && d.doctors.filter((x) => x.published && x.id !== id).length === 0) return fail("At least one doctor must stay published so patients can book");
    d.doctors = d.doctors.filter((x) => x.id !== id);
    audit(d, by, "doctor.delete", `Deleted doctor ${doc.name}`, id);
    return done(undefined);
  });
}

// ---------- treatments ----------

export async function listTreatments(opts: { publishedOnly?: boolean } = {}): Promise<Treatment[]> {
  return (await getConfig()).treatments.filter((x) => !opts.publishedOnly || x.published).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export interface TreatmentInput {
  id?: string;
  name: string;
  image?: string;
  subcategories: string[];
  published: boolean;
  sortOrder?: number;
}

export async function saveTreatment(input: TreatmentInput, by: string): Promise<Result<Treatment>> {
  return tx({}, async (d, _out, q) => {
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
      t = { id: shortId("treatment"), slug, name, image: "", subcategories: [], published: true, sortOrder: d.treatments.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1 };
      d.treatments.push(t);
    }
    t.name = name;
    if (input.image) t.image = input.image;
    t.subcategories = subs;
    t.published = input.published;
    if (input.sortOrder !== undefined && Number.isFinite(input.sortOrder)) t.sortOrder = input.sortOrder;
    await q`update appointments set treatment_name = ${t.name} where treatment_id = ${t.id}`;
    audit(d, by, created ? "treatment.create" : "treatment.update", `${created ? "Added" : "Updated"} treatment ${t.name} (${subs.length} subcategories)${t.published ? "" : " (unpublished)"}`, t.id);
    return done(t);
  });
}

export async function deleteTreatment(id: string, by: string): Promise<Result<void>> {
  return tx({}, async (d, _out, q) => {
    const t = d.treatments.find((x) => x.id === id);
    if (!t) return fail("Treatment not found");
    const [{ n }] = await q`select count(*)::int as n from appointments where treatment_id = ${id} and status in ('PENDING', 'CONFIRMED')`;
    if (n) return fail(`${t.name} has ${n} pending or confirmed booking(s). Reschedule or cancel them first, or unpublish the treatment instead.`);
    d.treatments = d.treatments.filter((x) => x.id !== id);
    audit(d, by, "treatment.delete", `Deleted treatment ${t.name}`, id);
    return done(undefined);
  });
}

