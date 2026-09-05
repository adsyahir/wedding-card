import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { getMusicTrackForStream } from "@/db/queries/public";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached (this serves per-track data straight out of R2).
export const dynamic = "force-dynamic";

/**
 * The PUBLIC audio stream for an uploaded background-music track. Guests
 * load this with no session at all — it must be paranoid.
 *
 * Only `GET` is exported. There is deliberately no POST/PUT/DELETE here:
 * this route can only ever read.
 *
 * SECURITY: the `id` in the URL is a DATABASE id, never an R2 storage
 * path. The actual R2 key is looked up from the `music_tracks` row and is
 * NEVER accepted from the request in any form — this is what stops a
 * traversal-shaped id (`../../etc/passwd`) from ever reaching R2: it's
 * rejected by the UUID check below long before any storage key is
 * involved.
 */

const idSchema = z.string().uuid();

const ALLOWED_CONTENT_TYPES = new Set(["audio/mpeg", "audio/mp4"]);

function emptyResponse(status: number, headers?: HeadersInit): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

type ParsedRange =
  | { kind: "none" }
  | { kind: "satisfiable"; start: number; end: number }
  | { kind: "unsatisfiable" };

/**
 * Parses a single `bytes=start-end` (or open-ended `bytes=start-`) Range
 * header against a known object size. A header that doesn't match this
 * shape at all is treated the same as no header (serve the full body) —
 * per the HTTP spec, a malformed Range header should be ignored rather
 * than rejected. A syntactically valid but out-of-bounds range (start at
 * or past the end of the object, or start > end) is reported as
 * unsatisfiable so the caller can reply 416.
 */
function parseRange(header: string | null, size: number): ParsedRange {
  if (!header) return { kind: "none" };

  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
  if (!match) return { kind: "none" };

  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Number(match[2]);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { kind: "unsatisfiable" };
  }

  return { kind: "satisfiable", start, end: Math.min(end, size - 1) };
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

  let track: Awaited<ReturnType<typeof getMusicTrackForStream>>;
  try {
    track = await getMusicTrackForStream(parsedId.data);
  } catch (error) {
    console.error("GET /api/music/[id]: track lookup failed", error);
    return emptyResponse(500);
  }

  if (!track || track.source !== "upload" || !track.r2Key) {
    return emptyResponse(404);
  }

  // Hardcoded, restricted to exactly the two values this app ever writes.
  // Never echo the stored string straight into the header — if it's
  // anything else (which should never happen, but "should never happen"
  // is not a security argument on its own), degrade to a content type no
  // browser will ever interpret as HTML or script.
  const contentType = ALLOWED_CONTENT_TYPES.has(track.mime ?? "")
    ? (track.mime as "audio/mpeg" | "audio/mp4")
    : "application/octet-stream";

  try {
    const { env } = getCloudflareContext();
    const bucket = env.ASSETS_BUCKET;

    const head = await bucket.head(track.r2Key);
    if (!head) {
      // The DB row exists but the R2 object doesn't — a broken link, not a
      // client error. Still a 404: there is genuinely nothing to serve.
      return emptyResponse(404);
    }

    const size = head.size;
    const etag = head.httpEtag;
    const range = parseRange(request.headers.get("Range"), size);

    const baseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      ETag: etag,
    };

    if (range.kind === "unsatisfiable") {
      return emptyResponse(416, { ...baseHeaders, "Content-Range": `bytes */${size}` });
    }

    if (range.kind === "satisfiable") {
      const { start, end } = range;
      const object = await bucket.get(track.r2Key, {
        range: { offset: start, length: end - start + 1 },
      });
      if (!object) {
        return emptyResponse(404);
      }

      return new Response(object.body, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }

    const object = await bucket.get(track.r2Key);
    if (!object) {
      return emptyResponse(404);
    }

    return new Response(object.body, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(size) },
    });
  } catch (error) {
    console.error("GET /api/music/[id]: R2 access failed", error);
    return emptyResponse(500);
  }
}
