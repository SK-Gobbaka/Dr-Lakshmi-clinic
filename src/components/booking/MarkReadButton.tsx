"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markMyNotificationsRead } from "@/actions/appointment";

export function MarkReadButton({ id, label = "Mark as read" }: { id?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markMyNotificationsRead(id);
          router.refresh();
        })
      }
      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-text-primary hover:bg-gray-50 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
