import "server-only";

import { lt, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Fixed-window rate limiter backed by the `rate_limits` D1 table.
 *
 * Window bucketing: the current bucket is `floor(nowSeconds / windowSeconds)`,
 * and the row key is `` `${key}:${bucket}` ``. A request in an earlier bucket
 * simply starts a fresh row under a different key — old buckets are never
 * updated again and are cleaned up later by `pruneRateLimits` (called from a
 * cron job in a later phase), not by this function.
 */

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Injectable seam so `checkRateLimit`'s bucket math and allow/deny
 * transition can be unit-tested without a real D1 binding: production calls
 * go through `defaultIncrement` (the real Drizzle/D1 upsert); tests pass
 * their own in-memory `increment` implementation.
 */
export type RateLimitIncrementer = (rowKey: string, windowStart: Date) => Promise<number>;

/**
 * Atomically increments (or creates) the counter for `rowKey` and returns
 * the new count, via a single upsert statement — `INSERT ... ON CONFLICT DO
 * UPDATE SET count = count + 1 RETURNING count`. This has to be one
 * statement: a separate read-then-write would race under concurrent
 * requests (two parallel requests both read count=2, both write count=3,
 * and the limit is silently bypassed by one of them).
 */
async function defaultIncrement(rowKey: string, windowStart: Date): Promise<number> {
  const db = getDb();
  const [row] = await db
    .insert(rateLimits)
    .values({ key: rowKey, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  return row?.count ?? 1;
}

/**
 * Checks and increments the rate-limit counter for `key`.
 *
 * - **Fails closed on limit**: once `count` exceeds `limit` within the
 *   current window, `allowed` is `false` — this is the whole point of a
 *   rate limiter and must be enforced strictly.
 * - **Fails open on error**: if the DB throws (D1 unavailable, unexpected
 *   error, etc.), this logs the error and returns `{ allowed: true }`. A
 *   broken rate limiter must never be the reason a real guest can't RSVP on
 *   the wedding morning — the downside (a burst of spam gets through while
 *   D1 is unhealthy) is far preferable to the alternative (nobody can
 *   submit anything).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  options: { now?: () => number; increment?: RateLimitIncrementer } = {},
): Promise<RateLimitResult> {
  const now = options.now ?? Date.now;
  const increment = options.increment ?? defaultIncrement;

  const nowSeconds = Math.floor(now() / 1000);
  const bucket = Math.floor(nowSeconds / windowSeconds);
  const rowKey = `${key}:${bucket}`;
  const windowStartSeconds = bucket * windowSeconds;
  const windowEndSeconds = windowStartSeconds + windowSeconds;

  try {
    const count = await increment(rowKey, new Date(windowStartSeconds * 1000));
    const allowed = count <= limit;
    const retryAfterSeconds = allowed ? 0 : Math.max(1, windowEndSeconds - nowSeconds);
    return { allowed, retryAfterSeconds };
  } catch (error) {
    console.error(`checkRateLimit failed for key="${key}", failing open`, error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Deletes rate-limit rows whose window started more than `olderThanSeconds`
 * ago. Not called from anywhere yet — wired up by the Phase 7 cron job.
 */
export async function pruneRateLimits(olderThanSeconds: number): Promise<void> {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, cutoff));
  } catch (error) {
    console.error("pruneRateLimits failed", error);
  }
}
