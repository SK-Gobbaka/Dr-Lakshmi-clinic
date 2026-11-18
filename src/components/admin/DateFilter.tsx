"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

/** Calendar button: opens the browser's date picker and shows that day's appointments. */
export function DateFilter({ date, base }: { date: string; base: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (ref.current?.showPicker ? ref.current.showPicker() : ref.current?.click())}
        aria-label="Pick a date from the calendar"
        className={`inline-flex h-9 items-center gap-2 rounded-xl border bg-white px-3.5 text-sm font-semibold text-ink shadow-sm hover:border-primary/30 hover:bg-sand/50 ${date ? "border-primary bg-sand/60" : "border-border"}`}
      >
        <CalendarDays className="h-4 w-4" />
        {date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "Calendar"}
      </button>
      <input
        ref={ref}
        type="date"
        value={date}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => e.target.value && router.push(`${base}${base.includes("?") ? "&" : "?"}date=${e.target.value}`)}
        className="pointer-events-none absolute left-0 top-full h-0 w-0 opacity-0"
      />
    </div>
  );
}
