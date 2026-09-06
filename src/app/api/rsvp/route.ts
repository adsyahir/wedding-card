import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { rsvps } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestVisitorHash, isSameOrigin } from "@/lib/request";
import { isHoneypotTripped, isTooFast } from "@/lib/spam";
import { rsvpSchema } from "@/lib/validation";
import { getWeddingConfig } from "@/lib/wedding-config";

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

  // The admin can close RSVP entirely (`sections.navRsvp` off hides the nav
  // item/sheet on the public page) — that must be a REAL closure, not
  // cosmetic. Reject writes here too, or someone could still POST directly.
  const { sections } = await getWeddingConfig();
  if (!sections.navRsvp) {
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
  if (isHoneypotTripped(raw.website) || isTooFast(raw.elapsedMs)) {
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

    // Duplicate handling: a guest who submits twice (double-tap, or changed
    // their mind about headcount) must not create a second row — that would
    // silently inflate the Kehadiran tally the caterer is booked against.
    //
    // The identity key is the normalized phone number ALONE, deliberately not
    // phone + visitorHash. `visitorHash` rotates at UTC midnight and changes
    // with the network, so keying on it would let the same guest double-count
    // simply by resubmitting the next day or after switching from wifi to
    // mobile data. The tradeoff is that someone who knows a guest's number
    // could overwrite their entry; the per-visitor rate limit caps that, the
    // admin list makes it visible, and an accurate headcount matters more.
    const [existing] = await db
      .select({ id: rsvps.id })
      .from(rsvps)
      .where(and(eq(rsvps.phone, phone), isNull(rsvps.deletedAt)))
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
