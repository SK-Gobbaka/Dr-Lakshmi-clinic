"use server";

import { revalidatePath } from "next/cache";
import { bookingSchema, cancelSchema, rescheduleSchema, treatmentBookingSchema, updateMySchema } from "@/lib/validations";
import { formatDateForApi, getBookableDates, isDateBookable, parseApiDate } from "@/lib/slots";
import * as store from "@/lib/local-store";
import { deliver } from "@/lib/notify";
import { myTokens, rememberToken } from "@/lib/patient-session";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: number;
  sessionName?: string;
}

export interface PublicType {
  id: string;
  name: string;
  description: string;
}

export interface DoctorAvailability {
  group: "LAKSHMI" | "OTHERS";
  label: string;
  remaining: number;
}

function refresh() {
  revalidatePath("/book");
  revalidatePath("/my-appointments");
  revalidatePath("/admin", "layout");
}

export async function getAvailableSlots(dateStr: string, editingToken?: string): Promise<ActionResult<AvailableSlot[]>> {
  try {
    if (!isDateBookable(parseApiDate(dateStr))) {
      return { success: false, error: "Selected date is not available for booking" };
    }
    const own = editingToken ? (store.idForToken(editingToken) ?? undefined) : undefined;
    return {
      success: true,
      data: store.bookableSlots(dateStr, own).map((x) => ({
        id: x.id,
        startTime: x.startTime,
        endTime: x.endTime,
        available: x.remaining,
        sessionName: x.sessionName,
      })),
    };
  } catch (error) {
    console.error("[getAvailableSlots]", error);
    return { success: false, error: "Failed to load available slots" };
  }
}

export async function getAvailableDates(): Promise<ActionResult<string[]>> {
  const dates = getBookableDates().map(formatDateForApi);
  return { success: true, data: dates.filter((d) => !store.blockedReason(d)) };
}

export async function createAppointment(
  input: unknown
): Promise<ActionResult<{ confirmationToken: string; appointmentId: string; status: string }>> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }
  const { slotId, date, fullName, phone, age, gender, patientType, doctorGroup } = parsed.data;
  if (!slotId.startsWith(`${date}_`)) return { success: false, error: "Selected date is not available for booking" };

  const created = store.createAppointment({ slotId, fullName, phone, age, gender, patientType, doctorGroup });
  if (!created.ok) return { success: false, error: created.error };
  const a = created.data;
  // The booking message (details, map, cancel and reschedule links) is built by the store and sent here.
  deliver(created.outbox);
  await rememberToken(a.token);
  refresh();
  return { success: true, data: { confirmationToken: a.token, appointmentId: a.id, status: a.status } };
}

/** Treatment booking: patient details and a slot only. It uses a slot place, but no doctor group. */
export async function createTreatmentBooking(
  input: unknown
): Promise<ActionResult<{ confirmationToken: string; appointmentId: string; status: string }>> {
  const parsed = treatmentBookingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  const { slotId, date, fullName, phone, age, gender } = parsed.data;
  if (!slotId.startsWith(`${date}_`)) return { success: false, error: "Selected date is not available for booking" };

  const created = store.createAppointment({ kind: "TREATMENT", slotId, fullName, phone, age, gender });
  if (!created.ok) return { success: false, error: created.error };
  const a = created.data;
  deliver(created.outbox);
  await rememberToken(a.token);
  refresh();
  return { success: true, data: { confirmationToken: a.token, appointmentId: a.id, status: a.status } };
}

export async function cancelAppointment(input: unknown): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid cancellation request" };
  const { token, reason } = parsed.data;

  const id = store.idForToken(token);
  if (!id) return { success: false, error: "Appointment not found" };
  const done = store.setStatus(id, "CANCELLED", "patient", { reason, patient: true });
  if (!done.ok) return { success: false, error: done.error };
  deliver(done.outbox);
  refresh();
  return { success: true, data: undefined };
}

/** Moves the same appointment to a new slot; the token and history stay with one record. */
export async function rescheduleAppointment(input: unknown): Promise<ActionResult<{ confirmationToken: string }>> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  const { token, newSlotId } = parsed.data;

  const id = store.idForToken(token);
  if (!id) return { success: false, error: "Appointment not found" };
  const moved = store.reschedule(id, newSlotId, "patient", { patient: true });
  if (!moved.ok) return { success: false, error: moved.error };
  deliver(moved.outbox); // new date and time with the cancel and reschedule links
  refresh();
  return { success: true, data: { confirmationToken: moved.data.token } };
}

/** Returns null when the token is unknown. */
export async function getAppointmentByToken(token: string) {
  const a = store.getByToken(token);
  return a ? { ...a, confirmationToken: a.token, typeName: store.appointmentLabel(a), sessionName: store.sessionNameFor(a.startTime) } : null;
}

export async function getAppointmentTypes(): Promise<PublicType[]> {
  return store.listTypes({ activeOnly: true }).map(({ id, name, description }) => ({ id, name, description }));
}

/** Remaining daily capacity of Dr. Lakshmi and Other Doctors on a date, so the booking form can grey out a full choice. */
export async function getDoctorAvailability(dateStr: string): Promise<DoctorAvailability[]> {
  return store.doctorCapacity(dateStr).map(({ group, label, remaining }) => ({ group, label, remaining }));
}

/** Patient edit via the private token link: details, type, date and time. */
export async function updateMyAppointment(input: unknown): Promise<ActionResult> {
  const parsed = updateMySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  const { token, doctorId: _doctor, ...fields } = parsed.data;
  void _doctor; // patients change doctor by rebooking; the edit link leaves it as booked
  const id = store.idForToken(token);
  if (!id) return { success: false, error: "Appointment not found" };
  const result = store.updateAppointment(id, { ...fields, email: fields.email || null, notes: fields.notes ?? null }, "patient", { patient: true });
  if (!result.ok) return { success: false, error: result.error };
  deliver(result.outbox);
  await rememberToken(token);
  refresh();
  return { success: true, data: undefined };
}

export async function getMyAppointments() {
  const tokens = await myTokens();
  return store
    .getByTokens(tokens)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
    .map((a) => ({
      id: a.id,
      token: a.token,
      fullName: a.fullName,
      phone: a.phone,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.status,
      typeName: store.appointmentLabel(a),
      doctorName: store.doctorLabel(a),
      sessionName: store.sessionNameFor(a.startTime),
      needsAttention: a.needsAttention,
      cancelReason: a.cancelReason,
      history: a.history,
    }));
}

export async function getMyNotifications() {
  const ids = store.getByTokens(await myTokens()).map((a) => a.id);
  const list = store.listNotifications({ audience: "PATIENT", appointmentIds: ids });
  return { unread: list.filter((n) => !n.readAt).length, items: list };
}

export async function markMyNotificationsRead(notificationId?: string): Promise<void> {
  const ids = store.getByTokens(await myTokens()).map((a) => a.id);
  store.markNotificationsRead({ audience: "PATIENT", appointmentIds: ids }, notificationId);
  revalidatePath("/my-appointments");
}
