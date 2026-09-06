/**
 * Malaysia-time date/time helpers for the admin settings form.
 *
 * The wedding config stores timestamps as ISO 8601 strings with an explicit
 * `+08:00` offset (e.g. `2026-11-01T11:00:00+08:00`), and separately stores
 * human display strings (`dayNameMs`, `displayDate`). Making the admin type
 * all of those by hand is both unpleasant and a correctness trap — nothing
 * stopped the ISO date and the display string drifting apart, so the card
 * could cheerfully claim "Ahad, 01 November 2026" for a Tuesday.
 *
 * These helpers let the form use native date/time pickers and DERIVE every
 * other field, so they cannot disagree. Pure and dependency-free — no
 * `server-only`, no Intl reliance for the arithmetic — so they run
 * identically on the server, in the browser, and under Vitest.
 */

/** Malaysia is UTC+8 year-round; the country observes no daylight saving. */
export const MY_UTC_OFFSET = "+08:00";

export const MALAY_DAYS = [
  "Ahad",
  "Isnin",
  "Selasa",
  "Rabu",
  "Khamis",
  "Jumaat",
  "Sabtu",
] as const;

export const MALAY_MONTHS = [
  "Januari",
  "Februari",
  "Mac",
  "April",
  "Mei",
  "Jun",
  "Julai",
  "Ogos",
  "September",
  "Oktober",
  "November",
  "Disember",
] as const;

export type DateTimeParts = { date: string; time: string };

const ISO_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Splits a stored ISO string into the `YYYY-MM-DD` and `HH:mm` values a
 * native `<input type="date">` / `<input type="time">` expects.
 *
 * Because every value this app writes carries the `+08:00` offset, the
 * literal date and time in the string ARE Malaysia local time, so they can
 * be read straight off without any timezone conversion. An unparseable
 * value yields empty strings rather than throwing — the form then simply
 * shows blank pickers instead of blowing up.
 */
export function isoToParts(iso: string | undefined | null): DateTimeParts {
  const match = ISO_LOCAL_RE.exec((iso ?? "").trim());
  if (!match) return { date: "", time: "" };
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}` };
}

/**
 * Builds a `+08:00` ISO string from picker values. Returns `""` when either
 * part is missing, so a half-filled form produces an obviously-invalid
 * value that the Zod schema rejects, rather than a plausible-looking wrong
 * timestamp.
 */
export function partsToIso(date: string, time: string, seconds = "00"): string {
  if (!DATE_RE.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  return `${date}T${time}:${seconds}${MY_UTC_OFFSET}`;
}

/**
 * Day-of-week for a `YYYY-MM-DD` calendar date, in Malay.
 *
 * Built from `Date.UTC` on the literal parts so the result depends only on
 * the calendar date itself — never on the timezone of whichever machine
 * (server, admin's laptop, CI) happens to evaluate it.
 */
export function malayDayName(date: string): string {
  const match = DATE_RE.exec(date);
  if (!match) return "";
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(d.getTime())) return "";
  return MALAY_DAYS[d.getUTCDay()];
}

/** `2026-11-01` -> `01 November 2026`. */
export function malayDisplayDate(date: string): string {
  const match = DATE_RE.exec(date);
  if (!match) return "";
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return "";
  return `${match[3]} ${MALAY_MONTHS[monthIndex]} ${match[1]}`;
}

/** `2026-11-01` + `11:00` -> `Ahad, 01 November 2026, 11:00 pagi`, for a preview line. */
export function malayFullPreview(date: string, time: string): string {
  const day = malayDayName(date);
  const display = malayDisplayDate(date);
  if (!day || !display) return "";
  return time ? `${day}, ${display}, ${formatMalayTime(time)}` : `${day}, ${display}`;
}

/** `14:30` -> `2:30 petang`. Malay day-parts, matching how the card reads. */
export function formatMalayTime(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return "";
  const hour24 = Number(match[1]);
  const minute = match[2];
  if (hour24 > 23) return "";
  const suffix =
    hour24 < 12 ? "pagi" : hour24 < 15 ? "tengah hari" : hour24 < 19 ? "petang" : "malam";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}.${minute} ${suffix}`;
}
