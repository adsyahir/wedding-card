import { describe, expect, it } from "vitest";

import { checkRateLimit } from "./rate-limit";

/**
 * An in-memory stand-in for the real D1 upsert, used to unit-test
 * `checkRateLimit`'s bucket-key math and allow/deny transition without a
 * real database. Mirrors the real implementation's contract: increments
 * (or creates) the counter for `rowKey` and returns the new count.
 */
function makeFakeIncrementer() {
  const counts = new Map<string, number>();
  const calls: { rowKey: string; windowStart: Date }[] = [];

  const increment = async (rowKey: string, windowStart: Date): Promise<number> => {
    calls.push({ rowKey, windowStart });
    const next = (counts.get(rowKey) ?? 0) + 1;
    counts.set(rowKey, next);
    return next;
  };

  return { increment, calls, counts };
}

describe("checkRateLimit", () => {
  it("computes the bucket key as `${key}:${floor(nowSeconds / windowSeconds)}`", async () => {
    const { increment, calls } = makeFakeIncrementer();
    // 3661 seconds since epoch, 3600s window -> bucket 1
    const now = () => 3661 * 1000;

    await checkRateLimit("rsvp:abc", 3, 3600, { now, increment });

    expect(calls).toHaveLength(1);
    expect(calls[0].rowKey).toBe("rsvp:abc:1");
    expect(calls[0].windowStart).toEqual(new Date(3600 * 1000));
  });

  it("allows requests up to and including the limit", async () => {
    const { increment } = makeFakeIncrementer();
    const now = () => 0;

    const r1 = await checkRateLimit("k", 3, 3600, { now, increment });
    const r2 = await checkRateLimit("k", 3, 3600, { now, increment });
    const r3 = await checkRateLimit("k", 3, 3600, { now, increment });

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  it("denies the request that crosses the limit, with a Retry-After in seconds", async () => {
    const { increment } = makeFakeIncrementer();
    // 10 seconds into a 3600s window (bucket 0), so window ends at t=3600.
    const now = () => 10 * 1000;

    for (let i = 0; i < 3; i++) {
      await checkRateLimit("k", 3, 3600, { now, increment });
    }
    const fourth = await checkRateLimit("k", 3, 3600, { now, increment });

    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBe(3600 - 10);
  });

  it("resets once the window rolls over to a new bucket", async () => {
    const { increment } = makeFakeIncrementer();

    // Fill the limit in window bucket 0.
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("k", 3, 3600, { now: () => 10 * 1000, increment });
    }
    const stillInWindow = await checkRateLimit("k", 3, 3600, {
      now: () => 20 * 1000,
      increment,
    });
    expect(stillInWindow.allowed).toBe(false);

    // Now in the next window (bucket 1, e.g. t=3700s) -> fresh row, fresh count.
    const nextWindow = await checkRateLimit("k", 3, 3600, {
      now: () => 3700 * 1000,
      increment,
    });
    expect(nextWindow.allowed).toBe(true);
  });

  it("keeps separate counters for different keys", async () => {
    const { increment } = makeFakeIncrementer();
    const now = () => 0;

    for (let i = 0; i < 3; i++) {
      await checkRateLimit("visitorA", 3, 3600, { now, increment });
    }
    const otherVisitor = await checkRateLimit("visitorB", 3, 3600, { now, increment });

    expect(otherVisitor.allowed).toBe(true);
  });

  it("fails open (allowed: true) when the increment function throws", async () => {
    const throwingIncrement = async (): Promise<number> => {
      throw new Error("D1 is unavailable");
    };

    const result = await checkRateLimit("k", 1, 3600, {
      now: () => 0,
      increment: throwingIncrement,
    });

    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });
});
