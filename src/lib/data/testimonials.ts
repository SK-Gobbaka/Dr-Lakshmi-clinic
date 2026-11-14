export interface Testimonial {
  id: string;
  name: string;
  image: string;
  rating: number;
  review: string;
  treatment?: string;
  date: string;
}

export const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Rajesh Kumar",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    review:
      "Excellent experience! Dr. Lakshmi and her team were professional and caring. My hair transplant results exceeded expectations. Highly recommend this hospital.",
    treatment: "Hair Transplant",
    date: "2 weeks ago",
  },
  {
    id: "2",
    name: "Sneha Patel",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    review:
      "After struggling with acne for years, Dr. Arjun's treatment plan cleared my skin completely. The online booking was so convenient too!",
    treatment: "Acne Treatment",
    date: "1 month ago",
  },
  {
    id: "3",
    name: "Mohammed Ali",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    review:
      "PRP therapy sessions were painless and effective. Noticed significant hair growth after 3 months. Great facility and friendly staff.",
    treatment: "PRP Therapy",
    date: "3 weeks ago",
  },
  {
    id: "4",
    name: "Anita Desai",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    review:
      "The pigmentation treatment worked wonders for my melasma. Clean, modern hospital with top-notch equipment. Worth every rupee.",
    treatment: "Pigmentation",
    date: "2 months ago",
  },
  {
    id: "5",
    name: "Vikram Reddy",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    rating: 4,
    review:
      "Smooth appointment booking process. Doctors took time to explain everything. Laser hair removal results are amazing after 5 sessions.",
    treatment: "Laser Hair Removal",
    date: "1 week ago",
  },
  {
    id: "6",
    name: "Priya Sharma",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    review:
      "Best dermatology hospital in Hyderabad! From reception to treatment, everything was seamless. My skin has never looked better.",
    date: "3 months ago",
  },
];
