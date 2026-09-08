import "server-only";

import { and, eq, isNull, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { sessions } from "@/db/schema";

import { randomToken, sha256Hex } from "./crypto";
import { SESSION_COOKIE_NAME } from "./session-cookie-name";

export { SESSION_COOKIE_NAME };

/**
 * Admin session management, backed by the `sessions` D1 table.
 *
 * Only a SHA-256 hash of the session token (and of the CSRF token) is ever
 * persisted — see `sessions.id` / `sessions.csrfHash` in `src/db/schema.ts`.
 * The raw token/csrfToken values are handed back to the caller exactly once
 * (at creation, to be set as a cookie / returned to the client) and are
 * never logged or stored anywhere.
 */

const IDLE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const ABSOLUTE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

/*
 * "Ingat saya" windows.
 *
 * A remembered session trades security for the family not re-typing a
 * password every afternoon during the run-up to the wedding. It is a
 * deliberate trade, kept honest three ways: it is opt-in per login, never
 * the default; it still has a hard 30-day ceiling rather than being
 * endless; and logout still revokes it server-side, so "remember me" can
 * always be undone from any device that has the session.
 *
 * Idle and absolute are equal here on purpose. A shorter idle window would
 * log out exactly the person who asked not to be logged out.
 */
const REMEMBER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type CreatedSession = {
  token: string;
  csrfToken: string;
  /** How long the cookies should live: the session's absolute window. */
  cookieMaxAgeSeconds: number;
};
export type ValidSession = { adminUserId: string; csrfHash: string };

/**
 * Pure expiry arithmetic, factored out so it's unit-testable with an
 * injectable clock and without touching D1 (mirrors the
 * `RateLimitIncrementer` seam in `src/lib/rate-limit.ts`).
 */

/**
 * The expiry fields for a brand-new session created at `now`.
 *
 * `idleWindowSeconds` is returned (and stored) rather than re-read from a
 * constant later, because the two kinds of session slide by different
 * amounts — see `REMEMBER_WINDOW_MS`.
 */
export function computeNewSessionExpiry(
  now: Date,
  remember = false,
): {
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  idleWindowSeconds: number;
} {
  const idleMs = remember ? REMEMBER_WINDOW_MS : IDLE_WINDOW_MS;
  const absoluteMs = remember ? REMEMBER_WINDOW_MS : ABSOLUTE_WINDOW_MS;

  return {
    idleExpiresAt: new Date(now.getTime() + idleMs),
    absoluteExpiresAt: new Date(now.getTime() + absoluteMs),
    idleWindowSeconds: idleMs / 1000,
  };
}

/**
 * True when a session with the given expiry/revocation fields must be
 * treated as invalid at `now`: revoked, past its idle expiry, or past its
 * absolute expiry.
 */
export function isSessionExpired(
  row: { idleExpiresAt: Date; absoluteExpiresAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  if (row.revokedAt) return true;
  if (row.idleExpiresAt.getTime() <= now.getTime()) return true;
  if (row.absoluteExpiresAt.getTime() <= now.getTime()) return true;
  return false;
}

/**
 * The slid-forward `idleExpiresAt` for a still-valid session being used at
 * `now`: `now + idleWindowSeconds`, capped so it never exceeds
 * `absoluteExpiresAt` — a session can be kept alive by continuous use for
 * up to the absolute window, never longer.
 *
 * The window comes from the session row, not a constant: a remembered
 * session slides by 30 days, an ordinary one by 2 hours.
 */
export function computeSlidingIdleExpiry(
  now: Date,
  absoluteExpiresAt: Date,
  idleWindowSeconds: number,
): Date {
  return new Date(Math.min(now.getTime() + idleWindowSeconds * 1000, absoluteExpiresAt.getTime()));
}

/**
 * Creates a new session row for `adminUserId` and returns the raw token and
 * CSRF token. These are the ONLY time the raw values exist outside the
 * caller's immediate use (setting the cookie / response body) — from this
 * point on, only their hashes exist, in the database.
 */
export async function createSession(
  adminUserId: string,
  remember = false,
): Promise<CreatedSession> {
  const token = randomToken(32);
  const csrfToken = randomToken(32);

  const [tokenHash, csrfHash] = await Promise.all([sha256Hex(token), sha256Hex(csrfToken)]);

  const now = new Date();
  const { idleExpiresAt, absoluteExpiresAt, idleWindowSeconds } = computeNewSessionExpiry(
    now,
    remember,
  );

  const db = getDb();
  await db.insert(sessions).values({
    id: tokenHash,
    adminUserId,
    csrfHash,
    createdAt: now,
    idleExpiresAt,
    absoluteExpiresAt,
    idleWindowSeconds,
  });

  // The cookie lives as long as the session possibly can; the SERVER decides
  // when it is actually dead. A cookie that expired sooner would log out an
  // admin who was still actively using the dashboard, which is exactly what
  // sliding the idle expiry exists to prevent.
  return { token, csrfToken, cookieMaxAgeSeconds: Math.floor((absoluteExpiresAt.getTime() - now.getTime()) / 1000) };
}

/**
 * Validates a raw session token: looks it up by its hash, rejects a
 * revoked/idle-expired/absolute-expired session, and — on success —
 * slides `idleExpiresAt` forward (see `computeSlidingIdleExpiry`).
 *
 * Returns `null` for any invalid/expired/revoked session rather than
 * throwing — callers (the auth guard) treat `null` as "not logged in".
 */
export async function validateSession(token: string): Promise<ValidSession | null> {
  const tokenHash = await sha256Hex(token);
  const db = getDb();

  const [row] = await db.select().from(sessions).where(eq(sessions.id, tokenHash)).limit(1);
  if (!row) return null;

  const now = new Date();
  if (isSessionExpired(row, now)) return null;

  const newIdleExpiresAt = computeSlidingIdleExpiry(
    now,
    row.absoluteExpiresAt,
    row.idleWindowSeconds,
  );

  await db
    .update(sessions)
    .set({ idleExpiresAt: newIdleExpiresAt })
    .where(eq(sessions.id, tokenHash));

  return { adminUserId: row.adminUserId, csrfHash: row.csrfHash };
}

/**
 * Revokes every live session belonging to one admin, and reports how many.
 *
 * Used after a password change: the point of changing a password is to cut
 * off whoever might have had the old one, and leaving their existing
 * sessions alive would do exactly nothing about that. The admin doing the
 * change gets a fresh session immediately, so only OTHER devices are
 * signed out.
 */
export async function revokeAllSessionsForUser(adminUserId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.adminUserId, adminUserId), isNull(sessions.revokedAt)));
}

