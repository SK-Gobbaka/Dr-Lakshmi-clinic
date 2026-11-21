import Link from "next/link";
import Image from "next/image";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import type { SiteSettings } from "@/lib/clinic/types";
import { BRAND, displayPhone, fullAddress, hasMapLink, socialLinks, telHref, whatsappHref } from "@/lib/site-info";
import { ClinicMap } from "./ClinicMap";

const stroke = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function WhatsappIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M22.5 7.2a2.5 2.5 0 0 0-1.8-1.8C19.1 5 12 5 12 5s-7.1 0-8.7.4A2.5 2.5 0 0 0 1.5 7.2C1 8.8 1 12 1 12s0 3.2.5 4.8a2.5 2.5 0 0 0 1.8 1.8C4.9 19 12 19 12 19s7.1 0 8.7-.4a2.5 2.5 0 0 0 1.8-1.8c.5-1.6.5-4.8.5-4.8s0-3.2-.5-4.8z" />
      <path d="M10 15l5-3-5-3z" />
    </svg>
  );
}

const ICONS = { instagram: InstagramIcon, facebook: FacebookIcon, x: XIcon, youtube: YoutubeIcon } as const;
const roundLink = "flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white hover:border-white transition-colors";
const quick = "text-sm text-white/70 hover:text-white font-medium transition-colors";

/** Contact details, hours and social links come from Admin > Contact & site details; anything left empty is not shown. */
export function Footer({ site }: { site: SiteSettings }) {
  const tel = telHref(site);
  const wa = whatsappHref(site);
  const social = socialLinks(site);
  const address = fullAddress(site);
  const hours = [site.workingHours, site.closedDay].filter(Boolean);
  const hasContact = !!(tel || site.email || address || hours.length);

  return (
    <footer className="bg-[#17222B] text-white pt-16 pb-8">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 group w-fit" aria-label="Dr. Lakshmi Skin & Hair Clinic, home">
              <Image src="/logo-graphic.png" alt="" width={56} height={56} className="h-[4.5rem] w-[4.5rem] object-contain shrink-0 brightness-0 invert" />
              <Image src="/logo-text.png" alt="Dr. Lakshmi Skin & Hair Clinic" width={180} height={56} className="h-14 w-auto object-contain select-none brightness-0 invert" />
            </Link>
            <p className="text-sm text-white/70 leading-relaxed font-medium">{BRAND.shortDescription}</p>
          </div>

          <div className="lg:pl-8">
            <h3 className="font-heading font-bold text-sm mb-6 text-white">Quick Links</h3>
            <ul className="space-y-3">
              {[
                ["/", "Home"],
                ["/doctors", "Doctors"],
                ["/treatments", "Treatments"],
                ["/book", "Book appointment"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className={quick}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-bold text-sm mb-6 text-white">Contact Us</h3>
            {hasContact ? (
              <ul className="space-y-4 text-sm text-white/70 font-medium">
                {tel && (
                  <li className="flex items-center gap-3">
                    <Phone className="h-4 w-4 shrink-0 text-white" aria-hidden />
                    <a href={tel} className="hover:text-white transition-colors">
                      {displayPhone(site)}
                    </a>
                  </li>
                )}
                {site.email && (
                  <li className="flex items-center gap-3">
                    <Mail className="h-4 w-4 shrink-0 text-white" aria-hidden />
                    <a href={`mailto:${site.email}`} className="hover:text-white transition-colors">
                      {site.email}
                    </a>
                  </li>
                )}
                {address && (
                  <li className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-white" aria-hidden />
                    <span className="leading-relaxed">{address}</span>
                  </li>
                )}
                {hours.length > 0 && (
                  <li className="flex items-start gap-3">
                    <Clock className="h-4 w-4 mt-0.5 shrink-0 text-white" aria-hidden />
                    <div className="leading-relaxed">
                      {hours.map((h) => (
                        <p key={h}>{h}</p>
                      ))}
                    </div>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-white/70 font-medium">Use the booking form to reach the clinic.</p>
            )}
          </div>

          <div>
            {(social.length > 0 || wa || hasMapLink(site)) && <h3 className="font-heading font-bold text-sm mb-6 text-white">{social.length > 0 || wa ? "Follow Us" : "Find Us"}</h3>}
            <div className="space-y-5">
              {(social.length > 0 || wa) && (
                <div className="flex gap-4">
                  {social.map((s) => {
                    const Icon = ICONS[s.key as keyof typeof ICONS];
                    return (
                      <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" className={roundLink} aria-label={s.label}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </a>
                    );
                  })}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className={roundLink} aria-label="WhatsApp">
                      <WhatsappIcon className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                </div>
              )}
              <ClinicMap site={site} />
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-bold text-white/50">
          <p>© {new Date().getFullYear()} Dr. Lakshmi Skin &amp; Hair Clinic. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
