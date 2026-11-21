import { Accordion } from "@/components/ui/accordion";
import { listFaqs } from "@/lib/content";
import { log } from "@/lib/logger";

/** Questions saved under Admin > FAQs. The section is left out when there are none. */
export async function FAQSection() {
  const faqs = await listFaqs({ publishedOnly: true }).catch((err) => {
    log.error("home.faqs_unavailable", err);
    return [];
  });
  if (faqs.length === 0) return null;
  return (
    <section className="section bg-sand/50" id="faq">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <h2 className="section-title lg:col-span-4">Common questions</h2>
        <div className="lg:col-span-8 max-w-2xl">
          <Accordion items={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))} />
        </div>
      </div>
    </section>
  );
}
