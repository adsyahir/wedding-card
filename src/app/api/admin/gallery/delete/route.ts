import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { findGalleryImageById } from "@/db/queries/admin";
import { galleryImages } from "@/db/schema";
import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Permanently deletes one gallery image: the R2 object, then the
 * `gallery_images` row. Mirrors `src/app/api/admin/music/delete/route.ts`.
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
    const image = await findGalleryImageById(id);
    if (!image) {
      return jsonError(404, API_ERRORS.notFound, undefined, ADMIN_ERROR_CODES.notFound);
    }

    if (image.r2Key) {
      const { env } = getCloudflareContext();
      try {
        await env.ASSETS_BUCKET.delete(image.r2Key);
      } catch (error) {
        // A stale R2 object left behind is recoverable (cleaned up
        // manually later); a stale D1 row pointing at a deleted/missing
        // object is a broken image on the public page. Log loudly and
        // proceed with the D1 delete regardless.
        console.error(
          `POST /api/admin/gallery/delete: R2 delete failed for key=${image.r2Key}, proceeding with the D1 row delete anyway`,
          error,
        );
      }
    }

    const db = getDb();
    await db.delete(galleryImages).where(eq(galleryImages.id, id));

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "gallery.delete",
      targetType: "gallery_image",
      targetId: id,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/gallery/delete: failed", error);
    return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);
  }
}
