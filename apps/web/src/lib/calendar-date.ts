export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function addDays(base: Date, amount: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return next;
}

export function toDateKey(date: Date) {
  const local = startOfDay(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string, hour = 12, minute = 0) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1, hour, minute, 0, 0);
}

export function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, diff));
}

export function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6));
}

export function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function isSameDateKey(a: string, b: string) {
  return a === b;
}

export function formatDayHeader(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatShortDay(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatLongDutchDate(date: Date) {
  const raw = date.toLocaleDateString("nl-BE", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return raw
    .split(" ")
    .map((part) => (/\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export function formatDutchMonthYear(date: Date) {
  const raw = date.toLocaleDateString("nl-BE", {
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatTimeNl(date: Date) {
  return date.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export function weekdayLabel(date: Date) {
  const index = (date.getDay() + 6) % 7;
  return WEEKDAY_LABELS[index];
}

export function monthCalendarCells(date: Date): Array<Date | null> {
  const monthStart = startOfMonth(date);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const leading = (monthStart.getDay() + 6) % 7;
  const cells: Array<Date | null> = [];

  for (let index = 0; index < leading; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(date.getFullYear(), date.getMonth(), day, 12, 0, 0, 0));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function agendaRangeForView(view: "DAY" | "WEEK" | "MONTH", currentDate: Date) {
  if (view === "DAY") {
    return { from: startOfDay(currentDate), to: endOfDay(currentDate) };
  }
  if (view === "WEEK") {
    return { from: startOfWeek(currentDate), to: endOfWeek(currentDate) };
  }
  return { from: startOfMonth(currentDate), to: endOfMonth(currentDate) };
}
