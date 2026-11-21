import { addDaysUTC, formatDateForApi, todayIST } from "./slots";
import { appointmentLabel, doctorLabel, STATUS_LABEL, statusText, wasRescheduled, type Appointment, type Status } from "./clinic/types";
import type { AppointmentQuery } from "./clinic/appointments";
import { csv } from "./csv";
import { formatTime12Hour } from "./utils";

export const QUICK_VIEWS = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["yesterday", "Yesterday"],
  ["all", "All"],
] as const;
export type QuickView = (typeof QUICK_VIEWS)[number][0];

export interface AppointmentFilter {
  view: QuickView;
  date: string; // yyyy-MM-dd from the calendar picker; wins over the quick filter
  phone: string; // digits only
  status: Status | ""; // only this status (the dashboard tiles link here)
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Reads ?view=, ?date=, ?q= and ?status= the same way for the page and for the download, so both always match. */
export function parseFilter(sp: { view?: string; date?: string; q?: string; status?: string }): AppointmentFilter {
  const view = (QUICK_VIEWS.map((v) => v[0]) as string[]).includes(sp.view ?? "") ? (sp.view as QuickView) : "today";
  const phone = (sp.q ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  const status = Object.keys(STATUS_LABEL).includes(sp.status ?? "") ? (sp.status as Status) : "";
  return { view, date: isDate(sp.date ?? "") ? (sp.date as string) : "", phone, status };
}

/** The day a filter points at, or null for "All". */
export function filterDate(f: AppointmentFilter): string | null {
  if (f.date) return f.date;
  const today = todayIST();
  if (f.view === "today") return formatDateForApi(today);
  if (f.view === "tomorrow") return formatDateForApi(addDaysUTC(today, 1));
  if (f.view === "yesterday") return formatDateForApi(addDaysUTC(today, -1));
  return null;
}

/** The database query for a filter: every appointment of the chosen day whatever its status, unless a status is chosen. */
export function queryOf(f: AppointmentFilter, attention = false): AppointmentQuery {
  return { date: filterDate(f) ?? undefined, phone: f.phone || undefined, status: f.status || undefined, attention: attention || undefined };
}

export function appointmentsCsv(rows: Appointment[]): string {
  return csv(
    ["Appointment ID", "Date", "Time", "Name", "Age", "Gender", "Phone", "Type", "Doctor", "Status", "Rescheduled", "Token", "Cancel reason", "Booked on"],
    rows.map((a) => [
      a.id,
      a.date,
      formatTime12Hour(a.startTime),
      a.fullName,
      a.age,
      a.gender,
      a.phone,
      appointmentLabel(a),
      doctorLabel(a),
      statusText(a.status, a.cancelledBy),
      wasRescheduled(a) ? "Yes" : "No",
      a.tokenNumber,
      a.cancelReason,
      a.createdAt,
    ])
  );
}
