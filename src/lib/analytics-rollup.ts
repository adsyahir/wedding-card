import "server-only";

import { and, gte, inArray, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { dailyStats, events, pageViews } from "@/db/schema";

/**
 * Aggregation and retention for the analytics tables.
 *
 * Raw `page_views`/`events` rows are kept only long enough to compute the
 * dashboard's day-by-day chart and to backstop the breakdown queries in
 * `src/db/queries/analytics.ts` — `pruneOldAnalytics` deletes anything
 * older than the retention window so those tables never grow without
 * bound. `daily_stats` (one small row per day) is what actually survives
 * long-term.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` for `date`, in UTC. */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The `[start, end)` UTC-day bounds for a `YYYY-MM-DD` string. */
function dayBounds(dayIso: string): { start: Date; end: Date } {
  const start = new Date(`${dayIso}T00:00:00.000Z`);
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { start, end };
}

export type DailyRollup = {
  day: string;
  views: number;
  uniques: number;
  byCountry: Record<string, number>;
  byReferrer: Record<string, number>;
  byDevice: Record<string, number>;
};

/**
 * Aggregates one UTC day's `page_views` rows into a `daily_stats` row
 * (upserted, so re-running it — e.g. the admin page's opportunistic
 * backfill re-running a day it already has — is idempotent).
 *
 * Reads the day's raw rows into memory to group them: for a wedding
 * invite's traffic volume (at most a few thousand views, ever, for a
 * single day) this is simpler and plenty fast, and avoids hand-rolling
 * three separate `GROUP BY` queries.
 */
export async function rollupDailyStats(dayIso: string): Promise<DailyRollup> {
  const db = getDb();
  const { start, end } = dayBounds(dayIso);

  const rows = await db
    .select({
      country: pageViews.country,
      referrerHost: pageViews.referrerHost,
      deviceType: pageViews.deviceType,
      visitorHash: pageViews.visitorHash,
    })
    .from(pageViews)
    .where(and(gte(pageViews.ts, start), lt(pageViews.ts, end)));

  const byCountry: Record<string, number> = {};
  const byReferrer: Record<string, number> = {};
  const byDevice: Record<string, number> = {};
  const uniqueVisitors = new Set<string>();

  for (const row of rows) {
    const country = row.country ?? "unknown";
    byCountry[country] = (byCountry[country] ?? 0) + 1;

    const referrer = row.referrerHost ?? "direct";
    byReferrer[referrer] = (byReferrer[referrer] ?? 0) + 1;

    const device = row.deviceType ?? "unknown";
    byDevice[device] = (byDevice[device] ?? 0) + 1;

    uniqueVisitors.add(row.visitorHash);
  }

  const rollup: DailyRollup = {
    day: dayIso,
    views: rows.length,
    uniques: uniqueVisitors.size,
    byCountry,
    byReferrer,
    byDevice,
  };

  await db
    .insert(dailyStats)
    .values({
      day: rollup.day,
      views: rollup.views,
      uniques: rollup.uniques,
      byCountry: JSON.stringify(byCountry),
      byReferrer: JSON.stringify(byReferrer),
      byDevice: JSON.stringify(byDevice),
    })
    .onConflictDoUpdate({
      target: dailyStats.day,
      set: {
        views: rollup.views,
        uniques: rollup.uniques,
        byCountry: JSON.stringify(byCountry),
        byReferrer: JSON.stringify(byReferrer),
        byDevice: JSON.stringify(byDevice),
      },
    });

  return rollup;
}

/**
 * Ensures a `daily_stats` row exists for every `YYYY-MM-DD` in `days`,
 * running `rollupDailyStats` for any that are missing. This is what lets
 * `/admin/analytics` show a populated chart with ZERO cron setup: the page
 * calls this for the days in its selected range before reading
 * `daily_stats`, so the first admin who ever opens the page backfills it.
 * Cheap on repeat visits — only missing days trigger a rollup.
 */
export async function backfillMissingDailyStats(days: string[]): Promise<void> {
  if (days.length === 0) return;

  const db = getDb();
  const existing = await db
    .select({ day: dailyStats.day })
    .from(dailyStats)
    .where(inArray(dailyStats.day, days));

  const existingDays = new Set(existing.map((row) => row.day));
  const missingDays = days.filter((day) => !existingDays.has(day));

  for (const day of missingDays) {
    await rollupDailyStats(day);
  }
}

/**
 * Deletes `page_views`/`events` rows older than `retentionDays`. Never
 * throws into the caller (mirrors `pruneRateLimits` in
 * `src/lib/rate-limit.ts`) — a failed prune must never take down the cron
 * job's other work (or, if called opportunistically, the admin page).
 */
export async function pruneOldAnalytics(retentionDays = 90): Promise<void> {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
    await db.delete(pageViews).where(lt(pageViews.ts, cutoff));
    await db.delete(events).where(lt(events.ts, cutoff));
  } catch (error) {
    console.error("pruneOldAnalytics failed", error);
  }
}
