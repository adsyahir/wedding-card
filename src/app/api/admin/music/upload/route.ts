import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { getDb } from "@/db";
import { musicTracks } from "@/db/schema";
import { ADMIN_ERROR_CODES, API_ERRORS, jsonError } from "@/lib/api";
import { MAX_AUDIO_BYTES, sniffAudioType } from "@/lib/audio";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

// Small slack over MAX_AUDIO_BYTES for multipart boundary/header overhead
// on the upfront Content-Length check. The AUTHORITATIVE cap is the check
// on the actually-decoded bytes further down — a missing or lying
// Content-Length must not get past that one.
const CONTENT_LENGTH_SLACK_BYTES = 4096;

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
const CONTROL_CHARS_GLOBAL = /[\x00-\x1f\x7f]/g;

const labelSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine((v) => !CONTROL_CHARS.test(v), "Label contains invalid characters");

const DEFAULT_LABEL_FALLBACK = "Lagu tanpa nama";

/** Strips control characters and truncates — used for both the DB `filename` column and the default label. */
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
 * Accepts a single audio file upload, validates it by MAGIC BYTES (never by
 * the declared `Content-Type` or filename — both are attacker-controlled),
 * stores it in R2 under a server-generated key, and records it in
 * `music_tracks`.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError(400, API_ERRORS.invalidRequest, undefined, ADMIN_ERROR_CODES.invalidRequest);
  }

  const contentLengthHeader = request.headers.get("Content-Length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES + CONTENT_LENGTH_SLACK_BYTES) {
      return jsonError(413, API_ERRORS.payloadTooLarge, undefined, ADMIN_ERROR_CODES.payloadTooLarge);
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    console.error("POST /api/admin/music/upload: formData() failed", error);
    return jsonError(400, API_ERRORS.invalidRequest, undefined, ADMIN_ERROR_CODES.invalidRequest);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, API_ERRORS.invalidInput, undefined, ADMIN_ERROR_CODES.invalidInput);
  }

  // The declared MIME type and filename are read ONLY for display
  // purposes below — never for validation. `sniffAudioType` is the sole
  // authority on what this file actually is.
  const buffer = await file.arrayBuffer();

  // Second, authoritative size check: this runs on the actual decoded
  // bytes, so a missing or lying Content-Length header cannot bypass it.
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    return jsonError(413, API_ERRORS.payloadTooLarge, undefined, ADMIN_ERROR_CODES.payloadTooLarge);
  }

  const bytes = new Uint8Array(buffer);
  const mime = sniffAudioType(bytes);
  if (!mime) {
    return jsonError(400, API_ERRORS.unsupportedMediaType, undefined, ADMIN_ERROR_CODES.unsupportedMediaType);
  }

  const sanitizedFilename = sanitizeFilename(file.name ?? "");

  const labelField = form.get("label");
  let label: string;
  if (typeof labelField === "string" && labelField.trim().length > 0) {
    const parsedLabel = labelSchema.safeParse(labelField);
    if (!parsedLabel.success) {
      return jsonError(400, API_ERRORS.invalidInput, undefined, ADMIN_ERROR_CODES.invalidInput);
    }
    label = parsedLabel.data;
  } else {
    label = sanitizedFilename.slice(0, 60) || DEFAULT_LABEL_FALLBACK;
  }

  // Generated server-side — the client filename is discarded entirely for
  // storage purposes. It's kept in the DB `filename` column (sanitized,
  // above) for display only, never used to build a path.
  const r2Key = `music/${crypto.randomUUID()}`;

  const { env } = getCloudflareContext();
  const bucket = env.ASSETS_BUCKET;

  try {
    await bucket.put(r2Key, bytes, { httpMetadata: { contentType: mime } });
  } catch (error) {
    console.error("POST /api/admin/music/upload: R2 put failed", error);
    return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);
  }

  let insertedId: string;
  try {
    const db = getDb();
    const [row] = await db
      .insert(musicTracks)
      .values({
        label,
        source: "upload",
        r2Key,
        filename: sanitizedFilename || null,
        mime,
        sizeBytes: bytes.byteLength,
        uploadedAt: new Date(),
        uploadedBy: guard.session.adminUserId,
      })
      .returning({ id: musicTracks.id });

    if (!row) {
      throw new Error("insert returned no row");
    }
    insertedId = row.id;
  } catch (error) {
    // The R2 put already succeeded — if the D1 insert then fails, the
    // object would otherwise be orphaned forever (nothing references it,
    // nothing can ever clean it up). Delete it before returning the error.
    console.error(
      "POST /api/admin/music/upload: DB insert failed after R2 put, deleting the orphaned R2 object",
      error,
    );
    try {
      await bucket.delete(r2Key);
    } catch (cleanupError) {
      console.error(
        `POST /api/admin/music/upload: R2 cleanup for orphaned key=${r2Key} ALSO failed — manual cleanup needed`,
        cleanupError,
      );
    }
    return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);
  }

  await logAudit({
    adminUserId: guard.session.adminUserId,
    action: "music.upload",
    targetType: "music_track",
    targetId: insertedId,
  });

  return jsonSuccess({ id: insertedId });
}
