import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { visitorHash } from "./crypto";

/**
 * Helpers for safely reading things off an incoming `Request` in the
 * Cloudflare Workers runtime. Every function here is defensive about
 * missing/forged headers — this is the boundary where an attacker has full
 * control over what's sent, so nothing here may throw on a malformed input
 * or trust a header a client can set itself.
 */

const MAX_USER_AGENT_LEN = 512;

/**
 * Best-effort client IP.
 *
 * `CF-Connecting-IP` is set by Cloudflare's edge itself and cannot be
 * spoofed by the client (Cloudflare overwrites/strips any client-supplied
 * copy of it before the request reaches the Worker). `X-Forwarded-For`, in
 * contrast, is a plain request header — any client can set it to anything,
 * including someone else's real IP — so it is only ever used as a fallback
 * for environments where `CF-Connecting-IP` is absent (e.g. some local dev
 * setups), never given priority over it.
 */
export function getClientIp(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "0.0.0.0";
}

/** The `User-Agent` header, or `""` if absent, truncated to a bounded length. */
export function getUserAgent(request: Request): string {
  const ua = request.headers.get("User-Agent") ?? "";
  return ua.slice(0, MAX_USER_AGENT_LEN);
}

/**
 * Computes the anonymous per-day visitor hash for `request`, using the
 * `ANALYTICS_SALT` secret. See `visitorHash` in `src/lib/crypto.ts` for what
 * makes this safe to persist.
 */
export async function getRequestVisitorHash(request: Request): Promise<string> {
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);
  const secret = getSecret("ANALYTICS_SALT");
  return visitorHash(ip, userAgent, secret);
}

/**
 * Same-origin check for state-changing POSTs, used as a lightweight CSRF
 * defense (these public endpoints have no session/cookie to attach a
 * traditional CSRF token to).
 *
 * Deliberate tradeoff: a *missing* `Origin` header returns `true` (allowed).
 * Safari's private mode, some in-app/WebView browsers, and notably
 * WhatsApp's in-app browser (a huge share of traffic for a wedding invite
 * shared over WhatsApp) are known to omit `Origin` on same-origin POSTs in
 * some configurations. Treating "missing" as "same-origin" trades a small
 * amount of CSRF hardening for not breaking RSVPs for real guests. A
 * *present but mismatched* `Origin` is unambiguous evidence of a cross-site
 * request and is always rejected.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  const host = request.headers.get("Host");
  if (!host) return false;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    // Unparseable Origin header — treat as a mismatch.
    return false;
  }
}

/**
 * Names of the string-valued secrets/vars this app reads out of the
 * Cloudflare env (as opposed to bindings like D1/R2/Fetcher). Extend this
 * union — and `src/types/cloudflare-env.d.ts` — when a new secret is added.
 */
type SecretName = "ANALYTICS_SALT" | "CRON_SECRET";

/**
 * Reads a secret from the Cloudflare env, throwing a clear (but
 * value-free) error if it's missing. Never logs or includes the secret's
 * value in the thrown error.
 */
export function getSecret(name: SecretName): string {
  const { env } = getCloudflareContext();
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}
