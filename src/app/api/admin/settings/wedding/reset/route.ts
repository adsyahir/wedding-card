import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, jsonOk } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";
import { resetWeddingConfig } from "@/lib/wedding-config";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

/**
 * "Kembalikan ke asal" — deletes the `wedding_config` site_settings row
 * entirely, so the public card (and the settings page) fall back to the
 * file defaults in `src/config/wedding.ts`. Always recoverable without
 * touching the database by hand.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const ok = await resetWeddingConfig();
  if (!ok) return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);

  await logAudit({
    adminUserId: guard.session.adminUserId,
    action: "wedding_config.reset",
    targetType: "site_setting",
    targetId: "wedding_config",
  });

  return jsonOk();
}
