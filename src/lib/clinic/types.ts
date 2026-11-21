import { parseApiDate, slotStartsAt } from "../slots";
import { formatTime12Hour } from "../utils";

export type Status = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export const LIVE_STATUSES: Status[] = ["PENDING", "CONFIRMED"];

export const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

/** A cancelled appointment says who cancelled it: "Cancelled by Admin" or "Cancelled by Patient". */
export const statusText = (status: Status, cancelledBy?: "ADMIN" | "PATIENT" | null) =>
  status === "CANCELLED" && cancelledBy ? `Cancelled by ${cancelledBy === "ADMIN" ? "Admin" : "Patient"}` : STATUS_LABEL[status];

/** The booking form offers two choices: Dr. Lakshmi, or any other doctor. Each has its own daily capacity. */
export type DoctorGroup = "LAKSHMI" | "OTHERS";
export const DOCTOR_GROUPS: DoctorGroup[] = ["LAKSHMI", "OTHERS"];
export const OTHER_DOCTORS = "Other Doctors";
export const DEFAULT_SLOT_CAPACITY = 25;

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

/** One thing that happened to an appointment. Stored in appointment_events. */
export interface HistoryEntry {
  at: string;
  from: Status | null;
  to: Status;
  by: string;
  kind: "created" | "status" | "edit" | "reschedule" | "block-redirect";
  note?: string;
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
  typeName: string | null; // snapshot, so the record survives its appointment type being renamed or deleted
  kind: "CONSULTATION" | "TREATMENT";
  doctorId: string | null;
  doctorName: string | null; // snapshot, so history survives a doctor being removed
  doctorGroup: DoctorGroup | null; // null for treatment bookings
  treatmentId: string | null;
  treatmentName: string | null;
  persons: number;
  notes: string | null;
  status: Status;
  cancelReason: string | null;
  cancelledBy: "ADMIN" | "PATIENT" | null;
  needsAttention: boolean;
  attentionReason: string | null;
  reminderSent: boolean;
  rescheduleCount: number;
  tokenNumber: number | null; // assigned once, when the appointment is marked completed
  completedAt: string | null;
  source: "ONLINE" | "ADMIN";
  createdAt: string;
  updatedAt: string;
  /** Events recorded by the current change only; the full history is in the appointment_events table. */
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

/** One bookable time slot, repeated every day (Mon-Sat). */
export interface SessionConfig {
  id: string;
  name: string; // "9:00 AM - 10:00 AM", generated from the times
  startTime: string; // HH:mm
  endTime: string;
  capacity: number; // appointments accepted per day in this slot
  active: boolean;
}

export interface SlotOverride {
  capacity?: number;
  disabled?: boolean;
}

export interface BlockedDate {
  date: string;
  reason: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  entityId?: string;
  summary: string;
}

export interface TrustStat {
  label: string;
  value: string;
}

/** Public contact details and content switches, edited in Admin > Site settings. */
export interface SiteSettings {
  phone: string;
  phoneDisplay: string;
  whatsappNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  pincode: string;
  workingHours: string;
  closedDay: string;
  facebookUrl: string;
  instagramUrl: string;
  xUrl: string;
  youtubeUrl: string;
  googleMapsUrl: string;
  googleReviewUrl: string;
  googleRating: number | null;
  googleReviewCount: number | null;
  trustStats: TrustStat[];
}

export type MessageEvent = "BOOKING_PENDING" | "BOOKING_CONFIRMED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED" | "DATE_UNAVAILABLE" | "THANK_YOU" | "REMINDER" | "ADMIN_ALERT";

/** A message the app wants to send. `params` fill the variables of an approved WhatsApp template. */
export interface Outgoing {
  event: MessageEvent;
  audience: "PATIENT" | "ADMIN";
  phone: string;
  appointmentId: string | null;
  text: string;
  params: string[];
}

export type Result<T> = { ok: true; data: T; outbox: Outgoing[] } | { ok: false; error: string };
export type Raw<T> = { ok: true; data: T } | { ok: false; error: string };
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
export const done = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });

// ---------- slot views ----------

export interface SlotView {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionId: string;
  sessionName: string;
  sessionCapacity: number;
  sessionBooked: number;
  slotCapacity: number | null; // optional per-date cap set by an admin
  booked: number;
  remaining: number;
  disabled: boolean;
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

export interface DoctorCapacityRow {
  group: DoctorGroup;
  label: string;
  doctors: string[];
  capacity: number;
  booked: number;
  remaining: number;
}

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
export interface BlockOutcome {
  moved: { id: string; to: string }[];
  flagged: string[];
}

// ---------- small pure helpers ----------

export const nowIso = () => new Date().toISOString();
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const slotName = (start: string, end: string) => `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`;
/** Morning / Afternoon / Evening, only used to group slots on screen. */
export const periodOf = (startTime: string) => (toMin(startTime) < 720 ? "Morning" : toMin(startTime) < 1020 ? "Afternoon" : "Evening");
export const slotKey = (date: string, startTime: string) => `${date}_${startTime}`;
export const isLive = (a: Appointment) => LIVE_STATUSES.includes(a.status);
/** A place is held by every appointment except a cancelled one: completed and no-show visits still used their slot. */
export const usesCapacity = (a: Appointment) => a.status !== "CANCELLED";
export const startOf = (a: Appointment) => slotStartsAt(parseApiDate(a.date), a.startTime).getTime();
export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
export const shortId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/** What the appointment is for: the treatment name, or the consultation type. */
export function appointmentLabel(a: Appointment): string {
  if (a.kind === "TREATMENT") return a.treatmentName && a.treatmentName !== "Treatment" ? `Treatment: ${a.treatmentName}` : "Treatment";
  return a.typeName ?? "Not specified";
}

export function doctorLabel(a: Appointment): string {
  return a.kind === "TREATMENT" ? "-" : (a.doctorName ?? "Not specified");
}

/** True when the appointment was moved to another date or time at least once. */
export const wasRescheduled = (a: Appointment) => a.rescheduleCount > 0;

export const doctorGroupLabel = (g: DoctorGroup) => (g === "LAKSHMI" ? "Dr. Lakshmi" : OTHER_DOCTORS);
