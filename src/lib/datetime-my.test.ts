import { describe, expect, it } from "vitest";

import {
  formatMalayTime,
  isoToParts,
  malayDayName,
  malayDisplayDate,
  malayFullPreview,
  partsToIso,
} from "./datetime-my";

describe("isoToParts", () => {
  it("splits a +08:00 ISO string into picker values", () => {
    expect(isoToParts("2026-11-01T11:00:00+08:00")).toEqual({ date: "2026-11-01", time: "11:00" });
  });

  it("handles a deadline with seconds", () => {
    expect(isoToParts("2026-10-15T23:59:59+08:00")).toEqual({ date: "2026-10-15", time: "23:59" });
  });

  it("returns empty parts for junk rather than throwing", () => {
    for (const bad of ["", "not-a-date", "2026-11-01", undefined, null]) {
      expect(isoToParts(bad)).toEqual({ date: "", time: "" });
    }
  });
});

describe("partsToIso", () => {
  it("builds a +08:00 ISO string", () => {
    expect(partsToIso("2026-11-01", "11:00")).toBe("2026-11-01T11:00:00+08:00");
  });

  it("round-trips with isoToParts", () => {
    const iso = "2026-11-01T16:00:00+08:00";
    const parts = isoToParts(iso);
    expect(partsToIso(parts.date, parts.time)).toBe(iso);
  });

  it("returns empty for a half-filled form, so the schema rejects it", () => {
    expect(partsToIso("", "11:00")).toBe("");
    expect(partsToIso("2026-11-01", "")).toBe("");
    expect(partsToIso("01-11-2026", "11:00")).toBe("");
  });
});

describe("malayDayName", () => {
  it("names the weekday in Malay", () => {
    // 2026-11-01 is a Sunday.
    expect(malayDayName("2026-11-01")).toBe("Ahad");
    expect(malayDayName("2026-11-02")).toBe("Isnin");
    expect(malayDayName("2026-11-07")).toBe("Sabtu");
  });

  // Guards the bug this module exists to prevent: a hand-typed day name
  // drifting out of sync with the actual date.
  it("is independent of the host timezone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati"; // UTC+14
      expect(malayDayName("2026-11-01")).toBe("Ahad");
      process.env.TZ = "Pacific/Midway"; // UTC-11
      expect(malayDayName("2026-11-01")).toBe("Ahad");
    } finally {
      process.env.TZ = original;
    }
  });

  it("returns empty for junk", () => {
    expect(malayDayName("nope")).toBe("");
    expect(malayDayName("")).toBe("");
  });
});

describe("malayDisplayDate", () => {
  it("formats as DD Month YYYY in Malay", () => {
    expect(malayDisplayDate("2026-11-01")).toBe("01 November 2026");
    expect(malayDisplayDate("2026-03-09")).toBe("09 Mac 2026");
    expect(malayDisplayDate("2026-12-25")).toBe("25 Disember 2026");
  });

  it("returns empty for junk", () => {
    expect(malayDisplayDate("2026-13-01")).toBe("");
    expect(malayDisplayDate("")).toBe("");
  });
});

describe("formatMalayTime", () => {
  it("uses Malay day-parts", () => {
    expect(formatMalayTime("09:30")).toBe("9.30 pagi");
    expect(formatMalayTime("12:00")).toBe("12.00 tengah hari");
    expect(formatMalayTime("16:00")).toBe("4.00 petang");
    expect(formatMalayTime("20:15")).toBe("8.15 malam");
    expect(formatMalayTime("00:05")).toBe("12.05 pagi");
  });

  it("returns empty for junk", () => {
    expect(formatMalayTime("25:00")).toBe("");
    expect(formatMalayTime("bad")).toBe("");
  });
});

describe("malayFullPreview", () => {
  it("reads the way the card does", () => {
    expect(malayFullPreview("2026-11-01", "11:00")).toBe("Ahad, 01 November 2026, 11.00 pagi");
  });

  it("omits the time when there isn't one", () => {
    expect(malayFullPreview("2026-11-01", "")).toBe("Ahad, 01 November 2026");
  });

  it("returns empty when the date is unusable", () => {
    expect(malayFullPreview("", "11:00")).toBe("");
  });
});
