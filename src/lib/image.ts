/**
 * Image format sniffing for uploaded gallery photos.
 *
 * Deliberately has NO `server-only` import (pure, dependency-free, and
 * unit-tested directly — see `src/lib/image.test.ts`). Mirrors
 * `src/lib/audio.ts` exactly: same class of risk, same defense.
 *
 * SECURITY: this is the only thing standing between an arbitrary uploaded
 * byte stream and a URL every wedding guest's browser will load
 * (`/api/gallery/<id>`, see `src/app/api/gallery/[id]/route.ts`). It
 * validates by MAGIC BYTES ONLY — never by the client-declared
 * `Content-Type` header or the filename, both of which are fully
 * attacker-controlled and trivial to fake (e.g. renaming `evil.svg` to
 * `evil.jpg` and setting `Content-Type: image/jpeg`).
 *
 * SVG is deliberately NEVER accepted, even though browsers render it as an
 * image: an SVG document can embed `<script>` and event-handler attributes,
 * making it a stored-XSS vector if it were ever served inline (which the
 * streaming route does, via `Content-Disposition: inline`).
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_GALLERY_IMAGES = 30;

export type SniffedImageType = "image/jpeg" | "image/png" | "image/webp";

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function matchesMagic(bytes: Uint8Array, magic: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[offset + i] !== magic[i]) return false;
  }
  return true;
}

function isJpeg(bytes: Uint8Array): boolean {
  return matchesMagic(bytes, JPEG_MAGIC);
}

function isPng(bytes: Uint8Array): boolean {
  return matchesMagic(bytes, PNG_MAGIC);
}

/**
 * True for a RIFF/WEBP container: `RIFF` at offset 0 AND `WEBP` at offset
 * 8. `RIFF` alone is not sufficient — it's also the container signature
 * for WAV and AVI, so both four-byte tags must match.
 */
function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (riff !== "RIFF") return false;
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return webp === "WEBP";
}

/**
 * Sniffs `bytes` and returns the image MIME type it looks like, or `null`
 * if it doesn't match any format this app accepts. Never throws, and never
 * reads past the end of a short/empty array.
 */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  return null;
}
