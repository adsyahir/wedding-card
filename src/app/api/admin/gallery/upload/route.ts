import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { countGalleryImages, getMaxGallerySortOrder } from "@/db/queries/admin";
import { getDb } from "@/db";
import { galleryImages } from "@/db/schema";
import { API_ERRORS, jsonError } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";
import { MAX_GALLERY_IMAGES, MAX_IMAGE_BYTES, sniffImageType } from "@/lib/image";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

// Small slack over MAX_IMAGE_BYTES for multipart boundary/header overhead
// on the upfront Content-Length check. The AUTHORITATIVE cap is the check
// on the actually-decoded bytes further down — a missing or lying
// Content-Length must not get past that one.
const CONTENT_LENGTH_SLACK_BYTES = 4096;

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
const CONTROL_CHARS_GLOBAL = /[\x00-\x1f\x7f]/g;

const GALLERY_FULL_ERROR = "Galeri sudah penuh. Padam gambar sedia ada sebelum memuat naik lagi.";

const altSchema = z
  .string()
  .trim()
  .max(150)
  .refine((v) => !CONTROL_CHARS.test(v), "Kandungan mengandungi aksara tidak sah");

const DEFAULT_ALT_FALLBACK = "Gambar galeri";

/** Strips control characters and truncates — used for both the DB `filename` column and the default alt text. */
function sanitizeFilename(name: string): string {
  return name.replace(CONTROL_CHARS_GLOBAL, "").trim().slice(0, 120);
}

function jsonSuccess(body: Record<string, unknown>): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  return new Response(JSON.stringify({ ok: true, ...body }), { status: 200, headers });
}

/**
 * Accepts a single image upload, validates it by MAGIC BYTES (never by the
 * declared `Content-Type` or filename — both are attacker-controlled),
 * stores it in R2 under a server-generated key, and records it in
 * `gallery_images`. Mirrors `src/app/api/admin/music/upload/route.ts`
 * exactly.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError(400, API_ERRORS.invalidRequest);
  }

  const contentLengthHeader = request.headers.get("Content-Length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES + CONTENT_LENGTH_SLACK_BYTES) {
      return jsonError(413, API_ERRORS.payloadTooLarge);
    }
  }

  // Checked before we even parse the multipart body — no point decoding an
  // upload that can't be stored anyway.
  let currentCount: number;
  try {
    currentCount = await countGalleryImages();
  } catch (error) {
    console.error("POST /api/admin/gallery/upload: countGalleryImages failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
  if (currentCount >= MAX_GALLERY_IMAGES) {
    return jsonError(400, GALLERY_FULL_ERROR);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    console.error("POST /api/admin/gallery/upload: formData() failed", error);
    return jsonError(400, API_ERRORS.invalidRequest);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, API_ERRORS.invalidInput);
  }

  // The declared MIME type and filename are read ONLY for display purposes
  // below — never for validation. `sniffImageType` is the sole authority
  // on what this file actually is.
  const buffer = await file.arrayBuffer();

  // Second, authoritative size check: this runs on the actual decoded
  // bytes, so a missing or lying Content-Length header cannot bypass it.
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return jsonError(413, API_ERRORS.payloadTooLarge);
  }

  const bytes = new Uint8Array(buffer);
  const mime = sniffImageType(bytes);
  if (!mime) {
    return jsonError(400, API_ERRORS.unsupportedMediaType);
  }

  const sanitizedFilename = sanitizeFilename(file.name ?? "");

  const altField = form.get("alt");
  let alt: string;
  if (typeof altField === "string" && altField.trim().length > 0) {
    const parsedAlt = altSchema.safeParse(altField);
    if (!parsedAlt.success) {
      return jsonError(400, API_ERRORS.invalidInput);
    }
    alt = parsedAlt.data;
  } else {
    alt = sanitizedFilename.slice(0, 150) || DEFAULT_ALT_FALLBACK;
  }

  // Generated server-side — the client filename is discarded entirely for
  // storage purposes. It's kept in the DB `filename` column (sanitized,
  // above) for display only, never used to build a path.
  const r2Key = `gallery/${crypto.randomUUID()}`;

  const { env } = getCloudflareContext();
  const bucket = env.ASSETS_BUCKET;

  try {
    await bucket.put(r2Key, bytes, { httpMetadata: { contentType: mime } });
  } catch (error) {
    console.error("POST /api/admin/gallery/upload: R2 put failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }

  let insertedId: string;
  try {
    const maxOrder = await getMaxGallerySortOrder();
    const sortOrder = (maxOrder ?? -1) + 1;

    const db = getDb();
    const [row] = await db
      .insert(galleryImages)
      .values({
        r2Key,
        filename: sanitizedFilename || null,
        mime,
        sizeBytes: bytes.byteLength,
        alt,
        sortOrder,
        uploadedAt: new Date(),
        uploadedBy: guard.session.adminUserId,
      })
      .returning({ id: galleryImages.id });

    if (!row) {
      throw new Error("insert returned no row");
    }
    insertedId = row.id;
  } catch (error) {
    // The R2 put already succeeded — if the D1 insert then fails, the
    // object would otherwise be orphaned forever (nothing references it,
    // nothing can ever clean it up). Delete it before returning the error.
    console.error(
      "POST /api/admin/gallery/upload: DB insert failed after R2 put, deleting the orphaned R2 object",
      error,
    );
    try {
      await bucket.delete(r2Key);
    } catch (cleanupError) {
      console.error(
        `POST /api/admin/gallery/upload: R2 cleanup for orphaned key=${r2Key} ALSO failed — manual cleanup needed`,
        cleanupError,
      );
    }
    return jsonError(500, API_ERRORS.serverError);
  }

  await logAudit({
    adminUserId: guard.session.adminUserId,
    action: "gallery.upload",
    targetType: "gallery_image",
    targetId: insertedId,
  });

  return jsonSuccess({ id: insertedId });
}
