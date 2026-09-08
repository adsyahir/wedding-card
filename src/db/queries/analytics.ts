import "server-only";

import { and, asc, avg, count, countDistinct, desc, eq, gte, isNotNull, lt, lte } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import { getDb } from "@/db";
import { dailyStats, events, pageViews } from "@/db/schema";
import type { AnalyticsEventName } from "@/lib/analytics-events";

/**
 * Read-only, aggregate-only queries backing `/admin/analytics`
 * (`src/app/admin/(protected)/analytics/page.tsx`).
 *
 * House style, mirroring `src/db/queries/admin.ts`:
 * - Every query picks explicit columns.
 * - `visitorHash` is NEVER selected as a bare column here. The one place it
 *   is touched at all is `countDistinct(pageViews.visitorHash)`, which
 *   aggregates it into a plain count entirely inside SQLite — the actual
 *   hash values never leave the database engine, let alone reach a
 *   component prop or a JSON response.
 * - Not defensively wrapped in try/catch: an admin page failing loudly when
 *   D1 is unreachable is the right behavior here, same reasoning as
 *   `src/db/queries/admin.ts`.
 */

export type RangeDays = 7 | 30 | 90;

/** Whitelists a `?range=` query param down to one of the three supported windows. */
export function resolveRangeDays(input: string | string[] | undefined): RangeDays {
  const value = Array.isArray(input) ? input[0] : input;
  if (value === "7" || value === "30" || value === "90") return Number(value) as RangeDays;
  return 30;
}

/** `YYYY-MM-DD` for `date`, in UTC. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type DateRange = { start: Date; end: Date; startDay: string; todayDay: string; days: string[] };

/**
 * Resolves `rangeDays` into a `[start, end)` window ending at the start of
 * "today" (UTC) — i.e. `end` is exclusive and equals midnight UTC today —
 * plus the list of every `YYYY-MM-DD` day in the CLOSED range
 * `[startDay, todayDay]` (inclusive of today), for the opportunistic
 * backfill and the chart's x-axis.
 */
export function resolveDateRange(rangeDays: RangeDays, now: Date = new Date()): DateRange {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const start = new Date(todayStart.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);

  const days: string[] = [];
  for (let d = new Date(start); d.getTime() <= todayStart.getTime(); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    days.push(isoDay(d));
  }

  return { start, end, startDay: isoDay(start), todayDay: isoDay(todayStart), days };
}

export type RangeTotals = { views: number; uniques: number };

/**
 * Total views and distinct visitors across the whole range in one query —
 * computed live against `page_views` (not summed from `daily_stats`,
 * which would double-count a visitor who came back on a second day).
 */
export async function getRangeTotals(range: DateRange): Promise<RangeTotals> {
  const db = getDb();
  const [row] = await db
    .select({ views: count(), uniques: countDistinct(pageViews.visitorHash) })
    .from(pageViews)
    .where(and(gte(pageViews.ts, range.start), lt(pageViews.ts, range.end)));
  return { views: row?.views ?? 0, uniques: row?.uniques ?? 0 };
}

export type DailyPoint = { day: string; views: number; uniques: number };

/** Existing `daily_stats` rows in `[startDay, endDay]` (inclusive), ordered oldest-first. */
export async function getDailyStatsInRange(startDay: string, endDay: string): Promise<DailyPoint[]> {
  const db = getDb();
  const rows = await db
    .select({ day: dailyStats.day, views: dailyStats.views, uniques: dailyStats.uniques })
    .from(dailyStats)
    .where(and(gte(dailyStats.day, startDay), lte(dailyStats.day, endDay)))
    .orderBy(asc(dailyStats.day));
  return rows;
}

/**
 * Today's stats computed live (there is never a `daily_stats` row for
 * "today" — the rollup only ever runs for a day that has fully elapsed).
 */
