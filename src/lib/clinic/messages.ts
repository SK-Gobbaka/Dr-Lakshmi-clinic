import { BRAND, displayPhone, fullAddress, mapsUrl, reviewUrl } from "../site-info";
import { formatLongDate, formatTime12Hour } from "../utils";
import type { Data } from "./unit";
import { sessionOf, sessionLabel } from "./rules";
import { appointmentLabel, doctorLabel, type Appointment, type MessageEvent, type Outgoing } from "./types";

/**
 * The texts the clinic sends over WhatsApp. Each message has a plain-text body (used inside WhatsApp's
 * 24-hour reply window) and an ordered `params` list that fills the variables of an approved template
 * (see README: "WhatsApp templates").
 */

export const describe = (a: Appointment, d: Pick<Data, "sessions">) => ({
  id: a.id,
  type: appointmentLabel(a),
  doctor: doctorLabel(a),
  date: formatLongDate(a.date),
  time: formatTime12Hour(a.startTime),
  session: sessionLabel(sessionOf(a.startTime, d.sessions)),
});

type Ctx = Pick<Data, "site" | "siteUrl">;

export const links = (a: Appointment, d: Ctx) => ({
  cancel: `${d.siteUrl}/book/cancel/${a.token}`,
  reschedule: `${d.siteUrl}/book/reschedule/${a.token}`,
  rebook: `${d.siteUrl}/book`,
  maps: mapsUrl(d.site),
  review: reviewUrl(d.site),
});

/** Where to find us and how to change the booking; cancelling asks for a reason. */
export function patientLinks(a: Appointment, d: Ctx): string {
  const l = links(a, d);
  return `Location: ${fullAddress(d.site)}\nMap: ${l.maps}\nTo cancel (please tell us why): ${l.cancel}\nTo reschedule: ${l.reschedule}`;
}

const call = (d: Ctx) => (displayPhone(d.site) ? `Call ${displayPhone(d.site)}.` : "Please contact the clinic.");

interface Notice {
  audience: "PATIENT" | "ADMIN";
  a: Appointment;
  event: MessageEvent;
  title: string;
  message: string;
  params: string[];
}

export function notify(out: Outgoing[], n: Notice) {
  if (n.audience === "PATIENT") {
    out.push({ event: n.event, audience: "PATIENT", phone: n.a.phone, appointmentId: n.a.id, text: `*${n.title}*\n\n${n.message}`, params: n.params });
    return;
  }
  // Staff alert: delivered to the staff WhatsApp number and/or the staff email, whichever is set up (integrations/deliver.ts).
  out.push({ event: "ADMIN_ALERT", audience: "ADMIN", phone: process.env.ADMIN_WHATSAPP_NUMBER ?? "", appointmentId: n.a.id, text: `*${n.title}*\n\n${n.message}`, params: [n.title, n.message] });
}

/** Variables shared by the booking messages: name, id, date, time, doctor, cancel link, reschedule link. */
const bookingParams = (a: Appointment, d: Data) => {
  const x = describe(a, d);
  const l = links(a, d);
  return [a.fullName, x.id, x.date, x.time, a.kind === "TREATMENT" ? x.type : x.doctor, l.cancel, l.reschedule];
};

const doctorLine = (a: Appointment, x: ReturnType<typeof describe>) => (a.kind === "TREATMENT" ? "" : `\nDoctor: ${x.doctor}`);

export function notifyCreated(d: Data, out: Outgoing[], a: Appointment) {
  const x = describe(a, d);
  notify(out, {
    audience: "ADMIN",
    a,
    event: "ADMIN_ALERT",
    title: `New appointment ${x.id}`,
    message: `Appointment ID: ${x.id}\nCustomer: ${a.fullName}\nContact: ${a.phone}\nAppointment Type: ${x.type}${doctorLine(a, x)}\nDate: ${x.date}\nSession: ${x.session}\nStatus: Pending, awaiting confirmation`,
    params: [],
  });
  notify(out, {
    audience: "PATIENT",
    a,
    event: "BOOKING_PENDING",
    title: "Appointment booked, awaiting confirmation",
    message: `Thank you for booking with ${BRAND.name}.\nAppointment ID: ${x.id}\nName: ${a.fullName}\nAppointment Type: ${x.type}${doctorLine(a, x)}\nDate: ${x.date}\nTime: ${x.time}\n${patientLinks(a, d)}\nThe clinic will confirm your booking shortly.`,
    params: bookingParams(a, d),
  });
}

export function notifyConfirmed(d: Data, out: Outgoing[], a: Appointment) {
  const x = describe(a, d);
  notify(out, {
    audience: "PATIENT",
    a,
    event: "BOOKING_CONFIRMED",
    title: "Appointment confirmed",
    message: `Your appointment has been successfully confirmed!\nAppointment ID: ${x.id}\nName: ${a.fullName}\nAppointment Type: ${x.type}${doctorLine(a, x)}\nDate: ${x.date}\nTime: ${x.time}\nSession: ${x.session}\n${patientLinks(a, d)}\nThank you for booking with us.`,
    params: bookingParams(a, d),
  });
  notify(out, {
    audience: "ADMIN",
    a,
    event: "ADMIN_ALERT",
    title: `Appointment ${x.id} confirmed`,
    message: `Appointment ID: ${x.id}\nCustomer: ${a.fullName}\nContact: ${a.phone}\nAppointment Type: ${x.type}${doctorLine(a, x)}\nDate: ${x.date}\nSession: ${x.session}\nStatus: Confirmed`,
    params: [],
  });
}

