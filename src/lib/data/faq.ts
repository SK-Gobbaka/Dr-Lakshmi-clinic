export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const faqs: FAQItem[] = [
  {
    id: "1",
    question: "How do I book an appointment?",
    answer:
      "You can book an appointment online through our website by clicking 'Book Appointment'. Select your preferred date and time, fill in your details, and confirm. You can also call us directly at our hospital number.",
  },
  {
    id: "2",
    question: "Do I need to select a specific doctor?",
    answer:
      "No. When you book online, our team assigns the most suitable specialist based on your concern. During your visit, you'll be connected with the right consultant for your needs.",
  },
  {
    id: "3",
    question: "What should I bring for my first visit?",
    answer:
      "Please bring a valid ID, any previous medical records related to your hair or skin condition, and a list of current medications. Arrive 10-15 minutes before your scheduled time.",
  },
  {
    id: "4",
    question: "How long does a consultation take?",
    answer:
      "A typical first consultation takes 20-30 minutes. This includes history taking, examination, and discussion of treatment options. Follow-up visits are usually shorter.",
  },
  {
    id: "5",
    question: "Is hair transplant permanent?",
    answer:
      "Yes, hair transplant results are permanent. The transplanted hair follicles are taken from areas resistant to hair loss and will continue to grow naturally for a lifetime.",
  },
  {
    id: "6",
    question: "Are laser treatments safe for Indian skin?",
    answer:
      "Absolutely. We use advanced lasers calibrated for Indian skin types (Fitzpatrick III-V). Our specialists adjust settings based on your skin tone for safe, effective treatment.",
  },
  {
    id: "7",
    question: "Can I cancel or reschedule my appointment?",
    answer:
      "Yes. After booking, you'll receive a confirmation with links to cancel or reschedule. You can also call our hospital directly. Please provide at least 4 hours notice for cancellations.",
  },
  {
    id: "8",
    question: "Do you accept insurance?",
    answer:
      "We accept most major health insurance plans for medically necessary treatments. Cosmetic procedures may not be covered. Please contact our billing desk for specific coverage details.",
  },
];
