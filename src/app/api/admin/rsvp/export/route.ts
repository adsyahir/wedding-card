import { getAllRsvpsForExport } from "@/db/queries/admin";
import { API_ERRORS, jsonError } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached — a cached copy of the guest list would be a direct
// data leak.
export const dynamic = "force-dynamic";

const CSV_HEADERS = ["Nama", "Telefon", "Kehadiran", "Dewasa", "Kanak-Kanak", "Pesanan", "Tarikh"];

/**
 * Formats a timestamp as `DD/MM/YYYY HH:mm` in Malaysia time. The raw ISO
 * string is UTC and unreadable at a glance — this sheet gets opened by
 * family and by the caterer, not by a developer.
 */
function formatMyDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/**
 * Downloads the full (non-deleted) RSVP list as CSV.
 *
 * A GET, not a POST — `requireAdminApi` skips the CSRF-header check for
 * GET/HEAD (see its docstring), but STILL requires a valid session cookie,
 * which is all a same-origin `<a href>` download needs. The export is
 * audit-logged: knowing when the full guest list (names, phone numbers) was
 * downloaded matters as much as knowing who deleted a row.
 */
export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  try {
    const rows = await getAllRsvpsForExport();

    const csv = toCsv(
      CSV_HEADERS,
      rows.map((row) => [
        row.name,
        row.phone,
        row.attending ? "Hadir" : "Tidak Hadir",
        row.adults,
        row.children,
        row.message,
        formatMyDate(row.createdAt),
      ]),
    );

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "rsvp.export",
      targetType: "rsvp",
    });

    const today = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rsvp-${today}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/rsvp/export: failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
