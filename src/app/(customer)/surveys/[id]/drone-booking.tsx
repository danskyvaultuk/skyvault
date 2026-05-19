"use client";

import { useState } from "react";

const TIME_SLOTS = ["9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM"];
const DEPOSIT = 50;

function buildCalendar(dates: Date[]): (Date | null)[][] {
  const weeks: (Date | null)[][] = [];
  const firstDay = dates[0].getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  let week: (Date | null)[] = Array(mondayOffset).fill(null);

  for (const date of dates) {
    week.push(date);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function getAvailableDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function DroneBookingPanel({ surveyId }: { surveyId: string }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dates = getAvailableDates();
  const weeks = buildCalendar(dates);

  async function handlePay() {
    if (!selectedDate || !selectedTime) return;
    setLoading(true);
    setError("");

    const dt = new Date(selectedDate);
    const [timePart, period] = selectedTime.split(" ");
    let hour = parseInt(timePart.split(":")[0]);
    if (period === "PM" && hour !== 12) hour += 12;
    dt.setHours(hour, 0, 0, 0);

    const res = await fetch("/api/stripe/drone-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId, scheduledAt: dt.toISOString() }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border rounded-xl p-6 mb-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="text-2xl">🚁</span>
        <div>
          <h2 className="font-semibold text-gray-900">Book your drone survey</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Choose a preferred date and time. A £{DEPOSIT} deposit is required to confirm your booking.
          </p>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="mb-5 space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((date, di) => {
              if (!date) return <div key={di} />;
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isFirstOfMonth = date.getDate() === 1;
              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                  className={`h-10 rounded-lg text-sm flex flex-col items-center justify-center transition leading-none ${
                    isSelected
                      ? "bg-blue-600 text-white font-semibold"
                      : "hover:bg-blue-50 text-gray-700"
                  }`}
                >
                  <span>{date.getDate()}</span>
                  {isFirstOfMonth && (
                    <span className={`text-[9px] ${isSelected ? "text-blue-200" : "text-gray-400"}`}>
                      {date.toLocaleString("default", { month: "short" })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Time on{" "}
            {selectedDate.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                className={`py-2 rounded-lg text-sm font-medium border transition ${
                  selectedTime === slot
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-300 text-gray-700"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <button
        onClick={handlePay}
        disabled={!selectedDate || !selectedTime || loading}
        className="w-full bg-blue-700 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? "Redirecting to payment…"
          : selectedDate && selectedTime
          ? `Pay £${DEPOSIT} deposit to confirm →`
          : "Select a date and time to continue"}
      </button>
    </div>
  );
}
