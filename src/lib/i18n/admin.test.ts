import { describe, expect, it, vi } from "vitest";

// `getAdminLang` reads the cookie via `next/headers`'s `cookies()`. Mock it
// per-test so we control exactly what "cookie" the function sees, without
// spinning up a real Next.js request.
let mockCookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "wc_admin_lang" && mockCookieValue !== undefined
        ? { value: mockCookieValue }
        : undefined,
  }),
}));

const { getAdminLang } = await import("./admin");

describe("getAdminLang", () => {
  it("returns 'ms' when the cookie is 'ms'", async () => {
    mockCookieValue = "ms";
    expect(await getAdminLang()).toBe("ms");
  });

  it("returns 'en' when the cookie is 'en'", async () => {
    mockCookieValue = "en";
    expect(await getAdminLang()).toBe("en");
  });

  it("falls back to 'ms' for an invalid value ('fr')", async () => {
    mockCookieValue = "fr";
    expect(await getAdminLang()).toBe("ms");
  });

  it("falls back to 'ms' for an empty string", async () => {
    mockCookieValue = "";
    expect(await getAdminLang()).toBe("ms");
  });

  it("falls back to 'ms' when the cookie is missing entirely", async () => {
    mockCookieValue = undefined;
    expect(await getAdminLang()).toBe("ms");
  });

  it("falls back to 'ms' for an adversarial value like '__proto__'", async () => {
    mockCookieValue = "__proto__";
    expect(await getAdminLang()).toBe("ms");
  });
});
