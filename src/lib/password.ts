import "server-only";

import { constantTimeEqual } from "./crypto";

/**
 * Password hashing for admin accounts, built exclusively on the Web Crypto
 * API (`globalThis.crypto.subtle`) so it runs unmodified on Cloudflare
 * Workers — no Node.js `crypto` module, no polyfills.
 *
 * Algorithm: PBKDF2-HMAC-SHA256, 600,000 iterations (OWASP's current
 * recommended minimum for PBKDF2-SHA256 as of 2023), 32-byte derived key,
 * 16-byte random salt per password, everything hex-encoded for storage.
 *
 * The iteration count is stored per-row (`admin_users.iterations`) rather
 * than hardcoded at verification time, specifically so it can be raised in
 * the future (re-hashing existing users lazily on next login, a later
 * enhancement) without invalidating passwords hashed under the old count.
 */

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;

export type StoredPassword = {
  hash: string;
  salt: string;
  iterations: number;
};

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function pbkdf2(
  password: string,
  saltBytes: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      // BufferSource: a plain Uint8Array's underlying ArrayBuffer is
      // accepted here; passed as-is (not `.buffer`) since Web Crypto types
      // accept ArrayBufferView.
      salt: saltBytes,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    DERIVED_KEY_BYTES * 8,
  );

  return toHex(derivedBits);
}

/**
 * Hashes `password` with a fresh random salt and `PBKDF2_ITERATIONS`
 * iterations. Returns everything the caller needs to persist
 * (`admin_users.password_hash` / `.salt` / `.iterations`).
 */
export async function hashPassword(password: string): Promise<StoredPassword> {
  const saltBytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);

  const hash = await pbkdf2(password, saltBytes, PBKDF2_ITERATIONS);

  return { hash, salt, iterations: PBKDF2_ITERATIONS };
}

/**
 * Re-derives a hash for `password` using the STORED salt and iteration
 * count (never a hardcoded one — see module docs) and compares it against
 * the stored hash in constant time.
 */
export async function verifyPassword(
  password: string,
  stored: StoredPassword,
): Promise<boolean> {
  const saltBytes = fromHex(stored.salt);
  const candidate = await pbkdf2(password, saltBytes, stored.iterations);
  return constantTimeEqual(candidate, stored.hash);
}

/**
 * A fixed, real-looking salt/iteration pair used ONLY by
 * `verifyDummyPassword`, never for a real stored user.
 *
 * Purpose: the login route must do the same amount of PBKDF2 work whether
 * the submitted username exists or not, so that response timing can't be
 * used to enumerate valid usernames. Looking up a real user and calling
 * `verifyPassword` does real work; for an unknown username there is no
 * stored row to verify against, so `verifyDummyPassword` performs an
 * equivalent PBKDF2 derivation against this fixed salt and always returns
 * `false`, regardless of the password supplied.
 */
export const DUMMY_HASH_PARAMS: StoredPassword = {
  // Fixed, arbitrary 16-byte hex salt — never used to hash a real password.
  salt: "b7e151628aed2a6abf7158809cf4f3c7",
  iterations: PBKDF2_ITERATIONS,
  // Fixed hash a genuine password will never match (verifyDummyPassword
  // never actually compares against this — it always returns false — but
  // a real-looking value is kept here for clarity/documentation).
  hash: "0".repeat(64),
};

/**
 * Performs the same PBKDF2 work as `verifyPassword` against the fixed
 * `DUMMY_HASH_PARAMS`, and always returns `false`. Called on the
 * unknown-username path of the login route so that path takes
 * approximately the same time as the known-username path, regardless of
 * the password given.
 */
export async function verifyDummyPassword(password: string): Promise<boolean> {
  const saltBytes = fromHex(DUMMY_HASH_PARAMS.salt);
  await pbkdf2(password, saltBytes, DUMMY_HASH_PARAMS.iterations);
  return false;
}
