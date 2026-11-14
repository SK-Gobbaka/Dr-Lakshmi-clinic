"use client";

import { Accordion } from "@/components/ui/accordion";
import { faqs } from "@/lib/data/faq";

export function FAQSection() {
  return (
    <section className="section bg-sand/50" id="faq">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <h2 className="section-title lg:col-span-4">Common questions</h2>
        <div className="lg:col-span-8 max-w-2xl">
          <Accordion items={faqs} />
        </div>
      </div>
    </section>
  );
}
