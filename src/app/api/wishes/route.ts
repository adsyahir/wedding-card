import { getDb } from "@/db";
import { wishes } from "@/db/schema";
import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestVisitorHash, isSameOrigin } from "@/lib/request";
import { isHoneypotTripped, isTooFast } from "@/lib/spam";
import { wishSchema } from "@/lib/validation";

// Runs on the Workers runtime under OpenNext (the Next.js default) — do NOT
// set `export const runtime = "nodejs"`. Force dynamic so this is never
// statically optimized/cached: every call must actually run.
export const dynamic = "force-dynamic";

const WISH_RATE_LIMIT = 5;
const WISH_RATE_WINDOW_SECONDS = 60 * 60; // 1 hour

// Only POST is exported. Next.js's route handler dispatcher returns a 405
// for any HTTP method without a matching export — there is deliberately no
// public GET on this route (the wall of wishes is rendered server-side, see
// src/db/queries/public.ts).
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError(403, API_ERRORS.invalidRequest);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError(body.status, body.error);
  }

  const raw = toRecord(body.data);

  // Spam heuristics run BEFORE schema validation and BEFORE the rate
  // limiter, so a bot never consumes a real guest's rate-limit budget.
  //
  // Deliberate choice: a tripped check returns `200 { ok: true }` WITHOUT
  // writing anything, rather than a 4xx. This looks like a bug but isn't —
  // a bot that receives an error learns to adapt; one that receives a fake
  // success believes it worked and moves on. Still logged server-side.
  if (isHoneypotTripped(raw.website) || isTooFast(raw.renderedAt, Date.now())) {
    console.warn("wishes: rejected as spam (honeypot or timing check tripped)");
    return jsonOk();
  }

  const parsed = wishSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, API_ERRORS.invalidInput);
  }

  const visitorHash = await getRequestVisitorHash(request);

  const rateLimit = await checkRateLimit(
    `wishes:${visitorHash}`,
    WISH_RATE_LIMIT,
    WISH_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return jsonError(429, API_ERRORS.tooManyRequests, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const { name, message } = parsed.data;

  try {
    const db = getDb();

    await db.insert(wishes).values({
      name,
      message,
      // Hardcoded server-side — NEVER taken from the request body. A wish
      // is only ever created as "pending"; approving it is an admin-only
      // action in a later phase. Accepting a client-supplied `status` here
      // would let anyone mass-assign their own wish straight to "approved"
      // and skip moderation entirely.
      status: "pending",
      // Server-set timestamp — a client-supplied time is never trusted.
      createdAt: new Date(),
      visitorHash,
    });

    return jsonOk();
  } catch (error) {
    console.error("POST /api/wishes: DB write failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
