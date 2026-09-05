import { z } from "zod";

import { getDb } from "@/db";
import { findMusicTrackById } from "@/db/queries/admin";
import { ACTIVE_MUSIC_TRACK_KEY } from "@/db/queries/public";
import { siteSettings } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never statically
// optimized/cached.
export const dynamic = "force-dynamic";

// "none" (no music), "preset" (the bundled `wedding.presetMusicPath`), or
// an uploaded track's id — never any other caller-supplied string.
const bodySchema = z.object({
  value: z.union([z.literal("none"), z.literal("preset"), z.string().uuid()]),
});

/**
 * Sets which track `getActiveMusicSrc` (`src/db/queries/public.ts`)
 * resolves for the public invite page, by upserting the
 * `active_music_track` `site_settings` row.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return jsonError(body.status, body.error);

  const parsed = bodySchema.safeParse(toRecord(body.data));
  if (!parsed.success) return jsonError(400, API_ERRORS.invalidInput);

  const { value } = parsed.data;

  try {
    // If it's an uploaded-track id, verify the row actually exists first —
    // never write a dangling reference into site_settings. "preset" is
    // always allowed, even when `wedding.presetMusicPath` is null:
    // `getActiveMusicSrc` already resolves that safely to no music, and
    // the admin UI surfaces the "no file bundled" state explicitly instead
    // of silently failing here.
    if (value !== "none" && value !== "preset") {
      const track = await findMusicTrackById(value);
      if (!track) {
        return jsonError(404, API_ERRORS.notFound);
      }
    }

    const db = getDb();
    const now = new Date();
    await db
      .insert(siteSettings)
      .values({
        key: ACTIVE_MUSIC_TRACK_KEY,
        value,
        updatedAt: now,
        updatedBy: guard.session.adminUserId,
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value, updatedAt: now, updatedBy: guard.session.adminUserId },
      });

    await logAudit({
      adminUserId: guard.session.adminUserId,
      action: "music.select",
      targetType: "site_setting",
      targetId: ACTIVE_MUSIC_TRACK_KEY,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/music/select: failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
