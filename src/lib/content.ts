import { sql } from "./db";
import { getConfig } from "./clinic/unit";
import { shortId, type SiteSettings } from "./clinic/types";
import { log } from "./logger";
import { EMPTY_SITE } from "./site-info";

/**
 * Website content the clinic edits from the admin portal: contact details, gallery, testimonials, FAQs.
 * Nothing here ships with invented content: until the clinic adds some, the public site shows no gallery,
 * no testimonials and no statistics.
 */

const audit = (actor: string, action: string, summary: string, entityId?: string) =>
  sql()`insert into audit_log (actor, action, entity_id, summary) values (${actor}, ${action}, ${entityId ?? null}, ${summary})`;

type Out<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// ---------- contact details and switches ----------

export async function getSiteSettings(): Promise<SiteSettings> {
  return (await getConfig()).site;
}

/** For public pages: the saved details, or empty ones when the database cannot be reached, so the page still renders. */
export async function getPublicSite(): Promise<SiteSettings> {
  try {
    return await getSiteSettings();
  } catch (err) {
    log.error("site.settings_unavailable", err);
    return EMPTY_SITE;
  }
}

export async function saveSiteSettings(s: SiteSettings, by: string): Promise<Out> {
  await sql()`update site_settings set
      phone = ${s.phone}, phone_display = ${s.phoneDisplay}, whatsapp_number = ${s.whatsappNumber}, email = ${s.email},
      address_line1 = ${s.addressLine1}, address_line2 = ${s.addressLine2}, pincode = ${s.pincode},
      working_hours = ${s.workingHours}, closed_day = ${s.closedDay},
      facebook_url = ${s.facebookUrl}, instagram_url = ${s.instagramUrl}, x_url = ${s.xUrl}, youtube_url = ${s.youtubeUrl},
      google_maps_url = ${s.googleMapsUrl}, google_review_url = ${s.googleReviewUrl},
      google_rating = ${s.googleRating}, google_review_count = ${s.googleReviewCount},
      trust_stats = ${JSON.stringify(s.trustStats)}::text::jsonb
    where id = 1`;
  await audit(by, "site.settings", "Updated the clinic contact details and site settings");
  return { ok: true, data: undefined };
}

// ---------- gallery ----------

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  image: string;
  sortOrder: number;
  published: boolean;
}

export async function listGallery(opts: { publishedOnly?: boolean } = {}): Promise<GalleryItem[]> {
  const q = sql();
  return (await q`select id, title, category, image, sort_order, published from gallery_items ${opts.publishedOnly ? q`where published` : q``} order by sort_order, title`) as unknown as GalleryItem[];
}

export async function saveGalleryItem(input: { id?: string; title: string; category: string; image?: string; published: boolean }, by: string): Promise<Out<GalleryItem>> {
  const q = sql();
  const title = input.title.trim();
  if (title.length < 2 || title.length > 80) return { ok: false, error: "The title must be 2 to 80 characters." };
  const category = input.category.trim().slice(0, 40);
  if (input.id) {
    const [row] = await q`update gallery_items set title = ${title}, category = ${category}, image = ${input.image ?? q`image`}, published = ${input.published} where id = ${input.id}
                          returning id, title, category, image, sort_order, published`;
    if (!row) return { ok: false, error: "Photo not found." };
    await audit(by, "gallery.update", `Updated gallery photo "${title}"`, input.id);
    return { ok: true, data: row as unknown as GalleryItem };
  }
  if (!input.image) return { ok: false, error: "Choose a photo to upload." };
  const id = shortId("gallery");
  const [row] = await q`insert into gallery_items (id, title, category, image, sort_order, published)
                        values (${id}, ${title}, ${category}, ${input.image}, (select coalesce(max(sort_order), -1) + 1 from gallery_items), ${input.published})
                        returning id, title, category, image, sort_order, published`;
  await audit(by, "gallery.create", `Added gallery photo "${title}"`, id);
  return { ok: true, data: row as unknown as GalleryItem };
}

/** Returns the removed photo's address so the caller can delete the stored file. */
export async function deleteGalleryItem(id: string, by: string): Promise<Out<string>> {
  const [row] = await sql()`delete from gallery_items where id = ${id} returning title, image`;
  if (!row) return { ok: false, error: "Photo not found." };
  await audit(by, "gallery.delete", `Deleted gallery photo "${row.title}"`, id);
  return { ok: true, data: row.image };
}

