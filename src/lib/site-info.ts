import type { SiteSettings } from "./clinic/types";

/** Brand text that does not change from the admin portal. Contact details live in SiteSettings. */
export const BRAND = {
  name: "Dr. Lakshmi Skin & Hair Clinic",
  tagline: "Healthy Hair. Healthy Skin. Confident You.",
  shortDescription: "Take the first step toward healthier hair and radiant skin. Our specialists are ready to build a personalized plan, just for you.",
} as const;

/** What a fresh visitor sees before the clinic has filled in Admin > Site settings. */
export const EMPTY_SITE: SiteSettings = {
  phone: "",
  phoneDisplay: "",
  whatsappNumber: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  pincode: "",
  workingHours: "",
  closedDay: "",
  facebookUrl: "",
  instagramUrl: "",
  xUrl: "",
  youtubeUrl: "",
  googleMapsUrl: "",
  googleReviewUrl: "",
  googleRating: null,
  googleReviewCount: null,
  trustStats: [],
};

export const fullAddress = (s: SiteSettings) => [s.addressLine1, s.addressLine2, s.pincode].filter(Boolean).join(", ");

const lat = process.env.NEXT_PUBLIC_CLINIC_LAT;
const lng = process.env.NEXT_PUBLIC_CLINIC_LNG;
const hasCoords = !!(lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)));
const mapQuery = (s: SiteSettings) => encodeURIComponent(hasCoords ? `${lat},${lng}` : `${BRAND.name}, ${fullAddress(s)}`);

/** A map is only drawn once the clinic has entered its address (or exact coordinates are set): never a guess. */
export const canEmbedMap = (s: SiteSettings) => hasCoords || fullAddress(s).length > 0;
export const hasMapLink = (s: SiteSettings) => canEmbedMap(s) || /^https?:\/\//.test(s.googleMapsUrl);

export const mapsUrl = (s: SiteSettings) => s.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${mapQuery(s)}`;
export const directionsUrl = (s: SiteSettings) => `https://www.google.com/maps/dir/?api=1&destination=${mapQuery(s)}`;
export const mapsEmbedUrl = (s: SiteSettings) => `https://maps.google.com/maps?q=${mapQuery(s)}&z=16&output=embed`;
export const reviewUrl = (s: SiteSettings) => s.googleReviewUrl || mapsUrl(s);

const digits = (v: string) => v.replace(/\D/g, "");
/** `tel:` link, or null until the clinic has entered a phone number (so no dead Call button is shown). */
export const telHref = (s: SiteSettings) => (digits(s.phone).length >= 8 ? `tel:+${digits(s.phone)}` : null);
export const whatsappHref = (s: SiteSettings) => (digits(s.whatsappNumber).length >= 8 ? `https://wa.me/${digits(s.whatsappNumber)}` : null);
export const displayPhone = (s: SiteSettings) => s.phoneDisplay || s.phone;

/** Keeps digits and a leading "+". Used when saving phone numbers from the admin portal. */
export const normalizePhoneInput = (v: string) => {
  const t = v.trim();
  const d = digits(t);
  return t.startsWith("+") ? `+${d}` : d.length === 10 ? `+91${d}` : d ? `+${d}` : "";
};

export const socialLinks = (s: SiteSettings) =>
  [
    { key: "instagram", label: "Instagram", href: s.instagramUrl },
    { key: "facebook", label: "Facebook", href: s.facebookUrl },
    { key: "x", label: "X (Twitter)", href: s.xUrl },
    { key: "youtube", label: "YouTube", href: s.youtubeUrl },
  ].filter((x) => /^https?:\/\//.test(x.href));
