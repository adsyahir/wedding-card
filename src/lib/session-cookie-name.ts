/**
 * The session cookie's name, factored into its own zero-dependency module so
 * `src/middleware.ts` (which must stay lightweight — no DB/drizzle imports,
 * since it runs on every request including static-adjacent ones) can read
 * it without pulling in `src/lib/session.ts`'s D1/drizzle dependency chain.
 *
 * The `__Host-` prefix is a browser-enforced guarantee: a cookie with this
 * prefix is only ever accepted from a response that also sets `Secure`,
 * `Path=/`, and omits `Domain` — which means it can never be set (or
 * overwritten) by a sibling subdomain or a plain-http response. This is
 * strictly better than a same-site-only defense against subdomain takeover.
 *
 * `__Host-` requires `Secure`, and `Secure` cookies ARE accepted by browsers
 * over `http://localhost` (localhost is treated as a secure context /
 * trustworthy origin by every major browser), so this name is used
 * unconditionally, including in local dev over `http://localhost:3000`.
 */
export const SESSION_COOKIE_NAME = "__Host-wc_session";