// ---------- testimonials ----------

export interface Testimonial {
  id: string;
  name: string;
  treatment: string;
  quote: string;
  rating: number | null;
  consentConfirmed: boolean;
  published: boolean;
  sortOrder: number;
}

export async function listTestimonials(opts: { publishedOnly?: boolean } = {}): Promise<Testimonial[]> {
  const q = sql();
  return (await q`select id, name, treatment, quote, rating, consent_confirmed, published, sort_order from testimonials ${opts.publishedOnly ? q`where published` : q``} order by sort_order, name`) as unknown as Testimonial[];
}

export async function saveTestimonial(input: { id?: string; name: string; treatment: string; quote: string; rating: number | null; consentConfirmed: boolean; published: boolean }, by: string): Promise<Out> {
  const name = input.name.trim();
  const quote = input.quote.trim();
  if (name.length < 2 || name.length > 60) return { ok: false, error: "The patient name must be 2 to 60 characters." };
  if (quote.length < 10 || quote.length > 600) return { ok: false, error: "The testimonial must be 10 to 600 characters." };
  if (input.published && !input.consentConfirmed) return { ok: false, error: "Publish a testimonial only after the patient has given written consent. Tick the consent box first." };
  const q = sql();
  const id = input.id ?? shortId("testimonial");
  await q`insert into testimonials (id, name, treatment, quote, rating, consent_confirmed, published, sort_order)
          values (${id}, ${name}, ${input.treatment.trim().slice(0, 60)}, ${quote}, ${input.rating}, ${input.consentConfirmed}, ${input.published}, (select coalesce(max(sort_order), -1) + 1 from testimonials))
          on conflict (id) do update set name = excluded.name, treatment = excluded.treatment, quote = excluded.quote, rating = excluded.rating,
            consent_confirmed = excluded.consent_confirmed, published = excluded.published`;
  await audit(by, input.id ? "testimonial.update" : "testimonial.create", `${input.id ? "Updated" : "Added"} testimonial from "${name}"${input.published ? " (published)" : ""}`, id);
  return { ok: true, data: undefined };
}

export async function deleteTestimonial(id: string, by: string): Promise<Out> {
  const [row] = await sql()`delete from testimonials where id = ${id} returning name`;
  if (!row) return { ok: false, error: "Testimonial not found." };
  await audit(by, "testimonial.delete", `Deleted testimonial from "${row.name}"`, id);
  return { ok: true, data: undefined };
}

// ---------- FAQs ----------

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  published: boolean;
}

export async function listFaqs(opts: { publishedOnly?: boolean } = {}): Promise<Faq[]> {
  const q = sql();
  return (await q`select id, question, answer, sort_order, published from faqs ${opts.publishedOnly ? q`where published` : q``} order by sort_order, question`) as unknown as Faq[];
}

export async function saveFaq(input: { id?: string; question: string; answer: string; published: boolean }, by: string): Promise<Out> {
  const question = input.question.trim();
  const answer = input.answer.trim();
  if (question.length < 5 || question.length > 160) return { ok: false, error: "The question must be 5 to 160 characters." };
  if (answer.length < 5 || answer.length > 1000) return { ok: false, error: "The answer must be 5 to 1000 characters." };
  const q = sql();
  const id = input.id ?? shortId("faq");
  await q`insert into faqs (id, question, answer, sort_order, published)
          values (${id}, ${question}, ${answer}, (select coalesce(max(sort_order), -1) + 1 from faqs), ${input.published})
          on conflict (id) do update set question = excluded.question, answer = excluded.answer, published = excluded.published`;
  await audit(by, input.id ? "faq.update" : "faq.create", `${input.id ? "Updated" : "Added"} FAQ "${question.slice(0, 60)}"`, id);
  return { ok: true, data: undefined };
}

export async function deleteFaq(id: string, by: string): Promise<Out> {
  const [row] = await sql()`delete from faqs where id = ${id} returning question`;
  if (!row) return { ok: false, error: "FAQ not found." };
  await audit(by, "faq.delete", `Deleted FAQ "${row.question.slice(0, 60)}"`, id);
  return { ok: true, data: undefined };
}
