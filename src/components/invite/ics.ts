/**
 * Pure helpers for generating an RFC 5545 (.ics) calendar file client-side,
 * as a Blob download — no server round-trip needed for "Add to calendar".
 */

export type IcsEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  /** ISO 8601 datetime, e.g. from `wedding.date`. */
  startIso: string;
  /** ISO 8601 datetime, e.g. from `wedding.endTime`. */
  endIso: string;
};

/** Escapes `,` `;` `\` and newlines per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Formats an ISO datetime as a UTC `YYYYMMDDTHHMMSSZ` ICS timestamp. */
export function toIcsUtcDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Folds a single unfolded content line to at most 75 octets per physical
 * line per RFC 5545 §3.1, continuing with a single leading space. Splits are
 * counted in UTF-8 octets (not UTF-16 code units) and never inside a
 * multi-byte character.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < line.length) {
    let end = Math.min(line.length, start + limit);
    // Never split a UTF-16 surrogate pair, and never let a chunk's UTF-8
    // byte length exceed the limit (multi-byte chars can push it over even
    // when the char count doesn't).
    while (end > start && encoder.encode(line.slice(start, end)).length > limit) {
      end--;
    }
    if (end < line.length && end > start && isHighSurrogate(line.charCodeAt(end - 1))) {
      end--;
    }
    chunks.push(line.slice(start, end));
    start = end;
    limit = 74; // continuation lines start with a space, which counts toward the 75-octet cap
  }

  return chunks.join("\r\n ");
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** Builds a complete `.ics` file body (CRLF line endings, folded, escaped). */
export function buildIcs(event: IcsEvent): string {
  const dtstamp = toIcsUtcDate(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wedding Card//Invitation//MS",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsUtcDate(event.startIso)}`,
    `DTEND:${toIcsUtcDate(event.endIso)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
