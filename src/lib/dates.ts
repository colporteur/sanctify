// Date helpers. All "effective dates" are calendar dates in the user's timezone,
// with the day rolling over at 3:00 AM local (a 1:30 AM log belongs to "yesterday").

export const DAY_ROLLOVER_HOUR = 3;

/** Parts of `now` in a given IANA timezone. */
function tzParts(now: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
  };
}

/** ISO date (YYYY-MM-DD) for a y/m/d triple. */
function iso(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d
    .toString()
    .padStart(2, "0")}`;
}

/** The "effective date" a moment belongs to, honoring the 3 AM rollover. */
export function effectiveDate(now: Date, timeZone: string): string {
  const p = tzParts(now, timeZone);
  let date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  if (p.hour < DAY_ROLLOVER_HOUR) {
    date = new Date(date.getTime() - 86400_000);
  }
  return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Day of week (0=Sun..6=Sat) for an ISO date string. */
export function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const toMs = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(b) - toMs(a)) / 86400_000);
}

export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400_000);
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.split("-")[2]);
}

export function monthOf(isoDate: string): number {
  return Number(isoDate.split("-")[1]);
}

/** Last day of the month containing isoDate. */
export function lastDayOfMonth(isoDate: string): number {
  const [y, m] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
