import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { auditLog } from "@/db/schema";
import { constantTimeEqual, sha256Hex } from "@/lib/crypto";
import { isSameOrigin } from "@/lib/request";

import { SESSION_COOKIE_NAME, type ValidSession, validateSession } from "./session";

/**
 * The admin auth guard.
 *
 * `getAdminSession()` / `requireAdmin()` / `requireAdminApi()` are the ONLY
 * authority for whether a request is authenticated. `src/middleware.ts` also
 * redirects unauthenticated `/admin/*` requests, but only as a fast,
 * unauthenticated-looking UX shortcut (cookie-presence check, no DB call) —
 * it is NOT a security boundary. Every admin page and every admin API route
 * calls one of the functions below independently; never rely on middleware
 * alone to keep a page or route protected.
 */

/**
 * Reads the session cookie, validates it against the database, and returns
 * the session or `null`. Never throws — a malformed/missing cookie or a DB
 * error both simply result in "not logged in".
 */
export async function getAdminSession(): Promise<ValidSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    return await validateSession(token);
  } catch (error) {
    console.error("getAdminSession failed", error);
    return null;
  }
}

/**
 * Server-component guard: redirects to `/admin/login` when there is no
 * valid session, otherwise returns it. Call this at the top of every
 * guarded admin page/layout.
 */
export async function requireAdmin(): Promise<ValidSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

export type RequireAdminApiResult =
  | { ok: true; session: ValidSession }
  | { ok: false; response: Response };

/**
 * Route-handler guard for `/api/admin/*`. Returns the session on success, or
 * a ready-to-return `401`/`403` `Response` on failure.
 *
 * For every non-GET request, this ALSO enforces CSRF: the caller must send
 * an `X-CSRF-Token` header whose SHA-256 hash matches the session's stored
 * `csrfHash` (constant-time compare), AND the request must be same-origin.
 * Both checks must pass — either one failing is a 403. This is on top of,
 * not instead of, cookie-based session auth: the CSRF token is never
 * accepted as a substitute for a valid session cookie.
 */
export async function requireAdminApi(request: Request): Promise<RequireAdminApiResult> {
  const session = await getAdminSession();
  if (!session) {
    return { ok: false, response: unauthorizedResponse() };
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    if (!isSameOrigin(request)) {
      return { ok: false, response: forbiddenResponse() };
    }

    const csrfHeader = request.headers.get("X-CSRF-Token");
    if (!csrfHeader) {
      return { ok: false, response: forbiddenResponse() };
    }

    const csrfHeaderHash = await sha256Hex(csrfHeader);
    if (!constantTimeEqual(csrfHeaderHash, session.csrfHash)) {
      return { ok: false, response: forbiddenResponse() };
    }
  }

  return { ok: true, session };
}

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function forbiddenResponse(): Response {
  return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export type LogAuditInput = {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
};

/**
 * Inserts an audit-log row. Never throws into the caller — an audit-log
 * write failing must never break the admin action it's recording (e.g. a
 * login or logout must still succeed even if the audit table write fails);
 * the error is logged server-side and swallowed.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      ts: new Date(),
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
    });
  } catch (error) {
    console.error("logAudit failed", error);
  }
}
