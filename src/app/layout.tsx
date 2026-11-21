import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileActionBar } from "@/components/layout/MobileActionBar";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { getPublicSite } from "@/lib/content";
import { BRAND } from "@/lib/site-info";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const source = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});

export const dynamic = "force-dynamic"; // the header and footer show contact details saved in the admin portal

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: `${BRAND.name} | Hair & Skin Clinic`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.shortDescription,
  authors: [{ name: BRAND.name }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: BRAND.name,
    title: `${BRAND.name} | Hair & Skin Clinic`,
    description: BRAND.shortDescription,
  },
  twitter: {
    card: "summary",
    title: BRAND.name,
    description: BRAND.shortDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Contact details come from Admin > Contact & site details. If the database is down the pages still render.
  const site = await getPublicSite();
  return (
    <html lang="en" className={`${fraunces.variable} ${source.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SiteChrome>
          <Header site={site} />
        </SiteChrome>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteChrome>
          <Footer site={site} />
          <MobileActionBar site={site} />
          <div className="h-[4.5rem] lg:hidden" aria-hidden />
        </SiteChrome>
      </body>
    </html>
  );
}
