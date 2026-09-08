import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  COMMON_WEAK_PASSWORDS,
  MIN_PASSWORD_LENGTH,
  passwordWeakness,
} from "./password-policy";

describe("passwordWeakness", () => {
  it("accepts a reasonable password", () => {
    expect(passwordWeakness("kahwin-arif-2026", "admin")).toBeNull();
  });

  it("rejects anything under the minimum length", () => {
    expect(passwordWeakness("12345@In", "admin")).toBe("tooShort");
    expect(passwordWeakness("a".repeat(MIN_PASSWORD_LENGTH - 1), "admin")).toBe("tooShort");
  });

  it("rejects a password equal to the username, whatever the case", () => {
    expect(passwordWeakness("Administrator", "administrator")).toBe("sameAsUsername");
  });

  it("rejects the common ones that clear the length rule", () => {
    expect(passwordWeakness("password1234", "admin")).toBe("common");
  });

  it("rejects too little character variety", () => {
    expect(passwordWeakness("ababababababab", "admin")).toBe("lowVariety");
  });

  it("rejects a single repeated character", () => {
    expect(passwordWeakness("cccccccccccccc", "admin")).toBe("repeatedChar");
  });

  it("rejects a straight keyboard or digit run", () => {
    expect(passwordWeakness("abcdefghijkl", "admin")).toBe("sequence");
  });

  it("rejects an absurdly long password rather than hashing it", () => {
    expect(passwordWeakness("x".repeat(5000), "admin")).toBe("tooLong");
  });

  it("does not treat a blank username as a match", () => {
    // A missing username must not make every password "the same as" it.
    expect(passwordWeakness("kahwin-arif-2026", "")).toBeNull();
  });
});

/*
 * `scripts/seed-admin.mjs` is plain .mjs run directly by node, so it cannot
 * import this TypeScript module and carries its own copy of these rules.
 * That duplication is only safe while the two agree — if the seeder let
 * through a password the app rejects, an admin could be created that the
 * change-password form would refuse to reproduce.
 */
describe("parity with scripts/seed-admin.mjs", () => {
  const seeder = readFileSync("scripts/seed-admin.mjs", "utf8");

  it("uses the same minimum length", () => {
    const match = seeder.match(/const MIN_PASSWORD_LENGTH = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MIN_PASSWORD_LENGTH);
  });

  it("uses the same weak-password list", () => {
    const block = seeder.match(/const COMMON_WEAK_PASSWORDS = new Set\(\[([\s\S]*?)\]\)/);
    expect(block).not.toBeNull();
    const inSeeder = new Set(
      [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    );
    expect(inSeeder).toEqual(COMMON_WEAK_PASSWORDS);
  });
});
