"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { format, parseISO, isToday, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  MapPin,
  Calendar,
  Phone,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HOSPITAL } from "@/lib/constants";
import { patientDetailsSchema, type PatientDetailsInput } from "@/lib/validations";
import { formatTime12Hour, cn } from "@/lib/utils";
import {
  getAvailableDates,
  getAvailableSlots,
  createAppointment,
  createTreatmentBooking,
  getAppointmentByToken,
  getAppointmentTypes,
  getDoctorsForBooking,
} from "@/actions/appointment";
import type { AvailableSlot, PublicDoctor, PublicType, PublicTreatment } from "@/actions/appointment";

interface BookingWizardProps {
  initialToken?: string;
  mode?: "book" | "reschedule" | "treatment";
  rescheduleToken?: string;
  treatments?: PublicTreatment[];
  initialTreatmentId?: string;
}

export function BookingWizard({
  initialToken,
  mode = "book",
  rescheduleToken,
  treatments = [],
  initialTreatmentId = "",
}: BookingWizardProps) {
  const isTreatment = mode === "treatment";
  const [step, setStep] = useState(initialToken ? 3 : 1);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [confirmationToken, setConfirmationToken] = useState(initialToken || "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [types, setTypes] = useState<PublicType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [treatmentId, setTreatmentId] = useState(initialTreatmentId);
  const [booked, setBooked] = useState<{ id: string; status: string; typeName: string; doctorName: string; name: string } | null>(null);

  // Month navigation for the calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const form = useForm<PatientDetailsInput>({
    resolver: zodResolver(patientDetailsSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      age: undefined,
      gender: "MALE",
      patientType: "NEW",
    },
  });

  const loadDates = useCallback(async () => {
    setLoadingDates(true);
    const result = await getAvailableDates();
    if (result.success) {
      setDates(result.data);
    }
    setLoadingDates(false);
  }, []);

  const loadSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setError("");
    const result = await (isTreatment ? fetch(`/api/treatment-slots?date=${date}`).then((r) => r.json()).then((data) => ({ success: true as const, data: data.slots })) : getAvailableSlots(date, rescheduleToken));
    if (result.success) {
      setSlots(result.data);
      if (result.data.length === 0) {
        setError("No availability for this date. Please select another date.");
      }
    } else {
      setError(result.error);
      setSlots([]);
    }
    setLoadingSlots(false);
  }, [isTreatment, rescheduleToken]);

  useEffect(() => {
    const t = setTimeout(loadDates, 0);
    return () => clearTimeout(t);
  }, [loadDates]);

  useEffect(() => {
    if (!isTreatment) getAppointmentTypes()
      .then(setTypes)
      .catch(() => setError("Could not load appointment types. Please refresh the page."));
  }, []);

  useEffect(() => {
    if (!isTreatment) getDoctorsForBooking()
      .then(setDoctors)
      .catch(() => setError("Could not load the list of doctors. Please refresh the page."));
  }, [isTreatment]);

  useEffect(() => {
    if (initialToken) {
      getAppointmentByToken(initialToken).then((apt) => {
        if (apt) setConfirmationToken(apt.confirmationToken);
      }).catch(() => {});
    }
  }, [initialToken]);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    loadSlots(dateStr);
    setStep(2);
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
  };

  const handleDetailsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError("Please select a time slot first.");
      return;
    }
    if (mode === "reschedule") {
      handleConfirm();
      return;
    }
    if (isTreatment) {
      if (!treatmentId) {
        setError("Please select a treatment.");
        return;
      }
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const result = await createTreatmentBooking({
          fullName: String(fd.get("fullName") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          notes: String(fd.get("notes") ?? "").trim() || undefined,
          treatmentId,
          slotId: selectedSlot.id,
          date: selectedDate,
        });
        if (result.success) {
          setConfirmationToken(result.data.confirmationToken);
          setBooked({ id: result.data.appointmentId, status: result.data.status, typeName: treatments.find((t) => t.id === treatmentId)?.name ?? "", doctorName: "", name: String(fd.get("fullName") ?? "") });
          setStep(3);
        } else setError(result.error);
      });
      return;
    }
    form.handleSubmit(async () => {
      if (!typeId) {
        setError("Please select an appointment type.");
        return;
      }
      if (!doctorId) {
        setError("Please choose the doctor you want to consult.");
        return;
      }
      handleConfirm();
    })(e);
  };

  const resetForAnother = () => {
    form.reset({ fullName: "", phone: "", email: "", age: undefined, gender: "MALE", patientType: "NEW" });
    setTypeId("");
    setDoctorId("");
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
      const values = form.getValues();

      if (mode === "reschedule" && rescheduleToken) {
        const { rescheduleAppointment } = await import("@/actions/appointment");
        const result = await rescheduleAppointment({
          token: rescheduleToken,
          newSlotId: selectedSlot.id,
        });
        if (result.success) {
          setConfirmationToken(result.data.confirmationToken);
          setStep(3);
        } else {
          setError(result.error);
        }
        return;
      }

      const result = await createAppointment({
        ...values,
        typeId,
        doctorId,
        slotId: selectedSlot.id,
        date: selectedDate,
      });

      if (result.success) {
        setConfirmationToken(result.data.confirmationToken);
        setBooked({ id: result.data.appointmentId, status: result.data.status, typeName: types.find((t) => t.id === typeId)?.name ?? "", doctorName: doctors.find((x) => x.id === doctorId)?.name ?? "", name: values.fullName });
        setStep(3);
      } else {
        setError(result.error);
      }
    });
  };

  // Calendar logic helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      {error && (
        <div
          className="mb-6 mx-auto max-w-2xl rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mx-auto max-w-2xl">
        <AnimatePresence mode="wait">
          {/* Step 1: Notebook Calendar View */}
          {step === 1 && (
            <motion.div
              key="calendar-step"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Working hours display header */}
              <div className="flex items-center gap-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-2xl p-6 shadow-sm max-w-lg mx-auto">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#1F7A63]">
                  <Clock className="h-7 w-7" />
                </div>
                <div className="text-left">
                  <p className="font-heading font-bold text-text-primary text-base leading-snug">
                    Mon–Sat: 9 am – 12 pm & 5pm - 10 pm
                  </p>
                  <p className="text-sm font-semibold text-text-secondary mt-0.5">
                    Sun: Holiday
                  </p>
                </div>
              </div>

              {/* Notebook Calendar Card */}
              <div className="max-w-2xl mx-auto">
                {/* Spiral Ring Binder loops */}
                <div className="relative -mb-7 z-20 flex justify-between px-6">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center select-none shrink-0">
                      <div className="h-8 w-4 rounded-t-full border-[3px] border-black bg-transparent"></div>
                      <div className="h-3.5 w-3.5 rounded-full bg-black/90 -mt-1.5"></div>
                    </div>
                  ))}
                </div>

                {/* Notebook Sheet Content */}
                <div className="relative bg-white border border-gray-100 rounded-3xl pt-10 pb-8 px-6 sm:px-8 shadow-xl shadow-cyan-500/[0.04]">
                  {/* Month navigator */}
                  <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="p-2 rounded-full border border-gray-100 hover:bg-gray-50 transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4 text-text-secondary" />
                    </button>
                    <h2 className="font-heading font-bold text-text-primary text-lg tracking-wide uppercase">
                      {format(currentMonth, "MMMM yyyy")}
                    </h2>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="p-2 rounded-full border border-gray-100 hover:bg-gray-50 transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4 text-text-secondary" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  {loadingDates ? (
                    <div className="grid grid-cols-7 gap-2 text-center">
                      {Array.from({ length: 35 }).map((_, i) => (
                        <div key={i} className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-gray-50 animate-pulse mx-auto" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Weekdays */}
                      <div className="grid grid-cols-7 gap-2 text-center text-[10px] sm:text-xs font-bold text-[#1F7A63] uppercase tracking-wider select-none">
                        <span><span className="hidden sm:inline">Sunday</span><span className="sm:hidden">Su</span></span>
                        <span><span className="hidden sm:inline">Monday</span><span className="sm:hidden">Mo</span></span>
                        <span><span className="hidden sm:inline">Tuesday</span><span className="sm:hidden">Tu</span></span>
                        <span><span className="hidden sm:inline">Wednesday</span><span className="sm:hidden">We</span></span>
                        <span><span className="hidden sm:inline">Thursday</span><span className="sm:hidden">Th</span></span>
                        <span><span className="hidden sm:inline">Friday</span><span className="sm:hidden">Fr</span></span>
                        <span><span className="hidden sm:inline">Saturday</span><span className="sm:hidden">Sa</span></span>
                      </div>

                      {/* Month Days */}
                      <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center items-center justify-center">
                        {calendarCells.map((cell, idx) => {
                          if (!cell) {
                            return <div key={`empty-${idx}`} className="h-9 sm:h-11" />;
                          }

                          const dateStr = format(cell, "yyyy-MM-dd");
                          const isSun = cell.getDay() === 0;
                          const isTodayDate = isToday(cell);
                          const isBookable = dates.includes(dateStr);
                          
                          // All bookable days are available by default
                          const dayNum = cell.getDate();
                          const isFull = false;
                          const isAvailable = isBookable && !isSun;

                          let dayClass = "w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full text-sm sm:text-base font-bold mx-auto transition-all select-none ";
                          let buttonDisabled = true;

                          if (isSun) {
                            // Sunday -> Muted Purple
                            dayClass += "bg-[#5C658D] text-white cursor-not-allowed";
                          } else if (isTodayDate) {
                            // Today -> Teal Circle
                            dayClass += isBookable ? "bg-[#1F7A63] text-white hover:scale-105 cursor-pointer" : "bg-[#1F7A63]/60 text-white cursor-not-allowed";
                            buttonDisabled = !isBookable;
                          } else if (isFull) {
                            // Full -> Red Circle
                            dayClass += "bg-[#EF4444] text-white cursor-not-allowed";
                          } else if (isAvailable) {
                            // Available -> Plain number, clickable
                            dayClass += "text-text-primary hover:bg-teal-50 hover:text-teal-600 hover:scale-105 cursor-pointer";
                            buttonDisabled = false;
                          } else {
                            // Past / Unbookable
                            dayClass += "text-text-secondary/40 cursor-not-allowed";
                          }

                          return (
                            <button
                              key={`day-${dateStr}`}
                              type="button"
                              disabled={buttonDisabled}
                              onClick={() => handleDateSelect(dateStr)}
                              className={dayClass}
                            >
                              {dayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Calendar Legend */}
                  <div className="flex flex-wrap justify-center gap-6 mt-10 pt-6 border-t border-gray-100 text-xs font-bold text-text-secondary select-none">
                    <div className="flex items-center gap-2">
                      <span className="h-4.5 w-4.5 rounded-full bg-[#1F7A63] inline-block"></span>
                      <span>Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-4.5 w-4.5 rounded-full bg-[#EF4444] inline-block"></span>
                      <span>Full</span>
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

          {/* Step 2: Combined Time Slots & Details Page */}
          {step === 2 && (
            <motion.div
              key="details-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-cyan-500/[0.04] text-left max-w-2xl mx-auto"
            >
              {/* Back Button */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-[#1F7A63] hover:text-[#17604E] font-bold text-xs select-none transition-colors uppercase tracking-wider mb-8"
              >
                <ChevronLeft className="h-4 w-4" /> back
              </button>

              <form onSubmit={handleDetailsSubmit} className="space-y-8">
                {/* Selected Date Section */}
                <div className="space-y-2">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <h3 className="text-[#1F7A63] font-bold text-base uppercase tracking-wider">Date :</h3>
                  </div>
                  <p className="text-text-primary text-base font-bold">
                    {selectedDate && format(parseISO(selectedDate), "dd MMMM yyyy")}
                  </p>
                </div>

                {/* Time Slots Section */}
                <div className="space-y-4">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <h3 className="text-[#1F7A63] font-bold text-base uppercase tracking-wider">Time :</h3>
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {slots.map((slot) => {
                        const isSelected = selectedSlot?.id === slot.id;
                        // Mock slot capacity: 10:00am - 11:00am can be full (red dot) to match mockup screenshot
                        const formattedTime = formatTime12Hour(slot.startTime);
                        const isSlotFull = slot.available <= 0; // Available by default unless actually full

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={isSlotFull}
                            onClick={() => handleSlotSelect(slot)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-full border px-4 py-3.5 text-xs font-bold transition-all text-left w-full select-none",
                              isSlotFull
                                ? "border-gray-100 bg-gray-50/50 text-text-secondary/60 cursor-not-allowed"
                                : isSelected
                                  ? "border-teal-500 bg-teal-500 text-white shadow-sm"
                                  : "border-gray-200 bg-white text-text-primary hover:border-teal-400 hover:shadow-sm"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full shrink-0",
                                isSlotFull
                                  ? "bg-[#EF4444]"
                                  : isSelected
                                    ? "bg-white"
                                    : "bg-[#22C55E]"
                              )}
                            />
                            <span>
                          {formattedTime} - {formatTime12Hour(slot.endTime)}
                          {slot.sessionName && <span className="block text-[10px] font-semibold opacity-70">{slot.sessionName} session</span>}
                        </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Slots Legend */}
                  <div className="flex gap-6 text-xs font-bold text-text-secondary select-none justify-center mt-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]"></span> Full
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]"></span> Available
                    </span>
                  </div>
                </div>

                {mode !== "reschedule" && (
                <>
                {isTreatment && <div className="space-y-3">
                  <div className="border-b border-[#1F7A63]/20 pb-1"><h3 className="text-[#1F7A63] font-bold text-base uppercase tracking-wider">Treatment :</h3></div>
                  <select name="treatmentId" required value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm">
                    <option value="">Choose a treatment</option>
                    {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>}

                {!isTreatment && <>
                {/* Appointment type (required) */}
                <div className="space-y-3">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <h3 className="text-[#1F7A63] font-bold text-base uppercase tracking-wider">Appointment type :</h3>
                  </div>
                  {types.length === 0 ? (
                    <p className="text-sm text-text-secondary">Loading appointment types...</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Appointment type">
                      {types.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={typeId === t.id}
                          onClick={() => setTypeId(t.id)}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left transition-all",
                            typeId === t.id ? "border-teal-500 bg-teal-50 shadow-sm ring-2 ring-teal-500/20" : "border-gray-200 bg-white hover:border-teal-400"
                          )}
                        >
                          <span className="block text-sm font-bold text-text-primary">{t.name}</span>
                          {t.description && <span className="mt-0.5 block text-xs text-text-secondary">{t.description}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                </>}

                {!isTreatment && <> {/* Doctor to consult (required) */}
                <div className="space-y-3">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <h3 className="text-[#1F7A63] font-bold text-base uppercase tracking-wider">Doctor to consult :</h3>
                  </div>
                  {doctors.length === 0 ? (
                    <p className="text-sm text-text-secondary">Loading doctors...</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Doctor to consult">
                      {doctors.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          role="radio"
                          aria-checked={doctorId === doc.id}
                          onClick={() => setDoctorId(doc.id)}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left transition-all",
                            doctorId === doc.id ? "border-teal-500 bg-teal-50 shadow-sm ring-2 ring-teal-500/20" : "border-gray-200 bg-white hover:border-teal-400"
                          )}
                        >
                          <span className="block text-sm font-bold text-text-primary">{doc.name}</span>
                          <span className="mt-0.5 block text-xs text-text-secondary">{doc.designation}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                </>}

                {/* Form Fields: Name */}
                <div className="space-y-2">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <label htmlFor="fullName" className="text-[#1F7A63] font-bold text-base uppercase tracking-wider block">
                      Name :
                    </label>
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    {...form.register("fullName")}
                    className="w-full rounded-full border border-gray-200 px-6 py-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all shadow-[0_0_12px_rgba(20,184,166,0.04)] bg-white text-text-primary font-medium"
                    placeholder="Enter your name"
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.fullName.message}</p>
                  )}
                </div>

                {!isTreatment && <> {/* Form Fields: Age */}
                <div className="space-y-2">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <label htmlFor="age" className="text-[#1F7A63] font-bold text-base uppercase tracking-wider block">
                      Age :
                    </label>
                  </div>
                  <input
                    id="age"
                    type="number"
                    {...form.register("age")}
                    className="w-full rounded-full border border-gray-200 px-6 py-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all shadow-[0_0_12px_rgba(20,184,166,0.04)] bg-white text-text-primary font-medium"
                    placeholder="Enter your age"
                  />
                  {form.formState.errors.age && (
                    <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.age.message}</p>
                  )}
                </div>
                </>}

                {/* Form Fields: Gender */}
                <div className="space-y-2">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <label htmlFor="gender" className="text-[#1F7A63] font-bold text-base uppercase tracking-wider block">
                      Gender :
                    </label>
                  </div>
                  <select
                    id="gender"
                    {...form.register("gender")}
                    className="w-full rounded-full border border-gray-200 px-6 py-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all shadow-[0_0_12px_rgba(20,184,166,0.04)] bg-white text-text-primary font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%2523666%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_1.25rem_center] bg-no-repeat"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {form.formState.errors.gender && (
                    <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.gender.message}</p>
                  )}
                </div>

                {/* Form Fields: Contact number */}
                <div className="space-y-2">
                  <div className="border-b border-[#1F7A63]/20 pb-1">
                    <label htmlFor="phone" className="text-[#1F7A63] font-bold text-base uppercase tracking-wider block">
                      Contact number :
                    </label>
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    maxLength={10}
                    {...form.register("phone")}
                    className="w-full rounded-full border border-gray-200 px-6 py-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all shadow-[0_0_12px_rgba(20,184,166,0.04)] bg-white text-text-primary font-medium"
                    placeholder="Enter your 10-digit mobile number"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-danger font-semibold mt-1">{form.formState.errors.phone.message}</p>
                  )}
                </div>

                </>
                )}

                {/* Book Appointment button */}
                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="mx-auto flex items-center justify-center gap-2 rounded-full border-2 border-[#1F7A63] bg-white text-[#1F7A63] hover:bg-[#1F7A63] hover:text-white font-bold px-10 py-4.5 transition-all uppercase text-xs tracking-widest leading-none shadow-[0_4px_16px_rgba(20,184,166,0.1)] select-none disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      "Book Appointment"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 3: Success Confirmation View */}
          {step === 3 && (
            <motion.div
              key="confirmation-step"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border border-gray-100 bg-white p-8 sm:p-10 shadow-xl shadow-cyan-500/[0.04] text-center max-w-lg mx-auto"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-6">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                {mode === "reschedule" ? "Appointment Updated!" : booked?.status === "PENDING" ? "Request Received!" : "Appointment Confirmed!"}
              </h2>
              <p className="mt-2 text-sm text-text-secondary font-medium">
                {booked?.status === "PENDING"
                  ? "Your appointment is pending. You will get a notification here and on WhatsApp as soon as the clinic confirms it."
                  : "A confirmation details notification is being sent to WhatsApp"}
              </p>

              <div className="mt-8 rounded-2xl bg-gray-50/70 border border-gray-100 p-6 text-left space-y-4">
                {booked && (
                  <div className="text-sm font-semibold text-text-primary">
                    <p>Appointment ID: <span className="text-[#1F7A63]">{booked.id}</span></p>
                    {booked.name && <p className="mt-1">Name: {booked.name}</p>}
                    {booked.typeName && <p className="mt-1">Type: {booked.typeName}</p>}
                    {booked.doctorName && <p className="mt-1">Doctor: {booked.doctorName}</p>}
                  </div>
                )}
                <div className="flex items-center gap-3 text-text-primary text-sm font-semibold">
                  <Calendar className="h-4.5 w-4.5 text-[#1F7A63]" />
                  <span>
                    {selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-text-primary text-sm font-semibold">
                  <Clock className="h-4.5 w-4.5 text-[#1F7A63]" />
                  <span>
                    {selectedSlot && formatTime12Hour(selectedSlot.startTime)} - {selectedSlot && formatTime12Hour(selectedSlot.endTime)}
                  </span>
                </div>
                <div className="flex items-start gap-3 text-text-primary text-sm font-semibold">
                  <MapPin className="h-4.5 w-4.5 text-[#1F7A63] mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{HOSPITAL.address.full}</span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href={HOSPITAL.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-xs font-bold text-text-primary bg-white hover:bg-gray-50 transition-colors uppercase tracking-wider"
                >
                  <ExternalLink className="h-4 w-4" />
                  Google Maps
                </a>
                <a
                  href={`tel:${HOSPITAL.phone}`}
                  className="flex items-center justify-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-xs font-bold text-text-primary bg-white hover:bg-gray-50 transition-colors uppercase tracking-wider"
                >
                  <Phone className="h-4 w-4" />
                  Call Clinic
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {mode !== "reschedule" && (
                  <button
                    type="button"
                    onClick={resetForAnother}
                    className="rounded-full border-2 border-[#1F7A63] bg-white px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#1F7A63] hover:bg-[#1F7A63] hover:text-white transition-colors"
                  >
                    Book another appointment
                  </button>
                )}
                <Link href="/" className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-[#17604E] transition-colors">
                  Back to home
                </Link>
              </div>
              {mode !== "reschedule" && (
                <p className="mt-2 text-xs text-text-secondary">For another person, use their own name and mobile number.</p>
              )}

              {confirmationToken && (
                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap justify-center gap-4 text-xs font-semibold">
                  <Link href="/my-appointments" className="text-text-primary hover:underline">
                    My Appointments
                  </Link>
                  <span className="text-gray-300">|</span>
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
