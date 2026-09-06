import { cookies } from "next/headers";

import { ADMIN_ERROR_CODES, API_ERRORS, jsonError, jsonOk } from "@/lib/api";
import { logAudit, requireAdminApi } from "@/lib/auth";
import {
  CSRF_COOKIE_NAME,
  csrfCookieOptions,
  revokeSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Logs the current admin out.
 *
 * Revokes the session server-side (in addition to clearing the cookie) —
 * this matters: if the raw token had already been captured (XSS, a shared
 * machine, a leaked log line), merely clearing the browser's cookie would
 * leave that captured token fully valid and reusable. Revoking it in the
 * database is what actually ends the session.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    // Guarded by requireAdminApi, so this should be unreachable in
    // practice, but fail safe rather than throwing.
    return jsonError(401, API_ERRORS.invalidRequest, undefined, ADMIN_ERROR_CODES.invalidRequest);
  }

  await revokeSession(token);
  cookieStore.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
  cookieStore.set(CSRF_COOKIE_NAME, "", csrfCookieOptions(0));

  await logAudit({ adminUserId: guard.session.adminUserId, action: "logout" });

  return jsonOk();
}
