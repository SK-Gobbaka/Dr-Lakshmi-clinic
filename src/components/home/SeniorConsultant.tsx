"use client";

import { useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Photo } from "@/components/shared/Photo";
interface SeniorDoctor {
  name: string;
  image: string;
  qualification: string;
  regNo: string;
  specialization: string[];
  message: string;
}

export function SeniorConsultant({ doctor }: { doctor: SeniorDoctor }) {
  const ref = useRef(null);
  // Trigger animation when the card is 30% visible in the viewport
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const isOpen = isInView;

  const doctorCartoonSvg = (
    <svg className="h-20 w-20 text-teal-600/70" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="32" r="14" />
      <path d="M30 80c0-12 10-18 20-18s20 6 20 18v4H30v-4z" />
      <path d="M42 66v12M58 66v12M38 72h24" strokeWidth="1.5" />
      <path d="M46 32h8M50 28v8" strokeWidth="1.5" />
    </svg>
  );

  return (
    <section className="section" ref={ref}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 flex flex-col items-start">
        <h2 className="section-title mb-10">Senior Consultant</h2>

        {/* Animation Container */}
        <motion.div 
          layout
          transition={{ type: "spring", stiffness: 70, damping: 20 }}
          className={isOpen 
            ? "mx-auto bg-white border border-border rounded-2xl p-6 sm:p-10  flex flex-col md:flex-row items-center gap-8 relative overflow-hidden w-full max-w-[900px]"
            : "mx-auto bg-white border border-border rounded-2xl p-6  flex flex-col md:flex-row items-center justify-center gap-0 relative overflow-hidden w-fit max-w-[240px] sm:max-w-[304px]"
          }
        >
          {/* Circular Photo */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 70, damping: 20 }}
            className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-[4px] border-[#1F7A63] shadow-lg shadow-cyan-500/20 shrink-0 select-none"
          >
            <Photo src={doctor.image} alt={doctor.name} fallbackName={doctor.name} fill className="object-cover" sizes="(max-width: 768px) 192px, 224px" priority />
          </motion.div>

          {/* Details Content (Appears sideways) */}
          <AnimatePresence mode="popLayout">
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, x: 60, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: 60, width: 0 }}
                transition={{ type: "spring", stiffness: 70, damping: 20 }}
                className="flex-1 space-y-4 text-left overflow-hidden min-w-0 md:min-w-[400px]"
              >
                <div>
                  <p className="text-sm font-bold text-[#1F7A63]">
                    Our Senior Consultant
                  </p>
                  <h3 className="font-heading text-2xl font-bold text-[#17222B] mt-1">
                    {doctor.name}
                  </h3>
                  <p className="text-sm text-text-secondary font-semibold mt-0.5 whitespace-pre-line">
                    {doctor.qualification} <br /> {doctor.regNo && <>Reg. No. {doctor.regNo}</>}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {doctor.specialization.map((spec) => (
                    <span
                      key={spec}
                      className="text-sm font-bold bg-[#1F7A63]/10 text-[#1F7A63] px-2.5 py-1 rounded-full"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Quote block */}
                {doctor.message && <blockquote className="text-sm text-[#17222B] font-bold leading-relaxed italic border-l-2 border-teal-500 pl-3 py-1">
                  &ldquo;{doctor.message}&rdquo;
                </blockquote>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cartoon right */}
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.8, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="hidden lg:block absolute right-6 bottom-6 select-none"
            >
              {doctorCartoonSvg}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
