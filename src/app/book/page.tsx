import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/BookingWizard";

export const metadata: Metadata = {
  title: "Book Appointment",
  description:
    "Book your appointment online at Lakshmi Hair & Skin Hospital. Choose your preferred date and time.",
};

export default function BookPage() {
  return (
    <div className="bg-background min-h-screen">
      <BookingWizard />
    </div>
  );
}
