import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { rsvps } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestVisitorHash, isSameOrigin } from "@/lib/request";
import { isHoneypotTripped, isTooFast } from "@/lib/spam";
import { rsvpSchema } from "@/lib/validation";

// Runs on the Workers runtime under OpenNext (the Next.js default) — do NOT
// set `export const runtime = "nodejs"`. Force dynamic so this is never
// statically optimized/cached: every call must actually run.
export const dynamic = "force-dynamic";

const RSVP_RATE_LIMIT = 3;
const RSVP_RATE_WINDOW_SECONDS = 60 * 60; // 1 hour

// Only POST is exported. Next.js's route handler dispatcher returns a 405
// for any HTTP method without a matching export (GET/PUT/DELETE/etc.),
// which is exactly the behavior we want here — there is deliberately no
// public GET on this route.
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError(403, API_ERRORS.invalidRequest);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError(body.status, body.error);
  }

  const raw = toRecord(body.data);

  // Spam heuristics run BEFORE schema validation, and BEFORE the rate
  // limiter is even touched, so a bot's requests never consume a real
  // guest's rate-limit budget.
  //
  // Deliberate choice: when either check trips, we return `200 { ok: true }`
  // WITHOUT writing anything to the DB, rather than a 4xx. This looks like a
  // bug but isn't — a bot that receives an error learns to adapt its
  // request; a bot that receives a fake success believes it worked and
  // moves on. The rejection is still logged server-side for visibility.
  if (isHoneypotTripped(raw.website) || isTooFast(raw.renderedAt, Date.now())) {
    console.warn("rsvp: rejected as spam (honeypot or timing check tripped)");
    return jsonOk();
  }

  const parsed = rsvpSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, API_ERRORS.invalidInput);
  }

  const visitorHash = await getRequestVisitorHash(request);

  const rateLimit = await checkRateLimit(
    `rsvp:${visitorHash}`,
    RSVP_RATE_LIMIT,
    RSVP_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return jsonError(429, API_ERRORS.tooManyRequests, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const { name, phone, attending, adults, children, message } = parsed.data;

  try {
    const db = getDb();

    // Duplicate handling: a guest who submits twice (double-tap, changed
    // their mind about headcount, etc.) must not create a second headcount
    // row — that would silently inflate the Kehadiran tally. We treat "same
    // visitor + same normalized phone number, not soft-deleted" as the same
    // guest and UPDATE their existing row instead of inserting a new one.
    // Either way we still return `200 { ok: true }` to the client.
    const [existing] = await db
      .select({ id: rsvps.id })
      .from(rsvps)
      .where(
        and(eq(rsvps.visitorHash, visitorHash), eq(rsvps.phone, phone), isNull(rsvps.deletedAt)),
      )
      .limit(1);

    if (existing) {
      await db
        .update(rsvps)
        .set({
          name,
          attending,
          adults,
          children,
          message: message ?? null,
        })
        .where(eq(rsvps.id, existing.id));
    } else {
      await db.insert(rsvps).values({
        name,
        phone,
        attending,
        adults,
        children,
        message: message ?? null,
        // Server-set timestamp — a client-supplied time is never trusted.
        createdAt: new Date(),
        visitorHash,
      });
    }

    return jsonOk();
  } catch (error) {
    console.error("POST /api/rsvp: DB write failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
