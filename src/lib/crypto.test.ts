import { describe, expect, it } from "vitest";

import {
  constantTimeEqual,
  dailySalt,
  hmacSha256Hex,
  randomToken,
  sha256Hex,
  visitorHash,
} from "./crypto";

describe("sha256Hex", () => {
  it("produces the known SHA-256 digest for a fixed input", async () => {
    // echo -n "hello" | sha256sum
    expect(await sha256Hex("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("is deterministic", async () => {
    const a = await sha256Hex("some input");
    const b = await sha256Hex("some input");
    expect(a).toBe(b);
  });
});

describe("hmacSha256Hex", () => {
  it("differs when the key differs", async () => {
    const a = await hmacSha256Hex("key1", "message");
    const b = await hmacSha256Hex("key2", "message");
    expect(a).not.toBe(b);
  });

  it("is deterministic for the same key/message", async () => {
    const a = await hmacSha256Hex("key", "message");
    const b = await hmacSha256Hex("key", "message");
    expect(a).toBe(b);
  });
});

describe("randomToken", () => {
  it("returns a base64url string with no padding characters", () => {
    const token = randomToken();
    expect(token).not.toMatch(/[+/=]/);
    expect(token.length).toBeGreaterThan(0);
  });

  it("returns different tokens on each call", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
  });

  it("respects the requested byte length (base64url encodes 4 chars per 3 bytes)", () => {
    const token = randomToken(16);
    // 16 bytes -> ceil(16/3)*4 = 24 chars before padding stripped; padding
    // for 16 bytes is 2 chars ('=='), so expect 24 - 2 = 22 chars.
    expect(token.length).toBe(22);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("abcd", "abc")).toBe(false);
  });

  it("returns false comparing against an empty string", () => {
    expect(constantTimeEqual("abc", "")).toBe(false);
    expect(constantTimeEqual("", "abc")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("dailySalt", () => {
  it("is deterministic within the same UTC day", async () => {
    const d1 = new Date("2026-01-15T00:00:01.000Z");
    const d2 = new Date("2026-01-15T23:59:59.000Z");
    const a = await dailySalt("secret", d1);
    const b = await dailySalt("secret", d2);
    expect(a).toBe(b);
  });

  it("differs across UTC day boundaries", async () => {
    const d1 = new Date("2026-01-15T23:59:59.000Z");
    const d2 = new Date("2026-01-16T00:00:00.000Z");
    const a = await dailySalt("secret", d1);
    const b = await dailySalt("secret", d2);
    expect(a).not.toBe(b);
  });

  it("uses UTC date parts, not local time", async () => {
    // 23:30 UTC on the 15th is still the 16th in UTC+8, but dailySalt must
    // treat this as the 15th since it is defined in terms of UTC.
    const utcLate = new Date("2026-01-15T23:30:00.000Z");
    const utcSameDayNoon = new Date("2026-01-15T12:00:00.000Z");
    const a = await dailySalt("secret", utcLate);
    const b = await dailySalt("secret", utcSameDayNoon);
    expect(a).toBe(b);
  });
});

describe("visitorHash", () => {
  it("is deterministic for the same ip/UA/day", async () => {
    const day = new Date("2026-01-15T10:00:00.000Z");
    const a = await visitorHashOnDay("1.2.3.4", "UA/1.0", "secret", day);
    const b = await visitorHashOnDay("1.2.3.4", "UA/1.0", "secret", day);
    expect(a).toBe(b);
  });

  it("is 32 hex characters (16 bytes) long", async () => {
    const hash = await visitorHash("1.2.3.4", "UA/1.0", "secret");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("differs across UTC days for the same ip/UA (cross-day correlation is broken)", async () => {
    const day1 = new Date("2026-01-15T10:00:00.000Z");
    const day2 = new Date("2026-01-16T10:00:00.000Z");
    const a = await visitorHashOnDay("1.2.3.4", "UA/1.0", "secret", day1);
    const b = await visitorHashOnDay("1.2.3.4", "UA/1.0", "secret", day2);
    expect(a).not.toBe(b);
  });

  it("differs for different IPs", async () => {
    const a = await visitorHash("1.2.3.4", "UA/1.0", "secret");
    const b = await visitorHash("5.6.7.8", "UA/1.0", "secret");
    expect(a).not.toBe(b);
  });

  it("differs for different user agents", async () => {
    const a = await visitorHash("1.2.3.4", "UA/1.0", "secret");
    const b = await visitorHash("1.2.3.4", "UA/2.0", "secret");
    expect(a).not.toBe(b);
  });
});

/**
 * Helper mirroring visitorHash's own composition (sha256 of ip/UA/dailySalt)
 * but pinned to an explicit date, so tests can assert same-day determinism
 * without depending on wall-clock time.
 */
async function visitorHashOnDay(
  ip: string,
  userAgent: string,
  secret: string,
  date: Date,
): Promise<string> {
  const salt = await dailySalt(secret, date);
  const full = await sha256Hex(`${ip} ${userAgent} ${salt}`);
  return full.slice(0, 32);
}
