import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_WINDOW_SECONDS,
  computeNewSessionExpiry,
  computeSlidingIdleExpiry,
  IDLE_WINDOW_SECONDS,
  isSessionExpired,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "./session";

describe("computeNewSessionExpiry", () => {
  it("sets idleExpiresAt 2h and absoluteExpiresAt 12h after `now`", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { idleExpiresAt, absoluteExpiresAt } = computeNewSessionExpiry(now);

    expect(idleExpiresAt).toEqual(new Date("2026-01-01T02:00:00.000Z"));
    expect(absoluteExpiresAt).toEqual(new Date("2026-01-01T12:00:00.000Z"));
  });
});

describe("computeSlidingIdleExpiry", () => {
  it("slides idleExpiresAt forward by 2h from `now`", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const absoluteExpiresAt = new Date("2026-01-01T12:00:00.000Z");

    expect(computeSlidingIdleExpiry(now, absoluteExpiresAt)).toEqual(
      new Date("2026-01-01T02:00:00.000Z"),
    );
  });

  it("never slides past absoluteExpiresAt, even if now + 2h would exceed it", () => {
    // 11h into the session's life — 2h more would be 13h, past the 12h cap.
    const now = new Date("2026-01-01T11:00:00.000Z");
    const absoluteExpiresAt = new Date("2026-01-01T12:00:00.000Z");

    expect(computeSlidingIdleExpiry(now, absoluteExpiresAt)).toEqual(absoluteExpiresAt);
  });

  it("is capped exactly at the boundary (now + 2h === absolute)", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const absoluteExpiresAt = new Date("2026-01-01T12:00:00.000Z");

    expect(computeSlidingIdleExpiry(now, absoluteExpiresAt)).toEqual(absoluteExpiresAt);
  });
});

describe("isSessionExpired", () => {
  const idleExpiresAt = new Date("2026-01-01T02:00:00.000Z");
  const absoluteExpiresAt = new Date("2026-01-01T12:00:00.000Z");

  it("is false for a fresh, non-revoked session", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(isSessionExpired({ idleExpiresAt, absoluteExpiresAt, revokedAt: null }, now)).toBe(
      false,
    );
  });

  it("is true once idleExpiresAt has passed", () => {
    const now = new Date("2026-01-01T02:00:00.001Z");
    expect(isSessionExpired({ idleExpiresAt, absoluteExpiresAt, revokedAt: null }, now)).toBe(
      true,
    );
  });

  it("is true once absoluteExpiresAt has passed, even if idleExpiresAt has not", () => {
    const now = new Date("2026-01-01T13:00:00.000Z");
    const stillValidIdle = new Date("2026-01-01T14:00:00.000Z"); // hypothetically slid forward
    expect(
      isSessionExpired(
        { idleExpiresAt: stillValidIdle, absoluteExpiresAt, revokedAt: null },
        now,
      ),
    ).toBe(true);
  });

  it("is true when revokedAt is set, even within both windows", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(
      isSessionExpired(
        { idleExpiresAt, absoluteExpiresAt, revokedAt: new Date("2025-12-31T00:00:00.000Z") },
        now,
      ),
    ).toBe(true);
  });
});

describe("session cookie", () => {
  it("uses the __Host- prefixed name", () => {
    expect(SESSION_COOKIE_NAME).toBe("__Host-wc_session");
  });

  it("sets httpOnly, secure, sameSite=lax, path=/, and the idle-window maxAge by default", () => {
    const options = sessionCookieOptions();
    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: IDLE_WINDOW_SECONDS,
    });
  });

  it("accepts a custom maxAge (e.g. 0 for clearing the cookie on logout)", () => {
    expect(sessionCookieOptions(0).maxAge).toBe(0);
  });
});

describe("window constants", () => {
  it("idle window is 2 hours, absolute window is 12 hours", () => {
    expect(IDLE_WINDOW_SECONDS).toBe(2 * 60 * 60);
    expect(ABSOLUTE_WINDOW_SECONDS).toBe(12 * 60 * 60);
  });
});
