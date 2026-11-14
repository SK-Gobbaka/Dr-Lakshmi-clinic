import Image from "next/image";
import { galleryItems } from "@/lib/data/gallery";

export function Gallery() {
  return (
    <section className="section" id="gallery">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 className="section-title">Inside the clinic</h2>

        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {galleryItems.map((item) => (
            <figure key={item.id} className="relative aspect-square overflow-hidden rounded-xl bg-sand">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 pt-8 text-sm font-semibold text-white">
                {item.title}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
