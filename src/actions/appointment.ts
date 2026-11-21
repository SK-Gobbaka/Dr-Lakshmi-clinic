"use server";

import * as clinic from "@/lib/clinic";
import { isDatabaseDown } from "@/lib/db";
import { deliver } from "@/lib/integrations/deliver";
import { verifyTurnstile } from "@/lib/integrations/turnstile";
import { log } from "@/lib/logger";
import { clientKey, withinLimit } from "@/lib/rate-limit";
import { formatDateForApi, getBookableDates, isDateBookable, parseApiDate } from "@/lib/slots";
import { bookingSchema, cancelSchema, rescheduleSchema, treatmentBookingSchema, updateMySchema } from "@/lib/validations";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

export interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: number;
  sessionName?: string;
}

export interface DoctorAvailability {
  group: "LAKSHMI" | "OTHERS";
  label: string;
  remaining: number;
}

type Booked = { confirmationToken: string; appointmentId: string; status: string };

const UNAVAILABLE = "Online booking is temporarily unavailable. Please try again in a few minutes or call the clinic.";
const BUSY = "Too many requests from this device. Please wait a few minutes and try again.";

/** Turns any unexpected failure into a clear message; a database outage is reported as "unavailable", not as a crash. */
async function guard<T>(name: string, run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (err) {
    log.error(`action.${name}`, err);
    return { success: false, error: isDatabaseDown(err) ? UNAVAILABLE : "Something went wrong. Please try again." };
  }
}

/** True while this device is within `limit` calls per `windowSeconds` for the named action. */
async function allowed(bucket: string, limit: number, windowSeconds: number) {
  return withinLimit(`${bucket}:${await clientKey()}`, limit, windowSeconds);
}

export async function getAvailableSlots(dateStr: string, editingToken?: string): Promise<ActionResult<AvailableSlot[]>> {
  return guard("getAvailableSlots", async () => {
    if (!(await allowed("slots", 120, 60))) return { success: false, error: BUSY };
    if (!isDateBookable(parseApiDate(dateStr))) return { success: false, error: "Selected date is not available for booking" };
    const own = editingToken ? ((await clinic.idForToken(editingToken)) ?? undefined) : undefined;
    const slots = await clinic.bookableSlots(dateStr, own);
    return { success: true, data: slots.map((x) => ({ id: x.id, startTime: x.startTime, endTime: x.endTime, available: x.remaining, sessionName: x.sessionName })) };
  });
}

export async function getAvailableDates(): Promise<ActionResult<string[]>> {
  return guard("getAvailableDates", async () => {
    const closed = new Set((await clinic.listBlocked()).map((b) => b.date));
    return { success: true, data: getBookableDates().map(formatDateForApi).filter((x) => !closed.has(x)) };
  });
}

/** Remaining daily capacity of Dr. Lakshmi and Other Doctors on a date, so the booking form can grey out a full choice. */
export async function getDoctorAvailability(dateStr: string): Promise<DoctorAvailability[]> {
  try {
    if (!(await allowed("slots", 120, 60))) return [];
    return (await clinic.doctorCapacityFor(dateStr)).map(({ group, label, remaining }) => ({ group, label, remaining }));
  } catch (err) {
    log.error("action.getDoctorAvailability", err);
    return [];
  }
}

/** Shared by the consultation and treatment forms: bot check, rate limits, then the booking itself. */
async function book(kind: "CONSULTATION" | "TREATMENT", p: { slotId: string; date: string; fullName: string; phone: string; age: number; gender: "MALE" | "FEMALE" | "OTHER"; patientType?: "NEW" | "FOLLOW_UP"; doctorGroup?: "LAKSHMI" | "OTHERS"; turnstileToken?: string }): Promise<ActionResult<Booked>> {
  if (!p.slotId.startsWith(`${p.date}_`)) return { success: false, error: "Selected date is not available for booking" };
  const ip = await clientKey();
  const human = await verifyTurnstile(p.turnstileToken, ip);
  if (!human.ok) return { success: false, error: "Please complete the security check and try again." };
  // 12 booking attempts an hour per device, 5 a day per phone number: enough for a family, too little to flood the calendar.
  if (!(await withinLimit(`book:ip:${ip}`, 12, 3600)) || !(await withinLimit(`book:phone:${p.phone}`, 5, 86400))) return { success: false, error: BUSY };

  const created = await clinic.createAppointment({ kind, slotId: p.slotId, fullName: p.fullName, phone: p.phone, age: p.age, gender: p.gender, patientType: p.patientType, doctorGroup: p.doctorGroup });
  if (!created.ok) return { success: false, error: created.error };
  await deliver(created.outbox); // the booking message with details, map, cancel and reschedule links
  const a = created.data;
  return { success: true, data: { confirmationToken: a.token, appointmentId: a.id, status: a.status } };
}

export async function createAppointment(input: unknown): Promise<ActionResult<Booked>> {
  return guard("createAppointment", async () => {
    const parsed = bookingSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    return book("CONSULTATION", parsed.data);
  });
}

/** Treatment booking: patient details and a slot only. It uses a slot place, but no doctor group. */
export async function createTreatmentBooking(input: unknown): Promise<ActionResult<Booked>> {
  return guard("createTreatmentBooking", async () => {
    const parsed = treatmentBookingSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    return book("TREATMENT", parsed.data);
  });
}

export async function cancelAppointment(input: unknown): Promise<ActionResult> {
  return guard("cancelAppointment", async () => {
    const parsed = cancelSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid cancellation request" };
    if (!(await allowed("manage", 30, 3600))) return { success: false, error: BUSY };
    const { token, reason } = parsed.data;
    const id = await clinic.idForToken(token);
    if (!id) return { success: false, error: "Appointment not found" };
    const done = await clinic.setStatus(id, "CANCELLED", "patient", { reason, patient: true });
    if (!done.ok) return { success: false, error: done.error };
    await deliver(done.outbox);
    return { success: true, data: undefined };
  });
}

/** Moves the same appointment to a new slot; the token and history stay with one record. */
export async function rescheduleAppointment(input: unknown): Promise<ActionResult<{ confirmationToken: string }>> {
  return guard("rescheduleAppointment", async () => {
    const parsed = rescheduleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    if (!(await allowed("manage", 30, 3600))) return { success: false, error: BUSY };
    const { token, newSlotId } = parsed.data;
    const id = await clinic.idForToken(token);
    if (!id) return { success: false, error: "Appointment not found" };
    const moved = await clinic.reschedule(id, newSlotId, "patient", { patient: true });
    if (!moved.ok) return { success: false, error: moved.error };
    await deliver(moved.outbox); // new date and time with the cancel and reschedule links
    return { success: true, data: { confirmationToken: moved.data.token } };
  });
}

/** Patient edit via the private token link: details, type, date and time. */
export async function updateMyAppointment(input: unknown): Promise<ActionResult> {
  return guard("updateMyAppointment", async () => {
    const parsed = updateMySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    if (!(await allowed("manage", 30, 3600))) return { success: false, error: BUSY };
    const { token, doctorId: _doctor, ...fields } = parsed.data;
    void _doctor; // patients change doctor by rebooking; the edit link leaves it as booked
    const id = await clinic.idForToken(token);
    if (!id) return { success: false, error: "Appointment not found" };
    const result = await clinic.updateAppointment(id, { ...fields, email: fields.email || null, notes: fields.notes ?? null }, "patient", { patient: true });
    if (!result.ok) return { success: false, error: result.error };
    await deliver(result.outbox);
    return { success: true, data: undefined };
  });
}
