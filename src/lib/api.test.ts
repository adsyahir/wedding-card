import { describe, expect, it } from "vitest";

import { API_ERRORS, jsonError, jsonOk, readJsonBody, toRecord } from "./api";

function makeJsonRequest(body: string, extraHeaders: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body,
  });
}

describe("jsonOk", () => {
  it("returns 200 with { ok: true } and no-store/nosniff headers", async () => {
    const response = jsonOk();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("jsonError", () => {
  it("returns the given status with { ok: false, error }", async () => {
    const response = jsonError(400, API_ERRORS.invalidInput);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: API_ERRORS.invalidInput });
  });

  it("carries no-store/nosniff headers on errors too", () => {
    const response = jsonError(500, API_ERRORS.serverError);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("passes through extra headers (e.g. Retry-After)", () => {
    const response = jsonError(429, API_ERRORS.tooManyRequests, { "Retry-After": "42" });
    expect(response.headers.get("Retry-After")).toBe("42");
  });
});

describe("toRecord", () => {
  it("returns the value unchanged for a plain object", () => {
    expect(toRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it("returns {} for null, arrays, and primitives", () => {
    expect(toRecord(null)).toEqual({});
    expect(toRecord(undefined)).toEqual({});
    expect(toRecord("string")).toEqual({});
    expect(toRecord(42)).toEqual({});
    expect(toRecord(["a"])).toEqual({});
  });
});

describe("readJsonBody", () => {
  it("rejects a missing/incorrect Content-Type", async () => {
    const request = new Request("https://example.com/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ a: 1 }),
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(API_ERRORS.invalidRequest);
    }
  });

  it("rejects a body whose declared Content-Length exceeds maxBytes", async () => {
    const request = makeJsonRequest("small-body", { "Content-Length": "99999" });
    const result = await readJsonBody(request, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("rejects a body whose actual streamed size exceeds maxBytes even without a Content-Length header", async () => {
    const bigPayload = JSON.stringify({ message: "x".repeat(1000) });
    const request = new Request("https://example.com/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bigPayload,
    });
    // Sanity check: no Content-Length header is present, so this exercises
    // the streamed-byte-count cap, not the header shortcut.
    expect(request.headers.get("Content-Length")).toBeNull();

    const result = await readJsonBody(request, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("rejects malformed JSON", async () => {
    const request = makeJsonRequest("{not valid json");
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(API_ERRORS.invalidRequest);
    }
  });

  it("parses a well-formed small JSON body", async () => {
    const request = makeJsonRequest(JSON.stringify({ name: "Ahmad", website: "" }));
    const result = await readJsonBody<{ name: string; website: string }>(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Ahmad", website: "" });
    }
  });

  it("accepts a Content-Type with a charset suffix", async () => {
    const request = makeJsonRequest(JSON.stringify({ a: 1 }), {
      "Content-Type": "application/json; charset=utf-8",
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(true);
  });
});
