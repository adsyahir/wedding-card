import { describe, expect, it } from "vitest";

import { getAdminDict } from "@/lib/i18n/admin-dict";

import { localizeApiError } from "./api-error";

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
