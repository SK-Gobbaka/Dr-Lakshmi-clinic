import Image from "next/image";
import Link from "next/link";
import { listDoctors } from "@/lib/local-store";

export function DoctorsPreview() {
  // A few team members besides the featured senior consultant; managed in the admin portal
  const previewList = listDoctors({ publishedOnly: true }).filter((d) => !d.isSenior).slice(0, 3);
  if (previewList.length === 0) return null;

  return (
    <section className="section bg-sand/50">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="section-title">Our doctors</h2>
          <Link
            href="/doctors"
            className="font-semibold text-primary underline underline-offset-4 hover:text-[#17604E]"
          >
            Meet all doctors
          </Link>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {previewList.map((doctor) => (
            <article key={doctor.id} className="flex gap-4">
              <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-xl bg-background">
                <Image src={doctor.image} alt={doctor.name} fill className="object-cover" sizes="112px" />
              </div>
              <div className="self-center">
                <h3 className="font-heading text-xl font-semibold text-ink">{doctor.name}</h3>
                <p className="mt-1 text-text-secondary">{doctor.designation}</p>
                <p className="mt-1 text-sm font-semibold text-primary">{doctor.qualification}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
