import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import { wedding } from "@/config/wedding";
import { getDb } from "@/db";
import { rsvps, siteSettings, wishes } from "@/db/schema";

/**
 * Read-only queries for data rendered on the public invitation page.
 *
 * These are called from a server component (`src/app/page.tsx`), never from
 * a route handler and never from the client — there are deliberately no
 * public GET API routes in this app.
 *
 * Every function here MUST tolerate the D1 binding being absent, or any
 * query throwing (e.g. `next dev` without a local DB, or a first deploy
 * before migrations have run): catch, log server-side, and fall back to an
 * empty/zeroed result so the card still renders.
 */

export type PublicWish = {
  name: string;
  message: string;
  createdAt: string;
};

/** Narrows a raw selected row down to exactly the fields safe to expose publicly. */
function toPublicWish(row: { name: string; message: string; createdAt: Date }): PublicWish {
  return {
    name: row.name,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getApprovedWishes(limit = 100): Promise<PublicWish[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({ name: wishes.name, message: wishes.message, createdAt: wishes.createdAt })
      .from(wishes)
      .where(eq(wishes.status, "approved"))
      .orderBy(desc(wishes.createdAt))
      .limit(limit);

    return rows.map(toPublicWish);
  } catch (error) {
    console.error("getApprovedWishes failed, falling back to empty list", error);
    return [];
  }
}

export type AttendanceCounts = {
  hadir: number;
  tidakHadir: number;
};

export async function getAttendanceCounts(): Promise<AttendanceCounts> {
  try {
    const db = getDb();

    const [hadirRow] = await db
      .select({ n: count() })
      .from(rsvps)
      .where(and(isNull(rsvps.deletedAt), eq(rsvps.attending, true)));
    const [tidakHadirRow] = await db
      .select({ n: count() })
      .from(rsvps)
      .where(and(isNull(rsvps.deletedAt), eq(rsvps.attending, false)));

    return { hadir: hadirRow?.n ?? 0, tidakHadir: tidakHadirRow?.n ?? 0 };
  } catch (error) {
    console.error("getAttendanceCounts failed, falling back to zeroes", error);
    return { hadir: 0, tidakHadir: 0 };
  }
}

const ACTIVE_MUSIC_TRACK_KEY = "active_music_track";
// The bundled preset is DECLARED in the wedding config rather than probed
// for at runtime: the ASSETS binding points at the built asset bundle, so a
// probe can never succeed under `next dev` and would silently disable music
// in local development while appearing to work in production.

/**
 * Resolves the background music `<audio>` source, or `null` if music should
 * be disabled entirely (no player/toggle rendered).
 *
 * - Explicit `"none"` in `site_settings` -> null.
 * - An uploaded track id -> `/api/music/<id>` (that route is built in a
 *   later phase; only the URL shape is decided here). The raw R2 key is
 *   never returned to the client.
 * - Otherwise -> `wedding.presetMusicPath` (null when no preset is bundled).
 */
export async function getActiveMusicSrc(): Promise<string | null> {
  try {
    const db = getDb();
    const row = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, ACTIVE_MUSIC_TRACK_KEY))
      .limit(1);

    const value = row[0]?.value;

    if (value === "none") return null;
    if (value && value !== "preset") return `/api/music/${value}`;

    return wedding.presetMusicPath;
  } catch (error) {
    console.error("getActiveMusicSrc failed, falling back to no music", error);
    return null;
  }
}
