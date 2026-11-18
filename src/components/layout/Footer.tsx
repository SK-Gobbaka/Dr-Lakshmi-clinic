import Link from "next/link";
import Image from "next/image";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { HOSPITAL } from "@/lib/constants";
import { ClinicMap } from "./ClinicMap";

// Custom Whatsapp icon
function WhatsappIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

// Custom Facebook icon
function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

// Custom Instagram icon
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#17222B] text-white pt-16 pb-8">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand details */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 group w-fit" aria-label="Home">
              <Image
                src="/logo-graphic.png"
                alt="Dr. Lakshmi Logo"
                width={56}
                height={56}
                className="h-[4.5rem] w-[4.5rem] object-contain shrink-0 brightness-0 invert"
              />
              <Image
                src="/logo-text.png"
                alt="Dr. Lakshmi Skin & Hair Clinic"
                width={180}
                height={56}
                className="h-14 w-auto object-contain select-none brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-white/70 leading-relaxed font-medium">
              Take the first step toward healthier hair and radiant skin. Our specialists are ready to build a personalized plan— just for you.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="lg:pl-8">
            <h3 className="font-heading font-bold text-sm mb-6 text-white">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/doctors" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
                  Doctors
                </Link>
              </li>
              <li>
                <Link href="/treatments" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
                  Treatments
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact Details */}
          <div>
            <h3 className="font-heading font-bold text-sm mb-6 text-white">Contact Us</h3>
            <ul className="space-y-4 text-sm text-white/70 font-medium">
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-white" />
                <a href={`tel:${HOSPITAL.phone}`} className="hover:text-white transition-colors">
                  {HOSPITAL.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-white" />
                <a href={`mailto:${HOSPITAL.email}`} className="hover:text-white transition-colors">
                  {HOSPITAL.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-white" />
                <span className="leading-relaxed">{HOSPITAL.address.full}</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-white" />
                <div className="leading-relaxed">
                  <p>Mon–Sat: 9 am – 12 pm & 5pm - 10 pm</p>
                  <p>Sun: Holiday</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 4: Follow Us & Map */}
          <div>
            <h3 className="font-heading font-bold text-sm mb-6 text-white">Follow Us</h3>
            <div className="space-y-5">
              <div className="flex gap-4">
                <a
                  href={HOSPITAL.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white hover:border-white transition-colors"
                  aria-label="Instagram"
                >
                  <InstagramIcon className="h-4 w-4" />
                </a>
                <a
                  href={HOSPITAL.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white hover:border-white transition-colors"
                  aria-label="Facebook"
                >
                  <FacebookIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://wa.me/910000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white hover:border-white transition-colors"
                  aria-label="Whatsapp"
                >
                  <WhatsappIcon className="h-4 w-4" />
                </a>
              </div>

              <ClinicMap />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-bold text-white/50">
          <p>© 2026 Dr.Lakshmi Skin & Hair Clinic. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
