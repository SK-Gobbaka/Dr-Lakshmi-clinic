"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { HOSPITAL } from "@/lib/constants";

/** Phone-only bar: the two things a patient came for stay one tap away while scrolling. */
export function MobileActionBar() {
  if (usePathname().startsWith("/book")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <a href={`tel:${HOSPITAL.phone}`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-ink/30 text-base font-semibold text-ink">
        <Phone className="h-4 w-4" aria-hidden />
        Call
      </a>
      <Link href="/book" className="flex h-12 flex-[2] items-center justify-center rounded-full bg-primary px-2 text-center text-sm font-semibold leading-tight text-white">
        Book appointment
      </Link>
      <Link href="/book/treatment" className="flex h-12 flex-[2] items-center justify-center rounded-full border border-primary px-2 text-center text-sm font-semibold leading-tight text-primary">
        Book treatment
      </Link>
    </div>
  );
}
