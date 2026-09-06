import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { findMusicTrackById, getActiveMusicSetting } from "@/db/queries/admin";
import { ACTIVE_MUSIC_TRACK_KEY } from "@/db/queries/public";
import { musicTracks, siteSettings } from "@/db/schema";
import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Permanently deletes one uploaded track: the R2 object, then the
 * `music_tracks` row.
 *
 * Deleting the ACTIVE track is allowed. It used to be refused with a 409
 * telling the admin to switch away first, which is a rule the admin has to
 * satisfy on the app's behalf for no reason they care about. Instead, if
 * the deleted track was the active one, the active setting is moved to
 * "none" in the same request — the card falls back to no music, which is
 * exactly what "the track is gone" should mean. The alternative, leaving
 * the setting pointing at a deleted id, would leave `getActiveMusicSrc`
 * handing guests a URL that 404s.
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
    const track = await findMusicTrackById(id);
    if (!track) {
      return jsonError(404, API_ERRORS.notFound, undefined, ADMIN_ERROR_CODES.notFound);
    }

    const wasActive = (await getActiveMusicSetting()) === id;

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

    if (wasActive) {
      // Point the setting at "none" rather than leaving it referencing a
      // row that no longer exists.
      const now = new Date();
      await db
        .insert(siteSettings)
        .values({
          key: ACTIVE_MUSIC_TRACK_KEY,
          value: "none",
          updatedAt: now,
          updatedBy: guard.session.adminUserId,
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: "none", updatedAt: now, updatedBy: guard.session.adminUserId },
        });
    }

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "music.delete",
      targetType: "music_track",
      targetId: id,
    });

    // The client uses this to move its own radio selection to "none"
    // without a round trip.
    return Response.json(
      { ok: true, fellBackToNone: wasActive },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    console.error("POST /api/admin/music/delete: failed", error);
    return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);
  }
}