export function notifyCancelledByPatient(d: Data, out: Outgoing[], a: Appointment) {
  const x = describe(a, d);
  notify(out, {
    audience: "ADMIN",
    a,
    event: "ADMIN_ALERT",
    title: `Appointment ${x.id} cancelled`,
    message: `Appointment ID: ${x.id}\nCustomer: ${a.fullName}\nContact: ${a.phone}\nAppointment Type: ${x.type}\nDate: ${x.date}\nSession: ${x.session}\nReason: ${a.cancelReason}`,
    params: [],
  });
}

export function notifyCancelledByClinic(d: Data, out: Outgoing[], a: Appointment, closure?: { why: string }) {
  const x = describe(a, d);
  notify(out, {
    audience: "PATIENT",
    a,
    event: "BOOKING_CANCELLED",
    title: closure ? "Your appointment was cancelled: the clinic is closed" : "Appointment cancelled",
    message: closure
      ? `Dear ${a.fullName}, ${BRAND.name} is closed on ${x.date} because of an emergency (${closure.why}). We are very sorry: your appointment ${a.id} (${x.type}) at ${x.time} has been cancelled.\nPlease book a new appointment here: ${links(a, d).rebook}\n${call(d)}`
      : `Your appointment ${x.id} (${x.type}) on ${x.date} at ${x.time} was cancelled by the clinic.\nReason: ${a.cancelReason}\nBook again any time: ${links(a, d).rebook}\n${call(d)}`,
    params: [a.fullName, x.id, x.date, x.time, a.cancelReason ?? "", links(a, d).rebook],
  });
}

export function notifyThankYou(d: Data, out: Outgoing[], a: Appointment) {
  const l = links(a, d);
  notify(out, {
    audience: "PATIENT",
    a,
    event: "THANK_YOU",
    title: "Thank you for visiting us",
    message: `Dear ${a.fullName}, thank you for visiting ${BRAND.name}. We hope you are happy with your care.\nIf you have a moment, please share your experience with a Google review: ${l.review}\nBook your next visit: ${l.rebook}`,
    params: [a.fullName, l.review, l.rebook],
  });
}

export function notifyRescheduled(d: Data, out: Outgoing[], a: Appointment, opts: { by: "patient" | "clinic"; summary: string; was?: ReturnType<typeof describe>; blockedReason?: string; moved?: boolean }) {
  const x = describe(a, d);
  if (opts.by === "patient" && !opts.blockedReason) {
    notify(out, {
      audience: "ADMIN",
      a,
      event: "ADMIN_ALERT",
      title: `Appointment ${x.id} rescheduled by patient`,
      message: `Customer: ${a.fullName}\nContact: ${a.phone}\n${opts.summary}\nDate: ${x.date}\nSession: ${x.session}\nStatus: ${a.status.toLowerCase()}`,
      params: [],
    });
  }
  notify(out, {
    audience: "PATIENT",
    a,
    event: "BOOKING_RESCHEDULED",
    title: opts.blockedReason ? "Your appointment has been rescheduled" : opts.moved === false ? "Appointment updated" : "Appointment rescheduled",
    message: opts.blockedReason
      ? `The clinic is closed on ${opts.was?.date} (${opts.blockedReason}), so your appointment was moved.\nAppointment ID: ${a.id}\nAppointment Type: ${x.type}\nOriginal: ${opts.was?.date}, ${opts.was?.time}\nNew: ${x.date}, ${x.time} - ${x.session}\nIf this time does not suit you, you can reschedule from the link in your booking message. ${call(d)}`
      : `${opts.by === "patient" ? "Your appointment was rescheduled." : opts.moved === false ? "Your appointment details were updated by the clinic." : "Your appointment was rescheduled by the clinic."}\nAppointment ID: ${x.id}\nAppointment Type: ${x.type}${doctorLine(a, x)}\nDate: ${x.date}\nTime: ${x.time}\n${patientLinks(a, d)}\nNeed help? ${call(d)}`,
    params: bookingParams(a, d),
  });
}

export function notifyDetailsChanged(d: Data, out: Outgoing[], a: Appointment, summary: string, by: "patient" | "clinic") {
  const x = describe(a, d);
  if (by === "patient") {
    notify(out, {
      audience: "ADMIN",
      a,
      event: "ADMIN_ALERT",
      title: `Appointment ${x.id} edited by patient`,
      message: `Customer: ${a.fullName}\nContact: ${a.phone}\n${summary}\nDate: ${x.date}\nSession: ${x.session}\nStatus: ${a.status.toLowerCase()}`,
      params: [],
    });
  }
}

export function notifyNeedsNewDate(d: Data, out: Outgoing[], a: Appointment, was: ReturnType<typeof describe>, why: string) {
  notify(out, {
    audience: "PATIENT",
    a,
    event: "DATE_UNAVAILABLE",
    title: "Your appointment date is unavailable",
    message: `The clinic is closed on ${was.date} (${why}). Your appointment ${a.id} (${was.type}) needs a new date.\nThe clinic will contact you, or you can pick a new date from your reschedule link. ${call(d)}`,
    params: [a.fullName, a.id, was.date, why, links(a, d).reschedule],
  });
}

/** Reminder sent about two hours before a confirmed appointment. */
export function reminderMessage(a: Appointment, d: Data): Outgoing {
  const x = describe(a, d);
  const l = links(a, d);
  return {
    event: "REMINDER",
    audience: "PATIENT",
    phone: a.phone,
    appointmentId: a.id,
    text: `*Appointment reminder*\n\nDear ${a.fullName}, this is a reminder for your appointment at ${BRAND.name}.\nDate: ${x.date}\nTime: ${x.time}\nPlease arrive 10 to 15 minutes early.\nDirections: ${l.maps}\nTo cancel or reschedule: ${l.reschedule}`,
    params: [a.fullName, x.date, x.time, l.maps, l.reschedule],
  };
}
