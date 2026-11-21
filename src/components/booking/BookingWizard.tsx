"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { format, parseISO, isToday, isSameMonth, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronLeft, ChevronRight, Loader2, CheckCircle, MapPin, Calendar, Phone, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SiteSettings } from "@/lib/clinic/types";
import { fullAddress, hasMapLink, mapsUrl, telHref } from "@/lib/site-info";
import { bookingDetailsSchema, type BookingDetailsInput } from "@/lib/validations";
import { formatTime12Hour, cn } from "@/lib/utils";
import {
  getAvailableDates,
  getAvailableSlots,
  getDoctorAvailability,
  createAppointment,
  createTreatmentBooking,
  rescheduleAppointment,
} from "@/actions/appointment";
import type { AvailableSlot, DoctorAvailability } from "@/actions/appointment";
import { Turnstile } from "./Turnstile";

interface BookingWizardProps {
  mode?: "book" | "reschedule" | "treatment";
  rescheduleToken?: string;
  /** Clinic contact details (hours, address, phone) shown on the screens; anything empty is left out. */
  site: SiteSettings;
  /** Set when the bot check is switched on. */
  turnstileSiteKey?: string;
  /** True when booking messages are really sent over WhatsApp. */
  messaging: boolean;
}

const NETWORK_ERROR = "We could not reach the server. Please check your connection and try again.";

const PATIENT_TYPES = [
  { id: "NEW", label: "New", hint: "First visit to the clinic" },
  { id: "FOLLOW_UP", label: "Follow-up", hint: "Review of an ongoing treatment" },
] as const;

const DOCTOR_CHOICES = [
  { group: "LAKSHMI", label: "Dr. Lakshmi", hint: "Senior consultant" },
  { group: "OTHERS", label: "Other Doctors", hint: "Any of our other specialists" },
] as const;

const fieldBox =
  "w-full rounded-full border border-gray-200 px-6 py-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all shadow-[0_0_12px_rgba(20,184,166,0.04)] bg-white text-text-primary font-medium";
const heading = "text-[#1F7A63] font-bold text-base uppercase tracking-wider";

