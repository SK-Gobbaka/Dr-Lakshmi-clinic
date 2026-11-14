"use client";

import { usePathname } from "next/navigation";

/** Hides the public header/footer on admin pages. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/admin") ? null : <>{children}</>;
}
