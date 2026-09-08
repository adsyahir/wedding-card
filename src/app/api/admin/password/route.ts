import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { MAX_PASSWORD_LENGTH, passwordWeakness } from "@/lib/password-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSession,
  CSRF_COOKIE_NAME,
  csrfCookieOptions,
  revokeAllSessionsForUser,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/session";

// Runs on the Workers runtime under OpenNext — do NOT set
// `export const runtime = "nodejs"`. Force dynamic: never cached.
export const dynamic = "force-dynamic";

const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 15 * 60;

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

/**
 * `POST /api/admin/password` — the admin changes their OWN password.
 *
 * There is no "change someone else's password" here and no admin
 * screen listing users: this app has a handful of family accounts seeded
 * from the CLI, and an in-dashboard way to take over another account would
 * be a bigger privilege than anything else the dashboard grants.
 *
 * THE CURRENT PASSWORD IS REQUIRED even though the caller already holds a
 * valid session. A session cookie proves someone is logged in; it does not
 * prove they are the account owner. Without this check, a borrowed unlocked
 * laptop — or any XSS that could ride the session — turns into a permanent
 * account takeover instead of a temporary one.
 *
 * Rate-limited per user, because "verify the current password" is a
 * password oracle if you let it run unbounded.
 *
 * On success every session for the user is revoked and a fresh one issued
 * to this browser, so other devices are signed out. The new session is a
 * standard one even if the old was "remember me": a password change is
 * exactly the moment not to silently extend a 30-day credential.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const rateLimit = await checkRateLimit(
    `password-change:${guard.session.adminUserId}`,
    RATE_LIMIT,
    RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return jsonError(
      429,
      API_ERRORS.tooManyRequests,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
      ADMIN_ERROR_CODES.tooManyRequests,
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError(body.status, body.error, undefined, ADMIN_ERROR_CODES.invalidRequest);
  }

  const parsed = bodySchema.safeParse(toRecord(body.data));
  if (!parsed.success) {
    return jsonError(400, API_ERRORS.invalidInput, undefined, ADMIN_ERROR_CODES.invalidInput);
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const db = getDb();
    const [user] = await db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        passwordHash: adminUsers.passwordHash,
        salt: adminUsers.salt,
        iterations: adminUsers.iterations,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, guard.session.adminUserId))
      .limit(1);

    // The session validated but the row is gone: treat as unauthenticated
    // rather than 500 — the account was deleted mid-session.
    if (!user) {
      return jsonError(401, "Sesi tidak sah.", undefined, "unauthorized");
    }

    const ok = await verifyPassword(currentPassword, {
      hash: user.passwordHash,
      salt: user.salt,
      iterations: user.iterations,
    });
    if (!ok) {
      return jsonError(400, "Kata laluan semasa tidak betul.", undefined, "wrong_current_password");
    }

    const weakness = passwordWeakness(newPassword, user.username);
    if (weakness) {
      // The reason travels as a code; the dashboard picks the sentence, in
      // whichever language the admin is reading.
      return jsonError(400, "Kata laluan baharu terlalu lemah.", undefined, `weak_${weakness}`);
    }

    if (newPassword === currentPassword) {
      return jsonError(400, "Kata laluan baharu sama dengan yang lama.", undefined, "same_password");
    }

    const stored = await hashPassword(newPassword);

    await db
      .update(adminUsers)
      .set({
        passwordHash: stored.hash,
        salt: stored.salt,
        iterations: stored.iterations,
        // A successful password change clears any lockout: the person who
        // just proved they know the current password is not the attacker
        // the lockout was defending against.
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(adminUsers.id, user.id));

    await revokeAllSessionsForUser(user.id);
    await logAudit({ adminUserId: user.id, action: "password.change" });

    /*
     * Past this point the password HAS changed and every session is dead.
     * A failure while issuing the replacement session must therefore not
     * report a generic 500: that tells the admin the change failed when the
     * opposite is true, and they would keep trying the old password. The
     * distinct code says what actually happened — sign in again with the
     * NEW password.
     */
    try {
      const { token, csrfToken, cookieMaxAgeSeconds } = await createSession(user.id);
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(cookieMaxAgeSeconds));
      cookieStore.set(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions(cookieMaxAgeSeconds));
    } catch (error) {
      console.error("POST /api/admin/password: password changed but re-session failed", error);
      return jsonError(
        500,
        "Kata laluan telah ditukar, tetapi sesi baharu gagal dibuat. Sila log masuk semula.",
        undefined,
        "password_changed_relogin",
      );
    }

    return jsonOk();
  } catch (error) {
    console.error("POST /api/admin/password: failed", error);
    return jsonError(500, API_ERRORS.serverError, undefined, ADMIN_ERROR_CODES.serverError);
  }
}
