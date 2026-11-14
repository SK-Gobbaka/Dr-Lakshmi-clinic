import Link from "next/link";

export function AboutSection() {
  return (
    <section className="section" id="about">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <h2 className="section-title lg:col-span-5">Medical treatment for hair and skin, explained plainly</h2>
        <div className="lg:col-span-6 lg:col-start-7 space-y-5 text-lg text-text-secondary">
          <p>
            At Dr. Lakshmi Skin &amp; Hair Clinic, we provide dermatology and trichology care. Our mission is to restore your hair and skin health using evidence-based medical treatments.
          </p>
          <Link
            href="/doctors"
            className="inline-block font-semibold text-primary underline underline-offset-4 hover:text-[#17604E]"
          >
            Meet the doctors
          </Link>
        </div>
      </div>
    </section>
  );
}