export function BookingWizard({ mode = "book", rescheduleToken, site, turnstileSiteKey, messaging }: BookingWizardProps) {
  const isTreatment = mode === "treatment";
  const [step, setStep] = useState(1);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [confirmationToken, setConfirmationToken] = useState("");
  const [humanToken, setHumanToken] = useState("");
  const [humanReset, setHumanReset] = useState(0);
  const [error, setErrorText] = useState("");
  const [errorTick, setErrorTick] = useState(0);
  // Bumps a counter on every call so the same message shown twice still scrolls into view.
  const setError = useCallback((m: string) => {
    setErrorText(m);
    setErrorTick((t) => t + 1);
  }, []);
  const errorRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingDates, setLoadingDates] = useState(true);
  const [datesFailed, setDatesFailed] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [patientType, setPatientType] = useState<"NEW" | "FOLLOW_UP" | "">("");
  const [doctorGroup, setDoctorGroup] = useState<"LAKSHMI" | "OTHERS" | "">("");
  const [doctorAvail, setDoctorAvail] = useState<DoctorAvailability[]>([]);
  const [booked, setBooked] = useState<{ id: string; status: string; typeLabel: string; doctorLabel: string; name: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const form = useForm<BookingDetailsInput>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: { fullName: "", phone: "", age: undefined, gender: undefined },
  });

  const loadDates = useCallback(async () => {
    setLoadingDates(true);
    setDatesFailed(false);
    try {
      const result = await getAvailableDates();
      if (result.success) setDates(result.data);
      else setDatesFailed(true);
    } catch {
      setDatesFailed(true);
    }
    setLoadingDates(false);
  }, []);

  /** Slots and doctor capacity always come from the server, so admin changes and other bookings show up. */
  const loadSlots = useCallback(
    async (date: string, keepMessage = false) => {
      setLoadingSlots(true);
      if (!keepMessage) setError(""); // after a refused booking the refusal must stay on screen while the slots refresh
      try {
        const [result, avail] = await Promise.all([getAvailableSlots(date, rescheduleToken), mode === "book" ? getDoctorAvailability(date) : Promise.resolve([])]);
        setDoctorAvail(avail);
        if (result.success) {
          setSlots(result.data);
          setSelectedSlot((cur) => (cur && result.data.some((s) => s.id === cur.id) ? (result.data.find((s) => s.id === cur.id) ?? null) : null));
          if (result.data.length === 0) setError("No availability for this date. Please select another date.");
        } else {
          setError(result.error);
          setSlots([]);
        }
      } catch {
        setError(NETWORK_ERROR);
        setSlots([]);
      }
      setLoadingSlots(false);
    },
    [rescheduleToken, mode, setError]
  );

  useEffect(() => {
    const t = setTimeout(loadDates, 0);
    return () => clearTimeout(t);
  }, [loadDates]);

  // The form is long: without this the message sits off-screen and the button looks dead.
  useEffect(() => {
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorTick]);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    loadSlots(dateStr);
    setStep(2);
  };

  const full = (g: "LAKSHMI" | "OTHERS") => (doctorAvail.find((d) => d.group === g)?.remaining ?? 1) <= 0;

  const handleDetailsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) return setError("Please select a time slot first.");
    if (mode === "reschedule") return handleConfirm();
    if (turnstileSiteKey && !humanToken) return setError("Please complete the security check below, then try again.");
    if (isTreatment) return form.handleSubmit(() => handleConfirm(), (errs) => setError(Object.values(errs)[0]?.message ?? "Please check your details."))(e);
    if (!patientType) return setError("Please choose New or Follow-up.");
    if (!doctorGroup) return setError("Please choose Dr. Lakshmi or Other Doctors.");
    if (full(doctorGroup)) return setError("That doctor group is fully booked on this date. Please choose another doctor or date.");
    form.handleSubmit(
      () => handleConfirm(),
      (errs) => setError(Object.values(errs)[0]?.message ?? "Please check your details.")
    )(e);
  };

  const resetForAnother = () => {
    form.reset({ fullName: "", phone: "", age: undefined, gender: undefined });
    setPatientType("");
    setDoctorGroup("");
    setSelectedSlot(null);
    setSelectedDate("");
    setBooked(null);
    setConfirmationToken("");
    setError("");
    loadDates();
    setStep(1);
  };

  const handleConfirm = () => {
    if (!selectedSlot || !selectedDate) return;

    startTransition(async () => {
      setError("");
      try {
        if (mode === "reschedule" && rescheduleToken) {
          const result = await rescheduleAppointment({ token: rescheduleToken, newSlotId: selectedSlot.id });
          if (result.success) {
            setConfirmationToken(result.data.confirmationToken);
            setStep(3);
          } else {
            setError(result.error);
            loadSlots(selectedDate, true);
          }
          return;
        }

        const values = form.getValues();
        const result = isTreatment
          ? await createTreatmentBooking({ ...values, slotId: selectedSlot.id, date: selectedDate, turnstileToken: humanToken })
          : await createAppointment({ ...values, patientType, doctorGroup, slotId: selectedSlot.id, date: selectedDate, turnstileToken: humanToken });
        if (result.success) {
          setConfirmationToken(result.data.confirmationToken);
          setBooked({
            id: result.data.appointmentId,
            status: result.data.status,
            typeLabel: isTreatment ? "Treatment" : (PATIENT_TYPES.find((t) => t.id === patientType)?.label ?? ""),
            doctorLabel: isTreatment ? "" : (DOCTOR_CHOICES.find((d) => d.group === doctorGroup)?.label ?? ""),
            name: values.fullName,
          });
          setStep(3);
        } else {
          setError(result.error);
          loadSlots(selectedDate, true); // someone else may have taken the last place: show the current availability
        }
      } catch {
        // The booking may or may not have gone through: say so instead of leaving the form looking frozen.
        setError(`${NETWORK_ERROR} If you already received a booking message, your appointment is saved.`);
      } finally {
        // a bot-check token works once: ask for a new one after every attempt
        setHumanToken("");
        setHumanReset((n) => n + 1);
      }
    });
  };

  // Calendar logic helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(new Date(year, month, d));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const chip = (selected: boolean, disabled?: boolean) =>
    cn(
      "rounded-2xl border px-4 py-3 text-left transition-all",
      disabled
        ? "cursor-not-allowed border-gray-100 bg-gray-50 text-text-secondary/60"
        : selected
          ? "border-teal-500 bg-teal-50 shadow-sm ring-2 ring-teal-500/20"
          : "border-gray-200 bg-white hover:border-teal-400"
    );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      {error && (
        <div ref={errorRef} className="mb-6 mx-auto max-w-2xl rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      <div className="mx-auto max-w-2xl">
        <AnimatePresence mode="wait">
          {/* Step 1: calendar */}
          {step === 1 && (
            <motion.div key="calendar-step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              {(site.workingHours || site.closedDay) && (
                <div className="flex items-center gap-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-2xl p-6 shadow-sm max-w-lg mx-auto">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#1F7A63]">
                    <Clock className="h-7 w-7" aria-hidden />
                  </div>
                  <div className="text-left">
                    {site.workingHours && <p className="font-heading font-bold text-text-primary text-base leading-snug">{site.workingHours}</p>}
                    {site.closedDay && <p className="text-sm font-semibold text-text-secondary mt-0.5">{site.closedDay}</p>}
                  </div>
                </div>
              )}

              <div className="max-w-2xl mx-auto">
                <div className="relative -mb-7 z-20 flex justify-between px-6">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center select-none shrink-0">
                      <div className="h-8 w-4 rounded-t-full border-[3px] border-black bg-transparent"></div>
                      <div className="h-3.5 w-3.5 rounded-full bg-black/90 -mt-1.5"></div>
                    </div>
                  ))}
                </div>

                <div className="relative bg-white border border-gray-100 rounded-3xl pt-10 pb-8 px-6 sm:px-8 shadow-xl shadow-cyan-500/[0.04]">
                  <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                    <button
                      type="button"
                      onClick={prevMonth}
                      disabled={isSameMonth(currentMonth, new Date())}
                      className="p-2 rounded-full border border-gray-100 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4 text-text-secondary" />
                    </button>
                    <h2 className="font-heading font-bold text-text-primary text-lg tracking-wide uppercase">{format(currentMonth, "MMMM yyyy")}</h2>
                    <button type="button" onClick={nextMonth} className="p-2 rounded-full border border-gray-100 hover:bg-gray-50 transition-colors" aria-label="Next month">
                      <ChevronRight className="h-4 w-4 text-text-secondary" />
                    </button>
                  </div>

                  {datesFailed ? (
                    <div role="alert" className="py-10 text-center text-sm text-text-secondary">
                      <p className="font-semibold text-text-primary">We could not load the available dates.</p>
                      <p className="mt-1">Please check your connection{site.phone ? " or call the clinic" : ""}.</p>
                      <button type="button" onClick={loadDates} className="mt-4 rounded-full border-2 border-[#1F7A63] px-6 py-2 text-xs font-bold uppercase tracking-wider text-[#1F7A63] hover:bg-[#1F7A63] hover:text-white">
                        Try again
                      </button>
                    </div>
                  ) : loadingDates ? (
                    <div className="grid grid-cols-7 gap-2 text-center">
                      {Array.from({ length: 35 }).map((_, i) => (
                        <div key={i} className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-gray-50 animate-pulse mx-auto" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-7 gap-2 text-center text-[10px] sm:text-xs font-bold text-[#1F7A63] uppercase tracking-wider select-none">
                        {[
                          ["Sunday", "Su"],
                          ["Monday", "Mo"],
                          ["Tuesday", "Tu"],
                          ["Wednesday", "We"],
                          ["Thursday", "Th"],
                          ["Friday", "Fr"],
                          ["Saturday", "Sa"],
                        ].map(([long, short]) => (
                          <span key={long}>
                            <span className="hidden sm:inline">{long}</span>
                            <span className="sm:hidden">{short}</span>
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center items-center justify-center">
                        {calendarCells.map((cell, idx) => {
                          if (!cell) return <div key={`empty-${idx}`} className="h-9 sm:h-11" />;
                          const dateStr = format(cell, "yyyy-MM-dd");
                          const isSun = cell.getDay() === 0;
                          const isTodayDate = isToday(cell);
                          const isBookable = dates.includes(dateStr);
                          let dayClass = "w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full text-sm sm:text-base font-bold mx-auto transition-all select-none ";
                          let buttonDisabled = true;
                          if (isSun) dayClass += "bg-[#5C658D] text-white cursor-not-allowed";
                          else if (isTodayDate) {
                            dayClass += isBookable ? "bg-[#1F7A63] text-white hover:scale-105 cursor-pointer" : "bg-[#1F7A63]/60 text-white cursor-not-allowed";
                            buttonDisabled = !isBookable;
                          } else if (isBookable) {
                            dayClass += "text-text-primary hover:bg-teal-50 hover:text-teal-600 hover:scale-105 cursor-pointer";
                            buttonDisabled = false;
                          } else dayClass += "text-text-secondary/40 cursor-not-allowed";
                          return (
                            <button
                              key={`day-${dateStr}`}
                              type="button"
                              disabled={buttonDisabled}
                              onClick={() => handleDateSelect(dateStr)}
                              className={dayClass}
                              aria-label={`${format(cell, "EEEE d MMMM yyyy")}${isTodayDate ? ", today" : ""}${isBookable ? ", available" : isSun ? ", closed" : ", not available"}`}
                              aria-current={isTodayDate ? "date" : undefined}
                            >
                              {cell.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-center gap-6 mt-10 pt-6 border-t border-gray-100 text-xs font-bold text-text-secondary select-none">
                    <div className="flex items-center gap-2">
                      <span className="h-4.5 w-4.5 rounded-full bg-[#1F7A63] inline-block"></span>
                      <span>Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-4.5 w-4.5 rounded-full bg-[#5C658D] inline-block"></span>
                      <span>Not Available</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: time slot, type, doctor and patient details */}
          {step === 2 && (
            <motion.div
              key="details-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-cyan-500/[0.04] text-left max-w-2xl mx-auto"
            >
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1.5 text-[#1F7A63] hover:text-[#17604E] font-bold text-xs select-none transition-colors uppercase tracking-wider mb-8">
                <ChevronLeft className="h-4 w-4" /> back
              </button>

              <form onSubmit={handleDetailsSubmit} className="space-y-8">
                <div className="space-y-2">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <h3 className={heading}>Date :</h3>
                  </div>
                  <p className="text-text-primary text-base font-bold">{selectedDate && format(parseISO(selectedDate), "dd MMMM yyyy")}</p>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <h3 className={heading}>Time slot :</h3>
                  </div>
                  {loadingSlots ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-full bg-gray-50 animate-pulse" />
                      ))}
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-text-secondary">No slots available for this date.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Time slot">
                      {slots.map((slot) => {
                        const isSelected = selectedSlot?.id === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setError("");
                            }}
                            className={cn(
                              "flex items-center justify-between gap-2.5 rounded-full border px-5 py-3.5 text-xs font-bold transition-all text-left w-full select-none",
                              isSelected ? "border-teal-500 bg-teal-500 text-white shadow-sm" : "border-gray-200 bg-white text-text-primary hover:border-teal-400 hover:shadow-sm"
                            )}
                          >
                            <span className="flex items-center gap-2.5">
                              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", isSelected ? "bg-white" : "bg-[#22C55E]")} />
                              {formatTime12Hour(slot.startTime)} - {formatTime12Hour(slot.endTime)}
                            </span>
                            <span className={cn("text-[11px] font-semibold", isSelected ? "text-white/90" : "text-text-secondary")}>{slot.available} left</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-center text-xs font-semibold text-text-secondary">Only slots with places left are shown.</p>
                </div>

                {mode !== "reschedule" && (
                  <>
                    {!isTreatment && (<>
                    <div className="space-y-3">
                      <div className="border-b border-[#1F7A63]/20 pb-1">
                        <h3 className={heading}>Appointment type :</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Appointment type">
                        {PATIENT_TYPES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={patientType === t.id}
                            onClick={() => {
                              setPatientType(t.id);
                              setError("");
                            }}
                            className={chip(patientType === t.id)}
                          >
                            <span className="block text-sm font-bold text-text-primary">{t.label}</span>
                            <span className="mt-0.5 block text-xs text-text-secondary">{t.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="border-b border-[#1F7A63]/20 pb-1">
                        <h3 className={heading}>Doctor to consult :</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Doctor to consult">
                        {DOCTOR_CHOICES.map((d) => {
                          const isFull = full(d.group);
                          return (
                            <button
                              key={d.group}
                              type="button"
                              role="radio"
                              aria-checked={doctorGroup === d.group}
                              disabled={isFull}
                              onClick={() => {
                                setDoctorGroup(d.group);
                                setError("");
                              }}
                              className={chip(doctorGroup === d.group, isFull)}
                            >
                              <span className="block text-sm font-bold text-text-primary">{d.label}</span>
                              <span className="mt-0.5 block text-xs text-text-secondary">{isFull ? "Fully booked on this date" : d.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    </>)}

                    <div className="space-y-2">
                      <div className="border-b border-[#1F7A63]/20 pb-1">
                        <label htmlFor="fullName" className={`${heading} block`}>
                          Name :
                        </label>
                      </div>
                      <input id="fullName" type="text" {...form.register("fullName")} className={fieldBox} placeholder="Enter your name" />
                      {form.formState.errors.fullName && <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.fullName.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="border-b border-[#1F7A63]/20 pb-1">
                        <label htmlFor="age" className={`${heading} block`}>
                          Age :
                        </label>
                      </div>
                      <input id="age" type="number" min={1} max={120} {...form.register("age")} className={fieldBox} placeholder="Enter your age" />
                      {form.formState.errors.age && <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.age.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="border-b border-[#1F7A63]/20 pb-1">
                        <label htmlFor="gender" className={`${heading} block`}>
                          Gender :
                        </label>
                      </div>
                      <select id="gender" defaultValue="" {...form.register("gender")} className={`${fieldBox} font-bold`}>
                        <option value="" disabled>
                          Select gender
                        </option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                      {form.formState.errors.gender && <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.gender.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="border-b border-[#1F7A63]/20 pb-1">
                        <label htmlFor="phone" className={`${heading} block`}>
                          Phone number :
                        </label>
                      </div>
                      <input id="phone" type="tel" inputMode="numeric" maxLength={10} {...form.register("phone")} className={fieldBox} placeholder="Enter your 10-digit mobile number" />
                      {form.formState.errors.phone && <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.phone.message}</p>}
                    </div>
                  </>
                )}

                {mode !== "reschedule" && turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setHumanToken} resetKey={humanReset} />}

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="mx-auto flex items-center justify-center gap-2 rounded-full border-2 border-[#1F7A63] bg-white text-[#1F7A63] hover:bg-[#1F7A63] hover:text-white font-bold px-10 py-4.5 transition-all uppercase text-xs tracking-widest leading-none shadow-[0_4px_16px_rgba(20,184,166,0.1)] select-none disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === "reschedule" ? "Rescheduling..." : "Booking..."}
                      </>
                    ) : mode === "reschedule" ? (
                      "Reschedule Appointment"
                    ) : (
                      "Book Appointment"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 3: confirmation */}
          {step === 3 && (
            <motion.div key="confirmation-step" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl border border-gray-100 bg-white p-8 sm:p-10 shadow-xl shadow-cyan-500/[0.04] text-center max-w-lg mx-auto">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-6">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                {mode === "reschedule" ? "Appointment Updated!" : booked?.status === "PENDING" ? "Request Received!" : "Appointment Confirmed!"}
              </h2>
              <p className="mt-2 text-sm text-text-secondary font-medium">
                {booked?.status === "PENDING"
                  ? messaging
                    ? "Your appointment is pending. You will get a WhatsApp message as soon as the clinic confirms it."
                    : "Your appointment is pending until the clinic confirms it."
                  : messaging
                    ? "A confirmation message is being sent to your WhatsApp number."
                    : "Please note your appointment ID below."}
              </p>

              <div className="mt-8 rounded-2xl bg-gray-50/70 border border-gray-100 p-6 text-left space-y-4">
                {booked && (
                  <div className="text-sm font-semibold text-text-primary">
                    <p>
                      Appointment ID: <span className="text-[#1F7A63]">{booked.id}</span>
                    </p>
                    {booked.name && <p className="mt-1">Name: {booked.name}</p>}
                    {booked.typeLabel && <p className="mt-1">Type: {booked.typeLabel}</p>}
                    {booked.doctorLabel && <p className="mt-1">Doctor: {booked.doctorLabel}</p>}
                  </div>
                )}
                <div className="flex items-center gap-3 text-text-primary text-sm font-semibold">
                  <Calendar className="h-4.5 w-4.5 text-[#1F7A63]" />
                  <span>{selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-3 text-text-primary text-sm font-semibold">
                  <Clock className="h-4.5 w-4.5 text-[#1F7A63]" />
                  <span>
                    {selectedSlot && formatTime12Hour(selectedSlot.startTime)} - {selectedSlot && formatTime12Hour(selectedSlot.endTime)}
                  </span>
                </div>
                {fullAddress(site) && (
                  <div className="flex items-start gap-3 text-text-primary text-sm font-semibold">
                    <MapPin className="h-4.5 w-4.5 text-[#1F7A63] mt-0.5 shrink-0" aria-hidden />
                    <span className="leading-relaxed">{fullAddress(site)}</span>
                  </div>
                )}
              </div>

              {(hasMapLink(site) || telHref(site)) && (
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {hasMapLink(site) && (
                    <a href={mapsUrl(site)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-xs font-bold text-text-primary bg-white hover:bg-gray-50 transition-colors uppercase tracking-wider">
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Google Maps
                    </a>
                  )}
                  {telHref(site) && (
                    <a href={telHref(site)!} className="flex items-center justify-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-xs font-bold text-text-primary bg-white hover:bg-gray-50 transition-colors uppercase tracking-wider">
                      <Phone className="h-4 w-4" aria-hidden />
                      Call Clinic
                    </a>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {mode !== "reschedule" && (
                  <button type="button" onClick={resetForAnother} className="rounded-full border-2 border-[#1F7A63] bg-white px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#1F7A63] hover:bg-[#1F7A63] hover:text-white transition-colors">
                    Book another appointment
                  </button>
                )}
                <Link href="/" className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-[#17604E] transition-colors">
                  Back to home
                </Link>
              </div>
              {mode !== "reschedule" && <p className="mt-2 text-xs text-text-secondary">For another person, use their own name and mobile number.</p>}

              {confirmationToken && !messaging && mode !== "reschedule" && (
                <p className="mt-8 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">Save the links below (bookmark this page): they are the only way to edit, cancel or reschedule your appointment online.</p>
              )}
              {confirmationToken && (
                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap justify-center gap-4 text-xs font-semibold">
                  <Link href={`/book/edit/${confirmationToken}`} className="text-teal-600 hover:underline">
                    Edit Details
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link href={`/book/cancel/${confirmationToken}`} className="text-danger hover:underline">
                    Cancel Appointment
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link href={`/book/reschedule/${confirmationToken}`} className="text-teal-600 hover:underline">
                    Reschedule Appointment
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
