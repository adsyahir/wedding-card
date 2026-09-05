import { describe, expect, it } from "vitest";

import { sniffAudioType } from "./audio";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function fromString(s: string): Uint8Array {
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)));
}

describe("sniffAudioType", () => {
  it("recognises an ID3v2-tagged MP3 header", () => {
    // "ID3" + version bytes + flags + size, then arbitrary frame data.
    const header = bytes(0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21);
    expect(sniffAudioType(header)).toBe("audio/mpeg");
  });

  it("recognises a bare MPEG frame-sync header (no ID3 tag)", () => {
    // 0xFF 0xFB is a common MPEG-1 Layer III frame sync + header byte.
    const header = bytes(0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00);
    expect(sniffAudioType(header)).toBe("audio/mpeg");
  });

  it("rejects 0xFF followed by a byte without the top three bits set", () => {
    // 0x0F = 0000 1111 — none of the top three bits are set.
    const header = bytes(0xff, 0x0f, 0x00, 0x00);
    expect(sniffAudioType(header)).toBeNull();
  });

  for (const brand of ["M4A ", "mp42", "isom", "mp41"]) {
    it(`recognises the MP4/M4A brand "${brand}"`, () => {
      const header = new Uint8Array(16);
      // Bytes 0-4: box size (arbitrary, not validated by the sniffer).
      header.set([0x00, 0x00, 0x00, 0x18], 0);
      // Bytes 4-8: "ftyp".
      header.set(fromString("ftyp"), 4);
      // Bytes 8-12: the brand.
      header.set(fromString(brand), 8);
      expect(sniffAudioType(header)).toBe("audio/mp4");
    });
  }

  it("rejects an MP4 container with an unrecognised brand", () => {
    const header = new Uint8Array(16);
    header.set([0x00, 0x00, 0x00, 0x18], 0);
    header.set(fromString("ftyp"), 4);
    header.set(fromString("qt  "), 8); // QuickTime — not in the accepted set.
    expect(sniffAudioType(header)).toBeNull();
  });

  it("rejects an HTML document", () => {
    expect(sniffAudioType(fromString("<!DOCTYPE html>"))).toBeNull();
  });

  it("rejects a PNG", () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(sniffAudioType(png)).toBeNull();
  });

  it("rejects an empty array", () => {
    expect(sniffAudioType(new Uint8Array(0))).toBeNull();
  });

  it("rejects a 3-byte array that doesn't match any magic bytes, without reading past the end", () => {
    expect(sniffAudioType(bytes(0x00, 0x00, 0x00))).toBeNull();
  });

  it("still matches the ID3 magic bytes when the file is truncated to exactly 3 bytes", () => {
    // This is a boundary-condition check: the sniffer only looks at the
    // first 3 bytes for the ID3 tag, so a file that is ONLY those 3 bytes
    // still (correctly, per the magic-byte-only contract) matches — the
    // point of the test is that this doesn't throw or read out of bounds,
    // not that a 3-byte file is a playable MP3.
    expect(sniffAudioType(bytes(0x49, 0x44, 0x33))).toBe("audio/mpeg");
  });

  it("rejects a too-short MP4-like buffer (fewer than 12 bytes)", () => {
    const header = bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34);
    expect(sniffAudioType(header)).toBeNull();
  });
});
