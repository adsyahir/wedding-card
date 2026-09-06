import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { findActiveRsvpById } from "@/db/queries/admin";
import { rsvps } from "@/db/schema";
import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Soft-deletes one RSVP row (`deletedAt = now`) — never a hard delete. The
 * row still exists in D1 afterwards; it just stops appearing in the admin
 * list and the public attendance tally.
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
    // Looked up BEFORE the write: an id that doesn't exist (or already
    // belongs to a deleted row) gets a 404 instead of a silently-successful
    // no-op UPDATE.
    const existing = await findActiveRsvpById(id);
    if (!existing) {
      return jsonError(404, API_ERRORS.notFound, undefined, ADMIN_ERROR_CODES.notFound);
    }

    const db = getDb();
    await db.update(rsvps).set({ deletedAt: new Date() }).where(eq(rsvps.id, id));

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "rsvp.delete",
      targetType: "rsvp",
      targetId: id,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/rsvp/delete: failed", error);
    return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);
  }
}
