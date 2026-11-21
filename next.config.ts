import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
// A site served over plain http (a local production run, the browser tests) must not have its own requests upgraded to https.
const httpOnly = !!process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.startsWith("https://");

/**
 * Content-Security-Policy. Everything the site loads comes from itself, except:
 *  - Cloudflare Turnstile (bot check): script, frame, connection
 *  - Google Maps (embedded map in the footer): frame
 *  - Supabase Storage (doctor, treatment and gallery photos): images
 * Inline scripts and styles are allowed because Next.js emits inline bootstrapping code; every other directive is
 * locked down (no framing of the site, no plugins, forms post only to this site).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' https://challenges.cloudflare.com${dev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "frame-src https://challenges.cloudflare.com https://maps.google.com https://www.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(dev || httpOnly ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // photo uploads (max 2 MB each) travel inside a Server Action request
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    qualities: [75, 100], // the logos use quality 100
    // Uploaded photos are rendered as they are (see components/shared/Photo.tsx), so no remote image hosts are needed.
  },
  async redirects() {
    // A signed-out visitor who opens an admin page in a browser gets a real 307 to the sign-in page, not a 200 that
    // redirects later. (The pages and actions still check the account themselves: this only saves a round trip.)
    const signedOut = {
      has: [{ type: "header" as const, key: "accept", value: ".*text/html.*" }],
      missing: [{ type: "cookie" as const, key: "admin_session" }],
      destination: "/admin/login",
      permanent: false,
    };
    return [
      { source: "/admin", ...signedOut },
      { source: "/admin/:path((?!login|api).*)", ...signedOut },
    ];
  },
  async headers() {
    const common = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" }, // nobody may frame the site or the admin portal (clickjacking)
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: common },
      // admin pages and private booking links hold patient details: never cache them in a browser or shared cache
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/book/(edit|cancel|reschedule)/:token", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