export async function getLiveDayStats(dayIso: string): Promise<DailyPoint> {
  const db = getDb();
  const start = new Date(`${dayIso}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({ views: count(), uniques: countDistinct(pageViews.visitorHash) })
    .from(pageViews)
    .where(and(gte(pageViews.ts, start), lt(pageViews.ts, end)));

  return { day: dayIso, views: row?.views ?? 0, uniques: row?.uniques ?? 0 };
}

export type KeyCount = { key: string; count: number };

/** Top values of one `page_views` column within the range, most-frequent first. Excludes null values. */
async function topByColumn(column: SQLiteColumn, range: DateRange, limit: number): Promise<KeyCount[]> {
  const db = getDb();
  const n = count();
  const rows = await db
    .select({ key: column, n })
    .from(pageViews)
    .where(and(gte(pageViews.ts, range.start), lt(pageViews.ts, range.end)))
    .groupBy(column)
    .orderBy(desc(n))
    .limit(limit);

  const result: KeyCount[] = [];
  for (const row of rows as { key: unknown; n: number }[]) {
    if (typeof row.key === "string") {
      result.push({ key: row.key, count: row.n });
    }
  }
  return result;
}

export async function getTopCountries(range: DateRange, limit = 10): Promise<KeyCount[]> {
  return topByColumn(pageViews.country, range, limit);
}

export async function getTopCities(range: DateRange, limit = 10): Promise<KeyCount[]> {
  return topByColumn(pageViews.city, range, limit);
}

export type CityPoint = {
  city: string;
  country: string | null;
  lat: number;
  lng: number;
  count: number;
};

/**
 * Top cities that have usable coordinates, for the dots on the analytics
 * map. Grouped by city AND country, so a Kajang in two countries stays two
 * dots rather than being averaged into the sea between them.
 *
 * Rows written before `latitude`/`longitude` existed have none, and
 * Cloudflare does not always supply them, so this list is a SUBSET of
 * `getTopCities` by design — the map plots what it can place, and the list
 * beside it still shows every city. `avg` because the stored values are
 * already rounded to ~11km, so several readings for one city differ only in
 * that last place.
 */
export async function getTopCityPoints(range: DateRange, limit = 25): Promise<CityPoint[]> {
  const db = getDb();
  const n = count();
  const rows = await db
    .select({
      city: pageViews.city,
      country: pageViews.country,
      lat: avg(pageViews.latitude),
      lng: avg(pageViews.longitude),
      n,
    })
    .from(pageViews)
    .where(
      and(
        gte(pageViews.ts, range.start),
        lt(pageViews.ts, range.end),
        isNotNull(pageViews.city),
        isNotNull(pageViews.latitude),
        isNotNull(pageViews.longitude),
      ),
    )
    .groupBy(pageViews.city, pageViews.country)
    .orderBy(desc(n))
    .limit(limit);

  const points: CityPoint[] = [];
  for (const row of rows as {
    city: string | null;
    country: string | null;
    lat: unknown;
    lng: unknown;
    n: number;
  }[]) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!row.city || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({ city: row.city, country: row.country, lat, lng, count: row.n });
  }
  return points;
}

export async function getDeviceBreakdown(range: DateRange): Promise<KeyCount[]> {
  return topByColumn(pageViews.deviceType, range, 10);
}

export async function getOsBreakdown(range: DateRange): Promise<KeyCount[]> {
  return topByColumn(pageViews.os, range, 10);
}

export async function getBrowserBreakdown(range: DateRange): Promise<KeyCount[]> {
  return topByColumn(pageViews.browser, range, 10);
}

export type ReferrerCategory = "WhatsApp" | "Facebook" | "Instagram" | "Google" | "Langsung" | "Lain";

/** Buckets a stored referrer host into the small set of categories the dashboard shows. */
function categorizeReferrerHost(host: string | null): ReferrerCategory {
  if (!host || host === "direct") return "Langsung";
  const h = host.toLowerCase();
  if (h.includes("whatsapp") || h === "wa.me") return "WhatsApp";
  if (h.includes("facebook") || h === "fb.me" || h === "l.facebook.com") return "Facebook";
  if (h.includes("instagram")) return "Instagram";
  if (h.includes("google")) return "Google";
  return "Lain";
}

export type ReferrerBreakdown = { category: ReferrerCategory; count: number };

export async function getReferrerBreakdown(range: DateRange): Promise<ReferrerBreakdown[]> {
  const db = getDb();
  const rows = await db
    .select({ referrerHost: pageViews.referrerHost })
    .from(pageViews)
    .where(and(gte(pageViews.ts, range.start), lt(pageViews.ts, range.end)));

  const totals = new Map<ReferrerCategory, number>();
  for (const row of rows) {
    const category = categorizeReferrerHost(row.referrerHost);
    totals.set(category, (totals.get(category) ?? 0) + 1);
  }

  return Array.from(totals.entries())
    .map(([category, categoryCount]) => ({ category, count: categoryCount }))
    .sort((a, b) => b.count - a.count);
}

export type Funnel = { views: number; rsvpOpen: number; rsvpSubmit: number };

async function countEvent(name: AnalyticsEventName, range: DateRange): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(events)
    .where(and(eq(events.name, name), gte(events.ts, range.start), lt(events.ts, range.end)));
  return row?.n ?? 0;
}

/** The views -> rsvp_open -> rsvp_submit engagement funnel for the range. */
export async function getRsvpFunnel(range: DateRange): Promise<Funnel> {
  const [views, rsvpOpen, rsvpSubmit] = await Promise.all([
    getRangeTotals(range).then((t) => t.views),
    countEvent("rsvp_open", range),
    countEvent("rsvp_submit", range),
  ]);
  return { views, rsvpOpen, rsvpSubmit };
}
