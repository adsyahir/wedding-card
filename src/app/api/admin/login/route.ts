import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { API_ERRORS, jsonError, readJsonBody, toRecord } from "@/lib/api";
import { logAudit } from "@/lib/auth";
import { verifyDummyPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestVisitorHash, isSameOrigin } from "@/lib/request";
import {
  createSession,
  CSRF_COOKIE_NAME,
  csrfCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/session";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: a login attempt must
// never be statically optimized/cached.
export const dynamic = "force-dynamic";

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_SECONDS = 15 * 60; // 15 minutes

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * The ONE generic failure message for every way a login attempt can fail —
 * unknown username, wrong password, or a locked account. Never distinguish
 * between these in the response; doing so would let an attacker enumerate
 * valid usernames or learn when an account is locked.
 */
const GENERIC_LOGIN_ERROR = "Nama pengguna atau kata laluan tidak sah.";

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

function noStore(status: number, body: unknown, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError(403, API_ERRORS.invalidRequest);
  }

  // Rate limit BEFORE looking up the admin_users/sessions tables, keyed on
  // the anonymous per-day visitor hash so a single attacker can't burn
  // through unlimited guesses by cycling usernames.
  const visitorHash = await getRequestVisitorHash(request);
  const rateLimit = await checkRateLimit(
    `login:${visitorHash}`,
    LOGIN_RATE_LIMIT,
    LOGIN_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return jsonError(429, API_ERRORS.tooManyRequests, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError(body.status, body.error);
  }

  const parsed = loginSchema.safeParse(toRecord(body.data));
  if (!parsed.success) {
    return jsonError(400, API_ERRORS.invalidInput);
  }

  const { username, password } = parsed.data;

  try {
    const db = getDb();
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    // Unknown username: still perform an equivalent PBKDF2 derivation so
    // this response takes the same time as a known-username response,
    // making it impossible to enumerate valid usernames via timing.
    if (!user) {
      await verifyDummyPassword(password);
      return noStore(401, { ok: false, error: GENERIC_LOGIN_ERROR });
    }

    // Locked account: do the same PBKDF2-equivalent work (never skip it —
    // that alone would be a timing tell) but never check the real password,
    // and never reveal that the account is locked.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await verifyDummyPassword(password);
      return noStore(401, { ok: false, error: GENERIC_LOGIN_ERROR });
    }

    const valid = await verifyPassword(password, {
      hash: user.passwordHash,
      salt: user.salt,
      iterations: user.iterations,
    });

    if (!valid) {
      const failedAttempts = user.failedAttempts + 1;
      const lockedUntil =
        failedAttempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

      await db
        .update(adminUsers)
        .set({ failedAttempts, lockedUntil })
        .where(eq(adminUsers.id, user.id));

      return noStore(401, { ok: false, error: GENERIC_LOGIN_ERROR });
    }

    // Success: reset the failure counter/lockout, record the login, create
    // a session, and set the cookie.
    await db
      .update(adminUsers)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(adminUsers.id, user.id));

    const { token, csrfToken } = await createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    // Companion, JS-readable cookie carrying the raw CSRF token — see
    // `csrfCookieOptions` in `src/lib/session.ts` for why this is safe.
    // The response body also still carries it (harmless, kept for
    // backwards-compatible callers), but the cookie is the source of truth
    // `src/lib/csrf-client.ts` reads from, which works in any tab.
    cookieStore.set(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions());

    await logAudit({ adminUserId: user.id, action: "login" });

    return noStore(200, { ok: true, csrfToken });
  } catch (error) {
    console.error("POST /api/admin/login: failed", error);
    return jsonError(500, API_ERRORS.serverError);
  }
}
