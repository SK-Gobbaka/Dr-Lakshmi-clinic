import { format } from "date-fns";
import { HOSPITAL } from "./constants";
import { formatTime12Hour } from "./utils";

interface WhatsAppMessageParams {
  to: string;
  body: string;
}

interface AppointmentDetails {
  patientName: string;
  date: Date;
  startTime: string;
  confirmationToken: string;
}

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function formatAppointmentDate(date: Date): string {
  return format(date, "EEEE, MMMM d, yyyy");
}

function buildLinks(token: string) {
  const baseUrl = getSiteUrl();
  return {
    cancel: `${baseUrl}/book/cancel/${token}`,
    reschedule: `${baseUrl}/book/reschedule/${token}`,
    rebook: `${baseUrl}/book`,
    maps: HOSPITAL.googleMapsUrl,
  };
}

/** Send WhatsApp message via Meta Graph API */
export async function sendWhatsAppMessage({
  to,
  body,
}: WhatsAppMessageParams): Promise<{ success: boolean; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!phoneNumberId || !accessToken) {
    console.warn("[WhatsApp] Credentials not configured. Message logged:", body);
    return { success: true };
  }

  const formattedPhone = to.startsWith("91") ? to : `91${to}`;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: { preview_url: true, body },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[WhatsApp] API error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("[WhatsApp] Send failed:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendBookingConfirmation(
  phone: string,
  details: AppointmentDetails
) {
  const links = buildLinks(details.confirmationToken);
  const timeFormatted = formatTime12Hour(details.startTime);
  const dateFormatted = formatAppointmentDate(details.date);

  const message = `✅ *Appointment Confirmed*

Dear ${details.patientName},

Your appointment at *${HOSPITAL.name}* has been confirmed.

📅 *Date:* ${dateFormatted}
⏰ *Time:* ${timeFormatted}
📍 *Address:* ${HOSPITAL.address.full}
📞 *Phone:* ${HOSPITAL.phoneDisplay}

🗺️ *Directions:* ${links.maps}

Please arrive 10-15 minutes early.

🔗 *Manage Appointment:*
Cancel: ${links.cancel}
Reschedule: ${links.reschedule}

Thank you for choosing ${HOSPITAL.name}!`;

  return sendWhatsAppMessage({ to: phone, body: message });
}

export async function sendAppointmentReminder(
  phone: string,
  details: AppointmentDetails
) {
  const links = buildLinks(details.confirmationToken);
  const timeFormatted = formatTime12Hour(details.startTime);
  const dateFormatted = formatAppointmentDate(details.date);

  const message = `⏰ *Appointment Reminder*

Dear ${details.patientName},

This is a reminder for your upcoming appointment at *${HOSPITAL.name}*.

📅 *Date:* ${dateFormatted}
⏰ *Time:* ${timeFormatted}

Please arrive *10-15 minutes early*.

🗺️ *Directions:* ${links.maps}

See you soon!`;

  return sendWhatsAppMessage({ to: phone, body: message });
}

export async function sendHospitalCancellation(
  phone: string,
  patientName: string,
  reason: string
) {
  const links = buildLinks("");
  const message = `❌ *Appointment Cancelled*

Dear ${patientName},

We regret to inform you that your appointment at *${HOSPITAL.name}* has been cancelled by the hospital.

*Reason:* ${reason}

We apologize for the inconvenience. Please rebook at your convenience:

🔗 ${links.rebook}

📞 Contact us: ${HOSPITAL.phoneDisplay}`;

  return sendWhatsAppMessage({ to: phone, body: message });
}

export async function sendNoShowNotification(phone: string, patientName: string) {
  const links = buildLinks("");
  const message = `⚠️ *Missed Appointment*

Dear ${patientName},

We noticed you missed your scheduled appointment at *${HOSPITAL.name}*.

We hope everything is okay. If you'd like to reschedule, please book a new appointment:

🔗 ${links.rebook}

📞 Contact us: ${HOSPITAL.phoneDisplay}

We look forward to serving you.`;

  return sendWhatsAppMessage({ to: phone, body: message });
}
