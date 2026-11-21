"use client";

import { useEffect, useState } from "react";
import { formatTime12Hour } from "@/lib/utils";

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  sessionName: string;
  remaining: number;
}

/**
 * Date + live slot chooser used by the admin forms. Availability comes from the server
 * every time the date changes, and the server re-checks it again on save.
 */
export function SlotPicker({ endpoint, excludeId, defaultSlotId, name = "slotId", showRemaining = true }: { endpoint: string; excludeId?: string; defaultSlotId?: string; name?: string; showRemaining?: boolean }) {
  const [date, setDate] = useState(defaultSlotId?.split("_")[0] ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [chosen, setChosen] = useState(defaultSlotId ?? "");
  const [state, setState] = useState<"idle" | "loading" | "error">(defaultSlotId ? "loading" : "idle");

  useEffect(() => {
    if (!date) return;
    let live = true;
    const q = new URLSearchParams({ date });
    if (excludeId) q.set("exclude", excludeId);
    fetch(`${endpoint}?${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((j) => {
        if (!live) return;
        setSlots(j.slots);
        setState("idle");
        setChosen((c) => (j.slots.some((s: Slot) => s.id === c) ? c : ""));
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [date, endpoint, excludeId]);

  const sessions = [...new Set(slots.map((s) => s.sessionName))];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-ink">
        Appointment date
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setState(e.target.value ? "loading" : "idle");
            setDate(e.target.value);
          }}
          required
          className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
        />
      </label>
      <input type="hidden" name={name} value={chosen} />
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Time slot</legend>
        {!date && <p className="text-sm text-text-secondary">Choose a date to see available slots.</p>}
        {state === "loading" && <p className="text-sm text-text-secondary">Checking availability…</p>}
        {state === "error" && <p role="alert" className="text-sm text-danger">Could not load availability. Try the date again.</p>}
        {date && state === "idle" && slots.length === 0 && <p className="text-sm text-danger">No slots available on this date (closed, blocked, Sunday, outside the booking window, or fully booked).</p>}
        {sessions.map((sn) => (
          <div key={sn} className="mb-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">{sn} session</p>
            <div className="flex flex-wrap gap-2">
              {slots
                .filter((s) => s.sessionName === sn)
                .map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setChosen(s.id)}
                    aria-pressed={chosen === s.id}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${chosen === s.id ? "border-primary bg-primary text-white" : "border-border bg-white text-ink hover:border-primary"}`}
                  >
                    {formatTime12Hour(s.startTime)}
                    {showRemaining && <span className={`ml-1.5 text-xs ${chosen === s.id ? "text-white/80" : "text-text-secondary"}`}>{s.remaining} left</span>}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
