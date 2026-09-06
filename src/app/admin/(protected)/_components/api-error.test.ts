import { describe, expect, it } from "vitest";

import { getAdminDict } from "@/lib/i18n/admin-dict";

import { localizeApiError, localizeFieldError, localizeFieldErrors } from "./api-error";

describe("localizeApiError", () => {
  it("maps a known code to the localized (ms) message", () => {
    const dict = getAdminDict("ms");
    expect(localizeApiError(dict, { error: "Rekod tidak dijumpai.", code: "not_found" })).toBe(
      dict.errors_notFound,
    );
  });

  it("maps a known code to the localized (en) message", () => {
    const dict = getAdminDict("en");
    expect(localizeApiError(dict, { error: "Rekod tidak dijumpai.", code: "not_found" })).toBe(
      "Record not found.",
    );
  });

  it("maps a route-specific ad-hoc code", () => {
    const dict = getAdminDict("en");
    expect(
      localizeApiError(dict, {
        error: "Galeri sudah penuh. Padam gambar sedia ada sebelum memuat naik lagi.",
        code: "gallery_full",
      }),
    ).toBe(dict.errors_galleryFull);
  });

  it("falls back to the server's error string when the code is unknown", () => {
    const dict = getAdminDict("en");
    expect(localizeApiError(dict, { error: "Some new Malay message.", code: "brand_new_code" })).toBe(
      "Some new Malay message.",
    );
  });

  it("falls back to the server's error string when there is no code at all", () => {
    const dict = getAdminDict("en");
    expect(localizeApiError(dict, { error: "Some Malay message." })).toBe("Some Malay message.");
  });

  it("falls back to the generic unexpected-error string when data is null", () => {
    const dict = getAdminDict("en");
    expect(localizeApiError(dict, null)).toBe(dict.common_unexpectedError);
  });
});

describe("localizeFieldError", () => {
  const ms = getAdminDict("ms");
  const en = getAdminDict("en");

  it("maps a known code to the localized string", () => {
    expect(localizeFieldError(en, "url_must_be_https")).toBe("URL must use https:");
    expect(localizeFieldError(ms, "url_must_be_https")).toBe("URL mesti menggunakan https:");
    expect(localizeFieldError(en, "phone_invalid")).toBe("Not a valid Malaysian phone number");
  });

  it("collapses an unknown code (e.g. a raw Zod default) to the generic string", () => {
    expect(localizeFieldError(en, "Invalid input: expected string, received undefined")).toBe(
      "Invalid value",
    );
    expect(localizeFieldError(ms, "something_unmapped")).toBe("Nilai tidak sah");
  });

  it("returns undefined for no code", () => {
    expect(localizeFieldError(en, undefined)).toBeUndefined();
  });

  it("localizes a whole record and never emits a raw code", () => {
    const out = localizeFieldErrors(en, {
      "venue.googleMapsUrl": "url_must_be_https",
      "contacts.0.phone": "phone_invalid",
      "venue.name": "Invalid input: expected string, received undefined",
    });
    expect(out).toEqual({
      "venue.googleMapsUrl": "URL must use https:",
      "contacts.0.phone": "Not a valid Malaysian phone number",
      "venue.name": "Invalid value",
    });
    expect(Object.values(out).some((v) => v.includes("_"))).toBe(false);
  });
});
