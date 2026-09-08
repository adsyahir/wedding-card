import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { analyticsEventNameSchema } from "@/lib/analytics-events";
import { API_ERRORS, jsonError, readJsonBody, toRecord } from "@/lib/api";
import { getDb } from "@/db";
import { events, pageViews } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestVisitorHash, getUserAgent, isSameOrigin } from "@/lib/request";
import { isBot, parseUserAgent } from "@/lib/user-agent";

/**
 * `POST /api/track` — the public analytics beacon.
 *
 * This is an UNAUTHENTICATED PUBLIC WRITE ENDPOINT, exactly like
 * `/api/rsvp` and `/api/wishes` (see those for the house style this
 * mirrors) — treated with the same suspicion. The differences from those
 * two routes are deliberate:
 *
 * - The response is ALWAYS `204 No Content` on anything that isn't a
 *   same-origin violation, no matter what happened internally (malformed
 *   body, an unknown event name, a bot, a rate-limit trip, a DB error).
 *   Analytics must never break the invitation, and a beacon must never
 *   teach a bot (or an attacker probing for a distinguishing response)
 *   anything about what got accepted.
 * - Bots are dropped by `isBot(userAgent)` BEFORE any DB write.
 * - The body is capped at 2 KB (`MAX_BODY_BYTES`) — a beacon body is a
 *   couple of short strings, never anything close to the 16 KB default.
 */

export const dynamic = "force-dynamic";

const TRACK_RATE_LIMIT = 60;
const TRACK_RATE_WINDOW_SECONDS = 60 * 60; // 1 hour
const MAX_BODY_BYTES = 2 * 1024;
const MAX_PATH_LEN = 200;
const MAX_REFERRER_LEN = 500;

const trackViewSchema = z.object({
  type: z.literal("view"),
  path: z.string().min(1).max(MAX_PATH_LEN),
  referrer: z.string().max(MAX_REFERRER_LEN).optional(),
});

const trackEventSchema = z.object({
  type: z.literal("event"),
  name: analyticsEventNameSchema,
});

const trackBodySchema = z.discriminatedUnion("type", [trackViewSchema, trackEventSchema]);

function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/**
 * Accepts only a same-origin pathname, and strips any query string/fragment
 * before storing — a path may carry no PII of its own, but a query string
 * on THIS site could (e.g. a future `?ref=` or `?token=` param), so it's
 * dropped unconditionally rather than trying to allowlist safe params.
 */
function sanitizePath(rawPath: string): string {
  const withoutFragment = rawPath.split("#")[0] ?? "";
  const withoutQuery = withoutFragment.split("?")[0] ?? "";
  if (!withoutQuery.startsWith("/")) return "/";
  return withoutQuery.slice(0, MAX_PATH_LEN);
}

/**
 * Normalises a referrer down to its HOST ONLY, mapping our own host to
 * `"direct"`. A full referrer URL is never stored: query strings on other
 * sites routinely carry tokens, session ids, or other personal data (a
 * Facebook click-through link, for instance, commonly embeds one), and
 * storing the whole thing would smuggle that into our database. Any
 * malformed/unparseable referrer becomes `null` rather than throwing.
 */
function normalizeReferrerHost(referrer: string | undefined, requestHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host;
    if (!host) return null;
    if (requestHost && host === requestHost) return "direct";
    return host.slice(0, MAX_REFERRER_LEN);
  } catch {
    return null;
  }
}

/**
 * Geography is derived from Cloudflare's own edge (`cf.country`/`region`/
 * `city`, falling back to the `CF-IPCountry` header), never from a
 * third-party geo-IP lookup — no additional service ever sees a guest's IP.
 * Every field is nullable: local dev (`next dev`) has none of these, and
 * that must never break the beacon.
 */
/**
 * Coordinates are rounded to ONE DECIMAL PLACE (~11km) before they are
 * stored. Cloudflare reports far more precision than that, and none of it
 * is wanted: the map needs to know which city a dot belongs near, and the
 * city NAME stored alongside already says that more precisely. Keeping the
 * raw figure would make the row more identifying than the rest of the
 * table for no gain.
 *
 * Returns null for anything unparseable or out of range, so a malformed
 * edge value can never be written as a coordinate.
 */
function coarseCoord(value: unknown, limit: number): number | null {
  // `Number("")` and `Number("  ")` are 0 — finite and in range — so an
  // empty edge value would be stored as 0.0 and plotted in the Gulf of
  // Guinea, the classic null-island bug.
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return Math.round(n * 10) / 10;
}

function getGeo(request: Request): {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  try {
    const { cf } = getCloudflareContext();
    if (cf) {
      if (typeof cf.country === "string") country = cf.country;
      if (typeof cf.region === "string") region = cf.region;
      if (typeof cf.city === "string") city = cf.city;
      latitude = coarseCoord(cf.latitude, 90);
      longitude = coarseCoord(cf.longitude, 180);
    }
  } catch {
    // No Cloudflare request context available (e.g. `next dev` without the
    // Workers runtime) — fall through to the header fallback below.
  }

  if (!country) {
    const headerCountry = request.headers.get("CF-IPCountry");
    // Cloudflare sends the literal string "XX" when it cannot determine a
    // country (e.g. some bot traffic, internal requests) — that's not a
    // real value worth persisting.
    if (headerCountry && headerCountry !== "XX") country = headerCountry;
  }

  return { country, region, city, latitude, longitude };
}

// Only POST is exported — Next.js's route handler dispatcher returns a 405
// for GET/PUT/DELETE/etc. automatically, which is exactly what we want.
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError(403, API_ERRORS.invalidRequest);
  }

  try {
    const userAgent = getUserAgent(request);

    // Drop bots before any write, and before even touching the rate
    // limiter or the DB — a bot's requests must never consume budget that
    // could otherwise rate-limit a real guest, and a bot must see nothing
    // that distinguishes "accepted" from "rejected".
    if (isBot(userAgent)) {
      return noContent();
    }

    const body = await readJsonBody(request, MAX_BODY_BYTES);
    if (!body.ok) {
      return noContent();
    }

    const parsed = trackBodySchema.safeParse(toRecord(body.data));
    if (!parsed.success) {
      return noContent();
    }

    const visitorHash = await getRequestVisitorHash(request);

    const rateLimit = await checkRateLimit(
      `track:${visitorHash}`,
      TRACK_RATE_LIMIT,
      TRACK_RATE_WINDOW_SECONDS,
    );
    if (!rateLimit.allowed) {
      return noContent();
    }

    const db = getDb();
    const now = new Date();

    if (parsed.data.type === "view") {
      const { deviceType, os, browser } = parseUserAgent(userAgent);
      const { country, region, city, latitude, longitude } = getGeo(request);
      const path = sanitizePath(parsed.data.path);
      const referrerHost = normalizeReferrerHost(parsed.data.referrer, request.headers.get("Host"));

      await db.insert(pageViews).values({
        ts: now,
        path,
        country,
        region,
        city,
        latitude,
        longitude,
        referrerHost,
        deviceType,
        os,
        browser,
        visitorHash,
      });
    } else {
      await db.insert(events).values({
        ts: now,
        name: parsed.data.name,
        visitorHash,
      });
    }

    return noContent();
  } catch (error) {
    // Fail open and silent: analytics must never break the invitation, and
    // never surface an internal error to a public, unauthenticated caller.
    console.error("POST /api/track failed", error);
    return noContent();
  }
}
