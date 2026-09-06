import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { findWishById } from "@/db/queries/admin";
import { wishes } from "@/db/schema";
import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Permanently deletes one wish row. Unlike RSVPs, there's no soft-delete
 * story here: a wish is either in the moderation queue (`pending`) or it's
 * been decided (`approved`/`rejected`), and the UI only ever offers this
 * action for the latter two — enforced here too, not just client-side, so
 * a pending wish can't be silently removed from the moderation queue by a
 * direct API call.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return jsonError(body.status, body.error, undefined, ADMIN_ERROR_CODES.invalidRequest);

  const parsed = bodySchema.safeParse(toRecord(body.data));
  if (!parsed.success) return jsonError(400, API_ERRORS.invalidInput, undefined, ADMIN_ERROR_CODES.invalidInput);

  const { id } = parsed.data;

  try {
    const existing = await findWishById(id);
    if (!existing) {
      return jsonError(404, API_ERRORS.notFound, undefined, ADMIN_ERROR_CODES.notFound);
    }
    if (existing.status === "pending") {
      return jsonError(400, API_ERRORS.invalidRequest, undefined, ADMIN_ERROR_CODES.invalidRequest);
    }

    const db = getDb();
    await db.delete(wishes).where(eq(wishes.id, id));

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "wish.delete",
      targetType: "wish",
      targetId: id,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/wishes/delete: failed", error);
    return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);
  }
}