/** Revokes a session by its raw token (used by logout). */
export async function revokeSession(token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, tokenHash), isNull(sessions.revokedAt)));
}

/**
 * Revokes every non-revoked session belonging to `adminUserId`. Not called
 * anywhere yet — for a future password-change flow, where every existing
 * session must be invalidated the moment the password changes.
 */
export async function revokeAllSessionsFor(adminUserId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.adminUserId, adminUserId), isNull(sessions.revokedAt)));
}

/**
 * Deletes session rows whose absolute expiry has passed. Not called from
 * anywhere yet — wired up by the Phase 7 cron job (mirrors
 * `pruneRateLimits` in `src/lib/rate-limit.ts`).
 */
export async function pruneExpiredSessions(): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.absoluteExpiresAt, now));
}

/**
 * Cookie attributes for setting the session cookie. `maxAge` is the idle
 * window (in seconds) — the cookie's own lifetime is a courtesy for the
 * browser to stop sending it; the server-side idle/absolute expiry checks
 * in `validateSession` are the actual authority.
 */
export function sessionCookieOptions(maxAgeSeconds = IDLE_WINDOW_MS / 1000) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * The `__Host-` companion cookie carrying the RAW csrf token, set alongside
 * the (httpOnly) session cookie at login.
 *
 * This is the standard double-submit-cookie pattern, and it is what makes
 * the CSRF token available to JavaScript in ANY tab of the browser — not
 * just the tab that happened to be open at login time, which is the bug
 * `sessionStorage` (per-tab) had. It's safe to make this cookie readable by
 * JS (`httpOnly: false`):
 *
 * - Same-origin policy stops another origin's script from reading it.
 * - Possessing the raw token alone proves nothing: `requireAdminApi`
 *   (`src/lib/auth.ts`) hashes whatever arrives in the `X-CSRF-Token` header
 *   and compares it against the session's stored `csrfHash` — a request
 *   still needs the (httpOnly) session cookie to have a session to check
 *   against in the first place.
 * - A cross-site attacker can trigger a cookie-bearing request but cannot
 *   read this cookie's value (that's the entire CSRF threat model), so they
 *   can never produce a matching `X-CSRF-Token` header.
 *
 * Uses the same `maxAge` as the session cookie so the two expire together.
 */
export const CSRF_COOKIE_NAME = "__Host-wc_csrf";

export function csrfCookieOptions(maxAgeSeconds = IDLE_WINDOW_MS / 1000) {
  return {
    httpOnly: false,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export const IDLE_WINDOW_SECONDS = IDLE_WINDOW_MS / 1000;
export const ABSOLUTE_WINDOW_SECONDS = ABSOLUTE_WINDOW_MS / 1000;
