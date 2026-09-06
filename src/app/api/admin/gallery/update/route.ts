import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { findGalleryImageById } from "@/db/queries/admin";
import { galleryImages } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const bodySchema = z.object({
  id: z.string().uuid(),
  alt: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .refine((v) => !CONTROL_CHARS.test(v), "Kandungan mengandungi aksara tidak sah"),
});

/** Updates the alt text of one gallery image. */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return jsonError(body.status, body.error);

  const parsed = bodySchema.safeParse(toRecord(body.data));
  if (!parsed.success) return jsonError(400, API_ERRORS.invalidInput);

  const { id, alt } = parsed.data;

  try {
    const image = await findGalleryImageById(id);
    if (!image) {
      return jsonError(404, API_ERRORS.notFound);
    }

    const db = getDb();
    await db.update(galleryImages).set({ alt }).where(eq(galleryImages.id, id));

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "gallery.update",
      targetType: "gallery_image",
      targetId: id,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/gallery/update: failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
