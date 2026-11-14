export interface Doctor {
  id: string;
  name: string;
  qualification: string;
  designation: string;
  experience: number;
  specialization: string[];
  bio: string;
  image: string;
  isSenior?: boolean;
  message?: string;
  regNo?: string;
}

export const doctors: Doctor[] = [
  {
    id: "dr-lakshmi-villa",
    name: "Dr. LAKSHMI KUMARI VILLA",
    qualification: "MD, DVL",
    regNo: "84127",
    designation: "Senior Consultant",
    experience: 18,
    specialization: ["DERMATOLOGY", "TRICHOLOGY", "COSMETOLOGY", "LASER SPECIALIST", "CO-PROFESSOR"],
    bio: "Dr. Lakshmi Kumari Villa is a renowned dermatologist with over 18 years of experience in hair restoration and advanced skin treatments. She has performed 5,000+ successful hair transplant procedures and is recognized nationally for her expertise in trichology.",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&h=700&fit=crop&crop=face",
    isSenior: true,
    message:
      "Every patient deserves to feel confident in their skin. I combine the latest evidence-based treatments with a truly personalized approach to deliver lasting, meaningful results.",
  },
  {
    id: "dr-arjun-sharma",
    name: "Dr. Arjun Sharma",
    qualification: "MD (Dermatology)",
    designation: "Consultant Dermatologist",
    experience: 12,
    specialization: ["Acne Treatment", "Laser Therapy"],
    bio: "Specializes in medical and cosmetic dermatology with a focus on acne, pigmentation disorders, and laser treatments.",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-priya-nair",
    name: "Dr. Priya Nair",
    qualification: "MD (Dermatology)",
    designation: "Hair Specialist",
    experience: 10,
    specialization: ["Hair Loss", "PRP Therapy"],
    bio: "Dedicated trichologist specializing in hair loss treatments, PRP therapy, and scalp disorders.",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-rahul-mehta",
    name: "Dr. Rahul Mehta",
    qualification: "MD (Dermatology)",
    designation: "Laser Specialist",
    experience: 8,
    specialization: ["Laser Hair Removal", "Scar Treatment"],
    bio: "Leads our laser and aesthetic department, offering advanced treatments with precision and safety.",
    image: "https://images.unsplash.com/photo-1622253692010-333f8729471e?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-ananya-kumar",
    name: "Dr. Ananya Kumar",
    qualification: "MD (Dermatology)",
    designation: "Cosmetic Dermatologist",
    experience: 7,
    specialization: ["Anti-Aging", "Chemical Peels"],
    bio: "Focuses on cosmetic dermatology and anti-aging treatments to help patients achieve radiant, youthful skin.",
    image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-vikram-singh",
    name: "Dr. Vikram Singh",
    qualification: "MD (Dermatology)",
    designation: "Dermatosurgeon",
    experience: 9,
    specialization: ["Hair Transplant", "Mole Removal"],
    bio: "Skilled dermatosurgeon specializing in FUE hair transplants and minor surgical procedures.",
    image: "https://images.unsplash.com/photo-1537368910025-700350f70ac0?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-kiran-kumar",
    name: "Dr. Kiran Kumar",
    qualification: "MD (Dermatology)",
    designation: "Dermatologist",
    experience: 9,
    specialization: ["Skin Care", "Acne scars"],
    bio: "Expert in clinical dermatology and advanced acne scar resurfacing procedures.",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-sneha-reddy",
    name: "Dr. Sneha Reddy",
    qualification: "MD (Dermatology)",
    designation: "Trichologist",
    experience: 8,
    specialization: ["Hair Thinning", "Alopecia"],
    bio: "Focuses on scalp health and specialized micro-needling therapies for hair thinning.",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-rajesh-varma",
    name: "Dr. Rajesh Varma",
    qualification: "MD (Dermatology)",
    designation: "Cosmetologist",
    experience: 11,
    specialization: ["Face Contouring", "Botox"],
    bio: "Specializes in non-surgical facial rejuvenation, anti-wrinkle injections, and dermal fillers.",
    image: "https://images.unsplash.com/photo-1622253692010-333f8729471e?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-kavitha-naidu",
    name: "Dr. Kavitha Naidu",
    qualification: "MD (Dermatology)",
    designation: "Laser Specialist",
    experience: 6,
    specialization: ["Pigmentation", "Tattoo Removal"],
    bio: "Focused on advanced laser treatments for pigmentation, melasma, and birthmarks.",
    image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-manoj-prabhakar",
    name: "Dr. Manoj Prabhakar",
    qualification: "MD (Dermatology)",
    designation: "Dermatosurgeon",
    experience: 10,
    specialization: ["Hair Transplant", "Vitiligo Surgery"],
    bio: "Expert dermatosurgeon performing advanced hair restoration and surgical skin grafting.",
    image: "https://images.unsplash.com/photo-1537368910025-700350f70ac0?w=600&h=700&fit=crop&crop=face",
  },
  {
    id: "dr-divya-teja",
    name: "Dr. Divya Teja",
    qualification: "MD (Dermatology)",
    designation: "Aesthetic Specialist",
    experience: 8,
    specialization: ["Skin Glow", "Chemical Peels"],
    bio: "Specializes in clinical cosmetology, skin peeling procedures, and pigmentation therapies.",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&h=700&fit=crop&crop=face",
  },
];

export const seniorConsultant = doctors.find((d) => d.isSenior)!;
