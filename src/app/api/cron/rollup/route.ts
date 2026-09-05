import { API_ERRORS, jsonError } from "@/lib/api";
import { pruneOldAnalytics, rollupDailyStats, toIsoDay } from "@/lib/analytics-rollup";
import { constantTimeEqual } from "@/lib/crypto";
import { getSecret } from "@/lib/request";
import { checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { pruneExpiredSessions } from "@/lib/session";

/**
 * `POST /api/cron/rollup` — the analytics/housekeeping cron job.
 *
 * `@opennextjs/cloudflare` (pinned at ^1.20.6 here) generates
 * `.open-next/worker.js` fresh on every build from its own template, and
 * that template exports only `{ fetch(request, env, ctx) }` — no
 * `scheduled()` handler, and no supported hook to add one without hand
 * patching a generated file that gets overwritten on the next build. So
 * rather than a real Workers Cron Trigger calling into this app directly,
 * this is a plain authenticated HTTP endpoint that something external
 * calls on a schedule — see the README's "Analytics" section for how to
 * wire that up (a tiny separate Cron-Trigger worker, or any external
 * scheduler that can send an authenticated POST).
 *
 * Because that external trigger might never get set up, `/admin/analytics`
 * ALSO opportunistically calls `backfillMissingDailyStats` for any day in
 * its displayed range that's missing a `daily_stats` row — so the
 * dashboard has data with zero scheduling setup, and this endpoint is
 * purely an optimization/housekeeping convenience on top of that, not a
 * hard dependency.
 */

export const dynamic = "force-dynamic";

const RATE_LIMIT = 6;
const RATE_WINDOW_SECONDS = 60 * 60; // 1 hour — this is called at most once a day in practice.
const RATE_LIMIT_PRUNE_OLDER_THAN_SECONDS = 24 * 60 * 60; // 1 day — comfortably beyond any window used in this app.

function unauthorized(): Response {
  return jsonError(401, "Unauthorized");
}

function yesterdayIso(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return toIsoDay(yesterday);
}

export async function POST(request: Request): Promise<Response> {
  let cronSecret: string;
  try {
    cronSecret = getSecret("CRON_SECRET");
  } catch (error) {
    console.error("POST /api/cron/rollup: CRON_SECRET missing", error);
    return unauthorized();
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/.exec(authHeader);
  const providedToken = match?.[1] ?? "";

  if (!constantTimeEqual(providedToken, cronSecret)) {
    return unauthorized();
  }

  // A trivial rate limit, keyed on a fixed string rather than a visitor
  // hash (there is no "visitor" here — this is a single trusted caller) —
  // just enough to stop a leaked/misconfigured token from being able to
  // hammer this endpoint indefinitely.
  const rateLimit = await checkRateLimit("cron:rollup", RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return jsonError(429, API_ERRORS.tooManyRequests, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const day = yesterdayIso();

  try {
    const rollup = await rollupDailyStats(day);
    await pruneOldAnalytics();
    await pruneRateLimits(RATE_LIMIT_PRUNE_OLDER_THAN_SECONDS);
    await pruneExpiredSessions();

    return new Response(
      JSON.stringify({
        ok: true,
        day: rollup.day,
        views: rollup.views,
        uniques: rollup.uniques,
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("POST /api/cron/rollup failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
