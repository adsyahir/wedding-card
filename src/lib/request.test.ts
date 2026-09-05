import { describe, expect, it } from "vitest";

import { getClientIp, getUserAgent, isSameOrigin } from "./request";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/rsvp", {
    method: "POST",
    headers,
  });
}

describe("getClientIp", () => {
  it("prefers CF-Connecting-IP", () => {
    const request = makeRequest({ "CF-Connecting-IP": "1.2.3.4" });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("does NOT let a forged X-Forwarded-For override CF-Connecting-IP", () => {
    // A client can set X-Forwarded-For to anything (including someone
    // else's IP) — CF-Connecting-IP is set by Cloudflare's edge and must
    // always win when both are present.
    const request = makeRequest({
      "CF-Connecting-IP": "1.2.3.4",
      "X-Forwarded-For": "9.9.9.9, 1.1.1.1",
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("falls back to the first X-Forwarded-For entry when CF-Connecting-IP is absent", () => {
    const request = makeRequest({ "X-Forwarded-For": "9.9.9.9, 1.1.1.1" });
    expect(getClientIp(request)).toBe("9.9.9.9");
  });

  it("falls back to 0.0.0.0 when neither header is present", () => {
    const request = makeRequest({});
    expect(getClientIp(request)).toBe("0.0.0.0");
  });
});

describe("getUserAgent", () => {
  it("returns the User-Agent header value", () => {
    const request = makeRequest({ "User-Agent": "TestAgent/1.0" });
    expect(getUserAgent(request)).toBe("TestAgent/1.0");
  });

  it("returns an empty string when absent", () => {
    const request = makeRequest({});
    expect(getUserAgent(request)).toBe("");
  });

  it("truncates to 512 characters", () => {
    const longUa = "A".repeat(1000);
    const request = makeRequest({ "User-Agent": longUa });
    expect(getUserAgent(request)).toHaveLength(512);
  });
});

describe("isSameOrigin", () => {
  it("is true when Origin's host matches Host", () => {
    const request = makeRequest({
      Origin: "https://example.com",
      Host: "example.com",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("is false when Origin's host differs from Host", () => {
    const request = makeRequest({
      Origin: "https://evil.example",
      Host: "example.com",
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("is true when Origin is absent (Safari/in-app browsers may omit it)", () => {
    const request = makeRequest({ Host: "example.com" });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("is false when Origin is present but Host is missing", () => {
    const request = makeRequest({ Origin: "https://example.com" });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("is false when Origin is unparseable", () => {
    const request = makeRequest({ Origin: "not-a-url", Host: "example.com" });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("is true when both Origin and Host carry the same non-default port", () => {
    const request = makeRequest({
      Origin: "https://example.com:8443",
      Host: "example.com:8443",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("is false when Origin and Host carry different ports", () => {
    const request = makeRequest({
      Origin: "https://example.com:8443",
      Host: "example.com:9000",
    });
    expect(isSameOrigin(request)).toBe(false);
  });
});
