"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

interface Item {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

/** Bell with an unread badge; polls the endpoint so new notifications appear without a reload. */
export function NotificationBell({ endpoint, href, initialUnread = 0, label = "Notifications" }: { endpoint: string; href: string; initialUnread?: number; label?: string }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(endpoint, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setUnread(j.unread ?? 0);
      setItems(j.items ?? []);
    } catch {
      /* offline: keep the last known count */
    }
  }, [endpoint]);

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          poll();
        }}
        aria-label={unread ? `${label}, ${unread} unread` : label}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-sand/60"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">{label}</span>
            <Link href={href} onClick={() => setOpen(false)} className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-text-secondary">No notifications yet.</li>}
            {items.slice(0, 6).map((n) => (
              <li key={n.id} className={`px-4 py-3 text-sm ${n.readAt ? "" : "bg-sand/30"}`}>
                <p className="font-semibold text-ink">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-text-secondary">{n.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
