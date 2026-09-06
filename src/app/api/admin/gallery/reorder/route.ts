import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { isValidGalleryReorder, listGalleryImageIds } from "@/db/queries/admin";
import { galleryImages } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";
import { MAX_GALLERY_IMAGES } from "@/lib/image";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_GALLERY_IMAGES),
});

const INVALID_REORDER_ERROR =
  "Senarai gambar tidak sepadan dengan galeri semasa. Sila muat semula halaman.";

/**
 * Persists a full reordering of the gallery: `ids` must be the FULL ordered
 * list, and must be exactly the same SET of ids currently in the table (no
 * additions, no omissions, no foreign ids) — validated by
 * `isValidGalleryReorder` before anything is written. This is what stops a
 * partial or foreign list corrupting the ordering.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return jsonError(body.status, body.error);

  const parsed = bodySchema.safeParse(toRecord(body.data));
  if (!parsed.success) return jsonError(400, API_ERRORS.invalidInput);

  const { ids } = parsed.data;

  try {
    const currentIds = await listGalleryImageIds();
    if (!isValidGalleryReorder(currentIds, ids)) {
      return jsonError(400, INVALID_REORDER_ERROR);
    }

    const db = getDb();
    const updates = ids.map((id, index) =>
      db.update(galleryImages).set({ sortOrder: index }).where(eq(galleryImages.id, id)),
    );
    // Applied as one atomic D1 batch — never a half-applied reorder.
    await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "gallery.reorder",
      targetType: "gallery_image",
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/gallery/reorder: failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
