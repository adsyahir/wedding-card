import { describe, expect, it } from "vitest";

import { wedding } from "@/config/wedding";

import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_SECTIONS,
  mergeWeddingConfig,
  mergeWeddingConfigDocs,
  resolveWeddingConfigFromRaw,
  weddingConfigDocSchema,
  type ResolvedWeddingConfig,
} from "./wedding-config";

function fileDefaults(): ResolvedWeddingConfig {
  return {
    ...wedding,
    sections: { ...DEFAULT_SECTIONS },
    notifications: { ...DEFAULT_NOTIFICATIONS },
  };
}

const validVenue = {
  name: "Dewan Baru",
  addressLines: ["Jalan Baru 1"],
  lat: 3.1,
  lng: 101.6,
  googleMapsUrl: "https://maps.google.com/?q=3.1,101.6",
  wazeUrl: "https://waze.com/ul?ll=3.1,101.6",
};

describe("weddingConfigDocSchema", () => {
  it("accepts a fully valid partial doc", () => {
    const result = weddingConfigDocSchema.safeParse({
      groom: { shortName: "Ali", fullName: "Ali bin Abu" },
      bride: { shortName: "Siti", fullName: "Siti binti Ahmad" },
      date: "2027-01-01T11:00:00+08:00",
      venue: validVenue,
      aturCara: [{ time: "10:00 AM", label: "Ketibaan" }],
      contacts: [{ name: "Ali", role: "Bapa", phone: "0123456789" }],
      sections: { ucapan: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a javascript: googleMapsUrl", () => {
    const result = weddingConfigDocSchema.safeParse({
      venue: { ...validVenue, googleMapsUrl: "javascript:alert(1)" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an http: (non-https) maps URL", () => {
    const result = weddingConfigDocSchema.safeParse({
      venue: { ...validVenue, googleMapsUrl: "http://google.com/?q=1,1" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a maps URL on a disallowed host", () => {
    const result = weddingConfigDocSchema.safeParse({
      venue: { ...validVenue, googleMapsUrl: "https://evil.example.com/?q=1,1" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a wazeUrl not on waze.com", () => {
    const result = weddingConfigDocSchema.safeParse({
      venue: { ...validVenue, wazeUrl: "https://notwaze.com/ul?ll=1,1" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed ISO date", () => {
    const result = weddingConfigDocSchema.safeParse({ date: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range latitude/longitude", () => {
    expect(
      weddingConfigDocSchema.safeParse({ venue: { ...validVenue, lat: 999 } }).success,
    ).toBe(false);
    expect(
      weddingConfigDocSchema.safeParse({ venue: { ...validVenue, lng: -999 } }).success,
    ).toBe(false);
  });

  it("rejects an aturCara array over 30 entries", () => {
    const aturCara = Array.from({ length: 31 }, (_, i) => ({ time: `${i}:00`, label: `Item ${i}` }));
    expect(weddingConfigDocSchema.safeParse({ aturCara }).success).toBe(false);
  });

  it("rejects a contacts array over 30 entries", () => {
    const contacts = Array.from({ length: 31 }, (_, i) => ({
      name: `Orang ${i}`,
      role: "Saksi",
      phone: "0123456789",
    }));
    expect(weddingConfigDocSchema.safeParse({ contacts }).success).toBe(false);
  });

  it("rejects an invalid phone number in contacts", () => {
    const result = weddingConfigDocSchema.safeParse({
      contacts: [{ name: "Ali", role: "Bapa", phone: "not-a-phone" }],
    });
    expect(result.success).toBe(false);
  });

  it("normalizes a valid local-format phone to E.164", () => {
    const result = weddingConfigDocSchema.safeParse({
      contacts: [{ name: "Ali", role: "Bapa", phone: "012-345 6789" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contacts?.[0]?.phone).toBe("+60123456789");
    }
  });

  it("accepts an empty object (nothing edited yet)", () => {
    expect(weddingConfigDocSchema.safeParse({}).success).toBe(true);
  });
});

describe("mergeWeddingConfig (deep-merge over file defaults)", () => {
  it("returns the file defaults unchanged when the partial is empty", () => {
    const merged = mergeWeddingConfig(fileDefaults(), {});
    expect(merged).toEqual(fileDefaults());
  });

  // Regression guard. `rsvpPaxMode` was validated by the schema but never
  // copied in here, so an admin could save a headcount mode, get a success
  // toast, and have the public card silently keep the old one. Validation
  // passing is not the same as the value arriving — every scalar field
  // needs a case here.
  it("merges every scalar field the schema accepts, not just the obvious ones", () => {
    const merged = mergeWeddingConfig(fileDefaults(), {
      rsvpPaxMode: "total",
      scriptFont: "greatVibes",
      hashtag: "#Merged",
    });
    expect(merged.rsvpPaxMode).toBe("total");
    expect(merged.scriptFont).toBe("greatVibes");
    expect(merged.hashtag).toBe("#Merged");
  });

  it("leaves scalar fields at their defaults when the partial omits them", () => {
    const merged = mergeWeddingConfig(fileDefaults(), {});
    expect(merged.rsvpPaxMode).toBe(wedding.rsvpPaxMode);
    expect(merged.scriptFont).toBe(wedding.scriptFont);
  });

  it("merges a partial doc's fields over the defaults, leaving the rest untouched", () => {
    const merged = mergeWeddingConfig(fileDefaults(), {
      groom: { shortName: "Ali", fullName: "Ali bin Abu" },
    });
    expect(merged.groom).toEqual({ shortName: "Ali", fullName: "Ali bin Abu" });
    // Untouched fields keep the file defaults.
    expect(merged.bride).toEqual(wedding.bride);
    expect(merged.venue).toEqual(wedding.venue);
    expect(merged.hashtag).toBe(wedding.hashtag);
  });

  it("merges `sections` key-by-key rather than replacing the whole object", () => {
    const merged = mergeWeddingConfig(fileDefaults(), { sections: { ucapan: false } });
    expect(merged.sections.ucapan).toBe(false);
    expect(merged.sections.kehadiran).toBe(true);
    expect(merged.sections.navRsvp).toBe(true);
  });
});

describe("mergeWeddingConfigDocs (persisted partial merges)", () => {
  it("merges a new section's edits over a previously-saved doc without discarding it", () => {
    const existing = { venue: validVenue, hashtag: "#Old" };
    const incoming = { hashtag: "#New" };
    const merged = mergeWeddingConfigDocs(existing, incoming);
    expect(merged.venue).toEqual(validVenue);
    expect(merged.hashtag).toBe("#New");
  });

  it("merges sections key-by-key across saves", () => {
    const existing = { sections: { ucapan: false } };
    const incoming = { sections: { kehadiran: false } };
    const merged = mergeWeddingConfigDocs(existing, incoming);
    expect(merged.sections).toEqual({ ucapan: false, kehadiran: false });
  });
});

describe("resolveWeddingConfigFromRaw (the 'must never break' fallback)", () => {
  it("returns the file defaults when there is no stored row", () => {
    expect(resolveWeddingConfigFromRaw(null)).toEqual(fileDefaults());
    expect(resolveWeddingConfigFromRaw(undefined)).toEqual(fileDefaults());
  });

  it("returns the file defaults unchanged when the stored value is not valid JSON", () => {
    expect(resolveWeddingConfigFromRaw("{not valid json")).toEqual(fileDefaults());
  });

  it("returns the file defaults unchanged when the stored doc fails schema validation", () => {
    const malformed = JSON.stringify({ venue: { ...validVenue, googleMapsUrl: "javascript:alert(1)" } });
    expect(resolveWeddingConfigFromRaw(malformed)).toEqual(fileDefaults());
  });

  it("merges a valid partial doc over the file defaults", () => {
    const raw = JSON.stringify({ hashtag: "#NewHashtag", sections: { ucapan: false } });
    const resolved = resolveWeddingConfigFromRaw(raw);
    expect(resolved.hashtag).toBe("#NewHashtag");
    expect(resolved.sections.ucapan).toBe(false);
    expect(resolved.sections.kehadiran).toBe(true);
    expect(resolved.groom).toEqual(wedding.groom);
  });
});

describe("section-toggle defaults", () => {
  it("defaults every section, nav and extra toggle to true", () => {
    for (const value of Object.values(DEFAULT_SECTIONS)) {
      expect(value).toBe(true);
    }
  });

  it("the resolved default config carries the expected section defaults", () => {
    expect(fileDefaults().sections).toEqual({
      undangan: true,
      lokasi: true,
      aturCara: true,
      countdown: true,
      galeri: true,
      ucapan: true,
      kehadiran: true,
      navKalendar: true,
      navLokasi: true,
      navHubungi: true,
      navRsvp: true,
      kalendarGrid: true,
      petaEmbed: true,
    });
  });
});

describe("notifications schema", () => {
  it("accepts a valid doc with two recipients", () => {
    const result = weddingConfigDocSchema.safeParse({
      notifications: {
        enabled: true,
        recipients: ["a@example.com", "b@example.com"],
        onRsvp: true,
        onUcapan: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it("lowercases and trims recipient emails", () => {
    const result = weddingConfigDocSchema.safeParse({
      notifications: {
        enabled: true,
        recipients: ["  Foo@Example.com  "],
        onRsvp: true,
        onUcapan: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notifications?.recipients).toEqual(["foo@example.com"]);
    }
  });

  it("rejects a third recipient rather than silently truncating", () => {
    const result = weddingConfigDocSchema.safeParse({
      notifications: {
        enabled: true,
        recipients: ["a@example.com", "b@example.com", "c@example.com"],
        onRsvp: true,
        onUcapan: true,
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = weddingConfigDocSchema.safeParse({
      notifications: {
        enabled: true,
        recipients: ["not-an-email"],
        onRsvp: true,
        onUcapan: true,
      },
    });
    expect(result.success).toBe(false);
  });

  it("defaults to disabled with no recipients when absent", () => {
    expect(DEFAULT_NOTIFICATIONS).toEqual({
      enabled: false,
      recipients: [],
    });
    expect(fileDefaults().notifications).toEqual(DEFAULT_NOTIFICATIONS);
  });

  it("replaces the whole notifications object wholesale when merging over file defaults", () => {
    const merged = mergeWeddingConfig(fileDefaults(), {
      notifications: { enabled: true, recipients: ["a@example.com"] },
    });
    expect(merged.notifications).toEqual({
      enabled: true,
      recipients: ["a@example.com"],
    });
  });
});
