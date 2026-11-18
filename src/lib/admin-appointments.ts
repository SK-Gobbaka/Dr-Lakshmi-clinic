import { addDaysUTC, formatDateForApi, todayIST } from "./slots";
import { appointmentLabel, doctorLabel, listAppointments, wasRescheduled, type Appointment } from "./local-store";
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
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Reads ?view=, ?date= and ?q= the same way for the page and for the download, so both always match. */
export function parseFilter(sp: { view?: string; date?: string; q?: string }): AppointmentFilter {
  const view = (QUICK_VIEWS.map((v) => v[0]) as string[]).includes(sp.view ?? "") ? (sp.view as QuickView) : "today";
  const phone = (sp.q ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return { view, date: isDate(sp.date ?? "") ? (sp.date as string) : "", phone };
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

/** Every appointment of the chosen day whatever its status: completed, cancelled, rescheduled or closed by the admin. */
export function filterAppointments(f: AppointmentFilter): Appointment[] {
  const day = filterDate(f);
  return listAppointments()
    .filter((a) => (!day || a.date === day) && (!f.phone || a.phone.includes(f.phone)))
    .sort((a, b) => (day ? a.startTime.localeCompare(b.startTime) || a.createdAt.localeCompare(b.createdAt) : b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime)));
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // quote everything that could break a CSV row, and defuse spreadsheet formulas
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const STATUS = { PENDING: "Pending", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No-show" } as const;

export function appointmentsCsv(rows: Appointment[]): string {
  const head = ["Appointment ID", "Date", "Time", "Name", "Age", "Gender", "Phone", "Type", "Doctor", "Status", "Rescheduled", "Token", "Cancel reason", "Booked on"];
  const lines = rows.map((a) =>
    [
      a.id,
      a.date,
      formatTime12Hour(a.startTime),
      a.fullName,
      a.age,
      a.gender,
      a.phone,
      appointmentLabel(a),
      doctorLabel(a),
      a.status === "CANCELLED" && a.cancelledBy ? `Cancelled by ${a.cancelledBy === "ADMIN" ? "Admin" : "Patient"}` : STATUS[a.status],
      wasRescheduled(a) ? "Yes" : "No",
      a.tokenNumber,
      a.cancelReason,
      a.createdAt,
    ]
      .map(cell)
      .join(",")
  );
  return "﻿" + [head.join(","), ...lines].join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8 names
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
