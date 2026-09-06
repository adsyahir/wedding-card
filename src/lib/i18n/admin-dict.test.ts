import { describe, expect, it } from "vitest";

import { getAdminDict, interpolate, parseAdminLang } from "./admin-dict";

describe("parseAdminLang", () => {
  it("accepts 'ms'", () => {
    expect(parseAdminLang("ms")).toBe("ms");
  });

  it("accepts 'en'", () => {
    expect(parseAdminLang("en")).toBe("en");
  });

  it("falls back to 'ms' for an unrecognised value", () => {
    expect(parseAdminLang("fr")).toBe("ms");
  });

  it("falls back to 'ms' for an empty string", () => {
    expect(parseAdminLang("")).toBe("ms");
  });

  it("falls back to 'ms' when the cookie is missing (undefined)", () => {
    expect(parseAdminLang(undefined)).toBe("ms");
  });

  it("falls back to 'ms' when the cookie is null", () => {
    expect(parseAdminLang(null)).toBe("ms");
  });

  it("falls back to 'ms' for an adversarial value like '__proto__' — it cannot select anything outside the two dictionaries", () => {
    expect(parseAdminLang("__proto__")).toBe("ms");
  });

  it("falls back to 'ms' for other adversarial-looking values", () => {
    expect(parseAdminLang("constructor")).toBe("ms");
    expect(parseAdminLang("toString")).toBe("ms");
  });
});

describe("dictionary parity", () => {
  it("ms and en have exactly the same key set", () => {
    const ms = getAdminDict("ms");
    const en = getAdminDict("en");

    const msKeys = Object.keys(ms).sort();
    const enKeys = Object.keys(en).sort();

    expect(enKeys).toEqual(msKeys);
  });

  it("every value in both dictionaries is a non-empty string", () => {
    for (const lang of ["ms", "en"] as const) {
      const dict = getAdminDict(lang);
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value, `${lang}.${key} should be a string`).toBe("string");
        expect(value.length, `${lang}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });
});

describe("getAdminDict", () => {
  it("returns the ms dictionary for 'ms'", () => {
    expect(getAdminDict("ms").nav_rsvp).toBe("RSVP");
    expect(getAdminDict("ms").nav_ucapan).toBe("Ucapan");
  });

  it("returns the en dictionary for 'en'", () => {
    expect(getAdminDict("en").nav_ucapan).toBe("Wishes");
  });
});

describe("interpolate", () => {
  it("substitutes a single token", () => {
    expect(interpolate("{n} rekod", { n: 5 })).toBe("5 rekod");
  });

  it("substitutes multiple tokens", () => {
    expect(interpolate("Muka {page} / {total}", { page: 2, total: 10 })).toBe("Muka 2 / 10");
  });

  it("substitutes string values", () => {
    expect(interpolate("Hari: {day}", { day: "2026-11-01" })).toBe("Hari: 2026-11-01");
  });

  it("leaves unknown tokens untouched rather than throwing", () => {
    expect(interpolate("{known} and {unknown}", { known: "x" })).toBe("x and {unknown}");
  });

  it("leaves the template untouched when it has no tokens", () => {
    expect(interpolate("plain text", {})).toBe("plain text");
  });
});
