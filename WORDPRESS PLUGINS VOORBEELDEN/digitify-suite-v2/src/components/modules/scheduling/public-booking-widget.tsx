"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Client-side booking widget for public booking pages.
 *
 * Handles:
 * 1. Calendar month navigation
 * 2. Available slot calculation from availability rules + existing bookings
 * 3. Slot selection
 * 4. Contact form
 * 5. Submission via server action
 */

interface Availability {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
}

interface ExistingBooking {
  startAt: string;
  endAt: string;
}

interface Props {
  bookingTypeId: string;
  duration: number;
  bufferBefore: number;
  bufferAfter: number;
  brandColor: string;
  availability: Availability[];
  existingBookings: ExistingBooking[];
}

export function PublicBookingWidget({
  bookingTypeId,
  duration,
  bufferBefore,
  bufferAfter,
  brandColor,
  availability,
  existingBookings,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"calendar" | "form" | "confirmed">("calendar");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Offset to start on Monday (ISO)
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentMonth]);

  // Available days (based on availability rules)
  const availableDayNumbers = useMemo(
    () => new Set(availability.map((a) => a.dayOfWeek)),
    [availability]
  );

  const isDateAvailable = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    return availableDayNumbers.has(date.getDay());
  };

  // Generate time slots for selected date
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];

    const dayOfWeek = selectedDate.getDay();
    const dayRules = availability.filter((a) => a.dayOfWeek === dayOfWeek);
    const slots: string[] = [];

    for (const rule of dayRules) {
      const [startH, startM] = rule.startTime.split(":").map(Number);
      const [endH, endM] = rule.endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m + duration <= endMinutes; m += 30) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

        // Check for conflicts with existing bookings
        const slotStart = new Date(selectedDate);
        slotStart.setHours(h, min, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        const hasConflict = existingBookings.some((b) => {
          const bStart = new Date(b.startAt);
          const bEnd = new Date(b.endAt);
          return slotStart < bEnd && slotEnd > bStart;
        });

        if (!hasConflict) {
          slots.push(timeStr);
        }
      }
    }

    return slots;
  }, [selectedDate, availability, duration, existingBookings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) return;

    setSubmitting(true);
    try {
      // TODO: Call server action to create booking
      // await createPublicBooking({ bookingTypeId, date, time, name, email, phone, notes })
      setStep("confirmed");
    } catch {
      alert("Er is een fout opgetreden. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  };

  const monthNames = [
    "Januari", "Februari", "Maart", "April", "Mei", "Juni",
    "Juli", "Augustus", "September", "Oktober", "November", "December",
  ];

  if (step === "confirmed") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Afspraak bevestigd!</h2>
        <p className="mt-2 text-sm text-gray-500">
          Je ontvangt een bevestiging per e-mail op {email}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Calendar */}
      <div className="border-b border-gray-100 p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Selecteer een datum
        </h2>

        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
              )
            }
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          </button>
          <span className="text-sm font-medium text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
              )
            }
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Day headers */}
        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-gray-400">
          {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d) => (
            <span key={d} className="py-1">{d}</span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;

            const available = isDateAvailable(date);
            const isSelected =
              selectedDate?.toDateString() === date.toDateString();
            const isToday = new Date().toDateString() === date.toDateString();

            return (
              <button
                key={date.toISOString()}
                disabled={!available}
                onClick={() => {
                  setSelectedDate(date);
                  setSelectedSlot(null);
                }}
                className={cn(
                  "flex h-10 items-center justify-center rounded-lg text-sm transition-colors",
                  available
                    ? "hover:bg-gray-100 cursor-pointer"
                    : "text-gray-300 cursor-not-allowed",
                  isSelected && "text-white font-semibold",
                  isToday && !isSelected && "font-semibold",
                )}
                style={isSelected ? { backgroundColor: brandColor } : undefined}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="border-b border-gray-100 p-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Beschikbare tijden
          </h2>
          {timeSlots.length === 0 ? (
            <p className="text-sm text-gray-400">Geen beschikbare tijden op deze dag.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep("form");
                  }}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    selectedSlot === slot
                      ? "text-white border-transparent"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  )}
                  style={
                    selectedSlot === slot
                      ? { backgroundColor: brandColor }
                      : undefined
                  }
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact form */}
      {step === "form" && selectedSlot && (
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Uw gegevens
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Naam *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                placeholder="Uw naam"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                E-mail *
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                placeholder="email@voorbeeld.be"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Telefoon
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              placeholder="+32 470 12 34 56"
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Opmerkingen
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              placeholder="Eventuele opmerkingen..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Bezig met boeken..." : "Afspraak boeken"}
          </button>
        </form>
      )}
    </div>
  );
}
