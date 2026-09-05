import "server-only";

/**
 * Crypto helpers built exclusively on the Web Crypto API (`globalThis.crypto`)
 * so they run unmodified on Cloudflare Workers — no Node.js `crypto` module,
 * no polyfills.
 */

const textEncoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 digest of `input`, returned as a lowercase hex string. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(input));
  return toHex(digest);
}

/** HMAC-SHA256 of `msg` using `key`, returned as a lowercase hex string. */
export async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(msg));
  return toHex(signature);
}

/** Cryptographically random token, base64url-encoded (no padding). */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toBase64Url(arr);
}

/**
 * Constant-time string comparison for hex/base64 strings.
 *
 * Does not early-return on a length mismatch (which would leak the length
 * difference via timing). Instead, both strings are compared over a fixed
 * length and a length-mismatch flag is OR'd into the final result.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length, 1);
  let diff = a.length === b.length ? 0 : 1;

  for (let i = 0; i < maxLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= charA ^ charB;
  }

  return diff === 0;
}

/**
 * Derives a per-UTC-day secret via `hmacSha256Hex(secret, "YYYY-MM-DD")`.
 * The date is always taken in UTC so the salt rotates at a fixed, unambiguous
 * instant regardless of server or visitor timezone.
 */
export async function dailySalt(secret: string, date: Date = new Date()): Promise<string> {
  const yyyy = date.getUTCFullYear().toString().padStart(4, "0");
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  return hmacSha256Hex(secret, `${yyyy}-${mm}-${dd}`);
}

/**
 * Produces an anonymous, per-day-rotating identifier for a visitor.
 *
 * The identifier is `sha256(ip + " " + userAgent + " " + dailySalt)`,
 * truncated to the first 32 hex characters (16 bytes / 128 bits) — plenty of
 * collision resistance for rate-limiting and rough analytics, while keeping
 * the stored value short.
 *
 * Two properties make this safe to store (unlike a raw IP or user-agent):
 * - **Daily salt rotation**: because the salt is derived fresh for each UTC
 *   day via `dailySalt`, the same visitor gets an unrelated hash tomorrow.
 *   There is no way to correlate a visitor's activity across two different
 *   days from the hash alone — each day is cryptographically unlinkable
 *   from the next.
 * - **One-way**: SHA-256 is a one-way function, and the salt is a server
 *   secret never exposed to clients, so the raw IP address cannot be
 *   recovered from the stored hash even if the hash is leaked (short of a
 *   brute-force over the (small) space of real-world IP/UA pairs, which the
 *   secret salt also defeats since it cannot be guessed).
 */
export async function visitorHash(
  ip: string,
  userAgent: string,
  secret: string,
): Promise<string> {
  const salt = await dailySalt(secret);
  const full = await sha256Hex(`${ip} ${userAgent} ${salt}`);
  return full.slice(0, 32);
}
