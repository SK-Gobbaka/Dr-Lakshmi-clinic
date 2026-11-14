import { currentAdmin } from "@/lib/admin-auth";
import { analysis, doctorLabel, appointmentLabel } from "@/lib/local-store";
import { barChart, lineChart, pieChart } from "@/lib/charts";

// Spreadsheet cell: stop formula injection from patient-typed names.
const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const svg = (body: string, name: string) =>
  new Response(body, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.svg"` } });

export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "30";
  const days = ["0", "7", "30", "90"].includes(rangeParam) ? Number(rangeParam) : 30;
  const format = url.searchParams.get("format") ?? "csv";
  const a = analysis(days);
  const period = days ? `Last ${days} days` : "All time";
  const tag = `${days || "all"}`;

  if (format === "bar") {
    return svg(
      barChart("Bookings, cancellations and reschedulings", period, [
        { label: "Bookings", value: a.booked, color: "#1F7A63" },
        { label: "Came", value: a.completed, color: "#22c55e" },
        { label: "No-show", value: a.noShow, color: "#f59e0b" },
        { label: "Cancelled", value: a.cancelled, color: "#ef4444" },
        { label: "Rescheduled", value: a.rescheduled, color: "#a855f7" },
        { label: "Rebooked", value: a.rebooked, color: "#14b8a6" },
      ]),
      `insights-bar-${tag}`
    );
  }
  if (format === "pie") {
    return svg(
      pieChart("Appointment outcomes", period, [
        { label: "Came", value: a.completed, color: "#22c55e" },
        { label: "No-show", value: a.noShow, color: "#f59e0b" },
        { label: "Cancelled", value: a.cancelled, color: "#ef4444" },
        { label: "Still to come", value: a.upcoming, color: "#3b82f6" },
      ]),
      `insights-pie-${tag}`
    );
  }
  if (format === "line") {
    return svg(
      lineChart("Daily trend, last 14 days", "Bookings, cancellations and reschedulings by the day they happened", a.daily.labels.map((l) => l.slice(5)), [
        { name: "Bookings", color: "#1F7A63", values: a.daily.booked },
        { name: "Cancellations", color: "#ef4444", values: a.daily.cancelled },
        { name: "Reschedulings", color: "#a855f7", values: a.daily.rescheduled },
      ]),
      "insights-trend"
    );
  }
  if (format !== "csv") return new Response("Unknown format", { status: 400 });

  const rows: unknown[][] = [
    ["Appointment insights", period],
    ["Bookings", a.booked],
    ["Came (completed)", a.completed],
    ["No-show", a.noShow],
    ["Cancellations", a.cancelled],
    ["Reschedulings", a.rescheduled],
    ["Still to come", a.upcoming],
    ["Rebooked", a.rebooked],
    ["Attendance rate %", a.attendanceRate ?? ""],
    ["Consultations", a.consultations],
    ["Treatment bookings", a.treatments],
    ["New patients", a.newPatients],
    ["Follow-ups", a.followUps],
    ["Booked online", a.online],
    ["Booked by admin", a.byAdmin],
    [],
    ["Consultations by doctor", "Count"],
    ...a.byDoctor.map((d) => [d.label, d.value]),
    [],
    ["Day", "Bookings", "Cancellations", "Reschedulings"],
    ...a.daily.labels.map((l, i) => [l, a.daily.booked[i], a.daily.cancelled[i], a.daily.rescheduled[i]]),
    [],
    ["ID", "Patient", "Phone", "For", "Doctor", "Date", "Time", "Status", "Booked by", "Cancel reason", "Booked on"],
    ...a.list.map((x) => [x.id, x.fullName, x.phone, appointmentLabel(x), doctorLabel(x), x.date, x.startTime, x.status, x.source, x.cancelReason, x.createdAt]),
  ];
  return new Response("﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="insights-${tag}.csv"` },
  });
}
