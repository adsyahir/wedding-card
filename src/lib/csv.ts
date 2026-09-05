/**
 * Minimal RFC 4180 CSV encoder with a CSV-injection mitigation, used only by
 * the admin RSVP export (`src/app/api/admin/rsvp/export/route.ts`).
 *
 * Deliberately has NO `server-only` import — it's a pure string-formatting
 * function with no D1/Cloudflare dependency, and is exercised directly by
 * `src/lib/csv.test.ts`.
 */

/** Prepended to the file so Excel opens it as UTF-8 (Malay names, emoji). */
const BOM = "﻿";

/**
 * A guest-controlled cell (a name, a message) that starts with one of these
 * characters is interpreted by Excel/Sheets/Numbers as the start of a
 * formula when the CSV is opened. A guest named `=HYPERLINK(...)` or
 * `=cmd|'/c calc'!A1` could otherwise execute in the caterer's spreadsheet
 * the moment the export is opened. Tab and CR are included because some
 * spreadsheet parsers also treat a leading tab/carriage-return as an escape
 * into formula mode.
 */
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function needsInjectionGuard(cell: string): boolean {
  return cell.length > 0 && FORMULA_TRIGGER_CHARS.has(cell[0]);
}

/** RFC 4180 requires quoting whenever a cell contains a comma, quote, or newline. */
function needsRfc4180Quoting(cell: string): boolean {
  return /[",\n\r]/.test(cell);
}

function cellToString(value: string | number | null): string {
  if (value === null) return "";
  return String(value);
}

function formatCell(value: string | number | null): string {
  let cell = cellToString(value);

  if (needsInjectionGuard(cell)) {
    // A single leading quote forces every major spreadsheet application to
    // treat the rest of the cell as literal text instead of a formula.
    cell = `'${cell}`;
  }

  if (needsRfc4180Quoting(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }

  return cell;
}

/**
 * Encodes `rows` (with `headers` as the first row) as a CSV string: BOM
 * prefix, CRLF line endings, RFC 4180 quoting, and the CSV-injection
 * mitigation above applied to every cell (headers included, since an admin
 * could in principle configure a hostile header — cheap insurance).
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map((header) => formatCell(header)).join(",")];

  for (const row of rows) {
    lines.push(row.map((cell) => formatCell(cell)).join(","));
  }

  return BOM + lines.join("\r\n");
}
