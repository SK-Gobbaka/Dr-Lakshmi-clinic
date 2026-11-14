const CLINIC_ADDRESS =
  "Dr Lakshmi Skin & Hair Clinic, 1st Floor, BKP Lakshmi Luxus, Sai Ranga Theatre Rd, Nandini Nagar, Madhava Nagar, Hafeezpet, Miyapur, Hyderabad, Telangana 500049";
const LAT = process.env.NEXT_PUBLIC_CLINIC_LAT;
const LNG = process.env.NEXT_PUBLIC_CLINIC_LNG;
const MAP_QUERY = encodeURIComponent(LAT && LNG && !Number.isNaN(Number(LAT)) && !Number.isNaN(Number(LNG)) ? `${LAT},${LNG}` : CLINIC_ADDRESS);

export const HOSPITAL = {
  name: "Dr. Lakshmi Skin & Hair Clinic",
  tagline: "Healthy Hair. Healthy Skin. Confident You.",
  shortDescription:
    "Take the first step toward healthier hair and radiant skin. Our specialists are ready to build a personalized plan— just for you.",
  phone: "+910000000000",
  phoneDisplay: "+91 00000 00000",
  email: "lakshmiclinic@gmail.com",
  emergencyPhone: "+910000000000",
  address: {
    line1: "1st Floor, BKP Lakshmi Luxus, Sai Ranga Theatre Rd, Nandini Nagar, Madhava Nagar",
    line2: "Hafeezpet, Miyapur, Hyderabad, Telangana 500049",
    full: "1st Floor, BKP Lakshmi Luxus, Sai Ranga Theatre Rd, Nandini Nagar, Madhava Nagar, Hafeezpet, Miyapur, Hyderabad, Telangana 500049",
  },
  workingHours: {
    weekdays: "Mon-Sat: 9 am - 12 pm & 5pm - 10 pm",
    sunday: "Sun: Holiday",
  },
  // Map links are built from the street address (or exact coordinates when set in
  // NEXT_PUBLIC_CLINIC_LAT / NEXT_PUBLIC_CLINIC_LNG) so they always point at the clinic.
  googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`,
  // Set NEXT_PUBLIC_GOOGLE_REVIEW_URL to the clinic's "write a review" link
  // (https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID). Until then
  // the thank-you message links to the clinic's Google Maps listing, where reviews can be left.
  googleReviewUrl: process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`,
  googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${MAP_QUERY}`,
  googleMapsEmbed: `https://maps.google.com/maps?q=${MAP_QUERY}&z=16&output=embed`,
  googleRating: 4.8,
  googleReviewCount: 1250,
  social: {
    facebook: "https://facebook.com/lakshmihospital",
    instagram: "https://instagram.com/lakshmihospital",
    twitter: "https://twitter.com/lakshmihospital",
    youtube: "https://youtube.com/lakshmihospital",
  },
} as const;

export const TRUST_STATS = [
  { label: "Years Experience", value: "15+", icon: "calendar" as const },
  { label: "Happy Patients", value: "20,000+", icon: "users" as const },
  { label: "Expert Consultants", value: "12+", icon: "stethoscope" as const },
  { label: "Advanced Technology", value: "50+", icon: "cpu" as const },
  { label: "Google Rating", value: "4.8★", icon: "star" as const },
] as const;

export const WHY_CHOOSE_US = [
  {
    title: "Experienced Doctors",
    description: "Board-certified specialists with 15+ years of combined experience in hair and skin care.",
    icon: "stethoscope" as const,
  },
  {
    title: "Advanced Equipment",
    description: "State-of-the-art diagnostic and treatment equipment for precise, effective results.",
    icon: "cpu" as const,
  },
  {
    title: "Personalized Treatment",
    description: "Custom treatment plans tailored to your unique skin and hair concerns.",
    icon: "heart" as const,
  },
  {
    title: "Affordable Care",
    description: "Premium quality care at transparent, competitive pricing with flexible payment options.",
    icon: "wallet" as const,
  },
  {
    title: "Easy Appointment Booking",
    description: "Book your appointment online in minutes — no waiting on hold.",
    icon: "calendar-check" as const,
  },
  {
    title: "Comfortable Environment",
    description: "Modern, hygienic facilities designed for your comfort and peace of mind.",
    icon: "home" as const,
  },
] as const;

export const PATIENT_JOURNEY = [
  { step: 1, title: "Book Appointment", description: "Choose your preferred date and time online" },
  { step: 2, title: "Visit Hospital", description: "Arrive 10-15 minutes before your appointment" },
  { step: 3, title: "Consultation", description: "Meet our specialist for a thorough assessment" },
  { step: 4, title: "Treatment", description: "Receive personalized treatment for lasting results" },
] as const;

export const BOOKING_HOURS = {
  maxDaysAhead: 30,
} as const;
