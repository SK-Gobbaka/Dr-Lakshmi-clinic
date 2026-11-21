import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { bookingContext } from "@/lib/booking-page";
import { BRAND } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Book Appointment",
  description: `Book your appointment online at ${BRAND.name}. Choose your preferred date and time.`,
};

export const dynamic = "force-dynamic"; // reads live settings (bot check, contact details)

export default async function BookPage() {
  const ctx = await bookingContext();
  return (
    <div className="bg-background min-h-screen">
      <BookingWizard {...ctx} />
    </div>
  );
}
