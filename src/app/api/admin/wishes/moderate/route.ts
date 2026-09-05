import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { findWishById } from "@/db/queries/admin";
import { wishes } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

// Exactly two values, never a caller-supplied arbitrary string — "pending"
// is deliberately excluded, moderating a wish means moving it OUT of the
// pending queue.
const bodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

/**
 * Approves or rejects one pending wish. Approving is what makes a wish
 * appear on the public ucapan wall (`getApprovedWishes` in
 * `src/db/queries/public.ts` only ever selects `status = 'approved'` rows).
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return jsonError(body.status, body.error);

  const parsed = bodySchema.safeParse(toRecord(body.data));
  if (!parsed.success) return jsonError(400, API_ERRORS.invalidInput);

  const { id, status } = parsed.data;

  try {
    // Looked up BEFORE the write — an id that doesn't exist gets a 404
    // instead of a silently-successful no-op UPDATE.
    const existing = await findWishById(id);
    if (!existing) {
      return jsonError(404, API_ERRORS.notFound);
    }

    const db = getDb();
    await db
      .update(wishes)
      .set({
        status,
        moderatedAt: new Date(),
        moderatedBy: guard.session.adminUserId,
      })
      .where(eq(wishes.id, id));

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: `wish.${status}`,
      targetType: "wish",
      targetId: id,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/wishes/moderate: failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
