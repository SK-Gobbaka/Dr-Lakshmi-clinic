/**
 * Fixed explanatory text on the home page. It describes how the clinic's booking works and makes no claims
 * about results, years of experience, equipment or prices: figures belong in Admin > Contact & site details.
 */
export const WHY_CHOOSE_US = [
  {
    title: "Doctor-led care",
    description: "You see a doctor who looks at the cause of your hair or skin concern before suggesting any treatment.",
  },
  {
    title: "A plan made for you",
    description: "Treatment is planned around your own skin and hair, not picked from a fixed package.",
  },
  {
    title: "Easy online booking",
    description: "Choose a date and time in a few minutes. Change or cancel later from the link in your booking message.",
  },
  {
    title: "Choose your doctor",
    description: "Book with Dr. Lakshmi or with one of the other doctors at the clinic, and see which time slots are open.",
  },
] as const;

export const PATIENT_JOURNEY = [
  { step: 1, title: "Book appointment", description: "Choose your preferred date and time online" },
  { step: 2, title: "Visit the clinic", description: "Arrive 10 to 15 minutes before your appointment" },
  { step: 3, title: "Consultation", description: "Meet your doctor for a thorough assessment" },
  { step: 4, title: "Treatment plan", description: "Agree the treatment that suits you and your next visit" },
] as const;
