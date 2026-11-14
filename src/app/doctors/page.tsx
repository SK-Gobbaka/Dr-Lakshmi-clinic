import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSeniorDoctor, listDoctors } from "@/lib/local-store";
import { SeniorConsultant } from "@/components/home/SeniorConsultant";

export const metadata: Metadata = {
  title: "Our Doctors",
  description:
    "Meet our team of experienced dermatologists and hair specialists at Lakshmi Hair & Skin Hospital.",
};

export const dynamic = "force-dynamic"; // doctors are edited in the admin portal

export default function DoctorsPage() {
  const doctors = listDoctors({ publishedOnly: true });
  const senior = getSeniorDoctor();
  const teamCartoonSvg = (
    <svg className="h-10 w-20 text-[#1F7A63] inline-block align-middle mb-2 ml-1" viewBox="0 0 120 60" fill="none" stroke="currentColor" strokeWidth="1.8">
      {/* Left person */}
      <circle cx="35" cy="20" r="7"/>
      <path d="M22 45c0-7 5-10 13-10s13 3 13 10v3H22v-3z"/>
      {/* Center person */}
      <circle cx="60" cy="17" r="7"/>
      <path d="M47 45c0-7 5-10 13-10s13 3 13 10v3H47v-3z"/>
      {/* Right person */}
      <circle cx="85" cy="20" r="7"/>
      <path d="M72 45c0-7 5-10 13-10s13 3 13 10v3H72v-3z"/>
    </svg>
  );

  return (
    <div className="bg-transparent min-h-screen pb-0">
      {/* Animating Senior Consultant Section */}
      {senior && <SeniorConsultant doctor={senior} />}

      {/* Our Team Section */}
      <section className="py-16 bg-white border-t border-gray-50">
        <div className="mx-auto max-w-[1200px] px-4">
          {/* Header */}
          <div className="text-center mb-16 select-none">
            <div className="inline-block border-b-2 border-[#1F7A63] pb-2">
              <span className="font-heading text-xl font-bold text-[#1F7A63] uppercase tracking-widest leading-none">
                Our Team
              </span>
              {teamCartoonSvg}
            </div>
          </div>

          {/* 12 Doctor grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-[1000px] mx-auto">
            {doctors.map((doctor) => {
              // Exclude senior consultant from the team list or keep all? The mockup shows 12 cards in team section.
              // Let's render all 12 doctors in the grid.
              return (
                <div
                  key={doctor.id}
                  className="flex items-center gap-2.5 sm:gap-4 bg-white rounded-2xl p-2 select-none"
                >
                  {/* Doctor picture left */}
                  <div className="relative w-24 h-28 rounded-2xl overflow-hidden shrink-0 border border-gray-100 shadow-sm">
                    <Image
                      src={doctor.image}
                      alt={doctor.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </div>

                  {/* Peach text tag right */}
                  <div className="flex-1 bg-[#FFD8BE]/80 rounded-2xl px-3 py-5 sm:px-4 sm:py-6 text-left h-28 flex flex-col justify-center">
                    <h3 className="font-heading text-xs font-bold text-[#17222B] uppercase tracking-wide line-clamp-1">
                      {doctor.name}
                    </h3>
                    <p className="text-[10px] text-text-secondary font-bold mt-1 tracking-wide line-clamp-2">
                      {doctor.designation} <br />
                      <span className="text-[#1F7A63] font-bold text-[9px] uppercase tracking-wider">{doctor.qualification}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Blue CTA Banner */}
      <section className="bg-gradient-to-r from-[#1F7A63] to-[#17222B] text-white py-16 text-center select-none">
        <div className="mx-auto max-w-2xl px-4 space-y-6">
          <p className="text-[10px] font-bold tracking-widest uppercase text-teal-300">
            Start Your Journey
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold leading-tight">
            Ready to Start your <br className="sm:hidden" /> Hair & Skin Journey?
          </h2>
          <p className="text-xs text-white/80 max-w-lg mx-auto leading-relaxed">
            Take the first step toward healthier hair and radiant skin. Our specialists are ready to build a personalized plan— just for you.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/book"
              className="rounded-full bg-white px-8 py-3 text-xs font-bold text-[#17222B] hover:bg-teal-50 transition-all uppercase tracking-wider"
            >
              Book Appointment
            </Link>
            <a
              href="tel:+910000000000"
              className="rounded-full border border-white px-8 py-3 text-xs font-bold text-white hover:bg-white/10 transition-all uppercase tracking-wider"
            >
              Call Now
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
