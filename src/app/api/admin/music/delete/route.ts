import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { findMusicTrackById, getActiveMusicSetting } from "@/db/queries/admin";
import { musicTracks } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() });

// Fixed, non-interpolated message — same pattern as GENERIC_LOGIN_ERROR in
// src/app/api/admin/login/route.ts.
const ACTIVE_TRACK_CONFLICT_ERROR =
  "Trek ini sedang aktif. Tukar muzik dahulu sebelum memadam.";

/**
 * Permanently deletes one uploaded track: the R2 object, then the
 * `music_tracks` row. Refuses with 409 if the track is currently the
 * active one — deleting it out from under the invite would silently break
 * playback for every guest loading the page.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return jsonError(body.status, body.error);

  const parsed = bodySchema.safeParse(toRecord(body.data));
  if (!parsed.success) return jsonError(400, API_ERRORS.invalidInput);

  const { id } = parsed.data;

  try {
    const track = await findMusicTrackById(id);
    if (!track) {
      return jsonError(404, API_ERRORS.notFound);
    }

    const activeValue = await getActiveMusicSetting();
    if (activeValue === id) {
      return jsonError(409, ACTIVE_TRACK_CONFLICT_ERROR);
    }

    if (track.r2Key) {
      const { env } = getCloudflareContext();
      try {
        await env.ASSETS_BUCKET.delete(track.r2Key);
      } catch (error) {
        // A stale R2 object left behind is recoverable (cleaned up
        // manually later); a stale D1 row pointing at a deleted/missing
        // object is a broken link on the public page. Log loudly and
        // proceed with the D1 delete regardless.
        console.error(
          `POST /api/admin/music/delete: R2 delete failed for key=${track.r2Key}, proceeding with the D1 row delete anyway`,
          error,
        );
      }
    }

    const db = getDb();
    await db.delete(musicTracks).where(eq(musicTracks.id, id));

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "music.delete",
      targetType: "music_track",
      targetId: id,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/music/delete: failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
