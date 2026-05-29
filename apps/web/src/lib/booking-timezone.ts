const DEFAULT_TIMEZONE = "Europe/Brussels";

function readZonedPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const raw = parts.find((part) => part.type === type)?.value || "0";
  if (type === "hour" && raw === "24") return 0;
  return Number(raw);
}

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

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const gotMs = Date.UTC(
      readZonedPart(parts, "year"),
      readZonedPart(parts, "month") - 1,
      readZonedPart(parts, "day"),
      readZonedPart(parts, "hour"),
      readZonedPart(parts, "minute"),
      0,
    );
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = targetMs - gotMs;
    if (delta === 0) break;
    utcMs += delta;
  }

  return new Date(utcMs);
}

export function formatTimeInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = String(readZonedPart(parts, "hour")).padStart(2, "0");
  const minute = String(readZonedPart(parts, "minute")).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function toBookingIso(dateKey: string, time: string, timeZone: string) {
  return zonedDateTimeToUtc(dateKey, time, timeZone).toISOString();
}
