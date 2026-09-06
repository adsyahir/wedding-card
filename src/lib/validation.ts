import { z } from "zod";

/**
 * Shared Zod schemas for the public RSVP and wishes forms.
 *
 * Deliberately has NO `server-only` import — these schemas are used both by
 * client components (for inline form validation) and by server route
 * handlers (as the source of truth before touching the database), so they
 * must be safe to bundle into client JavaScript.
 */

export const MAX_NAME_LEN = 80;
export const MIN_NAME_LEN = 2;

export const MAX_RSVP_MESSAGE_LEN = 300;

export const MIN_WISH_MESSAGE_LEN = 3;
export const MAX_WISH_MESSAGE_LEN = 500;

export const MIN_ADULTS = 1;
export const MAX_ADULTS = 10;
export const MIN_CHILDREN = 0;
export const MAX_CHILDREN = 10;

/**
 * Matches ASCII control characters (0x00-0x1F, 0x7F) EXCLUDING `\n` (0x0A).
 * Used to reject pasted-in null bytes, escape sequences, etc. while still
 * allowing multi-line message bodies.
 */
const CONTROL_CHARS_EXCEPT_NEWLINE = /[\x00-\x09\x0B-\x1F\x7F]/;

function hasDisallowedControlChars(value: string): boolean {
  return CONTROL_CHARS_EXCEPT_NEWLINE.test(value);
}

/**
 * Normalizes a Malaysian phone number to E.164 (`+60XXXXXXXXX`).
 *
 * Accepts:
 * - Local format with dashes/spaces: `01x-xxx xxxx`, `011-1234 5678`
 * - International with plus: `+60123456789`
 * - International without plus: `60123456789`
 *
 * Returns `null` if the input cannot be interpreted as a valid Malaysian
 * mobile number.
 */
/**
 * Accepts a Malaysian mobile number in any of the forms people actually
 * type it, and returns it in E.164 (`+60...`), or null if it isn't one.
 *
 * The pattern is deliberately narrower than "01 followed by digits": the
 * `[0-46-9]` excludes the 015 range, which is not an assigned mobile
 * prefix, so a typo there is caught rather than stored and then failing
 * silently when someone tries to call it.
 */
const MY_MOBILE = /^(?:\+?60|0)1[0-46-9][0-9]{7,8}$/;

export function normalizeMalaysianPhone(raw: string): string | null {
  // Strip the separators people type: spaces, dashes, brackets, dots.
  const s = raw.trim().replace(/[\s()\-.]/g, "");

  if (!MY_MOBILE.test(s)) return null;

  // Reduce every accepted prefix to the national form (a single leading 0)
  // before rebuilding as E.164, so all three inputs produce one output.
  const national = s.startsWith("+60")
    ? `0${s.slice(3)}`
    : s.startsWith("60")
      ? `0${s.slice(2)}`
      : s;

  return `+60${national.slice(1)}`;
}


const honeypot = z.string().max(0, "Bot detected").optional().default("");

const nameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LEN, `Name must be at least ${MIN_NAME_LEN} characters`)
  .max(MAX_NAME_LEN, `Name must be at most ${MAX_NAME_LEN} characters`)
  .refine((v) => !hasDisallowedControlChars(v), "Name contains invalid characters");

const phoneSchema = z
  .string()
  .trim()
  .transform((val, ctx) => {
    const normalized = normalizeMalaysianPhone(val);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Invalid Malaysian phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export const rsvpSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  attending: z.boolean(),
  adults: z.number().int().min(MIN_ADULTS).max(MAX_ADULTS),
  children: z.number().int().min(MIN_CHILDREN).max(MAX_CHILDREN),
  message: z
    .string()
    .trim()
    .max(MAX_RSVP_MESSAGE_LEN, `Message must be at most ${MAX_RSVP_MESSAGE_LEN} characters`)
    .refine((v) => !hasDisallowedControlChars(v), "Message contains invalid characters")
    .optional(),
  /**
   * An optional public wish submitted alongside the RSVP.
   *
   * Distinct from `message` above: `message` is a PRIVATE note to the
   * family, visible only in the admin panel, whereas this is published on
   * the ucapan wall once an admin approves it. Same length rules as a
   * standalone wish so the two paths cannot drift.
   */
  ucapan: z
    .string()
    .trim()
    .min(MIN_WISH_MESSAGE_LEN, `Ucapan must be at least ${MIN_WISH_MESSAGE_LEN} characters`)
    .max(MAX_WISH_MESSAGE_LEN, `Ucapan must be at most ${MAX_WISH_MESSAGE_LEN} characters`)
    .refine((v) => !hasDisallowedControlChars(v), "Ucapan contains invalid characters")
    .optional(),
  // Honeypot field: legitimate clients never fill this in. Must be empty.
  website: honeypot,
});

export type RsvpInput = z.infer<typeof rsvpSchema>;

export const wishSchema = z.object({
  name: nameSchema,
  message: z
    .string()
    .trim()
    .min(MIN_WISH_MESSAGE_LEN, `Message must be at least ${MIN_WISH_MESSAGE_LEN} characters`)
    .max(MAX_WISH_MESSAGE_LEN, `Message must be at most ${MAX_WISH_MESSAGE_LEN} characters`)
    .refine((v) => !hasDisallowedControlChars(v), "Message contains invalid characters"),
  // Honeypot field: legitimate clients never fill this in. Must be empty.
  website: honeypot,
});

export type WishInput = z.infer<typeof wishSchema>;
