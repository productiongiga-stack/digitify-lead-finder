const DEFAULT_TIMEZONE = "Europe/Brussels";

/** Wall-clock date+time in `timeZone` → UTC instant (matches server booking-utils). */
export function zonedDateTimeToUtc(dateKey: string, time: string, timeZone = DEFAULT_TIMEZONE) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const [hour, minute] = time.split(":").map((part) => Number(part));
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return new Date(`${dateKey}T${time}:00`);
  }

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const gotMs = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), 0);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = targetMs - gotMs;
    if (delta === 0) break;
    utcMs += delta;
  }

  return new Date(utcMs);
}

export function toBookingIso(dateKey: string, time: string, timeZone: string) {
  return zonedDateTimeToUtc(dateKey, time, timeZone).toISOString();
}
