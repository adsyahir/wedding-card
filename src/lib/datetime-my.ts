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

/** Short Malay weekday names, Sunday-first — used by the Kalendar month grid. */
export const MALAY_DAYS_SHORT = ["Ahd", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"] as const;

/** Short Malay month names — used by the Kalendar month grid header. */
export const MALAY_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mac",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ogo",
  "Sep",
  "Okt",
  "Nov",
  "Dis",
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

/**
 * Hijri month names as they are written in Malaysia. Note these are the
 * Malay spellings used on JAKIM's Takwim (`Rabiulawal`, `Jamadilakhir`),
 * not the Arabic transliterations (`Rabi' al-Awwal`, `Jumada al-Thani`) —
 * the card is in Malay and the guests read the Malay forms.
 */
export const HIJRI_MONTHS_MS = [
  "Muharram",
  "Safar",
  "Rabiulawal",
  "Rabiulakhir",
  "Jamadilawal",
  "Jamadilakhir",
  "Rejab",
  "Syaaban",
  "Ramadan",
  "Syawal",
  "Zulkaedah",
  "Zulhijjah",
] as const;

/**
 * `2026-11-14` -> `4 Jamadilakhir 1448 H`.
 *
 * THIS IS AN APPROXIMATION, and deliberately only a starting value. It is
 * the tabular calendar, which fixes month lengths arithmetically, on the
 * astronomical epoch that Malaysia's Takwim reckons from. The Takwim
 * itself is set by the Penyimpan Mohor Besar from actual moon sighting, so
 * a given Gregorian date can still land a day away from what this returns.
 *
 * That is why the result is stored as an ordinary editable config string
 * rather than computed at render time: the family can correct it against
 * the official Takwim once, and the card then shows what they entered. A
 * religious date on a wedding invitation is not something to leave to an
 * algorithm's best guess.
 *
 * Pure integer arithmetic on the literal date parts, like the helpers
 * above, so it never depends on the evaluating machine's timezone.
 */
export function hijriDate(date: string): string {
  const match = DATE_RE.exec(date);
  if (!match) return "";
  const gy = Number(match[1]);
  const gm = Number(match[2]);
  const gd = Number(match[3]);
  if (gm < 1 || gm > 12) return "";

  // Gregorian -> Julian Day Number.
  const y = gm < 3 ? gy - 1 : gy;
  const m = gm < 3 ? gm + 12 : gm;
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jdn =
    Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + gd + b - 1524;

  // Julian Day Number -> tabular Hijri.
  // 1948439 = 18 July 622 CE, the ASTRONOMICAL Hijra epoch. The other
  // convention in common use ("civil"/Kuwaiti) puts it a day later at
  // 1948440, and every date it produces is then one lower. Malaysia's
  // Takwim follows the astronomical reckoning, so that is what the card
  // must use — with 1948440 this returned 3 Jamadilakhir for the wedding
  // where the Takwim says 4.
  let days = jdn - 1948439 + 10632;
  const cycles = Math.floor((days - 1) / 10631);
  days = days - 10631 * cycles + 354;
  const j =
    Math.floor((10985 - days) / 5316) * Math.floor((50 * days) / 17719) +
    Math.floor(days / 5670) * Math.floor((43 * days) / 15238);
  days =
    days -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const hm = Math.floor((24 * days) / 709);
  const hd = days - Math.floor((709 * hm) / 24);
  const hy = 30 * cycles + j - 30;

  if (hm < 1 || hm > 12) return "";
  return `${hd} ${HIJRI_MONTHS_MS[hm - 1]} ${hy} H`;
}
