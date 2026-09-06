import { describe, expect, it } from "vitest";

import { normalizeSiteUrl, resolveSiteUrl } from "./site-url";

describe("normalizeSiteUrl", () => {
  it("accepts an https origin and strips any path or trailing slash", () => {
    expect(normalizeSiteUrl("https://kahwin.adsyahir.com/")).toBe("https://kahwin.adsyahir.com");
    expect(normalizeSiteUrl("https://kahwin.adsyahir.com/some/path")).toBe(
      "https://kahwin.adsyahir.com",
    );
  });

  it("allows plain http only on localhost", () => {
    expect(normalizeSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
    // These URLs are handed to mail clients and crawlers; a real host must be https.
    expect(normalizeSiteUrl("http://kahwin.adsyahir.com")).toBeNull();
  });

  it("rejects anything that is not http(s)", () => {
    expect(normalizeSiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSiteUrl("ftp://example.com")).toBeNull();
  });

  it("rejects junk instead of trusting it", () => {
    expect(normalizeSiteUrl("not a url")).toBeNull();
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl(null)).toBeNull();
    expect(normalizeSiteUrl(undefined)).toBeNull();
  });
});

describe("resolveSiteUrl", () => {
  const file = "https://wedding-card-arif.workers.dev";

  it("prefers the deployment var over the file default", () => {
    expect(resolveSiteUrl("https://kahwin.adsyahir.com", file)).toBe(
      "https://kahwin.adsyahir.com",
    );
  });

  it("falls back to the file default when the var is unset", () => {
    expect(resolveSiteUrl(null, file)).toBe(file);
    expect(resolveSiteUrl("", file)).toBe(file);
  });

  it("ignores a malformed var rather than producing dead links", () => {
    // A typo must degrade to the file default, not become the href in an
    // email the family is expected to trust.
    expect(resolveSiteUrl("htps://typo.example", file)).toBe(file);
    expect(resolveSiteUrl("kahwin.adsyahir.com", file)).toBe(file);
  });
});
