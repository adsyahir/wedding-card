import { API_ERRORS, jsonError, jsonOk, readJsonBody } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";
import { saveWeddingConfig } from "@/lib/wedding-config";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

/**
 * Saves one slice of the admin-editable wedding config (whatever fields the
 * calling settings tab sends — see `weddingConfigDocSchema` in
 * `src/lib/wedding-config.ts`). Every top-level field is optional, so a tab
 * only ever needs to send the fields it actually owns; `saveWeddingConfig`
 * merges that over whatever else was already saved.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request, 64 * 1024);
  if (!body.ok) return jsonError(body.status, body.error);

  const result = await saveWeddingConfig(body.data, guard.session.adminUserId);
  if (!result.ok) {
    const hasFieldErrors = Object.keys(result.fieldErrors).length > 0;

    // Field-level errors are safe to return verbatim: they come from our
    // own Zod schema's fixed set of Malay-ish messages, never an
    // interpolated exception — see `flattenWeddingConfigErrors`. An empty
    // `fieldErrors` means the failure was a DB error, not a validation
    // one (`saveWeddingConfig` never throws) — report that generically.
    if (!hasFieldErrors) {
      return jsonError(500, API_ERRORS.serverError);
    }

    return new Response(
      JSON.stringify({ ok: false, error: API_ERRORS.invalidInput, fieldErrors: result.fieldErrors }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  await logAudit({
    adminUserId: guard.session.adminUserId,
    action: "wedding_config.save",
    targetType: "site_setting",
    targetId: "wedding_config",
  });

  return jsonOk();
}
