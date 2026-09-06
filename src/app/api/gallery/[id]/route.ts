import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { getGalleryImageForStream } from "@/db/queries/public";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached (this serves per-image data straight out of R2).
export const dynamic = "force-dynamic";

/**
 * The PUBLIC image stream for an uploaded gallery photo. Guests load this
 * with no session at all — it must be paranoid. Mirrors
 * `src/app/api/music/[id]/route.ts` exactly, minus Range support (not
 * needed for images — a plain 200 with `Content-Length` is fine).
 *
 * Only `GET` is exported. There is deliberately no POST/PUT/DELETE here:
 * this route can only ever read.
 *
 * SECURITY: the `id` in the URL is a DATABASE id, never an R2 storage
 * path. The actual R2 key is looked up from the `gallery_images` row and is
 * NEVER accepted from the request in any form — this is what stops a
 * traversal-shaped id (`../../etc/passwd`) from ever reaching R2: it's
 * rejected by the UUID check below long before any storage key is
 * involved.
 */

const idSchema = z.string().uuid();

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function emptyResponse(status: number, headers?: HeadersInit): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return emptyResponse(400);
  }

  let image: Awaited<ReturnType<typeof getGalleryImageForStream>>;
  try {
    image = await getGalleryImageForStream(parsedId.data);
  } catch (error) {
    console.error("GET /api/gallery/[id]: image lookup failed", error);
    return emptyResponse(500);
  }

  if (!image || !image.r2Key) {
    return emptyResponse(404);
  }

  // Hardcoded, restricted to exactly the three values this app ever
  // writes. Never echo the stored string straight into the header — if
  // it's anything else (which should never happen, but "should never
  // happen" is not a security argument on its own), degrade to a content
  // type no browser will ever interpret as HTML or script.
  const contentType = ALLOWED_CONTENT_TYPES.has(image.mime ?? "")
    ? (image.mime as "image/jpeg" | "image/png" | "image/webp")
    : "application/octet-stream";

  try {
    const { env } = getCloudflareContext();
    const bucket = env.ASSETS_BUCKET;

    const object = await bucket.get(image.r2Key);
    if (!object) {
      // The DB row exists but the R2 object doesn't — a broken link, not a
      // client error. Still a 404: there is genuinely nothing to serve.
      return emptyResponse(404);
    }

    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(object.size),
        ETag: object.httpEtag,
      },
    });
  } catch (error) {
    console.error("GET /api/gallery/[id]: R2 access failed", error);
    return emptyResponse(500);
  }
}
