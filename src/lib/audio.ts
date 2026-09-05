/**
 * Audio format sniffing for uploaded background-music tracks.
 *
 * Deliberately has NO `server-only` import (pure, dependency-free, and
 * unit-tested directly — see `src/lib/audio.test.ts`).
 *
 * SECURITY: this is the only thing standing between an arbitrary uploaded
 * byte stream and a URL every wedding guest's browser will load
 * (`/api/music/<id>`, see `src/app/api/music/[id]/route.ts`). It validates
 * by MAGIC BYTES ONLY — never by the client-declared `Content-Type` header
 * or the filename, both of which are fully attacker-controlled and trivial
 * to fake (e.g. renaming `evil.html` to `evil.mp3` and setting
 * `Content-Type: audio/mpeg`).
 */

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export type SniffedAudioType = "audio/mpeg" | "audio/mp4";

const ID3_MAGIC = [0x49, 0x44, 0x33]; // "ID3"

/**
 * True for either shape a valid MP3 file can start with:
 * - An ID3v2 tag (`ID3` at offset 0) — what most real-world MP3 encoders
 *   emit today.
 * - A bare MPEG audio frame sync: first byte `0xFF`, and the top three bits
 *   of the second byte all set (`0xE0` mask) — an MP3 with no ID3 tag at
 *   all, or (harmlessly) the start of a later frame if ID3 detection above
 *   somehow didn't already match.
 */
function isMp3(bytes: Uint8Array): boolean {
  if (
    bytes.length >= 3 &&
    bytes[0] === ID3_MAGIC[0] &&
    bytes[1] === ID3_MAGIC[1] &&
    bytes[2] === ID3_MAGIC[2]
  ) {
    return true;
  }

  return hasValidMpegFrameHeader(bytes);
}

/**
 * Validates a bare MPEG audio frame header (an MP3 with no ID3 tag).
 *
 * A two-byte sync check alone (`0xFF` followed by three set bits) is a very
 * weak signal — only 11 bits — so all sorts of non-audio content starts
 * with a byte pair that satisfies it. We therefore also reject the
 * combinations the MPEG spec marks reserved/invalid, which a real encoder
 * can never emit:
 *   - version bits `01`      (reserved)
 *   - layer bits `00`        (reserved)
 *   - bitrate index `1111`   (invalid)
 *   - sample-rate bits `11`  (reserved)
 *
 * This does not make the sniffer a decoder, and a determined attacker can
 * still craft bytes that satisfy it. It is not the last line of defence:
 * `src/app/api/music/[id]/route.ts` serves every object with a hardcoded
 * audio Content-Type, `X-Content-Type-Options: nosniff` and
 * `Content-Disposition: inline`, so even content that slips through here
 * can never be parsed as HTML or script on our origin. This check simply
 * stops obvious junk from being stored and served as if it were music.
 */
function hasValidMpegFrameHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false;
  if (bytes[0] !== 0xff || (bytes[1] & 0xe0) !== 0xe0) return false;

  const version = (bytes[1] >> 3) & 0b11;
  const layer = (bytes[1] >> 1) & 0b11;
  const bitrateIndex = (bytes[2] >> 4) & 0b1111;
  const sampleRate = (bytes[2] >> 2) & 0b11;

  if (version === 0b01) return false;
  if (layer === 0b00) return false;
  if (bitrateIndex === 0b1111) return false;
  if (sampleRate === 0b11) return false;

  return true;
}

// The MP4/M4A "brand" identifiers this app accepts. Anything else in the
// ftyp box (e.g. a video brand) is rejected — this app only ever wants an
// audio container.
const MP4_BRANDS = new Set(["M4A ", "mp42", "isom", "mp41"]);

/**
 * True for an ISO base media file (MP4/M4A container): the `ftyp` box
 * signature at byte offset 4-8, followed by one of the accepted brand
 * identifiers at offset 8-12.
 */
function isMp4(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (ftyp !== "ftyp") return false;

  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return MP4_BRANDS.has(brand);
}

/**
 * Sniffs `bytes` and returns the audio MIME type it looks like, or `null`
 * if it doesn't match any format this app accepts. Never throws, and never
 * reads past the end of a short/empty array.
 */
export function sniffAudioType(bytes: Uint8Array): SniffedAudioType | null {
  if (isMp3(bytes)) return "audio/mpeg";
  if (isMp4(bytes)) return "audio/mp4";
  return null;
}
