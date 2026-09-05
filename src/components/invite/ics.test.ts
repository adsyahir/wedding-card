import { describe, expect, it } from "vitest";

import { buildIcs, escapeIcsText, foldIcsLine, toIcsUtcDate } from "./ics";

describe("escapeIcsText", () => {
  it("escapes commas, semicolons and backslashes", () => {
    expect(escapeIcsText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
  });

  it("escapes newlines as literal \\n", () => {
    expect(escapeIcsText("line1\nline2\r\nline3")).toBe("line1\\nline2\\nline3");
  });

  it("leaves plain text untouched", () => {
    expect(escapeIcsText("Dewan Serbaguna")).toBe("Dewan Serbaguna");
  });
});

describe("toIcsUtcDate", () => {
  it("converts an ISO datetime with +08:00 offset to a UTC ICS timestamp", () => {
    // 2026-11-01T11:00:00+08:00 is 2026-11-01T03:00:00Z
    expect(toIcsUtcDate("2026-11-01T11:00:00+08:00")).toBe("20261101T030000Z");
  });

  it("handles an ISO datetime already in UTC", () => {
    expect(toIcsUtcDate("2026-01-05T00:00:00Z")).toBe("20260105T000000Z");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines unfolded", () => {
    const line = "SUMMARY:Short line";
    expect(foldIcsLine(line)).toBe(line);
  });

  it("folds a line longer than 75 octets with a leading-space continuation", () => {
    const longValue = "A".repeat(100);
    const folded = foldIcsLine(`SUMMARY:${longValue}`);
    const parts = folded.split("\r\n");

    expect(parts.length).toBeGreaterThan(1);
    // Every continuation line after the first starts with a single space.
    for (const part of parts.slice(1)) {
      expect(part.startsWith(" ")).toBe(true);
    }
    // Rejoining (stripping the CRLF + leading space) reconstructs the original.
    const rejoined = parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("");
    expect(rejoined).toBe(`SUMMARY:${longValue}`);
  });

  it("never produces a physical line exceeding 75 octets", () => {
    const longValue = "x".repeat(200);
    const folded = foldIcsLine(`DESCRIPTION:${longValue}`);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
  });

  it("does not split multi-byte UTF-8 characters across a fold boundary", () => {
    // Malay text with no multibyte chars would never trigger this, so use a
    // string of repeated multi-byte characters (each 3 bytes in UTF-8) long
    // enough to force folding.
    const longValue = "美".repeat(60);
    const folded = foldIcsLine(`SUMMARY:${longValue}`);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8", { fatal: true });

    for (const part of folded.split("\r\n")) {
      const withoutLeadingSpace = part.startsWith(" ") ? part.slice(1) : part;
      // Decoding must not throw — a split surrogate/multi-byte char would
      // produce invalid UTF-8 bytes when re-encoded and decoded strictly.
      expect(() => decoder.decode(encoder.encode(withoutLeadingSpace))).not.toThrow();
    }
  });
});

describe("buildIcs", () => {
  const event = {
    uid: "wedding-card-arif@example.com",
    title: "Walimatul Urus Arif & Nur Aisyah",
    description: "Sila hadir ke majlis perkahwinan kami.",
    location: "Dewan Serbaguna Taman Seri Indah, Kajang, Selangor",
    startIso: "2026-11-01T11:00:00+08:00",
    endIso: "2026-11-01T16:00:00+08:00",
  };

  it("produces a well-formed VCALENDAR/VEVENT with CRLF line endings", () => {
    const ics = buildIcs(event);

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain(`UID:${event.uid}\r\n`);
    expect(ics).toContain("DTSTART:20261101T030000Z\r\n");
    expect(ics).toContain("DTEND:20261101T080000Z\r\n");
    expect(ics).toContain(`SUMMARY:${event.title}\r\n`);
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("escapes commas in the location", () => {
    const ics = buildIcs(event);
    expect(ics).toContain("LOCATION:Dewan Serbaguna Taman Seri Indah\\, Kajang\\, Selangor\r\n");
  });
});
