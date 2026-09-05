import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

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
const PRESET_MUSIC_PATH = "/music/preset-1.mp3";

/**
 * Whether a static asset shipped under `public/` actually exists in the
 * deployed asset bundle. Uses the Cloudflare `ASSETS` Fetcher binding (a HEAD
 * request never touches application logic, just the static asset router) so
 * this works in the real Workers runtime; if that binding isn't available
 * (e.g. local `next dev`) or the check fails for any reason, we conservatively
 * assume the file is missing rather than ever risk linking to a 404.
 */
async function assetExists(pathname: string): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    if (!env.ASSETS) return false;

    const response = await env.ASSETS.fetch(new Request(`https://assets.local${pathname}`, { method: "HEAD" }));
    return response.ok;
  } catch (error) {
    console.error(`assetExists(${pathname}) failed, assuming missing`, error);
    return false;
  }
}

/**
 * Resolves the background music `<audio>` source, or `null` if music should
 * be disabled entirely (no player/toggle rendered).
 *
 * - Explicit `"none"` in `site_settings` -> null.
 * - An uploaded track id -> `/api/music/<id>` (that route is built in a
 *   later phase; only the URL shape is decided here). The raw R2 key is
 *   never returned to the client.
 * - Otherwise -> the bundled preset path, but only if that file actually
 *   exists in the deployed asset bundle.
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

    return (await assetExists(PRESET_MUSIC_PATH)) ? PRESET_MUSIC_PATH : null;
  } catch (error) {
    console.error("getActiveMusicSrc failed, falling back to no music", error);
    return null;
  }
}
