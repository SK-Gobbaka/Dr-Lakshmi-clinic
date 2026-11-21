"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import type { SiteSettings } from "@/lib/clinic/types";
import { BRAND, canEmbedMap, directionsUrl, fullAddress, hasMapLink, mapsEmbedUrl, mapsUrl } from "@/lib/site-info";

/**
 * Embedded Google map of the clinic, drawn from the address saved in Admin > Contact & site details.
 * Nothing is shown until an address (or exact coordinates) exists. If the frame has not loaded after a few
 * seconds (blocked, offline, ad-blocker), a readable fallback with direct links replaces it so the visitor can
 * still get directions. The map never affects the rest of the page.
 */
export function ClinicMap({ site, className = "" }: { site: SiteSettings; className?: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const embed = canEmbedMap(site);

  // Load the frame (and start the failure timer) only once the map scrolls into view,
  // so a map in the footer is not reported as broken before the browser even starts it.
  useEffect(() => {
    const el = box.current;
    if (!embed) return;
    if (!el || typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [embed]);

  useEffect(() => {
    if (!visible || state !== "loading") return;
    const t = setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), 8000);
    return () => clearTimeout(t);
  }, [state, visible]);

  if (!hasMapLink(site)) return null;
  const link = "inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-bold text-white hover:border-white transition-colors";

  return (
    <div className={className}>
      {embed && (
        <div ref={box} className="relative aspect-[1.8/1] overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1">
          {visible && state !== "failed" && (
            <iframe
              src={mapsEmbedUrl(site)}
              title={`Map showing ${BRAND.name}`}
              className="h-full w-full rounded-lg border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setState("ready")}
              onError={() => setState("failed")}
            />
          )}
          {state === "loading" && <div className="pointer-events-none absolute inset-0 flex animate-pulse items-center justify-center bg-white/5 text-xs text-white/70">Loading map...</div>}
          {state === "failed" && (
            <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-white/80">
              <MapPin className="h-6 w-6" aria-hidden />
              <p className="font-semibold">The map could not be loaded.</p>
              <p>{fullAddress(site)}</p>
              <button type="button" onClick={() => setState("loading")} className="underline">
                Try again
              </button>
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={mapsUrl(site)} target="_blank" rel="noopener noreferrer" className={link}>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in Google Maps
        </a>
        {embed && (
          <a href={directionsUrl(site)} target="_blank" rel="noopener noreferrer" className={link}>
            <Navigation className="h-3.5 w-3.5" aria-hidden /> Get directions
          </a>
        )}
      </div>
    </div>
  );
}
