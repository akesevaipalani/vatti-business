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
