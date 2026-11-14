import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileActionBar } from "@/components/layout/MobileActionBar";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { HOSPITAL } from "@/lib/constants";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${HOSPITAL.name} | Premium Hair & Skin Care`,
    template: `%s | ${HOSPITAL.name}`,
  },
  description: HOSPITAL.shortDescription,
  keywords: [
    "hair transplant",
    "skin treatment",
    "dermatology",
    "hair loss",
    "acne treatment",
    "Hyderabad",
    "PRP therapy",
    "laser treatment",
  ],
  authors: [{ name: HOSPITAL.name }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: HOSPITAL.name,
    title: `${HOSPITAL.name} | Premium Hair & Skin Care`,
    description: HOSPITAL.shortDescription,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: HOSPITAL.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOSPITAL.name,
    description: HOSPITAL.shortDescription,
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${source.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SiteChrome>
          <Header />
        </SiteChrome>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteChrome>
          <Footer />
          <MobileActionBar />
          <div className="h-[4.5rem] lg:hidden" aria-hidden />
        </SiteChrome>
      </body>
    </html>
  );
}
