/**
 * Central IST (Indian Standard Time - Asia/Kolkata) Authoritative Date Module
 * Ensures uniform date handling across Desktop, Web, Android, and Cloud Backends.
 * Prevents UTC day-shift bugs (e.g. new Date().toISOString().slice(0, 10)).
 */

const IST_TIMEZONE = "Asia/Kolkata";

const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the current date in IST formatted as YYYY-MM-DD.
 */
export function getTodayIST(): string {
  return istDateFormatter.format(new Date());
}

/**
 * Converts any Date object, ISO string, or timestamp into an IST YYYY-MM-DD string.
 */
export function toISTDateString(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";
  return istDateFormatter.format(d);
}

/**
 * Given a YYYY-MM-DD date string (or defaulting to today in IST),
 * returns the exact UTC start and end Date boundaries for that 24-hour IST business day.
 *
 * Example:
 * For '2026-09-25' IST:
 * start = 2026-09-24T18:30:00.000Z (00:00:00 IST)
 * end   = 2026-09-25T18:29:59.999Z (23:59:59.999 IST)
 */
export function getISTDayRange(dateStr?: string): { start: Date; end: Date; dateStr: string } {
  const targetDateStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getTodayIST();
  const [year, month, day] = targetDateStr.split("-").map(Number);

  // 00:00:00.000 IST is (UTC - 5h 30m)
  // Construct UTC timestamp corresponding to midnight IST:
  // Date.UTC(year, month - 1, day, 0, 0, 0) - (5.5 * 3600 * 1000)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MS;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
    dateStr: targetDateStr,
  };
}

/**
 * Compare two dates purely by their IST calendar day (YYYY-MM-DD).
 * Returns -1 if d1 < d2, 0 if d1 == d2, 1 if d1 > d2.
 */
export function compareISTDates(
  d1: Date | string | number,
  d2: Date | string | number
): number {
  const s1 = toISTDateString(d1);
  const s2 = toISTDateString(d2);
  if (s1 < s2) return -1;
  if (s1 > s2) return 1;
  return 0;
}

/**
 * Returns true if date is strictly today in IST.
 */
export function isTodayIST(d: Date | string | number): boolean {
  return toISTDateString(d) === getTodayIST();
}

/**
 * Returns true if date is strictly in the past (before today in IST).
 */
export function isPastDateIST(d: Date | string | number, referenceToday = getTodayIST()): boolean {
  const s = toISTDateString(d);
  return Boolean(s && s < referenceToday);
}

/**
 * Returns true if date is strictly in the future (after today in IST).
 */
export function isFutureDateIST(d: Date | string | number, referenceToday = getTodayIST()): boolean {
  const s = toISTDateString(d);
  return Boolean(s && s > referenceToday);
}

/**
 * Formats date as DD/MM/YYYY for UI presentation in IST.
 */
export function formatISTDisplay(dateInput: Date | string | number | null | undefined): string {
  const ymd = toISTDateString(dateInput);
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Formats date with time in IST: DD/MM/YYYY, hh:mm A
 */
export function formatISTDateTime(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return "-";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
