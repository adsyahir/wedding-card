import { describe, expect, it } from "vitest";

import { sniffImageType } from "./image";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function fromString(s: string): Uint8Array {
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)));
}

describe("sniffImageType", () => {
  it("recognises a JPEG header", () => {
    const header = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
    expect(sniffImageType(header)).toBe("image/jpeg");
  });

  it("recognises a PNG header", () => {
    const header = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(sniffImageType(header)).toBe("image/png");
  });

  it("rejects a PNG-like header missing the trailing bytes", () => {
    const header = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a);
    expect(sniffImageType(header)).toBeNull();
  });

  it("recognises a WebP header (RIFF + WEBP)", () => {
    const header = new Uint8Array(16);
    header.set(fromString("RIFF"), 0);
    header.set([0x00, 0x00, 0x00, 0x00], 4); // file size, not validated
    header.set(fromString("WEBP"), 8);
    expect(sniffImageType(header)).toBe("image/webp");
  });

  it("rejects a bare RIFF/WAV file (RIFF without WEBP)", () => {
    const header = new Uint8Array(16);
    header.set(fromString("RIFF"), 0);
    header.set([0x00, 0x00, 0x00, 0x00], 4);
    header.set(fromString("WAVE"), 8);
    expect(sniffImageType(header)).toBeNull();
  });

  it("rejects an HTML document", () => {
    expect(sniffImageType(fromString("<!DOCTYPE html>"))).toBeNull();
  });

  it("rejects an SVG document, even though browsers render it as an image", () => {
    expect(sniffImageType(fromString("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
  });

  it("rejects a truncated 2-byte array", () => {
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });

  it("rejects an empty array", () => {
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });
});
