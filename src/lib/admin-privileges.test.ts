import { describe, expect, it } from "vitest";

import { canSendTestEmail, TEST_EMAIL_USERNAME } from "./admin-privileges";

describe("canSendTestEmail", () => {
  it("allows the named admin account", () => {
    expect(canSendTestEmail(TEST_EMAIL_USERNAME)).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    // The seeder stores the username as typed, and "Admin" is the same
    // account to the person who created it.
    expect(canSendTestEmail("Admin")).toBe(true);
    expect(canSendTestEmail("  admin  ")).toBe(true);
  });

  it("refuses every other account", () => {
    for (const name of ["reviewadmin", "phase5verify", "administrator", "admin2", "adm"]) {
      expect(canSendTestEmail(name), name).toBe(false);
    }
  });

  it("refuses a missing username rather than defaulting open", () => {
    // `getAdminUsername` returns "" when the row has gone; that must not
    // read as permission.
    expect(canSendTestEmail("")).toBe(false);
    expect(canSendTestEmail(null)).toBe(false);
    expect(canSendTestEmail(undefined)).toBe(false);
  });
});
