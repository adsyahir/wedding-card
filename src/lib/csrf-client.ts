"use client";

/**
 * Client-side helper for attaching the CSRF token to admin mutations.
 *
 * The token lives in the `__Host-wc_csrf` cookie (set at login, see
 * `src/app/api/admin/login/route.ts` and `csrfCookieOptions` in
 * `src/lib/session.ts`) rather than `sessionStorage` — a cookie is shared
 * across every tab of the browser, so a session started in one tab works
 * immediately in a freshly-opened second tab, and after navigating back to
 * an admin page in a new tab while the session cookie is still valid.
 *
 * Reading `document.cookie` can throw in some locked-down browser contexts
 * (or simply return "" pre-hydration) — every function here is defensive
 * about that and never throws.
 */

const CSRF_COOKIE_NAME = "__Host-wc_csrf";

/** Reads the raw CSRF token out of its cookie, or `""` if unavailable. */
export function getCsrfToken(): string {
  try {
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    for (const entry of cookies) {
      const eq = entry.indexOf("=");
      if (eq === -1) continue;
      const name = entry.slice(0, eq);
      if (name === CSRF_COOKIE_NAME) {
        return decodeURIComponent(entry.slice(eq + 1));
      }
    }
    return "";
  } catch {
    return "";
  }
}

/** `{ "X-CSRF-Token": <token> }`, ready to spread into a `fetch` `headers` object. */
export function csrfHeaders(): Record<string, string> {
  return { "X-CSRF-Token": getCsrfToken() };
}
