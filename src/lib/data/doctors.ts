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
];

export const seniorConsultant = doctors.find((d) => d.isSenior)!;
