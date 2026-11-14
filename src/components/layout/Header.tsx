"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, Phone } from "lucide-react";
import { HOSPITAL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/shared/NotificationBell";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/doctors", label: "Doctors" },
  { href: "/treatments", label: "Treatments" },
  { href: "/my-appointments", label: "My Appointments" },
];

const bookBtn =
  "whitespace-nowrap rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17604E] transition-colors";
const treatBtn =
  "flex items-center whitespace-nowrap rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors";
const callBtn =
  "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold text-ink hover:bg-sand/60 transition-colors";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        scrolled ? "bg-background/95 border-border backdrop-blur-md" : "bg-background border-transparent"
      )}
    >
      <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Home">
          <Image
            src="/logo-graphic.png"
            alt="Dr. Lakshmi Logo"
            width={256}
            height={256}
            quality={100}
            className="h-14 w-14 object-contain shrink-0"
            priority
          />
          <Image
            src="/logo-text.png"
            alt="Dr. Lakshmi Skin & Hair Clinic"
            width={180}
            height={56}
            quality={100}
            className="h-11 w-auto object-contain select-none"
            priority
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-5 xl:gap-8" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-[15px] font-semibold text-ink hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <NotificationBell endpoint="/api/notifications" href="/my-appointments" label="Your notifications" />
          <a href={`tel:${HOSPITAL.phone}`} className={callBtn} aria-label="Call hospital">
            <Phone className="h-4 w-4" />
            <span className="hidden xl:inline">Call now</span>
          </a>
          <Link href="/book/treatment" className={treatBtn}>
            Book treatment
          </Link>
          <Link href="/book" className={bookBtn}>
            Book appointment
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
        <NotificationBell endpoint="/api/notifications" href="/my-appointments" label="Your notifications" />
        <button
          type="button"
          className="lg:hidden flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sand/60"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 top-20 z-40 bg-background border-t border-border">
          <nav className="flex flex-col gap-1 p-6" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-4 py-3 text-lg font-semibold text-ink hover:bg-sand/60"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
              <Link href="/book" className={cn(bookBtn, "py-3 text-center")} onClick={() => setIsOpen(false)}>
                Book appointment
              </Link>
              <Link href="/book/treatment" className={cn(treatBtn, "justify-center py-3 text-center")} onClick={() => setIsOpen(false)}>
                Book treatment
              </Link>
              <a
                href={`tel:${HOSPITAL.phone}`}
                className={cn(callBtn, "justify-center border border-border py-3")}
                onClick={() => setIsOpen(false)}
              >
                <Phone className="h-4 w-4" />
                Call now
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
