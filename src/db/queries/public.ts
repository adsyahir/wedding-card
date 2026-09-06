import "server-only";

import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { wedding } from "@/config/wedding";
import { getDb } from "@/db";
import { galleryImages, musicTracks, rsvps, siteSettings, wishes } from "@/db/schema";

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

// Exported so `src/db/queries/admin.ts` (the admin settings page/routes)
// reads and writes the exact same `site_settings` row key — never
// duplicate this literal elsewhere.
export const ACTIVE_MUSIC_TRACK_KEY = "active_music_track";
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

export type MusicTrackForStream = {
  source: "preset" | "upload";
  r2Key: string | null;
  mime: string | null;
};

/**
 * Looked up by the public `/api/music/[id]` streaming route
 * (`src/app/api/music/[id]/route.ts`) to resolve an id to its R2 key and
 * stored mime type.
 *
 * Unlike every other function in this file, this one deliberately does NOT
 * swallow errors into a safe fallback: the streaming route needs to tell
 * "id not found" (404) apart from "the database is unreachable" (500),
 * which collapsing every failure into `null` would make impossible. Only
 * page-rendering queries in this file get the "degrade to empty" treatment
 * — an API route is expected to return real status codes.
 */
export async function getMusicTrackForStream(id: string): Promise<MusicTrackForStream | null> {
  const db = getDb();
  const [row] = await db
    .select({ source: musicTracks.source, r2Key: musicTracks.r2Key, mime: musicTracks.mime })
    .from(musicTracks)
    .where(eq(musicTracks.id, id))
    .limit(1);

  return row ?? null;
}

export type PublicGalleryItem = {
  src: string;
  alt: string;
};

/** Narrows a raw selected row down to the public gallery shape (`/api/gallery/<id>` URL, never the R2 key). */
function toPublicGalleryItem(row: { id: string; alt: string }): PublicGalleryItem {
  return { src: `/api/gallery/${row.id}`, alt: row.alt };
}

/**
 * Resolves the gallery images rendered on the public invite (`Galeri`
 * component): admin-uploaded photos, ordered by `sortOrder`, mapped to
 * `{ src: "/api/gallery/<id>", alt }`. Falls back to `wedding.gallery`
 * (the bundled placeholder SVGs) from the config file on any failure OR
 * when the table is empty — so a fresh install still looks right before
 * any admin has uploaded a photo.
 */
export async function getGalleryImages(): Promise<PublicGalleryItem[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({ id: galleryImages.id, alt: galleryImages.alt })
      .from(galleryImages)
      .orderBy(asc(galleryImages.sortOrder));

    if (rows.length === 0) return wedding.gallery;

    return rows.map(toPublicGalleryItem);
  } catch (error) {
    console.error("getGalleryImages failed, falling back to the file config gallery", error);
    return wedding.gallery;
  }
}

export type GalleryImageForStream = {
  r2Key: string;
  mime: string | null;
};

/**
 * Looked up by the public `/api/gallery/[id]` streaming route
 * (`src/app/api/gallery/[id]/route.ts`) to resolve an id to its R2 key and
 * stored mime type.
 *
 * Unlike every other function in this file, this one deliberately does NOT
 * swallow errors into a safe fallback — same reasoning as
 * `getMusicTrackForStream`: the streaming route needs to tell "id not
 * found" (404) apart from "the database is unreachable" (500).
 */
export async function getGalleryImageForStream(id: string): Promise<GalleryImageForStream | null> {
  const db = getDb();
  const [row] = await db
    .select({ r2Key: galleryImages.r2Key, mime: galleryImages.mime })
    .from(galleryImages)
    .where(eq(galleryImages.id, id))
    .limit(1);

  return row ?? null;
}
