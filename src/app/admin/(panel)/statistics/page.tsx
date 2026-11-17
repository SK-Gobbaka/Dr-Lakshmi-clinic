import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { analysis, type Trend } from "@/lib/local-store";
import { PageTitle, btnPlain, btnPrimary, card, input, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

const RANGES = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["0", "All time"],
] as const;

const COLORS = { booked: "#1F7A63", cancelled: "#ef4444", rescheduled: "#a855f7" };

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: string }) {
  return (
    <div className={`${card} border-l-4 p-4 ${tone}`}>
      <div className="font-heading text-3xl font-semibold text-ink">{value}</div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-text-secondary">{hint}</div>
    </div>
  );
}

/** Bookings, cancellations and reschedulings side by side for each day, week or month. */
function TrendBars({ title, t }: { title: string; t: Trend }) {
  const series = [
    { name: "Bookings", color: COLORS.booked, values: t.booked },
    { name: "Cancellations", color: COLORS.cancelled, values: t.cancelled },
    { name: "Reschedulings", color: COLORS.rescheduled, values: t.rescheduled },
  ];
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const short = (l: string) => l.replace("Week of ", "").slice(l.length > 7 ? 5 : 0);
  return (
    <section className={`${card} p-4`}>
      <h2 className="mb-2 font-heading text-lg font-semibold text-ink">{title}</h2>
      <ul className="mb-3 flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} /> {s.name}
          </li>
        ))}
      </ul>
      <div className="flex h-44 items-end gap-1.5" role="img" aria-label={`${title}: ${t.labels.map((l, i) => `${l}: ${t.booked[i]} bookings, ${t.cancelled[i]} cancellations, ${t.rescheduled[i]} reschedulings`).join("; ")}`}>
        {t.labels.map((l, i) => (
          <div key={l} className="flex h-full flex-1 flex-col justify-end" title={`${l}: ${t.booked[i]} bookings, ${t.cancelled[i]} cancellations, ${t.rescheduled[i]} reschedulings`}>
            <div className="flex h-full items-end gap-px">
              {series.map((s) => (
                <span key={s.name} className="admin-chart-bar flex-1 rounded-t" style={{ animationDelay: `${i * 20}ms`, height: `${(s.values[i] / max) * 100}%`, minHeight: s.values[i] ? 3 : 0, background: s.color }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[10px] text-text-secondary">
        {t.labels.map((l) => (
          <span key={l} className="flex-1 truncate text-center">
            {short(l)}
          </span>
        ))}
      </div>
    </section>
  );
}

function Pie({ title, parts }: { title: string; parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const R = 15.9155; // circumference 100, so each value maps to a percentage
  const offsets = parts.map((_, i) => 25 - parts.slice(0, i).reduce((n, q) => n + (q.value / (total || 1)) * 100, 0));
  return (
    <section className={`${card} p-4`}>
      <h2 className="mb-3 font-heading text-lg font-semibold text-ink">{title}</h2>
      {total === 0 ? (
        <p className="text-sm text-text-secondary">No data in this range.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <svg viewBox="0 0 36 36" className="admin-chart-donut h-36 w-36 shrink-0" role="img" aria-label={`${title}: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
            {parts.map((p, i) => {
              const pct = (p.value / total) * 100;
              return <circle key={p.label} cx="18" cy="18" r={R} fill="none" stroke={p.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offsets[i]} />;
            })}
          </svg>
          <ul className="space-y-1 text-sm">
            {parts.map((p) => (
              <li key={p.label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
                {p.label}: <strong>{p.value}</strong> ({Math.round((p.value / total) * 100)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default async function StatisticsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const asked = one((await searchParams).range);
  const range = RANGES.find(([v]) => v === asked)?.[0] ?? "30";
  const a = analysis(Number(range));
  const doctorMax = Math.max(1, ...a.byDoctor.map((d) => d.value));

  return (
    <>
      <PageTitle sub="Counted by appointment date. The trend charts count the day each booking, cancellation or reschedule happened.">Statistics</PageTitle>

      <nav aria-label="Range" className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map(([v, label]) => (
          <Link key={v} href={`/admin/statistics?range=${v}`} aria-current={range === v ? "page" : undefined} className={`${btnPlain} h-9 ${range === v ? "border-primary bg-sand/60" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Bookings" value={a.booked} hint="All appointments in range" tone="border-l-slate-400" />
        <Tile label="Cancellations" value={a.cancelled} hint="Cancelled before the visit" tone="border-l-red-500" />
        <Tile label="Reschedulings" value={a.rescheduled} hint="Moved to another date or time" tone="border-l-purple-500" />
        <Tile label="Came" value={a.completed} hint={a.attendanceRate === null ? "No finished visits yet" : `${a.attendanceRate}% of finished visits`} tone="border-l-green-500" />
        <Tile label="No-show" value={a.noShow} hint="Did not come" tone="border-l-amber-500" />
        <Tile label="Still to come" value={a.upcoming} hint="Pending or confirmed" tone="border-l-blue-500" />
        <Tile label="Treatment bookings" value={a.treatments} hint="Booked through Book treatment" tone="border-l-teal-500" />
        <Tile label="Rebooked" value={a.rebooked} hint="Patient had an earlier booking" tone="border-l-cyan-500" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <TrendBars title="Per day (last 14 days)" t={a.daily} />
        <TrendBars title="Per week (last 8 weeks)" t={a.weekly} />
        <TrendBars title="Per month (last 6 months)" t={a.monthly} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Pie
          title="Appointment outcomes"
          parts={[
            { label: "Came", value: a.completed, color: "#22c55e" },
            { label: "No-show", value: a.noShow, color: "#f59e0b" },
            { label: "Cancelled", value: a.cancelled, color: "#ef4444" },
            { label: "Still to come", value: a.upcoming, color: "#3b82f6" },
          ]}
        />
        <Pie
          title="Consultations vs treatments"
          parts={[
            { label: "Consultations", value: a.consultations, color: "#1F7A63" },
            { label: "Treatments", value: a.treatments, color: "#0ea5e9" },
          ]}
        />
        <Pie
          title="New vs follow-up"
          parts={[
            { label: "New patients", value: a.newPatients, color: "#1F7A63" },
            { label: "Follow-ups", value: a.followUps, color: "#a855f7" },
          ]}
        />
      </div>

      <section className={`${card} mt-4 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Consultations by doctor</h2>
        {a.byDoctor.length === 0 ? (
          <p className="text-sm text-text-secondary">No consultations in this range.</p>
        ) : (
          <ul className="space-y-2">
            {a.byDoctor.map((d) => (
              <li key={d.label} className="grid grid-cols-[minmax(8rem,14rem)_1fr_2rem] items-center gap-2 text-sm">
                <span className="truncate">{d.label}</span>
                <span className="h-3 rounded bg-sand/60">
                  <span className="admin-chart-horizontal block h-3 rounded bg-primary" style={{ width: `${(d.value / doctorMax) * 100}%` }} />
                </span>
                <span className="text-right font-semibold">{d.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} mt-8 p-4`}>
        <h2 className="mb-1 font-heading text-lg font-semibold text-ink">Download insights</h2>
        <p className="mb-3 text-sm text-text-secondary">Choose how the insights are laid out in the file. Chart files are images (SVG) that open in any browser; the table opens in Excel or Google Sheets.</p>
        <form action="/admin/statistics/export" method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Show as
            <select name="format" defaultValue="bar" className={`${input} mt-1 w-64`}>
              <option value="bar">Bar graph (bookings, cancellations, reschedulings)</option>
              <option value="pie">Pie chart (appointment outcomes)</option>
              <option value="line">Line graph (trend over the last 14 days)</option>
              <option value="csv">Table (Excel / CSV)</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Period
            <select name="range" defaultValue={range} className={`${input} mt-1 w-44`}>
              {RANGES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={btnPrimary}>Download</button>
        </form>
      </section>
    </>
  );
}
