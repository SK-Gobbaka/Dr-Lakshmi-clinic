import Link from "next/link";
import { STATUS_LABEL, statusText, type Status } from "@/lib/clinic/types";
import { formatTime12Hour } from "@/lib/utils";

export const fmtDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export const fmtTime = formatTime12Hour;

export { STATUS_LABEL, statusText };

const STATUS_STYLE: Record<Status, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-800 border-blue-200",
  COMPLETED: "bg-green-50 text-green-800 border-green-200",
  CANCELLED: "bg-red-50 text-red-800 border-red-200",
  NO_SHOW: "bg-gray-100 text-gray-700 border-gray-200",
};

export function StatusLegend() {
  return (
    <p className="mb-4 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
      Colour key:
      {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
    </p>
  );
}

export function StatusBadge({ status, cancelledBy }: { status: Status; cancelledBy?: "ADMIN" | "PATIENT" | null }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {statusText(status, cancelledBy)}
    </span>
  );
}

/** One-shot message set by an action via ?notice= or ?error= */
export function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-4 rounded-md border px-4 py-3 text-sm font-medium ${
        error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {error || notice}
    </p>
  );
}

export const card = "admin-card rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
export const input =
  "h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-primary";
export const textarea =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-primary";
export const btn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors";
export const btnPrimary = `${btn} bg-primary text-white shadow-sm hover:bg-[#1D4ED8]`;
export const btnPlain = `${btn} border border-border bg-white text-ink shadow-sm hover:border-primary/30 hover:bg-sand/50`;
export const btnDanger = `${btn} bg-danger text-white shadow-sm hover:opacity-90`;

export function BackLink({ href = "/admin", children = "Back to dashboard" }: { href?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
      ← {children}
    </Link>
  );
}

export function PageTitle({ children, sub, action }: { children: React.ReactNode; sub?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">{children}</h1>
        {sub && <p className="mt-1 text-text-secondary">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className={`${card} border-dashed p-8 text-center text-text-secondary`}>{children}</p>;
}

export const label = "block text-sm font-semibold text-ink";

/** Previous / Next links for a long list. `href(n)` builds the address of page n. */
export function Pager({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (n: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-text-secondary">
        Page {page} of {pages} ({total} in all)
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={`${btnPlain} h-9`} rel="prev">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={`${btnPlain} h-9`} rel="next">
            Next
          </Link>
        )}
      </span>
    </nav>
  );
}

/** ?page= as a safe positive whole number. */
export const pageOf = (v: string | string[] | undefined) => Math.max(1, Math.min(100000, Math.floor(Number(one(v))) || 1));

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
