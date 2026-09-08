import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, jsonOk } from "@/lib/api";
import { getAdminUsername } from "@/db/queries/admin";
import { canSendTestEmail } from "@/lib/admin-privileges";
import { logAudit, requireAdminApi } from "@/lib/auth";
import { sendMailjetEmail } from "@/lib/mailjet";
import { checkRateLimit } from "@/lib/rate-limit";
import { getWeddingConfig } from "@/lib/wedding-config";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const TEST_EMAIL_RATE_LIMIT = 5;
const TEST_EMAIL_RATE_WINDOW_SECONDS = 60 * 60; // 1 hour

/**
 * `POST /api/admin/notifications/test` — "Hantar e-mel ujian" button on the
 * Notifikasi settings panel. Sends one sample email to the currently
 * configured recipients, unthrottled by the 20/hour notification cap (that
 * throttle is specifically about guest-triggered volume, see
 * `src/lib/notify.ts`) but rate-limited on its own, more modest budget so
 * repeated clicking can't be used to hammer the Mailjet quota either.
 *
 * Distinguishes, in the response, between the failure modes an admin can
 * and can't fix from this screen:
 * - No recipients configured/saved yet → a validation-shaped 400, fixable
 *   right here.
 * - Mailjet secrets missing (`sendMailjetEmail` → `reason: "unconfigured"`)
 *   → this is NOT admin-fixable from the dashboard; the response says so
 *   explicitly (needs `wrangler secret put`).
 * - Mailjet itself rejects the request or the message (bad/unvalidated
 *   sender, invalid recipient, quota, ...) → reported as a Mailjet-side
 *   failure, but never the API key/secret. Note that a refused MESSAGE
 *   still comes back as HTTP 200; `sendMailjetEmail` catches that and
 *   reports `reason: "rejected"`.
 * - A network error/timeout reaching Mailjet → reported distinctly too.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  /*
   * Checked HERE, not only by hiding the button. The panel omits the
   * control for other accounts, but that is presentation — anyone holding
   * a valid session could still POST this path directly.
   */
  const username = await getAdminUsername(guard.session.adminUserId);
  if (!canSendTestEmail(username)) {
    return jsonError(
      403,
      "Hanya akaun admin utama boleh menghantar e-mel ujian.",
      undefined,
      "test_email_forbidden",
    );
  }

  const rateLimit = await checkRateLimit(
    `notify-test:${guard.session.adminUserId}`,
    TEST_EMAIL_RATE_LIMIT,
    TEST_EMAIL_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return jsonError(
      429,
      API_ERRORS.tooManyRequests,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
      ADMIN_ERROR_CODES.tooManyRequests,
    );
  }

  const config = await getWeddingConfig();
  const recipients = config.notifications.recipients;

  if (recipients.length === 0) {
    return jsonError(400, API_ERRORS.invalidInput, undefined, "no_recipients_configured");
  }

  const result = await sendMailjetEmail({
    to: recipients,
    subject: "Ujian e-mel notifikasi kad jemputan",
    textPart:
      "Ini adalah e-mel ujian daripada kad jemputan perkahwinan anda. Jika anda menerima e-mel ini, notifikasi berfungsi dengan baik.",
    htmlPart:
      "<p>Ini adalah e-mel ujian daripada kad jemputan perkahwinan anda. Jika anda menerima e-mel ini, notifikasi berfungsi dengan baik.</p>",
  });

  if (!result.ok) {
    console.error(`POST /api/admin/notifications/test: send failed (${result.reason})`, result.detail);

    if (result.reason === "unconfigured") {
      return jsonError(
        503,
        "Mailjet belum dikonfigurasikan pada pelayan (secrets hilang). Ini perlu ditetapkan dengan `wrangler secret put`, bukan dari skrin ini.",
        undefined,
        "mailjet_unconfigured",
      );
    }

    if (result.reason === "http_error" || result.reason === "rejected") {
      return jsonError(
        502,
        "Mailjet menolak permintaan (contohnya alamat penghantar belum disahkan). Semak dashboard Mailjet anda.",
        undefined,
        "mailjet_rejected",
      );
    }

    return jsonError(
      502,
      "Ralat rangkaian semasa menghubungi Mailjet. Sila cuba sebentar lagi.",
      undefined,
      "mailjet_network_error",
    );
  }

  await logAudit({
    adminUserId: guard.session.adminUserId,
    action: "notifications.test_send",
  });

  return jsonOk();
}
