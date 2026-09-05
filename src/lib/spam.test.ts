import { describe, expect, it } from "vitest";

import { isHoneypotTripped, isTooFast } from "./spam";

describe("isHoneypotTripped", () => {
  it("is false for an empty string", () => {
    expect(isHoneypotTripped("")).toBe(false);
  });

  it("is false for undefined", () => {
    expect(isHoneypotTripped(undefined)).toBe(false);
  });

  it("is true for a non-empty string", () => {
    expect(isHoneypotTripped("http://spam.example")).toBe(true);
  });

  it("is false for non-string values", () => {
    expect(isHoneypotTripped(null)).toBe(false);
    expect(isHoneypotTripped(123)).toBe(false);
    expect(isHoneypotTripped(true)).toBe(false);
  });
});

describe("isTooFast", () => {
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

  it("is true when elapsedMs is not a number", () => {
    expect(isTooFast(undefined)).toBe(true);
    expect(isTooFast(null)).toBe(true);
    expect(isTooFast("5000")).toBe(true);
    expect(isTooFast(Number.NaN)).toBe(true);
    expect(isTooFast(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("is true for a negative duration", () => {
    expect(isTooFast(-1)).toBe(true);
  });

  it("is true below the default 2000ms threshold", () => {
    expect(isTooFast(0)).toBe(true);
    expect(isTooFast(1999)).toBe(true);
  });

  it("is false right at the minMs boundary", () => {
    expect(isTooFast(2000)).toBe(false);
  });

  it("is false for a plausible human fill time", () => {
    expect(isTooFast(15_000)).toBe(false);
  });

  it("is false right at the 12-hour staleness boundary", () => {
    expect(isTooFast(TWELVE_HOURS_MS)).toBe(false);
  });

  it("is true just past the 12-hour staleness boundary", () => {
    expect(isTooFast(TWELVE_HOURS_MS + 1)).toBe(true);
  });

  it("respects a custom minMs", () => {
    expect(isTooFast(500, 1000)).toBe(true);
    expect(isTooFast(500, 100)).toBe(false);
  });

  // Regression guard for the bug this signature exists to prevent: a guest
  // whose phone clock runs ahead of the server must NOT be silently dropped.
  it("is unaffected by client/server clock skew", () => {
    // 8 seconds of real fill time, measured on the client, is accepted no
    // matter how wrong that client's absolute clock is.
    expect(isTooFast(8000)).toBe(false);
  });
});
