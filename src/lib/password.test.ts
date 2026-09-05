import { describe, expect, it } from "vitest";

import {
  DUMMY_HASH_PARAMS,
  hashPassword,
  PBKDF2_ITERATIONS,
  verifyDummyPassword,
  verifyPassword,
} from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a hash against its own password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", stored)).toBe(false);
  });

  it("produces a different salt (and hash) for the same password on each call", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("uses PBKDF2_ITERATIONS by default", async () => {
    const stored = await hashPassword("a password");
    expect(stored.iterations).toBe(PBKDF2_ITERATIONS);
  });

  it("honours a stored non-default iteration count instead of a hardcoded one", async () => {
    // Build a fixture independent of hashPassword (which always hashes at
    // PBKDF2_ITERATIONS), simulating an old row hashed at a different
    // iteration count, to prove verifyPassword re-derives with
    // `stored.iterations` rather than a hardcoded constant.
    const lowIterations = 1_000;
    const saltHex = "aabbccddeeff00112233445566778899";
    const saltBytes = new Uint8Array(saltHex.match(/../g)!.map((b) => parseInt(b, 16)));

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("a password"),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations: lowIterations, hash: "SHA-256" },
      keyMaterial,
      32 * 8,
    );
    const hash = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const stored = { hash, salt: saltHex, iterations: lowIterations };

    // Verifies correctly at the stored (non-default) iteration count...
    expect(await verifyPassword("a password", stored)).toBe(true);
    // ...but would NOT verify if the code hardcoded PBKDF2_ITERATIONS
    // instead of reading `stored.iterations`.
    expect(await verifyPassword("a password", { ...stored, iterations: PBKDF2_ITERATIONS })).toBe(
      false,
    );
  });

  it("dummy verification always returns false, for any input", async () => {
    expect(await verifyDummyPassword("anything")).toBe(false);
    expect(await verifyDummyPassword("")).toBe(false);
    expect(await verifyDummyPassword(DUMMY_HASH_PARAMS.hash)).toBe(false);
  });
});
