import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic"; // the address comes from the request when NEXT_PUBLIC_SITE_URL is not set

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // private booking links and the admin portal stay out of search results
      disallow: ["/api/", "/admin", "/book/edit/", "/book/cancel/", "/book/reschedule/"],
    },
    sitemap: `${await siteUrl()}/sitemap.xml`,
  };
}
