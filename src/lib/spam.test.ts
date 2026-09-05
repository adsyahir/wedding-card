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
  const NOW = Date.parse("2026-01-15T12:00:00.000Z");

  it("is true when renderedAt is not a string", () => {
    expect(isTooFast(undefined, NOW)).toBe(true);
    expect(isTooFast(12345, NOW)).toBe(true);
    expect(isTooFast(null, NOW)).toBe(true);
  });

  it("is true when renderedAt is unparseable", () => {
    expect(isTooFast("not-a-date", NOW)).toBe(true);
  });

  it("is true when renderedAt is in the future", () => {
    const future = new Date(NOW + 1000).toISOString();
    expect(isTooFast(future, NOW)).toBe(true);
  });

  it("is true when submitted faster than minMs after render (default 2000ms)", () => {
    const renderedAt = new Date(NOW - 1000).toISOString();
    expect(isTooFast(renderedAt, NOW)).toBe(true);
  });

  it("is false right at the minMs boundary", () => {
    const renderedAt = new Date(NOW - 2000).toISOString();
    expect(isTooFast(renderedAt, NOW, 2000)).toBe(false);
  });

  it("is false for a plausible human fill time", () => {
    const renderedAt = new Date(NOW - 15_000).toISOString();
    expect(isTooFast(renderedAt, NOW)).toBe(false);
  });

  it("is false right at the 12-hour staleness boundary", () => {
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    const renderedAt = new Date(NOW - twelveHoursMs).toISOString();
    expect(isTooFast(renderedAt, NOW)).toBe(false);
  });

  it("is true just past the 12-hour staleness boundary", () => {
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    const renderedAt = new Date(NOW - twelveHoursMs - 1000).toISOString();
    expect(isTooFast(renderedAt, NOW)).toBe(true);
  });

  it("respects a custom minMs", () => {
    const renderedAt = new Date(NOW - 500).toISOString();
    expect(isTooFast(renderedAt, NOW, 1000)).toBe(true);
    expect(isTooFast(renderedAt, NOW, 100)).toBe(false);
  });
});
