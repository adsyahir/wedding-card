/**
 * Password strength rules for admin accounts.
 *
 * Deliberately NOT `server-only`: the change-password form imports this to
 * give feedback as you type, and the API route imports the same function to
 * decide. Client-side checking is a convenience; the server's call is the
 * one that counts, and it re-runs every rule on the value it receives.
 *
 * Returns a CODE, not a sentence. The seeder script speaks Malay only, but
 * the dashboard is bilingual, so the message has to be chosen by the caller
 * from the dictionary rather than baked in here.
 *
 * `scripts/seed-admin.mjs` carries an equivalent copy of these rules. It
 * cannot import this module — it is plain `.mjs` run by node, with no
 * TypeScript build step — so the two are kept deliberately in sync, and
 * `password-policy.test.ts` asserts the constants match.
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Passwords that clear the length rule but are still the first things
 * anyone would try. Not a general breach list — that belongs behind an API
 * this app has no business calling — just the handful that a 12-character
 * minimum otherwise waves through.
 */
export const COMMON_WEAK_PASSWORDS = new Set([
  "password123",
  "password1234",
  "123456789012",
  "qwertyuiop123",
  "letmein12345",
  "administrator",
  "changeme12345",
]);

export type PasswordWeakness =
  | "tooShort"
  | "tooLong"
  | "blank"
  | "sameAsUsername"
  | "common"
  | "lowVariety"
  | "repeatedChar"
  | "sequence";

const SEQUENCES = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl"];

/**
 * Why `password` is unacceptable, or null when it passes every rule.
 *
 * `username` is compared case-insensitively: "Admin" as the password for
 * "admin" is the same bad idea in either case.
 */
export function passwordWeakness(password: string, username: string): PasswordWeakness | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (password.length > MAX_PASSWORD_LENGTH) return "tooLong";
  if (password.trim().length === 0) return "blank";
  if (username && password.toLowerCase() === username.toLowerCase()) return "sameAsUsername";
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) return "common";
  // `repeatedChar` BEFORE `lowVariety`. "cccccccccccccc" satisfies both,
  // and checked the other way round the repeated-character branch is dead
  // code — one distinct character is always fewer than four — so the admin
  // would get the vaguer of the two messages for the clearer mistake.
  if (/^(.)\1+$/.test(password)) return "repeatedChar";
  if (new Set(password).size < 4) return "lowVariety";

  const lower = password.toLowerCase();
  if (lower.length >= 8 && SEQUENCES.some((seq) => seq.includes(lower))) return "sequence";

  return null;
}
