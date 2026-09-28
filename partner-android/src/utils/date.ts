/**
 * IST (Asia/Kolkata) Authoritative Date Utility for Android Client
 * Eliminates UTC date shift bugs (e.g. new Date().toISOString().split("T")[0])
 */

const IST_TIMEZONE = "Asia/Kolkata";

const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns current date in IST as YYYY-MM-DD.
 */
export function getTodayIST(): string {
  return istDateFormatter.format(new Date());
}

/**
 * Converts any date into an IST YYYY-MM-DD string.
 */
export function toISTDateString(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";
  return istDateFormatter.format(d);
}

/**
 * Formats date as DD/MM/YYYY for UI display in IST.
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

/**
 * Parses any date string (YYYY-MM-DD), Date, or timestamp into an authoritative IST Date object.
 * Fixes UTC day-shift bugs when clients submit backdated or today dates (e.g. '2026-09-24').
 * Sets the time to midday (12:00:00) IST so the calendar date is invariant across all UTC/IST conversions.
 */
export function parseISTDate(dateInput?: Date | string | number | null): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return new Date();
    return dateInput;
  }
  const str = String(dateInput).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    // 12:00:00 IST = 06:30:00 UTC
    const middayUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0, 0) - IST_OFFSET_MS;
    return new Date(middayUtcMs);
  }
  const parsed = new Date(dateInput);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
