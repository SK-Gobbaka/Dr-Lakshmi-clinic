export type TreatmentCategory = "hair" | "skin" | "laser";

export interface Treatment {
  id: string;
  name: string;
  slug: string;
  category: TreatmentCategory;
  shortDescription: string;
  description: string;
  image: string;
  duration?: string;
  benefits?: string[];
}

export const treatmentCategories: { id: TreatmentCategory; label: string }[] = [
  { id: "hair", label: "Hair Treatments" },
  { id: "skin", label: "Skin Treatments" },
  { id: "laser", label: "Laser Treatments" },
];

export const treatments: Treatment[] = [
  {
    id: "hair-loss",
    name: "Hair Loss Treatment",
    slug: "hair-loss",
    category: "hair",
    shortDescription: "Comprehensive diagnosis and treatment for all types of hair loss including androgenetic alopecia.",
    description:
      "Our hair loss treatment program begins with a thorough scalp analysis and blood work to identify the root cause. We offer medical management, mesotherapy, and advanced regenerative therapies tailored to your condition.",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=400&fit=crop",
    duration: "3-6 months",
    benefits: ["Stops hair fall", "Promotes regrowth", "Strengthens follicles"],
  },
  {
    id: "hair-transplant",
    name: "Hair Transplant",
    slug: "hair-transplant",
    category: "hair",
    shortDescription: "Advanced FUE and FUT hair transplant procedures for natural, permanent results.",
    description:
      "Using the latest FUE (Follicular Unit Extraction) technique, our surgeons transplant healthy hair follicles to thinning areas with precision. Minimal scarring, natural hairline design, and lifetime results.",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&h=400&fit=crop",
    duration: "1 day procedure",
    benefits: ["Permanent results", "Natural appearance", "Minimal downtime"],
  },
  {
    id: "prp-therapy",
    name: "PRP Therapy",
    slug: "prp-therapy",
    category: "hair",
    shortDescription: "Platelet-Rich Plasma therapy to stimulate hair growth using your body's natural healing factors.",
    description:
      "PRP therapy uses concentrated platelets from your own blood to rejuvenate hair follicles. A safe, non-surgical treatment with proven results for hair thinning and early-stage hair loss.",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d558a1a?w=600&h=400&fit=crop",
    duration: "45 mins per session",
    benefits: ["Non-surgical", "Natural growth", "No side effects"],
  },
  {
    id: "acne",
    name: "Acne Treatment",
    slug: "acne",
    category: "skin",
    shortDescription: "Effective solutions for active acne, acne scars, and prevention of future breakouts.",
    description:
      "From mild to severe acne, we offer customized treatment plans including topical medications, oral therapy, chemical peels, and laser treatments to clear your skin and prevent scarring.",
    image: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&h=400&fit=crop",
    duration: "2-4 months",
    benefits: ["Clearer skin", "Reduced scarring", "Long-term prevention"],
  },
  {
    id: "pigmentation",
    name: "Pigmentation Treatment",
    slug: "pigmentation",
    category: "skin",
    shortDescription: "Advanced treatments for melasma, dark spots, and uneven skin tone.",
    description:
      "Our pigmentation specialists use a combination of topical agents, chemical peels, Q-switched lasers, and oral medications to effectively treat melasma, post-inflammatory hyperpigmentation, and sun damage.",
    image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&h=400&fit=crop",
    duration: "3-6 months",
    benefits: ["Even skin tone", "Brighter complexion", "Lasting results"],
  },
  {
    id: "laser-treatment",
    name: "Laser Treatment",
    slug: "laser-treatment",
    category: "laser",
    shortDescription: "State-of-the-art laser therapies for hair removal, skin rejuvenation, and scar treatment.",
    description:
      "Our advanced laser suite offers treatments for permanent hair reduction, skin resurfacing, tattoo removal, and vascular lesions. Safe for all skin types with minimal downtime.",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=400&fit=crop",
    duration: "30-60 mins",
    benefits: ["Precision treatment", "Minimal pain", "Quick recovery"],
  },
  {
    id: "skin-rejuvenation",
    name: "Skin Rejuvenation",
    slug: "skin-rejuvenation",
    category: "skin",
    shortDescription: "Restore youthful glow with microneedling, chemical peels, and anti-aging treatments.",
    description:
      "Combat signs of aging with our comprehensive skin rejuvenation programs including microneedling, PRP facials, chemical peels, and injectable treatments for firmer, brighter skin.",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=400&fit=crop",
    duration: "4-6 sessions",
    benefits: ["Reduced wrinkles", "Improved texture", "Youthful glow"],
  },
  {
    id: "laser-hair-removal",
    name: "Laser Hair Removal",
    slug: "laser-hair-removal",
    category: "laser",
    shortDescription: "Safe, effective permanent hair reduction for face and body.",
    description:
      "Using FDA-approved diode and alexandrite lasers, we provide comfortable and effective hair removal for all skin types. Customized settings ensure optimal results with minimal discomfort.",
    image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&h=400&fit=crop",
    duration: "6-8 sessions",
    benefits: ["Permanent reduction", "Smooth skin", "No ingrown hairs"],
  },
];

export const featuredTreatments = treatments.slice(0, 6);

export function getTreatmentsByCategory(category: TreatmentCategory) {
  return treatments.filter((t) => t.category === category);
}
